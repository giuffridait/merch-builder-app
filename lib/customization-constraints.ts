import { ICON_LIBRARY } from './icons';
import { PRODUCTS } from './catalog';

export const CUSTOMIZATION_LIMITS = {
  textMaxLength: 18,
  minQuantity: 1,
  maxQuantity: 99
};

export const OCCASIONS = ['gift', 'team', 'event', 'personal'] as const;
export const VIBES = ['minimal', 'bold', 'retro', 'cute', 'sporty'] as const;

export const TEXT_COLOR_OPTIONS: Record<string, { name: string; hex: string }> = {
  white: { name: 'White', hex: '#ffffff' },
  black: { name: 'Black', hex: '#111111' },
  navy: { name: 'Navy', hex: '#1e3a5f' },
  forest: { name: 'Forest', hex: '#2d5016' },
  burgundy: { name: 'Burgundy', hex: '#6b1f3a' },
  charcoal: { name: 'Charcoal', hex: '#4a4a4a' },
  natural: { name: 'Natural', hex: '#f5f1e8' },
  red: { name: 'Red', hex: '#e4002b' },
  pink: { name: 'Pink', hex: '#ff6fb1' },
  blue: { name: 'Blue', hex: '#2f6fed' },
  green: { name: 'Green', hex: '#2d9d78' }
};

export type CustomizationUpdates = {
  stage?: 'welcome' | 'product' | 'intent' | 'text' | 'icon' | 'generating' | 'preview' | 'complete';
  productId?: string;
  occasion?: (typeof OCCASIONS)[number];
  vibe?: (typeof VIBES)[number];
  text?: string;
  iconId?: string;
  productColor?: string;
  textColor?: string;
  size?: string;
  quantity?: number;
  action?: 'add_to_cart';
};

export function normalizeText(text?: string) {
  if (!text) return undefined;
  return text.trim().replace(/\s+/g, ' ');
}

export function validateCustomizationUpdates(raw: any): CustomizationUpdates {
  const updates: CustomizationUpdates = {};
  if (!raw || typeof raw !== 'object') return updates;

  if (typeof raw.stage === 'string') {
    updates.stage = raw.stage as CustomizationUpdates['stage'];
  }

  if (typeof raw.productId === 'string' && PRODUCTS.find(p => p.id === raw.productId)) {
    updates.productId = raw.productId;
  }

  if (typeof raw.occasion === 'string' && OCCASIONS.includes(raw.occasion as any)) {
    updates.occasion = raw.occasion as CustomizationUpdates['occasion'];
  }

  if (typeof raw.vibe === 'string' && VIBES.includes(raw.vibe as any)) {
    updates.vibe = raw.vibe as CustomizationUpdates['vibe'];
  }

  const text = normalizeText(raw.text);
  if (text && text.length <= CUSTOMIZATION_LIMITS.textMaxLength) {
    updates.text = text;
  }

  if (typeof raw.iconId === 'string' && ICON_LIBRARY.find(i => i.id === raw.iconId)) {
    updates.iconId = raw.iconId;
  }

  if (typeof raw.productColor === 'string') {
    updates.productColor = raw.productColor.toLowerCase();
  }

  if (typeof raw.textColor === 'string') {
    updates.textColor = raw.textColor.toLowerCase();
  }

  if (typeof raw.size === 'string') {
    updates.size = raw.size.toUpperCase();
  }

  if (typeof raw.quantity === 'number') {
    const qty = Math.min(
      CUSTOMIZATION_LIMITS.maxQuantity,
      Math.max(CUSTOMIZATION_LIMITS.minQuantity, Math.floor(raw.quantity))
    );
    updates.quantity = qty;
  }

  return updates;
}
