---
baseline_commit: 0329dac1c1650a26993b280f22b95bb3d4699730
---

# Story 4.2: Xem trước tổng realtime qua `POST /orders/preview-total`

Status: done

## Story

As a **người có quyền tạo báo giá** (`quotes.create_edit`),
I want **tổng tiền (Tổng trước VAT / Tiền VAT / Tổng sau VAT) cập nhật tức thì khi sửa dòng giỏ hàng**,
so that **chốt giá cùng khách ngay tại chỗ mà con số hiển thị KHÔNG BAO GIỜ lệch với backend — một bộ tính duy nhất (AD-16)**.

## Acceptance Criteria

*(AC-1..AC-3 nguyên văn từ epics.md — Story 4.2, dòng 419-424)*

1. **Client chỉ hiển thị (AD-16, FR-1, NFR-3):** Given giỏ hàng đang dựng, When sửa số lượng/đơn giá/dòng, Then client gọi stateless `POST /orders/preview-total` và chỉ hiển thị integer trả về — client CẤM làm số học tiền.
2. **Một bộ tính (AD-10, AD-16):** Given thuật toán tiền, When backend tính, Then `subtotal = Σ(unitPrice × qty)` theo integer đồng và preview dùng CHÍNH hàm pricing domain (một bộ tính).
3. **Realtime (FR-1, FR-3, UX-DR-24):** Given tổng preview, When hiển thị, Then Tổng trước VAT / Tiền VAT / Tổng sau VAT cập nhật ngay không cần lưu thủ công.

*Bổ sung chất lượng (theo chuẩn dự án):*

4. **Quality gates:** `cd backend && npm test` xanh (source-guard + drift-guard + unit + e2e); `cd design-system && npm test` xanh (guard cập nhật + parity); `cd mobile && flutter analyze && flutter test` xanh (widget test cập nhật + case mới). OpenAPI regen, không sửa tay spec (AD-12). Không migration, không key quyền mới.

## Tasks / Subtasks

- [x] Task 1: Hàm pricing domain `backend/src/orders/domain/order-totals.ts` (AC: 2)
  - [x] Hàm thuần `computeOrderTotals(input: { lines: ReadonlyArray<{ unitPrice: number; qty: number }>, vatRate: number, applyVat: boolean }): { subtotal: number; vatAmount: number; total: number }` — nâng cấp "hạt giống" `line-amount.ts` thành hàm pricing đầy đủ mà AD-16 chỉ định sống ở `orders/domain`; TÁI DÙNG `lineAmount()` cho từng dòng (`subtotal = Σ lineAmount(unitPrice, qty)`), KHÔNG viết lại phép nhân
  - [x] VAT round-half-up MỘT điểm làm tròn, THUẦN INTEGER — CẤM float: `vatAmount = applyVat ? Math.floor((subtotal * vatRate + 50) / 100) : 0`; `total = subtotal + vatAmount` (AD-10, AD-16; xem Dev Notes §Thuật-toán)
  - [x] Hằng `VAT_RATE_MAC_DINH = 8` export từ cùng file (PRD FR-3: mặc định 8%) — 4.4 thay chỗ RESOLVE bằng config, KHÔNG đổi chữ ký hàm
  - [x] File thuần như `line-amount.ts`: zero import Nest/Prisma; doc comment ghi rõ đây là hàm pricing DUY NHẤT — 4.4 (tick/áp rate cấu hình) và 4.5 (chốt) đều PHẢI gọi hàm này, cấm bộ tính thứ hai
- [x] Task 2: Endpoint `POST /orders/preview-total` — DTO + controller + service (AC: 1, 2)
  - [x] `backend/src/orders/dto/preview-total-request.dto.ts`: `PreviewTotalLineDto { unitPrice: @IsInt() @Min(0); qty: @IsInt() @Min(1) }`; `PreviewTotalRequestDto { lines: @IsArray() @ValidateNested({ each: true }) @Type(() => PreviewTotalLineDto) @ArrayMaxSize(500) }` — mảng RỖNG hợp lệ (giỏ vừa xoá sạch → tổng 0); `@Type` từ `class-transformer` (ValidationPipe đã `transform: true` — `validation-pipe.factory.ts`)
  - [x] `backend/src/orders/dto/preview-total-response.dto.ts`: `{ subtotal: number; vatAmount: number; total: number }` — 3 field `@ApiProperty({ type: Number })` integer đồng, doc comment AD-16 "client chỉ hiển thị"
  - [x] Controller: `@Post('preview-total')` + `@HttpCode(200)` (compute, không tạo resource — 201 mặc định của @Post là sai ngữ nghĩa) + `@RequirePermissions(PERM.quotesCreateEdit)` + `@ApiOkResponse({ type: PreviewTotalResponseDto })` + error responses `ErrorEnvelopeDto` như các route hiện hữu; khai TRƯỚC các route `:id` (kỷ luật route-tĩnh-trước-`:param` từ 3.4, dù POST hiện không collision)
  - [x] Service `previewTotal(dto)`: stateless — KHÔNG chạm Prisma, KHÔNG publish event (không phải mutation nghiệp vụ → FR-20 không đòi audit; đừng để source-guard side-effect thành cớ thêm dep); resolve `vatRate = VAT_RATE_MAC_DINH`, `applyVat = true` (4.2 chưa có tick — 4.4) rồi gọi `computeOrderTotals`; giữ service ĐÚNG 2 dependency hiện có
