---
baseline_commit: 33d6d9f
---

# Story 6.6: Giữ chỗ tồn khi chốt đơn — StockMovement ledger idempotent

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a lập trình viên tồn kho (phục vụ sale lập báo giá và kho xem Tồn kho),
I want lúc chốt đơn hệ thống ghi dòng giữ chỗ vào ledger `StockMovement` (một dòng mỗi sản phẩm theo dõi tồn của version được chốt), và lúc re-chốt thì giải phóng phần giữ của version cũ rồi giữ lại theo version mới,
so that `reserved` (= `SUM(StockMovement.qty)`) và Khả dụng (= `onHand − reserved`) phản ánh đúng hàng đã hứa, kể cả khi Chốt bị gọi lặp hoặc đơn được sửa rồi chốt lại.

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-21, sau commit `33d6d9f`)

- **Ledger đã có, chưa ai ghi dòng giữ chỗ.** `StockMovement` (`backend/prisma/schema.prisma:175-203`, migration `20261021080000_add_stock_items_and_movements`): `id, stockItemId (FK stock_items RESTRICT), orderId (FK RESTRICT), orderVersionId (FK RESTRICT), qty Int CÓ DẤU, type String, createdAt`; chỉ `@@index([stockItemId])` — **CHƯA có unique, CHƯA có CHECK**. Docstring schema đã để lại hợp đồng cho story này: append-only, `reserved = SUM(qty)` trên MỌI dòng của một `stockItemId` (KHÔNG lọc `type`), unique `(orderId, orderVersionId)` **không đặt được** vì movement theo từng sản phẩm, và "the reservation path's unique design MUST leave room for this `xuat` row (same `orderId`/`orderVersionId`/`stockItemId` as the reservation row)".
- **Người ghi duy nhất hôm nay:** `StockVouchersService.issueForOrderInTx` (`backend/src/inventory/stock-vouchers.service.ts:378-500`) — khi xuất gắn đơn, với mỗi sản phẩm tracked: `held = SUM(qty) WHERE orderId AND stockItemId` (cấp ĐƠN, mọi version), `reservedReleased = max(held, 0)`, nếu > 0 ghi một dòng `type: 'xuat', qty: −reservedReleased, orderVersionId = version đang xuất`. Hôm nay `held` luôn 0 ⇒ chưa từng ghi dòng nào. Sau story này nhánh đó mới thực sự chạy.
- **Đường đọc đã sẵn sàng:** `StockItemsService.lietKeTonKho` (`stock-items.service.ts:76-150`) gom `SUM(qty)` theo `stockItemId`; `checkOrderLines` (`:152-230`, cảnh báo báo giá 6.5) đã TRỪ phần giữ của CHÍNH đơn (`ownHeld` = `SUM WHERE orderId`) — viết sẵn cho story này. Cả hai đọc trong tx mảng `RepeatableRead`. **Không đổi đường đọc.**
- **Chốt hôm nay KHÔNG chạm tồn:** `OrdersService.confirm` (`backend/src/orders/orders.service.ts:2184-2390`) — `findScopedOrThrow` → fast-path `dachot` trả view (idempotent, không ghi) → kiểm `choduyet`/`baogia` → fast-path rỗng 400 → `$transaction`: `applyTransition` (khoá `orders` FOR UPDATE + cổng `updateMany` theo status quan sát được; thua ⇒ sentinel `CHOT_GATE_THUA`) → đọc dòng TRONG tx → snapshot giá/VAT/`chotAt`/`warrantyStartAt` → commit → publish `OrderConfirmed` + `StatusChanged`. Chưa có test nào khẳng định "chốt không đọc tồn để chặn" bị phá — 6.5 đã khoá bằng test (đừng làm đỏ chúng).
- **Mở lại (`revise`, `:2412-2560`):** tạo version mới `versionNo + 1`, copy dòng, repoint `currentVersionId`; **đơn đã có phiếu xuất ⇒ 409** (`REVISE_AFTER_ISSUE_MESSAGE`) — tức version ĐÃ xuất không bao giờ bị re-chốt. Chỉ `confirm` dẫn tới `dachot` (event `chot`: `baogia → dachot`, `choduyet → dachot` — `domain/allowed-transition.ts:116,124`; source-guard cấm đi tắt).
- **Huỷ đơn (`huyDon`) KHÔNG chạm tồn** — khoá bằng source-guard `backend/test/no-stock-write-in-cancel.spec.ts`. Giải phóng khi huỷ là việc của **6.7** (subscribe `OrderCancelled`). Story này KHÔNG đụng `huyDon`.
- **Guard kho `backend/test/inventory-read-only.spec.ts`:** (a) cấm mọi trường `*reserved*` trong schema; (b) trong `src/inventory/**` lệnh ghi Prisma chỉ được nằm ở `FILE_DUOC_GHI = ['stock-vouchers.service.ts']`, file đó phải chứa `FOR UPDATE` + `$transaction(async`, và không ghi qua `this.prisma.*`; (c) `src/inventory/**` không ghi bảng đơn.
- **Thứ tự khoá toàn hệ thống** (`orders.service.ts:132-137`, docstring `StockVoucher` schema): `orders → products`; khoá `products` bằng `SELECT id FROM products WHERE id = ANY(…) ORDER BY id FOR UPDATE` — cùng câu, cùng thứ tự ở mọi đường ghi tồn. Khoá `stock_items` không đủ vì dòng sinh lười.

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Primitive giữ chỗ nằm ở `inventory/`, chạy TRONG tx của `confirm`.**
Thêm `StockVouchersService.reserveForOrderInTx(tx, { orderId, orderVersionId, orderLines })` — khuôn y hệt `issueForOrderInTx`: không mở tx, không publish, không dùng `this.prisma`, không ghi bảng đơn. Đặt trong `stock-vouchers.service.ts` (file DUY NHẤT được ghi tồn theo guard (b)) — tách file mới sẽ phải nới guard (b), mà primitive trong-tx không chứa `$transaction(async` nên không qua được luật "file ghi phải tự mở tx interactive". Lý do tx thuộc `orders/`: snapshot giá + transition + giữ chỗ phải atomic — chốt thành công mà không giữ chỗ (hoặc ngược lại) là `reserved` sai lệch không tự lành.

