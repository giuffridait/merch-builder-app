'use server';

import { ConversationState } from '@/lib/agent';
import { processResponse } from '@/lib/conversation-engine';

export async function chatWithAgent(
  history: { role: 'user' | 'assistant'; content: string }[],
  state: ConversationState,
  userMessage: string
) {
  return processResponse(userMessage, state, history || []);
}
