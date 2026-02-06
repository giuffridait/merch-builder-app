import { PRODUCTS, Product } from './catalog';
import { ICON_LIBRARY, findIconByKeyword } from './icons';

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

export function parseUserIntent(userMessage: string, state: ConversationState): Partial<ConversationState> {
  const msg = userMessage.toLowerCase();
  const updates: Partial<ConversationState> = {};

  // Product detection
  if (state.stage === 'product' || state.stage === 'welcome') {
    if (msg.includes('shirt') || msg.includes('tee') || msg.includes('t-shirt')) {
      updates.product = PRODUCTS.find(p => p.category === 'tee');
      updates.stage = 'intent';
    } else if (msg.includes('hoodie') || msg.includes('sweatshirt')) {
      updates.product = PRODUCTS.find(p => p.category === 'hoodie');
      updates.stage = 'intent';
    } else if (msg.includes('tote') || msg.includes('bag')) {
      updates.product = PRODUCTS.find(p => p.category === 'tote');
      updates.stage = 'intent';
    } else if (msg.includes('mug') || msg.includes('cup')) {
      updates.product = PRODUCTS.find(p => p.category === 'mug');
      updates.stage = 'intent';
    }
  }

  // Occasion detection
  if (state.stage === 'intent' || (msg.includes('for') || msg.includes('gift') || msg.includes('birthday'))) {
    if (msg.includes('gift') || msg.includes('present') || msg.includes('birthday')) {
      updates.occasion = 'gift';
    } else if (msg.includes('team') || msg.includes('group') || msg.includes('club')) {
      updates.occasion = 'team';
    } else if (msg.includes('event') || msg.includes('party') || msg.includes('concert')) {
      updates.occasion = 'event';
    } else if (msg.includes('personal') || msg.includes('myself') || msg.includes('me')) {
      updates.occasion = 'personal';
    }
  }

  // Vibe detection
  if (msg.includes('minimal') || msg.includes('clean') || msg.includes('simple')) {
    updates.vibe = 'minimal';
  } else if (msg.includes('bold') || msg.includes('loud') || msg.includes('statement')) {
    updates.vibe = 'bold';
  } else if (msg.includes('retro') || msg.includes('vintage') || msg.includes('classic')) {
    updates.vibe = 'retro';
  } else if (msg.includes('cute') || msg.includes('fun') || msg.includes('playful')) {
    updates.vibe = 'cute';
  } else if (msg.includes('sport') || msg.includes('athletic') || msg.includes('active')) {
    updates.vibe = 'sporty';
  }

  // Icon/theme detection from context
  if (state.stage === 'icon' || state.stage === 'text') {
    const keywords = msg.split(' ').filter(w => w.length > 3);
    for (const keyword of keywords) {
      const icon = ICON_LIBRARY.find(i => 
        i.keywords.some(k => k.includes(keyword) || keyword.includes(k))
      );
      if (icon) {
        updates.icon = icon.id;
        break;
      }
    }
  }

  return updates;
}

export function generateAIResponse(userMessage: string, state: ConversationState): string {
  const intent = parseUserIntent(userMessage, state);
  
  switch (state.stage) {
    case 'welcome':
      if (intent.product) {
        return `Great pick. Who is it for and what vibe do you want?`;
      }
      return "What would you like to make: a tee, hoodie, tote, or mug?";

    case 'product':
      if (intent.product) {
        return `Nice. What’s the purpose and style you want?`;
      }
      return "Which product should we customize? We have tees, hoodies, totes, and mugs.";

    case 'intent':
      if (intent.occasion || intent.vibe) {
        return `Great. What message should appear on it?`;
      }
      return "Who’s it for and what style are you going for?";

    case 'text':
      // Extract text from message - anything in quotes or the whole message
      const quotedText = userMessage.match(/"([^"]+)"/);
      const extractedText = quotedText ? quotedText[1] : userMessage;
      
      if (extractedText.length > 0 && extractedText.length <= 18) {
        return `Nice. What icon or symbol should go with "${extractedText}"?`;
      } else if (extractedText.length > 18) {
        return `That’s a bit long. Can you shorten it to under 18 characters?`;
      }
      return `What message should go on your ${state.product?.name}? Keep it under 18 characters.`;

    case 'icon':
      if (intent.icon || userMessage.length > 5) {
        return `Great — generating 3 design variants now.`;
      }
      return "What icon or visual should I include?";

    default:
      return "I'm here to help! What would you like to do?";
  }
}

export function shouldGenerateDesigns(state: ConversationState): boolean {
  return state.stage === 'icon' && 
         !!state.product && 
         !!state.text && 
         !!state.icon;
}

export function extractTextFromMessage(message: string, state: ConversationState): string | null {
  // Try to extract quoted text first
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];

  // If we're at text stage and message is short enough, use it
  if (state.stage === 'text' && message.length <= 18 && message.length > 0) {
    return message;
  }

  // Try to extract a slogan-like phrase
  const words = message.split(' ');
  if (words.length >= 2 && words.length <= 4) {
    const phrase = words.join(' ');
    if (phrase.length <= 18) return phrase;
  }

  return null;
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
