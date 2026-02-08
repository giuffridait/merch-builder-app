import { PRODUCTS } from '@/lib/catalog';
import { ICON_LIBRARY } from '@/lib/icons';
import { chatCompletion } from '@/lib/llm';
import { ConversationState } from '@/lib/agent';
import {
  CUSTOMIZATION_LIMITS,
  OCCASIONS,
  TEXT_COLOR_OPTIONS,
  VIBES,
  validateCustomizationUpdates
} from '@/lib/customization-constraints';

type LLMResult = {
  assistant: string;
  updates?: Partial<ConversationState> & {
    productId?: string;
    iconId?: string;
    productColor?: string;
    textColor?: string;
    size?: string;
    quantity?: number;
    action?: 'add_to_cart' | 'remove_icon';
  };
};

const STAGES: ConversationState['stage'][] = [
  'welcome',
  'product',
  'intent',
  'text',
  'icon',
  'generating',
  'preview',
  'complete'
];

function buildSystemPrompt(state: ConversationState) {
  const { messages: _messages, ...stateSummary } = state;
  const products = PRODUCTS.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    colors: p.colors.map(c => c.name),
    sizes: p.sizes
  }));
  const icons = ICON_LIBRARY.map(i => ({ id: i.id, keywords: i.keywords }));
  const textColors = Object.keys(TEXT_COLOR_OPTIONS);

  return [
    'You are a merch design assistant. Return ONLY JSON.',
    '{ "assistant": string, "updates": { "productId"?: string, "text"?: string, "iconId"?: string, "productColor"?: string, "size"?: string, "quantity"?: number, "action"?: "add_to_cart" } }',
    '',
    'Products: classic-tee (Colors: Black, White, Navy, Forest, Burgundy. Sizes: XS-2XL), hoodie (Colors: Black, Charcoal, Navy, Burgundy. Sizes: S-2XL), tote (Colors: Natural, Black).',
    'Icons: star, heart, logo, arrow, wave, sun, mountain, etc.',
    '',
    'RULES:',
    '- Only support the products listed above. Reject others politely.',
    '- Progression: welcome -> product -> text/icon -> preview.',
    '- Set productId and productColor if mentioned (e.g., "navy tee").',
    '- Set text or iconId if mentioned.',
    '- Set action: "add_to_cart" if user is ready.',
    '',
    `Current state: ${JSON.stringify(stateSummary)}`
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

function normalizeUpdates(raw: LLMResult['updates']): Partial<ConversationState> {
  const updates: Partial<ConversationState> = {};
  if (!raw) return updates;

  const validated = validateCustomizationUpdates(raw);

  if (validated.stage && STAGES.includes(validated.stage)) {
    updates.stage = validated.stage;
  }

  if (validated.productId) {
    const product = PRODUCTS.find(p => p.id === validated.productId);
    if (product) updates.product = product;
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

function validateLLMResult(parsed: LLMResult | null): { assistantMessage: string; updates: Partial<ConversationState> } | null {
  if (!parsed || typeof parsed.assistant !== 'string') return null;
  const assistant = parsed.assistant.trim();
  if (!assistant) return null;
  const updates = normalizeUpdates(parsed.updates);
  return { assistantMessage: assistant, updates };
}

export async function getLLMResponse(
  userMessage: string,
  state: ConversationState,
  messages: { role: 'user' | 'assistant'; content: string }[]
) {
  const systemPrompt = buildSystemPrompt(state);
  const llmMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage }
  ];

  let raw = await chatCompletion(llmMessages, { responseFormat: 'json' });
  let parsed = extractJson(raw) as LLMResult | null;

  // Self-correction retry if JSON is invalid
  if (!parsed) {
    llmMessages.push({ role: 'assistant', content: raw });
    llmMessages.push({ role: 'system', content: 'Return ONLY valid JSON. Do not include any extra text.' });

    raw = await chatCompletion(llmMessages, { responseFormat: 'json' });
    parsed = extractJson(raw) as LLMResult | null;
  }

  const validated = validateLLMResult(parsed);
  if (validated) return validated;

  if (raw && raw.trim().length > 0) {
    return { assistantMessage: raw.trim(), updates: {} };
  }

  return {
    assistantMessage: "Tell me a bit more about what you'd like to make.",
    updates: {}
  };
}