- [x] Task 3: OpenAPI + drift-guard (AC: 4)
  - [x] `npm run openapi:gen` → commit `backend/openapi/openapi.json` mới (cấm sửa tay — AD-12)
  - [x] Thêm `it(...)` vào `backend/test/openapi-drift.spec.ts` assert path `/orders/preview-total` + schema `PreviewTotalRequestDto`/`PreviewTotalResponseDto` tồn tại (pattern per-story có sẵn trong file)
- [x] Task 4: Test backend (AC: 1, 2, 4)
  - [x] Unit domain `computeOrderTotals` (thêm describe vào `backend/test/orders.service.spec.ts` hoặc file riêng `order-totals.spec.ts` cạnh test hiện hữu): (a) mảng rỗng → `{0,0,0}`; (b) nhiều dòng cộng dồn đúng qua `lineAmount`; (c) half-up boundary — dùng vatRate lẻ vì hàm nhận tham số: `subtotal=1010, vatRate=5` → `50.5` → **51** (chứng minh half-UP, không banker's); với `vatRate=8` tích `subtotal×8` luôn chẵn nên không có case `.5` — đừng mất công tìm; (d) `applyVat=false` → vat 0, total = subtotal; (e) MỘT điểm làm tròn: 3 dòng lẻ tính từng-dòng-rồi-cộng ≠ tính-trên-tổng, assert kết quả theo GRAND-SUBTOTAL (vd 3 dòng subtotal 333+333+333=999, rate 7 → floor((999×7+50)/100)=70, KHÔNG phải 3×floor((333×7+50)/100)=69) — mutant đổi công thức sang per-line phải RED
  - [x] Unit service `previewTotal`: gọi đúng hàm domain với `vatRate=8, applyVat=true`; KHÔNG chạm `prisma.*` (assert mock Prisma zero interaction), KHÔNG publish event (assert eventBus không gọi) — assert PAYLOAD, không đếm call
  - [x] e2e `orders.e2e.spec.ts`: (a) thêm route vào bảng fail-closed 401/403 (mọi handler không @Public phải bị bảng này phủ); (b) happy path: body 2 dòng `[{unitPrice: 2_450_000, qty: 8}, {unitPrice: 500_000, qty: 1}]` → `subtotal 20_100_000, vatAmount 1_608_000, total 21_708_000` (8%); (c) `lines: []` → `{0,0,0}`; (d) validation: `unitPrice: -1` → 400 + fieldErrors envelope; `qty: 0` → 400; thiếu `lines` → 400; (e) KHÔNG đụng assert hiện hữu "GET /orders/:id không có subtotal/total" — endpoint mới là route riêng, invariant đó giữ nguyên
  - [x] Mutation spot-check (kỷ luật 2.10, mutant compile sạch, restore bằng `cp` KHÔNG `git checkout`): mutant A `+ 50` → `+ 49` (lệch half-up) → unit (c) RED; mutant B công thức per-line rounding → unit (e) RED
  - [x] KHÔNG viết `.db.integration.spec.ts` mới — endpoint stateless không chạm DB, không migration, DB lane không có sự thật nào để giữ
- [x] Task 5: Mở rộng port FE — `previewTotal` + fake 2 nền tảng (AC: 1, 3)
  - [x] `web/src/design-system/session/orders-port.ts`: type `OrderTotals { subtotal: number; vatAmount: number; total: number }` + `PreviewTotalInput { lines: Array<{ unitPrice: number; qty: number }> }` + method `previewTotal(input: PreviewTotalInput): Promise<OrderTotals>` vào interface `OrdersPort`; XOÁ câu doc "deliberately NO subtotal/VAT/total" (dòng 31-36) — thay bằng ghi chú totals đi qua `previewTotal`, vẫn KHÔNG nằm trên `Order`
  - [x] `fake-orders-port.ts`: fake ĐÓNG VAI backend (tiền lệ `serverAmount` 4.1) → tính bằng CÙNG công thức: `subtotal = Σ(unitPrice*qty)`, `vatAmount = Math.floor((subtotal * 8 + 50) / 100)`, `total = subtotal + vatAmount`
  - [x] Twin Dart `orders_port.dart` (`OrderTotals` — 3 field `int`, method abstract) + `fake_orders_port.dart` (`vatAmount = (subtotal * 8 + 50) ~/ 100`); nhãn/khoá/JSON-shape parity byte-level với web
  - [x] KHÔNG file port mới → KHÔNG đụng `parityFiles` của `design-system/session/parity.test.mjs`
- [x] Task 6: Nối web `CreateQuoteScreen.tsx` (AC: 1, 3)
  - [x] State `totals: OrderTotals | null` (null → hiển thị "—"); helper `refreshTotals(fetched: Order)` gọi `ordersPort.previewTotal({ lines: fetched.lineItems.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })) })` — echo giá backend đã trả, KHÔNG phép tính nào trong màn
  - [x] Gọi từ `refresh()` (dòng 110-118) sau khi `get` thành công VÀ ngay sau `create` ở bước 1 — MỘT đường code duy nhất cho mọi mutation (add/update qty/update price/delete/tick gói đều đã `await refresh()`)
  - [x] Race-ticket `latest` (pattern `CustomerListScreen.tsx:73-95`): `const ticket = ++latestTotals.current` trước call, bỏ response nếu `ticket !== latestTotals.current` — mutation liên tiếp không cho tổng cũ đè tổng mới
  - [x] Lỗi preview: `setTotals(null)` → khu tổng về "—" (KHÔNG hiển thị số cũ đã sai) + `setError(messageOf(err))` như các handler hiện hữu; lỗi preview KHÔNG xoá giỏ, KHÔNG chặn sửa dòng tiếp (bất biến k của guard)
  - [x] Render (dòng 307-317): thay 3 giá trị "—" bằng `totals ? String(totals.subtotal) : '—'` (v.v.) — hiển thị integer thô như `amount` dòng (widget test 4.1 assert `'12250000'` — cùng convention); giữ nguyên markup `dl.quote-totals` + css, KHÔNG đổi sang Kpi
- [x] Task 7: Nối mobile `create_quote_screen.dart` + widget test (AC: 1, 3, 4)
  - [x] Bỏ `const` ở Frame "Tổng kết" (dòng 594-606); state `OrderTotals? _totals`; helper `_refreshTotals(Order fetched)` gọi trong `_refresh()` sau `get` thành công + sau `_createOrder`; ticket `int _latestTotals` như `customer_list_screen.dart:66-101` (+ check `mounted`)
  - [x] Lỗi preview → `_totals = null` ("—") + `_showError`; giữ giỏ nguyên
  - [x] `_TotalRow(value: _totals == null ? '—' : '${_totals!.subtotal}')` (v.v.) — copy tiếng Việt 3 nhãn giữ byte-identical với web
  - [x] Widget test `create_quote_screen_test.dart`: (a) SỬA assert hiện hữu dòng ~93-97 — sau khi tạo đơn + pumpAndSettle, giỏ rỗng hiển thị `0` ×3 (fake preview trả 0/0/0), KHÔNG còn `'—' ×3`; (b) case mới: thêm dòng catalog (fixture fake: 2_450_000×5=12_250_000) → totals hiển thị `12250000` / `980000` / `13230000` — số của FAKE trả, màn không nhân; (c) case mới: `_RejectingPreviewPort` (subclass override `previewTotal` throw `OrderPortException`) → totals về "—", dòng giỏ VẪN CÒN, message backend nguyên văn; (d) case sửa qty → totals đổi theo response mới
  - [x] `dart format -o none --set-exit-if-changed <file sửa>` (CẤM format cả cây)
- [x] Task 8: Cập nhật guard `design-system/screens/orders.test.mjs` (AC: 1, 4)
  - [x] (c.2) thêm `previewTotal` vào danh sách port-reach `create,get,addLine,updateLine,removeLine` (dòng 114-125)
  - [x] (h) GIỮ regex money-math + ban `reduce(` nguyên vẹn (màn vẫn cấm số học tiền — giờ càng quan trọng); SỬA 2 assert placeholder dòng 217-218: "—" giờ là trạng thái đầu/lỗi, vẫn phải hiện diện trong source cả 2 nền tảng → giữ assert `includes('—')` nhưng cập nhật message mô tả ("fallback khi chưa có/lỗi preview"); đổi message assert `reduce(` (không còn "totals are Story 4.2's" — mô tả bất biến trực tiếp: "totals chỉ đến từ preview-total")
  - [x] Assert MỚI: cả 2 màn gọi `previewTotal(`; cả 2 màn KHÔNG chứa vat-math (`* 8`, `0.08`, `Math.floor`/`~/` trên biến tiền trong SCREEN — fake được phép, screen không); danh sách nhãn byte-identical (e) giữ `'Tổng trước VAT'/'Tiền VAT'/'Tổng sau VAT'/'—'` nguyên
  - [x] Mutation-check guard mới (kỷ luật 4.1): cấy `subtotal * 8` vào màn web → guard phải RED rồi mới nhận
- [x] Task 9: Chạy đủ lane + sprint-status (AC: 4)
  - [x] `cd backend && npm test` · `cd design-system && npm test` · `cd mobile && flutter analyze && flutter test` (DB lane không có spec mới; nếu có Postgres chạy `npm run test:db` xác nhận không vỡ gì cũ)
  - [x] `sprint-status.yaml`: `4-2-xem-truoc-tong-realtime-qua-post-orders-preview-total: review` khi dev xong

## Dev Notes

### Bối cảnh & ranh giới story (ĐỌC TRƯỚC KHI CODE)

Story 4.1 đã dựng xong toàn bộ giỏ hàng (backend `orders/` 5 endpoint + 2 màn Tạo báo giá + port/fake 2 nền tảng) và ĐỂ SẴN chỗ cho 4.2: khu tổng hiển thị "—" placeholder, `line-amount.ts` tự nhận là "hạt giống của hàm pricing đầy đủ", `order-response.dto.ts:9` ghi "tính tổng là Story 4.2". Story này CHỈ: (1) hàm pricing domain đầy đủ, (2) endpoint stateless `POST /orders/preview-total`, (3) nối realtime 2 màn. **CẤM làm trước:**

| KHÔNG làm | Thuộc story |
|---|---|
| Tick "áp VAT hay không" trên UI/Order, thuế suất CẤU HÌNH được (màn settings, gate `settings.manage`), resolve vatRate từ config/Order | 4.4 |
| Snapshot `vatRate`/`vatMode` lên `OrderVersion`, mọi thứ liên quan Chốt | 4.5 |
| Migration/đổi schema (4.2 KHÔNG cần cột nào mới — `Order.vatMode`/`OrderVersion.vatRate` đã tồn tại, để nguyên null) | 4.4/4.5 |
| Đổi shape `GET /orders/:id` (e2e hiện assert response KHÔNG có `subtotal`/`total` — giữ nguyên) | — |
| Debounce/throttle client — mutation đã round-trip qua port rồi mới refresh; ticket chống race là đủ, đừng chế thêm | — |

[Source: epics.md#Story-4.2 (dòng 419-424); 4-1-...md#File-List; backend/src/orders/dto/order-response.dto.ts:9]

### Hợp đồng endpoint (quyết định thiết kế — ĐÃ CHỐT, kèm lý do)

**`POST /orders/preview-total`** — stateless (AD-16 nguyên văn: "realtime cart preview uses this SAME backend function via stateless `POST /orders/preview-total`").

```
Request:  { lines: [{ unitPrice: int ≥ 0, qty: int ≥ 1 }] }     // mảng rỗng hợp lệ
Response: { subtotal: int, vatAmount: int, total: int }          // integer đồng
```

- **Client gửi lines, không gửi orderId** — stateless đúng nghĩa: không đọc DB, preview phản chiếu chính xác các dòng client đang HIỂN THỊ (unitPrice là giá backend đã trả về qua `GET /orders/:id`, client chỉ echo lại — không vi phạm AD-16 vì không có phép tính nào ở client).
- **Client KHÔNG gửi vatRate/applyVat** — backend chưa có config VAT (scout xác nhận: không settings module, không hằng nào trong src; `OrderVersion.vatRate` null tới 4.4/4.5). 4.2 resolve tại service: `vatRate = VAT_RATE_MAC_DINH (8)`, `applyVat = true`. Đẩy vatRate xuống client là đẩy business value ra khỏi backend — sai hướng AD-2. Story 4.4 sẽ mở rộng CHỖ RESOLVE (đọc config + tick trên Đơn), có thể thêm field request — additive, không breaking.
- **Response 200** (`@HttpCode(200)`) — compute thuần, không tạo resource, 201 mặc định của `@Post` sai ngữ nghĩa.
- **Không event, không audit** — preview không phải mutation nghiệp vụ (FR-20 chỉ đòi audit mutation); service method này không chạm Prisma lẫn EventBus.
- **Quyền: `PERM.quotesCreateEdit`** — cùng key mọi route orders hiện hữu (người dựng giỏ là người cần xem tổng); source-guard `no-handler-without-require-permissions` bắt buộc có decorator. KHÔNG key mới → không regen permissions.
- **`@ArrayMaxSize(500)`** — chặn body vô hạn cho endpoint compute công khai theo quyền; 500 dòng vượt xa mọi báo giá thật, không đụng ai.

### Thuật toán tiền (AD-16 — pin công thức, THUẦN INTEGER)

```ts
// orders/domain/order-totals.ts — hàm pricing DUY NHẤT (4.4 tick, 4.5 chốt đều gọi hàm này)
subtotal  = Σ lineAmount(line.unitPrice, line.qty)                    // tái dùng seed 4.1
vatAmount = applyVat ? Math.floor((subtotal * vatRate + 50) / 100) : 0 // round-half-up, MỘT điểm làm tròn, GRAND-SUBTOTAL
total     = subtotal + vatAmount
```

- `Math.floor((x*rate + 50)/100)` là half-up thuần số nguyên — CẤM `Math.round(subtotal * rate / 100)` (phép chia float trước khi round có thể lệch ULP) và CẤM làm tròn từng dòng (AD-16: một điểm làm tròn duy nhất — unit test (e) của Task 4 giữ bất biến này).
- `vatRate` là **Int phần trăm** (8 = 8%) — khớp cột `OrderVersion.vatRate Int?` mà 4.5 sẽ snapshot.
- Tràn số: unitPrice/qty là int đồng thực tế (≤1e13/dòng, ≤500 dòng) — xa giới hạn 2^53, không cần BigInt.
- JS `Math.round(-0.5)` quirk không liên quan — tiền không âm (DTO `@Min(0)`).

[Source: ARCHITECTURE-SPINE.md#AD-10 #AD-16; prd.md#FR-3; backend/src/orders/domain/line-amount.ts]

### Backend — pattern hiện hành phải theo (scout 2026-07-17, HEAD 0329dac)

- **Controller** (`orders.controller.ts`): `@ApiTags('orders')` + `@ApiBearerAuth()` cấp class; mỗi route `@RequirePermissions(PERM.quotesCreateEdit)` + `@ApiOkResponse({type})` + error responses `ErrorEnvelopeDto`; import `RequirePermissions` từ `../auth/require-permissions.decorator`, `PERM` từ `../accounts/domain/permission-registry`. Controller KHÔNG nặn envelope (AD-5 — `AllExceptionsFilter`). Route hiện có: `@Post()` L65, `@Get(':id')` L91, `@Post(':id/line-items')` L113, `@Patch/@Delete(':id/line-items/:lineId')` L151/L190.
- **Service** (`orders.service.ts:128-131`): ĐÚNG 2 dependency `PrismaService` + `EventBus` (comment trong file enforce) — `previewTotal` không thêm dep nào.
- **DTO**: `@IsInt() @Min(0)` tiền, `@Min(1)` qty (khớp `add-line-item-request.dto.ts`); ValidationPipe `whitelist: true, transform: true`, lỗi thành `AppException(VALIDATION_ERROR, 400, 'Dữ liệu không hợp lệ', fieldErrors)` (`common/validation/validation-pipe.factory.ts`). Response DTO là class cho OpenAPI (AD-12) — 3 field non-nullable, không dính bẫy nullable-union codegen.
- **Nested-array validation là pattern MỚI trong repo** (các DTO hiện hữu đều flat): cần đủ bộ `@IsArray()` + `@ValidateNested({ each: true })` + `@Type(() => PreviewTotalLineDto)` — thiếu `@Type` là class-transformer không instantiate phần tử và validator im lặng cho qua; e2e (d) của Task 4 chứng minh validation chạy thật.
- **Domain thuần**: `line-amount.ts`/`order-status.ts` zero import framework — `order-totals.ts` giữ chuẩn đó.
- **OpenAPI**: `npm run openapi:gen` (ts-node script, không cần DB); drift-guard `test/openapi-drift.spec.ts` so byte-for-byte + assert path per-story.
- 7 source-guard kiến trúc + naming-convention tự áp lên code mới — file kebab-case, không cần làm gì thêm ngoài đặt tên đúng.

### Frontend — điểm nối chính xác (scout 2026-07-17)

**Web `CreateQuoteScreen.tsx` (487 dòng):**
- Mọi mutation đã funnel: handler → port call → `await refresh()` (L110-118, `ordersPort.get`) → chỉ cần cắm `refreshTotals` vào refresh + sau `create` bước 1. KHÔNG có `latest` ticket trong màn này (4.1 refresh tuần tự là đủ) — 4.2 THÊM ticket riêng cho totals vì preview là call thứ hai có thể về trễ/đè.
- Khu tổng L307-317: `Frame label="Tổng kết"` + `dl.quote-totals` (css `orders.css:46-63` đã sẵn, không đổi) — thay đúng 3 chuỗi "—".
- Lỗi: `messageOf(err)` (L473-476) trả `envelope?.message ?? 'Không thực hiện được. Thử lại.'`; error KHÔNG BAO GIỜ reset `order` (bất biến guard k).
- Hiển thị số: integer thô `String(n)` — cùng convention `amount` của `CartLineRow` (widget test 4.1 assert `'12250000'`).

**Mobile `create_quote_screen.dart` (655 dòng):**
- Twin của web: `_refresh()` L100-113, `_showError` L87-97; khu tổng L594-606 hiện là `const AppFrame(...)` — PHẢI bỏ `const` khi nối state. `_TotalRow` local widget L615-654 dùng lại nguyên (đã có `strong` + tabular figures).
- Ticket pattern mobile: `customer_list_screen.dart:66-101` (`int _latest`, check `mounted && ticket == _latest`).

**Port/fake:**
- `OrdersPort` hiện 5 method (L107-126 web; `orders_port.dart:161-180`) — thêm `previewTotal`. Fake đóng vai backend (tiền lệ `serverAmount` L156-158 web / `_serverAmount` L183 dart) → công thức 8% half-up ở FAKE là ĐÚNG chỗ (guard money-math chỉ quét screen + port interface; fake là backend surrogate). Dart dùng `~/` cho chia nguyên.
- Web fake hiện reject bằng `Error` thường (không phải `OrderPortError` shape) — `.message` vẫn render được, giữ nguyên convention khi viết reject path cho previewTotal.

**Guard `orders.test.mjs` (bảng chỉ đích danh — Task 8):** (c.2) port-reach list L114-125; (e) nhãn byte-identical L144-176 (có sẵn 3 nhãn tổng + '—'); (h) money-math regex + ban `reduce(` L206-219 + 2 assert placeholder L217-218 phải sửa message. Web vẫn là text-guard-only (TD-1/C-4 chấp nhận xuyên Epic 4) — guard này là tuyến phòng thủ DUY NHẤT của `.tsx`, negative assert mới (cấm vat-math trong screen) phải mutation-check trước khi nhận.

### Testing (chuẩn lane + kỷ luật Epic 3/4.1)

| Lane | Lệnh | Story này |
|---|---|---|
| Backend hermetic | `cd backend && npm test` | unit domain + service, e2e route mới, drift openapi, bảng fail-closed 401/403 |
| Backend DB | `npm run test:db` | KHÔNG spec mới (stateless, không schema) — chỉ xác nhận không vỡ cũ nếu có Postgres |
| Design-system | `cd design-system && npm test` | guard orders cập nhật (c.2/e/h + assert mới) |
| Mobile | `cd mobile && flutter analyze && flutter test` | widget test: sửa assert '—'×3 cũ + 4 case mới (0-tổng, số fake, lỗi-giữ-giỏ, qty-đổi-tổng-đổi) |

- **Assert payload, không đếm call** (bài học 3.2); fixture e2e có sẵn `PIN_580W 2_450_000 × qty 8` — tính số kỳ vọng bằng tay ghi thẳng vào assert, đừng gọi lại hàm domain trong assert (test tự chứng minh, không tautology).
- e2e gotcha nguyên trạng: `process.env.JWT_ACCESS_SECRET` top-level TRƯỚC dynamic `await import('../src/app.module')`; mock Prisma đủ mọi model route chạm (preview không chạm model nào — nhưng guard/`/me` chạm account); `givenPermissions(PERM.quotesCreateEdit)`.
- Widget test hiện hữu L93-97 assert `find.text('—') findsNWidgets(3)` SẼ GÃY khi nối preview — sửa nó là một phần Task 7, đừng để RED bất ngờ.
- Mutation-check cả hai phía: 2 mutant backend (Task 4) + 1 mutant guard (Task 8) — mutant compile sạch, restore `cp` backup (code chưa commit, `git checkout` xoá sạch).

### Project Structure Notes

- Backend NEW: `backend/src/orders/domain/order-totals.ts`; `backend/src/orders/dto/preview-total-request.dto.ts`, `preview-total-response.dto.ts`. UPDATE: `orders.controller.ts`, `orders.service.ts`, `openapi/openapi.json` (regen), `test/orders.service.spec.ts` (hoặc + `test/order-totals.spec.ts`), `test/orders.e2e.spec.ts`, `test/openapi-drift.spec.ts`.
- FE UPDATE (KHÔNG file mới): `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts}`; `web/src/screens/orders/CreateQuoteScreen.tsx`; twin `mobile/lib/design_system/session/{orders_port.dart, fake_orders_port.dart}`; `mobile/lib/screens/orders/create_quote_screen.dart`; `mobile/test/screens/orders/create_quote_screen_test.dart`; `design-system/screens/orders.test.mjs`.
- KHÔNG migration, KHÔNG đụng `schema.prisma`, KHÔNG đụng registry/permissions, KHÔNG đụng `parityFiles`.
- KHÔNG nhét plan-ID/nhãn audit vào tên code/test — mô tả bất biến trực tiếp.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.2 (dòng 419-424) + #Additional-Requirements (dòng 81)]
- [Source: _bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#AD-2 #AD-4 #AD-5 #AD-10 #AD-12 #AD-16 #AD-17 #Consistency-Conventions]
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-1 #FR-3 (§4.1, dòng 114-118: mặc định 8%, tick là 4.4) #NFR-3]
- [Source: _bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md#Interaction-Primitives (Recalc tổng realtime, dòng 123); DESIGN.md]
- [Source: _bmad-output/implementation-artifacts/4-1-tao-don-dung-gio-hang-order-orderversion-orderlineitem.md — toàn bộ File List + Dev Notes + Review]
- [Source: backend/src/orders/* (HEAD 0329dac); web/src/screens/orders/CreateQuoteScreen.tsx; mobile/lib/screens/orders/create_quote_screen.dart; design-system/screens/orders.test.mjs]

### Previous Story Intelligence (4.1 → 4.2)

- **Review 4.1 tìm ra 1 High cả 4 lane đều xanh mới thấy** (lỗi bước 1 vô hình) — vì vậy case widget-test "lỗi preview → totals '—' + giỏ còn nguyên" là BẮT BUỘC, đừng chỉ test happy path.
- **`displayOrder` từng gãy vì `count()`** — bài học chung: đọc kỹ hàm có sẵn trước khi gọi; ở 4.2 tương tự: dùng `lineAmount()` seed, đừng viết lại phép nhân trong `computeOrderTotals`.
- **Guard money-math từng LỌT mutant `line.unitPrice * line.qty`** (regex không nhận operand `line.`-prefixed, đã vá) — assert vat-math mới của Task 8 phải mutation-check y như vậy trước khi nhận.
- **Fake port là backend surrogate** — mọi số học tiền FE chỉ được sống trong fake (4.1 đã pin nguyên tắc); nếu thấy mình viết `*` hay `Math.floor` trong file màn/component là SAI CHỖ.
- **Flake lane backend** (customer-sources.e2e, 1/3 lần full-run — Review Follow-up 4.1 còn mở): nếu gặp, chạy lại/chạy solo trước khi nghi code mình; đừng sửa lan man file ngoài scope.
- **Lint nợ cũ** (`products.e2e.spec.ts`, `product-prices.db.integration.spec.ts` fail prettier từ trước) — không phải việc 4.2.
- DB lane 4.1 còn nợ môi trường (Postgres cục bộ không lên) — 4.2 không thêm nợ vì không có spec DB mới.

### Git Intelligence

HEAD `0329dac` = trọn Story 4.1 (55 file: module orders 5 endpoint, 2 màn, port/fake, guard, widget test — xem File List 4.1). Pattern commit chuẩn: conventional tiếng Việt, gộp guard + màn web + màn mobile + test + sprint-status một commit, không tham chiếu AI.

### Thư viện & phiên bản (đã pin — KHÔNG tra web)

Node 24 LTS · NestJS ^11.1.27 (`@nestjs/swagger` ^11.4.5) · Prisma 7.8.0 (KHÔNG đụng ở story này) · class-validator ^0.15.1 + class-transformer (`@Type` cho nested DTO — pattern mới, xem §Backend) · jest ^30 · React 19.2.7 (source-only, text-guard) · Flutter 3.44 (`dart format -o none`). Mọi quirk liên quan đã ghi ở các mục trên; không có API mới/ngoài cần research.

### Project Context Reference

Đọc `_bmad-output/project-context.md` trước khi code — luật cứng cho story này: client không số học tiền (AD-16 là LÝ DO story này tồn tại), một hàm pricing duy nhất ở `orders/domain`, không permission literal, không sửa file generated, scout-before-code, thay đổi surgical đúng scope.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) — BMAD dev-story workflow.

### Debug Log References

- RED→GREEN domain: `order-totals.spec.ts` fail (module chưa tồn tại) → implement → 6/6 xanh.
- Mutation spot-check backend (restore bằng `cp`, mutant compile sạch): mutant A `+50 → +49` → unit half-up boundary RED (1 failed); mutant B per-line rounding → unit một-điểm-làm-tròn RED (1 failed); restore → 6/6 xanh.
- Mutation-check guard mới: cấy `Math.floor((totals.subtotal * 8 + 50) / 100)` vào màn web → guard h.2 RED (266 tests, 1 fail); restore → 266 xanh.
- Prettier auto-fix 4 file backend (chỉ wrap dòng); ESLint sạch; openapi.json không đổi sau format (drift-guard vẫn xanh byte-for-byte).
- Postgres cục bộ không có (nợ môi trường từ 4.1) — DB lane bỏ qua đúng kế hoạch, story không thêm spec DB.

### Completion Notes List

- **Task 1**: `computeOrderTotals()` — hàm pricing DUY NHẤT ở `orders/domain`, thuần integer, tái dùng `lineAmount()` per-line, VAT half-up `floor((subtotal*rate+50)/100)` MỘT điểm làm tròn tại grand-subtotal; `VAT_RATE_MAC_DINH = 8` export cùng file; zero import framework.
- **Task 2**: `POST /orders/preview-total` — DTO nested (`@IsArray + @ValidateNested({each}) + @Type + @ArrayMaxSize(500)`, mảng rỗng hợp lệ), `@HttpCode(200)`, `@RequirePermissions(PERM.quotesCreateEdit)`, khai trước các route `:id`; service `previewTotal()` stateless (không Prisma/EventBus, giữ đúng 2 dependency), resolve `vatRate=8, applyVat=true`.
- **Task 3**: OpenAPI regen (+112 dòng, không sửa tay); drift-guard thêm per-story assert: path + 3 schema PreviewTotal* + bearer + response required đủ 3 field.
- **Task 4**: unit domain 6 case (rỗng/cộng dồn/half-up 50.5→51/applyVat=false/grand-vs-per-line 999@7%→70≠69/hằng 8); unit service 2 case (payload đúng 8% + zero Prisma/EventBus interaction); e2e: route vào bảng fail-closed 401/403, happy 2 dòng → 20_100_000/1_608_000/21_708_000, lines rỗng → 0/0/0, validation 400 (unitPrice -1, qty 0, thiếu lines); invariant "GET /orders/:id không có subtotal/total" giữ nguyên.
- **Task 5**: port 2 nền tảng thêm `OrderTotals` + `PreviewTotalInput` + `previewTotal()`; doc "deliberately NO subtotal" thay bằng ghi chú totals đi qua previewTotal; fake đóng vai backend với CÙNG công thức (web `Math.floor`, dart `~/`); không file mới → parityFiles không đụng.
- **Task 6**: web nối `refreshTotals(fetched)` từ `refresh()` + sau `create` (một đường code); race-ticket `latestTotals` (useRef); lỗi preview → `setTotals(null)` ("—") + `setError`, giỏ giữ nguyên; render integer thô `String(totals.subtotal)` giữ markup `dl.quote-totals`.
- **Task 7**: mobile twin — bỏ `const` Frame Tổng kết, `_totals`/`_latestTotals` + `mounted` check; widget test: sửa assert cũ ('—'×3 → '0'×3 vì fake preview giỏ rỗng trả 0/0/0) + 3 case mới (số fake 12250000/980000/13230000; `_RejectingPreviewPort` → "—"+giỏ còn+message nguyên văn; qty đổi → totals đổi); `dart format -o none` 0 changed.
- **Task 8**: guard — (c.2) thêm `previewTotal` vào port-reach; (h) messages cập nhật, regex money-math + ban `reduce(` giữ nguyên; (h.2) MỚI: cả 2 màn gọi `previewTotal(`, cấm `* 8`/`0.08`/`Math.floor(`/`~/ 100` trong screen (fake được phép); mutation-checked.
- **Task 9**: backend 50 suite/754 test xanh · design-system 266 xanh · mobile analyze sạch + 158 test xanh · sprint-status → review.
- Không migration, không key quyền mới, không đụng parityFiles/schema.prisma/registry. Không làm trước phần 4.4/4.5 (vatRate config, tick VAT, snapshot).
- **QA automation phase (sau dev, trước review)**: gap analysis 6 gap → +5 test/+1 guard test (half-up biên DƯỚI 1009@5%→50; @ArrayMaxSize biên 500/501; @IsInt chặn float; @Min(0) biên dương unitPrice=0; race-ticket mobile qua `_ManualPreviewPort` complete ngược thứ tự; guard h.3 pin 3 field web + công thức fake 2 nền tảng). Chi tiết + mutant chứng minh: `_bmad-output/implementation-artifacts/tests/test-summary-story-4-2.md`. Số lane sau QA: backend **758** · design-system **267** · mobile **159**.

### File List

- backend/src/orders/domain/order-totals.ts (NEW)
- backend/src/orders/dto/preview-total-request.dto.ts (NEW)
- backend/src/orders/dto/preview-total-response.dto.ts (NEW)
- backend/src/orders/orders.controller.ts
- backend/src/orders/orders.service.ts
- backend/openapi/openapi.json (regen `npm run openapi:gen`)
- backend/test/order-totals.spec.ts (NEW)
- backend/test/orders.service.spec.ts
- backend/test/orders.e2e.spec.ts
- backend/test/openapi-drift.spec.ts
- web/src/design-system/session/orders-port.ts
- web/src/design-system/session/fake-orders-port.ts
- web/src/screens/orders/CreateQuoteScreen.tsx
- mobile/lib/design_system/session/orders_port.dart
- mobile/lib/design_system/session/fake_orders_port.dart
- mobile/lib/screens/orders/create_quote_screen.dart
- mobile/test/screens/orders/create_quote_screen_test.dart
- design-system/screens/orders.test.mjs
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (adversarial review workflow) · **Ngày:** 2026-07-17 · **Kết luận: APPROVE — done**

### Phạm vi xác minh

- Git vs File List: **0 lệch** — 16 file source thay đổi khớp đúng File List (2 file `_bmad-output` ngoài phạm vi review theo quy tắc).
- AC-1..AC-3: đối chiếu từng AC với code — **IMPLEMENTED cả 3** (client chỉ echo lines + hiển thị integer backend trả; `previewTotal` service gọi đúng `computeOrderTotals()` — một bộ tính, subtotal qua `lineAmount()`, half-up MỘT điểm tại grand-subtotal; realtime qua funnel mọi mutation → `refresh()` → `refreshTotals()` 2 nền tảng, race-ticket cả 2).
- Task audit: 44/44 task [x] đều có bằng chứng file:line thật — không có tick khống.
- AC-4 lane (chạy lại độc lập, không tin log dev): backend **50 suite/758 test xanh** · design-system **267 xanh** · mobile **analyze sạch + 159 test xanh**.
- Mutation spot-check độc lập (ngoài 3 mutant dev + QA đã ghi): cấy `Math.floor((totals.subtotal * 8 + 50) / 100)` vào màn web → guard h.2 **và** h.3 RED (2 fail) → restore bằng `cp`, diff sạch. Guard chống bộ-tính-thứ-hai hoạt động thật.
- Security: endpoint stateless sau `@RequirePermissions(PERM.quotesCreateEdit)` + bảng fail-closed 401/403 e2e; nested validation chạy thật (e2e chứng minh @Type/@IsInt/@Min/@ArrayMaxSize); không chạm Prisma/EventBus (unit + e2e assert zero interaction). Không injection surface (không query, không string interpolation).

### Findings (0 CRITICAL · 0 HIGH · 1 MEDIUM · 3 LOW)

| # | Mức | Vấn đề | Xử lý |
|---|-----|--------|-------|
| M-1 | MEDIUM | Story không ghi nhận 5 test + 1 guard test QA-phase thêm sau dev (G1–G6, test-summary-story-4-2.md) — Dev Agent Record dừng ở số lane thời điểm dev (754/266/158), lệch repo thực tế (758/267/159) | ✅ Fixed — bổ sung ghi chú QA phase + số lane sau QA vào Completion Notes |
| L-1 | LOW | Comment stale trong `design-system/screens/orders.test.mjs` (e): "totals placeholders — Story 4.2 wires the numbers" — 4.2 đã nối xong, '—' giờ là fallback | ✅ Fixed — sửa comment mô tả đúng bất biến hiện tại |
| L-2 | LOW | Guard h.2 ban rounding theo operator cụ thể (`Math.floor(` web, `~/ 100` dart) — biến thể `Math.trunc`/`.floor()` method lách được | 📄 Documented, chấp nhận — text-guard vốn xấp xỉ (TD-1/C-4); regex money-math (h) + ban `* 8`/`0.08` (h.2) + pin công thức fake (h.3) là nhiều lớp chồng nhau, mutant thực tế đã bị bắt bởi 2 test cùng lúc |
| L-3 | LOW | `PreviewTotalLineDto` không có `@Max` trên unitPrice/qty — giá trị cực đại (~2^53) cho kết quả mất chính xác | 📄 Non-issue theo threat model — story đã cân nhắc rõ (Dev Notes §Thuật-toán: tiền thực tế ≤1e13/dòng × ≤500 dòng); endpoint stateless không ghi gì, khớp convention DTO 4.1 (`@Min` không `@Max`); nếu 4.4 thêm config sẽ xem lại |

### Ghi chú chất lượng nổi bật

- e2e biên `@ArrayMaxSize` test CẢ hai phía (500 ⇒ 200 tính tay, 501 ⇒ 400) — đúng kỷ luật biên-hai-nửa từ retro 4.1.
- Widget test race (`_ManualPreviewPort`, complete ngược thứ tự) chứng minh ticket bằng runtime thật — không phải chỉ đọc code.
- Invariant cũ "GET /orders/:id không có subtotal/total" giữ nguyên — không đổi shape response hiện hữu.

## Change Log

- 2026-07-17: Review adversarial (autonomous) — APPROVE, 0 CRITICAL/HIGH; 1 MEDIUM (story thiếu ghi nhận test QA-phase — đã bổ sung) + 3 LOW (1 fixed comment stale guard, 2 documented/non-issue). Xác minh độc lập: 4 lane xanh (758/267/159 + analyze), 1 mutation spot-check guard RED đúng chỗ. Status: review → done.

- 2026-07-17: Story 4.2 dev hoàn tất — endpoint stateless `POST /orders/preview-total` dùng hàm pricing duy nhất `computeOrderTotals()` (orders/domain, integer half-up một điểm); nối realtime khu tổng 2 màn Tạo báo giá qua `previewTotal` port (race-ticket, lỗi → "—" giữ giỏ); guard money-math mở rộng cấm vat-math trong screen; 4 lane test xanh (backend 754, design-system 266, mobile 158 + analyze); 3 mutation-check RED đúng chỗ. Status: review.

- 2026-07-17: Story được tạo bởi create-story workflow (ultimate context engine) — tổng hợp từ epics.md, ARCHITECTURE-SPINE (AD-16), PRD FR-3, story 4.1 (File List + Review findings), và 2 luồng scout code (backend orders + FE screens/ports/guards @ HEAD 0329dac). Quyết định thiết kế đã chốt: request `{lines}` không mang vatRate (backend resolve `VAT_RATE_MAC_DINH=8`, `applyVat=true` — 4.4 mở rộng chỗ resolve); công thức half-up thuần integer `floor((subtotal*rate+50)/100)`; FE hook tại `refresh()` + race-ticket; lỗi preview → "—" không mất giỏ. Status: ready-for-dev.
