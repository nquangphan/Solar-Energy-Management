---
baseline_commit: 5076c17d64042069473cfaed9a309a1d2af06c92
---

# Story 6.3: Phiếu nhập/xuất kho + giá vốn + bình quân gia quyền

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền nhập/xuất kho (`inventory.manage` — preset `KHO_GIAO`, `QUAN_LY`, `ADMIN`, `SUPER_ADMIN`),
I want tạo Phiếu kho nhập/xuất cập nhật Tồn thật (`onHand`) và giá vốn (`Product.costPrice`),
so that tồn kho luôn khớp thực tế và lợi nhuận tính đúng.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Đây là đường GHI tồn kho ĐẦU TIÊN của hệ thống

Đã scout (2026-10-21, sau commit `5076c17` của 6.2):

- `backend/src/inventory/` có `inventory.module.ts`, `stock-items.controller.ts`, `stock-items.service.ts` (ĐỌC thuần), `domain/ton-kho.ts` (`tinhTonKho`), `dto/stock-list-*.dto.ts`. **Chưa có** model/route/service phiếu kho nào.
- `schema.prisma`: có `StockItem` (chỉ `onHand`, `productId` UNIQUE, sinh LƯỜI — docstring `:146-158` đã hứa "Đường ghi (phiếu kho) upsert dưới `SELECT … FOR UPDATE`") và `StockMovement` (ledger `reserved`, chưa có đường ghi). **Chưa có** `StockVoucher`/`StockVoucherLine`.
- Source-guard `backend/test/inventory-read-only.spec.ts` phần **(b)** hiện CẤM mọi lệnh ghi Prisma + `$queryRaw` + `$transaction` trong `src/inventory/**`. Docstring của chính guard nói rõ: "Khi đường phiếu kho tới, nới (b) cho đúng những file ghi dưới `SELECT … FOR UPDATE` — KHÔNG xoá (a)". Story này **nới (b) có chủ đích** (Task 6) — đừng xoá guard, đừng để `stock-items.service.ts` ghi được.
- Tồn hiện tại ở production: mọi sản phẩm `onHand = 0` (không có phiếu nào). Sau story này, phiếu nhập là con đường DUY NHẤT làm `onHand` dương.

### 2. Phạm vi — cái gì CỦA 6.3, cái gì KHÔNG

| Việc | Story |
|---|---|
| Phiếu **nhập** (từ nhà cung cấp, tồn đầu kỳ): tăng `onHand`, `unitCost` bắt buộc, cập nhật `Product.costPrice` bằng bình quân gia quyền | **6.3** |
| Phiếu **xuất tự do** (không gắn đơn: hàng hỏng, mẫu, điều chỉnh): giảm `onHand`, `unitCost` = snapshot `Product.costPrice` lúc xuất (server đặt), KHÔNG đổi `costPrice`, KHÔNG đụng `reserved`/`StockMovement` | **6.3** |
| Không cho `onHand` âm (xuất quá tồn ⇒ 409, rollback toàn phiếu) — bất biến toàn vẹn dữ liệu, có CHECK ở DB | **6.3** |
| Xuất **gắn Đơn** (`orderId`, unique một đơn một phiếu, `costPriceSnapshot`, `StockIssued`, trừ `reserved`) | 6.4 |
| Event `StockOutBlocked` + banner chặn UX-DR-19 + chặn ở luồng gắn đơn | 6.5 |
| Ghi `StockMovement` (giữ chỗ lúc chốt) | 6.6 |
| Phiếu **nhập trả** (gắn phiếu xuất gốc, tab "Nhập trả" của mockup) | 6.7 |
| Cảnh báo tồn ở màn báo giá | 6.5 (đã chuyển từ 6.2) |

⇒ `StockVoucher` ở 6.3 **KHÔNG** có cột `orderId`, `status`, `sourceVoucherId` (ERD spine `:321-327` vẽ `orderId`/`status`). 6.4 thêm `orderId` + `status` (nháp → xác nhận) trong migration của nó; 6.7 thêm liên kết phiếu gốc. Phiếu ở 6.3 **có hiệu lực ngay khi lưu** (mockup: "Không sửa/xoá sau khi lưu") — không có trạng thái nháp, không có endpoint sửa/xoá.

### 3. Bình quân gia quyền — MỘT hàm thuần, làm tròn MỘT điểm

`backend/src/inventory/domain/gia-von.ts`:

```
giaVonMoi = onHandTruoc <= 0
  ? donGiaNhap
  : Math.round((onHandTruoc * giaVonTruoc + qtyNhap * donGiaNhap) / (onHandTruoc + qtyNhap))
```

- Tiền integer đồng (AD-10). `Math.round` trên số dương = làm tròn nửa lên. Không float lưu xuống DB.
- `onHandTruoc <= 0` ⇒ bỏ giá vốn cũ: không có hàng cũ nào để "bình quân" (nếu không, một `costPrice` gõ tay từ Story 3.1 trên sản phẩm chưa từng nhập sẽ kéo lệch giá hàng thật đầu tiên). `onHandTruoc < 0` không thể xảy ra (CHECK), nhưng hàm vẫn xử lý `<= 0` chứ không ném.
- Tràn số: `onHand * costPrice` tối đa cỡ 1e6 × 2.1e9 ≈ 2e15 < `Number.MAX_SAFE_INTEGER` (9e15) — DTO giới hạn `qty ≤ 1_000_000`, `unitCost ≤ 2_147_483_647` (Int32 của cột `cost_price`). Ghi chú trong docstring hàm.
- Phiếu xuất KHÔNG gọi hàm này: xuất không đổi giá vốn bình quân.
- Fixture số trong test **in ra bằng cách chạy hàm thật**, không nhẩm (memory `handpicked-fixture-numbers-hide-formula-bugs`). Ca mẫu: `10 @ 2_000_000 + 40 @ 2_110_000 ⇒ 2_088_000`; `1 @ 100 + 1 @ 101 ⇒ 101` (nửa lên); `3 @ 100 + 1 @ 101 ⇒ 100`; `0 @ 999 + 5 @ 300 ⇒ 300`.

### 4. Khoá: `SELECT … FOR UPDATE` trên dòng `products`, theo thứ tự `id`, là op ĐẦU TIÊN của tx

Luật dự án (2): mọi thao tác tồn kho khoá `FOR UPDATE` trong transaction + có test lane DB.

- Khoá dòng **`products`** (luôn tồn tại), KHÔNG khoá `stock_items` (sinh lười — dòng có thể chưa có, `FOR UPDATE` trên tập rỗng không khoá gì ⇒ hai phiếu nhập đầu tiên cùng sản phẩm cùng `upsert`, một bên P2002 ⇒ 500). Khuôn: `product-prices.service.ts:100`, `orders.service.ts:472` (`lockOrderRow`).
- Một phiếu nhiều sản phẩm ⇒ khoá TẤT CẢ trong MỘT câu, sắp `ORDER BY id` (hai phiếu chéo sản phẩm A,B / B,A không deadlock): `` tx.$queryRaw`SELECT id FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE` `` — `products.id` là `text`; kiểm trên Postgres thật rằng tham số mảng bind đúng (lane DB). Số dòng trả về ≠ số `productId` khác nhau ⇒ 404 `NOT_FOUND` (sản phẩm không tồn tại), rollback.
- **Hợp đồng chéo story (ghi vào docstring service + schema):** MỌI đường ghi tồn (6.4 xuất gắn đơn, 6.6 giữ chỗ, 6.7 nhập trả) lấy CÙNG khoá này, cùng thứ tự. Khoá một phía là vô nghĩa (bài học `orders.service.ts:113-117`).
- Đọc `stockItem.onHand` + `product.costPrice` SAU khoá, trong cùng tx; tính; ghi. Interactive `$transaction(async (tx) => …)` — KHÔNG dạng mảng (cần đọc-rồi-ghi).
- Publish event **SAU commit** (AD-18; khuôn `customer-sources.service.ts`, `orders.service.ts`). Test phải CHẠY thân tx rồi mới ném (memory `mock-rejected-transaction-false-green`).
- Hệ quả cho 6.2: đường đọc `GET /stock-items` đọc `onHand` và `reserved` bằng hai câu (ghi nhận ở review 6.2). Story này chỉ ghi `onHand` (không ghi movement) ⇒ không thể đọc xé. Đừng "sửa" đường đọc ở story này.

### 5. Không bao giờ `onHand < 0` — hai lớp

