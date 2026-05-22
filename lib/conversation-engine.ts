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
    'You are a friendly merch design assistant helping users create custom merch. Return ONLY valid JSON.',
    '{ "assistant": "<your conversational reply to the user — a full, friendly sentence>", "updates": { "productId"?: string, "text"?: string, "iconId"?: string, "productColor"?: string, "textColor"?: string, "size"?: string, "quantity"?: number, "occasion"?: string, "vibe"?: string, "alignment"?: "left" | "center" | "right", "vertical"?: "top" | "middle" | "bottom", "scale"?: "small" | "medium" | "large", "action"?: "add_to_cart" | "remove_icon" } }',
    '',
    'The "assistant" value MUST be a natural, conversational reply (e.g., "Great choice! I\'ve set up a navy tee for you."). It must NEVER be a role label like "Merch Design Assistant" or a placeholder.',
    '',
    'NEVER use placeholders like "string", "number", or type names as values. Always use real values from the catalog.',
    '',
    'Tee options — actively recommend one based on the user\'s vibe/occasion/budget:',
    '- classic-tee (€19.99): everyday soft cotton, AVAILABLE COLORS ONLY: Black, White, Navy, Forest, Burgundy — best for teams, events, casual everyday',
    '- premium-tee (€27.99): heavyweight premium cotton, AVAILABLE COLORS ONLY: White, Black, Charcoal, Navy — best for gifts, lasting quality, premium feel',
    '- eco-tee (€24.99): organic cotton, low-impact dyes, AVAILABLE COLORS ONLY: Natural, White, Forest — best for sustainability-minded, earthy/natural aesthetic',
    'All tees: Sizes XS-2XL. Other products: hoodie (AVAILABLE COLORS ONLY: Black, Charcoal, Navy, Burgundy. Sizes: S-2XL), tote (AVAILABLE COLORS ONLY: Natural, Black).',
    `Icons: ${ICON_LIBRARY.map(i => i.id).join(', ')}.`,
    `Text colors: ${Object.keys(TEXT_COLOR_OPTIONS).join(', ')}.`,
    '',
    'RULES:',
    '- Only support the products listed above. Reject others politely.',
    '- When user mentions a tee/shirt without specifying which type, ask or recommend based on their vibe/occasion (e.g. eco for sustainable vibes, premium for gifts, classic for teams).',
    '- CRITICAL: Only set productColor to a color explicitly listed for the current product above. Never invent or guess colors.',
    '- CRITICAL: If the user requests a color not available for the current product, say so and list what IS available. Do NOT switch to a different product just to accommodate the color. Set the productColor to the closest available color instead.',
    '- CRITICAL: Do not switch the product unless the user explicitly asks to change it (typos like "premiun" count as "premium").',
    '- The user can specify product, text, icon, color, size in any order or all at once.',
    '- ALWAYS include productId in updates whenever you select, recommend, or confirm a product — even if the user already has one selected.',
    '- Set textColor for the design/icon color (e.g., "white star", "red text").',
    '- Set text or iconId if mentioned.',
    '- If user asks to remove the icon, set action: "remove_icon" and iconId: "none".',
    '- If user asks to move design up/down, set vertical: "top"/"middle"/"bottom". If left/right, set alignment: "left"/"center"/"right".',
    '- If user asks to make design bigger/smaller, set scale: "small"/"medium"/"large".',
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

  // Product keywords — only explicit qualifiers to avoid "make the t-shirt bigger" switching products
  if (/premium\s+(?:tee|shirt|t-shirt)/i.test(text)) updates.productId = 'premium-tee';
  else if (/eco\s+(?:tee|shirt|t-shirt)|organic\s+(?:tee|shirt)|sustainable\s+(?:tee|shirt)/i.test(text)) updates.productId = 'eco-tee';
  else if (/classic\s+(?:tee|shirt|t-shirt)/i.test(text)) updates.productId = 'classic-tee';
  else if (text.includes('hoodie')) updates.productId = 'hoodie';
  else if (text.includes('tote') || /\bbag\b/.test(text)) updates.productId = 'tote';
  // bare "tee/shirt/t-shirt" intentionally omitted — ambiguous, LLM decides

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

  // Position / scale keywords
  if (/\bmove\s*(it\s*)?up\b|\bhigher\b|\b(to\s*the\s*)?top\b/.test(text)) updates.vertical = 'top';
  else if (/\bmove\s*(it\s*)?down\b|\blower\b|\b(to\s*the\s*)?bottom\b/.test(text)) updates.vertical = 'bottom';
  else if (/\bcenter\b|\bmiddle\b/.test(text) && /vertical|up|down/.test(text)) updates.vertical = 'middle';

  if (/\bmove\s*(it\s*)?left\b|\b(to\s*the\s*)?left\b/.test(text)) updates.alignment = 'left';
  else if (/\bmove\s*(it\s*)?right\b|\b(to\s*the\s*)?right\b/.test(text)) updates.alignment = 'right';
  else if (/\bcenter\b|\bmiddle\b/.test(text) && !/vertical|up|down/.test(text)) updates.alignment = 'center';

  if (/\bbigger\b|\blarger\b|\bscale\s*up\b|\bincrease\s*size\b/.test(text)) updates.scale = 'large';
  else if (/\bsmaller\b|\btinier\b|\bscale\s*down\b|\bdecrease\s*size\b|\bshrink\b/.test(text)) updates.scale = 'small';

  return updates;
}

