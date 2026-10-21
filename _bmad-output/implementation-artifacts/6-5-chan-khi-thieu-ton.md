---
baseline_commit: d355ab7510b411991095534ffe0d8c0348d704a2
---

# Story 6.5: Chặn khi thiếu tồn — ở khâu XUẤT, KHÔNG chặn chốt

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a người có quyền nhập/xuất kho (`inventory.manage` — preset `KHO_GIAO`, `QUAN_LY`, `ADMIN`, `SUPER_ADMIN`) và sale lập báo giá (`quotes.create_edit`),
I want hệ thống cảnh báo sớm thiếu tồn ngay lúc thêm dòng vào báo giá (nhưng vẫn cho chốt), cảnh báo và chặn khi phiếu xuất vượt tồn thật, và phát sự kiện `StockOutBlocked` mỗi lần xuất bị chặn,
so that không xuất quá tồn gây sai lệch kho, sale biết trước món nào phải nhập, và kho/kế toán được báo khi xuất bị chặn (Epic 9 gửi noti #10).

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

### 1. Hiện trạng (scout 2026-10-21, sau commit `d355ab7`)

Phần lớn "chặn" ĐÃ CÓ — story này KHÔNG viết lại nó:

- **Chặn dưới khoá đã có ở CẢ HAI đường xuất** (`backend/src/inventory/stock-vouchers.service.ts`):
  - phiếu xuất tự do 6.3 — `taoPhieu` (`:184-318`), kiểm tồn `:210-241`;
  - xuất gắn đơn 6.4 — `issueForOrderInTx` (`:339-469`), kiểm tồn `:378-395`;
  - cùng helper `insufficientStockError` (`:90-102`), cùng message `INSUFFICIENT_STOCK_MESSAGE` = `'Không đủ tồn — không thể xuất quá số tồn hiện có.'` (`:86-87`), 409 `CONFLICT`, `fieldErrors[] { field: 'lines.{i}.qty', code: INSUFFICIENT_STOCK, message: 'Còn {onHand} {unit}, không xuất được {qty}.' }`. Lưới cuối: CHECK `stock_items_on_hand_non_negative`.
  - Ném TRONG tx ⇒ rollback toàn bộ (kể cả transition "Đã giao" và ảnh — 6.4 D10).
- **Chưa có:** `StockOutBlocked` (chỉ nhắc trong docstring `backend/src/events/domain-event.ts:12`); cảnh báo tồn ở màn báo giá (6.2 🛑6 chuyển sang đây, `6-2-…md:53-60`); cảnh báo TRƯỚC khi bấm ở khối xem trước xuất kho (6.4 cố ý "Tồn thật chỉ để đếm, không phải tín hiệu" — `web/src/screens/orders/stock-issue-preview.tsx:5-8`, `orders-port.ts:203`).
- **Chốt không chặn** — `confirm()` (`orders.service.ts`) hôm nay không đọc tồn. Chưa có test nào KHẲNG ĐỊNH điều đó ⇒ story này khoá bằng test (AC-1).
- Đường đọc tồn 6.2: `GET /stock-items?productIds=` (`stock-items.controller.ts`, gate OR `inventory.manage` | `quotes.create_edit`), domain `inventory/domain/ton-kho.ts#tinhTonKho` (`khaDung = onHand − reserved`, `canNhap`, `tinhTrang du|het|am`); `stock-items.service.ts` đọc trong tx mảng `RepeatableRead` (6.4 D11; guard `inventory-read-only.spec.ts` (b) chỉ cho dạng này).
- Hôm nay `reserved = 0` mọi sản phẩm (6.6 chưa ghi movement giữ chỗ). Dòng báo giá nháp thuộc `Order.currentVersionId` (version tạo cùng đơn).
- `InventoryModule` `exports: [StockVouchersService]`; `OrdersModule` import `InventoryModule`; `inventory/` KHÔNG BAO GIỜ import `OrdersModule`; guard (c) cấm `src/inventory/**` ghi bảng đơn.
- `AuditService.record` chấp nhận `target` vắng (`targetType/targetId` = null — `audit.service.ts:25-26`).

### 2. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

**D1 — Lỗi thiếu tồn thành exception CÓ KIỂU mang dữ kiện chặn.**
`backend/src/inventory/insufficient-stock.exception.ts`: `class InsufficientStockException extends AppException` (status 409, `ErrorCode.CONFLICT`, message `INSUFFICIENT_STOCK_MESSAGE`, `fieldErrors` y hệt hôm nay) + `readonly shortages: readonly { productId: string; qty: number; onHand: number }[]` (số đọc DƯỚI khoá). Cả hai chỗ ném hiện có đổi sang ném class này — envelope client nhận KHÔNG đổi một byte (e2e 6.3/6.4 phải xanh nguyên). Không đặt trong `inventory/domain/` (domain thuần không import Nest; `AppException` kế thừa `HttpException`). Chỉ lỗi THIẾU TỒN dùng class này — 403 thiếu quyền, 409 trạng thái, 409 "chưa xuất kho — xuất kho trước khi hoàn thành" (6.4 D12/D13) KHÔNG phải xuất bị chặn ⇒ không event.

**D2 — `StockOutBlocked` publish SAU rollback, ĐÚNG MỘT LẦN mỗi lượt xuất bị chặn, bởi chủ transaction.**
Lỗi ném trong tx ⇒ tx rollback ⇒ không có "sau commit"; event là sự thật "đã có người thử xuất và bị chặn", không phụ thuộc commit. Ai mở tx thì bắt:
- `StockVouchersService.taoPhieu` (phiếu xuất tự do): bọc `$transaction` bằng `try/catch`; `instanceof InsufficientStockException` ⇒ publish `StockOutBlocked` (không `orderId`) ⇒ ném lại nguyên lỗi.
- `OrdersService.issueStock` (cửa riêng) và `OrdersService.chuyenTrangThaiThuCong` với `xong_giao` (cửa "Đã giao"): bắt quanh `$transaction` hiện có ⇒ publish `StockOutBlocked` kèm `orderId`/`orderVersionId` ⇒ ném lại. Ở `chuyenTrangThaiThuCong` nhánh `THU_CONG_GATE_THUA` giữ nguyên (không phải chặn tồn). Một helper private dùng chung cho hai method của `OrdersService`.
- Event dựng bằng hàm thuần trong `inventory/domain/stock-out-blocked-event.ts` (khuôn `stock-issued-event.ts`): `type = 'StockOutBlocked'`, `actorAccountId` = người bấm, `target` = `{ type: 'Order', id: orderId }` khi gắn đơn, VẮNG khi phiếu tự do; `after = { orderId?, orderVersionId?, lines: [{ productId, qty, onHand }] }` (chỉ các dòng thiếu); `occurredAt` = cùng biến `occurredAt` của lượt (cửa "Đã giao" đã có một biến cho cả lượt).
- Phiếu xuất TỰ DO cũng publish (Câu hỏi mở 5 của 6.3 — chốt "cả hai"): AC gốc nói "một lần xuất bị chặn", không giới hạn gắn đơn; Epic 9 lọc theo `orderId` nếu cần.
- Không FCM, không gọi audit trực tiếp (AD-18) — `AuditSubscriber` tự ghi 1 dòng audit.

**D3 — Khối xem trước xuất kho CẢNH BÁO trước, backend tính (AD-2).**
`GET /orders/:id/stock-issue` (`OrderStockIssueViewDto`, 6.4) thêm field additive:
- mỗi dòng `lines[]`: `shortfall: number` (= `max(qty − onHand, 0)`, ≥ 0, backend tính);
- cấp view: `blocked: boolean` (= có dòng `shortfall > 0`; `false` khi `issued`).
Tính bằng hàm thuần MỚI `inventory/domain/stock-shortfall.ts#issueShortfall(qty, onHand)` — dùng CHUNG với `insufficientStockError` (bộ kiểm dưới khoá) để hai nơi không lệch luật (DRY). Xem trước vẫn là ĐỌC THUẦN không khoá — chỉ là cảnh báo; quyết định cuối vẫn là kiểm dưới khoá. `canIssue` GIỮ NGUYÊN nghĩa 6.4 (trạng thái ∧ có dòng tồn ∧ quyền) — không gộp `blocked` vào, để màn phân biệt "không được xuất" với "được xuất nhưng đang thiếu hàng".

**D4 — UI khối xem trước theo mockup: banner CHẶN + nút khoá.**
Khi `blocked` (web `stock-issue-preview.tsx`, mobile `stock_issue_preview.dart` — một khối, hai chỗ dùng):
- `Banner`/`AppBanner` danger: **"CHẶN xuất kho — {name} không đủ tồn thật (cần {qty}, còn {onHand}). Đơn này đã được chốt dù thiếu hàng; chặn chỉ nằm ở đây. Nhập hàng trước khi xuất."** — một câu cho mỗi dòng thiếu (mockup `all-screens.html:3859`); dòng thiếu trong bảng có lỗi dưới dòng "Thiếu {shortfall} {unit}".
- Nút xác nhận KHOÁ (mockup `:3861` — `opacity:.55; cursor:not-allowed`): Sheet "Xuất kho" ở Chi tiết đơn ⇒ nút đổi chữ "Xuất kho (bị chặn)" + `disabled`; màn Chuyển trạng thái bước `xong_giao` ⇒ nút "Xác nhận xuất kho & chuyển Đã giao" `disabled` (bước Đã giao không đi được khi thiếu — server cũng rollback).
- Client KHÔNG so `qty`/`onHand` — chỉ đọc `blocked`/`shortfall` (text-guard 6.4 `stock-issue.test.mjs` vẫn cấm so/trừ).
- 409 thật (xem trước cũ, đua tranh) vẫn đi đường 6.4: banner message backend + lỗi đúng dòng + đọc lại bảng (R3 của review 6.4).
- Hệ quả đã chấp nhận: khi xem trước đã báo `blocked`, người dùng không bấm được ⇒ `StockOutBlocked` chỉ phát cho lượt THỰC SỰ tới server (API, xem trước cũ, đua tranh, phiếu tự do 6.3). Xem Câu hỏi mở 1.

**D5 — Cảnh báo sớm ở màn báo giá: endpoint ĐỌC theo đơn, backend so sánh.**
`GET /orders/:id/stock-check` → `OrderStockCheckDto { lines: OrderStockCheckLineDto[] }`, mỗi phần tử một SẢN PHẨM theo dõi tồn của version hiện hành (gộp theo `productId` như `stockIssueLines`, thứ tự `name` rồi `productId`): `{ productId, name, unit, qty, onHand, reserved, available, shortfall, status }`:
- `reserved` = tổng ledger của sản phẩm TRỪ phần đang giữ cho CHÍNH đơn này (`SUM(stock_movements.qty WHERE order_id = đơn)`) — để khi 6.6 giữ chỗ lúc chốt, đơn không tự cảnh báo chính nó. Hôm nay mọi số = 0 nhưng công thức phải đúng từ đầu.
- `available = onHand − reserved` (có thể âm); `shortfall = max(qty − available, 0)`; `status: 'enough' | 'short'` (`short` ⇔ `shortfall > 0`).
- Hàm thuần MỚI `inventory/domain/stock-shortfall.ts#quoteStockLine({ qty, onHand, reserved })` (cùng file D3).
- Dòng không có `productId` (dòng tự do/công lắp) hoặc `tracksStock = false` ⇒ không có trong `lines` (không cảnh báo).
- Quyền: `@RequireAnyPermissions(PERM.quotesCreateEdit, PERM.inventoryManage)` (cùng gate OR của `GET /stock-items`); `findScopedOrThrow` ĐẦU TIÊN (đọc theo id — ngoài phạm vi ⇒ 404 cùng message). Không tiền, không giá vốn.
- Chia việc theo ranh giới module: `OrdersService.getStockCheck(caller, quyen, orderId)` đọc đơn + dòng version hiện hành (chỉ `orders/` đọc dòng đơn), gọi `StockItemsService.checkOrderLines(orderId, orderLines)` (method MỚI, `inventory/`, đọc trong tx mảng `RepeatableRead` như `lietKeTonKho` — guard (b) đã cho đúng dạng này). `InventoryModule.exports` thêm `StockItemsService` + sửa docstring module (lý do thứ hai).
- Đã cân nhắc và **loại**: (a) nhét vào `POST /orders/preview-total` — đó là hàm pricing thuần stateless không chạm Prisma (AD-16), dòng không mang `productId`; (b) client gọi `GET /stock-items?productIds=` rồi tự so `qty` với `khaDung` — vi phạm AD-2 + text-guard `inventory.test.mjs`.

**D6 — UI màn báo giá (web `CreateQuoteScreen.tsx`, mobile `create_quote_screen.dart`) theo mockup `:1385-1412` (web) / `:1550-1557` (mobile).**
- Gọi `getStockCheck(order.id)` sau mỗi lần tải đơn / thêm-sửa-xoá dòng (cùng chỗ đang làm mới `previewTotal`), chống trả lời cũ bằng vé (khuôn R9 6.4). Lỗi/403 ⇒ ẨN gợi ý tồn, KHÔNG banner lỗi, KHÔNG chặn giỏ (cảnh báo là phụ; giỏ hàng không bao giờ hỏng vì kho — bất biến k của màn).
- Mỗi dòng giỏ có sản phẩm trong `lines`: nhãn tồn — `status === 'enough'` ⇒ **"Kho còn {available}"** (tone ok); `short` ⇒ **"Cần nhập {shortfall}"** (tone danger). Thêm MỘT prop hiển thị tuỳ chọn cho `CartLineRow` (web) / `AppCartLineRow` (mobile), ví dụ `stockHint?: { label: string; short: boolean }` — chỉ hiển thị, không ảnh hưởng tiền, cùng tên/ngữ nghĩa hai nền tảng. Dòng không có trong `lines` ⇒ không nhãn.
- Có ≥1 dòng `short` ⇒ `Banner`/`AppBanner` tone warn trên giỏ, mỗi món một câu: **"{name} — Còn {onHand} · Đã hứa {reserved} · Cần nhập {shortfall}. Vẫn chốt đơn được; chặn nằm ở khâu xuất kho."**
- Nút "Chốt" KHÔNG đổi trạng thái theo tồn (không disable, không dialog thêm) — AC-1.
- Chuỗi hiển thị dựng từ field backend; client không cộng/trừ/so số tồn.

**D7 — Không đổi luồng chốt.** `confirm()`/`revise()` không thêm đọc tồn. Ghi chú cho 6.6: epics 4.6 nói "không đủ khả dụng → chặn re-chốt" — mâu thuẫn với "chốt không chặn" của 6.5/AD-19; story này KHÔNG xử lý, ghi vào Câu hỏi mở 3.

### 3. Phạm vi

| Việc | Story |
|---|---|
| `InsufficientStockException` + `StockOutBlocked` (cả xuất tự do lẫn gắn đơn); `blocked`/`shortfall` ở xem trước + banner/nút khoá; `GET /orders/:id/stock-check` + nhãn/banner ở báo giá; test khoá "chốt không chặn" | **6.5** |
| Ghi `StockMovement` giữ chỗ lúc chốt / re-chốt (và luật chặn re-chốt nếu có) | 6.6 |
| Phiếu nhập trả khi huỷ đơn đã xuất | 6.7 |
| Gửi push noti #10 từ `StockOutBlocked` | Epic 9 |
| Cảnh báo tồn trên form phiếu xuất TỰ DO 6.3 trước khi lưu | KHÔNG làm — 409 theo dòng của 6.3 đã đủ; YAGNI |
| Màn Tồn kho banner "CHẶN xuất DH-…" (mockup mobile `:3886`) | KHÔNG làm — màn Tồn kho không có lối xuất gắn đơn (lệch có chủ đích từ 6.4) |

---

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md:587-590`)

- **Given** một Đơn chốt khi thiếu tồn, **When** lưu Đơn, **Then** CHO CHỐT (không chặn lúc chốt) — cảnh báo sớm ngay lúc thêm dòng vào báo giá ("Kho còn 5"), nhưng chốt không chặn (§2).
- **Given** một phiếu xuất vượt tồn hiện có, **When** lưu, **Then** hệ thống CẢNH BÁO và **CHẶN ở khâu XUẤT KHO**, không cho xuất quá tồn, hiển thị "Không đủ tồn — không thể xuất quá số tồn hiện có." (FR-26, §2, UX-DR-19).
- **Given** một lần xuất bị chặn, **When** xử lý, **Then** publish event `StockOutBlocked` qua EventBus (không đẩy FCM trực tiếp) (AD-18).
- **Given** thao tác xuất, **When** kiểm tồn, **Then** kiểm và trừ tồn thực hiện ở backend, client chỉ hiển thị kết quả (AD-2).

### AC dẫn xuất (đo được)

1. **Chốt không chặn (khoá bằng test):** lane DB — đơn có dòng sản phẩm theo dõi tồn `onHand = 0` ⇒ `confirm` thành công (`dachot`), `stock_items`/`stock_vouchers` không đổi; e2e — chốt đơn mà `getStockCheck` trả `short` ⇒ 200. Đột biến: chèn kiểm tồn vào `confirm()` ném 409 ⇒ ít nhất một ca ĐỎ.
2. **Exception có kiểu (D1):** `taoPhieu` (xuất) và `issueForOrderInTx` ném `InsufficientStockException` với `shortages` = đúng các dòng thiếu, số `onHand` đọc dưới khoá. Envelope HTTP KHÔNG đổi: e2e 6.3 (`stock-vouchers.e2e.spec.ts`) và 6.4 (`order-stock-issue.e2e.spec.ts`, `orders.e2e.spec.ts` ca `xong_giao` thiếu tồn) xanh nguyên, `code === 'CONFLICT'`, `message` nguyên văn, `fieldErrors[].code === 'INSUFFICIENT_STOCK'`, `field` dạng `lines.N.qty`.
3. **Domain thuần** `inventory/domain/stock-shortfall.ts`: `issueShortfall(qty, onHand)` và `quoteStockLine({ qty, onHand, reserved })` → `{ available, shortfall, status }`. Unit: đủ đúng biên (`qty === onHand` ⇒ 0 / `enough`), thiếu, `onHand = 0`, `reserved > onHand` (available âm ⇒ shortfall = qty − available), không bao giờ âm. `insufficientStockError` dùng `issueShortfall` (một luật). `inventory/domain/stock-out-blocked-event.ts` — class `StockOutBlocked` (D2), không type Prisma/Nest.
4. **Publish `StockOutBlocked` (D2)** — unit (mock Prisma, mock tx CHẠY thân rồi mới ném — memory `mock-rejected-transaction-false-green`):
   - phiếu xuất tự do thiếu ⇒ `eventBus.publish` đúng 1 lần với `StockOutBlocked` (`target` vắng, `after.orderId` vắng, `lines` chỉ dòng thiếu), lỗi ném lại là CHÍNH instance đó; KHÔNG `StockVoucherCreated`.
   - cửa riêng `issueStock` thiếu ⇒ 1 `StockOutBlocked` (`target { type: 'Order', id }`, `orderVersionId`), 0 `StockIssued`.
   - cửa "Đã giao" thiếu ⇒ 1 `StockOutBlocked`, 0 `StatusChanged`, 0 `StockIssued`; `occurredAt` của event === biến `occurredAt` của lượt.
   - mỗi loại đếm bằng `toHaveBeenCalledTimes` (memory `publish-count-unasserted-duplicate-survives`).
   - KHÔNG publish khi: đủ tồn; phiếu NHẬP lỗi `PRODUCT_NOT_STOCKABLE`; 403 thiếu `inventory.manage`; 409 trạng thái; 409 "không có vật tư theo dõi tồn"; 409 đóng đơn chưa xuất (`STOCK_NOT_ISSUED_MESSAGE`); thua cổng `THU_CONG_GATE_THUA`; lỗi DB khác (vd unique). Mỗi nhánh một ca.
   - E2E (`initAppOnLoopback`): mock `auditLog` + assert đúng 1 dòng audit `StockOutBlocked` cho mỗi đường (tự do / cửa riêng / Đã giao) — memory 6.3 Debug.
5. **Lane DB** `backend/test/stock-out-blocked.db.integration.spec.ts` (Postgres 5433, khuôn `order-stock-issue.db.integration.spec.ts`, tự dựng/dọn fixture):
   - xuất tự do vượt tồn ⇒ 409; `onHand` nguyên; 0 phiếu mới; đúng 1 hàng `audit_logs` `type='StockOutBlocked'` (subscriber thật).
   - cửa riêng + cửa "Đã giao" thiếu (2 sản phẩm: một đủ, một thiếu) ⇒ đơn giữ trạng thái, 0 phiếu, `onHand` cả hai nguyên, 1 hàng audit `StockOutBlocked` có `target_id` = đơn, `after.lines` chỉ sản phẩm thiếu với `onHand` thật.
   - **Xen kẽ ÉP BUỘC** (memory `atomic-replace-needs-for-update-lock`): tx thô A khoá `products` + `UPDATE stock_items SET on_hand = 0` chưa commit; gọi cửa riêng B (không await); commit A; await B ⇒ 409 + `StockOutBlocked.after.lines[].onHand === 0` (số dưới khoá, không phải số trước khoá).
   - `GET /orders/:id/stock-check` (service thật): `reserved` loại phần giữ của chính đơn — seed thô `stock_movements` +3 cho đơn X và +2 cho đơn Y cùng sản phẩm ⇒ check của X thấy `reserved = 2`, của Y thấy `3`; số dẫn xuất in ra bằng hàm thật (memory `handpicked-fixture-numbers-hide-formula-bugs`).
6. **Xem trước (D3):** `getStockIssue` trả `lines[].shortfall` + `blocked`. Unit: đủ ⇒ 0/`false`; thiếu một dòng ⇒ dòng đó `shortfall > 0`, `blocked: true`; đã xuất ⇒ `blocked: false`, `lines: []`. E2E: field có trong body. DTO `@ApiProperty` + mô tả "cảnh báo, không phải quyết định — server kiểm lại dưới khoá".
7. **Kiểm tồn báo giá (D5):** `GET /orders/:id/stock-check` (`ParseUUIDPipe`):
   - 200 `quotes.create_edit` (THO_KS sở hữu đơn) và `inventory.manage`; 403 thiếu cả hai; 401; 404 ngoài phạm vi (cùng message với id lạ); 400 id không UUID.
   - Dòng tự do / `tracksStock = false` không xuất hiện; hai dòng cùng sản phẩm gộp `qty`; thứ tự `name` rồi `productId`.
   - `findScopedOrThrow` gọi đầu tiên (unit thứ tự op); `orders/` không đọc `stock_items`/`stock_movements` trực tiếp (chỉ qua `StockItemsService`); `StockItemsService.checkOrderLines` đọc trong `$transaction([...], { isolationLevel: RepeatableRead })` — guard `inventory-read-only` (b) xanh nguyên, (c) xanh nguyên.
   - Không field tiền/giá vốn trong response.
8. **Guard:** `no-unscoped-order-write.spec.ts` — nếu máy quét coi `getStockCheck` là đường chạm đơn thì thêm vào assert nhận diện; `inventory-read-only` (b)/(c), `no-stock-write-in-cancel`, `no-order-status-write-outside-transition`, `no-direct-side-effect-outside-eventbus`, `no-handler-without-require-permissions`, `naming-convention`, `orders-module-wiring` xanh. `orders-module-wiring` khẳng định "CHỈ OrdersService được export" — không đổi `OrdersModule.exports`.
9. **OpenAPI** sinh lại (`npm run openapi:gen`), `openapi.json` commit, `openapi-drift.spec.ts` xanh.
10. **Web:**
    - `orders-port.ts`: `OrderStockIssueLine.shortfall`, `OrderStockIssueView.blocked`, `getStockCheck(orderId): Promise<OrderStockCheck>` + kiểu `OrderStockCheck`/`OrderStockCheckLine` mirror DTO từng chữ (đối chiếu `openapi.json`); sửa docstring `onHand` ("NOT a go/no-go signal" ⇒ trỏ tới `shortfall`/`blocked`). Fake: đơn nháp có một dòng `enough`, một dòng `short` (tên DÀI NHẤT), một dòng tự do; đơn chưa xuất có dòng thiếu ⇒ `blocked: true`; `issueStock`/Đã giao fake trên đơn đó ⇒ 409 `INSUFFICIENT_STOCK` (vai backend).
    - `stock-issue-preview.tsx` + `OrderDetailScreen.tsx` + `OrderStatusChangeScreen.tsx`: D4. `CreateQuoteScreen.tsx` + `CartLineRow.tsx`: D6.
    - Test vitest+jsdom: mở rộng `web/src/test/order-stock-issue.test.tsx` (banner CHẶN đúng câu, nút "Xuất kho (bị chặn)" disabled, port `issueStock` KHÔNG được gọi khi bấm; bước Đã giao disabled khi `blocked`; không `blocked` ⇒ như cũ) + file mới `web/src/test/quote-stock-check.test.tsx` (nhãn "Kho còn N"/"Cần nhập N"; banner warn đúng câu; nút Chốt vẫn bấm được và gọi `confirmOrder`; `getStockCheck` lỗi ⇒ không banner lỗi, giỏ nguyên; trả lời cũ bị bỏ khi dòng đổi). Không màn mới ⇒ `SCREEN_COUNT` không đổi. `cd web && npm run typecheck && npm test && npm run build` xanh.
11. **Mobile** (parity, cùng câu chữ): `orders_port.dart` + `fake_orders_port.dart` (field + method + kiểu); `stock_issue_preview.dart`, `order_detail_screen.dart`, `order_status_change_screen.dart`, `create_quote_screen.dart`, `cart_line_row.dart` (prop hiển thị). Widget test: mở rộng `mobile/test/screens/orders/order_stock_issue_test.dart` + mới `mobile/test/screens/orders/quote_stock_check_test.dart` — các nhánh như web + `for width in [320, 360]` với tên DÀI NHẤT và nhãn "Cần nhập" ⇒ `tester.takeException()` null; fixture bật mọi điều kiện bao ngoài (memory `widget-test-gate-unreachable-outer-condition`); `AppPermissionKeys.*` không `AppPerm.*` (memory `mobile-screens-use-apppermissionkeys-not-appperm`). `flutter analyze` + `flutter test` xanh.
12. **Parity + text-guard (design-system):**
    - `session/parity.test.mjs`: `getStockCheck` chữ ký hai bên; tập field `OrderStockCheck*`, `shortfall`, `blocked` so trong THÂN `interface`/`class` (khuôn R5 6.4, regex `\{[\s\S]*?\n\}`) + đối chiếu `openapi.json`. Prop `stockHint` của `CartLineRow` khớp hai bên (khuôn `orders.test.mjs:221`).
    - `screens/stock-issue.test.mjs` + text-guard mới `screens/quote-stock-check.test.mjs`: trên code đã strip comment của các khối/màn đụng tới — cấm so sánh/trừ/cộng giữa `qty`, `onHand`, `reserved`, `available`, `shortfall`, `khaDung` (client chỉ đọc `status`/`blocked`/`shortfall` để chọn câu); cấm hex/`Color(0x`; `assertCodeNotBlind(...)` + mẫu tự kiểm từng luật (luật (5)). Guard đọc chuỗi nhãn ("Kho còn", "Cần nhập", "CHẶN xuất kho") phải đọc RAW (memory `striptocode-deletes-string-literals`).
    - `money/money-render-guard.test.mjs`, `screens/inventory.test.mjs`, `screens/order-transition.test.mjs`, `screens/orders.test.mjs` xanh. `cd design-system && npm test` xanh.

---

## Tasks / Subtasks

- [x] **Task 1 — Domain thuần (AC: 3)** — `inventory/domain/stock-shortfall.ts`, `inventory/domain/stock-out-blocked-event.ts`; spec `backend/test/stock-shortfall.spec.ts`.
- [x] **Task 2 — Exception + publish ở inventory (AC: 2, 4)**
  - [x] `backend/src/inventory/insufficient-stock.exception.ts`; `insufficientStockError` dùng `issueShortfall`; hai chỗ ném đổi sang class mới (message/fieldErrors y hệt).
  - [x] `taoPhieu`: `try/catch` quanh `$transaction` ⇒ publish `StockOutBlocked` rồi ném lại. Cập nhật docstring "HỢP ĐỒNG KHOÁ" (đoạn "Event publish SAU commit") — thêm: event chặn publish SAU rollback.
  - [x] Mở rộng `backend/test/stock-vouchers.service.spec.ts`.
- [x] **Task 3 — Orders: publish ở hai cửa (AC: 4)** — helper private trong `OrdersService` (bắt `InsufficientStockException`, dựng event bằng hàm thuần, publish, ném lại) dùng ở `issueStock` và `chuyenTrangThaiThuCong` (chỉ bao `$transaction`, giữ nhánh `THU_CONG_GATE_THUA`; 7 bước docstring giữ nguyên, bổ sung bước 7 "hoặc publish `StockOutBlocked` sau rollback"). Mở rộng `backend/test/order-stock-issue.spec.ts` + `order-status-change.spec.ts` nếu ca Đã giao nằm ở đó.
- [x] **Task 4 — Xem trước cảnh báo (AC: 6)** — `previewOrderIssue` trả `shortfall`; `getStockIssue` tính `blocked`; DTO `order-stock-issue-response.dto.ts` thêm 2 field.
- [x] **Task 5 — Kiểm tồn báo giá (AC: 7)** — `StockItemsService.checkOrderLines` (RR mảng; ledger theo sản phẩm + theo đơn); `InventoryModule.exports` thêm `StockItemsService` + docstring; `OrdersService.getStockCheck`; DTO mới `backend/src/orders/dto/order-stock-check-response.dto.ts`; controller `@Get(':id/stock-check')` `@RequireAnyPermissions(PERM.quotesCreateEdit, PERM.inventoryManage)` + `@ApiOkResponse/@ApiForbiddenResponse/@ApiNotFoundResponse` với `ErrorEnvelopeDto`. Unit `backend/test/order-stock-check.spec.ts` + mở rộng `stock-items.service.spec.ts`. `OrdersService` inject thêm `StockItemsService` làm tham số CUỐI của constructor ⇒ cập nhật mọi spec dựng `new OrdersService(...)` (danh sách ở File List 6.4, ~15 file). KHÔNG đặt `checkOrderLines` vào `stock-vouchers.service.ts` để né việc này: guard (b) chỉ cho tx mảng `RepeatableRead` ở `stock-items.service.ts`.
- [x] **Task 6 — E2E + lane DB (AC: 1, 2, 4, 5, 7)** — `backend/test/order-stock-check.e2e.spec.ts` (mới), `stock-out-blocked.db.integration.spec.ts` (mới), mở rộng e2e 6.3/6.4 (audit `StockOutBlocked`); ca "chốt không chặn" ở `orders.db.integration.spec.ts` hoặc file DB mới. `npm run test:db` (container `pns-postgres` cổng 5433; tắt ⇒ `docker start pns-postgres`; daemon không lên ⇒ ghi "lane DB chưa chạy", KHÔNG đánh `[x]` — memory `db-lane-needs-docker-desktop-gui`). KHÔNG ghi lên DB nào khác.
- [x] **Task 7 — Guard + OpenAPI (AC: 8, 9)** — `npm run openapi:gen`; guard như AC-8.
- [x] **Task 8 — Web (AC: 10)** — port/fake/kiểu; `stock-issue-preview.tsx`, `OrderDetailScreen.tsx`, `OrderStatusChangeScreen.tsx`, `CreateQuoteScreen.tsx`, `CartLineRow.tsx` (+ CSS dùng class/token sẵn có; class mới phải có rule — guard `css-class-coverage`); test; ba lệnh web (memory `web-tsx-syntax-error-passes-all-lanes`).
- [x] **Task 9 — Mobile (AC: 11)** — port/fake; 4 màn/khối + `cart_line_row.dart`; widget test. Format chỉ file mình viết hoặc `dart format -o none` (memory `dart-format-writes-files-cascade`).
- [x] **Task 10 — Parity + text-guard (AC: 12)**.
- [x] **Task 11 — Cổng cuối + đột biến** — backend `npx tsc --noEmit` + `npm test` + `npm run test:db`; lint chỉ file mình viết (baseline đỏ — memory `backend-lint-red-at-baseline`); web 3 lệnh; mobile 2 lệnh; design-system `npm test`. Ghi số suite/test từng lane + bảng đột biến vào Completion Notes. Đột biến bắt buộc (cp backup, KHÔNG `git checkout` — memory `mutation-test-never-git-checkout`; mutant phải compile — memory `mutation-must-compile-or-false-red`; mutate MỌI chỗ anh em — memory `mutation-one-row-sibling-guard-untested`):
  - bỏ publish ở `taoPhieu` (riêng) / ở `issueStock` (riêng) / ở cửa Đã giao (riêng);
  - publish 2 lần; publish cho MỌI `AppException` (không lọc `instanceof`) ⇒ ca 403/409 trạng thái ĐỎ;
  - `shortages` lấy số TRƯỚC khoá (đọc `onHand` ngoài tx) ⇒ DB xen kẽ ĐỎ;
  - `checkOrderLines` không trừ phần giữ của chính đơn ⇒ DB ĐỎ;
  - `issueShortfall` đổi `>` thành `>=` (biên `qty === onHand`) ⇒ unit ĐỎ;
  - kiểm tồn chèn vào `confirm()` ⇒ AC-1 ĐỎ;
  - web/mobile: bỏ `disabled` khi `blocked` ⇒ test ĐỎ; màn báo giá disable Chốt khi `short` ⇒ test ĐỎ; client so `qty > onHand` ⇒ text-guard ĐỎ; stripper trả rỗng ⇒ text-guard ĐỎ.
  - Mutant tương đương ngữ nghĩa ⇒ gỡ khỏi bảng (memory `mutation-semantically-equivalent-false-survivor`).

---

## Dev Notes

### Quyết định của Đại Ca và luật đã chốt (2026-10-21) — ưu tiên hơn mọi chỗ khác trong story

- **Chốt lại (re-chốt) cũng KHÔNG chặn khi thiếu tồn.** Đại Ca đã chốt "Chốt đơn khi thiếu tồn: cho chốt, chỉ chặn ở khâu xuất kho" (docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md). Câu "chặn re-chốt" ở epics 4.6 đã bị quyết định này thay thế ⇒ không còn là câu mở, KHÔNG để 6.6 quyết lại.
- Nút xuất khoá khi bảng xem trước báo thiếu (theo mockup) và phiếu xuất tự do bị chặn cũng phát `StockOutBlocked` — giữ như story chọn.
- Cửa xuất kho nhận `dacoc`, `danggiao`, `thicong`, `dachot`, `nghiemthu`. Đóng `dachot → hoanthanh` và `nghiemthu → hoanthanh` bị chặn 409 khi còn vật tư chưa xuất (commit 85e47da, d355ab7). Mọi chặn thiếu tồn ở khâu xuất phải khớp các cửa này.
- **Ngôn ngữ:** mọi thứ thuộc code (tên biến/hàm/file, comment, tên test, log, commit message) và contract API MỚI (route, field DTO) viết tiếng Anh; chỉ chuỗi người dùng thấy là tiếng Việt. Nếu story ghi tên tiếng Việt cho symbol/route/field MỚI ⇒ dùng tên tiếng Anh tương đương và ghi bảng đối chiếu vào Completion Notes.
- **Tiền hiển thị:** luôn qua `<Money>` / `MoneyText` / `formatVnd` (định dạng `83.010.960 đ`); guard `design-system/money/money-render-guard.test.mjs` sẽ đỏ nếu in số tiền thô.


### Files sẽ đổi

| File | Loại |
|---|---|
| `backend/src/inventory/domain/{stock-shortfall,stock-out-blocked-event}.ts` | NEW |
| `backend/src/inventory/insufficient-stock.exception.ts` | NEW |
| `backend/src/inventory/stock-vouchers.service.ts` | UPDATE — ném exception có kiểu, publish ở `taoPhieu`, `shortfall` ở preview |
| `backend/src/inventory/stock-items.service.ts` | UPDATE — `checkOrderLines` |
| `backend/src/inventory/inventory.module.ts` | UPDATE — export `StockItemsService` + docstring |
| `backend/src/orders/orders.service.ts` | UPDATE — helper publish chặn; `getStockIssue.blocked`; `getStockCheck` |
| `backend/src/orders/orders.controller.ts` | UPDATE — `GET :id/stock-check` |
| `backend/src/orders/dto/order-stock-issue-response.dto.ts` | UPDATE — `shortfall`, `blocked` |
| `backend/src/orders/dto/order-stock-check-response.dto.ts` | NEW |
| `backend/openapi/openapi.json` | UPDATE (sinh) |
| `backend/test/{stock-shortfall.spec,order-stock-check.spec,order-stock-check.e2e.spec,stock-out-blocked.db.integration.spec}.ts` | NEW |
| `backend/test/{stock-vouchers.service,order-stock-issue,stock-items.service,stock-vouchers.e2e,order-stock-issue.e2e,orders.e2e,no-unscoped-order-write}.spec.ts` + spec dựng `OrdersService` | UPDATE |
| `web/src/design-system/session/{orders-port,fake-orders-port}.ts`, `web/src/design-system/components/CartLineRow.tsx` | UPDATE |
| `web/src/screens/orders/{stock-issue-preview,OrderDetailScreen,OrderStatusChangeScreen,CreateQuoteScreen}.tsx` (+ css) | UPDATE |
| `web/src/test/quote-stock-check.test.tsx` NEW; `web/src/test/order-stock-issue.test.tsx` UPDATE | |
| `mobile/lib/design_system/session/{orders_port,fake_orders_port}.dart`, `mobile/lib/design_system/components/cart_line_row.dart` | UPDATE |
| `mobile/lib/screens/orders/{stock_issue_preview,order_detail_screen,order_status_change_screen,create_quote_screen}.dart` | UPDATE |
| `mobile/test/screens/orders/quote_stock_check_test.dart` NEW; `order_stock_issue_test.dart` UPDATE | |
| `design-system/session/parity.test.mjs`, `design-system/screens/stock-issue.test.mjs` UPDATE; `design-system/screens/quote-stock-check.test.mjs` NEW | |

**Không đổi:** `confirm()`/`revise()`/`huyDon()`, `allowed-transition.ts`, `applyTransition`, thứ tự khoá `orders → products`, `permission-registry.ts`/`role-presets.ts`/`permissions.json`/`PERM`/`AppPerm` (dùng key sẵn có), `ErrorCode` chung (mã domain chỉ ở `fieldErrors[].code`), schema Prisma (KHÔNG migration — story này không thêm cột), `POST /orders/preview-total`, `GET /stock-items`, hành vi lưu của `taoPhieu`/`issueForOrderInTx`.

### Hiện trạng phải giữ

- Envelope 409 thiếu tồn y hệt (client 6.3/6.4 map `lines.{i}.qty` vào dòng — `rowErrors` web, tương đương mobile).
- Cửa Đã giao: rollback toàn bộ khi thiếu (transition + ảnh); ảnh R2 mồ côi vẫn là đánh đổi đã chấp nhận (6.4 D10).
- `occurredAt` một biến cho cả lượt ở `chuyenTrangThaiThuCong`.
- Màn báo giá: lỗi mạng KHÔNG xoá dòng đã nhập (bất biến k, `CreateQuoteScreen.tsx:12-13`) — lỗi `getStockCheck` càng không được.
- R1/R3 review 6.4: nút Đã giao khoá tới khi xem trước `ready`; 409 ⇒ đọc lại bảng — thêm điều kiện `blocked`, không gỡ điều kiện cũ.

### Lệch mockup / spine có chủ đích

- Mockup web báo giá cột "Kho" in "Còn 42" (= `onHand`); story in "Kho còn {available}" — epic AC dùng "Kho còn 5" và Khả dụng là con số sale được hứa (6.2). 
- Mockup mobile màn Tồn kho banner "CHẶN xuất DH-2051" — không làm (xem Phạm vi).
- Mã đơn `DH-…` mockup: hệ thống chưa có mã đơn hiển thị; banner chặn không nhắc mã đơn.

### Kiểm thử — luật dự án áp dụng trực tiếp

- Luật (1): `getStockCheck` đọc qua `findScopedOrThrow`; không đường ghi đơn mới. Luật (2): không đường ghi tồn mới — khoá giữ nguyên; lane DB có ca xen kẽ ép buộc. Luật (3)/(4)/(5)/(6): AC-10, 11, 12, e2e loopback. Luật (8): code/test/comment/contract tiếng Anh, chỉ chuỗi UI/lỗi tiếng Việt. Luật (7): không push; `git add` đường dẫn cụ thể.
- Lane DB race: kiểm khả năng chạm khe trước khi đổ lỗi test (memory `db-race-test-cannot-reach-short-pretx-window`).
- Reviewer song song mutate cùng file ⇒ kiểm lại finding trên file hiện tại (memory `parallel-reviewers-mutation-collide`).

### Previous Story Intelligence (6.4)

- Khuôn: primitive inventory chạy trong tx của `OrdersService`; event dựng ở inventory, publish ở chủ tx; đếm publish bằng `toHaveBeenCalledTimes(1)`; mock tx chạy thân rồi mới ném.
- Đổi tên tiếng Anh (quyết định B): route `/orders/:id/stock-issue`, `issued/voucher/canIssue/lines/untrackedItems`, method `issueStock/getStockIssue/issueStockIfNeeded`, `issueForOrderInTx/findOrderIssueVoucher/previewOrderIssue`. Story này theo cùng: `stock-check`, `getStockCheck`, `checkOrderLines`, `shortfall`, `blocked`, `StockOutBlocked`, `InsufficientStockException`. Symbol tiếng Việt cũ (`taoPhieu`, `lietKeTonKho`, `khaDung`…) giữ nguyên.
- Review 6.4 bắt: nút bấm được khi xem trước chưa tải; sheet đóng giữa request; số cũ cạnh thông điệp mới; parity dò field trên toàn file (xanh giả); nhãn khớp chuỗi con. Áp ngay cho khối `blocked` và nhãn tồn báo giá.
- `PERM` web không có `delivery.confirm` ⇒ dùng `PERMISSION_KEYS` sinh từ registry.
- Flutter `AppTable` in nhãn cột HOA; `prettier --write`/`prisma format` reflow cả file ⇒ chỉ sửa tay hunk của mình.
- Lỗi mã HTTP chỉ đo ở e2e qua pipe/filter thật (memory `dev-pins-ac-deviation-as-green-test`).

### Git intelligence

`d355ab7` (chặn đóng thi công khi chưa xuất + xuất ở `nghiemthu`), `0298235`/`15f59ed` (tiền qua `<Money>`/`MoneyText` + guard — story này không hiển thị tiền), `85e47da` (6.4 xuất kho gắn đơn), `b9c0147` (luật tiếng Anh). Không dependency mới; stack giữ nguyên (NestJS 11.1, Prisma 7.8, Postgres 18, React 19.2, Flutter 3.44) — không cần tra phiên bản.

### Latest tech notes

- Prisma interactive tx: lỗi ném trong callback ⇒ Prisma rollback rồi ném lại CHÍNH lỗi đó ra ngoài `$transaction` ⇒ `instanceof InsufficientStockException` bên ngoài là tin được (không bị bọc).
- `instanceof` qua `AppException → HttpException`: class con phải gọi `super(...)` đúng chữ ký `AppException`; `AllExceptionsFilter` đọc `errorCode/fieldErrors/getStatus()` ⇒ envelope không đổi.
- Tx mảng `RepeatableRead`: `groupBy` đòi `orderBy` khi không `await` trực tiếp (6.4 Debug).

### Project Structure Notes

- Endpoint `/orders/:id/stock-check` là sub-resource của Đơn (phạm vi đọc theo đơn, dòng đơn chỉ `orders/` đọc); số tồn do `inventory/` tính.
- File mới kebab-case (guard `naming-convention`); Dart snake_case. Không mã story/AC trong comment/tên test/commit (`review-audit-self-decision.md#Stable Code Artifacts`).

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Nút xuất bị khoá khi xem trước báo thiếu** (mặc định: theo mockup — khoá). Hệ quả: người dùng thấy cảnh báo trước nên ít khi chạm server ⇒ `StockOutBlocked` (và noti #10 ở Epic 9) chỉ phát khi lượt xuất THỰC SỰ bị server chặn. Muốn noti mỗi lần kho "đụng" thiếu hàng thì phải để nút bấm được (lệch mockup) — chờ Đại Ca.
2. **`StockOutBlocked` cho phiếu xuất tự do** — mặc định: CÓ (D2).
3. **Epics 4.6 "không đủ khả dụng → chặn re-chốt"** mâu thuẫn với "chốt không chặn" (6.5, AD-19, PRD FR-25) — mặc định giữ "không chặn"; 6.6 quyết khi làm re-chốt.
4. **Bấm lặp khi thiếu** ⇒ mỗi lượt một event; Epic 9 tự gộp/chống spam nếu cần.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5 (584-590), #6.2 (557-567), #6.4 (577-582), #6.6 (592-598), #4.6 (449-453)]
- [Source: prds/…/prd.md#FR-25 (350-359), #FR-26 (361-367), ma trận noti #10 (444)]
- [Source: ARCHITECTURE-SPINE.md#AD-18 (152-156), #AD-19 (158-162)]
- [Source: ux-designs/…/EXPERIENCE.md:65, :122; mockups/all-screens.html — báo giá web 1385-1412, mobile 1550-1557; modal xuất bị chặn 3850-3861; mobile Tồn kho 3886]
- [Source: backend/src/inventory/stock-vouchers.service.ts:86-102, 158-318, 339-469, 507-552; stock-items.service.ts; stock-items.controller.ts; inventory.module.ts; domain/{ton-kho,stock-issued-event,stock-issue-lines}.ts]
- [Source: backend/src/orders/orders.service.ts:373-395 (`STOCK_ISSUE_STATUSES`, `closeRequiresIssuedStock`), 732-900 (`chuyenTrangThaiThuCong`), 914-996 (`issueStock`, `getStockIssue`), 1082-1151 (`issueStockIfNeeded`); orders.controller.ts:176-206 (khuôn `preview-total`)]
- [Source: backend/src/events/{domain-event,event-bus}.ts; backend/src/audit/{audit.subscriber,audit.service}.ts]
- [Source: web/src/screens/orders/{stock-issue-preview,CreateQuoteScreen,OrderDetailScreen,OrderStatusChangeScreen}.tsx; web/src/design-system/session/orders-port.ts:195-229; web/src/design-system/components/CartLineRow.tsx]
- [Source: _bmad-output/implementation-artifacts/6-2-ton-kho-hien-tai-theo-san-pham.md:53-60 (cảnh báo báo giá chuyển 6.5); 6-3-phieu-nhap-xuat-kho.md:38-41, 77, 263; 6-4-xuat-kho-gan-don.md (D1-D13, review R1-R15)]
- [Source: _bmad-output/project-context.md; _bmad-output/story-automator/extra-instructions-6-dev.txt (luật dự án 1-8)]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- `orders.e2e` dùng `ORDER_ID` không phải UUID ⇒ `GET /orders/:id/stock-check` trả 400 ở file đó; ca "chốt không chặn" e2e đặt ở `orders.e2e` (Chốt 200 với dòng theo dõi tồn `onHand` 0), còn GET stock-check + cổng quyền/phạm vi ở file e2e mới với UUID thật.
- Ca 409 cũ của web/mobile dùng đơn thiếu hàng của fake (`FAKE_ORDER_SHORT_STOCK`) — nay fake báo `blocked` nên nút khoá. Các ca đó đổi sang giả lập đúng đường đua tranh: lần đọc xem trước ĐẦU là bản cũ (không `blocked`, `shortfall` 0), click ⇒ 409, đọc lại ⇒ bản thật.
- Câu banner CHẶN trên web từng bị JSX bẻ dòng ⇒ text-guard đọc chuỗi không thấy dù màn render đúng; đổi thành một template string, giống byte-for-byte mobile.
- Đột biến B8 theo story (`>` → `>=` trong `issueShortfall`) là đột biến TƯƠNG ĐƯƠNG (ở biên `qty === onHand` vẫn trả `qty − onHand = 0`) ⇒ gỡ khỏi bảng, thay bằng off-by-one không tương đương `qty - 1 > onHand`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Backend:** domain thuần `stock-shortfall.ts` (`issueShortfall`, `quoteStockLine`) — một luật dùng chung cho kiểm dưới khoá, cảnh báo xem trước và cảnh báo báo giá; `StockOutBlocked` (`stock-out-blocked-event.ts`). `InsufficientStockException` (409 CONFLICT, message/fieldErrors y hệt cũ + `shortages` số đọc dưới khoá) thay cho hai chỗ ném. Publish `StockOutBlocked` SAU rollback, đúng một lần, ở chủ tx: `taoPhieu` (không target), `issueStock` và cửa "Đã giao" của `chuyenTrangThaiThuCong` (target = đơn, `orderVersionId` đọc lại dưới khoá) qua helper `publishIfStockOutBlocked`. Không phát cho 403/409 trạng thái/không vật tư/đóng chưa xuất/thua cổng/lỗi DB khác.
- Xem trước `GET /orders/:id/stock-issue`: thêm `lines[].shortfall`, `blocked` (canIssue giữ nguyên nghĩa). Mới `GET /orders/:id/stock-check` (`OrderStockCheckDto`) — `StockItemsService.checkOrderLines` đọc trong tx mảng RepeatableRead, `reserved` loại phần giữ của chính đơn; `OrdersService.getStockCheck` scope trước; `InventoryModule` export thêm `StockItemsService`; `OrdersService` thêm tham số constructor thứ 5 (cập nhật 21 chỗ dựng trong spec).
- Guard `no-unscoped-order-write` nhận thêm `this.stockItems.*` là chạm đơn + nhận diện `getStockCheck`. OpenAPI sinh lại. `confirm()`/`revise()` không đổi.
- **Web/Mobile (parity):** port/fake (`shortfall`, `blocked`, `getStockCheck`, `OrderStockCheck*`); khối xem trước: banner CHẶN mỗi dòng thiếu một câu, dòng "Thiếu N đv" (lỗi 409 của server thắng cảnh báo); Sheet chi tiết đơn: nút "Xuất kho (bị chặn)" khoá; màn chuyển trạng thái: nút Đã giao khoá khi `blocked`. Màn báo giá: nhãn "Kho còn N"/"Cần nhập N" qua prop `stockHint { label, short }` của CartLineRow/AppCartLineRow, banner warn mỗi món thiếu một câu; đọc có vé chống trả lời cũ; lỗi/403 ⇒ ẩn gợi ý, không banner lỗi; nút Chốt không phụ thuộc tồn.
- **Bảng đối chiếu tên tiếng Anh (luật 8):** route `stock-check`; method `getStockCheck`, `checkOrderLines`, `publishIfStockOutBlocked`; field `shortfall`, `blocked`, `available`, `reserved`, `status: enough|short`; class `InsufficientStockException`, `StockOutBlocked`, `OrderStockCheckDto/LineDto`; prop `stockHint` (`CartLineStockHint` / `AppCartLineStockHint`).
- **Cổng cuối (đã chạy):** backend `tsc` sạch; `npm test` 93 suite / 1763 test xanh; `npm run test:db` (Postgres 5433, pns-postgres) 19 suite / 176 test xanh (6 test mới); eslint file mới + file src đã sửa: 0 lỗi (baseline cũng 0 trên các file đó). Web typecheck ✓, vitest 7 file / 75 test ✓, build ✓. Mobile `flutter analyze` 0 issue, `flutter test` 325 ✓. Design-system `npm test` 447 ✓.
- **Bảng đột biến** (cp backup, mutant compile, khôi phục sau mỗi ca):

| # | Đột biến | Kết quả |
|---|---|---|
| B1 | bỏ publish ở `taoPhieu` | ĐỎ unit/e2e (3) + DB (1) |
| B2 | bỏ publish ở `issueStock` | ĐỎ unit/e2e (3) + DB (2) |
| B3 | bỏ publish ở cửa Đã giao | ĐỎ unit/e2e (2) + DB (1) |
| B4 | publish 2 lần | ĐỎ (5) |
| B5 | publish cho mọi `AppException` | ĐỎ (5) |
| B6 | đọc `onHand` TRƯỚC khoá products | ĐỎ DB (3, gồm ca xen kẽ ép buộc) |
| B7 | `checkOrderLines` không trừ phần giữ của chính đơn | ĐỎ unit (1) + DB (1) |
| B8 | `issueShortfall` off-by-one ở biên (thay mutant `>=` tương đương) | ĐỎ (7) |
| B9 | chèn kiểm tồn vào `confirm()` ném 409 | ĐỎ unit/e2e (7) + DB (9) |
| B10 | `getStockCheck` bỏ scope (`findOrThrow`) | ĐỎ (10, gồm guard) |
| W1/W2 | web bỏ khoá `blocked` ở Sheet / màn chuyển trạng thái | ĐỎ (1/1) |
| W3 | web disable Chốt khi thiếu | ĐỎ test + text-guard |
| W4/W5 | web so `qty > onHand` / `qty > available` | ĐỎ text-guard |
| G1/G2 | stripper guard trả rỗng | ĐỎ (4/6) |
| M1/M2 | mobile bỏ khoá `blocked` | ĐỎ (1/1) |
| M3/M4 | mobile bỏ banner CHẶN / bỏ nhãn tồn báo giá | ĐỎ (4/4) |

- Ghi chú: fake web/mobile giữ bảng số tồn CỐ ĐỊNH theo sản phẩm (không có luật tồn trong fake); `qty` gộp theo sản phẩm chỉ để đủ contract. Hex `Color(0xFFF7FBFA)` zebra có sẵn trong `cart_line_row.dart` nên luật cấm hex của guard báo giá chỉ áp cho hai màn báo giá.

### File List

- `backend/src/inventory/domain/stock-shortfall.ts` (new)
- `backend/src/inventory/domain/stock-out-blocked-event.ts` (new)
- `backend/src/inventory/insufficient-stock.exception.ts` (new)
- `backend/src/inventory/stock-vouchers.service.ts`
- `backend/src/inventory/stock-items.service.ts`
- `backend/src/inventory/inventory.module.ts`
- `backend/src/orders/orders.service.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/src/orders/dto/order-stock-issue-response.dto.ts`
- `backend/src/orders/dto/order-stock-check-response.dto.ts` (new)
- `backend/openapi/openapi.json`
- `backend/test/stock-shortfall.spec.ts` (new)
- `backend/test/order-stock-check.spec.ts` (new)
- `backend/test/order-stock-check.e2e.spec.ts` (new)
- `backend/test/stock-out-blocked.db.integration.spec.ts` (new)
- `backend/test/stock-vouchers.service.spec.ts`
- `backend/test/stock-items.service.spec.ts`
- `backend/test/order-stock-issue.spec.ts`
- `backend/test/order-stock-issue.e2e.spec.ts`
- `backend/test/order-stock-issue.db.integration.spec.ts`
- `backend/test/stock-vouchers.e2e.spec.ts`
- `backend/test/orders.e2e.spec.ts`
- `backend/test/no-unscoped-order-write.spec.ts`
- `backend/test/discount-approvals.db.integration.spec.ts`
- `backend/test/order-attachments.db.integration.spec.ts`
- `backend/test/order-attachments.spec.ts`
- `backend/test/order-cancel.db.integration.spec.ts`
- `backend/test/order-cancel.spec.ts`
- `backend/test/order-status-change.db.integration.spec.ts`
- `backend/test/order-status-change.spec.ts`
- `backend/test/orders-detail-scope.db.integration.spec.ts`
- `backend/test/orders-detail-scope.spec.ts`
- `backend/test/orders-list-scope.spec.ts`
- `backend/test/orders-list.db.integration.spec.ts`
- `backend/test/orders-write-scope.db.integration.spec.ts`
- `backend/test/orders-write-scope.spec.ts`
- `backend/test/orders.db.integration.spec.ts`
- `backend/test/orders.service.spec.ts`
- `backend/test/quote-exports.db.integration.spec.ts`
- `backend/test/warranty-lookup.spec.ts`
- `web/src/design-system/session/orders-port.ts`
- `web/src/design-system/session/fake-orders-port.ts`
- `web/src/design-system/components/CartLineRow.tsx`
- `web/src/design-system/components/components.css`
- `web/src/screens/orders/stock-issue-preview.tsx`
- `web/src/screens/orders/stock-issue.css`
- `web/src/screens/orders/OrderDetailScreen.tsx`
- `web/src/screens/orders/OrderStatusChangeScreen.tsx`
- `web/src/screens/orders/CreateQuoteScreen.tsx`
- `web/src/screens/orders/orders.css`
- `web/src/test/order-stock-issue.test.tsx`
- `web/src/test/quote-stock-check.test.tsx` (new)
- `mobile/lib/design_system/session/orders_port.dart`
- `mobile/lib/design_system/session/fake_orders_port.dart`
- `mobile/lib/design_system/components/cart_line_row.dart`
- `mobile/lib/design_system/components/components.dart`
- `mobile/lib/screens/orders/stock_issue_preview.dart`
- `mobile/lib/screens/orders/order_detail_screen.dart`
- `mobile/lib/screens/orders/order_status_change_screen.dart`
- `mobile/lib/screens/orders/create_quote_screen.dart`
- `mobile/test/screens/orders/order_stock_issue_test.dart`
- `mobile/test/screens/orders/quote_stock_check_test.dart` (new)
- `design-system/lib/stock-figures.mjs` (new)
- `design-system/screens/quote-stock-check.test.mjs` (new)
- `design-system/screens/stock-issue.test.mjs`
- `design-system/screens/orders.test.mjs`
- `design-system/session/parity.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-5-chan-khi-thieu-ton.md`

### Senior Developer Review (AI)

_Reviewer: Đại Ca (AI review qua `/ck:code-review`) — 2026-10-21. Kết quả: **Approve** sau khi sửa hết finding._

**Git vs File List:** khớp (mọi file đổi/mới thuộc story đều có trong File List; `.githooks/`, 2 file `.xlsx` trong `docs/` và artifact `_bmad-output/` không thuộc story — không review).

**AC:** 1–12 IMPLEMENTED (đối chiếu code + test). Task [x] đều có bằng chứng. 0 CRITICAL.

**Kiểm luật dự án bằng đột biến (cp backup, không `git checkout`, khôi phục sau mỗi ca):**

| Đột biến | Kết quả |
|---|---|
| bỏ `FOR UPDATE` khoá `products` ở `issueForOrderInTx` | ĐỎ lane DB: 3 test (`order-stock-issue.db`, `stock-out-blocked.db` — gồm ca xen kẽ ép buộc) |
| bỏ `FOR UPDATE` khoá `products` ở `taoPhieu` | ĐỎ lane DB: 3 test (`stock-vouchers.db`, `order-stock-issue.db`) |
| `getStockCheck` bỏ scope (`findScopedOrThrow` → `findOrThrow`) | ĐỎ 14 test (unit, e2e, guard `no-unscoped-order-write`) |
| bỏ nhánh "đã xuất ⇒ `lines: []`" (fix mới, xem M1) | ĐỎ unit 1 + e2e 1 + DB 1 |

**Finding & sửa:**

- **[MEDIUM] M1 — cảnh báo báo giá báo "Cần nhập N" cho đơn ĐÃ xuất kho.** Màn báo giá vẫn hiển thị đơn `dachot` (và xuất kho cho phép từ `dachot`); sau khi xuất, `onHand` đã trừ chính hàng của đơn ⇒ `getStockCheck` so `qty` với phần còn lại ⇒ banner warn + nhãn "Cần nhập" sai về hàng đơn đã lấy. Sửa: `OrdersService.getStockCheck` tra `findOrderIssueVoucher` của version hiện hành (cùng luật với `getStockIssue`) — đã xuất ⇒ `{ lines: [] }`, không đọc số tồn. DTO mô tả thêm; OpenAPI sinh lại. Test: unit (`order-stock-check.spec.ts` — thứ tự op + ca đã xuất), e2e (`order-stock-check.e2e.spec.ts` — 200 `lines: []`, không đọc tồn), DB (`stock-out-blocked.db` — xuất thật rồi check ⇒ rỗng).
- **[LOW] M2 — docstring lệch chỗ:** web `CreateQuoteScreen.tsx` và mobile `create_quote_screen.dart` chèn `refreshStockCheck`/`_shortStock` giữa docstring của `refreshTotals` và hàm ⇒ docstring tổng tiền dính vào hàm tồn. Trả docstring về đúng hàm, thêm docstring tiếng Anh ngắn cho hàm mới.
- **[LOW] M3 — text-guard `STOCK_PAIR` lọt khi bọc ngoặc** (`(line.qty) > (s.available)` không khớp). Regex `design-system/lib/stock-figures.mjs` cho phép `)`/`(` quanh toán tử; thêm mẫu tự kiểm vào `quote-stock-check.test.mjs` (dùng chung cho `stock-issue.test.mjs`).
- **[LOW] M4 — luật ngôn ngữ (8):** tên test tiếng Việt ở test mới/được sửa — `quote-stock-check.test.mjs` ("chống guard rỗng"), `stock-vouchers.e2e.spec.ts`, `stock-vouchers.service.spec.ts` ⇒ đổi sang tiếng Anh.

**Đã xét và giữ nguyên (có bằng chứng):** `publishIfStockOutBlocked` không nuốt lỗi gốc — `InProcessEventBus` cô lập lỗi subscriber (`events/event-bus.ts`); `willIssue && blocked` ở màn chuyển trạng thái không khoá bước khác — `stockIssue` reset về `null` khi đổi bước; `reserved = tổng ledger − phần của đơn` khớp hợp đồng ledger có dấu (`schema.prisma` `StockMovement`). Chốt/chốt lại không đọc tồn (`confirm()`/`revise()` không đổi) ✓; nhãn "Kho còn N"/"Cần nhập N" và banner chỉ in số backend trả, chọn câu theo `status` ✓.

**Cổng sau sửa (đã chạy):** backend `tsc` sạch, eslint file đụng tới 0 lỗi, `npm test` 93 suite / 1770 test ✓, `npm run test:db` (Postgres 5433, `pns-postgres`) 19 suite / 177 test ✓; web typecheck ✓ + vitest 7 file / 76 test ✓ + build ✓; mobile `flutter analyze` 0 issue + `flutter test` 326 ✓; design-system `npm test` 447 ✓.

### Change Log

- 2026-10-21: Dev story 6.5 — `InsufficientStockException` + `StockOutBlocked` (xuất tự do, cửa riêng, cửa Đã giao), cảnh báo `shortfall`/`blocked` ở xem trước xuất kho + khoá nút, `GET /orders/:id/stock-check` + nhãn/banner cảnh báo ở màn báo giá (web + mobile), test khoá "chốt không chặn", lane DB + text-guard/parity mới; Status → review.
- 2026-10-21: Code review (AI) — sửa M1 (stock-check rỗng khi đơn đã xuất kho), M2 (docstring lệch), M3 (guard `STOCK_PAIR` lọt ngoặc), M4 (tên test tiếng Anh); đột biến FOR UPDATE ×2 + scope đều ĐỎ; Status → done.
