import { PRODUCTS } from '@/lib/catalog';
import { ICON_LIBRARY } from '@/lib/icons';
import { chatCompletion, streamChatCompletion } from '@/lib/llm';
import { ConversationState, getMissingFields } from '@/lib/agent';
import {
  TEXT_COLOR_OPTIONS,
  validateCustomizationUpdates
} from '@/lib/customization-constraints';

// ── Types ──────────────────────────────────────────────────────────────────────

type LLMResult = {
  assistant: string;
  updates?: Record<string, any>;
};

export type EngineResult = {
  assistantMessage: string;
  updates: Partial<ConversationState>;
};

export type EngineStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'done'; assistantMessage: string; updates: Partial<ConversationState> };

// ── System Prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(state: ConversationState): string {
  const missing = getMissingFields(state);

  return [
    'You are a friendly merch design assistant. Return ONLY valid JSON.',
    '{ "assistant": string, "updates": { "productId"?: string, "text"?: string, "iconId"?: string, "productColor"?: string, "textColor"?: string, "size"?: string, "quantity"?: number, "occasion"?: string, "vibe"?: string, "action"?: "add_to_cart" | "remove_icon" } }',
    '',
    'NEVER use placeholders like "string", "number", or type names as values. Always use real values from the catalog.',
    '',
    'Products: classic-tee (Colors: Black, White, Navy, Forest, Burgundy. Sizes: XS-2XL), hoodie (Colors: Black, Charcoal, Navy, Burgundy. Sizes: S-2XL), tote (Colors: Natural, Black).',
    `Icons: ${ICON_LIBRARY.map(i => i.id).join(', ')}.`,
    `Text colors: ${Object.keys(TEXT_COLOR_OPTIONS).join(', ')}.`,
    '',
    'RULES:',
    '- Only support the products listed above. Reject others politely.',
    '- The user can specify product, text, icon, color, size in any order or all at once.',
    '- Set productId and productColor for the garment (e.g., "navy tee").',
    '- Set textColor for the design/icon color (e.g., "white star", "red text").',
    '- Set text or iconId if mentioned.',
    '- If user asks to remove the icon, set action: "remove_icon" and iconId: "none".',
    '- Set action: "add_to_cart" if user is ready to buy.',
    missing.length > 0
      ? `- The user still needs to provide: ${missing.join(', ')}. Guide them toward filling these.`
      : '- All required fields are filled. The user can customize further or add to cart.',
    '',
    `Current state: ${JSON.stringify({
      product: state.product?.id,
      text: state.text,
      icon: state.icon,
      productColor: state.productColor,
      textColor: state.textColor,
      size: state.size,
      quantity: state.quantity,
      occasion: state.occasion,
      vibe: state.vibe
    })}`
  ].join('\n');
}

// ── Keyword Fallback ───────────────────────────────────────────────────────────

function parseKeywordUpdates(message: string): Record<string, any> {
  const text = message.toLowerCase();
  const updates: Record<string, any> = {};

  // Product keywords
  if (text.includes('tee') || text.includes('shirt') || text.includes('t-shirt')) updates.productId = 'classic-tee';
  else if (text.includes('hoodie')) updates.productId = 'hoodie';
  else if (text.includes('tote') || text.includes('bag')) updates.productId = 'tote';

  const colors = ['black', 'white', 'red', 'navy', 'forest', 'burgundy', 'charcoal', 'natural', 'pink', 'blue', 'green'];

  colors.forEach(color => {
    if (text.includes(color)) {
      const productRegex = new RegExp(`${color}\\s*(?:tee|shirt|t-shirt|hoodie|tote|bag|top|garment|item)`, 'i');
      const productRegexRev = new RegExp(`(?:tee|shirt|t-shirt|hoodie|tote|bag|top|garment|item)\\s*(?:in|of)?\\s*${color}`, 'i');

      if (productRegex.test(text) || productRegexRev.test(text)) {
        updates.productColor = color;
      } else {
        const designRegex = new RegExp(`${color}\\s*(?:text|icon|star|heart|logo|arrow|wave|sun|mountain|design|print)`, 'i');
        const designRegexRev = new RegExp(`(?:text|icon|star|heart|logo|arrow|wave|sun|mountain|design|print)\\s*(?:in|of)?\\s*${color}`, 'i');

        if (designRegex.test(text) || designRegexRev.test(text)) {
          updates.textColor = color;
        } else if (!updates.productColor) {
          updates.productColor = color;
        }
      }
    }
  });

  // "in color" patterns
  const inColorMatch = text.match(/(?:star|heart|logo|text|icon|print)\s+in\s+(\w+)/);
  if (inColorMatch && colors.includes(inColorMatch[1])) {
    updates.textColor = inColorMatch[1];
  }
  const productInColorMatch = text.match(/(?:tee|shirt|t-shirt|hoodie|tote|bag)\s+in\s+(\w+)/);
  if (productInColorMatch && colors.includes(productInColorMatch[1])) {
    updates.productColor = productInColorMatch[1];
  }

  // Size keywords
  const sizes = ['xs', 's', 'm', 'l', 'xl', '2xl'];
  const foundSize = sizes.find(s => new RegExp(`\\b${s}\\b`).test(text));
  if (foundSize) updates.size = foundSize.toUpperCase();

  // Quantity
  const qtyMatch = text.match(/(\d+)\s*(?:items|pcs|pieces|shirts|hoodies|totes)/);
  if (qtyMatch?.[1]) updates.quantity = parseInt(qtyMatch[1], 10);

  // Icon keywords
  const iconIds = ICON_LIBRARY.map(i => i.id);
  const foundIcon = iconIds.find(id => text.includes(id));
  if (foundIcon) updates.iconId = foundIcon;

  // Quoted text
  const quoteMatch = message.match(/"([^"]+)"/) || message.match(/'([^']+)'/);
  if (quoteMatch?.[1]) updates.text = quoteMatch[1];

  return updates;
}