**D2 — Hình dạng ledger + idempotency ở tầng DB.**
- `type` mới (dữ liệu, tiếng Anh theo luật 8): `'reserve'` (qty > 0) và `'release'` (qty < 0). `'xuat'` của 6.4 GIỮ NGUYÊN (dữ liệu sẵn có, không đổi tên). Gom ba giá trị vào một hằng domain thuần `backend/src/inventory/domain/stock-movement-type.ts` (`STOCK_MOVEMENT_TYPE = { reserve: 'reserve', release: 'release', issue: 'xuat' } as const`) và đổi chỗ `type: 'xuat'` trong `issueForOrderInTx` sang hằng (cùng giá trị — không đổi hành vi).
- **Unique `(order_version_id, stock_item_id, type)`** — `@@unique([orderVersionId, stockItemId, type])` (tên index Prisma mặc định `stock_movements_order_version_id_stock_item_id_type_key`). Một version ⇒ tối đa MỘT `reserve`, MỘT `release`, MỘT `xuat` cho mỗi sản phẩm. Chừa đúng chỗ cho dòng `xuat` (khác `type`) như hợp đồng schema yêu cầu. `orderVersionId` đã xác định `orderId` nên không cần thêm `orderId` vào key.
- **CHECK `stock_movements_qty_sign`** (thêm TAY vào `migration.sql`, Prisma không mô hình hoá CHECK — tiền lệ `stock_items_on_hand_non_negative`, `stock_vouchers_order_pair`): `(type = 'reserve' AND qty > 0) OR (type IN ('release','xuat') AND qty < 0)`. Lưới cuối cho hợp đồng "giữ dấu đúng" mà `reserved = SUM(qty)` phụ thuộc vào; dữ liệu `xuat` sẵn có đều âm nên migrate sạch.
- **Lệch spine có chủ đích:** AD-19 ghi "unique trên `(orderId, orderVersionId)`" — không đặt được trên ledger theo sản phẩm (docstring schema đã nêu). Unique `(orderVersionId, stockItemId, type)` giữ đúng mục tiêu của AD-19 (retry chốt/xuất không tạo dòng trùng). Ghi vào Completion Notes.

**D3 — Thuật toán `reserveForOrderInTx` (thứ tự BẮT BUỘC).**
Caller đã giữ khoá dòng `orders` (engine `applyTransition`). Mọi dòng ledger của một đơn chỉ được ghi dưới khoá dòng đơn đó (chốt, xuất gắn đơn, và sau này huỷ 6.7) ⇒ đọc ledger của CHÍNH đơn trước khi khoá `products` là an toàn.
1. Đọc phần giữ của các version KHÁC của đơn còn dương: `groupBy ['orderVersionId','stockItemId'] WHERE orderId AND orderVersionId ≠ current`, `_sum.qty > 0` (kèm `stockItem.productId` — đọc `stockItem` theo id để biết product cần khoá).
2. Tập product cần khoá = productId của các dòng đơn version hiện hành (mọi dòng có `productId`) ∪ productId của phần giữ ở bước 1. Rỗng ⇒ return (không khoá, không ghi).
3. `SELECT id FROM products WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE` — lệnh khoá ĐẦU TIÊN trên bảng tồn trong primitive. Cùng câu SQL với `issueForOrderInTx`/`lockTrackedProductsInTx` — KHÔNG viết biến thể khác thứ tự. Sau khoá mới `tx.product.findMany({ where: { id: { in: ids } }, select: { id, name, tracksStock } })` để có đầu vào cho `stockIssueLines` (cần `name` — `lockTrackedProductsInTx` chỉ trả tập id nên không đủ; hoặc tách phần khoá của nó thành helper private dùng chung).
4. **Giải phóng version cũ:** với mỗi (oldVersionId, stockItemId) ở bước 1 → `create { type: 'release', qty: −held, orderId, orderVersionId: oldVersionId, stockItemId }`. Giải phóng THEO PHẦN ĐANG GIỮ của version đó (ledger), KHÔNG theo `qty` dòng cũ và KHÔNG lọc `tracksStock` hiện tại — sản phẩm bị tắt theo dõi sau khi chốt vẫn phải trả lại phần đã hứa.
5. **Giữ chỗ version hiện hành:** dòng = `stockIssueLines(orderLines, products)` (domain `stock-issue-lines.ts` — CÙNG luật chọn dòng với phiếu xuất: có `productId`, `tracksStock`, gộp theo sản phẩm) ⇒ những gì được giữ chính là những gì sẽ được xuất. Với mỗi dòng: `stockItem = upsert({ where: { productId }, create: { productId, onHand: 0 }, update: {} })` (sinh lười dưới khoá products); nếu version hiện hành ĐÃ có dòng `reserve` cho stockItem đó ⇒ bỏ qua (idempotent — "lần thứ hai skip"); ngược lại `create { type: 'reserve', qty: line.qty, … }`.
6. Trả về `void` (hoặc tóm tắt nội bộ cho test) — KHÔNG event mới (xem D5).
**KHÔNG kiểm tồn, KHÔNG chặn, KHÔNG ném khi thiếu** — chốt/re-chốt luôn được phép dù Khả dụng âm (Đại Ca chốt, xem Dev Notes). `onHand` KHÔNG đổi.

**D4 — Nối vào `confirm()` — đúng một chỗ, trong tx, sau snapshot.**
Trong callback `$transaction` của `confirm`, SAU vòng `orderLineItem.update` snapshot, TRƯỚC `return event`: `await this.stockVouchers.reserveForOrderInTx(tx, { orderId: before.id, orderVersionId: versionId, orderLines: productLines(lines) })` — dùng `lines` đã đọc TRONG tx sau khoá (TOCTOU, xem comment hiện có) và helper `productLines` sẵn có. Hệ quả tự nhiên:
- Retry khi đã `dachot` ⇒ fast-path trả view, không vào tx ⇒ không ghi ledger.
- Hai request đua ⇒ bên thua cổng `updateMany` ném sentinel TRƯỚC khi tới primitive ⇒ đúng MỘT bộ `reserve`. Unique (D2) là lưới cuối — chạm nó là lỗi lập trình, không phải nhánh nghiệp vụ.
- Thất bại bất kỳ trong primitive ⇒ rollback cả transition + snapshot (chốt không "nửa vời").
- Chốt từ `choduyet` đi cùng đường.
**KHÔNG đổi `revise()`** — mở lại không giải phóng; phần giữ của version cũ còn hiệu lực trong lúc sửa và chỉ được thay ở lần re-chốt (epic AC 3: "khi re-finalize"). Cảnh báo báo giá trong lúc sửa vẫn đúng vì `checkOrderLines` đã trừ phần giữ cấp đơn. Đơn mở lại rồi bị huỷ ⇒ 6.7 giải phóng.

