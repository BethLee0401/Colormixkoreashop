# Colormixkoreashop

## 購物流程

- 首頁點商品可直接開啟視窗，選尺寸、顏色和數量並加入購物車；關閉後可繼續挑選。
- 購物車最多 15 件，所有商品與尺寸顏色的數量合計；超量的既有購物車須先刪減才能結帳。
- `cart.html` 使用既有的 Supabase 會員登入與 `create_order_with_payment` RPC 建立訂單。正式資料庫已完成交易內回滾測試；2026-09-30 已登入會員在正式網站建立測試訂單 CM20260930436D36，核對商品規格與金額後立即取消；沒有付款或出貨。
- `admin.html` 保留商品上架／下架、原價和尺寸顏色庫存管理。

## 超商取貨門市自動回填

取得綠界物流介接資格後，於 Vercel 的環境變數設定：

| 變數 | 用途 |
| --- | --- |
| `ECPAY_LOGISTICS_MERCHANT_ID` | 綠界提供的物流商家編號 |
| `ECPAY_LOGISTICS_MODE` | 申請的物流模式：`b2c` 或 `c2c` |
| `ECPAY_MAP_RETURN_SECRET` | 自行產生至少 32 個字元的隨機密鑰，僅供本站驗證回傳；不要提交至 GitHub |
| `ECPAY_LOGISTICS_STAGE` | 測試環境設 `true`；正式環境不設定 |

三項必要變數未備齊時，結帳維持手動選店：官方查詢頁在新分頁開啟，顧客回到結帳填入門市名稱和店號。設定後按「選擇門市」會在同一分頁開啟綠界電子地圖，選完返回本站並自動填入店名、店號和地址；結帳欄位會暫存，購物車仍在本機儲存。全家與 7-ELEVEN 的 `LogisticsSubType` 依申請的 B2C/C2C 模式切換。測試環境僅回傳固定門市，不能當作正式門市使用。地圖選店不會建立物流單；仍須依實際出貨方式處理物流。

回傳端核對商家編號、物流類型、交易編號及伺服器簽章；瀏覽器還會核對發起選店時的交易編號。啟用正式環境前，需以已開通的商家編號在預覽部署完整測試全家與 7-ELEVEN 選店、回填與下單。正式網站目前已驗證郵寄宅配訂單；超商選店下單尚待實測。

## 正式資料庫維護記錄（2026-09-23）

`public.create_order` 原本在插入 `order_items` 前更新一次 `product_variants.stock`；啟用中的 `decrease_variant_stock_after_order` 觸發器會在插入後再扣一次。已從 `create_order` 移除前一次更新，由觸發器負責唯一的庫存扣除及商品總庫存同步。保存後重新讀取函式，確認重複更新已移除，商品、規格與訂單項目檢查仍保留。既有訂單的歷史庫存沒有自動回補；不能在缺少逐筆盤點時推算回補量。

`admin_delete_order` 與 `cancel_unpaid_orders` 原本只回補規格庫存，未同步 `Products.stock_quantity`。已在回補後依啟用中的商品規格重新計算總庫存，並重新讀取兩個函式確認保存。歷史上已刪除或取消的訂單仍須盤點，無法由本次程式修正自動還原。

新訂單原本預設狀態「待聯絡」，但每 10 分鐘執行一次的 `cancel_unpaid_orders` 只處理 `pending` 等狀態，後台也使用 `pending`。已將 `orders.status` 預設值改為 `pending`；既有 2 筆「待聯絡」訂單保持原樣，不自動取消。資料庫設定記錄於 [`supabase/migrations/20260923_pending_order_status.sql`](supabase/migrations/20260923_pending_order_status.sql)。

[`tests/rollback_order_flow.sql`](tests/rollback_order_flow.sql) 以交易內建立的會員、商品與訂單，驗證 16 件訂單拒絕、價格、運費、現貨扣庫存、24 小時取消、管理員刪單回補、符合資格的超商取貨付款及預購限制；最後刻意拋出例外使整筆交易回滾。2026-09-24 在正式 Supabase 執行新版，得到預期的 `ROLLBACK_FLOW_PASS`；事後查詢測試會員、商品與訂單各 0 筆。

購物車畫面限制 15 件。資料庫端的 [`supabase/migrations/20260924_order_item_limit_15.sql`](supabase/migrations/20260924_order_item_limit_15.sql) 已於 2026-09-24 套用正式 Supabase；確認 `order_items` 的欄位後建立觸發器，再查詢 `pg_trigger` 確認其存在。直接新增或調整訂單明細時，超過 15 件亦會拒絕。

目前 Supabase 只有正式專案。2026-09-30 的郵寄宅配測試訂單已在會員與後台核對並取消；歷史庫存與 2 筆既有「待聯絡」訂單仍需人工盤點。
