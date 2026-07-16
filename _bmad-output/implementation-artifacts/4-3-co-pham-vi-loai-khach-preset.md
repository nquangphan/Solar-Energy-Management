---
baseline_commit: f8886572054aa0d81a5b4bc8188522de2a7c71dd
---

# Story 4.3: Cờ phạm vi & Loại khách (preset)

Status: done

## Story

As a người có quyền tạo báo giá,
I want chọn Loại khách để nạp preset cờ phạm vi và bật/tắt từng cờ trên Đơn,
so that vòng đời đơn khớp phạm vi thực tế của đơn (FR-2).

## Acceptance Criteria

1. **Preset theo Loại khách (backend, lúc tạo Đơn):** **Given** tạo Đơn cho Khách hàng `custType = CA_NHAN`, **When** `OrdersService.create` ghi Đơn, **Then** cờ được ghi **TƯỜNG MINH** trong payload create: `scopeThietBi=true, scopeThiCong=true, scopeVanChuyen=true`; khách `THUONG_MAI` → `true/false/false` — KHÔNG dựa vào DB default (default hiện tại trùng preset Thương mại chỉ là ngẫu nhiên; test phải chứng minh service tự ghi) (FR-2, §epics 4.3 AC-1).
2. **Toggle độc lập với preset:** **Given** Đơn ở trạng thái `baogia`, **When** gọi `PATCH /orders/:id` với body `{scopeThiCong?, scopeVanChuyen?}` (boolean, partial), **Then** cờ tương ứng đổi độc lập với preset; `custType` KHÔNG đổi (giữ làm nhãn báo cáo); response là `OrderResponseDto` phản ánh cờ mới (FR-2, §epics 4.3 AC-2).
3. **Cờ Thiết bị luôn bật:** **Given** mọi Đơn, **When** đọc/sửa cờ, **Then** `scopeThietBi` luôn `true` — KHÔNG có trong DTO update, UI không có control tắt; chip "Thiết bị" luôn hiển thị trạng thái on (EXPERIENCE.md §Máy trạng thái: "Cờ Thiết bị luôn bật (mọi đơn có vật tư)" — nguồn thắng cho hành vi, override chữ "từng cờ" trong epic AC).
4. **Cửa sổ sửa + guard + audit:** **Given** Đơn KHÔNG ở `baogia`, **When** PATCH cờ, **Then** 409 (cùng ngữ nghĩa `assertMutable` như line-items — cờ gate máy trạng thái Epic 5, không đổi giữa vòng đời); thiếu quyền `quotes.create_edit` → 403; đổi cờ thành công publish domain event qua EventBus (audit ghi before→after) — KHÔNG gọi audit trực tiếp (AD-18, AD-7).
5. **Hiển thị & toggle trên hai nền tảng (parity):** **Given** Đơn đã tạo (bước 2 màn Tạo báo giá), **When** render, **Then** cả web + mobile hiển thị 3 chip scope-flag ("Thiết bị"/"Thi công"/"Vận chuyển") đúng trạng thái on/off (on = teal, off = gạch ngang mờ) + control bật/tắt cho Thi công/Vận chuyển; toggle lỗi (port throw) hiển thị Banner lỗi và KHÔNG mất giỏ hàng; nhãn tiếng Việt byte-identical web↔mobile (UX-DR-7, UX-DR-27, §epics 4.3 AC-3: cờ trên `Order` là nguồn cho gate state machine Epic 5).

## Tasks / Subtasks

