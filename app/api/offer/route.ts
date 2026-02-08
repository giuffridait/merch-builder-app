import { NextRequest, NextResponse } from 'next/server';
import { createOffer } from '@/lib/commerce-store';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const item_id = body?.item_id;
  const quantity = body?.quantity ?? 1;
  const color = body?.color;
  const size = body?.size;
  const material = body?.material;

  if (!item_id) {
    return NextResponse.json({ error: 'Missing item_id' }, { status: 400 });
  }

  const offer = createOffer({ item_id, quantity, color, size, material });
  if (!offer) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json(offer);
}
