import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { loadUcpCapabilities } from '@/lib/ucp-loader';
import { stableStringify } from '@/lib/ucp-jsonld';

function buildResponse(body: string, req: NextRequest) {
  const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=3600'
      }
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

export async function GET(req: NextRequest) {
  const data = loadUcpCapabilities();
  const body = stableStringify(data);
  return buildResponse(body, req);
}