1. Service: xuất `qty > onHand` (vắng dòng `stock_items` ⇒ `onHand = 0`) ⇒ `AppException(ErrorCode.CONFLICT, 409, 'Không đủ tồn — không thể xuất quá số tồn hiện có.', …, fieldErrors)` với mỗi dòng thiếu một `fieldError { field: 'lines[i].qty', code: 'INSUFFICIENT_STOCK', message: 'Còn {onHand} {donVi}, không xuất được {qty}.' }`. Kiểm TRƯỚC mọi lệnh ghi; ném trong tx ⇒ rollback toàn phiếu (không phiếu, không dòng nào đổi). Câu chữ khớp UX-DR-19/epics 6.5 để 6.5 chỉ thêm event + banner, không viết lại.
2. DB: migration thêm tay `ALTER TABLE stock_items ADD CONSTRAINT stock_items_on_hand_non_negative CHECK (on_hand >= 0)` (+ `stock_voucher_lines_qty_positive CHECK (qty > 0)`, `stock_voucher_lines_unit_cost_non_negative CHECK (unit_cost >= 0)`). Prisma không mô hình hoá CHECK ⇒ chỉ nằm trong `migration.sql`, ghi một dòng `///` ở model giải thích. Lane DB chứng minh CHECK đứng được một mình (UPDATE thô `on_hand = -1` ⇒ lỗi) — memory `mutation-hits-one-layer-only`: đột biến gỡ kiểm ở service phải ĐỎ ở unit, còn lane DB đỏ nhờ CHECK.

**KHÔNG** publish `StockOutBlocked` ở đây (6.5 sở hữu, gắn luồng xuất có đơn). Không thêm mã vào `ErrorCode` chung (file đó cấm mã domain — `error-code.ts:9-11`); `INSUFFICIENT_STOCK` chỉ là `fieldErrors[].code`, khai hằng ở `inventory/domain/`.

### 6. Giá vốn & quyền `costs.view` — GHI được, ĐỌC bị lọc

- `KHO_GIAO` có `inventory.manage` nhưng **không** có `costs.view` (`role-presets.ts:107`). AC đòi `unitCost` bắt buộc khi nhập ⇒ người gõ phiếu PHẢI ghi được giá vốn.
- **Quyết định:** `POST /stock-vouchers` nhận `unitCost` từ người có `inventory.manage`, KHÔNG đòi `costs.view` (phiếu nhập là "một chỗ gõ" duy nhất — PRD FR-37 `prd.md:481`). Khác `ProductsService.assertMayWriteCostPrice` (sửa danh mục cần `costs.view`) — có chủ đích, ghi vào docstring controller.
- **ĐỌC** (POST response, GET detail): `unitCost` VẮNG MẶT HẲN (không phải `null`/`0`) khi caller thiếu `costs.view` — khuôn `stripCostPrice` (`catalog/domain/product-visibility.ts`) + `canViewCosts` resolve tươi qua `AccountPermissionsService` (`products.controller.ts:47-67`). Response KHÔNG BAO GIỜ trả `Product.costPrice` mới (kể cả với người có `costs.view` — xem ở danh mục).
- Audit event mang ĐỦ `unitCost` + `costPrice` trước/sau (audit ghi sự thật, `audit.read` gate người xem — khuôn `products.service.ts:58`).
- **Không đổi** `ProductsService`: sửa tay `costPrice` ở danh mục vẫn được (Story 3.1, cần `costs.view`) — ghi vào Câu hỏi mở.

### 7. Product hợp lệ cho phiếu

- Nhập: `tracksStock = true` VÀ `isActive = true`; khác ⇒ 409 `CONFLICT` + `fieldErrors[{ field: 'lines[i].productId', code: 'PRODUCT_NOT_STOCKABLE' }]` (công lắp không có tồn; sản phẩm đã ẩn không nhập mới).
- Xuất: chỉ cần `onHand` đủ (sản phẩm đã ẩn/đổi cờ mà còn hàng thật VẪN xuất được — khớp luật tập hiển thị của 6.2 "hàng thật không được biến mất").
- Một phiếu không được lặp `productId` ⇒ 400 `VALIDATION_ERROR` (`fieldErrors[{ field: 'lines', code: 'DUPLICATE_PRODUCT' }]`) — kiểm ở DTO/service TRƯỚC tx; DB có `@@unique([stockVoucherId, productId])` làm lưới.

### 8. Picker sản phẩm trên form = `InventoryPort.listStock` (tái dùng, KHÔNG endpoint mới)

`KHO_GIAO` KHÔNG có `catalog.view` ⇒ không gọi được `GET /products` (`CatalogPort`). `GET /stock-items?q=` (6.2) đã gate `inventory.manage OR quotes.create_edit`, trả `productId/ten/sku/donVi/onHand` cho mọi sản phẩm `tracksStock && isActive` + mọi sản phẩm còn tồn ⇒ đủ làm nguồn picker. Form nhận CẢ HAI port (`StockVouchersPort` ghi/đọc phiếu + `InventoryPort` picker). Client KHÔNG so `qty` với `onHand` để chặn (AD-2) — có thể HIỂN THỊ "Còn N" cạnh dòng xuất (số backend trả), quyết định chặn là của backend.

### 9. Port mới tách riêng — đừng thêm động từ ghi vào `InventoryPort`

