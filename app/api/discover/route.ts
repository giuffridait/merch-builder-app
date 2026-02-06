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
    'You are an inventory discovery assistant for custom merch.',
    'Return ONLY a JSON object with this shape:',
    '{ "assistant": string, "updates": { "stage"?: string, "category"?: string, "budgetMax"?: number, "materials"?: string[], "sustainable"?: boolean, "quantity"?: number, "eventDate"?: string, "tags"?: string[], "occasion"?: string, "color"?: string, "leadTimeMax"?: number, "size"?: string }, "selection": { "primaryIds"?: string[], "fallbackIds"?: string[], "rationale"?: string } }',
    'Do not include markdown or code fences.',
    'Only use categories: tee, hoodie, tote, mug.',
    'Only use colors: white, black, navy, forest, burgundy, natural, charcoal.',
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
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      return null;
    }
  }

  const raw = text.match(/({[\s\S]*})/);
  if (raw?.[1]) {
    try {
      return JSON.parse(raw[1]);
    } catch {
      return null;
    }
  }

  return null;
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
  if (raw.color && ['white', 'black', 'navy', 'forest', 'burgundy', 'natural', 'charcoal'].includes(raw.color)) {
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

async function getLLMResponse(userMessage: string, state: DiscoverState, candidates: ReturnType<typeof getInventory>) {
  const systemPrompt = buildSystemPrompt(state, candidates);
  const llmMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ] as const;

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

    const parsedUpdates = parseConstraints(userMessage);
    const candidateConstraints = { ...state.constraints, ...parsedUpdates };
    const candidates = filterInventory(getInventory(), candidateConstraints);
    const llm = await getLLMResponse(userMessage, state, candidates);
    const llmUpdates = llm?.updates || {};
    const updates = { ...parsedUpdates, ...llmUpdates };
    const newConstraints = { ...state.constraints, ...updates };
    const stage = updates.stage || (state.stage === 'welcome' ? 'constraints' : state.stage);
    let results = rankInventory(newConstraints);
    const rationale = llm?.selection?.rationale;

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

          const assistantMessage = llm?.assistantMessage || 'Here are the best matches based on your constraints.';
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
      assistantMessage: llm?.assistantMessage || 'Here are the best matches based on your constraints.',
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
