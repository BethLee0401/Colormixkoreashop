const crypto = require('crypto');

const methods = {
  family: { b2c: 'FAMI', c2c: 'FAMIC2C' },
  seven: { b2c: 'UNIMART', c2c: 'UNIMARTC2C' }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function signature(tradeNo, subtype, secret) {
  return crypto.createHmac('sha256', secret).update(`${tradeNo}:${subtype}`).digest('hex').slice(0, 20);
}

module.exports = async function handler(req, res) {
  const merchant = process.env.ECPAY_LOGISTICS_MERCHANT_ID;
  const secret = process.env.ECPAY_MAP_RETURN_SECRET;
  const mode = process.env.ECPAY_LOGISTICS_MODE;
  const configured = /^\d{7,10}$/.test(merchant || '') && Boolean(secret && secret.length >= 32) && ['b2c', 'c2c'].includes(mode);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  if (req.query.status === '1') return res.status(200).json({ enabled: configured });
  const method = req.query.method;
  if (!methods[method]) return res.status(400).end('Invalid store type');
  if (!configured) return res.status(503).end('Store map integration is not configured');

  const subtype = methods[method][mode];
  const tradeNo = crypto.randomBytes(10).toString('hex');
  const extraData = signature(tradeNo, subtype, secret);
  const origin = `https://${req.headers.host}`;
  const replyUrl = `${origin}/api/ecpay-store-return`;
  const endpoint = process.env.ECPAY_LOGISTICS_STAGE === 'true'
    ? 'https://logistics-stage.ecpay.com.tw/Express/map'
    : 'https://logistics.ecpay.com.tw/Express/map';
  const fields = { MerchantID: merchant, MerchantTradeNo: tradeNo, LogisticsType: 'CVS', LogisticsSubType: subtype, IsCollection: 'N', ServerReplyURL: replyUrl, ExtraData: extraData };
  const inputs = Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).end(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>選擇取貨門市</title><form id="map" method="post" action="${endpoint}">${inputs}<button type="submit">開啟門市地圖</button></form><script>sessionStorage.setItem('colormix_pending_store_map',JSON.stringify({tradeNo:${JSON.stringify(tradeNo)},method:${JSON.stringify(method)}}));document.getElementById('map').submit();</script></html>`);
};
module.exports.signature = signature;
