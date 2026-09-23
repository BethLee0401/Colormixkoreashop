const PROVIDERS = {
  C2C: { family: "FAMIC2C", seven: "UNIMARTC2C" },
  B2C: { family: "FAMI", seven: "UNIMART" }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).end();

  const method = String(req.query.method || "");
  const state = String(req.query.state || "");
  const collection = String(req.query.collection || "N");
  const merchantId = process.env.ECPAY_LOGISTICS_MERCHANT_ID;
  const stage = process.env.ECPAY_LOGISTICS_ENV === "stage";
  const mode = process.env.ECPAY_LOGISTICS_MODE === "B2C" ? "B2C" : "C2C";

  if (!PROVIDERS[mode][method] || !/^[0-9a-f]{16}$/.test(state) ||
      !["Y", "N"].includes(collection)) {
    return res.status(400).send("門市查詢參數不正確。");
  }
  if (!/^\d{7,10}$/.test(merchantId || "")) {
    return res.status(503).send("尚未設定綠界物流特店編號，請聯絡店家啟用門市查詢。");
  }

  const host = process.env.ECPAY_PUBLIC_ORIGIN || `https://${req.headers.host}`;
  let replyUrl;
  try {
    const origin = new URL(host);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") throw new Error();
    replyUrl = new URL("/api/store-callback", origin).href;
  } catch (error) {
    return res.status(500).send("門市查詢網址設定不正確。");
  }

  const action = stage
    ? "https://logistics-stage.ecpay.com.tw/Express/map"
    : "https://logistics.ecpay.com.tw/Express/map";
  const fields = {
    MerchantID: merchantId,
    LogisticsType: "CVS",
    LogisticsSubType: PROVIDERS[mode][method],
    IsCollection: collection,
    ServerReplyURL: replyUrl,
    ExtraData: state
  };
  const inputs = Object.entries(fields).map(([key, value]) =>
    `<input type="hidden" name="${key}" value="${escapeHtml(value)}">`
  ).join("");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8">
<title>選擇取貨門市</title><p>正在開啟門市查詢⋯</p>
<form id="store-map" method="post" action="${action}">${inputs}
<button type="submit">開啟門市查詢</button></form>
<script>document.getElementById("store-map").submit();</script></html>`);
}
