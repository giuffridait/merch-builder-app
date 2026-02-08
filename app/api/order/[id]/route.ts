import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/commerce-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = getOrder(params.id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json(order);
}
