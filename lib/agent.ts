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
        return `Great choice! A ${intent.product.name} is perfect. Now, tell me about who this is for or what vibe you're going for. For example: "It's a birthday gift for my athletic friend" or "I want something bold and minimal for myself."`;
      }
      return "I'd love to help you create custom merch! What would you like to make? A tee, hoodie, tote bag, or mug?";

    case 'product':
      if (intent.product) {
        return `Perfect! Let's design your ${intent.product.name}. Tell me about the purpose and style - for example: "It's a birthday gift for my coffee-loving friend, something cute and fun" or "Team shirt for my running club, bold and energetic."`;
      }
      return "Which product would you like to customize? We have tees, hoodies, tote bags, and mugs.";

    case 'intent':
      if (intent.occasion || intent.vibe) {
        return `Got it! Now, what message or text should appear on it? You can tell me something like "Stay Wild" or describe the feeling you want, like "something motivational about running."`;
      }
      return "Tell me more about this - who's it for and what style are you going for? For example: 'birthday gift, something bold' or 'personal use, minimal and clean'.";

    case 'text':
      // Extract text from message - anything in quotes or the whole message
      const quotedText = userMessage.match(/"([^"]+)"/);
      const extractedText = quotedText ? quotedText[1] : userMessage;
      
      if (extractedText.length > 0 && extractedText.length <= 18) {
        return `Love it! "${extractedText}" is perfect. Now, what visual element or icon would complement this? Tell me something like "a lightning bolt" or "coffee cup" or "mountain peak."`;
      } else if (extractedText.length > 18) {
        return `That's a bit long - can you shorten it to under 18 characters? Maybe something punchy like the key phrase?`;
      }
      return `What message should go on your ${state.product?.name}? Give me a short phrase (under 18 chars), or describe the feeling you want and I'll suggest something.`;

    case 'icon':
      if (intent.icon || userMessage.length > 5) {
        return `Perfect! Let me generate 3 design variants for you. Give me just a moment... ✨`;
      }
      return "What icon or visual should I include? For example: 'heart', 'star', 'coffee cup', 'mountain', etc.";

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