// ── Update Normalization ───────────────────────────────────────────────────────

function normalizeUpdates(raw: Record<string, any>): Partial<ConversationState> {
  const validated = validateCustomizationUpdates(raw);
  const updates: Partial<ConversationState> = {};

  if (validated.productId) {
    const match = PRODUCTS.find(p => p.id === validated.productId);
    if (match) updates.product = match;
  }
  if (validated.occasion) updates.occasion = validated.occasion;
  if (validated.vibe) updates.vibe = validated.vibe;
  if (validated.text) updates.text = validated.text;
  if (validated.iconId) {
    const icon = ICON_LIBRARY.find(i => i.id === validated.iconId);
    if (icon) updates.icon = icon.id;
  }
  if (validated.productColor) updates.productColor = validated.productColor;
  if (validated.textColor) updates.textColor = validated.textColor;
  if (validated.size) updates.size = validated.size;
  if (validated.quantity != null) updates.quantity = validated.quantity;
  if (validated.action) (updates as any).action = validated.action;

  return updates;
}

// ── Non-Streaming Response ─────────────────────────────────────────────────────

export async function processResponse(
  userMessage: string,
  state: ConversationState,
  messageHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<EngineResult> {
  const systemPrompt = buildSystemPrompt(state);
  const llmMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messageHistory.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage }
  ];

  let assistantMessage: string;
  let llmUpdates: Partial<ConversationState> = {};

  try {
    const raw = await chatCompletion(llmMessages, { responseFormat: 'json' });
    let parsed: LLMResult | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If JSON parse fails (e.g. model doesn't support format: json), try extracting
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try { parsed = JSON.parse(raw.substring(start, end + 1)); } catch { /* give up */ }
      }
    }

    assistantMessage = parsed?.assistant || raw || "Tell me more about what you'd like to make.";
    if (parsed?.updates) {
      llmUpdates = normalizeUpdates(parsed.updates);
    }
  } catch {
    assistantMessage = "I'm having trouble connecting right now. I've updated based on what I understood.";
  }

  // Keyword fallback — deterministic parsing always runs and takes precedence
  const keywordRaw = parseKeywordUpdates(userMessage);
  const keywordUpdates = normalizeUpdates(keywordRaw);
  const updates = { ...llmUpdates, ...keywordUpdates };

  return { assistantMessage, updates };
}

// ── Streaming Response ─────────────────────────────────────────────────────────

export async function* processResponseStream(
  userMessage: string,
  state: ConversationState,
  messageHistory: { role: 'user' | 'assistant'; content: string }[]
): AsyncGenerator<EngineStreamEvent> {
  const systemPrompt = buildSystemPrompt(state);
  const llmMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messageHistory.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage }
  ];

  let fullContent = '';
  try {
    for await (const event of streamChatCompletion(llmMessages, { responseFormat: 'json' })) {
      if (event.type === 'token') {
        fullContent += event.content;
        // Don't yield raw JSON tokens — we'll parse and stream the assistant text at the end
      }
      if (event.type === 'done') {
        fullContent = event.fullContent;
      }
    }
  } catch {
    // On stream failure, fall back to non-streaming
    const result = await processResponse(userMessage, state, messageHistory);
    // Stream the assistant message character by character
    const chars = result.assistantMessage.match(/.{1,4}/g) || [];
    for (const chunk of chars) {
      yield { type: 'delta', content: chunk };
    }
    yield { type: 'done', assistantMessage: result.assistantMessage, updates: result.updates };
    return;
  }

  // Parse the complete JSON
  let parsed: LLMResult | null = null;
  try {
    parsed = JSON.parse(fullContent);
  } catch {
    const start = fullContent.indexOf('{');
    const end = fullContent.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try { parsed = JSON.parse(fullContent.substring(start, end + 1)); } catch { /* give up */ }
    }
  }

  const assistantMessage = parsed?.assistant || fullContent || "Tell me more about what you'd like to make.";
  let llmUpdates: Partial<ConversationState> = {};
  if (parsed?.updates) {
    llmUpdates = normalizeUpdates(parsed.updates);
  }

  const keywordRaw = parseKeywordUpdates(userMessage);
  const keywordUpdates = normalizeUpdates(keywordRaw);
  const updates = { ...llmUpdates, ...keywordUpdates };

  // Stream the assistant text in small chunks for typing effect
  const chunks = assistantMessage.match(/.{1,4}/g) || [];
  for (const chunk of chunks) {
    yield { type: 'delta', content: chunk };
  }

  yield { type: 'done', assistantMessage, updates };
}

// ── SSE Helper ─────────────────────────────────────────────────────────────────

export function createSSEResponse(
  generator: AsyncGenerator<EngineStreamEvent>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for await (const event of generator) {
          if (event.type === 'delta') {
            send('delta', event.content);
          }
          if (event.type === 'done') {
            send('updates', event.updates);
            send('done', { fallbackUsed: false });
          }
        }
      } catch {
        send('done', { fallbackUsed: true, error: 'Stream failed' });
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
