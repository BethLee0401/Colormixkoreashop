const assert = require('node:assert/strict');
const test = require('node:test');
const launch = require('../api/ecpay-map');
const returned = require('../api/ecpay-store-return');

process.env.ECPAY_LOGISTICS_MERCHANT_ID = '2000132';
process.env.ECPAY_LOGISTICS_MODE = 'b2c';
process.env.ECPAY_MAP_RETURN_SECRET = 'local-only-secret-for-map-test-0123456789';
process.env.ECPAY_LOGISTICS_STAGE = 'true';

async function invoke(handler, method, query = {}, body = {}) {
  const result = { status: 200, headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(value) { result.body = value; return this; },
    end(value) { result.body = value; return this; }
  };
  await handler({ method, query, body, headers: { host: 'preview.example.test' } }, res);
  return result;
}

for (const [method, subtype] of [['family', 'FAMI'], ['seven', 'UNIMART']]) {
  test(`${method}: map launch and matching return token`, async () => {
    const response = await invoke(launch, 'GET', { method });
    assert.equal(response.status, 200);
    assert.match(response.body, /logistics-stage\.ecpay\.com\.tw\/Express\/map/);
    assert.match(response.body, /https:\/\/preview\.example\.test\/api\/ecpay-store-return/);
    assert.match(response.body, new RegExp(`name="LogisticsSubType" value="${subtype}"`));
    const tradeNo = response.body.match(/name="MerchantTradeNo" value="([^"]+)"/)[1];
    const extraData = response.body.match(/name="ExtraData" value="([^"]+)"/)[1];
    const body = { MerchantID: '2000132', MerchantTradeNo: tradeNo, LogisticsSubType: subtype, ExtraData: extraData, CVSStoreID: '123456', CVSStoreName: '測試店', CVSAddress: '台北市測試路' };
    const valid = await invoke(returned, 'POST', {}, body);
    assert.equal(valid.status, 200);
    assert.match(valid.body, /colormix_selected_store/);
    assert.match(valid.body, /location\.replace\('\/cart\.html'\)/);
    assert.equal((await invoke(returned, 'POST', {}, { ...body, ExtraData: '0'.repeat(20) })).status, 400);
    assert.equal((await invoke(returned, 'POST', {}, { ...body, CVSStoreID: 'bad' })).status, 400);
    assert.equal((await invoke(returned, 'POST', {}, { ...body, MerchantID: '0000000' })).status, 400);
  });
}

test('unconfigured map does not offer auto selection', async () => {
  delete process.env.ECPAY_MAP_RETURN_SECRET;
  const response = await invoke(launch, 'GET', { status: '1' });
  assert.deepEqual(response.body, { enabled: false });
});
