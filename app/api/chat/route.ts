import { NextRequest, NextResponse } from 'next/server';
import { ConversationState } from '@/lib/agent';
import { processResponse, processResponseStream, createSSEResponse } from '@/lib/conversation-engine';

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
      return createSSEResponse(processResponseStream(userMessage, state, messages));
    }

    const result = await processResponse(userMessage, state, messages);
    return NextResponse.json(result);
  } catch (error: any) {
    const fallback = {
      assistantMessage: "Tell me a bit more about what you'd like to make.",
      updates: {},
      fallbackUsed: true
    };

    if (stream) {
      return createSSEResponse((async function* () {
        yield { type: 'delta' as const, content: fallback.assistantMessage };
        yield { type: 'done' as const, assistantMessage: fallback.assistantMessage, updates: {} };
      })());
    }

    return NextResponse.json(fallback);
  }
}
