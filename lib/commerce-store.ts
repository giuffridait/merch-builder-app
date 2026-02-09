import { getInventory } from './inventory';
import { toAbsoluteUrl } from './url';

export type OfferItem = {
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  color?: string;
  size?: string;
  material?: string;
  image_url?: string;
  images?: { url: string; alt?: string; variant_key?: string }[];
  product_url?: string;
};

export type Offer = {
  offer_id: string;
  created_at: string;
  items: OfferItem[];
  total: number;
  currency: string;
  status: 'open' | 'expired';
};

export type Order = {
  order_id: string;
  created_at: string;
  status: 'confirmed' | 'cancelled';
  items: OfferItem[];
  total: number;
  currency: string;
  delivery_estimate_days: number;
};

type Store = {
  offers: Map<string, Offer>;
  orders: Map<string, Order>;
};

function getStore(): Store {
  const globalAny = globalThis as typeof globalThis & { __merchforge_store?: Store };
  if (!globalAny.__merchforge_store) {
    globalAny.__merchforge_store = {
      offers: new Map(),
      orders: new Map()
    };
  }
  return globalAny.__merchforge_store;
}

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;
}

function pickVariantKey(input: { color?: string; size?: string; material?: string }) {
  const parts = [input.color, input.size, input.material].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join('|').toLowerCase();
}

function pickVariantImage(
  item: ReturnType<typeof getInventory>[number],
  input: { color?: string; size?: string; material?: string }
) {
  if (!item.image_url_by_variant) return null;
  const candidates = [];
  const color = input.color?.toLowerCase();
  const size = input.size?.toUpperCase();
  const material = input.material?.toLowerCase();

  if (color && size && material) candidates.push(`${color}|${size}|${material}`);
  if (color && material) candidates.push(`${color}|${material}`);
  if (color && size) candidates.push(`${color}|${size}`);
  if (color) candidates.push(`${color}`);

  for (const key of candidates) {
    const found = item.image_url_by_variant[key];
    if (found) return { key, url: found };
  }
  return null;
}

export function createOffer(input: { item_id: string; quantity: number; color?: string; size?: string; material?: string }) {
  const inventory = getInventory();
  const item = inventory.find(i => i.item_id === input.item_id);
  if (!item) return null;

  const qty = Math.max(1, Math.floor(input.quantity || 1));
  const unit = item.price.amount;
  const total = unit * qty;
  const variant = pickVariantImage(item, input);
  const images: { url: string; alt?: string; variant_key?: string }[] = [];
  if (item.image_url_by_variant) {
    for (const [key, value] of Object.entries(item.image_url_by_variant)) {
      if (!value) continue;
      images.push({ url: toAbsoluteUrl(value), variant_key: key, alt: item.title });
    }
  }
  if (item.image_url) {
    images.unshift({ url: toAbsoluteUrl(item.image_url), alt: item.title });
  }

  const offer: Offer = {
    offer_id: generateId('offer'),
    created_at: new Date().toISOString(),
    status: 'open',
    currency: item.price.currency,
    items: [
      {
        item_id: item.item_id,
        quantity: qty,
        unit_price: unit,
        total_price: total,
        currency: item.price.currency,
        color: input.color,
        size: input.size,
        material: input.material,
        image_url: toAbsoluteUrl(variant?.url || item.image_url),
        images: images.length > 0 ? images : undefined,
        product_url: item.url ? toAbsoluteUrl(item.url) : undefined
      }
    ],
    total
  };

  const store = getStore();
  store.offers.set(offer.offer_id, offer);
  return offer;
}

export function getOffer(offerId: string) {
  const store = getStore();
  return store.offers.get(offerId) || null;
}

export function commitOffer(offerId: string) {
  const offer = getOffer(offerId);
  if (!offer || offer.status !== 'open') return null;
  const store = getStore();
  const delivery = 7;
  const order: Order = {
    order_id: generateId('order'),
    created_at: new Date().toISOString(),
    status: 'confirmed',
    items: offer.items,
    total: offer.total,
    currency: offer.currency,
    delivery_estimate_days: delivery
  };
  store.orders.set(order.order_id, order);
  return order;
}

export function getOrder(orderId: string) {
  const store = getStore();
  return store.orders.get(orderId) || null;
}
