import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/llm';
import { PRODUCTS, Product } from '@/lib/catalog';
import { ICON_LIBRARY } from '@/lib/icons';
import { ConversationState } from '@/lib/agent';
import { CUSTOMIZATION_LIMITS, TEXT_COLOR_OPTIONS, validateCustomizationUpdates } from '@/lib/customization-constraints';

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
        'Example response:',
        '{ "assistant": "I have updated your classic-tee to black.", "updates": { "productId": "classic-tee", "productColor": "black" } }',
        '',
        'NEVER use placeholders like "string", "number", or types in your JSON values. Always provide actual values from the catalog.',
        '',
        'Products: classic-tee (Colors: Black, White, Navy, Forest, Burgundy. Sizes: XS-2XL), hoodie (Colors: Black, Charcoal, Navy, Burgundy. Sizes: S-2XL), tote (Colors: Natural, Black).',
        'Icons: star, heart, logo, arrow, wave, sun, mountain, etc.',
        'Colors: black, white, red, navy, forest, burgundy, charcoal, natural, pink, blue, green.',
        '',
        'RULES:',
        '- Only support the products listed above. Reject others politely.',
        '- Progression: welcome -> product -> text/icon -> preview.',
        '- Set productId and productColor for the garment (e.g., "navy tee").',
        '- Set textColor for the design/icon color (e.g., "white star", "red text").',
        '- Set text or iconId if mentioned.',
        '- Set action: "add_to_cart" if user is ready.',
        '',
        `Current state: ${JSON.stringify({
            stage: state.stage,
            product: state.product?.id,
            text: state.text,
            icon: state.icon,
            productColor: state.productColor,
            textColor: state.textColor,
            size: state.size
        })}`
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

function parseKeywordUpdates(message: string): Partial<ConversationState> & { productId?: string; iconId?: string } {
    const text = message.toLowerCase();
    const updates: Partial<ConversationState> & { productId?: string; iconId?: string } = {};

    // Product keywords
    if (text.includes('tee') || text.includes('shirt') || text.includes('t-shirt')) updates.productId = 'classic-tee';
    else if (text.includes('hoodie')) updates.productId = 'hoodie';
    else if (text.includes('tote') || text.includes('bag')) updates.productId = 'tote';

    const colors = ['black', 'white', 'red', 'navy', 'forest', 'burgundy', 'charcoal', 'natural', 'pink', 'blue', 'green'];

    // Heuristic: find colors and see what they are near
    colors.forEach(color => {
        if (text.includes(color)) {
            // If color is near product keywords
            const productRegex = new RegExp(`${color}\\s*(?:tee|shirt|t-shirt|hoodie|tote|bag|top|garment|item)`, 'i');
            const productRegexRev = new RegExp(`(?:tee|shirt|t-shirt|hoodie|tote|bag|top|garment|item)\\s*(?:in|of)?\\s*${color}`, 'i');

            if (productRegex.test(text) || productRegexRev.test(text)) {
                updates.productColor = color;
            } else {
                // If color is near design keywords
                const designRegex = new RegExp(`${color}\\s*(?:text|icon|star|heart|logo|arrow|wave|sun|mountain|design|print)`, 'i');
                const designRegexRev = new RegExp(`(?:text|icon|star|heart|logo|arrow|wave|sun|mountain|design|print)\\s*(?:in|of)?\\s*${color}`, 'i');

                if (designRegex.test(text) || designRegexRev.test(text)) {
                    updates.textColor = color;
                } else if (!updates.productColor) {
                    // Default to productColor if not specified and not already set
                    updates.productColor = color;
                }
            }
        }
    });

    // Special case for "the star in white, t-shirt in black"
    // The above loop might get confused if multiple colors are present.
    // Let's do a quick sweep for specific "in color" patterns
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
    const iconIds = ['star', 'heart', 'logo', 'arrow', 'wave', 'sun', 'mountain'];
    const foundIcon = iconIds.find(id => text.includes(id));
    if (foundIcon) updates.iconId = foundIcon;

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
        const keywordUpdatesRaw = parseKeywordUpdates(userMessage);
        const llmUpdatesRaw = parsed?.updates || {};

        // Use strict validation to sanitize both LLM and keyword extraction
        const llmUpdates = validateCustomizationUpdates(llmUpdatesRaw);
        const keywordUpdates = validateCustomizationUpdates(keywordUpdatesRaw);

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
            assistantMessage: "I'm sorry, I'm having a bit of trouble processing that right now. I've updated your design based on your request, though!",
            updates: keywordUpdates,
            fallbackUsed: true
        });
    }
}
