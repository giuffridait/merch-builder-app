import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/llm';
import { PRODUCTS, Product } from '@/lib/catalog';
import { ICON_LIBRARY } from '@/lib/icons';
import { ConversationState } from '@/lib/agent';
import { CUSTOMIZATION_LIMITS, TEXT_COLOR_OPTIONS } from '@/lib/customization-constraints';

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
    const products = PRODUCTS.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        colors: p.colors.map(c => c.name),
        sizes: p.sizes
    }));
    const icons = ICON_LIBRARY.map(i => ({ id: i.id, keywords: i.keywords }));

    return [
        'You are a friendly merch design assistant. Return ONLY JSON.',
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
        `Current state: ${JSON.stringify({
            stage: state.stage,
            product: state.product?.id,
            text: state.text,
            icon: state.icon,
            color: state.productColor,
            size: state.size
        })}`
    ].join('\n');
}

function extractJson(text: string): any | null {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        try { return JSON.parse(fenced[1]); } catch { return null; }
    }
    const raw = text.match(/({[\s\S]*})/);
    if (raw?.[1]) {
        try { return JSON.parse(raw[1]); } catch { return null; }
    }
    return null;
}

function parseKeywordUpdates(message: string): Partial<ConversationState> & { productId?: string; iconId?: string } {
    const text = message.toLowerCase();
    const updates: Partial<ConversationState> & { productId?: string; iconId?: string } = {};

    // Product keywords
    if (text.includes('tee') || text.includes('shirt')) updates.productId = 'classic-tee';
    else if (text.includes('hoodie')) updates.productId = 'hoodie';
    else if (text.includes('tote') || text.includes('bag')) updates.productId = 'tote';

    // Color keywords
    const colors = ['black', 'white', 'navy', 'forest', 'burgundy', 'charcoal', 'natural'];
    const foundColor = colors.find(c => text.includes(c));
    if (foundColor) updates.productColor = foundColor;

    // Size keywords
    const sizes = ['xs', 's', 'm', 'l', 'xl', '2xl'];
    const foundSize = sizes.find(s => new RegExp(`\\b${s}\\b`).test(text));
    if (foundSize) updates.size = foundSize.toUpperCase();

    // Quantity
    const qtyMatch = text.match(/(\d+)\s*(?:items|pcs|pieces|shirts|hoodies|totes)/);
    if (qtyMatch?.[1]) updates.quantity = parseInt(qtyMatch[1], 10);

    // Intent for text (quoted string)
    const quoteMatch = message.match(/"([^"]+)"/) || message.match(/'([^']+)'/);
    if (quoteMatch?.[1]) updates.text = quoteMatch[1];

    return updates;
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const state = body.state as ConversationState | undefined;
    const userMessage = (body.userMessage || '').toString();
    const stream = !!body.stream;

    if (!state || !userMessage) {
        return NextResponse.json({ error: 'Missing state or userMessage' }, { status: 400 });
    }

    try {
        const systemPrompt = buildSystemPrompt(state);
        const llmMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: systemPrompt },
            ...state.messages.slice(-5).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user', content: userMessage }
        ];

        console.log('[DEBUG] Create API - Messages:', JSON.stringify(llmMessages, null, 2));

        const raw = await chatCompletion(llmMessages);
        console.log('[DEBUG] Create API - Raw Response:', raw);

        const parsed = extractJson(raw) as LLMResult | null;
        console.log('[DEBUG] Create API - Parsed Result:', JSON.stringify(parsed, null, 2));

        // Fuzzy/Keyword fallback
        const keywordUpdates = parseKeywordUpdates(userMessage);
        const llmUpdates = parsed?.updates || {};

        // Merge updates: keyword parsing takes precedence for specific fields to be more "deterministic"
        const updates = { ...llmUpdates, ...keywordUpdates };

        const assistantMessage = parsed?.assistant || raw || "I've updated the design for you.";

        if (stream) {
            const encoder = new TextEncoder();
            const streamResponse = new ReadableStream({
                async start(controller) {
                    const send = (event: string, data: any) => {
                        const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
                        controller.enqueue(encoder.encode(payload));
                    };

                    send('updates', updates);
                    const chunks = assistantMessage.match(/.{1,16}/g) || [];
                    for (const part of chunks) {
                        send('delta', part);
                        // Artificial delay for "natural" feel if needed, but here speed is better
                    }
                    send('done', { fallbackUsed: !parsed });
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
            updates
        });
    } catch (error: any) {
        console.error('Create API Error:', error);
        const keywordUpdates = parseKeywordUpdates(userMessage);
        return NextResponse.json({
            assistantMessage: "I'm having a bit of trouble connecting to my full brain, but I've noted your request!",
            updates: keywordUpdates,
            fallbackUsed: true
        });
    }
}
