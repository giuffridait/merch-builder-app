import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(req: NextRequest) {
  const filePath = join(process.cwd(), 'data', 'ucp-products.json');
  const body = readFileSync(filePath, 'utf-8');

  const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
  const ifNoneMatch = req.headers.get('if-none-match');

  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': 'public, max-age=3600' }
    });
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      ETag: etag
    }
  });
}