`design-system/screens/inventory.test.mjs:163` cấm `create|update|save|delete|post` trên `inventory-port`. Đó là bất biến ĐÚNG (màn Tồn kho đọc thuần). Tạo cặp twin mới `stock-vouchers-port.ts` ↔ `stock_vouchers_port.dart` (+ fake). KHÔNG nới guard 6.2.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:569-575`)

- **Given** một Phiếu kho, **When** tạo nhập/xuất, **Then** entity `StockVoucher` + `StockVoucherLine`; nhập tăng tồn, xuất giảm tồn on-hand (FR-25, §2).
- **Given** tạo phiếu nhập kho, **When** nhập, **Then** `StockVoucherLine.unitCost` **bắt buộc** (giá nhập đơn vị, integer đồng); sau khi lưu phiếu, hệ thống tự tính **bình quân gia quyền** → cập nhật `Product.costPrice` (một chỗ gõ, không phải nhớ sửa hai nơi) (§4).
- **Given** tồn đầu kỳ, **When** triển khai, **Then** user gõ một phiếu nhập tồn đầu kỳ lúc go-live; nếu quên, báo cáo lợi nhuận tháng đầu rỗng (§4).
- **Given** mỗi Phiếu kho, **When** lưu, **Then** ghi Audit (ai/khi nào/số lượng/sản phẩm) qua event (FR-25, AD-18).

### AC dẫn xuất (đo được)

1. **Schema + migration** `backend/prisma/migrations/<ts>_add_stock_vouchers/` (timestamp > `20261021080000`):
   - `stock_vouchers`: `id` uuid PK; `seq` Int UNIQUE `autoincrement` (số phiếu hiển thị); `type` Text NOT NULL (`'nhap' | 'xuat'`); `note` Text NULL; `created_by_account_id` FK → `accounts` RESTRICT; `created_at`. Index `created_at`.
   - `stock_voucher_lines`: `id` uuid PK; `stock_voucher_id` FK → `stock_vouchers` RESTRICT; `product_id` FK → `products` RESTRICT; `qty` Int NOT NULL (LUÔN dương — chiều do `type` quyết); `unit_cost` Int NOT NULL; UNIQUE `(stock_voucher_id, product_id)`; index `product_id`.
   - CHECK thêm tay: `stock_items.on_hand >= 0`, `stock_voucher_lines.qty > 0`, `stock_voucher_lines.unit_cost >= 0`.
   - KHÔNG cột `order_id`/`status` (🛑2). Quan hệ ngược `Product.voucherLines`, `Account.stockVouchersCreated`.
   - `prisma validate` + `generate` xanh; `migrate deploy` lên Postgres local cổng 5433 sạch. Guard (a) "không cột reserved ở model nào" vẫn xanh.
2. **Domain thuần** `backend/src/inventory/domain/gia-von.ts`: `tinhGiaVonBinhQuan({ onHandTruoc, giaVonTruoc, qtyNhap, donGiaNhap }) → number` (🛑3) + `maPhieu(type, seq) → string` (`'PK-N-0119'` / `'PK-X-0096'`, pad 4, quá 9999 thì không cắt). Là NƠI DUY NHẤT tính giá vốn bình quân và mã phiếu. Unit test: 4 ca 🛑3 + `qtyNhap` lớn biên tràn + mã phiếu hai loại + seq 5 chữ số.
3. **`POST /stock-vouchers`** (gate `@RequirePermissions(PERM.inventoryManage)`), body `{ type: 'nhap'|'xuat', note?: string (trim, ≤ 500), lines: [{ productId: uuid, qty: int 1..1_000_000, unitCost?: int 0..2_147_483_647 }] (1..100 dòng) }`:
   - `type='nhap'`: mọi dòng PHẢI có `unitCost` ⇒ thiếu ⇒ 400 `VALIDATION_ERROR` field `lines[i].unitCost`. `type='xuat'`: dòng có `unitCost` ⇒ 400 (server tự snapshot — client không được gửi giá vốn xuất).
   - Lặp `productId` ⇒ 400 (🛑7). Sản phẩm không tồn tại ⇒ 404. Nhập sản phẩm `tracksStock=false`/`isActive=false` ⇒ 409 `PRODUCT_NOT_STOCKABLE`. Xuất quá tồn ⇒ 409 `INSUFFICIENT_STOCK` (🛑5).
   - Thành công ⇒ 201 `StockVoucherDetailDto` (AC-5). Một tx: khoá (🛑4) → đọc → kiểm → `stockItem.upsert` (tạo lười) với `onHand` mới → nhập: `product.update({ costPrice })` theo `tinhGiaVonBinhQuan` (tính tuần tự theo dòng — mỗi sản phẩm một dòng nên không chồng) → `stockVoucher.create` kèm `lines` (xuất: `unitCost = product.costPrice` lúc xuất). Không ghi `StockMovement`.
4. **Event `StockVoucherCreated`** (`backend/src/inventory/domain/stock-voucher-events.ts`, khuôn `customer-source-events.ts`): `type='StockVoucherCreated'`, `actorAccountId`, `target { type: 'StockVoucher', id }`, `after { id, ma, type, note, lines: [{ productId, qty, unitCost, onHandTruoc, onHandSau, giaVonTruoc, giaVonSau }] }`, `occurredAt`. Publish đúng MỘT lần, SAU commit (`toHaveBeenCalledTimes(1)` — memory `publish-count-unasserted-duplicate-survives`); tx lỗi ⇒ 0 event (mock CHẠY thân tx rồi ném). `AuditSubscriber` ghi `AuditLog` — không gọi `AuditService` trực tiếp (guard `no-direct-side-effect-outside-eventbus`).
5. **`GET /stock-vouchers?type=nhap|xuat`** (gate `inventory.manage`) ⇒ `200 { items: StockVoucherSummaryDto[] }`, mới nhất trước (`createdAt desc, seq desc`), tối đa 100 phiếu (không phân trang ở Phase 1 — Câu hỏi mở). `Summary = { id, ma, type, createdAt, nguoiTao: { id, displayName }, soDong, tongSoLuong }` (`soDong`/`tongSoLuong` backend đếm). `type` sai ⇒ 400.
   **`GET /stock-vouchers/:id`** (`ParseUUIDPipe`) ⇒ `StockVoucherDetailDto = Summary + { note, lines: [{ productId, ten, sku, donVi, qty, unitCost? }] }`; không thấy ⇒ 404. `unitCost` vắng mặt khi thiếu `costs.view` (🛑6) — ở cả POST response.
6. **Tồn đầu kỳ:** không có cờ/loại riêng — là một phiếu `nhap` bình thường, `note` gợi ý "Tồn đầu kỳ". Form web+mobile có nút gợi ý điền nhanh `note = 'Tồn đầu kỳ'` (chip, chỉ điền chữ). Viết `docs/van-hanh-go-live.md` (mới, ngắn): bước "gõ phiếu nhập tồn đầu kỳ cho mọi sản phẩm còn hàng, giá vốn = giá mua thực tế; quên ⇒ báo cáo lợi nhuận tháng đầu rỗng vì đơn chưa có giá vốn" + ai làm (người có `inventory.manage`).
7. **Lane DB** `backend/test/stock-vouchers.db.integration.spec.ts` (Postgres 5433; khuôn `stock-items.db.integration.spec.ts`; tự dựng/dọn fixture):
   - Nhập lần đầu sản phẩm chưa có `stock_items` ⇒ tạo dòng, `onHand = qty`, `costPrice = unitCost` (bỏ `costPrice` cũ gõ tay).
   - Nhập lần hai ⇒ `onHand` cộng dồn, `costPrice` = bình quân (số in từ `tinhGiaVonBinhQuan`).
   - Xuất ⇒ `onHand` giảm, `costPrice` KHÔNG đổi, dòng phiếu xuất `unit_cost` = `costPrice` lúc xuất; `stock_movements` không thêm dòng; `GET /stock-items` (service 6.2) phản ánh `onHand` mới.
   - Xuất quá tồn (phiếu 2 dòng: một đủ, một thiếu) ⇒ 409, KHÔNG phiếu nào được tạo, `onHand` cả hai sản phẩm giữ nguyên (rollback toàn phiếu).
   - CHECK đứng một mình: `UPDATE stock_items SET on_hand = -1` thô ⇒ lỗi (assert message chứa tên constraint — memory `prisma7-p2003-only-on-insert`: assert message, không assert mã).
   - **Khoá — xen kẽ ÉP BUỘC, không `Promise.all` tự do** (memory `atomic-replace-needs-for-update-lock`): tx A (thô trong test) `SELECT … FROM products WHERE id = $1 FOR UPDATE`, rồi `UPDATE stock_items SET on_hand = on_hand + 5` + `UPDATE products SET cost_price = …`, GIỮ chưa commit; gọi `service.taoPhieu` nhập B cùng sản phẩm (chưa await); commit A; await B ⇒ `onHand` cuối = gốc + 5 + qtyB **và** `costPrice` = bình quân tính trên trạng thái SAU A. Đột biến gỡ khoá khỏi service ⇒ ca này ĐỎ (phải chứng minh; nếu dev dùng `increment` cho `onHand` thì assert `costPrice` là chỗ đỏ).
   - Hai phiếu chéo sản phẩm (A,B) và (B,A) chạy đồng thời ⇒ cả hai thành công, không deadlock (khoá `ORDER BY id`).
   - Tham số mảng `= ANY(${ids})` bind đúng trên adapter pg (ca 3 sản phẩm).
   - `seq` tăng dần; FK RESTRICT: xoá `products` có dòng phiếu ⇒ lỗi.
8. **Unit (mock Prisma)** `backend/test/stock-vouchers.service.spec.ts`: thứ tự op — `$queryRaw` khoá là lệnh ĐẦU TIÊN trên `tx`, trước mọi `findMany`/`upsert`/`update`/`create`; xuất thiếu ⇒ không lệnh ghi nào được gọi; `type='xuat'` không gọi `product.update`; event 1 lần sau commit, 0 lần khi commit lỗi (mock chạy thân rồi ném); payload event đủ `onHandTruoc/Sau`, `giaVonTruoc/Sau`. Controller/visibility: thiếu `costs.view` ⇒ JSON không có key `unitCost` (assert `not.toHaveProperty`).
9. **E2E** `backend/test/stock-vouchers.e2e.spec.ts` (`initAppOnLoopback` — luật (6)): 201 `KHO_GIAO` (body không có `unitCost`), 201 `QUAN_LY` (có `unitCost`); 403 `THO_KS` (có `quotes.create_edit` nhưng không `inventory.manage` — POST lẫn GET); 401 không token; 400 qua `ValidationPipe`: thiếu `unitCost` khi nhập, có `unitCost` khi xuất, `qty: 0`, `qty: 1.5`, `lines: []`, `productId` không phải UUID, lặp `productId`, `type: 'nhaptra'`; 409 xuất quá tồn có `fieldErrors[0].code === 'INSUFFICIENT_STOCK'` (mã HTTP chỉ đo ở e2e — memory `dev-pins-ac-deviation-as-green-test`); `GET /stock-vouchers/khong-phai-uuid` ⇒ 400; uuid lạ ⇒ 404.
10. **Source-guard** — `inventory-read-only.spec.ts` (b) NỚI (Task 6): lệnh ghi Prisma/`$queryRaw`/`$transaction` trong `src/inventory/**` CHỈ được phép ở `stock-vouchers.service.ts`; file đó PHẢI chứa `FOR UPDATE` và `$transaction(async`; `stock-items.service.ts` vẫn đọc thuần. Chống rỗng: tập quét gồm cả hai service; bộ dò vẫn bắt mẫu ghi giả. (a) giữ nguyên. Guard sẵn có xanh: `no-handler-without-require-permissions`, `naming-convention`, `no-permission-literal-outside-registry`, `no-direct-side-effect-outside-eventbus`, `audit-log-append-only`, `no-stock-write-in-cancel`, `no-unscoped-order-write`.
11. **OpenAPI** sinh lại (`npm run openapi:gen`), `openapi.json` commit, `openapi-drift.spec.ts` xanh. `unitCost` khai `@ApiPropertyOptional` + mô tả "vắng mặt khi thiếu costs.view" (khuôn `product-response.dto.ts:8-37`).
12. **Web màn Phiếu kho** `web/src/screens/inventory/StockVouchersScreen.tsx` (+ `stock-vouchers.css` chỉ khi cần; mọi className có rule thật): `WebShell` + `Sidebar activeKey="inventory"` + `Topbar eyebrow="KHO" title="Phiếu kho" actionLabel="Tạo phiếu"` (mockup `s-stock-vouchers`). Thanh lọc `Tất cả | Nhập | Xuất` (KHÔNG có "Nhập trả" — 6.7). Lưới 2 cột: `Frame` "Danh sách phiếu" chứa `Table` `Phiếu | Loại | Ngày | Người` (mã `mono`, chip `Nhập` ok / `Xuất` warn, ngày `dd/MM` giờ UTC+7); bấm dòng ⇒ thẻ "Chi tiết phiếu": `Loại`, `Ngày` (`dd/MM/yyyy · HH:mm`), `Người tạo`, `Ghi chú`, bảng dòng `Sản phẩm | SL | Giá vốn / đv` — SL `+N` (nhập) / `−N` (xuất) ghép CHUỖI từ `type` (không phép trừ), cột giá vốn CHỈ render khi dòng có `unitCost` (field vắng ⇒ không cột, không "0"). Notecard nhập: "Giá vốn ở đây không được bỏ trống. Hệ thống lấy nó tính bình quân gia quyền rồi cập nhật giá vốn hiện hành của sản phẩm — một chỗ gõ, không ai phải nhớ sửa hai nơi."; notecard xuất: "Phiếu xuất không gắn đơn (hàng hỏng, mẫu, điều chỉnh). Không sửa/xoá sau khi lưu.".
    - **Form tạo phiếu** trong `Sheet` (component sẵn có): chọn loại Nhập/Xuất; `Field` ghi chú + chip "Tồn đầu kỳ" (AC-6); dòng sản phẩm: ô tìm (gọi `inventoryPort.listStock({ q })`, vé `latest` chống trả lời cũ — khuôn `InventoryScreen.tsx`), chọn ⇒ thêm dòng `ten · Còn {onHand} {donVi}`; `SL` số nguyên; `Giá vốn / đv *` chỉ khi Nhập (số nguyên đồng, chỉ parse chữ số — không float). Nút "Lưu phiếu" disabled khi đang gửi (chống double-submit). Lỗi 400/409: hiện `message` trong `Banner` danger + `fieldErrors` dưới đúng dòng (map `lines[i].*`). Thành công ⇒ đóng sheet, tải lại danh sách, chọn phiếu mới.
    - Loading `Skeleton`, Error `ErrorState` + "Thử lại", Empty `EmptyState` "Chưa có phiếu kho nào. Bấm Tạo phiếu để bắt đầu." (EXPERIENCE.md:118); lọc rỗng: "Không có phiếu nào thuộc loại này.".
    - Client KHÔNG tính: không `qty * unitCost`, không tổng tiền, không bình quân, không so `qty` với `onHand`.
13. **Lối vào từ Tồn kho:** `InventoryScreen` (web) thêm prop tuỳ chọn `onOpenVouchers?: () => void`; khi có prop VÀ caller có `inventory.manage` ⇒ `Topbar` action "Phiếu kho". Mobile `inventory_screen.dart` tương tự (`onOpenVouchers` + `AppTopbar` action). Không có router ⇒ chỉ callback. Text-guard 6.2 phải vẫn xanh.
14. **Mobile màn Phiếu kho** `mobile/lib/screens/inventory/stock_vouchers_screen.dart` (StatefulWidget, port qua constructor, khuôn `inventory_screen.dart`): `AppPhoneFrame > AppMobileShell(topbar: AppTopbar(eyebrow: 'KHO', title: 'Phiếu kho', action: tạo phiếu), bottomNav: AppBottomNav(activeIndex: kInventoryTabIndex))`; `AppFrame` "Gần đây" — mỗi phiếu một hàng: mã `mono` + `AppChip` loại + `tongSoLuong` `+N`/`−N` canh phải + dòng micro `nguoiTao · ngày`; bấm ⇒ `AppCard` chi tiết (dòng sản phẩm + SL; giá vốn chỉ khi có). Form tạo phiếu trong `AppSheet` cùng trường/câu chữ/luật lỗi như web. Loading/Error/Empty = `AppSkeleton`/`AppErrorState(onRetry)`/`AppEmptyState` cùng câu chữ.
15. **Port + fake hai nền tảng:** `web/src/design-system/session/stock-vouchers-port.ts` + `fake-stock-vouchers-port.ts` (export `index.ts`); `mobile/lib/design_system/session/stock_vouchers_port.dart` + `fake_stock_vouchers_port.dart` (export `session.dart`). Ba method: `listVouchers({ type? })`, `getVoucher(id)`, `createVoucher(input)`; lỗi reject bằng envelope AD-5 (khuôn `CustomerPortError`). Kiểu mirror DTO từng chữ (đối chiếu `openapi.json`, không chỉ parity hai client). Fake: đủ nhập + xuất, một phiếu không `unitCost` (người thiếu `costs.view`), một sản phẩm tên DÀI NHẤT; `createVoucher` fake có nhánh trả 409 `INSUFFICIENT_STOCK` để test UI lỗi. Thêm cặp vào twin map `design-system/session/parity.test.mjs:23-46` + assert ba chữ ký method khớp + mọi field kiểu có mặt hai bên.
16. **Test FE:** web — ca `StockVouchersScreen` trong `web/src/test/screens-render.test.tsx` (`SCREEN_COUNT` 14 → 15, `:206`); `web/src/test/stock-vouchers-screen.test.tsx` (vitest+jsdom, khuôn `inventory-screen.test.tsx`): chọn phiếu hiện chi tiết; dòng không `unitCost` ⇒ không cột giá vốn và không chuỗi "0"; tạo phiếu nhập gửi đúng payload (`unitCost` integer); chọn Xuất ⇒ ô giá vốn biến mất và payload KHÔNG có `unitCost`; 409 ⇒ thông điệp + lỗi đúng dòng; nút Lưu disabled khi đang gửi (gọi port đúng 1 lần khi bấm 2 lần). `cd web && npm run typecheck && npm test && npm run build` xanh (luật (3)). Mobile — `mobile/test/screens/inventory/stock_vouchers_screen_test.dart`: loading/error+Thử lại/empty/có dữ liệu; chi tiết không `unitCost`; form Nhập↔Xuất ẩn ô giá vốn; 409 hiện lỗi; `for width in [320, 360]` với tên sản phẩm DÀI NHẤT ⇒ `tester.takeException()` null (khuôn `order_detail_long_status_test.dart:82-115`) (luật (4)). Widget test bật đủ điều kiện bao ngoài (memory `widget-test-gate-unreachable-outer-condition`). `flutter analyze` + `flutter test` xanh.
17. **Text-guard** `design-system/screens/stock-vouchers.test.mjs` (khuôn `inventory.test.mjs`) trên code đã strip comment của màn web+mobile+port+fake: cấm nhân/chia trên `qty`/`unitCost`/`costPrice` (không thành tiền, không bình quân ở client); cấm so `qty` với `onHand` (`qty >`/`> onHand`…); cấm hex/`Color(0x`; cấm `costPrice` xuất hiện trong port (port không bao giờ mang giá vốn sản phẩm); bắt buộc dùng `Table|Frame|Sheet|EmptyState|ErrorState|Skeleton` (web) và `AppFrame|AppCard|AppSheet|AppChip|AppEmptyState|AppErrorState|AppSkeleton` (mobile); `assertCodeNotBlind(...)` chống rỗng + mẫu tự kiểm cho mỗi luật cấm (luật (5)). `cd design-system && npm test` xanh.

---

## Tasks / Subtasks

- [x] **Task 1 — Schema + migration (AC: 1)**
  - [x] `model StockVoucher`, `model StockVoucherLine` cạnh `StockMovement` trong `backend/prisma/schema.prisma`; quan hệ ngược `Product.voucherLines`, `Account.stockVouchersCreated` (relation name tường minh, khuôn `"QuoteExportCreatedBy"`). Docstring Việt: hiệu lực ngay khi lưu, không sửa/xoá; `qty` luôn dương, chiều theo `type`; `unitCost` nhập = người gõ, xuất = snapshot; 6.4 thêm `orderId`/`status`, 6.7 thêm phiếu gốc; CHECK chỉ có trong SQL; khoá `products FOR UPDATE ORDER BY id` là hợp đồng mọi đường ghi tồn.
  - [x] SQL offline: `npx prisma migrate diff --from-schema <schema cũ> --to-schema prisma/schema.prisma --script` (Prisma 7 — memory `prisma7-migrate-diff-flag-rename`), rồi THÊM TAY 3 `CHECK`. Đọc lại SQL: FK RESTRICT, unique, sequence `seq`.
  - [x] `npx prisma validate && npx prisma generate`; `npx prisma migrate deploy` lên Postgres local (`pns-postgres`, cổng 5433; tắt ⇒ `docker start pns-postgres`; daemon không lên từ shell ⇒ ghi "lane DB chưa chạy", KHÔNG đánh `[x]` — memory `db-lane-needs-docker-desktop-gui`). KHÔNG ghi lên DB nào khác.
- [x] **Task 2 — Domain (AC: 2, 4)** — `inventory/domain/gia-von.ts` (`tinhGiaVonBinhQuan`, `maPhieu`, hằng `INSUFFICIENT_STOCK`/`PRODUCT_NOT_STOCKABLE`/`DUPLICATE_PRODUCT`), `inventory/domain/stock-voucher-events.ts` (`StockVoucherCreated`, snapshot kiểu domain thuần, không type Prisma); `backend/test/gia-von.spec.ts`.
- [x] **Task 3 — Service + controller + DTO (AC: 3, 5, 8)**
  - [x] DTO `inventory/dto/create-stock-voucher-request.dto.ts` (`@IsIn(['nhap','xuat'])`, `@ValidateNested({ each }) @Type`, `@ArrayMinSize(1) @ArrayMaxSize(100)`, `@IsInt @Min @Max`; luật `unitCost` theo `type` bằng `@ValidateIf` hoặc custom validator để lỗi rơi đúng `fieldErrors` qua `ValidationPipe` — kiểm đường field lồng `lines.0.unitCost` mà error envelope sinh ra, ghi đúng chuỗi đó vào test), `stock-voucher-list-query.dto.ts`, `stock-voucher-response.dto.ts` (`Summary`, `Detail`, `Line`, `type` `@ApiProperty({ enum })`).
  - [x] `inventory/stock-vouchers.service.ts`: `taoPhieu(dto, actorAccountId)`, `lietKePhieu({ type })`, `chiTietPhieu(id)`. 🛑4 thứ tự op; lỗi domain ném TRONG tx; publish SAU commit; trả kiểu domain đầy đủ (`unitCost` có mặt) — lọc ở controller.
  - [x] `inventory/stock-vouchers.controller.ts` `@ApiTags('inventory') @ApiBearerAuth() @Controller('stock-vouchers')`: `@Post()` / `@Get()` / `@Get(':id')` đều `@RequirePermissions(PERM.inventoryManage)`; `canViewCosts` qua `AccountPermissionsService` (khuôn `products.controller.ts:47-67`; `AccountsModule` export `AccountPermissionsService` (`accounts.module.ts:13`) nhưng KHÔNG `@Global` ⇒ `InventoryModule` phải `imports: [AccountsModule]` (khuôn `catalog.module.ts:28`) và sửa docstring "imports RỖNG" của module); hàm lọc `unitCost` (domain thuần, khuôn `stripCostPrice`). `@ApiCreatedResponse/@ApiOkResponse/@ApiBadRequestResponse/@ApiForbiddenResponse/@ApiNotFoundResponse/@ApiConflictResponse` với `ErrorEnvelopeDto`. Controller không dựng envelope.
  - [x] Đăng ký controller + service vào `inventory.module.ts`.
  - [x] `backend/test/stock-vouchers.service.spec.ts` + ca visibility.
- [x] **Task 4 — E2E + lane DB (AC: 7, 9)** — `stock-vouchers.e2e.spec.ts`, `stock-vouchers.db.integration.spec.ts` (tên `*.db.integration.spec.ts` để `testPathIgnorePatterns` loại khỏi `npm test` — memory `describe-skip-does-not-separate-test-lane`). `npm run test:db`.
- [x] **Task 5 — OpenAPI (AC: 11)** — `npm run openapi:gen`, commit `backend/openapi/openapi.json`.
- [x] **Task 6 — Nới guard (AC: 10)** — sửa `inventory-read-only.spec.ts` (b) + docstring (bỏ chữ "TẠM THỜI", ghi luật mới). Đột biến bằng `cp` backup (KHÔNG `git checkout` — memory `mutation-test-never-git-checkout`), mutant phải compile: (i) thêm `this.prisma.stockItem.update(...)` vào `stock-items.service.ts` ⇒ ĐỎ; (ii) xoá `FOR UPDATE` khỏi chuỗi khoá ⇒ ĐỎ; (iii) đổi `$transaction(async` sang dạng mảng ⇒ ĐỎ.
- [x] **Task 7 — Web (AC: 12, 13, 15, 16)**
  - [x] `stock-vouchers-port.ts` + `fake-stock-vouchers-port.ts` + export.
  - [x] `StockVouchersScreen.tsx` (+ css); `InventoryScreen.tsx` prop `onOpenVouchers`.
  - [x] Ca render + `SCREEN_COUNT` 15; `stock-vouchers-screen.test.tsx`; ba lệnh web. Memory `web-tsx-syntax-error-passes-all-lanes`: typecheck phải chạy thật.
- [x] **Task 8 — Mobile (AC: 13, 14, 15, 16)** — port + fake + export; `stock_vouchers_screen.dart`; `inventory_screen.dart` `onOpenVouchers`; widget test. Format chỉ file mình viết hoặc `dart format -o none` (memory `dart-format-writes-files-cascade`). `flutter analyze && flutter test`.
- [x] **Task 9 — Parity + text-guard (AC: 15, 17)** — `parity.test.mjs`, `design-system/screens/stock-vouchers.test.mjs`. Đột biến: chèn `line.qty * line.unitCost` vào màn web ⇒ ĐỎ; mobile `if (qty > item.onHand)` ⇒ ĐỎ; làm rỗng input guard ⇒ ĐỎ. `cd design-system && npm test`.
- [x] **Task 10 — Docs (AC: 6)** — `docs/van-hanh-go-live.md` (mới); `ARCHITECTURE-SPINE.md` ERD `STOCK_VOUCHER` thêm `seq`, `note`, `createdByAccountId`, chú thích "`orderId`/`status` thêm ở luồng xuất gắn đơn"; `STOCK_VOUCHER_LINE.qty` "luôn dương, chiều theo type". Không sửa mockup, `prd.md`, `epics.md`.
- [x] **Task 11 — Cổng cuối** — `cd backend && npm test` + `npm run test:db` + `npx tsc --noEmit`; lint: baseline đỏ sẵn (~164 problems — memory `backend-lint-red-at-baseline`), chỉ eslint/prettier file mình viết; web 3 lệnh; mobile 2 lệnh; design-system `npm test`. Ghi số suite/test từng lane + bảng đột biến → suite đỏ vào Completion Notes.

---

## Dev Notes

### Files sẽ đổi

| File | Loại |
|---|---|
| `backend/prisma/schema.prisma` | UPDATE — 2 model + quan hệ ngược `Product`, `Account` |
| `backend/prisma/migrations/<ts>_add_stock_vouchers/migration.sql` | NEW (diff + CHECK thêm tay) |
| `backend/src/inventory/{stock-vouchers.controller,stock-vouchers.service}.ts` | NEW |
| `backend/src/inventory/domain/{gia-von,stock-voucher-events}.ts` | NEW |
| `backend/src/inventory/dto/{create-stock-voucher-request,stock-voucher-list-query,stock-voucher-response}.dto.ts` | NEW |
| `backend/src/inventory/inventory.module.ts` | UPDATE |
| `backend/openapi/openapi.json` | UPDATE (sinh) |
| `backend/test/{gia-von,stock-vouchers.service,stock-vouchers.e2e,stock-vouchers.db.integration}.spec.ts` | NEW |
| `backend/test/inventory-read-only.spec.ts` | UPDATE (nới (b)) |
| `web/src/design-system/session/{stock-vouchers-port,fake-stock-vouchers-port}.ts`, `index.ts` | NEW / UPDATE |
| `web/src/screens/inventory/StockVouchersScreen.tsx` (+ `stock-vouchers.css`), `InventoryScreen.tsx` | NEW / UPDATE |
| `web/src/test/{screens-render.test.tsx, stock-vouchers-screen.test.tsx}` | UPDATE / NEW |
| `mobile/lib/design_system/session/{stock_vouchers_port,fake_stock_vouchers_port}.dart`, `session.dart` | NEW / UPDATE |
| `mobile/lib/screens/inventory/{stock_vouchers_screen,inventory_screen}.dart` | NEW / UPDATE |
| `mobile/test/screens/inventory/stock_vouchers_screen_test.dart` | NEW |
| `design-system/session/parity.test.mjs`, `design-system/screens/stock-vouchers.test.mjs` | UPDATE / NEW |
| `docs/van-hanh-go-live.md`, `ARCHITECTURE-SPINE.md` | NEW / UPDATE |

**Không đổi:** `stock-items.service.ts` (đọc thuần), `orders/**` (đặc biệt `huyDon()` — guard `no-stock-write-in-cancel` + `no-unscoped-order-write` xanh; story không ghi đơn, không đọc đơn), `permission-registry.ts`, `role-presets.ts`, `permissions.json` (dùng key sẵn có `inventory.manage`, `costs.view`), `catalog/**` (`ProductsService` vẫn sửa `costPrice` được), `StockMovement` (không ghi), `ErrorCode` chung, `Sidebar.tsx` (mục `inventory` đã có từ 6.2 — Phiếu kho là màn con của Kho, không thêm mục sidebar), `PERM`/`AppPerm` (đã có `inventoryManage`; nếu web cần `costsView` để quyết hiển thị — KHÔNG cần: hiển thị theo field có/vắng).

### Hiện trạng phải giữ

- `StockItem` sinh LƯỜI: tạo bằng `upsert` trong đường phiếu (sau khoá `products`) — không seed, không hook tạo sản phẩm.
- `reserved = SUM(StockMovement.qty)` — phiếu ở 6.3 KHÔNG đụng ledger; xuất tự do làm Khả dụng giảm theo `onHand` (đúng: hàng hỏng không còn để hứa).
- Permission guard: `@RequirePermissions` = AND, `@RequireAnyPermissions` = OR (`permissions.guard.ts:77-78`). Phiếu kho dùng AND một key.
- `AuditSubscriber` lỗi được `InProcessEventBus` cô lập + log — không làm sập producer; vì vậy audit thất bại không rollback phiếu (đúng thiết kế AD-18).
- Bottom-nav mobile khoá cứng 5 tab — chỉ truyền `activeIndex: kInventoryTabIndex` (hằng có từ 6.2 ở `inventory_screen.dart:26` — import lại, không khai trùng).

### Lệch mockup có chủ đích (để reviewer không gắn cờ)

- Tab lọc "Nhập trả", chip "Nhập trả", banner phiếu nhập trả: 6.7.
- Chi tiết phiếu xuất "gắn đơn · DH-2048 · Người xác nhận" + notecard "Một Đơn — một phiếu xuất": 6.4. Phiếu xuất 6.3 hiện "Xuất kho · không gắn đơn".
- Mockup chỉ vẽ danh sách + chi tiết; form tạo phiếu (nút "Tạo phiếu") không có mockup — dựng bằng component sẵn có (`Sheet`/`AppSheet`, `Field`, `Table`), không style ad-hoc (AD-13).
- Mã phiếu mockup `PK-N-119` (3 chữ số) — ta pad 4 (`PK-N-0119`); chỉ hiển thị.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Luật (2) cả hai nửa: khoá `FOR UPDATE` + lane DB (AC-7). Lane DB KHÔNG thay `npm test`.
- Luật (3)/(4)/(5)/(6): AC-16, 17, 10, 9.
- Đếm gọi bằng `toHaveBeenCalledTimes(1)`; mock tx CHẠY thân rồi mới ném.
- Đột biến: mutate MỌI dòng anh em cùng guard (memory `mutation-one-row-sibling-guard-untested`) — vd gỡ kiểm `tracksStock` VÀ gỡ kiểm `isActive` riêng từng cái; mutant tương đương ngữ nghĩa ⇒ gỡ khỏi code thay vì đổ cho test (memory `mutation-semantically-equivalent-false-survivor`).
- Source-guard soi chuỗi `FOR UPDATE` phải đọc RAW — `stripToCode` xoá string/template literal (memory `striptocode-deletes-string-literals`).
- Song song: nhiều agent review mutate cùng file sẽ đọc nhầm mutant của nhau (memory `parallel-reviewers-mutation-collide`) — kiểm lại mọi finding trên file hiện tại.

### Previous Story Intelligence (6.2)

- Khuôn tầng: domain thuần (`ton-kho.ts`) là nơi duy nhất tính số; service mỏng; controller không envelope; DTO `@Transform` cho query; e2e loopback; DB lane tự dựng fixture.
- Review 6.2 sửa 7 finding — áp NGAY từ đầu ở 6.3: (1) guard ghi phải bắt cả `$queryRaw`/`$queryRawUnsafe` (đã có); (2) LIKE escape — nếu thêm tìm kiếm phiếu thì dùng `thoatLike` (story này KHÔNG thêm `q` cho phiếu); (3) text-guard cấm MỌI phép dẫn xuất trên số, không chỉ một biến; (4) guard quét mọi model; (5) query lặp tham số ⇒ mảng; (6) assert message lỗi DB chặt (`toThrow(/stock_items_on_hand_non_negative/)`), không `toThrow()` trần.
- Ghi nhận bàn giao của 6.2 "đọc xé khi 6.4 tới" — vẫn là việc của 6.4, không phải 6.3 (🛑4).
- `AppCard` mobile đã có `warn/danger` variant (6.2 thêm); `AppFrame` in HOA nhãn ⇒ finder widget test dùng chuỗi hoa.

### Git intelligence

`5076c17` (6.2 tồn kho đọc), `fecbb6f` (6.1 nhánh giao hàng), `04ed832` (chống flake e2e + guard chống-rỗng), `9bd41ba` (phạm vi đường ghi đơn), `15f3532`. Hệ quả: mọi e2e mới bind loopback; mọi guard mới chống-rỗng; màn web mới qua typecheck thật + ca render; không dependency mới (NestJS 11.1, Prisma 7.8, React 19.2, Flutter 3.44 — giữ nguyên, không cần tra phiên bản).

### Latest tech notes (Prisma 7.8 / Postgres 18)

- Interactive tx: `prisma.$transaction(async (tx) => { … })`; khoá `` tx.$queryRaw`… FOR UPDATE` `` bên trong callback (template tag ⇒ tham số bind). Mảng JS bind thành mảng Postgres với adapter pg — xác minh bằng lane DB, không giả định.
- `@default(autoincrement())` trên field không phải `@id` ⇒ Postgres `SERIAL`; Prisma cho phép, cần `@unique`.
- CHECK không có trong PSL ⇒ `migrate diff` sau này KHÔNG xoá nó (không biết tới); ghi chú ở schema để người sau không tưởng là thiếu.
- Lỗi CHECK/FK từ adapter là `DriverAdapterError` không tag mã ⇒ assert message.

### Project Structure Notes

- File trong `inventory/` đúng cây spine (`ARCHITECTURE-SPINE.md:448` "StockItem, StockVoucher(+lines)"). Route `/stock-vouchers` theo `backend/CONVENTIONS.md` (danh từ số nhiều kebab-case theo entity).
- Tên hàm domain tiếng Việt không dấu (`tinhGiaVonBinhQuan`, `maPhieu`, `taoPhieu`) theo khuôn `ton-kho.ts`/`orders.service.ts`; field DTO khớp khuôn 6.2 (`ten`, `donVi`, `ma`, `nguoiTao`, `soDong`, `tongSoLuong`); cột DB snake_case English (`type`, `note`, `seq`, `unit_cost`) theo khuôn bảng sẵn có.
- Không đặt mã story/AC vào comment code, tên test, migration (`review-audit-self-decision.md#Stable Code Artifacts`).
- File mới kebab-case (guard `naming-convention`); Dart snake_case; màn React `*Screen.tsx` (guard đếm màn).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Ghi giá vốn không cần `costs.view`** (🛑6) — mặc định: `KHO_GIAO` gõ được `unitCost`, đọc lại thì không thấy. Muốn chỉ người có `costs.view` mới nhập kho thì `KHO_GIAO` mất khả năng nhập — đổi preset.
2. **Sửa tay `costPrice` ở danh mục vẫn mở** — "một chỗ gõ" của PRD gợi ý khoá ô đó khi sản phẩm đã có phiếu nhập. Mặc định: KHÔNG đổi Story 3.1 (sản phẩm không theo dõi tồn vẫn cần ô này; khoá là thay đổi hợp đồng `PATCH /products`). Sửa tay sau khi có tồn sẽ thành "giá vốn trước" của lần bình quân kế tiếp.
3. **Phiếu xuất tự do có bắt buộc lý do (`note`)?** Mặc định: không bắt buộc (AC không đòi). Muốn bắt buộc thì là một `@ValidateIf` trong DTO.
4. **Danh sách phiếu không phân trang** (100 mới nhất) — ~20 user nội bộ, khối lượng thấp. Phân trang khi có màn báo cáo kho.
5. **`StockOutBlocked` cho phiếu xuất tự do bị chặn** — mặc định: 6.5 quyết có publish cho cả xuất tự do hay chỉ xuất gắn đơn.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3 (569-575), #6.4 (577-582), #6.5 (584-590), #6.6 (592-598), #6.7 (600-607)]
- [Source: ARCHITECTURE-SPINE.md#AD-18 (152-156), #AD-19 (158-162), #AD-20 (164-168), ERD (236-252, 315-334), module tree (448)]
- [Source: prd.md#FR-25 (350-359), #FR-26 (361-367), #FR-37 (478-491)]
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#4 (104-111)]
- [Source: ux EXPERIENCE.md:47-48, :118, :122, :150; mockups/all-screens.html#s-stock-vouchers (3910-4040)]
- [Source: backend/src/inventory/** (6.2), backend/test/inventory-read-only.spec.ts, backend/test/stock-items.db.integration.spec.ts]
- [Source: backend/src/catalog/product-prices.service.ts:91-100, backend/src/orders/orders.service.ts:113-117, 461-473 (khuôn khoá)]
- [Source: backend/src/catalog/products.controller.ts:40-110, catalog/domain/product-visibility.ts (khuôn costs.view)]
- [Source: backend/src/customers/customer-sources.service.ts, customers/domain/customer-source-events.ts (khuôn event sau commit)]
- [Source: backend/src/accounts/domain/role-presets.ts:52-118; backend/src/common/errors/error-code.ts]
- [Source: web/src/screens/inventory/InventoryScreen.tsx, web/src/design-system/session/{inventory-port,customer-sources-port}.ts, web/src/design-system/components/Sheet.tsx; mobile/lib/screens/inventory/inventory_screen.dart]
- [Source: design-system/screens/inventory.test.mjs, design-system/session/parity.test.mjs:23-46, design-system/lib/assert-scanned.mjs]
- [Source: _bmad-output/project-context.md; _bmad-output/story-automator/extra-instructions-6-dev.txt (luật dự án 1-7)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- Phiên trước để lại backend chưa đánh dấu (schema, migration đã deploy 5433, service/controller/DTO, unit + e2e). Rà lại toàn bộ, chạy lại, rồi làm tiếp phần thiếu.
- e2e cũ thiếu mock `auditLog` ⇒ `AuditSubscriber` thật log lỗi `Cannot read properties of undefined (reading 'create')` (bị bus cô lập nên test vẫn xanh). Thêm mock + assert audit ghi đúng 1 dòng.
- Đột biến (iii) đầu tiên (`async function` thay arrow) là mutant TƯƠNG ĐƯƠNG với luật guard — viết lại thành tx giả dạng mảng ⇒ ĐỎ.
- Widget test 320/360 bắt tràn thật (hàng danh sách + đầu thẻ chi tiết) ⇒ sửa bằng `Flexible`/`Expanded`.
- Guard ghost-key (`permission-keys.test.mjs`) chỉ nhận tên `AppPermissionKeys.*` ở màn mobile (regex `static const String`, mà `AppPerm` khai `static const PermissionKey`) ⇒ màn dùng `AppPermissionKeys.inventoryManage` như các màn khác. Lỗ của guard với `AppPerm.*` có từ trước, không sửa ở story này.

### Completion Notes List

- Backend: `POST/GET /stock-vouchers`, `GET /stock-vouchers/:id` (gate `inventory.manage`). Một tx interactive: khoá `products … = ANY(ids) ORDER BY id FOR UPDATE` là lệnh đầu → đọc → kiểm (409 `INSUFFICIENT_STOCK`/`PRODUCT_NOT_STOCKABLE`, 404) → upsert `onHand` → nhập: `costPrice` = `tinhGiaVonBinhQuan` → tạo phiếu + dòng (xuất: `unitCost` = snapshot). Event `StockVoucherCreated` publish 1 lần sau commit; audit qua subscriber. `unitCost` vắng hẳn khi thiếu `costs.view`. Không ghi `StockMovement`.
- `fieldErrors[].field` theo đường ValidationPipe sinh ra: `lines.0.unitCost` / `lines.0.qty` (service dùng cùng định dạng để client map một kiểu).
- Guard `inventory-read-only.spec.ts` (b) nới: chỉ `stock-vouchers.service.ts` được ghi, và phải có `FOR UPDATE` trong câu `$queryRaw` (đọc raw) + `$transaction(async`. (a) giữ nguyên.
- Web: `StockVouchersScreen` (lọc Tất cả/Nhập/Xuất, bảng + chi tiết, form trong `Sheet`, vé `latest` cho picker, nút Lưu disabled khi gửi), `format-gio.ts` (UTC+7 cố định), `InventoryScreen.onOpenVouchers` (chỉ hiện khi có `inventory.manage`). Đã bỏ ref chống double-submit thừa vì `disabled` đủ (đột biến chứng minh).
- Mobile: `stock_vouchers_screen.dart` (AppFrame "Gần đây", AppCard chi tiết, form trong AppSheet), `inventory_screen.dart` thêm `onOpenVouchers` + `perms` (mặc định `{}` fail-closed, theo khuôn `CreateQuoteScreen`).
- Port twin `stock-vouchers-port.ts` ↔ `stock_vouchers_port.dart` + fake; parity đối chiếu từng field với `openapi.json`.
- Docs: `docs/van-hanh-go-live.md` (mới); ERD spine `STOCK_VOUCHER` thêm `seq`/`note`/`createdByAccountId`, chú thích `orderId`/`status` thêm ở luồng xuất gắn đơn; `qty` luôn dương.

**Cổng cuối (2026-10-21):**

| Lane | Kết quả |
|---|---|
| backend `npx tsc --noEmit` | xanh |
| backend `npm test` | 86 suite / 1597 test xanh |
| backend `npm run test:db` (Postgres 5433) | 17 suite / 142 test xanh (stock-vouchers: 11) |
| backend eslint file của story | sạch; `npm run lint` toàn repo đỏ sẵn 157 lỗi prettier có từ trước |
| web typecheck / test / build | xanh / 4 file 38 test / build OK |
| mobile `flutter analyze` / `flutter test` | sạch / 285 test xanh |
| design-system `npm test` | 416/416 xanh |

**Đột biến (cp backup, đã khôi phục, mutant đều compile):**

| Đột biến | Đỏ ở |
|---|---|
| Gỡ `FOR UPDATE` khỏi câu khoá service | lane DB: ca khoá ép xen kẽ + ca chéo (A,B)/(B,A) (2 ca); guard (b) |
| Gỡ kiểm xuất quá tồn | unit 3 ca |
| Gỡ riêng `tracksStock` / riêng `isActive` | unit 1 ca mỗi cái |
| Gỡ 404 sản phẩm không tồn tại | unit 2 ca |
| Không cập nhật `costPrice` (giữ giá cũ) | unit 1 ca |
| `stockItem.update` trong `stock-items.service.ts` | guard (b) |
| Transaction mất dạng interactive (chỉ còn dạng mảng) | guard (b) |
| Web: luôn hiện cột giá vốn / luôn gửi `unitCost` / gỡ `disabled` nút Lưu | test hành vi web (1 ca mỗi cái) |
| Text-guard: chèn `line.qty * line.unitCost` (web) / `if (qty > sp.onHand)` (mobile) / stripper trả rỗng | stock-vouchers.test.mjs (1 / 1 / 5 ca) |

### File List

- `backend/prisma/schema.prisma` (sửa)
- `backend/prisma/migrations/20261021090000_add_stock_vouchers/migration.sql` (mới)
- `backend/src/inventory/inventory.module.ts` (sửa)
- `backend/src/inventory/stock-vouchers.controller.ts` (mới)
- `backend/src/inventory/stock-vouchers.service.ts` (mới)
- `backend/src/inventory/domain/gia-von.ts` (mới)
- `backend/src/inventory/domain/stock-voucher-events.ts` (mới)
- `backend/src/inventory/domain/stock-voucher-visibility.ts` (mới)
- `backend/src/inventory/dto/create-stock-voucher-request.dto.ts` (mới)
- `backend/src/inventory/dto/stock-voucher-list-query.dto.ts` (mới)
- `backend/src/inventory/dto/stock-voucher-response.dto.ts` (mới)
- `backend/openapi/openapi.json` (sinh lại)
- `backend/test/gia-von.spec.ts` (mới)
- `backend/test/stock-vouchers.service.spec.ts` (mới)
- `backend/test/stock-vouchers.e2e.spec.ts` (mới)
- `backend/test/stock-vouchers.db.integration.spec.ts` (mới)
- `backend/test/inventory-read-only.spec.ts` (sửa)
- `web/src/design-system/session/stock-vouchers-port.ts` (mới)
- `web/src/design-system/session/fake-stock-vouchers-port.ts` (mới)
- `web/src/design-system/session/index.ts` (sửa)
- `web/src/screens/inventory/StockVouchersScreen.tsx` (mới)
- `web/src/screens/inventory/stock-vouchers.css` (mới)
- `web/src/screens/inventory/format-gio.ts` (mới)
- `web/src/screens/inventory/InventoryScreen.tsx` (sửa)
- `web/src/test/screens-render.test.tsx` (sửa)
- `web/src/test/stock-vouchers-screen.test.tsx` (mới)
- `mobile/lib/design_system/session/stock_vouchers_port.dart` (mới)
- `mobile/lib/design_system/session/fake_stock_vouchers_port.dart` (mới)
- `mobile/lib/design_system/session/session.dart` (sửa)
- `mobile/lib/screens/inventory/stock_vouchers_screen.dart` (mới)
- `mobile/lib/screens/inventory/inventory_screen.dart` (sửa)
- `mobile/test/screens/inventory/stock_vouchers_screen_test.dart` (mới)
- `design-system/session/parity.test.mjs` (sửa)
- `design-system/screens/stock-vouchers.test.mjs` (mới)
- `docs/van-hanh-go-live.md` (mới)
- `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` (sửa — ERD)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (sửa)

## Senior Developer Review (AI)

**Người review:** Đại Ca (AI, `/ck:code-review` + story-automator-review) · **Ngày:** 2026-10-21 · **Kết quả:** Approve sau khi sửa — 0 CRITICAL còn lại.

**Kiểm riêng theo yêu cầu:**
- **Định dạng giá vốn:** ĐÚNG như dev nói, không phải lỗi. Mọi màn tiền đang có đều in số nguyên thô, không dấu chấm, không `₫`: web `CreateQuoteScreen` (`String(totals.subtotal)`, `product.price`), `OrderDetailScreen` (`line.amount`), `DiscountApprovalScreen` (`String(line.unitPrice)`), `CartLineRow` ("never formats money"); mobile `create_quote_screen`/`order_detail_screen`/`discount_approval_screen` (`'${...}'`). Chuỗi `1.250.000.000 ₫` chỉ có ở màn demo `SessionGatingExample`/`app_session_gating_example`. Web không có màn danh mục. Không đổi gì.
- **Ẩn giá vốn khi thiếu `costs.view`:** API — POST response + `GET /:id` qua `anGiaVonDongPhieu` (key vắng hẳn), danh sách không mang `unitCost`, 409/404 không lộ giá; e2e đo KHO_GIAO không thấy / QUAN_LY thấy. Web/mobile render cột theo field có/vắng (test "không ô 0"). Audit event mang giá vốn — chỉ `SUPER_ADMIN` có `audit.read` (và có `costs.view`). Đạt.
- **Luật (1) phạm vi:** story không ghi đơn. Đột biến guard có sẵn (`findScopedOrThrow` → `findOrThrow` ở `orders.service.ts`) ⇒ `no-unscoped-order-write` ĐỎ 2 ca. Lỗ tìm thấy: guard đó chỉ quét `src/orders` ⇒ xem M1.
- **Luật (2) khoá:** đột biến gỡ `FOR UPDATE` ⇒ đỏ unit (1) + guard (b) + lane DB (2 ca khoá); đọc `products` TRƯỚC câu khoá ⇒ đỏ unit + lane DB (2 ca).

**Finding đã sửa (tất cả):**

| # | Mức | Finding | Sửa |
|---|---|---|---|
| H1 | HIGH | Web `Number(d.unitCost \|\| '0')` / mobile `_chiChuSo()` ⇒ ô "Giá vốn / đv *" để TRỐNG gửi `unitCost: 0`; backend nhận (0 hợp lệ) ⇒ phiếu nhập lưu giá vốn 0 và kéo `Product.costPrice` (nhập đầu ⇒ costPrice = 0). Vi phạm AC "unitCost bắt buộc" + notecard "không được bỏ trống". | Trống ⇒ KHÔNG gửi `unitCost` (web bỏ key, mobile `null`) ⇒ backend trả 400 dưới đúng dòng; gõ `0` thật vẫn gửi 0. Test web+mobile cho cả hai ca. |
| M1 | MEDIUM | Guard (b) cho `stock-vouchers.service.ts` ghi tự do: `tx.order.updateMany(...)` (ghi đơn không qua phạm vi) và `this.prisma.stockItem.updateMany(...)` (ghi tồn NGOÀI tx/khoá) đều lọt guard + lane DB — unit chỉ đỏ tình cờ vì mock thiếu model. | `inventory-read-only.spec.ts`: thêm luật file được phép ghi phải ghi qua `tx` (cấm `this.prisma.<model>.<ghi>`/`$executeRaw`) + mục (c) `src/inventory` cấm ghi aggregate đơn; mỗi luật có mẫu tự kiểm + chống rỗng. Đột biến lại ⇒ ĐỎ guard. |
| M2 | MEDIUM | Mobile `_luu` chỉ bắt `StockVoucherPortException` ⇒ lỗi khác (mất mạng) để `_sending = true` mãi, nút "Lưu phiếu" chết, future lỗi không ai bắt. | Thêm nhánh bắt chung: banner "Không lưu được phiếu. Thử lại.", bật lại nút. Widget test. |
| M3 | MEDIUM | Lỗi dòng map theo chỉ số `lines.N.*` (web+mobile): bỏ một dòng sau lỗi ⇒ lỗi rơi sang sản phẩm khác. | Bỏ dòng ⇒ xoá lỗi đang hiện. Test web+mobile. |
| L1 | LOW | Web `luu()` thành công khi đang lọc: `setFilter(ALL)` + `await load()` (closure filter cũ) ⇒ tải danh sách 2 lần. | Đang lọc ⇒ chỉ đổi filter (effect tải); không lọc ⇒ tải tay. Test đếm đúng 1 lần, `{}`. |
| L2 | LOW | Docstring `tinhGiaVonBinhQuan` nói tích tối đa ~2e15 — sai: `onHandTruoc` cộng dồn qua nhiều phiếu, không bị DTO chặn. | Sửa docstring: chính xác khi `onHandTruoc × giaVonTruoc < 2^53` (~4 triệu đv ở giá trần). |
| L3 | LOW | Web `format-gio.ts` không có test biên qua ngày UTC+7 (mobile có). | Thêm test `23:30Z ⇒ 06/07 · 06:30`, `31/12 17:00Z ⇒ 01/01/2027 · 00:00`, chuỗi rác ⇒ `—`. |

**Đột biến xác nhận test mới có canh (cp backup, đã khôi phục):** web trống⇒0 / bỏ xoá lỗi / tải 2 lần ⇒ mỗi cái 1 ca đỏ; mobile trống⇒0 / bỏ nhánh bắt chung / bỏ xoá lỗi ⇒ mỗi cái 1 ca đỏ; service ghi đơn trong tx / ghi `this.prisma.stockItem` ngoài tx ⇒ guard đỏ 1 ca mỗi cái.

**Cổng sau sửa:** backend `tsc` xanh, eslint file story sạch, `npm test` 86 suite / 1613 test, `npm run test:db` 17 suite / 143 test; web typecheck / test (4 file, 46 test) / build xanh; mobile `flutter analyze` sạch, `flutter test` 290 xanh; design-system 416/416.

**Ghi nhận, không sửa (có chủ đích):** `fieldErrors[].field` dạng `lines.0.unitCost` (đường ValidationPipe sinh) thay vì `lines[i].unitCost` của AC — dev đã ghi, client map một kiểu. Lỗ `AppPerm.*` của guard ghost-key mobile có từ trước story.

### Change Log

- 2026-10-21: Phiếu kho nhập/xuất — schema + migration (CHECK on_hand ≥ 0), giá vốn bình quân gia quyền, khoá `products FOR UPDATE`, event audit, 3 endpoint; màn Phiếu kho web + mobile, port twin, text-guard + parity; nới guard ghi tồn; tài liệu go-live. Status → review.
- 2026-10-21: Code review — sửa 7 finding (giá vốn trống bị gửi 0 trên web+mobile; guard ghi tồn bắt ghi đơn và ghi ngoài tx; mobile kẹt nút khi lỗi lạ; lỗi dòng lệch chỉ số; tải danh sách 2 lần; docstring tràn số; test giờ UTC+7 web). Status → done.
