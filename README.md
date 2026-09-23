# Colormixkoreashop

## 購物流程

- 首頁點商品可直接開啟視窗，選尺寸、顏色和數量並加入購物車；關閉後可繼續挑選。
- `cart.html` 使用既有的 Supabase 會員登入與 `create_order_with_payment` RPC 建立訂單。正式啟用前請在測試環境確認 RPC 的庫存扣除、價格重算及付款條件。
- `admin.html` 保留商品上架／下架、原價和尺寸顏色庫存管理。

## 超商門市電子地圖設定

在 Vercel 的非正式環境設定以下環境變數，並以綠界物流核發的資料測試。請勿把正式特店資料或金鑰寫進 GitHub。

| 名稱 | 說明 |
| --- | --- |
| `ECPAY_LOGISTICS_MERCHANT_ID` | 綠界物流特店編號，未設定時地圖入口會顯示未啟用 |
| `ECPAY_LOGISTICS_MODE` | `C2C`（預設，店到店）或 `B2C`，須與申請的物流類型相同 |
| `ECPAY_LOGISTICS_ENV` | 測試時設為 `stage`；正式環境省略或設為 `production` |
| `ECPAY_PUBLIC_ORIGIN` | 選用；網站對外 HTTPS 網址，供綠界回傳門市結果，例如預覽環境的網址 |

結帳頁經 `/api/store-map` 在原分頁送往綠界地圖；選完門市後 `/api/store-callback` 把門市名稱、代碼和地址帶回購物車，再交給原有的下單 RPC。綠界測試環境會回傳固定測試門市。此串接只負責選店，不會自動建立綠界物流單。
