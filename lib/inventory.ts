import inventory from '@/data/inventory.acp.json';

export type ACPPrice = {
  amount: number;
  currency: string;
};

export type ACPVariant = {
  sizes: string[];
  colors: { name: string; hex: string }[];
};

export type ACPAttributes = {
  category: 'tee' | 'hoodie' | 'tote' | 'mug';
  materials: string[];
  lead_time_days: number;
  min_qty: number;
  tags: string[];
  variants: ACPVariant;
};

export type ACPItem = {
  item_id: string;
  title: string;
  description: string;
  url: string;
  image_url: string;
  image_url_by_variant?: Record<string, string>;
  availability_by_variant?: Record<string, string>;
  price: ACPPrice;
  availability: 'in stock' | 'out of stock' | 'preorder';
  availability_date?: string;
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;
  attributes: ACPAttributes;
};

export function getInventory(): ACPItem[] {
  return inventory as ACPItem[];
}
