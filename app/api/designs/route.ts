import { NextRequest, NextResponse } from 'next/server';
import { generateDesignsFromLLM } from '@/lib/design-engine';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, iconId, vibe, occasion } = body;

  if (!text && !iconId) {
    return NextResponse.json({ error: 'Missing text or iconId' }, { status: 400 });
  }

  try {
    const variants = await generateDesignsFromLLM(
      text || '',
      iconId,
      vibe,
      occasion
    );

    return NextResponse.json({ variants, recommended: variants[0]?.id || 'A' });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Design generation failed', message: error?.message },
      { status: 500 }
    );
  }
}