// ── Product inference from assistant text ─────────────────────────────────────
// Recovery: if LLM mentions a product in text but forgets to set productId in updates JSON

function inferProductFromText(text: string): string | null {
  const t = text.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/premium[\s-]tee/, 'premium-tee'],
    [/eco[\s-]tee|organic\s+tee/, 'eco-tee'],
    [/classic[\s-]tee/, 'classic-tee'],
    [/hoodie/, 'hoodie'],
    [/canvas\s+tote|tote\s+bag/, 'tote'],
  ];
  const matched = patterns.filter(([r]) => r.test(t)).map(([, id]) => id)
    .filter((id, i, arr) => arr.indexOf(id) === i);
  // If multiple different products mentioned, can't reliably infer intent
  return matched.length === 1 ? matched[0] : null;
}

// ── Update Normalization ───────────────────────────────────────────────────────

function normalizeUpdates(raw: Record<string, any>, currentProduct?: any): Partial<ConversationState> {
  const validated = validateCustomizationUpdates(raw, currentProduct);
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
  if (validated.alignment) updates.alignment = validated.alignment;
  if (validated.vertical) updates.vertical = validated.vertical;
  if (validated.scale) updates.scale = validated.scale;
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

    const rawAssistant = parsed?.assistant || '';
    const isRoleEcho = /^(merch\s*design\s*assistant|assistant|ai|bot)\s*$/i.test(rawAssistant.trim());
    assistantMessage = (!rawAssistant || isRoleEcho) ? (raw || "Tell me more about what you'd like to make.") : rawAssistant;
    if (parsed?.updates) {
      llmUpdates = normalizeUpdates(parsed.updates, state.product);
    }
    // If LLM mentioned a product in text but forgot to set productId in updates, recover it
    if (!llmUpdates.product) {
      const inferred = inferProductFromText(assistantMessage);
      if (inferred) {
        const match = PRODUCTS.find(p => p.id === inferred);
        if (match) llmUpdates.product = match;
      }
    }
  } catch {
    assistantMessage = "I'm having trouble connecting right now. I've updated based on what I understood.";
  }

  // Keyword fallback — deterministic parsing always runs as a safety net
  const keywordRaw = parseKeywordUpdates(userMessage);
  const keywordUpdates = normalizeUpdates(keywordRaw, state.product);
  // Accept LLM product switch if keyword detected one, OR if user's message itself
  // contains a product-type word ("premium", "eco", "hoodie", etc.) — handles natural
  // language like "switch to something premium" where keyword regex requires exact phrase
  const userMentionsProductType = /\bpremi|\beco\b|\borganic\b|\bclassic\b|\bhood|\btote\b/i.test(userMessage);
  const keywordPickedProduct = !!keywordUpdates.product || userMentionsProductType;

  // Only block the product switch when it looks color-motivated: user asked for a color
  // that's unavailable on their current product but didn't name a new product type.
  // Allow all other switches (occasion/vibe/context recommendations).
  const knownColors = ['black', 'white', 'red', 'navy', 'forest', 'burgundy', 'charcoal', 'natural', 'pink', 'blue', 'green'];
  const msgLower = userMessage.toLowerCase();
  const likelyColorSwitch = !!state.product && knownColors.some(color => {
    if (!msgLower.includes(color)) return false;
    return !(state.product as any).colors?.some((c: any) => c.name.toLowerCase() === color);
  });
  if (state.product && llmUpdates.product && !keywordPickedProduct && likelyColorSwitch) {
    delete llmUpdates.product;
  }
  // LLM product choice always wins over keyword — keyword is last-resort, not an override
  if (llmUpdates.product) delete keywordUpdates.product;
  // Keyword must not silently revert an already-selected product
  if (state.product && !llmUpdates.product) delete keywordUpdates.product;

  const updates = { ...llmUpdates, ...keywordUpdates };

  const effectiveProduct = updates.product || state.product;

  // Re-validate productColor against whichever product will actually be used
  if (effectiveProduct && updates.productColor) {
    const colorValid = (effectiveProduct as any).colors?.some(
      (c: { name: string }) => c.name.toLowerCase() === (updates.productColor as string).toLowerCase()
    ) ?? false;
    if (!colorValid) delete updates.productColor;
  }

  // Re-validate size — it may have been validated against LLM's intended (now-blocked) product
  if (effectiveProduct && updates.size) {
    const sizeValid = !(effectiveProduct as any).sizes ||
      (effectiveProduct as any).sizes.includes(updates.size as string);
    if (!sizeValid) delete updates.size;
  }

  // Last resort: bare "tee/shirt" with no product selected yet → default to classic-tee
  if (!updates.product && !state.product && /\b(?:tee|shirt|t-shirt)\b/i.test(userMessage)) {
    const fallback = PRODUCTS.find(p => p.id === 'classic-tee');
    if (fallback) updates.product = fallback;
  }

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

  const rawAssistant = parsed?.assistant || '';
  const isRoleEcho = /^(merch\s*design\s*assistant|assistant|ai|bot)\s*$/i.test(rawAssistant.trim());
  const assistantMessage = (!rawAssistant || isRoleEcho) ? (fullContent || "Tell me more about what you'd like to make.") : rawAssistant;
  let llmUpdates: Partial<ConversationState> = {};
  if (parsed?.updates) {
    llmUpdates = normalizeUpdates(parsed.updates, state.product);
  }
  // If LLM mentioned a product in text but forgot to set productId in updates, recover it
  if (!llmUpdates.product) {
    const inferred = inferProductFromText(assistantMessage);
    if (inferred) {
      const match = PRODUCTS.find(p => p.id === inferred);
      if (match) llmUpdates.product = match;
    }
  }

  const keywordRaw = parseKeywordUpdates(userMessage);
  const keywordUpdates = normalizeUpdates(keywordRaw, state.product);
  const userMentionsProductType = /\bpremi|\beco\b|\borganic\b|\bclassic\b|\bhood|\btote\b/i.test(userMessage);
  const keywordPickedProduct = !!keywordUpdates.product || userMentionsProductType;

  const knownColors = ['black', 'white', 'red', 'navy', 'forest', 'burgundy', 'charcoal', 'natural', 'pink', 'blue', 'green'];
  const msgLower = userMessage.toLowerCase();
  const likelyColorSwitch = !!state.product && knownColors.some(color => {
    if (!msgLower.includes(color)) return false;
    return !(state.product as any).colors?.some((c: any) => c.name.toLowerCase() === color);
  });
  if (state.product && llmUpdates.product && !keywordPickedProduct && likelyColorSwitch) {
    delete llmUpdates.product;
  }
  if (llmUpdates.product) delete keywordUpdates.product;
  if (state.product && !llmUpdates.product) delete keywordUpdates.product;

  const updates = { ...llmUpdates, ...keywordUpdates };

  const effectiveProduct = updates.product || state.product;

  if (effectiveProduct && updates.productColor) {
    const colorValid = (effectiveProduct as any).colors?.some(
      (c: { name: string }) => c.name.toLowerCase() === (updates.productColor as string).toLowerCase()
    ) ?? false;
    if (!colorValid) delete updates.productColor;
  }

  if (effectiveProduct && updates.size) {
    const sizeValid = !(effectiveProduct as any).sizes ||
      (effectiveProduct as any).sizes.includes(updates.size as string);
    if (!sizeValid) delete updates.size;
  }

  if (!updates.product && !state.product && /\b(?:tee|shirt|t-shirt)\b/i.test(userMessage)) {
    const fallback = PRODUCTS.find(p => p.id === 'classic-tee');
    if (fallback) updates.product = fallback;
  }

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