**D5 — Không event, không audit mới.** Giữ chỗ là hệ quả của Chốt, đã có `OrderConfirmed` + `StatusChanged` (AD-18) — thêm event "StockReserved" là YAGNI (không consumer nào ở Phase 1, ma trận noti không có dòng này). Ledger tự là vết truy (append-only, có `createdAt`, gắn đơn/version).

**D6 — Không đổi contract / UI.** Không route mới, không field DTO mới, không `openapi.json` đổi, không permission. Web/mobile KHÔNG đổi: màn Tồn kho 6.2 tự hiện `reserved`/Khả dụng/"Cần nhập" đúng; cảnh báo báo giá 6.5 tự trừ phần của chính đơn. Story này là backend + schema + test.

### 3. Phạm vi

**Trong:** schema + migration (unique + CHECK), hằng `STOCK_MOVEMENT_TYPE`, `reserveForOrderInTx`, nối vào `confirm`, cập nhật docstring schema/`stock-items.service.ts`/`orders.service.ts` cho đúng sự thật mới, test unit + e2e + DB lane + đột biến.
**Ngoài:** giải phóng khi huỷ (6.7); chặn re-chốt khi thiếu (đã bị Đại Ca bác); backfill phần giữ cho đơn đã chốt trước story này (chưa go-live — dữ liệu dev/test, xem Câu hỏi mở 1); UI mới; event mới.

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:592-598`)

- **Given** chốt Đơn lần đầu, **When** lưu, **Then** tạo `StockMovement` với `orderId`, `orderVersionId`, số lượng item vật tư; `reserved` là **tổng của `StockMovement`**, KHÔNG phải biến cộng-trừ (§2).
- **Given** `StockMovement` unique trên `(orderId, orderVersionId)`, **When** chốt/re-chốt, **Then** thao tác tiền **idempotent** — gọi Chốt API hai lần không tạo movement trùng; lần đầu tạo, lần thứ hai skip hoặc update (NFR-1, §2).
- **Given** sửa Đơn → tạo version mới + re-chốt, **When** re-finalize, **Then** huỷ movement version cũ, tạo movement mới theo version mới (Story 4.6).
- **Phụ thuộc:** story này sửa luồng chốt của Epic 4 nhưng nằm ở Epic 6 vì cần `StockItem` (6.2).

### AC dẫn xuất (đo được)

1. **Chốt lần đầu giữ chỗ.** Đơn `baogia` có dòng: SP-A tracked qty 3 + SP-A tracked qty 2 (hai dòng cùng SP) + SP-B tracked qty 4 + SP-C KHÔNG tracked qty 1 + một dòng tự do (không `productId`) ⇒ `POST /orders/:id/chot` 200 ⇒ ledger có ĐÚNG 2 dòng: `(SP-A, reserve, +5)`, `(SP-B, reserve, +4)`, cùng `orderId` và `orderVersionId = currentVersionId`; không dòng cho SP-C/dòng tự do; `onHand` không đổi; `GET /stock-items` cho SP-A: `reserved = 5`, `khaDung = onHand − 5`. (Lane DB + unit.)
2. **Chốt khi thiếu vẫn được** (giữ quyết định Đại Ca): `onHand(SP-A) = 1`, chốt đơn cần 5 ⇒ 200, ledger `+5`, Khả dụng = −4, `canNhap = 4`. Không 409, không `StockOutBlocked`. (Lane DB.)
3. **Từ `choduyet` cũng giữ chỗ** — đơn đi qua áp chiết khấu → duyệt `dong_y` → chốt ⇒ cùng kết quả AC-1. (Unit hoặc DB.)
4. **Idempotent — gọi lặp:** chốt lần 2 (đơn đã `dachot`) ⇒ 200, số dòng ledger không đổi, không publish thêm. (Unit + DB.)
5. **Idempotent — đua:** hai `chot` song song cùng đơn ⇒ một bên thắng, ĐÚNG MỘT bộ dòng `reserve`; `SUM` = tổng một lần. (Lane DB, request thật song song.)
6. **Re-chốt thay phần giữ.** Chốt v1 (SP-A 5, SP-B 4) → mở lại → sửa v2 (SP-A 2, bỏ SP-B, thêm SP-D tracked 3) → chốt ⇒ ledger thêm: `(v1, SP-A, release, −5)`, `(v1, SP-B, release, −4)`, `(v2, SP-A, reserve, +2)`, `(v2, SP-D, reserve, +3)`; dòng v1 cũ KHÔNG bị UPDATE/DELETE; `reserved`: SP-A 2, SP-B 0, SP-D 3. Re-chốt lần 2 chu kỳ (v3) giải phóng v2, không đụng lại v1 (net v1 đã = 0). (Lane DB + unit.)
7. **Mở lại không giải phóng:** sau `mo-lai` (đơn về `baogia`, chưa re-chốt) `reserved` vẫn = phần của v1; `GET /orders/:id/stock-check` của chính đơn không cảnh báo vì phần giữ của mình (tái khẳng định hành vi 6.5). (Lane DB.)
8. **Xuất kho sau chốt nhả đúng phần giữ:** chốt (SP-A +5) → nhập đủ → xuất gắn đơn ⇒ thêm `(SP-A, xuat, −5)`, `reserved(SP-A) = 0`, `onHand` giảm 5. Re-chốt rồi xuất ⇒ `xuat` nhả theo phần của version mới. Không vi phạm unique (khác `type`). (Lane DB — ca 6.4 `reservation release` giờ chạy với dữ liệu thật từ chốt.)
9. **Ràng buộc DB đứng một mình** (SQL thô trên Postgres thật, assert theo TÊN constraint): (a) dòng `reserve` thứ hai cùng `(order_version_id, stock_item_id)` ⇒ lỗi `stock_movements_order_version_id_stock_item_id_type_key`; (b) `reserve` với `qty ≤ 0` ⇒ lỗi `stock_movements_qty_sign`; (c) `release`/`xuat` với `qty ≥ 0` ⇒ lỗi `stock_movements_qty_sign`; (d) `reserve` + `xuat` cùng version/sản phẩm ⇒ chấp nhận. (Lane DB.) Nhớ: Prisma 7 lỗi constraint có thể là `DriverAdapterError` không gắn code — assert message/tên (memory `prisma7-p2003-only-on-insert`).
10. **Khoá `products` FOR UPDATE — xen kẽ ÉP BUỘC** (luật dự án 2): tx khác giữ `SELECT … FROM products WHERE id = SP-A FOR UPDATE` ⇒ `chot` đơn có SP-A CHỜ (chưa xong sau ~150 ms) ⇒ nhả khoá ⇒ chốt xong, ledger đúng. Đột biến bỏ `FOR UPDATE` trong primitive phải làm ca này ĐỎ. Thêm ca: hai đơn KHÁC nhau cùng SP mới (chưa có `stock_items`) chốt song song ⇒ cả hai 200, đúng 1 dòng `stock_items`, `reserved = tổng`. Thêm ca: chốt song song với phiếu nhập tự do cùng SP ⇒ không deadlock, số cuối đúng.
11. **Atomic:** primitive ném (ép lỗi trong unit) ⇒ `$transaction` rollback — không publish `OrderConfirmed`/`StatusChanged`. (Unit: mock tx CHẠY thân callback rồi mới ném — memory `mock-rejected-transaction-false-green`.)
12. **Phạm vi người gọi (luật 1):** đường ghi giữ chỗ chỉ đi qua `confirm()` — đã `findScopedOrThrow` trước tx; người ngoài phạm vi chốt ⇒ 404, ledger không đổi. Guard `no-unscoped-order-write` vẫn xanh (không đường ghi đơn mới).
13. **Không hồi quy:** `huyDon` không chạm tồn (guard `no-stock-write-in-cancel` xanh, không sửa guard); `revise` không ghi ledger; guard `inventory-read-only` (a)(b)(c) xanh KHÔNG nới; `openapi.json`/`permissions.json` drift-guard xanh không đổi byte; toàn bộ test 6.2–6.5 xanh.

## Tasks / Subtasks

- [x] **T1 — Schema + migration** (AC: 9, 13)
  - [x] `schema.prisma` `StockMovement`: thêm `@@unique([orderVersionId, stockItemId, type])`; viết lại docstring: bỏ câu "CHƯA có unique idempotency…", mô tả ba `type` + dấu, unique, CHECK, và quy tắc "giải phóng theo phần đang giữ của version". Docstring `StockItem`: đường ghi = phiếu kho + giữ chỗ (upsert dưới FOR UPDATE). Chỉ sửa tay hunk của mình (`prisma format` reflow cả file).
  - [x] Migration `backend/prisma/migrations/20261021110000_add_stock_movement_reservation_keys/migration.sql`: sinh offline `npx prisma migrate diff --from-schema <schema cũ> --to-schema prisma/schema.prisma --script` (Prisma 7 — memory `prisma7-migrate-diff-flag-rename`), THÊM TAY `ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_qty_sign" CHECK (…)`.
  - [x] `npx prisma validate && npx prisma generate`; `npx prisma migrate deploy` lên `pns-postgres` cổng 5433 (tắt ⇒ `docker start pns-postgres`; daemon không lên ⇒ ghi "lane DB chưa chạy", KHÔNG đánh `[x]` — memory `db-lane-needs-docker-desktop-gui`). KHÔNG ghi lên DB nào khác.
