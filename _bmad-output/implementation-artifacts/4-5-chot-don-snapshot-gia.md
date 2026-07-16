---
baseline_commit: af5abd4c4815668d52141b8bc89e1b13f97fbd70
---

# Story 4.5: Chốt Đơn + snapshot giá + warranty + giá catalog song song giá đã sửa

Status: done

## Story

As a người có quyền chốt đơn,
I want bấm Chốt để đóng băng giá của Đơn,
so that giá đã báo cho khách không đổi khi danh mục thay đổi sau này (FR-5).

## Acceptance Criteria

1. **Endpoint Chốt + snapshot (FR-5, AD-6, AD-16):** **Given** Đơn ở `baogia` có ≥1 dòng, **When** `POST /orders/:id/chot` bởi người có `orders.confirm`, **Then** trong MỘT transaction: (a) `Order.status` `baogia` → `dachot` qua cổng atomic `updateMany({where: {id, status: 'baogia'}})` + `count === 1`; (b) `OrderVersion` hiệu lực (qua `currentVersionId`) ghi `vatRate` = thuế suất config resolve server-side, `vatMode` = giá trị HIỆU LỰC của Đơn (`order.vatMode ?? 'co_vat'` — sau chốt KHÔNG BAO GIỜ null), `chotAt` = thời điểm chốt; (c) MỖI dòng ghi `unitPriceSnapshot` + `catalogPriceSnapshot` theo bảng 3 loại dòng (Dev Notes). Response `OrderResponseDto` với `status: 'dachot'`. Thiếu quyền → 403 (`quotes.create_edit` KHÔNG thay thế được); đơn không tồn tại → 404; đơn 0 dòng → 400 (báo giá rỗng không có gì để đóng băng).
2. **Không hồi tố sau Chốt (FR-5):** **Given** Đơn đã chốt, **When** sửa giá danh mục (PATCH product / đổi tier / bật-tắt cờ giá phân tầng), **Then** `GET /orders/:id` trả đơn giá các dòng KHÔNG đổi — đường đọc `toViews` ưu tiên `unitPriceSnapshot` khi non-null, CHỈ resolve giá sống khi snapshot null (tín hiệu tự thân trên dòng, KHÔNG dựa `Order.status` — version cũ ở 4.6 cũng phải đọc đúng).
3. **Warranty đóng băng theo dòng (§3):** **Given** dòng catalog có `warrantyMonths` (đã copy từ `Product.warrantyMonths` lúc addLine — 4.1), **When** Chốt, **Then** giá trị giữ nguyên trên dòng và đóng băng nhờ `assertMutable` (mọi mutation dòng sau chốt = 409) — KHÔNG cột mới, KHÔNG ghi `warrantyStartAt` (mốc bảo hành là Story 4.9).
4. **Giá catalog song song giá đã sửa (§2):** **Given** dòng `priceEditable = true` trỏ Product (phí lắp đặt), **When** Chốt, **Then** dòng lưu SONG SONG `catalogPriceSnapshot` (giá danh mục resolve tại thời điểm chốt) và `unitPriceSnapshot` (giá đã sửa) — chênh lệch không nằm trong bóng tối, màn duyệt chiết khấu 4.7 đọc được. Dòng tự do (`productId` null) → `catalogPriceSnapshot = null`.
5. **Idempotent + event (NFR-1, AD-18):** **Given** Đơn ĐÃ ở `dachot`, **When** gọi lại `POST /orders/:id/chot` (retry), **Then** 200 trả view hiện tại — KHÔNG ghi lại snapshot, KHÔNG publish event thứ hai. **Given** 2 request chốt ĐỒNG THỜI, **Then** đúng MỘT bên thắng cổng atomic (bên thua `count === 0` → đọc lại → thấy `dachot` → trả idempotent). **Given** trạng thái khác `baogia`/`dachot` (Epic 5 về sau), **Then** 409. Chốt THẬT publish `OrderConfirmed` (before→after snapshot) qua EventBus SAU commit — audit ghi qua AuditSubscriber, KHÔNG gọi audit trực tiếp.
6. **UI hai nền tảng (UX-DR-20, parity):** **Given** màn Tạo báo giá, đơn ở `baogia`, người dùng có `orders.confirm`, **Then** có nút primary "Chốt báo giá" (dưới khối Tổng kết, khớp mockup); bấm → ConfirmDialog/AppConfirmDialog nêu hệ quả chứa "Chốt sẽ đóng băng giá"; xác nhận → port `confirmOrder(orderId)` → `setOrder(kết quả)` → màn tự về read-only (`editable` đã derive từ `status`), gọi `onDone?.(order)`; KHÔNG toast hô hào (EXPERIENCE.md voice: "Xác nhận thành công! 🎉" nằm cột KHÔNG NÊN — chip trạng thái đổi là đủ). Huỷ dialog → không gọi port. Thiếu quyền → nút KHÔNG hiển thị (gating UX; backend vẫn enforce). Lỗi port → Banner + giỏ hàng + state cũ NGUYÊN VẸN (pattern k). Nhãn tĩnh mới byte-identical web↔mobile. Widget test mobile BẮT BUỘC (C-4) gồm error case.

## Tasks / Subtasks

