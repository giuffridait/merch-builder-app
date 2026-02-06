import { NextRequest, NextResponse } from 'next/server';
import { PRODUCTS } from '@/lib/catalog';
import { ICON_LIBRARY } from '@/lib/icons';
import { chatCompletion } from '@/lib/llm';
import {
  ConversationState,
  generateAIResponse,
  parseUserIntent,
  extractTextFromMessage
} from '@/lib/agent';

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

type LLMResult = {
  assistant: string;
  updates?: Partial<ConversationState> & { productId?: string; iconId?: string };
};

function buildSystemPrompt(state: ConversationState) {
  const { messages: _messages, ...stateSummary } = state;
  const products = PRODUCTS.map(p => ({ id: p.id, name: p.name, category: p.category }));
  const icons = ICON_LIBRARY.map(i => ({ id: i.id, keywords: i.keywords }));

  return [
    'You are a conversational merch design assistant.',
    'Return ONLY a JSON object with this shape:',
    '{ "assistant": string, "updates": { "stage"?: string, "productId"?: string, "occasion"?: string, "vibe"?: string, "text"?: string, "iconId"?: string } }',
    'Do not include markdown or code fences.',
    'Only use productId and iconId values from the provided lists.',
    'Use the current state to decide the next stage. Progression is: welcome -> product -> intent -> text -> icon -> preview.',
    'If the text is too long for a design (over 18 chars), ask to shorten it.',
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

  if (raw.stage && STAGES.includes(raw.stage)) {
    updates.stage = raw.stage;
  }

  if (raw.productId) {
    const product = PRODUCTS.find(p => p.id === raw.productId);
    if (product) updates.product = product;
  }

  if (raw.occasion) updates.occasion = raw.occasion;
  if (raw.vibe) updates.vibe = raw.vibe;
  if (raw.text && raw.text.length <= 18) updates.text = raw.text;
  if (raw.iconId) {
    const icon = ICON_LIBRARY.find(i => i.id === raw.iconId);
    if (icon) updates.icon = icon.id;
  }

  return updates;
}

function validateLLMResult(parsed: LLMResult | null): { assistantMessage: string; updates: Partial<ConversationState> } | null {
  if (!parsed || typeof parsed.assistant !== 'string') return null;
  const assistant = parsed.assistant.trim();
  if (!assistant) return null;
  const updates = normalizeUpdates(parsed.updates);
  return { assistantMessage: assistant, updates };
}

function fallbackResponse(userMessage: string, state: ConversationState) {
  const updates = parseUserIntent(userMessage, state);

  if (state.stage === 'text') {
    const extractedText = extractTextFromMessage(userMessage, state);
    if (extractedText) {
      updates.text = extractedText;
      updates.stage = 'icon';
    }
  }

  if (!updates.stage) {
    if ((state.stage === 'welcome' || state.stage === 'product') && updates.product) {
      updates.stage = 'intent';
    } else if (state.stage === 'intent' && (updates.occasion || updates.vibe)) {
      updates.stage = 'text';
    } else if (state.stage === 'text' && updates.text) {
      updates.stage = 'icon';
    }
  }

  const response = generateAIResponse(userMessage, { ...state, ...updates });
  return { assistantMessage: response, updates };
}

async function getLLMResponse(
  userMessage: string,
  state: ConversationState,
  messages: { role: 'user' | 'assistant'; content: string }[]
) {
  const systemPrompt = buildSystemPrompt(state);
  const llmMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  const raw = await chatCompletion(llmMessages);
  const parsed = extractJson(raw) as LLMResult | null;
  const validated = validateLLMResult(parsed);
  if (validated) return validated;

  // If the model returned plain text, keep it but still advance state via fallback parsing.
  const fallback = fallbackResponse(userMessage, state);
  if (raw && raw.trim().length > 0) {
    return { assistantMessage: raw.trim(), updates: fallback.updates };
  }
  return fallback;
}

function chunkText(text: string, size = 12) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const state = body.state as ConversationState | undefined;
  const userMessage = (body.userMessage || '').toString();
  const messages = (body.messages || []) as { role: 'user' | 'assistant'; content: string }[];
  const stream = !!body.stream;

  if (!state || !userMessage) {
    return NextResponse.json({ error: 'Missing state or userMessage' }, { status: 400 });
  }

  try {
    if (stream) {
      const result = await getLLMResponse(userMessage, state, messages);
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: any) => {
            const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          };

          send('updates', result.updates || {});

          const chunks = chunkText(result.assistantMessage || '');
          for (const part of chunks) {
            send('delta', part);
          }

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

    const result = await getLLMResponse(userMessage, state, messages);
    return NextResponse.json(result);
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
          const chunks = chunkText(fallback.assistantMessage || '');
          for (const part of chunks) {
            send('delta', part);
          }
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
