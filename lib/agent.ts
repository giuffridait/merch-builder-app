import { Product } from './catalog';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationState {
  product?: Product;
  occasion?: string;
  vibe?: string;
  text?: string;
  icon?: string;
  productColor?: string;
  textColor?: string;
  alignment?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'middle' | 'bottom';
  scale?: 'small' | 'medium' | 'large';
  size?: string;
  quantity?: number;
  messages: Message[];
  addedToCart?: boolean;
}

export function canPreview(state: ConversationState): boolean {
  return !!state.product && (!!state.text || !!state.icon);
}

export function canAddToCart(state: ConversationState): boolean {
  return !!state.product && (!!state.text || !!state.icon);
}

export function getMissingFields(state: ConversationState): string[] {
  const missing: string[] = [];
  if (!state.product) missing.push('product');
  if (!state.text && !state.icon) missing.push('text or icon');
  return missing;
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
