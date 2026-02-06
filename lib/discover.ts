import { ACPItem, getInventory } from '@/lib/inventory';

export type DiscoverStage = 'welcome' | 'constraints' | 'results';

export type DiscoverConstraints = {
  category?: 'tee' | 'hoodie' | 'tote' | 'mug';
  budgetMax?: number;
  materials?: string[];
  sustainable?: boolean;
  quantity?: number;
  eventDate?: string;
  tags?: string[];
  occasion?: 'gift' | 'team' | 'event' | 'personal';
  color?: string;
  leadTimeMax?: number;
  size?: string;
};

export type DiscoverState = {
  stage: DiscoverStage;
  constraints: DiscoverConstraints;
};

const CATEGORY_KEYWORDS: Record<NonNullable<DiscoverConstraints['category']>, string[]> = {
  tee: ['tee', 't-shirt', 'shirt'],
  hoodie: ['hoodie', 'sweatshirt'],
  tote: ['tote', 'bag'],
  mug: ['mug', 'cup']
};

const OCCASION_KEYWORDS: Record<NonNullable<DiscoverConstraints['occasion']>, string[]> = {
  gift: ['gift', 'present', 'birthday'],
  team: ['team', 'group', 'club'],
  event: ['event', 'party', 'concert'],
  personal: ['personal', 'myself', 'me']
};

const MATERIAL_KEYWORDS = ['cotton', 'canvas', 'ceramic', 'organic', 'recycled', 'poly', 'polyester'];
const TAG_KEYWORDS = ['eco', 'sustainable', 'minimal', 'bold', 'retro', 'cute', 'sporty'];
const COLOR_KEYWORDS = ['white', 'black', 'navy', 'forest', 'burgundy', 'natural', 'charcoal'];
const SIZE_KEYWORDS = ['xs', 's', 'm', 'l', 'xl', '2xl'];

export function isMaterialsQuestion(message: string) {
  const text = message.toLowerCase();
  return text.includes('fabric') || text.includes('material') || text.includes('materials');
}

export function getAvailableMaterials(constraints: DiscoverConstraints) {
  const items = filterInventory(getInventory(), constraints);
  const materialSet = new Set<string>();
  for (const item of items) {
    for (const material of item.attributes.materials) {
      materialSet.add(material);
    }
  }
  return Array.from(materialSet).sort();
}

export function parseConstraints(message: string): Partial<DiscoverConstraints> {
  const text = message.toLowerCase();
  const updates: Partial<DiscoverConstraints> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) {
      updates.category = category as DiscoverConstraints['category'];
      break;
    }
  }

  for (const [occasion, keywords] of Object.entries(OCCASION_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) {
      updates.occasion = occasion as DiscoverConstraints['occasion'];
      break;
    }
  }

  if (text.includes('sustainable') || text.includes('eco')) {
    updates.sustainable = true;
  }

  const materialMatches = MATERIAL_KEYWORDS.filter(m => text.includes(m));
  if (materialMatches.length > 0) updates.materials = materialMatches;

  const tagMatches = TAG_KEYWORDS.filter(t => text.includes(t));
  if (tagMatches.length > 0) updates.tags = tagMatches;

  const colorMatch = COLOR_KEYWORDS.find(c => text.includes(c));
  if (colorMatch) updates.color = colorMatch;

  const sizeMatch = SIZE_KEYWORDS.find(s => new RegExp(`\\b${s}\\b`).test(text));
  if (sizeMatch) updates.size = sizeMatch.toUpperCase();

  const budgetMatch = text.match(/(?:under|less than|below)\s*[€$]?(\d+(?:\.\d+)?)/);
  if (budgetMatch?.[1]) updates.budgetMax = parseFloat(budgetMatch[1]);

  const priceMatch = text.match(/[€$](\d+(?:\.\d+)?)/);
  if (priceMatch?.[1] && !updates.budgetMax) updates.budgetMax = parseFloat(priceMatch[1]);

  const qtyMatch = text.match(/(\d+)\s*(?:items|pcs|pieces|shirts|hoodies|totes|mugs)/);
  if (qtyMatch?.[1]) updates.quantity = parseInt(qtyMatch[1], 10);

  const leadMatch = text.match(/(?:under|less than|within|in)\s*(\d+)\s*days?/);
  if (leadMatch?.[1]) updates.leadTimeMax = parseInt(leadMatch[1], 10);

  const dateMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (dateMatch?.[1]) updates.eventDate = dateMatch[1];

  return updates;
}

export type InventoryResult = {
  item_id: string;
  title: string;
  description: string;
  image_url: string;
  image_url_selected?: string;
  image_url_fallback?: string;
  price: string;
  tags: string[];
  reason: string;
  leadTimeDays: number;
  availability: string;
  matchedColor?: string;
  matchedColorHex?: string;
  matchedMaterial?: string;
  variantAvailability?: string;
};

function isSustainable(item: ACPItem) {
  const tags = item.attributes.tags || [];
  const materials = item.attributes.materials || [];
  return tags.includes('eco') || materials.includes('organic') || materials.includes('recycled');
}

