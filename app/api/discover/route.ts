import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/llm';
import {
  DiscoverConstraints,
  DiscoverState,
  filterInventory,
  getAvailableMaterials,
  isMaterialsQuestion,
  parseConstraints,
  rankInventory
} from '@/lib/discover';
import { getInventory } from '@/lib/inventory';
import { validateCustomizationUpdates } from '@/lib/customization-constraints';

type LLMResult = {
  assistant: string;
  updates?: Partial<DiscoverConstraints> & { stage?: DiscoverState['stage'] };
  selection?: {
    primaryIds?: string[];
    fallbackIds?: string[];
    rationale?: string;
  };
};

const STAGES: DiscoverState['stage'][] = ['welcome', 'constraints', 'results'];

function buildSystemPrompt(state: DiscoverState, candidates: ReturnType<typeof getInventory>) {
  const inventory = candidates.map(item => ({
    item_id: item.item_id,
    title: item.title,
    description: item.description,
    price: item.price,
    availability: item.availability,
    materials: item.attributes.materials,
    tags: item.attributes.tags,
    colors: item.attributes.variants.colors.map(c => c.name),
    lead_time_days: item.attributes.lead_time_days,
    min_qty: item.attributes.min_qty
  }));
  return [
    'You are a friendly, proactive inventory discovery assistant for custom merch.',
    'Sound like a helpful shopping companion: warm, concise, and confident.',
    'Always provide recommendations when you have enough constraints and candidates.',
    'Only ask a clarifying question if there are zero viable candidates or a critical constraint is missing.',
    'Avoid robotic confirmation-only replies.',
    'Example response:',
    '{ "assistant": "Here are 2 options for black tees.", "updates": { "color": "black", "category": "tee" }, "selection": { "primaryIds": ["tee-01"], "rationale": "Matches your black color request." } }',
    'NEVER use placeholders like "string", "number", or types in your JSON values. Always provide actual values.',
    'Do not include markdown or code fences.',
    'Only use categories: tee, hoodie, tote, mug.',
    'Only use colors: white, black, navy, forest, burgundy, natural, charcoal, red, pink, blue, green.',
    'Only use sizes: XS, S, M, L, XL, 2XL.',
    'Only choose item_id values that exist in Inventory.',
    'Prefer 1 primary item and up to 2 fallback items.',
    'If constraints are ambiguous or missing (e.g., no category, no budget, no quantity, no color), ask a clarifying question in assistant.',
    'Use stage progression: welcome -> constraints -> results.',
    `Current state: ${JSON.stringify(state)}`,
    `Inventory: ${JSON.stringify(inventory)}`
  ].join('\n');
}

