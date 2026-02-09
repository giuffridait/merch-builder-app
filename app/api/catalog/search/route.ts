import { NextRequest, NextResponse } from 'next/server';
import { getInventory } from '@/lib/inventory';
import { toAbsoluteUrl } from '@/lib/url';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') || '').toLowerCase();
  const category = (url.searchParams.get('category') || '').toLowerCase();
  const color = (url.searchParams.get('color') || '').toLowerCase();
  const material = (url.searchParams.get('material') || '').toLowerCase();
  const maxPrice = url.searchParams.get('max_price');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10), 50);

  const inventory = getInventory();
  let items = inventory.filter(item => item.is_eligible_search !== false);

  if (query) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.attributes?.tags?.some((tag: string) => tag.toLowerCase().includes(query))
    );
  }

  if (category) {
    items = items.filter(item => item.attributes?.category?.toLowerCase() === category);
  }

  if (color) {
    items = items.filter(item =>
      item.attributes?.variants?.colors?.some((c: { name: string }) => c.name.toLowerCase() === color)
    );
  }

  if (material) {
    items = items.filter(item =>
      item.attributes?.materials?.some((m: string) => m.toLowerCase() === material)
    );
  }

  if (maxPrice) {
    const max = parseFloat(maxPrice);
    if (!Number.isNaN(max)) {
      items = items.filter(item => item.price.amount <= max);
    }
  }

  const response = {
    count: items.length,
    items: items.slice(0, limit).map(item => {
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
      return {
        ...item,
        image_url: toAbsoluteUrl(item.image_url),
        images: images.length > 0 ? images : undefined
      };
    })
  };

  return NextResponse.json(response);
}
