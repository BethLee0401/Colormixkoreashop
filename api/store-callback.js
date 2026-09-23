const PROVIDERS = {
  FAMIC2C: "family",
  UNIMARTC2C: "seven",
  FAMI: "family",
  UNIMART: "seven"
};

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body || {};
  const merchantId = process.env.ECPAY_LOGISTICS_MERCHANT_ID;
  const method = PROVIDERS[String(body.LogisticsSubType || "")];
  const mode = process.env.ECPAY_LOGISTICS_MODE === "B2C" ? "B2C" : "C2C";
  const subtype = String(body.LogisticsSubType || "");
  const state = String(body.ExtraData || "");
  const id = String(body.CVSStoreID || "");
  const name = String(body.CVSStoreName || "");
  const address = String(body.CVSAddress || "");

  if (!merchantId || String(body.MerchantID) !== merchantId || !method ||
      (mode === "C2C" && !subtype.endsWith("C2C")) ||
      (mode === "B2C" && subtype.endsWith("C2C")) ||
      !/^[0-9a-f]{16}$/.test(state) || !/^[A-Za-z0-9]{1,9}$/.test(id) ||
      !name || name.length > 40 || !address || address.length > 100) {
    return res.status(400).send("門市資料不完整，請返回購物車重新選擇。");
  }

  // 綠界以 POST 返回原分頁；把門市寫入同分頁的暫存後回到購物車。
  const data = JSON.stringify({ state, method, id, name, address })
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8">
<title>返回購物車</title><p>已選擇取貨門市，正在返回結帳頁⋯</p>
<script>sessionStorage.setItem("colormix_selected_store", JSON.stringify(${data}));
location.replace("/cart.html");</script>
<a href="/cart.html">返回購物車</a></html>`);
}