- [x] **T2 — Domain** (AC: 1, 6)
  - [x] `backend/src/inventory/domain/stock-movement-type.ts` (thuần) — hằng + type; `issueForOrderInTx` dùng `STOCK_MOVEMENT_TYPE.issue`.
- [x] **T3 — Primitive `reserveForOrderInTx`** (AC: 1, 2, 4, 6, 10)
  - [x] Trong `stock-vouchers.service.ts`, theo D3 (thứ tự 1→5). Docstring tiếng Anh: chạy trong tx caller, giả định caller giữ khoá `orders`, lock order `orders → products`, không kiểm tồn, giải phóng theo ledger.
- [x] **T4 — Nối `confirm()`** (AC: 1, 3, 4, 5, 11, 12)
  - [x] Một lệnh gọi trong tx theo D4. Cập nhật docstring `confirm` (thêm "giữ chỗ tồn trong cùng tx; không kiểm/chặn tồn") và docstring `revise` (mở lại không giải phóng — re-chốt thay). Cập nhật docstring `InventoryModule` (`exports` thêm lý do `reserveForOrderInTx`).
- [x] **T5 — Test unit/e2e (hermetic)** (AC: 1, 3, 4, 6, 11, 12, 13)
  - [x] `backend/test/stock-vouchers.service.spec.ts` (hoặc file mới `stock-reservation.spec.ts`): khoá products là op tồn đầu tiên với `ORDER BY id FOR UPDATE`; tập khoá gồm cả product của phần giữ cũ; `release` theo held (không theo qty dòng, không lọc tracksStock); bỏ held ≤ 0; gộp dòng cùng SP; bỏ untracked/tự do; skip khi version đã có `reserve`; không ghi khi không có gì; không chạm `onHand`.
  - [x] `backend/test/orders.service.spec.ts`: mock `stockVouchers` thêm `reserveForOrderInTx: jest.fn()`; khẳng định gọi ĐÚNG 1 lần với `(tx, { orderId, orderVersionId, orderLines })` SAU snapshot; KHÔNG gọi ở fast-path `dachot`, khi thua cổng, khi đơn rỗng 400; primitive ném ⇒ không publish (`toHaveBeenCalledTimes(0)`). Mọi spec dựng `OrdersService` (22 file) có mock `stockVouchers` phải có method mới nếu chạy `confirm`.
  - [x] `backend/test/orders.e2e.spec.ts` (chốt qua app thật, `initAppOnLoopback`): mock Prisma phải đáp `$queryRaw`/`stockMovement.groupBy`/`stockItem.upsert`/`stockMovement.create` — giữ envelope/HTTP code y nguyên.
- [x] **T6 — Lane DB** (AC: 1, 2, 4–10) — file mới `backend/test/stock-reservation.db.integration.spec.ts` (khuôn `order-stock-issue.db.integration.spec.ts`: helper `wait`, xen kẽ ép buộc bằng tx giữ khoá); chạy `npm run test:db` (tách lane bằng `testPathIgnorePatterns`/regex `.db.integration.spec.ts` — memory `describe-skip-does-not-separate-test-lane`).
- [x] **T7 — Đột biến** (cp backup, KHÔNG `git checkout` — memory `mutation-test-never-git-checkout`; mutant phải compile — memory `mutation-must-compile-or-false-red`); ghi bảng vào Completion Notes. Tối thiểu:
  - bỏ `FOR UPDATE` trong primitive ⇒ ĐỎ lane DB (ca xen kẽ ép buộc);
  - bỏ lệnh gọi trong `confirm` ⇒ ĐỎ unit + DB;
  - bỏ bước giải phóng ⇒ ĐỎ (AC-6);
  - giải phóng theo `qty` dòng cũ thay vì held ⇒ ĐỎ (dựng fixture mà hai số KHÁC nhau, tránh mutant tương đương — memory `mutation-semantically-equivalent-false-survivor`);
  - bỏ skip "đã có reserve" ⇒ unit ĐỎ (unique DB cũng chặn — đó là lớp thứ hai, memory `mutation-hits-one-layer-only`);
  - lọc `tracksStock` ở bước giải phóng ⇒ ĐỎ;
  - xoá CHECK khỏi migration (DB test-only) ⇒ ca 9b/9c ĐỎ;
  - chuyển lệnh gọi ra NGOÀI tx (sau commit) ⇒ ca atomic ĐỎ.
