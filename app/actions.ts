'use server';

import { ConversationState } from '@/lib/agent';
import { getLLMResponse } from '@/lib/agent-llm';

export async function chatWithAgent(
  history: { role: 'user' | 'assistant'; content: string }[],
  state: ConversationState,
  userMessage: string
) {
  return getLLMResponse(userMessage, state, history || []);
}
