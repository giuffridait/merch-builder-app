import { getInventory } from './inventory';

export type OfferItem = {
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  color?: string;
  size?: string;
  material?: string;
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

export function createOffer(input: { item_id: string; quantity: number; color?: string; size?: string; material?: string }) {
  const inventory = getInventory();
  const item = inventory.find(i => i.item_id === input.item_id);
  if (!item) return null;

  const qty = Math.max(1, Math.floor(input.quantity || 1));
  const unit = item.price.amount;
  const total = unit * qty;
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
        material: input.material
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
