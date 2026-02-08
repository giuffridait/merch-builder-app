import { NextRequest } from 'next/server';
import { GET as getRaw } from '../app/.well-known/ucp-capabilities.json/route';
import { GET as getJsonLd } from '../app/.well-known/ucp-capabilities.jsonld/route';
import { buildUcpJsonLd, stableStringify } from '../lib/ucp-jsonld';

async function testEndpoints() {
  const rawReq = new NextRequest('http://localhost/.well-known/ucp-capabilities.json');
  const rawRes = await getRaw(rawReq);
  if (rawRes.status !== 200) throw new Error(`Raw endpoint status ${rawRes.status}`);
  const rawBody = await rawRes.text();
  const rawJson = JSON.parse(rawBody);
  if (!rawJson.merchant_id) throw new Error('Raw JSON missing merchant_id');

  const cache = rawRes.headers.get('cache-control');
  const etag = rawRes.headers.get('etag');
  if (!cache || !cache.includes('max-age=3600')) throw new Error('Missing cache-control');
  if (!etag) throw new Error('Missing etag');

  const ldReq = new NextRequest('http://localhost/.well-known/ucp-capabilities.jsonld');
  const ldRes = await getJsonLd(ldReq);
  if (ldRes.status !== 200) throw new Error(`JSON-LD endpoint status ${ldRes.status}`);
  const ldBody = await ldRes.text();
  const ldJson = JSON.parse(ldBody);
  if (!ldJson['@context'] || !ldJson['@type']) throw new Error('JSON-LD missing @context/@type');

  const first = stableStringify(buildUcpJsonLd());
  const second = stableStringify(buildUcpJsonLd());
  if (first !== second) throw new Error('JSON-LD output is not deterministic');
}

testEndpoints()
  .then(() => {
    console.log('UCP endpoint tests passed.');
  })
  .catch(err => {
    console.error('UCP endpoint tests failed:', err);
    process.exit(1);
  });