- [x] **T8 — Cổng cuối:** `cd backend && npx tsc --noEmit && npm test && npm run test:db`; eslint/prettier các file đụng (baseline lint đỏ sẵn — đo bằng stash, memory `backend-lint-red-at-baseline`); `cd design-system && npm test` (không đổi — xác nhận). Web/mobile không đổi ⇒ không chạy lại bắt buộc, ghi rõ trong notes. Không `git push`; `git add` đường dẫn cụ thể.

## Dev Notes

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác trong story

- **Chốt và chốt lại KHÔNG bao giờ bị chặn khi thiếu tồn**; chặn chỉ ở khâu xuất kho (docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md).
- Cửa xuất kho nhận `dacoc`, `danggiao`, `thicong`, `dachot`, `nghiemthu`. Đóng `dachot → hoanthanh` và `nghiemthu → hoanthanh` bị chặn 409 khi còn vật tư chưa xuất (commit 85e47da, d355ab7). Đơn đã xuất kho không `mo_lai` được.
- **Ngôn ngữ:** mọi thứ thuộc code (tên biến/hàm/file, comment, tên test, log, commit message) và contract API MỚI (route, field DTO) viết tiếng Anh; chỉ chuỗi người dùng thấy là tiếng Việt. Story ghi tên tiếng Việt cho symbol/route/field MỚI ⇒ dùng tên tiếng Anh tương đương, ghi bảng đối chiếu vào Completion Notes.
- **Tiền hiển thị:** luôn qua `<Money>` / `MoneyText` / `formatVnd` (`83.010.960 đ`); guard `design-system/money/money-render-guard.test.mjs` đỏ nếu in số tiền thô.


### Quyết định của Đại Ca và luật đã chốt — ưu tiên hơn mọi chỗ khác

- **Chốt/re-chốt KHÔNG chặn khi thiếu tồn** (docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md; 6.5 Dev Notes: "Câu 'chặn re-chốt' ở epics 4.6 đã bị quyết định này thay thế ⇒ KHÔNG để 6.6 quyết lại"). AC 4.6 "không đủ khả dụng → chặn re-chốt" là CHẾT — đừng implement.
- **Không đơn nào Hoàn thành khi còn vật tư chưa xuất; đơn đã xuất không mở lại được** (AD-19, commit `85e47da`, `d355ab7`) — giữ nguyên.
- **Luật dự án (extra-instructions):** (1) đường ghi đơn qua scope — `confirm` đã có; (2) mọi thao tác tồn/ledger khoá `SELECT … FOR UPDATE` trong tx + test lane DB (Postgres local 5433, `pns-postgres`), KHÔNG ghi DB khác; (5) guard mới có assert chống-guard-rỗng; (6) e2e dùng `initAppOnLoopback` (`backend/test/util/listen-loopback.ts`); (7) không push, `git add` cụ thể, `package-lock.json` cần `-f` nếu đổi; (8) code/comment/tên test/log/commit tiếng Anh, chỉ chuỗi người dùng thấy tiếng Việt; không đổi tên hàng loạt symbol tiếng Việt cũ.
- Không mã story/AC trong comment/tên test/commit/migration (`review-audit-self-decision.md#Stable Code Artifacts`).

### Files sẽ đổi

| File | Loại |
|---|---|
| `backend/prisma/schema.prisma` | UPDATE — `@@unique` + docstring `StockMovement`/`StockItem` |
| `backend/prisma/migrations/20261021110000_add_stock_movement_reservation_keys/migration.sql` | NEW — unique + CHECK thêm tay |
| `backend/src/inventory/domain/stock-movement-type.ts` | NEW |
| `backend/src/inventory/stock-vouchers.service.ts` | UPDATE — `reserveForOrderInTx`; `issueForOrderInTx` dùng hằng |
| `backend/src/inventory/inventory.module.ts` | UPDATE — docstring |
| `backend/src/orders/orders.service.ts` | UPDATE — 1 lệnh gọi trong tx `confirm` + docstring `confirm`/`revise` |
| `backend/test/stock-reservation.db.integration.spec.ts` | NEW |
| `backend/test/{stock-vouchers.service,orders.service,orders.e2e}.spec.ts` (+ spec khác dựng `OrdersService` chạy `confirm`) | UPDATE |

**Không đổi:** `revise()`, `huyDon()`, `applyTransition`, `allowed-transition.ts`, `stock-items.service.ts` (đường đọc đã đúng), `domain/ton-kho.ts`, `stock-shortfall.ts`, DTO/controller/`openapi.json`, permission registry/`permissions.json`/`PERM`/`AppPerm`, guard `inventory-read-only` và `no-stock-write-in-cancel` (không nới), web, mobile, design-system.

### Hiện trạng phải giữ

- `confirm`: fast-path `dachot` không ghi; cổng atomic + sentinel; đọc dòng TRONG tx sau khoá; một `chotAt` cho cả lượt; publish `OrderConfirmed` rồi `StatusChanged` SAU commit; envelope lỗi 400/403/404/409 y nguyên.
- `issueForOrderInTx`: nhả theo `max(held cấp đơn, 0)` — sau story này `held` = phần `reserve` của version hiện hành (version cũ đã net 0). Không đổi công thức.
- `checkOrderLines`: `reserved` trừ phần giữ của chính đơn — giờ mới có dữ liệu thật; test 6.5 ca B7 phải vẫn xanh.
- Thứ tự khoá `orders → products`; phiếu kho tự do chỉ khoá `products`.

### Tình huống biên đã tính

