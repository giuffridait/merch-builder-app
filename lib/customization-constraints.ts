import { ICON_LIBRARY } from './icons';
import { PRODUCTS } from './catalog';

export const CUSTOMIZATION_LIMITS = {
  textMaxLength: 50,
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
  productId?: string;
  occasion?: (typeof OCCASIONS)[number];
  vibe?: (typeof VIBES)[number];
  text?: string;
  iconId?: string;
  productColor?: string;
  textColor?: string;
  color?: string;
  size?: string;
  budgetMax?: number;
  leadTimeMax?: number;
  materials?: string[];
  quantity?: number;
  action?: 'add_to_cart' | 'remove_icon';
};

export function normalizeText(text?: string) {
  if (!text) return undefined;
  return text.trim().replace(/\s+/g, ' ');
}

export function validateCustomizationUpdates(raw: any): CustomizationUpdates {
  const updates: CustomizationUpdates = {};
  if (!raw || typeof raw !== 'object') return updates;

  let validatedProduct: any = null;
  if (typeof raw.productId === 'string') {
    const search = raw.productId.toLowerCase();
    validatedProduct = PRODUCTS.find(p =>
      p.id.toLowerCase() === search ||
      p.name.toLowerCase() === search ||
      p.category.toLowerCase() === search
    );
    if (validatedProduct) updates.productId = validatedProduct.id;
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

  const allowedColors = Object.keys(TEXT_COLOR_OPTIONS);

  const rawColor = raw.productColor || raw.color;
  if (typeof rawColor === 'string') {
    const color = rawColor.toLowerCase();
    if (color !== 'string' && color !== 'color' && color !== 'productcolor') {
      const isValid = validatedProduct
        ? validatedProduct.colors.some((c: any) => c.name.toLowerCase() === color)
        : allowedColors.includes(color);

      if (isValid) {
        updates.productColor = color;
        updates.color = color;
      }
    }
  }

  if (typeof raw.textColor === 'string') {
    const color = raw.textColor.toLowerCase();
    if (color !== 'string' && color !== 'textcolor' && allowedColors.includes(color)) {
      updates.textColor = color;
    }
  }

  if (typeof raw.size === 'string') {
    const size = raw.size.toUpperCase();
    if (size !== 'STRING' && size !== 'SIZE') {
      const isValid = validatedProduct
        ? validatedProduct.sizes.includes(size)
        : ['XS', 'S', 'M', 'L', 'XL', '2XL'].includes(size);
      if (isValid) updates.size = size;
    }
  }

  if (typeof raw.quantity === 'number') {
    const qty = Math.min(
      CUSTOMIZATION_LIMITS.maxQuantity,
      Math.max(CUSTOMIZATION_LIMITS.minQuantity, Math.floor(raw.quantity))
    );
    updates.quantity = qty;
  }

  if (typeof raw.budgetMax === 'number' && raw.budgetMax > 0) {
    updates.budgetMax = raw.budgetMax;
  }
  if (typeof raw.leadTimeMax === 'number' && raw.leadTimeMax > 0) {
    updates.leadTimeMax = raw.leadTimeMax;
  }
  if (Array.isArray(raw.materials)) {
    updates.materials = raw.materials.filter((m: any) => typeof m === 'string');
  }

  if (typeof raw.action === 'string' && (raw.action === 'add_to_cart' || raw.action === 'remove_icon')) {
    updates.action = raw.action;
  }

  return updates;
}
