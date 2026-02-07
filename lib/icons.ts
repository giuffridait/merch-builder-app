export interface Icon {
  id: string;
  path: string;
  keywords: string[];
}

export const ICON_LIBRARY: Icon[] = [
  { id: 'none', path: '', keywords: ['none', 'no icon', 'remove icon', 'remove', 'plain', 'text only'] },
  { id: 'heart', path: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z', keywords: ['love', 'heart', 'valentine', 'romantic', 'favorite', 'like'] },
  { id: 'star', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', keywords: ['star', 'favorite', 'rating', 'award', 'achievement', 'excellence'] },
  { id: 'coffee', path: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z', keywords: ['coffee', 'drink', 'cafe', 'morning', 'caffeine', 'espresso', 'tea'] },
  { id: 'music', path: 'M9 18V5l12-2v13M9 18c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm12-2c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z', keywords: ['music', 'song', 'audio', 'sound', 'melody', 'concert', 'band'] },
  { id: 'gift', path: 'M20 12v10H4V12M2 7h20v5H2V7zm10 15V7m0 0H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z', keywords: ['gift', 'present', 'birthday', 'celebration', 'surprise', 'party'] },
  { id: 'mountain', path: 'M8.5 21L2 21L12 3L22 21H15.5M8.5 21L12 15L15.5 21M8.5 21H15.5', keywords: ['mountain', 'adventure', 'nature', 'outdoor', 'hiking', 'climb', 'explore'] },
  { id: 'lightning', path: 'M13 2L3 14h8l-1 8 10-12h-8l1-8z', keywords: ['lightning', 'energy', 'power', 'fast', 'bolt', 'electric', 'speed'] },
  { id: 'peace', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zm0 2v16m-5-5l5-5m5 5l-5-5', keywords: ['peace', 'harmony', 'calm', 'zen', 'balance', 'meditation'] },
  { id: 'flower', path: 'M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 3 3 3 3 0 0 0 3-3v-1a3 3 0 0 0 0-6V5a3 3 0 0 0-3-3z', keywords: ['flower', 'nature', 'garden', 'spring', 'bloom', 'floral', 'plant'] },
  { id: 'rocket', path: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zm-7 4a6 6 0 0 1 3.5-3.5', keywords: ['rocket', 'space', 'launch', 'startup', 'fast', 'innovation', 'technology'] },
  { id: 'sun', path: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', keywords: ['sun', 'sunshine', 'summer', 'bright', 'day', 'warm', 'light'] },
  { id: 'moon', path: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', keywords: ['moon', 'night', 'dark', 'sleep', 'dream', 'celestial', 'lunar'] },
  { id: 'paw', path: 'M14.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0 0v0m-5 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0 0v0M4.5 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0 0v0m15 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm0 0v0M9 19c.93 1.93 2.83 3 5 3s4.07-1.07 5-3a6 6 0 0 0-10 0z', keywords: ['paw', 'pet', 'dog', 'cat', 'animal', 'puppy', 'kitten'] },
  { id: 'infinity', path: 'M18.178 8A5.002 5.002 0 0 0 9 12a5 5 0 1 0 9.178-4zm0 0V3.25A2.25 2.25 0 0 1 20.428 1h.322a2.25 2.25 0 0 1 2.25 2.25V8m-4.822 0h4.822m-14.356 0A5.002 5.002 0 0 1 15 12a5 5 0 1 1-9.178-4zm0 0V3.25A2.25 2.25 0 0 0 3.572 1h-.322a2.25 2.25 0 0 0-2.25 2.25V8m4.822 0H1', keywords: ['infinity', 'forever', 'eternal', 'endless', 'unlimited', 'infinite'] },
  { id: 'pizza', path: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', keywords: ['pizza', 'food', 'italian', 'slice', 'party', 'dinner'] },
];

export function findIconByKeyword(keyword: string): Icon {
  const normalized = keyword.toLowerCase().trim();
  
  // Try exact keyword match first
  const exactMatch = ICON_LIBRARY.find(icon => 
    icon.keywords.some(k => k === normalized)
  );
  if (exactMatch) return exactMatch;
  
  // Try partial match
  const partialMatch = ICON_LIBRARY.find(icon =>
    icon.keywords.some(k => k.includes(normalized) || normalized.includes(k))
  );
  if (partialMatch) return partialMatch;
  
  // Default to heart
  return ICON_LIBRARY[0];
}
