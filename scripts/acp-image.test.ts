import { NextRequest } from 'next/server';
import { GET as search } from '../app/api/catalog/search/route';
import { POST as offer } from '../app/api/offer/route';
import { POST as commit } from '../app/api/commit/route';
import { GET as order } from '../app/api/order/[id]/route';

function isHttps(url?: string) {
  return typeof url === 'string' && url.startsWith('https://');
}

async function run() {
  const searchReq = new NextRequest('http://localhost/api/catalog/search?limit=1');
  const searchRes = await search(searchReq);
  if (searchRes.status !== 200) throw new Error(`search status ${searchRes.status}`);
  const searchJson = await searchRes.json();
  const item = searchJson.items?.[0];
  if (!item?.item_id) throw new Error('Missing item_id');
  if (!isHttps(item.image_url)) throw new Error('search image_url must be https');

  const offerReq = new NextRequest('http://localhost/api/offer', {
    method: 'POST',
    body: JSON.stringify({ item_id: item.item_id, quantity: 1, color: 'black', size: 'M', material: 'cotton' })
  });
  const offerRes = await offer(offerReq);
  if (offerRes.status !== 200) throw new Error(`offer status ${offerRes.status}`);
  const offerJson = await offerRes.json();
  const offerItem = offerJson.items?.[0];
  if (!isHttps(offerItem?.image_url)) throw new Error('offer item image_url must be https');

  const commitReq = new NextRequest('http://localhost/api/commit', {
    method: 'POST',
    body: JSON.stringify({ offer_id: offerJson.offer_id })
  });
  const commitRes = await commit(commitReq);
  if (commitRes.status !== 200) throw new Error(`commit status ${commitRes.status}`);
  const commitJson = await commitRes.json();
  const orderItem = commitJson.items?.[0];
  if (!isHttps(orderItem?.image_url)) throw new Error('order item image_url missing after commit');

  const orderReq = new NextRequest(`http://localhost/api/order/${commitJson.order_id}`);
  const orderRes = await order(orderReq, { params: { id: commitJson.order_id } });
  if (orderRes.status !== 200) throw new Error(`order status ${orderRes.status}`);
  const orderJson = await orderRes.json();
  const finalItem = orderJson.items?.[0];
  if (!isHttps(finalItem?.image_url)) throw new Error('order image_url must be https');
}

run()
  .then(() => {
    console.log('ACP image test passed.');
  })
  .catch(err => {
    console.error('ACP image test failed:', err);
    process.exit(1);
  });