- [x] Task 1: Backend — domain preset thuần (AC: #1, #3)
  - [x] Tạo `backend/src/orders/domain/scope-preset.ts`: hàm thuần `scopePresetFor(custType: CustType): { scopeThietBi: true; scopeThiCong: boolean; scopeVanChuyen: boolean }` — `CA_NHAN` → cả 3 true; `THUONG_MAI` → `true/false/false`. Import `CustType`/`CUST_TYPE` từ `customers/domain/customer-type.ts` (không tạo registry trùng). Thuần TS, không Nest/Prisma (pattern như `order-totals.ts`).
  - [x] Unit test thuần `backend/test/scope-preset.spec.ts`: 2 preset + exhaustive trên `CUST_TYPES`.
- [x] Task 2: Backend — áp preset lúc tạo Đơn (AC: #1)
  - [x] `orders.service.ts` `create()` (~L208): sau khi đọc Customer, spread `...scopePresetFor(customer.custType)` vào `data` của op tạo Order trong `$transaction` (cạnh chỗ snapshot `sourceId`/`custType` ~L224–242).
  - [x] Mở rộng `orderSnapshot()` (~L101–112) thêm 3 cờ scope (event/audit cần before→after — hiện đang thiếu).
  - [x] Test `orders.service.spec.ts`: create với customer `CA_NHAN` → assert **payload** `data` chứa cả 3 cờ true; `THUONG_MAI` → true/false/false (assert payload, không đếm call — kỷ luật 4.1).
- [x] Task 3: Backend — endpoint PATCH /orders/:id (AC: #2, #3, #4)
  - [x] DTO `backend/src/orders/dto/update-order-request.dto.ts`: partial viết tay (CẤM `PartialType` — nó tự thêm `@IsOptional` không gỡ được, xem doc trong `update-line-item-request.dto.ts`): `scopeThiCong?` + `scopeVanChuyen?` đều `@IsOptionalNotNull @IsBoolean` (import từ `../../catalog/dto/is-optional-not-null.decorator`). KHÔNG có `scopeThietBi` (AC #3). KHÔNG thêm field 4.4 (kWp/vatMode) — YAGNI, 4.4 tự mở rộng.
  - [x] Event mới trong `domain/order-events.ts`: `OrderScopeChanged` (theo shape các event hiện có, mang `before`/`after` snapshot) — publish SAU khi `$transaction` commit (pattern 4.1).
  - [x] `orders.service.ts`: method `updateScopeFlags(actorAccountId, orderId, dto, tieredPricingEnabled)`: `findOrThrow` → `assertMutable` (409 ngoài `baogia`) → nếu dto rỗng (không field nào) trả view hiện tại không ghi/không event → update → publish `OrderScopeChanged` → trả `OrderView`. LƯU Ý: nhận `tieredPricingEnabled: boolean` như `get()`/`addLine()` vì `toViews` re-resolve giá live cho dòng catalog — controller truyền `FeatureFlagsService.isEnabled(FLAG.catalogTieredPricing)` theo mẫu GET `/orders/:id`.
  - [x] `orders.controller.ts`: `@Patch(':id')` + `@RequirePermissions(PERM.quotesCreateEdit)` + `@CurrentAccount()` + đủ bộ Swagger decorator (`@ApiOkResponse` OrderResponseDto, `@ApiNotFoundResponse`/`@ApiConflictResponse`/`@ApiBadRequestResponse` với `ErrorEnvelopeDto` — theo mẫu các handler hiện có). Đặt SAU route tĩnh `preview-total`. Controller KHÔNG nặn envelope (AD-5).
  - [x] Regen OpenAPI: `cd backend && npm run openapi:gen` (drift spec `test/openapi-drift.spec.ts` sẽ fail nếu quên).
  - [x] Test service: happy path (assert payload `where`+`data`), 404, 409 khi `status !== 'baogia'`, event mang before→after đúng, body rỗng → không ghi. Test e2e (`orders.e2e.spec.ts`): 403 thiếu quyền, 400 + `fieldErrors` khi `scopeThiCong: "yes"`, happy 200 (hermetic mock Prisma, pattern hiện có).
- [x] Task 4: FE ports — method mới + fake preset (AC: #2, #5)
  - [x] `web/src/design-system/session/orders-port.ts`: thêm `updateScopeFlags(orderId: string, input: UpdateScopeFlagsInput): Promise<Order>` (`UpdateScopeFlagsInput = { scopeThiCong?: boolean; scopeVanChuyen?: boolean }`). Twin `mobile/lib/design_system/session/orders_port.dart` giữ đồng bộ (session parity guard so khớp).
  - [x] Fake ports (`fake-orders-port.ts` / `fake_orders_port.dart`): (a) `create` áp preset theo `custType` của customer fake (thay hardcode `true/false/false` hiện tại — fake là "backend surrogate", logic được phép); (b) `updateScopeFlags` đổi state + trả Order mới; twin logic hai bên.
- [x] Task 5: Web — UI cờ phạm vi trong CreateQuoteScreen (AC: #5)
  - [x] `web/src/screens/orders/CreateQuoteScreen.tsx`: sau khi `order` tồn tại, render hàng "Phạm vi" trong `Card.quote-customer` (cạnh `CustomerTypeChip` ~L279): 3 `ScopeFlag` chip (`on={order.scopeThietBi}` v.v., nhãn "Thiết bị"/"Thi công"/"Vận chuyển") + 2 `Checkbox` design-system (component 4.1 đã tạo, a11y đã qua) toggle Thi công/Vận chuyển → gọi `ordersPort.updateScopeFlags` → `setOrder(kết quả)`. KHÔNG thêm handler/prop mới vào `ScopeFlag.tsx` (guard `chip-components.test.mjs` cấm mọi `on[A-Z]*=`, chip phải là `<span>` tĩnh). KHÔNG bare `<button>`/`<input>` (guard b). Toggle KHÔNG gọi preview-total (cờ không ảnh hưởng tiền).
  - [x] Lỗi toggle: catch → `setError(...)` hiển thị Banner, giữ nguyên giỏ + state cờ cũ (pattern k của 4.1).
  - [x] CSS nếu cần vào `web/src/screens/orders/orders.css` — 0 shadow/gradient, radius từ token (guard f).
- [x] Task 6: Mobile — UI tương đương + widget test (AC: #5)
  - [x] `mobile/lib/screens/orders/create_quote_screen.dart`: hàng "Phạm vi" cạnh `AppCustomerTypeChip` (~L558): 3 `AppScopeFlag` + 2 `AppCheckbox` toggle → `ordersPort.updateScopeFlags` → `setState` order mới; lỗi → Banner, không mất giỏ. Không thêm gesture vào `chip.dart` (parity guard cấm `GestureDetector|InkWell|…` trong file chip).
  - [x] Widget test `mobile/test/screens/orders/create_quote_screen_test.dart` (BẮT BUỘC — C-4): (a) khách CA_NHAN → 3 chip on; (b) khách THUONG_MAI → chỉ Thiết bị on; (c) tap Checkbox Thi công → chip đổi on, fake nhận đúng input; (d) port throw (`OrderPortException` qua fake subclass, pattern `_RejectingPreviewPort`) → Banner + dòng giỏ còn nguyên. `dart format -o none --set-exit-if-changed` chỉ trên file đã sửa.
- [x] Task 7: Text-guards design-system (AC: #5)
  - [x] `design-system/screens/orders.test.mjs`: (b) thêm `ScopeFlag`/`Checkbox` vào allowlist import nếu chưa có; (c.2) thêm `updateScopeFlags` vào danh sách port-method màn phải gọi; (e) thêm nhãn byte-identical "Thiết bị", "Thi công", "Vận chuyển" (+ nhãn hàng "Phạm vi" nếu dùng); thêm negative assert: cấm handler trên ScopeFlag trong screens (vd regex `<ScopeFlag[^>]*on[A-Z]`), cấm gọi `previewTotal` trong nhánh toggle nếu viết được assert sạch — mỗi negative assert mới PHẢI mutation-check (bẻ code thật, thấy RED) trước khi nhận.
  - [x] `design-system/session/parity.test.mjs`: cặp port orders web↔dart đã đăng ký từ 4.1 — chạy lại xác nhận twin mới đồng bộ.
  - [x] Chạy `cd design-system && npm test` (drift + source-guard + parity).
- [x] Task 8: Chạy toàn bộ lane + cập nhật story (AC: tất cả)
  - [x] `cd backend && npm test` (unit + e2e + 7 source-guard + drift openapi/permissions).
  - [x] `cd mobile && flutter test && flutter analyze`.
  - [x] `cd design-system && npm test`.
  - [x] Không cần lane DB (`test:db`): KHÔNG có migration mới, không ràng buộc DB mới.

## Dev Notes

### Quyết định spec đã chốt (đọc trước khi code)

- **"Thiết bị luôn bật":** epic AC-2 viết "bật/tắt từng cờ" nhưng EXPERIENCE.md (nguồn thắng cho hành vi UI) quy định "Cờ Thiết bị luôn bật (mọi đơn có vật tư)". Chốt: chỉ Thi công/Vận chuyển toggle được; `scopeThietBi` bất biến `true`, không vào DTO update. [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md#Máy-trạng-thái]
- **Preset Thương mại:** PRD FR-2 "chỉ bật Thiết bị (Vận chuyển tuỳ chọn), Thi công tắt" → preset `true/false/false`, Vận chuyển bật tay sau nếu cần. [Source: prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-2]
- **Preset áp lúc nào:** `custType` snapshot từ Customer lúc tạo Đơn (4.1 đã làm); preset đi cùng — KHÔNG có flow đổi Loại khách trên Đơn đã tạo (không endpoint đổi customer/custType; YAGNI). Chọn Loại khách xảy ra ở CustomerPickScreen/tạo khách inline (Epic 3, đã có).
- **Cửa sổ sửa cờ = `baogia`:** cờ là nguồn gate máy trạng thái Epic 5 (AD-7); đổi cờ giữa vòng đời làm stepper/transition đổi hình dạng giữa chừng. Dùng đúng `assertMutable` hiện có (409 như line-items).
- **Không migration:** 3 cột scope + `cust_type` đã tồn tại từ migration `20260716000000_add_orders` (tạo sẵn theo ERD, story ghi rõ "hành vi 4.3"). Schema KHÔNG đổi. DB default `true/false/false` giữ nguyên — service ghi tường minh nên default không còn mang ngữ nghĩa preset.
- **Cờ không ảnh hưởng tiền:** toggle KHÔNG gọi preview-total, không đụng `computeOrderTotals` (AD-16 nguyên vẹn). Không cần race-ticket cho toggle (không có response đua với nhau về tiền); nếu vẫn lo stale khi tap nhanh, dùng lại pattern ticket `useRef`/`_latestTotals` của 4.2 — nhưng đơn giản nhất là disable control trong lúc chờ.

### Hiện trạng code (đã scout, tin được)

**Backend (`backend/src/orders/`):**
- `orders.service.ts`: deps đúng 2 — `PrismaService` + `EventBus`; `create(actorAccountId, dto)` ~L208 dùng `$transaction` mảng 3 op (order → version 1 → repoint `currentVersionId`), snapshot `sourceId`/`custType` từ Customer ~L224–242, publish `OrderCreated` SAU commit; `assertMutable` = 409 trừ khi `status === TRANG_THAI_BAO_GIA`; `orderSnapshot()` ~L101–112 hiện có `custType` nhưng THIẾU 3 cờ scope (Task 2 bổ sung).
- `orders.controller.ts`: mọi handler gate `@RequirePermissions(PERM.quotesCreateEdit)`; route tĩnh `preview-total` (L94) khai báo TRƯỚC `:id`; routes hiện có: POST `/orders` (L67), POST `/orders/preview-total` (L94), GET `/orders/:id` (L116), POST/PATCH/DELETE line-items (L138/176/215). CHƯA có PATCH `/orders/:id`.
- DTO pattern: `UpdateLineItemRequestDto` là mẫu partial viết tay + `IsOptionalNotNull` (từ `catalog/dto/is-optional-not-null.decorator`); `CreateOrderRequestDto` chỉ có `customerSdt`.
- `OrderResponseDto` ĐÃ expose `scopeThietBi/scopeThiCong/scopeVanChuyen` (khai sẵn từ 4.1) — không cần sửa response DTO.
- Domain: file thuần TS registry/function (`order-totals.ts`, `order-status.ts`, `order-events.ts`); `CUST_TYPE = { caNhan: 'CA_NHAN', thuongMai: 'THUONG_MAI' }` ở `backend/src/customers/domain/customer-type.ts` — dùng lại, CẤM tạo literal mới.
- Permission: `PERM.quotesCreateEdit = 'quotes.create_edit'` (`backend/src/accounts/domain/permission-registry.ts` L35) — guard test cấm literal ngoài registry + cấm handler thiếu `@RequirePermissions`.
- Prisma model `Order` (schema.prisma L316–343): `scopeThietBi @default(true)`, `scopeThiCong @default(false)`, `scopeVanChuyen @default(false)`, `custType String @map("cust_type")`.

**FE web:**
- `web/src/screens/orders/CreateQuoteScreen.tsx` (520 dòng): props `{ordersPort, catalogPort, customersPort, onDone?}`; step 1 = `CustomerPickScreen` toàn màn → `ordersPort.create({customerSdt})`; `CustomerTypeChip` render ở ~L279 trong `Card.quote-customer`; state `order/customer/totals/error/fieldErrors/picker`; refresh totals qua ticket `useRef` (~L85, L124–132). CHƯA có UI scope nào.
- `web/src/design-system/session/orders-port.ts`: `Order` type ĐÃ có `custType` + 3 cờ (L38–55); methods hiện có `create/get/addLine/updateLine/removeLine/previewTotal` (L127–152). Fake hardcode cờ `true/false/false` (`fake-orders-port.ts:48–50`).
- `web/src/design-system/components/ScopeFlag.tsx` (L17–20): span tĩnh, class `scope-flag on|off`; doc ghi rõ "display flag, NOT a toggle — screen owns the on/off decision". CSS đã đủ (`components.css` L65–67: on = teal, off = line + gạch ngang). `Checkbox.tsx` design-system có sẵn từ 4.1.
- Web KHÔNG có tsc/bundler/JSDOM — text-guard là lớp bảo vệ duy nhất cho `.tsx`; đừng cố chạy tsc.

**FE mobile:**
- `mobile/lib/screens/orders/create_quote_screen.dart` (701 dòng): StatefulWidget + ports qua constructor (KHÔNG BLoC — convention toàn dự án dù brief nói BLoC); `AppCustomerTypeChip` ở ~L558; `orders_port.dart` `Order` có đủ `custType` + 3 cờ (L78–81, required). `AppScopeFlag` có sẵn (`chip.dart` L110–143), `AppCheckbox` có sẵn từ 4.1. Fake dart hardcode cờ (`fake_orders_port.dart:36–38`).
- Mobile không có app runtime (`main.dart` chưa tồn tại) — mọi transport qua port tiêm + fake trong test.

**Guards (chạm tới khi thêm UI/port):**
- `design-system/screens/orders.test.mjs`: (b) allowlist import component; (c.2) màn phải gọi đủ mọi port method (thêm `updateScopeFlags` vào list); (e) nhãn Việt byte-identical web↔mobile (hiện 21 nhãn); (h/h.2/h.3) cấm mọi số học tiền trong screens; (k) failure không mất giỏ.
- `design-system/components/chip-components.test.mjs` + `parity.test.mjs`: chip read-only — cấm handler/`<button>`/gesture trong 3 file chip (web) và `chip.dart`/`status_chip.dart` (mobile). KHÔNG sửa các file chip.
- `design-system/session/parity.test.mjs`: twin port web↔dart phải đồng bộ.
- Guard quét file như text: TRÁNH viết chuỗi bị cấm (`shadow`, `gradient`, `* 8`, `Math.floor(`, `reduce(`…) kể cả trong comment.

### Bài học từ story trước (4.1, 4.2)

- Assert **payload ghi DB** (`data`/`where`), không đếm số lần gọi mock.
- Mọi negative assert guard mới phải **mutation-check**: bẻ code thật cho vi phạm xảy ra, thấy guard RED, rồi revert — guard chỉ chứng minh được điều tác giả tưởng tượng nếu không kiểm.
- Widget test mobile BẮT BUỘC cho mọi thay đổi màn (C-4), gồm cả error case (không chỉ happy path).
- Lỗi thao tác ở màn Tạo báo giá phải hiển thị Banner và KHÔNG được wipe giỏ hàng (finding High đã fix ở 4.1 — đừng tái phạm ở nhánh toggle).
- Event publish SAU `$transaction` commit; audit đi qua AuditSubscriber, không gọi trực tiếp.
- Nested DTO array cần `@Type()` mới validate (4.2) — DTO 4.3 phẳng nên không dính, nhưng nhớ nếu mở rộng.
- `dart format` mặc định GHI đè file hàng loạt — luôn `dart format -o none --set-exit-if-changed <file đã sửa>`.
- Backend lane từng flake ở `customer-sources.e2e` — nếu đỏ không liên quan, rerun trước khi nghi code mình.
- OpenAPI + permissions là artifact sinh — đổi DTO/route xong PHẢI `npm run openapi:gen`, drift-guard so byte.

### Web research

Không có thư viện/API mới — story chỉ dùng stack đã pin trong project-context (NestJS 11.1.27, Prisma 7.8.0, React 19.2.7, Flutter 3.44). Không cần cập nhật version nào.

### Project Structure Notes

- File MỚI: `backend/src/orders/domain/scope-preset.ts`, `backend/src/orders/dto/update-order-request.dto.ts`, `backend/test/scope-preset.spec.ts`.
- File SỬA: `backend/src/orders/{orders.service.ts, orders.controller.ts, domain/order-events.ts}`, `backend/openapi/openapi.json` (regen), `backend/test/{orders.service.spec.ts, orders.e2e.spec.ts}`, `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts}`, `web/src/screens/orders/CreateQuoteScreen.tsx` (+`orders.css` nếu cần), `mobile/lib/design_system/session/{orders_port.dart, fake_orders_port.dart}`, `mobile/lib/screens/orders/create_quote_screen.dart`, `mobile/test/screens/orders/create_quote_screen_test.dart`, `design-system/screens/orders.test.mjs`.
- KHÔNG đụng: `prisma/schema.prisma`, migrations, các file chip design-system, `order-totals.ts`/`line-amount.ts`, permission registry.
- Naming: file kebab-case (TS) / snake_case (Dart); route PATCH `/orders/:id` theo REST hiện có.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.3] — 3 AC gốc
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-2] — preset chi tiết + "Vận chuyển tuỳ chọn"
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md#Máy-trạng-thái-Đơn] — Thiết bị luôn bật; Flow 1 bước 2 (chọn Loại khách khi tạo khách inline)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/DESIGN.md#Chip] — `.scope-flag` on/off, `.ktype`
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-7] — cờ gate vòng đời; #AD-6 currentVersionId; ERD Order có 3 cờ + custType
- [Source: _bmad-output/implementation-artifacts/4-1-tao-don-dung-gio-hang-order-orderversion-orderlineitem.md] — pattern service/guards/ports/màn
- [Source: _bmad-output/implementation-artifacts/4-2-xem-truoc-tong-realtime-qua-post-orders-preview-total.md] — ticket pattern, kỷ luật test

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) — Claude Code CLI

### Debug Log References

- `resolve_customization.py` fail (Python < 3.11, đã biết) → merge workflow block tay: không override nào trong `_bmad/custom/`, dùng defaults.
- RED-GREEN đúng chu trình: `scope-preset.spec.ts` RED (module chưa tồn tại) → GREEN; asserts payload 3 cờ trong `orders.service.spec.ts` RED (2 test) → GREEN; suite RED vì `OrderScopeChanged` chưa tồn tại → GREEN sau khi thêm event + service + controller.
- Widget test (d) fail lần đầu: tap Checkbox bị miss vì viewport đã cuộn tới nút picker — fix bằng `ensureVisible` trước tap (bài học: `_tap` helper đã làm vậy cho AppButton).
- `dart format` cascade tránh được: chỉ format file đã sửa, verify bằng `-o none --set-exit-if-changed`.
- Mutation-check 6 mutation cho khối negative assert mới (l): (1) handler prop trên `<ScopeFlag>` web, (2) callback `onTap` trên `AppScopeFlag` mobile, (3) Checkbox "Thiết bị" web, (4) AppCheckbox "Thiết bị" mobile, (5) `refreshTotals` trong `handleScopeToggle` web, (6) `_refreshTotals` trong `_toggleScope` mobile — cả 6 đều RED, revert bằng cp backup (không git checkout), diff xác nhận restore nguyên vẹn.

### Completion Notes List

- **AC-1:** `scopePresetFor()` (domain thuần, registry `PRESET_BY_CUST_TYPE` khoá theo `CUST_TYPE` — thêm loại khách mới thiếu preset là lỗi typecheck) + `create()` spread preset TƯỜNG MINH vào payload `data`. Test assert TOÀN BỘ payload (CA_NHAN cả 3 true; THUONG_MAI true/false/false) — chứng minh service tự ghi, không dựa DB default.
- **AC-2:** `PATCH /orders/:id` + `UpdateOrderRequestDto` (partial viết tay, `@IsOptionalNotNull @IsBoolean`); `updateScopeFlags()` chỉ ghi field client gửi (field vắng = `undefined` → Prisma bỏ qua); `custType` không đổi; response `OrderResponseDto` đầy đủ (re-resolve giá live qua `toViews` + cờ tiered).
- **AC-3:** `scopeThietBi` KHÔNG có trong DTO (whitelist strip im lặng nếu client gửi), không Checkbox tắt trên cả 2 nền tảng; guard (l) khoá bằng deepEqual đúng 2 toggle. Type domain `scopeThietBi: true` (literal).
- **AC-4:** ngoài `baogia` → 409 qua đúng `assertMutable` hiện có; 403 khi thiếu `quotes.create_edit` (e2e); `OrderScopeChanged` mang before→after snapshot (orderSnapshot mở rộng 3 cờ) publish SAU khi ghi, audit đi qua AuditSubscriber (e2e assert `auditLog.create` với eventType). Body rỗng → trả view, không ghi/không event.
- **AC-5:** hai nền tảng render hàng "Phạm vi" trong card khách: 3 chip scope-flag (tĩnh, on=teal / off=gạch ngang theo CSS/token có sẵn) + 2 Checkbox toggle; nhãn byte-identical (guard e); toggle lỗi → Banner + giỏ nguyên vẹn + cờ giữ state cũ (widget test d); toggle KHÔNG gọi preview-total (guard l, mutation-checked); disable control khi đang chờ response (`scopeBusy`) — chống double-tap thay cho ticket.
- Fake ports twin: `create` áp preset theo custType của demo customer (tra digits-endsWith như fake-customers), `updateScopeFlags` đổi state trả Order mới.
- **QA automation phase (sau dev):** thêm 3 test boundary — (1) e2e `{scopeThietBi: false}` bị whitelist strip im lặng ⇒ 200 không ghi/không audit (mutation-checked: mở đường ghi thật → RED); (2) e2e smuggle `custType` kèm cờ hợp lệ ⇒ payload ghi chỉ 2 cờ, `custType` giữ nguyên; (3) service both-flags trong một PATCH. Chi tiết: `_bmad-output/implementation-artifacts/tests/test-summary-story-4-3.md`.
- Lanes (sau QA phase): backend 51 suites/776 tests ✅ · mobile 163 tests + analyze sạch ✅ · design-system 268 tests ✅. Không lane DB (không migration).

### File List

**Mới:**
- backend/src/orders/domain/scope-preset.ts
- backend/src/orders/dto/update-order-request.dto.ts
- backend/test/scope-preset.spec.ts

**Sửa:**
- backend/src/orders/orders.service.ts
- backend/src/orders/orders.controller.ts
- backend/src/orders/domain/order-events.ts
- backend/openapi/openapi.json (regen `npm run openapi:gen`)
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

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-17 · **Kết luận: APPROVE — done**

Review adversarial: đối chứng 5 AC với code thật, audit 8 task (33 subtask) đều có bằng chứng file:line, git khớp File List 100%, tự re-run 3 lane test độc lập, tự mutation-check guard (l) một nhánh.

**Xác minh độc lập:**
- 3 lane re-run: backend 51 suites/776 tests ✅ · design-system 268 ✅ · mobile 163 + `flutter analyze` sạch ✅.
- OpenAPI regen đúng: `/orders/{id}` có `patch` đủ 200/400/403/404/409; `UpdateOrderRequestDto` đúng 2 props.
- Mutation spot-check guard (l): bẻ `handleScopeToggle` gọi `refreshTotals` → guard RED đúng assert → restore nguyên vẹn (không chỉ tin Debug Log).
- Warning tap-miss trong flutter test xác minh bằng worktree baseline `f888657`: đã tồn tại từ 4.1, KHÔNG phải regression 4.3.

**Findings (0 Critical · 0 High · 1 Medium · 3 Low):**
1. **[MEDIUM — ĐÃ FIX]** Dev Agent Record stale sau QA phase: ghi "773 tests" trong khi QA automation thêm 3 test (thực tế 776), QA phase không được ghi nhận — tái phạm đúng finding MEDIUM của review 4.2. Fix: bổ sung ghi chú QA phase + link test-summary + sửa số lane.
2. **[LOW — pre-existing, ngoài scope]** Test 4.1 "dòng tự do" (`mobile/test/screens/orders/create_quote_screen_test.dart:334`): tap `Thêm dòng` hụt hit-test (warning `warnIfMissed`), assert `find.text(...)` có thể pass vacuous vì text nằm trong TextField. Có từ baseline — action item cho story sau, không sửa trong 4.3 (surgical changes).
3. **[LOW — chấp nhận]** PATCH gửi giá trị trùng hiện tại vẫn ghi + publish `OrderScopeChanged` before==after. FR-20 audit mọi mutation client yêu cầu; UI không tạo được case này; so-sánh-giá-trị là phức tạp không cần (YAGNI).
4. **[LOW — non-issue theo threat model]** `before` snapshot đọc ngoài transaction trong `updateScopeFlags` — PATCH đồng thời có thể ghi audit `before` stale. Cùng shape `updateLine` hiện có, write 1 cột atomic, cửa sổ sửa `baogia` đơn người dùng.

**Điểm chất lượng nổi bật:** e2e smuggle `custType` chứng minh strip bằng `toHaveBeenCalledWith` khớp toàn object (không thể pass nếu field lọt); type literal `scopeThietBi: true` biến vi phạm bất biến thành lỗi typecheck; test thứ tự `['write','publish']` chứng minh event sau commit.

## Change Log

- 2026-07-17: Story 4.3 implement trọn 8 task — preset cờ phạm vi theo Loại khách (ghi tường minh lúc tạo Đơn), endpoint PATCH /orders/:id toggle Thi công/Vận chuyển (cửa sổ baogia, event OrderScopeChanged before→after), UI chip + toggle 2 nền tảng parity, 4 widget test mobile mới, guard (l) mới mutation-checked 6 nhánh. 3 lane test GREEN. Status → review.
- 2026-07-17: Senior Developer Review (AI) — APPROVE. 1 Medium (Dev Agent Record thiếu QA phase — đã fix), 3 Low (documented). 3 lane re-run xanh độc lập, mutation spot-check guard (l) RED đúng chỗ. Status → done.
