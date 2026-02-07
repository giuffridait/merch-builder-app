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
    'You are a friendly, confident merch design assistant.',
    'Keep responses concise, helpful, and action-oriented.',
    'Avoid excessive confirmations. Ask only one question at a time.',
    'Return ONLY a JSON object with this shape:',
    '{ "assistant": string, "updates": { "stage"?: string, "productId"?: string, "occasion"?: string, "vibe"?: string, "text"?: string, "iconId"?: string, "productColor"?: string, "textColor"?: string, "size"?: string, "quantity"?: number, "action"?: "add_to_cart" | "remove_icon" } }',
    'IMPORTANT: You MUST return valid JSON. Do not include any text outside the JSON object.',
    'Do not include markdown or code fences.',
    'Only use productId and iconId values from the provided lists.',
    '',
    '--- PRODUCT CATALOG AWARENESS (STRICT) ---',
    '- You ONLY support the products listed in the "Products" array below (Tees, Hoodies, Totes).',
    '- If the user asks for a product not in the list (e.g., skirt, mug, cap, etc.), you MUST politely decline.',
    '- standard refusal response: "We don\'t offer [requested product] at the moment, but we have high-quality Tees, Hoodies, and Totes! Which one would you like to design?"',
    '- NEVER pretend to create a design for an unsupported product.',
    '',
    '--- STAGE PROGRESSION RULES (CRITICAL) ---',
    'Progression is: welcome -> product -> intent -> text -> icon -> preview.',
    '- Stage "welcome": Greet and ask what they want to make. Move to "product" only when productId is set.',
    '- Stage "product": Product is selected. Ask about occasion/vibe. Move to "intent" when productId is set.',
    '- Stage "intent": Occasion/vibe collected. Ask "What message should it say?".',
    '- Stage "text": User provides text for design. Move to "icon" after text is set OR if they ask for an icon directly.',
    '- Stage "icon": Ask about icon. Move to "preview" when icon is chosen.',
    '- Stage "preview": Design complete. Either text OR icon must be set to see a design.',
    'If the user only wants an icon, they can skip "intent" and "text" stages.',
    'If the user only wants text, they can skip the "icon" stage and move to "preview".',
    '',
    `If the text is too long for a design (over ${CUSTOMIZATION_LIMITS.textMaxLength} chars), ask to shorten it.`,
    `Allowed vibes: ${VIBES.join(', ')}.`,
    `Allowed occasions: ${OCCASIONS.join(', ')}.`,
    `Allowed text colors: ${textColors.join(', ')}.`,
    'productColor must be a color that exists on the chosen product.',
    'IMPORTANT: When the user mentions text for their design (whether quoted or not), set updates.text to that text.',
    'If the user provides text in quotes, set updates.text to that exact text.',
    'If the user describes what they want on the product (e.g., "Team Spirit", "Be Yourself", etc.), extract and set updates.text.',
    'When at stage "text" or "intent", if the user provides a phrase/slogan, set it as updates.text and move to stage "icon".',
    'If the user mentions size (XS/S/M/L/XL/2XL) or quantity, set size/quantity.',
    'If the user mentions a color, check if it exists on the chosen product. If it does, set productColor.',
    'If the user mentions a product and a color (e.g., "navy tee"), set both productId and productColor.',
    'If a user requests a text color (e.g., "red text"), set textColor (not productColor).',
    'If the user says "add to cart" or "checkout", set action to "add_to_cart".',
    'If the user says "remove the icon" or "remove the star/logo", set action to "remove_icon" and iconId to "none".',
    'If you cannot confidently extract a value, leave it out.',
    `Current state: ${JSON.stringify(stateSummary)}`,
    `Products: ${JSON.stringify(products)}`,
    `Icons: ${JSON.stringify(icons)}`
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

  let raw = await chatCompletion(llmMessages);
  let parsed = extractJson(raw) as LLMResult | null;

  // Self-correction retry if JSON is invalid
  if (!parsed) {
    console.log('Invalid JSON received, attempting self-correction...');
    llmMessages.push({ role: 'assistant', content: raw });
    llmMessages.push({ role: 'system', content: 'You failed to provide valid JSON. Please correct your previous response and return ONLY a valid JSON object.' });

    raw = await chatCompletion(llmMessages);
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