- Đơn không có dòng tracked ⇒ không khoá, không ghi (chốt vẫn như cũ).
- Dòng trùng sản phẩm ⇒ một dòng `reserve` (gộp bằng `stockIssueLines`).
- Sản phẩm bị tắt `tracksStock` giữa chốt và re-chốt ⇒ phần giữ cũ vẫn được `release`; version mới không giữ cho nó.
- Sản phẩm bị tắt `tracksStock` giữa chốt và xuất ⇒ `issueForOrderInTx` chỉ duyệt dòng tracked nên KHÔNG nhả phần giữ đó — lỗ hổng có sẵn từ 6.4, ngoài phạm vi; ghi Câu hỏi mở 2, không sửa lan.
- Sản phẩm bị soft-delete (`isActive=false`) sau chốt: FK RESTRICT giữ ledger; đường đọc 6.2 vẫn hiện SP còn `reserved ≠ 0`.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Lane DB race: kiểm khả năng chạm khe trước khi đổ lỗi test (memory `db-race-test-cannot-reach-short-pretx-window`); xen kẽ ép buộc bằng tx giữ khoá + `wait(150)` như `order-stock-issue.db.integration.spec.ts:538-626`.
- Publish đếm bằng `toHaveBeenCalledTimes` (memory `publish-count-unasserted-duplicate-survives`).
- Reviewer song song mutate cùng file ⇒ kiểm lại finding trên file hiện tại (memory `parallel-reviewers-mutation-collide`).
- Sửa comment migration SAU khi đã `migrate deploy` ⇒ cập nhật checksum `_prisma_migrations` của DB local 5433 (tiền lệ 6.4).

### Previous Story Intelligence (6.5, 6.4)

- Khuôn primitive inventory chạy trong tx của `OrdersService` (6.4 D1) — event dựng ở inventory, publish ở chủ tx; 6.6 không có event.
- 6.5 review M1: cảnh báo báo giá phải tính trạng thái SAU movement của chính đơn (memory `order-stock-warning-after-own-issue`) — với giữ chỗ, `checkOrderLines` đã trừ `ownHeld`; lane DB AC-7 khẳng định lại bằng dữ liệu thật.
- 6.5 thêm tham số constructor thứ 5 cho `OrdersService` và phải sửa 21 chỗ dựng trong spec — story này KHÔNG thêm dependency (`stockVouchers` đã inject), chỉ thêm method vào mock.
- `prettier --write`/`prisma format` reflow cả file ⇒ chỉ sửa tay hunk của mình. Tx mảng `RepeatableRead`: `groupBy` đòi `orderBy` khi không `await` trực tiếp.
- Prisma 7: `createMany([])` là gotcha (memory `prisma7-empty-createmany-atomic-replace`) — dùng `create` từng dòng như `issueForOrderInTx`, hoặc guard rỗng.

### Git intelligence

`33d6d9f` (6.5 chặn thiếu tồn ở khâu xuất, stock-check), `d355ab7` (chặn đóng khi chưa xuất, xuất ở `nghiemthu`), `0298235`/`15f59ed` (tiền qua `<Money>` — không liên quan), `85e47da` (6.4 xuất gắn đơn — nơi đã viết sẵn nhánh nhả `reserved`). Không dependency mới.

### Latest tech notes

- Stack giữ nguyên (NestJS 11.1, Prisma 7.8, Postgres 18) — không cần tra phiên bản.
- Prisma `groupBy` theo nhiều cột + `having: { qty: { _sum: { gt: 0 } } }` được hỗ trợ; hoặc lọc `> 0` ở JS (tập nhỏ — một đơn).
- `upsert` với `update: {}` hợp lệ (no-op khi đã có) — giữ dưới khoá products để không đua unique `stock_items.product_id`.
- Prisma 7 `migrate diff` dùng `--from-schema/--to-schema`; CHECK thêm tay.

### Project Structure Notes

- File mới kebab-case (guard `naming-convention`). Primitive ở `inventory/`, lệnh gọi ở `orders/` — `inventory/` KHÔNG import `OrdersModule`.
- Lệch spine có chủ đích: unique `(orderVersionId, stockItemId, type)` thay cho `(orderId, orderVersionId)` của AD-19 (D2).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Đơn đã chốt trước story này không có dòng giữ chỗ** (chưa go-live ⇒ chỉ dữ liệu dev/test). Mặc định: không backfill; re-chốt/xuất tự xử lý đúng nhờ `max(held, 0)`. Nếu Đại Ca muốn backfill trước go-live ⇒ script riêng.
2. **SP tắt theo dõi tồn giữa chốt và xuất ⇒ phần giữ không được nhả lúc xuất** (lỗ có sẵn ở `issueForOrderInTx`). Mặc định: ngoài phạm vi, đề xuất xử lý cùng 6.7 (đường giải phóng chung).
3. **Mở lại có nên nhả ngay không?** Mặc định: không — nhả lúc re-chốt (epic AC 3). Đổi sang nhả lúc mở lại thì Khả dụng tăng tạm thời trong lúc sửa — chờ Đại Ca nếu muốn.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6 (592-598), #4.6 (449-453), #6.2 (557-567), #6.7 (600-607)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-19 (158-162), #AD-6 (78), NFR idempotency (190)]
- [Source: backend/prisma/schema.prisma:149-203 (`StockItem`, `StockMovement` + hợp đồng), :205-221 (hợp đồng khoá `StockVoucher`); migrations/20261021080000_add_stock_items_and_movements]
- [Source: backend/src/inventory/stock-vouchers.service.ts:353-500 (`issueForOrderInTx`), :509-543 (`lockTrackedProductsInTx`, `findOrderIssueVoucher`); stock-items.service.ts:56-230; domain/{stock-issue-lines,ton-kho,stock-shortfall}.ts; inventory.module.ts]
- [Source: backend/src/orders/orders.service.ts:120-137 (khoá), :2160-2390 (`confirm`), :2392-2560 (`revise`), :1080-1110 (`getStockCheck`), :1193-1270 (`issueStockIfNeeded`)]
- [Source: backend/test/inventory-read-only.spec.ts (guard a/b/c), no-stock-write-in-cancel.spec.ts, order-stock-issue.db.integration.spec.ts:500-650]
- [Source: _bmad-output/implementation-artifacts/6-5-chan-khi-thieu-ton.md (Dev Notes, review M1); 6-4-xuat-kho-gan-don.md (D1, migration practice)]
- [Source: _bmad-output/project-context.md; _bmad-output/story-automator/extra-instructions-6-dev.txt (luật 1-8)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5[1m])

### Debug Log References

- `npx prisma migrate diff --from-schema <schema cũ> --to-schema prisma/schema.prisma --script` sinh đúng 1 `CREATE UNIQUE INDEX`; CHECK thêm tay. `migrate deploy` lên `pns-postgres` 5433 OK, `migrate status` = up to date.
- Lần chạy đầu sau khi nối `confirm`: 16 ca hermetic đỏ (mock `stockVouchers` thiếu method / repo tx thiếu `groupBy`/`findUnique`) và 8 ca lane DB đỏ (3 spec dựng `OrdersService` với stub `{}` cho kho) — đúng dự kiến, đã sửa fixture.
- Fixture lane DB cũ (`stock-items`, `stock-out-blocked`, `order-stock-issue`) chèn `type` tạm `giu`/`giu_cho`/`giai_phong` và 2 dòng dương cùng version ⇒ vướng CHECK/unique mới ⇒ đổi sang `reserve`/`release`, mỗi dòng một version.

