const { signature } = require('./ecpay-map');

const methods = { FAMI: 'family', FAMIC2C: 'family', UNIMART: 'seven', UNIMARTC2C: 'seven' };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const body = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
  const { MerchantID, MerchantTradeNo, LogisticsSubType, ExtraData, CVSStoreID, CVSStoreName, CVSAddress } = body;
  const secret = process.env.ECPAY_MAP_RETURN_SECRET;
  const expectedMethod = methods[LogisticsSubType];
  const valid = secret && MerchantID === process.env.ECPAY_LOGISTICS_MERCHANT_ID &&
    /^[a-f0-9]{20}$/.test(MerchantTradeNo || '') && /^[a-f0-9]{20}$/.test(ExtraData || '') &&
    expectedMethod && new Set(process.env.ECPAY_LOGISTICS_MODE === 'c2c' ? ['FAMIC2C', 'UNIMARTC2C'] : ['FAMI', 'UNIMART']).has(LogisticsSubType) &&
    cryptoSafeEqual(ExtraData, signature(MerchantTradeNo, LogisticsSubType, secret)) &&
    (expectedMethod === 'family' ? /^\d{5,6}$/.test(CVSStoreID || '') : /^\d{6}$/.test(CVSStoreID || '')) &&
    typeof CVSStoreName === 'string' && CVSStoreName.trim().length > 0 && CVSStoreName.length <= 40 &&
    typeof CVSAddress === 'string' && CVSAddress.length <= 100;
  if (!valid) return res.status(400).end('Invalid store map response');
  const data = { method: expectedMethod, id: CVSStoreID, name: CVSStoreName.trim(), address: CVSAddress, tradeNo: MerchantTradeNo };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).end(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>返回結帳</title><script>const store=${json};let pending;try{pending=JSON.parse(sessionStorage.getItem('colormix_pending_store_map')||'null')}catch(e){}if(pending&&pending.tradeNo===store.tradeNo&&pending.method===store.method){sessionStorage.setItem('colormix_selected_store',JSON.stringify(store));sessionStorage.removeItem('colormix_pending_store_map')}location.replace('/cart.html');</script><a href="/cart.html">返回結帳</a></html>`);
};

function cryptoSafeEqual(a, b) {
  const crypto = require('crypto');
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
