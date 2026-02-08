import { NextRequest, NextResponse } from 'next/server';
import { commitOffer } from '@/lib/commerce-store';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const offer_id = body?.offer_id;

  if (!offer_id) {
    return NextResponse.json({ error: 'Missing offer_id' }, { status: 400 });
  }

  const order = commitOffer(offer_id);
  if (!order) {
    return NextResponse.json({ error: 'Offer not found or expired' }, { status: 404 });
  }

  return NextResponse.json(order);
}