function extractJson(text: string): any | null {
  // Try to find JSON block
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  let potentialJson = fenced?.[1] || text;

  // If no fenced block, try to find the first '{' and last '}'
  if (!fenced) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      potentialJson = text.substring(start, end + 1);
    }
  }

  try {
    return JSON.parse(potentialJson);
  } catch {
    // Last ditch effort: try to fix missing quotes on property names (common for LLMs)
    try {
      const fixed = potentialJson.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function normalizeUpdates(raw: LLMResult['updates']): Partial<DiscoverConstraints> & { stage?: DiscoverState['stage'] } {
  const updates: Partial<DiscoverConstraints> & { stage?: DiscoverState['stage'] } = {};
  if (!raw) return updates;

  if (raw.stage && STAGES.includes(raw.stage)) updates.stage = raw.stage;
  if (raw.category && ['tee', 'hoodie', 'tote', 'mug'].includes(raw.category)) {
    updates.category = raw.category as DiscoverConstraints['category'];
  }
  if (typeof raw.budgetMax === 'number') updates.budgetMax = raw.budgetMax;
  if (Array.isArray(raw.materials)) updates.materials = raw.materials;
  if (typeof raw.sustainable === 'boolean') updates.sustainable = raw.sustainable;
  if (typeof raw.quantity === 'number') updates.quantity = raw.quantity;
  if (typeof raw.eventDate === 'string') updates.eventDate = raw.eventDate;
  if (Array.isArray(raw.tags)) updates.tags = raw.tags;
  if (raw.color && ['white', 'black', 'navy', 'forest', 'burgundy', 'natural', 'charcoal', 'red', 'pink', 'blue', 'green'].includes(raw.color)) {
    updates.color = raw.color;
  }
  if (raw.occasion && ['gift', 'team', 'event', 'personal'].includes(raw.occasion)) {
    updates.occasion = raw.occasion as DiscoverConstraints['occasion'];
  }
  if (typeof raw.leadTimeMax === 'number') updates.leadTimeMax = raw.leadTimeMax;
  if (raw.size && ['XS', 'S', 'M', 'L', 'XL', '2XL'].includes(raw.size)) updates.size = raw.size;

  return updates;
}

function fallbackResponse(userMessage: string, state: DiscoverState) {
  const updates = parseConstraints(userMessage);
  const merged = { ...state.constraints, ...updates };
  const stage = state.stage === 'welcome' ? 'constraints' : state.stage;
  const results = rankInventory(merged);

  const assistantMessage =
    stage === 'constraints'
      ? "Tell me what you need (budget, material, style, quantity, timing) and I’ll narrow options."
      : "Got it. Here are the best matches based on your constraints.";

  return {
    assistantMessage,
    updates: { ...updates, stage },
    results
  };
}

function formatConstraintSummary(constraints: DiscoverConstraints) {
  const parts: string[] = [];
  if (constraints.category) parts.push(constraints.category);
  if (constraints.color) parts.push(`${constraints.color} color`);
  if (constraints.materials && constraints.materials.length > 0) {
    parts.push(constraints.materials.join(' / '));
  }
  if (constraints.size) parts.push(`size ${constraints.size}`);
  if (constraints.budgetMax != null) parts.push(`under €${constraints.budgetMax}`);
  if (constraints.leadTimeMax != null) parts.push(`delivery within ${constraints.leadTimeMax} days`);
  if (constraints.quantity != null) parts.push(`${constraints.quantity} pcs`);
  return parts.length > 0 ? parts.join(', ') : '';
}

function describeAlternatives(
  explicit: Partial<DiscoverConstraints>,
  base: DiscoverConstraints
) {
  const candidates = filterInventory(getInventory(), base);
  if (explicit.color) {
    const colors = Array.from(new Set(
      candidates.flatMap(item => item.attributes.variants.colors.map(c => c.name))
    )).sort();
    return colors.length > 0
      ? `We don’t have ${explicit.color} in stock for that request. Available colors: ${colors.join(', ')}. Want one of those?`
      : `We don’t have ${explicit.color} in stock for that request. Want me to suggest alternatives?`;
  }
  if (explicit.materials && explicit.materials.length > 0) {
    const materials = Array.from(new Set(
      candidates.flatMap(item => item.attributes.materials)
    )).sort();
    return materials.length > 0
      ? `We don’t have ${explicit.materials.join(', ')} for that request. Available materials: ${materials.join(', ')}.`
      : `We don’t have that material in stock. Want me to suggest alternatives?`;
  }
  if (explicit.size) {
    const sizes = Array.from(new Set(
      candidates.flatMap(item => item.attributes.variants.sizes)
    )).sort();
    return sizes.length > 0
      ? `That size isn’t available for these items. Available sizes: ${sizes.join(', ')}.`
      : `That size isn’t available. Want me to suggest alternatives?`;
  }
  if (explicit.leadTimeMax != null) {
    const leadTimes = candidates.map(item => item.attributes.lead_time_days).sort((a, b) => a - b);
    const fastest = leadTimes[0];
    return fastest != null
      ? `Fastest available lead time is ${fastest} days. Want me to show those options?`
      : `We can’t meet that lead time right now. Want me to suggest alternatives?`;
  }
  if (explicit.budgetMax != null) {
    const prices = candidates.map(item => item.price.amount).sort((a, b) => a - b);
    const lowest = prices[0];
    return lowest != null
      ? `The lowest available price is €${lowest}. Want me to show those options?`
      : `We don’t have options in that budget. Want me to suggest alternatives?`;
  }
  return null;
}

async function getLLMResponse(userMessage: string, state: DiscoverState, candidates: ReturnType<typeof getInventory>) {
  const systemPrompt = buildSystemPrompt(state, candidates);
  const llmMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  const raw = await chatCompletion(llmMessages);
  const parsed = extractJson(raw) as LLMResult | null;
  if (parsed?.assistant) {
    const updates = normalizeUpdates(parsed.updates);
    return { assistantMessage: parsed.assistant, updates, selection: parsed.selection };
  }

  if (raw && raw.trim().length > 0) {
    const fallback = fallbackResponse(userMessage, state);
    return { assistantMessage: raw.trim(), updates: fallback.updates };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const state = body.state as DiscoverState | undefined;
  const userMessage = (body.userMessage || '').toString();
  const stream = !!body.stream;

  if (!state || !userMessage) {
    return NextResponse.json({ error: 'Missing state or userMessage' }, { status: 400 });
  }

  try {
    if (isMaterialsQuestion(userMessage)) {
      const materials = getAvailableMaterials(state.constraints);
      const assistantMessage = materials.length > 0
        ? `Available materials right now: ${materials.join(', ')}. Do you have a preference?`
        : 'I can work with cotton, premium cotton, recycled blends, canvas, and ceramic. Do you have a preference?';

      if (stream) {
        const encoder = new TextEncoder();
        const streamResponse = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: any) => {
              const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(payload));
            };

            send('updates', {});
            send('results', []);
            const chunks = assistantMessage.match(/.{1,16}/g) || [];
            for (const part of chunks) send('delta', part);
            send('done', { fallbackUsed: false });
            controller.close();
          }
        });

        return new Response(streamResponse, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive'
          }
        });
      }

      return NextResponse.json({
        assistantMessage,
        updates: {},
        results: []
      });
    }

    const parsedUpdatesRaw = parseConstraints(userMessage);
    const candidateConstraints = { ...state.constraints, ...parsedUpdatesRaw };
    const candidates = filterInventory(getInventory(), candidateConstraints);
    const llm = await getLLMResponse(userMessage, state, candidates);
    const llmUpdatesRaw = llm?.updates || {};

    // Use strict validation to sanitize both LLM and keyword extraction
    const llmUpdates = validateCustomizationUpdates(llmUpdatesRaw);
    const parsedUpdates = validateCustomizationUpdates(parsedUpdatesRaw);

    // User-parsed constraints should take precedence over model guesses.
    const updates = { ...llmUpdates, ...parsedUpdates };
    const newConstraints = { ...state.constraints, ...updates };
    const stage = updates.stage || (state.stage === 'welcome' ? 'constraints' : state.stage);
    let results = rankInventory(newConstraints);
    const rationale = llm?.selection?.rationale;
    let assistantMessageOverride: string | null = null;

    if (results.length === 0) {
      if (parsedUpdates.color) {
        const withoutColor = { ...newConstraints };
        delete withoutColor.color;
        assistantMessageOverride = describeAlternatives({ color: parsedUpdates.color }, withoutColor);
      } else if (parsedUpdates.materials && parsedUpdates.materials.length > 0) {
        const withoutMaterials = { ...newConstraints };
        delete withoutMaterials.materials;
        assistantMessageOverride = describeAlternatives({ materials: parsedUpdates.materials }, withoutMaterials);
      } else if (parsedUpdates.size) {
        const withoutSize = { ...newConstraints };
        delete withoutSize.size;
        assistantMessageOverride = describeAlternatives({ size: parsedUpdates.size }, withoutSize);
      } else if (parsedUpdates.leadTimeMax != null) {
        const withoutLead = { ...newConstraints };
        delete withoutLead.leadTimeMax;
        assistantMessageOverride = describeAlternatives({ leadTimeMax: parsedUpdates.leadTimeMax }, withoutLead);
      } else if (parsedUpdates.budgetMax != null) {
        const withoutBudget = { ...newConstraints };
        delete withoutBudget.budgetMax;
        assistantMessageOverride = describeAlternatives({ budgetMax: parsedUpdates.budgetMax }, withoutBudget);
      }
    }

    if (llm?.selection?.primaryIds && llm.selection.primaryIds.length > 0) {
      const orderedIds = [
        ...llm.selection.primaryIds,
        ...(llm.selection.fallbackIds || [])
      ];
      const byId = new Map(results.map(item => [item.item_id, item]));
      const ordered = orderedIds.map(id => byId.get(id)).filter(Boolean) as typeof results;
      if (ordered.length > 0) {
        const remaining = results.filter(item => !orderedIds.includes(item.item_id));
        results = [...ordered, ...remaining];
      }
    }

    const summary = formatConstraintSummary(newConstraints);
    const assistantMessage =
      assistantMessageOverride ||
      (results.length > 0
        ? `Here are ${results.length} options${summary ? ` for ${summary}` : ''}. Top pick: ${results[0]?.title}.`
        : (llm?.assistantMessage || 'Tell me what you need (budget, material, quantity, timing). I’ll shortlist the best products.'));

    if (stream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: any) => {
            const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          };

          send('updates', { ...updates, stage });
          send('results', results.map(item => ({ ...item, reason: rationale || item.reason })));

          const chunks = assistantMessage.match(/.{1,16}/g) || [];
          for (const part of chunks) send('delta', part);

          send('done', { fallbackUsed: false });
          controller.close();
        }
      });

      return new Response(streamResponse, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        }
      });
    }

    return NextResponse.json({
      assistantMessage,
      updates: { ...updates, stage },
      results: results.map(item => ({ ...item, reason: rationale || item.reason }))
    });
  } catch (error: any) {
    const fallback = fallbackResponse(userMessage, state);
    if (stream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: any) => {
            const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          };

          send('updates', fallback.updates || {});
          send('results', fallback.results || []);
          const chunks = fallback.assistantMessage.match(/.{1,16}/g) || [];
          for (const part of chunks) send('delta', part);
          send('done', { fallbackUsed: true, error: error?.message || 'Unknown error' });
          controller.close();
        }
      });

      return new Response(streamResponse, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        }
      });
    }

    return NextResponse.json({ ...fallback, fallbackUsed: true });
  }
}