### Completion Notes List

- **Đã làm (D1–D6 đúng thiết kế story):** unique `(order_version_id, stock_item_id, type)` + CHECK `stock_movements_qty_sign`; hằng thuần `STOCK_MOVEMENT_TYPE` (`issueForOrderInTx` dùng `.issue` — cùng giá trị `'xuat'`); primitive `StockVouchersService.reserveForOrderInTx` (đọc held của version KHÁC → khoá `products ORDER BY id FOR UPDATE` → `release` theo held → `reserve` theo `stockIssueLines`, skip nếu version đã có `reserve`; không kiểm/chặn tồn, không đổi `onHand`, không event); một lệnh gọi trong tx `confirm` sau snapshot dòng. `revise`, `huyDon`, đường đọc, DTO/openapi/permission, web/mobile KHÔNG đổi.
- **Bảng đối chiếu tên (luật ngôn ngữ):** story "giữ chỗ" → `reserve`; "giải phóng" → `release`; "xuất" giữ `'xuat'` (dữ liệu cũ) qua `STOCK_MOVEMENT_TYPE.issue`. Không route/field mới.
- **Lệch spine có chủ đích (D2):** AD-19 ghi unique `(orderId, orderVersionId)` — không đặt được trên ledger theo sản phẩm; thay bằng `(orderVersionId, stockItemId, type)`, giữ mục tiêu idempotent.
- **Test thêm:** `test/stock-reservation.spec.ts` (6 ca unit primitive); `orders.service.spec.ts` (+2 ca: gọi đúng 1 lần trong tx SAU snapshot, trước publish; primitive ném ⇒ 0 publish với mock CHẠY thân tx — và khẳng định thêm không gọi ở fast-path `dachot`/thua cổng/đơn rỗng/chốt từ `choduyet`); `orders.e2e.spec.ts` (ca "chốt không bị chặn" giờ khẳng định ghi `reserve`, `onHand` không đổi; +1 ca retry `dachot` không ghi); `test/stock-reservation.db.integration.spec.ts` (22 ca Postgres thật: AC-1,2,4–10,12 + đơn chốt trước story re-chốt không nhả + SP tắt theo dõi vẫn được nhả). AC-3 (`choduyet`) phủ ở unit. AC-12: ca 404 ngoài phạm vi ở lane DB + `orders-write-scope.spec.ts` sẵn có.
- **Bảng đột biến** (cp backup, mutant đều compile — `tsc` ok):

  | Mutant | Unit/e2e | Lane DB |
  |---|---|---|
  | bỏ `FOR UPDATE` trong primitive | ĐỎ 1 (regex SQL) | ĐỎ 1 (xen kẽ ép buộc) |
  | bỏ lệnh gọi trong `confirm` | ĐỎ 4 | ĐỎ 14 |
  | bỏ bước `release` | ĐỎ 1 | ĐỎ 3 |
  | `release` theo qty dòng cũ thay vì held | ĐỎ 1 | xanh — tương đương trên mọi dữ liệu chạm được qua `confirm` (held = tổng dòng tracked lúc chốt; đơn chưa có ledger bị lọc `held > 0` trước) |
  | bỏ skip "đã có reserve" | ĐỎ 1 | xanh — nhánh không chạm được qua `confirm` (fast-path + cổng); unique DB là lớp thứ hai |
  | lọc `tracksStock` ở bước release | ĐỎ 2 | ĐỎ 1 |
  | lệnh gọi ra ngoài tx (không await, client gốc) | ĐỎ 4 | ĐỎ 12 |
  | DROP CHECK `stock_movements_qty_sign` (DB local, đã khôi phục) | — | ĐỎ 6 |
  | DROP unique index (DB local, đã khôi phục) | — | ĐỎ 1 |
- **Cổng cuối:** `npx tsc --noEmit` sạch; `npm test` 94 suite / 1779 ca xanh (gồm guard `inventory-read-only`, `no-stock-write-in-cancel`, `no-unscoped-order-write`, drift `openapi.json`/`permissions.json` — không đổi byte); `npm run test:db` 20 suite / 199 ca xanh; `design-system npm test` 447/447. ESLint: các file đụng sạch, trừ `orders.e2e.spec.ts` (16) và `orders.service.spec.ts` (2) — đúng bằng số lỗi baseline (prettier nợ sẵn), không thêm lỗi; chỉ áp hunk của mình, không reflow cả file. Web/mobile không đổi ⇒ không chạy lại.
- **Câu hỏi mở giữ mặc định của story:** (1) không backfill đơn đã chốt trước story; (2) SP tắt theo dõi giữa chốt và xuất ⇒ `issueForOrderInTx` không nhả phần giữ — lỗ có sẵn từ 6.4, đề xuất xử lý cùng 6.7; (3) mở lại không nhả.
- Không commit, không push.

### File List

- `backend/prisma/schema.prisma` (UPDATE)
- `backend/prisma/migrations/20261021110000_add_stock_movement_reservation_keys/migration.sql` (NEW)
- `backend/src/inventory/domain/stock-movement-type.ts` (NEW)
- `backend/src/inventory/stock-vouchers.service.ts` (UPDATE)
- `backend/src/inventory/inventory.module.ts` (UPDATE — docstring)
- `backend/src/orders/orders.service.ts` (UPDATE)
- `backend/test/stock-reservation.spec.ts` (NEW)
- `backend/test/stock-reservation.db.integration.spec.ts` (NEW)
- `backend/test/orders.service.spec.ts` (UPDATE)
- `backend/test/orders.e2e.spec.ts` (UPDATE)
- `backend/test/orders.db.integration.spec.ts` (UPDATE — `StockVouchersService` thật + dọn ledger)
- `backend/test/orders-write-scope.db.integration.spec.ts` (UPDATE — idem)
- `backend/test/discount-approvals.db.integration.spec.ts` (UPDATE — idem)
- `backend/test/stock-items.db.integration.spec.ts` (UPDATE — fixture ledger theo type/unique mới)
- `backend/test/stock-out-blocked.db.integration.spec.ts` (UPDATE — `giu` → `reserve`)
- `backend/test/order-stock-issue.db.integration.spec.ts` (UPDATE — `giu` → `reserve`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE — trạng thái story)

## Change Log

