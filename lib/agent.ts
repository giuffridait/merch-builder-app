import { Product } from './catalog';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationState {
  stage: 'welcome' | 'product' | 'intent' | 'text' | 'icon' | 'generating' | 'preview' | 'complete';
  product?: Product;
  occasion?: string;
  vibe?: string;
  text?: string;
  icon?: string;
  productColor?: string;
  textColor?: string;
  size?: string;
  quantity?: number;
  messages: Message[];
}

export function shouldGenerateDesigns(state: ConversationState): boolean {
  return state.stage === 'icon' &&
    !!state.product &&
    (!!state.text || !!state.icon);
}

export function suggestSlogans(occasion?: string, vibe?: string): string[] {
  const slogans: Record<string, string[]> = {
    gift: ['Made With Love', 'You Are Amazing', 'Celebrate Good Times', 'Special For You'],
    team: ['Stronger Together', 'Team Spirit', 'United We Stand', 'One Team One Dream'],
    event: ['Make Memories', 'Good Vibes Only', 'Celebrate Life', 'Epic Moments'],
    personal: ['Be Yourself', 'Stay True', 'Own Your Story', 'Live Fully'],
    default: ['Stay Wild', 'Dream Big', 'Good Vibes', 'Make It Happen', 'Born To Create', 'Never Stop']
  };

  return slogans[occasion || 'default'] || slogans.default;
}