export function filterInventory(items: ACPItem[], constraints: DiscoverConstraints): ACPItem[] {
  return items.filter(item => {
    if (!item.is_eligible_search) return false;
    if (item.availability !== 'in stock') return false;

    if (constraints.category && item.attributes.category !== constraints.category) return false;

    if (constraints.budgetMax != null && item.price.amount > constraints.budgetMax) return false;

    if (constraints.sustainable && !isSustainable(item)) return false;

    if (constraints.materials && constraints.materials.length > 0) {
      const hasAny = constraints.materials.some(m => item.attributes.materials.includes(m));
      if (!hasAny) return false;
    }

    if (constraints.tags && constraints.tags.length > 0) {
      const hasAny = constraints.tags.some(t => item.attributes.tags.includes(t));
      if (!hasAny) return false;
    }

    if (constraints.leadTimeMax != null && item.attributes.lead_time_days > constraints.leadTimeMax) {
      return false;
    }

    if (constraints.color) {
      const colors = item.attributes.variants.colors || [];
      const hasColor = colors.some(c => c.name.toLowerCase() === constraints.color);
      if (!hasColor) return false;
    }

    if (constraints.size) {
      const sizes = item.attributes.variants.sizes || [];
      if (sizes.length === 0) return false;
      if (!sizes.includes(constraints.size)) return false;
    }

    if (constraints.color && constraints.materials && constraints.materials.length > 0) {
      const material = constraints.materials.find(m => item.attributes.materials.includes(m));
      if (material && item.availability_by_variant) {
        const key = `${constraints.color}|${material}`.toLowerCase().replace(/\s+/g, '-');
        const status = item.availability_by_variant[key];
        if (status === 'out of stock') return false;
      }
    }

    return true;
  });
}

function scoreItem(item: ACPItem, constraints: DiscoverConstraints) {
  let score = 0;
  if (constraints.category && item.attributes.category === constraints.category) score += 3;
  if (constraints.budgetMax != null && item.price.amount <= constraints.budgetMax) score += 2;
  if (constraints.sustainable && isSustainable(item)) score += 2;
  if (constraints.materials) {
    const matches = constraints.materials.filter(m => item.attributes.materials.includes(m)).length;
    score += matches;
  }
  if (constraints.tags) {
    const matches = constraints.tags.filter(t => item.attributes.tags.includes(t)).length;
    score += matches;
  }
  if (constraints.color) {
    const colors = item.attributes.variants.colors || [];
    if (colors.some(c => c.name.toLowerCase() === constraints.color)) score += 1;
  }
  if (constraints.size) {
    const sizes = item.attributes.variants.sizes || [];
    if (sizes.includes(constraints.size)) score += 1;
  }
  if (constraints.occasion && item.attributes.tags.includes(constraints.occasion)) score += 1;
  return score;
}

export function rankInventory(constraints: DiscoverConstraints): InventoryResult[] {
  const items = filterInventory(getInventory(), constraints);
  const ranked = items
    .map(item => ({ item, score: scoreItem(item, constraints) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return ranked.map(({ item }) => {
    const reasons: string[] = [];
    if (constraints.category) reasons.push(`matches ${constraints.category}`);
    if (constraints.budgetMax != null) reasons.push(`under €${constraints.budgetMax}`);
    if (constraints.sustainable && isSustainable(item)) reasons.push('sustainable-friendly');
    if (constraints.quantity && item.attributes.min_qty > constraints.quantity) {
      reasons.push(`min qty ${item.attributes.min_qty}`);
    }
    let matchedColor: string | undefined;
    let matchedColorHex: string | undefined;
    if (constraints.color) {
      const colors = item.attributes.variants.colors || [];
      const found = colors.find(c => c.name.toLowerCase() === constraints.color);
      if (found) {
        matchedColor = found.name;
        matchedColorHex = found.hex;
      }
    }
    let matchedMaterial: string | undefined;
    if (constraints.materials && constraints.materials.length > 0) {
      const found = constraints.materials.find(m => item.attributes.materials.includes(m));
      if (found) matchedMaterial = found;
    }
    let image_url_selected: string | undefined;
    if (matchedColor && matchedMaterial && item.image_url_by_variant) {
      const key = `${matchedColor.toLowerCase()}|${matchedMaterial.toLowerCase()}`.replace(/\s+/g, '-');
      image_url_selected = item.image_url_by_variant[key];
    } else if (matchedColor && item.image_url_by_variant && item.attributes.materials.length === 1) {
      const onlyMaterial = item.attributes.materials[0];
      const key = `${matchedColor.toLowerCase()}|${onlyMaterial.toLowerCase()}`.replace(/\s+/g, '-');
      image_url_selected = item.image_url_by_variant[key];
    }
    let image_url_fallback: string | undefined;
    if (item.image_url_by_variant) {
      const first = Object.values(item.image_url_by_variant)[0];
      if (first) image_url_fallback = first;
    }
    let variantAvailability: string | undefined;
    if (matchedColor && matchedMaterial && item.availability_by_variant) {
      const key = `${matchedColor.toLowerCase()}|${matchedMaterial.toLowerCase()}`.replace(/\s+/g, '-');
      variantAvailability = item.availability_by_variant[key];
    }
    return {
      item_id: item.item_id,
      title: item.title,
      description: item.description,
      image_url: item.image_url,
      image_url_selected,
      image_url_fallback,
      price: `€${item.price.amount.toFixed(2)}`,
      tags: item.attributes.tags,
      reason: reasons.length ? reasons.join(', ') : 'popular pick',
      leadTimeDays: item.attributes.lead_time_days,
      availability: item.availability,
      matchedColor,
      matchedColorHex,
      matchedMaterial,
      variantAvailability
    };
  });
}
