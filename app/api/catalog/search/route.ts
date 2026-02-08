import { NextRequest, NextResponse } from 'next/server';
import { getInventory } from '@/lib/inventory';

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
      item.attributes?.colors?.some((c: string) => c.toLowerCase() === color)
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
    items: items.slice(0, limit)
  };

  return NextResponse.json(response);
}