- [x] Task 1: Backend domain — trạng thái + event (AC: #1, #5)
  - [x] `orders/domain/order-status.ts`: thêm `export const TRANG_THAI_DA_CHOT: OrderStatusKey = 'dachot';` (khoá đã có trong union — chỉ thêm hằng; giữ nguyên doc "bảng transition KHÔNG sống ở đây").
  - [x] `orders/domain/order-events.ts`: event mới `OrderConfirmed` (actor, before/after `OrderSnapshot`, at — shape y hệt `OrderMetaChanged`).
- [x] Task 2: Backend `OrdersService.confirm()` + đường đọc snapshot-first (AC: #1–#5)
  - [x] Method mới `confirm(actorAccountId, orderId, vatRatePercent: number, tieredPricingEnabled: boolean): Promise<OrderView>`. Luồng: `findOrThrow` → nếu `status === 'dachot'` trả `viewOf` NGAY (idempotent, không event) → nếu khác `baogia` → 409 → đọc lines của bản hiệu lực + products (`PRODUCT_QUOTE_SELECT` — KHÔNG costPrice) → tính snapshot từng dòng theo bảng 3 loại (Dev Notes) → **interactive transaction** `$transaction(async (tx) => …)`: (1) `tx.order.updateMany({where: {id, status: TRANG_THAI_BAO_GIA}, data: {status: TRANG_THAI_DA_CHOT}})`, `count === 0` → throw sentinel abort tx; (2) `tx.orderVersion.update` ghi `vatRate`/`vatMode` hiệu lực/`chotAt`; (3) từng `tx.orderLineItem.update` ghi `unitPriceSnapshot` + `catalogPriceSnapshot`. Catch sentinel → đọc lại: `dachot` → trả view idempotent; khác → 409. ⚠️ Sau tx, object `before` trong bộ nhớ vẫn mang status cũ — view trả về phải đọc lại row (hoặc compose `{...before, status: TRANG_THAI_DA_CHOT}`) để response nói `dachot` (`updateMany` không trả row).
  - [x] Đơn 0 dòng → 400 `VALIDATION_ERROR` "Không thể chốt báo giá chưa có dòng nào." (kiểm TRƯỚC transaction).
  - [x] Publish `OrderConfirmed(actor, before, after, new Date())` SAU commit, CHỈ ở nhánh chốt thật (nhánh idempotent im lặng).
  - [x] `toViews()`: dòng có `unitPriceSnapshot !== null` → dùng snapshot làm `unitPrice`, KHÔNG đưa `productId` vào `liveIds` (bỏ hẳn tra product cho dòng đã đóng băng); dòng snapshot null giữ nguyên hành vi live-resolve. `amount = lineAmount(giá hiệu lực, qty)` như cũ.
  - [x] Cập nhật doc đầu file service: mục "GIÁ TRƯỚC CHỐT" bổ sung vế sau-chốt (snapshot-first) + mục mới về `confirm()` là điểm ghi status DUY NHẤT tạm thời (seed cho `applyTransition()` 5.1 — xem Dev Notes).
- [x] Task 3: Controller endpoint + OpenAPI (AC: #1)
  - [x] `orders.controller.ts`: `@Post(':id/chot')` + `@HttpCode(200)` (không tạo resource mới — khuôn `preview-total`) + `@RequirePermissions(PERM.ordersConfirm)` (key CÓ SẴN registry — `permissions.json` KHÔNG đổi); handler resolve `await this.settings.vatRatePercent()` + `tieredPricingEnabled()` rồi truyền xuống (SettingsService/FeatureFlagsService ĐÃ inject từ 4.4); đủ bộ Swagger decorator theo mẫu các handler hiện có (404/403/409/400 responses).
  - [x] KHÔNG DTO request mới (body rỗng); response = `OrderResponseDto` hiện có (KHÔNG thêm field — `chotAt`/snapshot chi tiết để màn chi tiết đơn 5.4/duyệt chiết khấu 4.7 tự mở khi cần).
  - [x] Regen OpenAPI: `cd backend && npm run openapi:gen` (drift-guard so byte).
- [x] Task 4: Backend tests (AC: #1–#5)
  - [x] `orders.service.spec.ts`: (a) happy — assert PAYLOAD từng op trong tx: `updateMany` đúng `where {id, status}`, version update đúng `{vatRate, vatMode, chotAt}` (case đơn `vatMode` null → snapshot `'co_vat'`), từng line update đúng cặp snapshot theo 3 loại dòng (catalog thường: cả hai = giá resolve; phí lắp: catalog ≠ unitPrice đã sửa; tự do: catalog null); (b) thứ tự `['write','publish']` — event sau commit; (c) retry `dachot` → trả view, KHÔNG update/KHÔNG event; (d) race: `updateMany` trả `count: 0` → đọc lại `dachot` → idempotent; đọc lại trạng thái lạ → 409; (e) đơn 0 dòng → 400; (f) `toViews` ưu tiên snapshot: dòng có snapshot + giá catalog mock ĐÃ ĐỔI → view vẫn trả snapshot.
  - [x] `orders.e2e.spec.ts`: 401 vắng token; 403 với `quotes.create_edit` (KHÔNG thay được `orders.confirm`); happy chốt → 200 `status: 'dachot'` + audit event qua AuditSubscriber thật; retry → 200 body y hệt, audit KHÔNG ghi thêm; sửa giá product rồi GET đơn → giá dòng không đổi; chốt đơn rỗng → 400; 404 đơn ma.
- [x] Task 5: FE ports + fakes (AC: #6)
  - [x] `web/src/design-system/session/orders-port.ts`: method mới `confirmOrder(orderId: string): Promise<Order>` (map `POST /orders/:id/chot`). Twin `orders_port.dart`: `Future<Order> confirmOrder(String orderId);` (parity guard).
  - [x] Fakes 2 bên (twin logic): `confirmOrder` đổi `status: 'dachot'` trả Order mới; đơn đã `dachot` trả nguyên trạng (idempotent như backend); KHÔNG mô phỏng freeze giá trong fake — client không tính tiền, không đọc snapshot.
- [x] Task 6: Web UI (AC: #6)
  - [x] `CreateQuoteScreen.tsx`: nút `Button variant="primary"` "Chốt báo giá" DƯỚI Frame "Tổng kết" — render khi `editable`, bọc `<Gate perms={perms} requires={PERM.ordersConfirm}>` (primitive 1.10 — gated-out BIẾN MẤT, không disabled xám, UX-DR-22; `perms` đã có L76, hiện chỉ dùng cho sidebar; import `Gate` + `PERM` từ `design-system/gating/`); bấm → mở `ConfirmDialog` (props: `open`/`consequence`/`onConfirm`/`onCancel` — KHÔNG có prop `message`) với `consequence` chứa "Chốt sẽ đóng băng giá"; xác nhận → `chotBusy` disable → `confirmOrder(order.id)` → `setOrder(kết quả)` (editable tự tắt vì status) → `onDone?.(kết quả)`; lỗi → `setError` Banner + giỏ + state cũ nguyên (pattern k); huỷ → đóng dialog không gọi port. KHÔNG success toast.
  - [x] CSS nếu cần vào `orders.css` — 0 shadow/gradient, token radius (guard f); không bare `<button>` (guard b).
- [x] Task 7: Mobile UI + widget test (AC: #6)
  - [x] `create_quote_screen.dart`: màn HIỆN CHƯA có perms input (không màn mobile nào dùng `AppGate` tới giờ — đây là lần đầu) → thêm param `perms` (`Set<PermissionKey>`, twin ngữ nghĩa với web nhận perms từ context; default `const {}` = ẩn nút, an toàn); nút primary "Chốt báo giá" dưới khối `mtotals`, render khi `editable`, bọc `AppGate(perms: perms, requires: AppPermissionKeys.ordersConfirm, child: …)` (primitive 1.10 — biến mất, không disabled xám); bấm → `AppConfirmDialog` nêu hệ quả chứa "Chốt sẽ đóng băng giá" → confirm → `_chotBusy` → `confirmOrder` → `setState` order mới → `widget.onDone?.call(order)`; lỗi → Banner + giỏ nguyên.
  - [x] Widget test `create_quote_screen_test.dart` (BẮT BUỘC C-4) — test hiện có KHÔNG truyền `perms` → default `{}` ẩn nút, không vỡ test cũ; test mới truyền perms có `ordersConfirm`: (a) bấm "Chốt báo giá" → dialog hiện đúng chữ → confirm → fake nhận `confirmOrder(orderId)`, field/nút về disabled + nút Chốt biến mất; (b) huỷ dialog → fake KHÔNG bị gọi; (c) port throw (fake subclass) → Banner + dòng giỏ còn nguyên + vẫn editable; (d) perms KHÔNG có `orders.confirm` → nút không render. `ensureVisible` TRƯỚC tap (bài học 4.3/4.4 tap-miss). `dart format -o none --set-exit-if-changed` CHỈ file đã sửa.
- [x] Task 8: Guards design-system (AC: #6)
  - [x] `design-system/screens/orders.test.mjs`: (c.2) thêm `confirmOrder` vào port-method list (L118); (e) nhãn byte-identical mới: "Chốt báo giá", "Chốt sẽ đóng băng giá"; negative assert mới NẾU viết sạch được (vd cấm màn tự gán literal `'dachot'` vào state — status chỉ đến từ Order port trả về) — MỌI negative assert mới PHẢI mutation-check (bẻ code thật → RED → revert bằng `cp` backup, KHÔNG `git checkout`).
  - [x] `design-system/session/parity.test.mjs`: cặp orders port web↔dart re-check method mới.
  - [x] Chạy `cd design-system && npm test`. Guard quét file như TEXT — tránh chuỗi bị cấm (`shadow`/`gradient`/`* 8`/`Math.floor(`/`reduce(`…) kể cả trong comment.
- [x] Task 9: Chạy toàn bộ lane + hồ sơ story (AC: tất cả)
  - [x] `cd backend && npm test` (unit + e2e + 7 source-guard + drift openapi/permissions).
  - [x] Story KHÔNG có migration mới — DB lane không bắt buộc chạy; NHƯNG action item 4.4 còn treo (migration `20260717000000` chưa deploy thật): nếu Postgres khả dụng thì `npm run test:db` luôn thể, ghi rõ nếu không.
  - [x] `cd mobile && flutter test && flutter analyze`.
  - [x] `cd design-system && npm test`.
  - [x] Tick tasks, điền Dev Agent Record + File List + Change Log (SAU QA phase — bài học 4.2/4.3).

### Review Follow-ups (AI)

- [ ] [AI-Review][Low] TOCTOU quanh `confirm()`: `addLine` đồng thời đã qua `assertMutable` trước khi confirm commit có thể chèn dòng không-snapshot vào đơn đã chốt (dòng đó live-resolve → hồi tố giá trong race hiếm); `removeLine` đồng thời → P2025 → rollback 500 (fail-safe). Fix thật = khoá row / cổng atomic cho mutation dòng trong engine `applyTransition()` — chuyển Story 5.1 [backend/src/orders/orders.service.ts:confirm]
- [ ] [AI-Review][Low] Response `confirm` trả `updatedAt` cũ: compose `{...before, status}` trong khi `Order.updatedAt @updatedAt` đã bump trong DB. Spec cho phép nhánh compose; GET kế tiếp trả đúng — chỉ đổi nếu có client thật đọc `updatedAt` ngay sau chốt [backend/src/orders/orders.service.ts:confirm]
- [ ] [AI-Review][Low] Tap-miss warning (`warnIfMissed`) tại test CŨ ~L406 `create_quote_screen_test.dart` — pre-existing, ngoài diff 4.5, test vẫn assert hiệu ứng nên không false-green; dọn khi đụng file lần sau [mobile/test/screens/orders/create_quote_screen_test.dart:406]

## Dev Notes

### Quyết định spec đã chốt (đọc trước khi code)

- **Ghi status TRƯỚC khi có `applyTransition()` (AD-11 tension — quyết định có ý thức):** engine transition là Story 5.1; epics xếp 4.5 trước 5.1 CÓ CHỦ ĐÍCH. `confirm()` là **điểm ghi `Order.status` DUY NHẤT tạm thời** trong codebase (schema comment 4.1 "không UPDATE trần" nói về mutation tuỳ tiện — đây là transition nghiệp vụ có gate quyền + audit + atomic guard, tức chính là hành vi applyTransition sẽ chuẩn hoá). KHÔNG dựng bảng allowed-transition/enum event trong story này (YAGNI — 5.1 sở hữu); chỉ comment đánh dấu rõ tại `confirm()`: "5.1 nuốt block này vào applyTransition()". KHÔNG đặt tên hàm `applyTransition` (tránh chiếm tên engine).
- **Route `/orders/:id/chot`:** spine Consistency Conventions cho ví dụ NGUYÊN VĂN "action nghiệp vụ là sub-resource POST (`/orders/{id}/chot`)". Method/event tiếng Anh khớp permission: service `confirm()`, event `OrderConfirmed`, port `confirmOrder` (nhất quán `PERM.ordersConfirm`). `@HttpCode(200)` — không tạo resource.
- **Cổng idempotency = atomic `updateMany` + `count === 1`:** khuôn Story 2.3 (rotate refresh token chống replay). Postgres READ COMMITTED: UPDATE re-check WHERE sau khi chờ row lock → bên thua nhận `count 0`, KHÔNG double-write ($transaction array KHÔNG dùng được ở đây: `count === 0` phải ABORT các op sau — bắt buộc interactive `$transaction(async (tx) => …)`, throw sentinel để rollback). Pre-check `dachot` trước tx chỉ là fast-path; cổng thật nằm TRONG tx.
- **Bảng snapshot 3 loại dòng (AC #1/#4):**

  | Loại dòng | `unitPriceSnapshot` | `catalogPriceSnapshot` |
  |---|---|---|
  | Catalog `priceEditable=false` | `resolveUnitPrice(giá+tier hiện hành, qty, tieredPricingEnabled)` — giá SỐNG tại thời điểm chốt (KHÔNG phải cache `unitPrice` lúc nhập) | = cùng giá resolve đó |
  | Catalog `priceEditable=true` (phí lắp) | `line.unitPrice` (giá đã sửa) | `resolveUnitPrice(...)` — để lộ chênh lệch cho 4.7 |
  | Tự do (`productId` null) | `line.unitPrice` (nhập tay) | `null` |

  `resolveUnitPrice` dùng CÙNG cờ `tieredPricingEnabled` với đường live/toViews — chốt đóng băng đúng con số khách đang thấy trên màn. `costPriceSnapshot` KHÔNG ghi (đóng băng lúc XUẤT KHO — AD-20, Story 6.4).
- **`vatMode` snapshot GIÁ TRỊ HIỆU LỰC:** `order.vatMode ?? VAT_MODE.coVat` — đơn tạo trước 4.4 (`vatMode` null, `vatApplies(null) = true`) chốt xong `OrderVersion.vatMode = 'co_vat'` tường minh; quyết định thuế đã đóng băng không được phép mập mờ null. `vatRate` = int từ `SettingsService.vatRatePercent()` — controller resolve MỘT lần rồi truyền xuống (pattern 4.4, service giữ đúng 2 dep Prisma + EventBus).
- **Đường đọc sau chốt — tín hiệu là SNAPSHOT, không phải status:** `toViews` hiện tại LUÔN live-resolve dòng catalog `!priceEditable` → sau chốt sẽ hiển thị giá danh mục MỚI = vi phạm FR-5. Sửa: `unitPriceSnapshot !== null` → dùng snapshot, bỏ qua tra product. Dựa vào snapshot trên DÒNG (không phải `Order.status`) vì 4.6 sẽ có version cũ đã chốt + version mới đang sửa cùng lúc.
- **Đơn 0 dòng → 400:** báo giá rỗng đóng băng vô nghĩa, gần như chắc chắn là mis-tap. Kiểm trước transaction, `VALIDATION_ERROR`.
- **KHÔNG migration:** mọi cột 4.5 cần đã tạo sẵn từ 4.1 (`OrderVersion.vatRate/vatMode/chotAt`, `OrderLineItem.unitPriceSnapshot/catalogPriceSnapshot/warrantyMonths` — xác nhận `schema.prisma` L353–355, L397–404). `warrantyStartAt` KHÔNG đụng (4.9). `permissions.json` KHÔNG đổi (`orders.confirm` có sẵn cả registry backend L37 + generated web/mobile).
- **Warranty (AC #3) = không code mới ngoài test:** `warrantyMonths` đã sống trên dòng (copy từ Product lúc `addLine` 4.1, dòng tự do null); "snapshot lúc chốt" thoả mãn bằng bất biến ĐÃ CÓ `assertMutable` (mọi mutation dòng sau chốt 409). Ô sửa warranty trên UI là Story 4.9 — đừng dựng input.
- **Response giữ nguyên `OrderResponseDto`:** không expose `chotAt`/`catalogPriceSnapshot` ở story này — màn cần chúng (chi tiết đơn 5.4, duyệt chiết khấu 4.7) tự mở khi đến lượt. Sau chốt `unitPrice` trong line view TỰ ĐỘNG = snapshot (qua `toViews`) — client không cần biết gì đổi.
- **UI sau chốt — im lặng đúng voice:** EXPERIENCE.md xếp "Xác nhận thành công! 🎉" vào cột KHÔNG NÊN. Thành công = order trả về `status: 'dachot'` → `editable` derive tắt mọi input + nút Chốt biến mất. Không toast, không banner success.
- **Gating nút Chốt theo quyền:** `orders.confirm` là quyền RIÊNG (không phải `quotes.create_edit`) — sale tạo báo giá chưa chắc được chốt. Ẩn nút khi thiếu quyền (UX); backend 403 là hàng rào thật (AD-4). E2e phải chứng minh `quotes.create_edit` không thay thế được.

### Hiện trạng code (đã scout, tin được)

**Backend:**
- `orders.service.ts` (657 dòng): `findOrThrow` L171, `assertMutable` L187 (so `TRANG_THAI_BAO_GIA`), `currentVersionIdOrThrow` L200, `create()` L219 ($transaction ARRAY 3 op — `confirm()` cần INTERACTIVE tx, khác khuôn), `update()` L328 (khuôn publish-sau-write + event before/after), `toViews` L606–655 (điểm sửa AC #2 — `liveIds` filter L610 + resolve L631), `PRODUCT_QUOTE_SELECT` L63 (🔴 KHÔNG costPrice — giữ nguyên cho confirm), `orderSnapshot()` L103 (đủ field cho event, status nằm trong — before/after tự nói baogia→dachot).
- `orders.controller.ts`: đã inject `SettingsService` + `FeatureFlagsService` (4.4) — handler mới chỉ gọi 2 helper có sẵn; route `:id/chot` không xung đột `preview-total` (static trước `:id` đã xếp đúng). Mọi handler đều có `@RequirePermissions` — source-guard `no-handler-without-require-permissions` sẽ bắt nếu quên.
- `order-status.ts`: union 10 khoá có `'dachot'`; hiện chỉ export `TRANG_THAI_BAO_GIA`.
- `order-events.ts`: 6 class event (L50–134), `OrderMetaChanged` L118 là khuôn copy cho `OrderConfirmed` (actor, before, after, at).
- `resolveUnitPrice` từ `catalog/domain/price-resolution` — hàm resolve giá+tier duy nhất, dùng lại nguyên vẹn cho snapshot.
- AuditSubscriber ghi audit từ MỌI domain event tự động — KHÔNG gọi audit trực tiếp (AD-18).
- E2e hiện có mock Prisma hermetic — khuôn mock `$transaction` interactive: xem cách các spec khác mock (nếu chỉ mock array-style thì bổ sung callback-style: gọi callback với chính mock tx).
- Prisma `Order` L328–356: `status String`, `currentVersionId` unique FK; `OrderVersion` L360–377: `vatRate Int?`, `vatMode String?`, `chotAt DateTime?`, `updatedAt` (comment schema: "updatedAt cần vì 4.5/4.6 sẽ ghi chotAt/vatRate lên row này"); `OrderLineItem` L385–412: `unitPriceSnapshot Int?`, `catalogPriceSnapshot Int?`, `costPriceSnapshot Int?` (KHÔNG đụng), `warrantyStartAt DateTime?` (KHÔNG đụng).

**FE web:**
- `CreateQuoteScreen.tsx`: props có `onDone?: (order: Order) => void` L62 + comment L61 "Story 4.5 owns Chốt — nothing here"; `usePermissions` L76 (`perms` hiện CHỈ dùng cho `filterNav` sidebar L368 — Chốt là control đầu tiên của màn này gate theo quyền); `editable = order.status === 'baogia'` L361 — chốt xong `setOrder` là mọi input tự disable; Frame "Tổng kết" kết thúc ~L509 — nút Chốt đặt ngay sau; pattern busy-flag: `scopeBusy`/`metaBusy`; pattern k (lỗi → Banner + giỏ nguyên) đã chuẩn.
- Gating primitive 1.10: `Gate` (`web/src/design-system/gating/Gate.tsx` — `can(perms, requires)`, gated-out render null) + `ConfirmDialog.tsx` (props `open`/`title?`/`consequence`/`confirmLabel?`/`cancelLabel?`/`tone?`/`onConfirm`/`onCancel`) đều có sẵn.
- `orders-port.ts`: 8 method hiện có (L160–196) — thêm `confirmOrder`; PERM web ở `web/src/design-system/gating/permission-keys.generated.ts` L15 `ordersConfirm: 'orders.confirm'` (file GENERATED — có sẵn, không sửa tay).
- Web KHÔNG có tsc/bundler — text-guard là lớp bảo vệ duy nhất cho `.tsx`.

**FE mobile:**
- `create_quote_screen.dart`: `onDone` L42/L50; `editable = order.status == 'baogia'` L642; khối `mtotals` — nút Chốt đặt dưới; màn CHƯA có perms input (grep toàn `mobile/lib/screens/` — chưa màn nào dùng `AppGate`/perms; story này mở đường, thêm param `perms` default `const {}`).
- `AppGate` (`gating/app_gate.dart` — `perms: Set<PermissionKey>` + `requires`, gated-out = `SizedBox.shrink()`), `AppConfirmDialog` + `showAppDialog` (`dialog.dart` L155, export `components.dart` L35), `AppPermissionKeys.ordersConfirm` generated L15 — đều có sẵn.
- `orders_port.dart`: 8 method twin (L256–286) — thêm `confirmOrder`.
- Mobile không app-runtime — transport qua port tiêm + fake trong test.

**Guards:**
- `orders.test.mjs` L118: port-method list `['create','get','addLine','updateLine','removeLine','previewTotal','updateScopeFlags','updateOrderMeta']` → thêm `'confirmOrder'`; (e) nhãn byte-identical; (h/k/l/m) các khối hiện có không đụng.
- `parity.test.mjs`: cặp orders web↔dart tự re-check khi thêm method 2 phía.
- Backend 7 source-guard: handler mới PHẢI `@RequirePermissions`; permission literal cấm ngoài registry; naming convention.

### Bài học từ story trước (4.1–4.4)

- Assert **payload ghi DB** (`data`/`where`) từng op, không đếm số lần gọi mock; test thứ tự `['write','publish']` chứng minh event sau commit.
- Mọi negative assert guard mới phải **mutation-check** (bẻ code thật → RED → revert bằng `cp` backup, KHÔNG `git checkout` — story code chưa commit).
- Widget test mobile BẮT BUỘC mọi thay đổi màn (C-4), gồm error case; `ensureVisible` TRƯỚC tap/drag (4.3 + 4.4 đều dính tap-miss khi màn dài thêm).
- Lỗi thao tác màn Tạo báo giá → Banner + KHÔNG wipe giỏ (finding High 4.1).
- OpenAPI là artifact sinh — đổi route/DTO xong PHẢI `npm run openapi:gen`.
- Backend lane từng flake (`customer-sources.e2e`-style) — đỏ không liên quan thì rerun trước khi sửa.
- `dart format` mặc định GHI đè hàng loạt — luôn `-o none --set-exit-if-changed <file>`.
- Dev Agent Record cập nhật SAU QA phase (finding Medium 4.2 + 4.3).
- `resolve_customization.py` fail trên máy này (Python < 3.11) — merge workflow block tay nếu cần.
- Docker Desktop không khởi động được trong phiên headless — DB lane nếu không chạy được thì ghi rõ, đừng loay hoay `open -a Docker`.
- Guard quét file như TEXT kể cả comment — tránh viết chuỗi cấm trong comment; regex brace `[^}]*` từng false-green với generic lồng (4.4 M6) — nếu viết guard mới dùng `[\s\S]*?\n\}`.

### Web research

Không thư viện/API mới — stack pin sẵn (NestJS 11.1.27, Prisma 7.8.0, React 19.2.7, Flutter 3.44). Gotcha Prisma 7 liên quan story: (1) interactive `$transaction(async (tx) => …)` — default isolation READ COMMITTED của Postgres đủ cho cổng `updateMany` status-guard (UPDATE re-check WHERE sau row lock — không cần nâng isolation/FOR UPDATE cho luồng này vì gate là chính UPDATE, khác bài học delete+create của ProductPrices); (2) throw trong callback → tự rollback toàn tx; (3) KHÔNG dùng createMany trong story này — guard empty-createMany không áp.

### Project Structure Notes

- File MỚI: **KHÔNG có** — story này chỉ mở rộng file hiện hữu (không migration, không module, không DTO, không port file mới).
- File SỬA: `backend/src/orders/{domain/order-status.ts, domain/order-events.ts, orders.service.ts, orders.controller.ts}`, `backend/openapi/openapi.json` (regen), `backend/test/{orders.service.spec.ts, orders.e2e.spec.ts}`, `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts}`, `web/src/screens/orders/CreateQuoteScreen.tsx` (+`orders.css` nếu cần), `mobile/lib/design_system/session/{orders_port.dart, fake_orders_port.dart}`, `mobile/lib/screens/orders/create_quote_screen.dart`, `mobile/test/screens/orders/create_quote_screen_test.dart`, `design-system/screens/orders.test.mjs`, `design-system/session/parity.test.mjs`.
- KHÔNG đụng: `order-totals.ts`/`line-amount.ts`/`price-resolution.ts` (pricing nguyên vẹn — chỉ GỌI), `schema.prisma` + migrations (cột có sẵn), `permission-registry.ts` + `permissions.json` + generated PERM files, `settings/` module, `vat-mode.ts`/`scope-preset.ts`, chip design-system (`dachot` đã có nhãn "Đã chốt" từ Epic 1), `UpdateOrderRequestDto`/`UpdateLineItemRequestDto` (không field mới), `warrantyStartAt`/`costPriceSnapshot`.
- Naming: route `/orders/:id/chot` (spine verbatim); method `confirm()`/`confirmOrder` khớp `PERM.ordersConfirm`; không file mới nên không đặt tên file.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.5] — 5 AC gốc (L440–447)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-5] — snapshot giá lúc chốt, không hồi tố
- [Source: ARCHITECTURE-SPINE.md#AD-6] — "Chốt" là transition snapshot giá line-item; `currentVersionId` con trỏ chân lý; #AD-16 — snapshot `vatRate`+`vatMode` hiệu lực lên `OrderVersion` lúc chốt; #AD-11 — applyTransition (5.1) là đích đến của điểm ghi status; #AD-20 — giá bán đóng băng lúc CHỐT, giá vốn lúc XUẤT KHO (đừng ghi costPriceSnapshot); #Consistency-Conventions — route `/orders/{id}/chot` verbatim + idempotency thao tác tiền (NFR SM-1)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md] — Dialog xác nhận có hệ quả "Chốt sẽ đóng băng giá" (L118), Chốt+snapshot (L125), voice KHÔNG hô hào (L63)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-quote L1501] — nút primary "Chốt báo giá" + icon ic-check cuối màn
- [Source: _bmad-output/implementation-artifacts/4-4-vat-cau-hinh-tick-ap-vat-metadata-don.md] — pattern resolve config ở controller, event sau write, toàn bộ Dev Notes hiện trạng + Review Follow-ups (DB lane còn treo)
- [Source: backend/src/auth/ — Story 2.3] — khuôn atomic `updateMany` + `count === 1` chống replay/double-write

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) — BMAD dev-story workflow.

### Debug Log References

- Backend lane lần chạy đầu đỏ 2 suite không liên quan (flake đã biết từ 4.4) — rerun 2 lần đều 838/838 xanh, không sửa gì.
- Mutation-check unit test FR-5: mutant đầu (`false ?` trong ternary) KHÔNG compile → RED giả (đúng bài học 4.x); viết lại 2 mutant compile được: (A) snapshot → cache `line.unitPrice`, (B) bỏ điều kiện `unitPriceSnapshot === null` khỏi filter `liveIds` — cả hai RED đúng test, revert bằng `cp` backup. Fixture tăng cường 3 con số phân biệt (snapshot 2_400_000 ≠ cache 2_450_000 ≠ giá sống 9_999_999) để mutant nào cũng lộ.
- Mutation-check guard (n) design-system: bẻ màn web tự gán `setOrder({...order, status: 'dachot'})` → guard RED đúng assert mới → revert bằng `cp` backup.
- DB lane (`npm run test:db`): KHÔNG chạy được — Postgres localhost:5432 unreachable + Docker daemon down (giới hạn phiên headless đã biết). Story không có migration mới nên lane không bắt buộc; action item 4.4 (migration `20260717000000` chưa deploy thật) VẪN TREO.

### Completion Notes List

- **Task 1:** `TRANG_THAI_DA_CHOT` thêm vào `order-status.ts` (chỉ hằng, union đã có khoá); `OrderConfirmed` (actor, before/after, at) shape y hệt `OrderMetaChanged`.
- **Task 2:** `confirm()` đúng luồng spec: fast-path idempotent `dachot` → 409 trạng thái khác → 400 đơn 0 dòng (trước tx) → snapshot 3 loại dòng (bảng Dev Notes, `resolveUnitPrice` + cùng cờ tier với đường live) → interactive `$transaction` với cổng atomic `updateMany + count===1`, sentinel `CHOT_GATE_THUA` abort + đọc lại; `vatMode` hiệu lực `?? 'co_vat'`; response compose `{...before, status: TRANG_THAI_DA_CHOT}`; event publish SAU commit CHỈ nhánh chốt thật. `toViews` snapshot-first: dòng snapshot non-null bỏ hẳn tra product (loại khỏi `liveIds`). Doc đầu file cập nhật (GIÁ TRƯỚC CHỐT + mục GHI STATUS/AD-11, comment "5.1 nuốt block này vào applyTransition()").
- **Task 3:** `POST :id/chot` `@HttpCode(200)` + `@RequirePermissions(PERM.ordersConfirm)`, controller resolve `vatRatePercent()` + `tieredPricingEnabled()` truyền xuống (pattern 4.4); không DTO mới, response `OrderResponseDto` nguyên vẹn; OpenAPI regen (+75 dòng, drift-guard xanh).
- **Task 4:** Unit 9 test mới (happy payload từng op, vatMode khong_vat giữ nguyên, write→publish, retry, race count 0 → idempotent/409, trạng thái lạ 409, đơn rỗng 400, toViews ưu tiên snapshot); e2e 7 test mới (401/403-với-quotes.create_edit/happy+audit/retry-body-y-hệt-GET-không-audit-thêm/giá-không-hồi-tố/400-rỗng/404). Mock `$transaction` mở rộng nhận cả callback-style (interactive) lẫn array-style.
- **Task 5:** `confirmOrder` thêm cả 4 file (port + fake × web/dart); fake đổi status idempotent, KHÔNG mô phỏng freeze giá (client không đọc snapshot).
- **Task 6:** Web — nút primary "Chốt báo giá" dưới Frame Tổng kết, bọc `<Gate perms requires={PERM.ordersConfirm}>` render khi `editable`; `ConfirmDialog` với consequence chứa "Chốt sẽ đóng băng giá"; `chotBusy` + `setOrder(kết quả)` + `onDone?.()`; lỗi → Banner giữ giỏ (pattern k); không success toast. CSS `.quote-chot-row` (flex, 0 shadow/gradient).
- **Task 7:** Mobile — param mới `perms` (`Set<PermissionKey>`, default `const {}` = ẩn nút, màn mobile ĐẦU TIÊN dùng `AppGate`); nút dưới khối Tổng kết, `AppConfirmDialog` (confirmTone primary — không phải hành động danger); `_chotBusy`/`_confirmOrder` twin logic web. 4 widget test mới: confirm-flow đầy đủ (dialog đúng chữ, fake nhận đúng orderId, màn về read-only, nút biến mất), huỷ dialog không gọi port, port throw giữ giỏ + vẫn editable, thiếu quyền nút không render. Test cũ không truyền perms → không vỡ. `dart format -o none` từng file.
- **Task 8:** Guard (c.2) thêm `confirmOrder` vào port-method list; (e) 2 nhãn byte-identical mới ("Chốt báo giá" + NGUYÊN CÂU consequence); (n) negative assert MỚI cấm màn tự gán literal `'dachot'` vào state (đã mutation-check RED); parity twin re-check `confirmOrder` 2 phía + cấm `ConfirmOrderInput` (body rỗng).
- **Task 9:** backend 838/838 (54 suite, gồm 7 source-guard + drift openapi/permissions), mobile 174/174 + `flutter analyze` 0 issue, design-system 273/273. DB lane không chạy được (xem Debug Log).
- Bất biến giữ nguyên: KHÔNG migration, KHÔNG đổi `permissions.json`/PERM generated, KHÔNG ghi `costPriceSnapshot`/`warrantyStartAt`, warranty đóng băng nhờ `assertMutable` có sẵn (AC #3 không code mới ngoài test).

### File List

- backend/src/orders/domain/order-status.ts
- backend/src/orders/domain/order-events.ts
- backend/src/orders/orders.service.ts
- backend/src/orders/orders.controller.ts
- backend/openapi/openapi.json (regen)
- backend/test/orders.service.spec.ts
- backend/test/orders.e2e.spec.ts
- web/src/design-system/session/orders-port.ts
- web/src/design-system/session/fake-orders-port.ts
- web/src/screens/orders/CreateQuoteScreen.tsx
- web/src/screens/orders/orders.css
- mobile/lib/design_system/session/orders_port.dart
- mobile/lib/design_system/session/fake_orders_port.dart
- mobile/lib/screens/orders/create_quote_screen.dart
- mobile/test/screens/orders/create_quote_screen_test.dart
- design-system/screens/orders.test.mjs
- design-system/session/parity.test.mjs

## Senior Developer Review (AI)

**Ngày:** 2026-07-17 · **Reviewer:** Đại Ca (adversarial review workflow) · **Kết luận: APPROVE — Story done.**

- **Git vs File List:** 17/17 file khớp, 0 discrepancy (2 file `_bmad-output` ngoài phạm vi review).
- **AC:** 6/6 IMPLEMENTED, đối chiếu code + test thật: (1) `POST /orders/:id/chot` + cổng atomic `updateMany + count===1` trong interactive tx, 403/404/400/409 đủ; (2) `toViews` snapshot-first theo tín hiệu DÒNG — unit test 3-số-phân-biệt (snapshot ≠ cache ≠ giá sống) + e2e giá-không-hồi-tố; (3) warranty đóng băng nhờ `assertMutable` (verify L204 — mọi mutation sau chốt 409); (4) bảng 3 loại dòng đúng từng cặp snapshot (unit assert payload từng op); (5) idempotent retry + race count-0 + event `OrderConfirmed` sau commit, audit qua AuditSubscriber (e2e thật); (6) UI 2 nền tảng gate `orders.confirm`, nhãn byte-identical, 4 widget test mobile gồm error case.
- **Task audit:** 9/9 task [x] đều có bằng chứng thật — không task nào tick khống.
- **Verify độc lập:** backend **843/843** (54 suite, gồm drift openapi/permissions + 7 source-guard), mobile **174/174** + `flutter analyze` 0 issue, design-system **273/273**. OpenAPI có `/orders/{id}/chot` đủ 200/400/403/404/409 + bearer, không requestBody. `viewOf` re-read lines sau tx → response trả giá đã đóng băng. DB lane không chạy được (Docker down — giới hạn phiên đã biết, story không có migration).
- **Findings:** 0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW → ghi action item ở "Review Follow-ups (AI)" (TOCTOU cửa sổ đọc-lines→commit — fix thật thuộc engine 5.1; `updatedAt` cũ trong response compose — spec cho phép; tap-miss warning pre-existing test cũ). Không auto-fix vì cả 3 đều là quyết định spec có chủ đích hoặc ngoài scope 4.5 — đảo lại vi phạm rule review-audit.

## Change Log

- 2026-07-17: Adversarial code review (story-automator review workflow) — 6/6 AC verified against code, 9/9 task có bằng chứng, 3 lane rerun độc lập xanh (backend 843, mobile 174 + analyze 0, design-system 273). 0 CRITICAL/HIGH/MEDIUM; 3 LOW ghi thành Review Follow-ups (TOCTOU → 5.1, updatedAt compose, tap-miss pre-existing). Story APPROVED. Status: review → done.
- 2026-07-17: QA automation (qa-generate-e2e-tests workflow) — rà gap coverage theo 6 AC, auto-apply 5 test mới: 4 unit (`orders.service.spec.ts`: tier price lúc chốt ×2 — cờ BẬT/TẮT, trong đó test cờ TẮT đã mutation-check bẻ `confirm()` hardcode cờ → RED; product biến mất → fallback giá cache; `toViews` trộn dòng frozen+live — tín hiệu per-line, nền 4.6) + 1 e2e (`orders.e2e.spec.ts`: vatRate đóng băng theo CONFIG row `'10'`, không hardcode default). Backend 838 → **843/843** xanh (flake `customer-sources`/`customers` rerun xanh như đã biết); mobile/design-system không đụng. Summary: `tests/test-summary-story-4-5.md`.
- 2026-07-17: Story 4.5 tạo bởi create-story workflow — ultimate context engine analysis hoàn tất, developer guide đầy đủ (scout backend/FE/guards + spine + UX + bài học 4.1–4.4). Status: ready-for-dev.
- 2026-07-17: Story 4.5 implement xong toàn bộ 9 task (dev-story workflow): endpoint `POST /orders/:id/chot` + cổng atomic idempotent + snapshot 3 loại dòng + vatRate/vatMode/chotAt lên OrderVersion + đường đọc snapshot-first + `OrderConfirmed` event; UI Chốt 2 nền tảng gate theo `orders.confirm` với ConfirmDialog; 16 backend test + 4 widget test + guard/parity mới (mutation-checked). 3 lane xanh (backend 838, mobile 174, design-system 273); DB lane không khả dụng (Docker down — ghi rõ ở Debug Log). Status: review.
