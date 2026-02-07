import { NextRequest, NextResponse } from 'next/server';
import {
  ConversationState
} from '@/lib/agent';
import { getLLMResponse } from '@/lib/agent-llm';

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
    const fallback = {
      assistantMessage: "Tell me a bit more about what you'd like to make.",
      updates: {}
    };
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