- 2026-10-21: Giữ chỗ tồn khi chốt đơn — ledger `reserve`/`release` idempotent (unique + CHECK), nối vào `confirm`, test unit/e2e/lane DB + bảng đột biến. Status → review.
- 2026-10-21: Senior Developer Review (AI) — sửa race chốt bản cũ (đọc lại `currentVersionId` trong tx ⇒ 409), thêm 3 ca lane DB (khoá product chỉ còn ở phần giữ cũ, version mới chỉ còn dòng tự do, race bản cũ) + 1 ca unit, siết 1 assert. Status → done.

## Senior Developer Review (AI)

**Reviewer:** AI (Claude, `/ck:code-review` + subagent code-reviewer) cho Đại Ca — 2026-10-21
**Kết quả:** Approve sau khi sửa. 0 CRITICAL. Mọi AC 1–13 có bằng chứng (unit/e2e/lane DB); task [x] đều thật; File List khớp git (cộng file sửa ở review, dưới).

### Findings & xử lý

| # | Mức | Finding | Xử lý |
|---|---|---|---|
| R1 | MEDIUM | Luật 2: product CHỈ còn ở phần giữ của version cũ (không có trong dòng version mới) — đột biến bỏ nó khỏi tập khoá `FOR UPDATE` ⇒ lane DB vẫn xanh 202/202 (chỉ unit canh). | Thêm ca xen kẽ ép buộc `re-confirm also locks a product only the OLD version holds…` — tx khác giữ khoá SP-B, re-chốt phải CHỜ. Đột biến ⇒ ĐỎ. |
| R2 | MEDIUM | Ca biên chưa phủ: version mới chỉ còn dòng tự do ⇒ tập khoá chỉ có product đang giữ; nếu tập đó rơi mất thì `return` sớm, không release. | Thêm ca `a new version with no product line left (free text only) still releases the old hold`. Đột biến tập khoá ⇒ ĐỎ. |
| R3 | MEDIUM | Race có sẵn, nay để lại hậu quả vĩnh viễn trong ledger: `confirm` lấy `versionId` từ `before` (đọc ngoài tx), cổng chỉ so `status`. Chốt + mở lại chen vào khe ⇒ request cũ qua cổng (`baogia`), snapshot + giữ chỗ bản ĐÃ CHẾT, bản hiện hành không đóng băng, phần giữ bản cũ không bao giờ nhả. | `confirm` đọc lại đơn TRONG tx sau khoá (khuôn `addLine`), lệch con trỏ ⇒ 409 `Báo giá vừa được mở lại sang bản mới — tải lại rồi chốt lại.` (rollback cả cổng). Ca unit + ca lane DB tái hiện race thật (chen chốt + mở lại vào lần đọc dòng ngoài tx). Gỡ kiểm ⇒ ĐỎ cả hai lane. |
| R4 | LOW | Assert "reserve SAU snapshot dòng" lặp qua `invocationCallOrder` của `orderLineItem.update` — xanh rỗng nếu không có update nào. | Thêm `toHaveBeenCalledTimes(3)` ngay trong ca đó. |
| R5 | MEDIUM — **HOÃN, cần Đại Ca** | SP bị tắt `tracksStock` giữa chốt và xuất/đóng đơn ⇒ `issueForOrderInTx` chỉ nhả dòng tracked, cổng đóng `→ hoanthanh` qua khi không còn dòng tracked ⇒ phần giữ treo vĩnh viễn (màn Tồn kho vẫn hiện `reserved`). Lỗ có từ 6.4, nay mới chạm được vì 6.6 sinh phần giữ thật. | Giữ mặc định của story (Câu hỏi mở 2): sửa trọn cần ghi ledger ở MỌI cạnh đóng đơn + đổi đường xuất — vượt phạm vi, và có câu hỏi sản phẩm (SP đã tắt theo dõi có còn bắt xuất trước khi đóng, hay nhả im lặng lúc đóng?). Đề xuất gộp vào 6.7 (đường giải phóng chung). |
| R6 | LOW — ghi cho 6.7 | Mở lại KHÔNG nhả ⇒ đơn mở lại rồi huỷ đang giữ ở version CŨ, trong khi `OrderCancelled` mang version hiện hành. | Handler huỷ 6.7 phải nhả theo CẤP ĐƠN (mọi version, `SUM > 0`), không theo `orderVersionId` của event. |
| R7 | LOW — không sửa | `reserveForOrderInTx` chạy upsert + `findUnique` + `create` mỗi sản phẩm (N nhỏ, giới hạn theo số dòng một đơn); nhánh skip "đã có reserve" giờ không chạm được qua `confirm` (fast-path + cổng + kiểm version). | Chấp nhận: story yêu cầu skip; unique DB là lưới thứ hai. |
| R8 | LOW — không sửa | CHECK mới từ chối dòng `type` tạm cũ (`giu`, `giu_cho`, `giai_phong`) nếu DB dev nào còn sót từ test cũ ⇒ `migrate deploy` lỗi ở DB đó. | Prod chưa từng có dòng ledger; DB local 5433 đã migrate sạch. Gặp ở DB dev khác ⇒ xoá dòng test sót rồi deploy lại. |

### Đột biến kiểm luật (cp backup, không `git checkout`; mutant đều compile)

| Mutant | Unit/e2e | Lane DB |
|---|---|---|
| `confirm` bỏ phạm vi (`findScopedOrThrow` với quyền `view_all` giả) | ĐỎ 3 | ĐỎ 3 |
| bỏ `FOR UPDATE` trong `reserveForOrderInTx` | ĐỎ 1 | ĐỎ 1 |
| bỏ product đang giữ khỏi tập khoá | ĐỎ 1 | trước review: **xanh**; sau review: ĐỎ 2 |
| gỡ kiểm `currentVersionId` trong tx (fix R3) | ĐỎ 1 | ĐỎ 1 |

### Cổng cuối (sau fix)

`npx tsc --noEmit` sạch; `npm test` 94 suite / 1780 ca xanh; `npm run test:db` 20 suite / 205 ca xanh (Postgres local 5433). ESLint các file đụng: chỉ còn 2 lỗi prettier baseline ở `orders.service.spec.ts:1164-1165` (commit `85254af9`, không phải của story). Web/mobile/design-system không đổi.

### Files sửa ở review

- `backend/src/orders/orders.service.ts` — đọc lại đơn trong tx của `confirm`, 409 khi lệch version.
- `backend/test/orders.service.spec.ts` — +1 ca race version, siết assert thứ tự.
- `backend/test/stock-reservation.db.integration.spec.ts` — +3 ca (R1, R2, R3).
