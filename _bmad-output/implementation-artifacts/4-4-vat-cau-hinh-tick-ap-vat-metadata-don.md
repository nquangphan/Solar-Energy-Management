---
baseline_commit: 639bd16e314b91ce8909a1294c7c9405cc101f83
---

# Story 4.4: VAT cấu hình + tick áp VAT + metadata Đơn

Status: done

## Story

As a người có quyền tạo báo giá,
I want cấu hình thuế suất VAT, tick áp/không áp VAT trên Đơn, và nhập công suất kWp + hạn hiệu lực báo giá,
so that báo giá thể hiện đúng thuế và thông tin đơn (FR-3, FR-4).

## Acceptance Criteria

1. **Thuế suất VAT cấu hình hệ thống (FR-3):** **Given** hệ thống CHƯA từng cấu hình, **When** backend resolve thuế suất, **Then** giá trị hiệu lực = 8 (%) — mặc định từ registry, KHÔNG cần seed row. **When** `PATCH /settings/vat-rate` body `{ratePercent: 10}` bởi người có `settings.manage`, **Then** upsert bảng `system_settings`, `GET /settings/vat-rate` trả `{ratePercent: 10}`, publish domain event (audit before→after qua AuditSubscriber); `ratePercent` phải Int 0..100 (400 + `fieldErrors` nếu sai); thiếu quyền → 403 (cả GET lẫn PATCH — chỉ màn cấu hình dùng, sale nhận rate qua preview response).
2. **Tick áp VAT trên Đơn (FR-3):** **Given** tạo Đơn mới, **When** `OrdersService.create` ghi, **Then** `vatMode` ghi TƯỜNG MINH `'co_vat'` trong payload create — KHÔNG dựa DB default/null (kỷ luật 4.3: test assert payload). **Given** Đơn ở `baogia`, **When** `PATCH /orders/:id` với `{vatMode: 'khong_vat'}`, **Then** đổi tick + publish event audit before→after; `vatMode` ngoài registry → 400; Đơn ngoài `baogia` → 409 (cùng `assertMutable` — 4.5 snapshot `vatRate`/`vatMode` lúc Chốt, đổi tick sau chốt là đổi tiền đã đóng băng).
3. **Tính tiền theo tick + thuế suất cấu hình (AD-16, FR-3):** **Given** `POST /orders/preview-total` với `vatMode: 'khong_vat'`, **Then** `vatAmount = 0`, `total = subtotal`. **Given** `vatMode: 'co_vat'` (hoặc vắng field — đơn cũ `vatMode` null coi như có VAT), **Then** `vatAmount = round-half-up(subtotal × rate)` tại GRAND-SUBTOTAL, MỘT điểm làm tròn (hàm `computeOrderTotals` hiện có — KHÔNG bộ tính thứ hai); `rate` đọc từ config server-side, resolve MỘT lần mỗi request — client KHÔNG BAO GIỜ gửi rate. Response trả thêm `vatRate` + `applyVat` để client hiển thị nhãn thuế suất (client CẤM số học tiền, chỉ echo `vatMode` như đã echo `unitPrice`).
4. **Metadata Đơn (FR-4):** **Given** Đơn ở `baogia`, **When** `PATCH /orders/:id` với `{kWp: 8.82, validityNote: "48h kể từ ngày lên PO"}`, **Then** lưu trên `Order` và trả về trong `OrderResponseDto`; `kWp` là số > 0, tối đa 2 chữ số lẻ (400 nếu sai — mockup hiển thị "8,82 kWp"); `validityNote` chuỗi ≤ 200 ký tự; gửi `null` xoá giá trị; Phase 1 CHỈ hiển thị — KHÔNG auto khoá/nhắc hết hạn (nhắc là noti #11, Epic 9).
5. **UI hai nền tảng (parity, UX-DR-24):** **Given** màn Tạo báo giá bước 2, **Then** khối Tổng kết có Checkbox "Tính VAT" phản ánh `order.vatMode` + hiển thị thuế suất `%` từ `totals.vatRate` (giá trị backend, không nhãn tĩnh); tick/untick → `updateOrderMeta` (PATCH) → refresh preview (echo `vatMode` mới) → 3 số tổng đổi tức thì (EXPERIENCE.md §Realtime); card khách có 2 input "Công suất (kWp)" + "Hiệu lực báo giá" commit-on-blur → PATCH; mọi lỗi port → Banner + giỏ hàng + state cũ NGUYÊN VẸN (pattern k); nhãn tĩnh mới byte-identical web↔mobile.
6. **Màn Cấu hình web (FR-3, mockup §s-source-config):** **Given** người có `settings.manage` mở màn Cấu hình nguồn khách, **Then** có mục "Thuế suất VAT" đọc giá trị hiện hành + input sửa + nút Lưu (PATCH); lỗi → Banner. Web-only như màn nguồn khách hiện tại (mobile không có màn cấu hình).

## Tasks / Subtasks

- [x] Task 1: Migration + schema (AC: #1, #4)
  - [x] `schema.prisma`: (a) model mới `SystemSetting { key String @id, value String, updatedAt DateTime @updatedAt @map("updated_at") } @@map("system_settings")`; (b) `Order.kWp Int?` → `Float?` (GIỮ `@map("k_wp")` — xem quyết định kWp trong Dev Notes); (c) `Order.validityNote String? @map("validity_note")`.
  - [x] Sinh migration OFFLINE theo đúng cách các migration trước (`prisma migrate diff --script`); ⚠️ Prisma 7 đổi tên cờ: chỉ nhận `--from-schema`/`--to-schema`, KHÔNG còn `--from-schema-datamodel`. `k_wp` Int→double precision an toàn: cột chưa từng được ghi (4.1 tạo sẵn, không hành vi).
  - [x] `npx prisma generate`.
  - [x] DB lane (có migration MỚI): thêm case vào `*.db.integration.spec.ts` (theo khuôn `orders.db.integration.spec.ts`) — migrate deploy sạch trên DB rỗng + upsert `system_settings` idempotent; chạy `npm run test:db` nếu có DATABASE_URL, ghi rõ nếu không chạy được.
- [x] Task 2: Backend module `settings` mới (AC: #1)
  - [x] `backend/src/settings/domain/setting-registry.ts` (domain thuần, mirror `feature-flag-registry.ts`): `SETTING = { vatRatePercent: 'vat.rate_percent' } as const` + type `SettingKey` + `SETTING_DEFAULTS = { [SETTING.vatRatePercent]: '8' }` — nơi DUY NHẤT chứa literal key; value bảng là String, parse ở service.
  - [x] `backend/src/settings/domain/setting-events.ts`: `SystemSettingChanged` (before/after `{key, value}`, `target.id` = key — mirror `FeatureFlagToggled`).
  - [x] `settings.service.ts` — đúng 2 dep Prisma + EventBus: `vatRatePercent(): Promise<number>` (row vắng → default 8; `Number(value)`); `updateVatRate(actorAccountId, ratePercent): Promise<number>` (upsert → publish event SAU write → trả giá trị mới).
  - [x] `settings.controller.ts`: `GET /settings/vat-rate` + `PATCH /settings/vat-rate` — CẢ HAI `@RequirePermissions(PERM.settingsManage)` (import từ registry, cấm literal); đủ bộ Swagger decorator theo mẫu `feature-flags.controller.ts`; DTO `vat-rate-response.dto.ts` `{ratePercent: number}` + `update-vat-rate-request.dto.ts` `{ratePercent}` `@IsInt @Min(0) @Max(100)`.
  - [x] `settings.module.ts` (export `SettingsService`) + đăng ký `app.module.ts`; orders.module import SettingsModule.
  - [x] Test: `settings.service.spec.ts` (vắng row → 8; upsert assert payload `where`+`create`+`update`; event before→after; thứ tự write→publish) + e2e trong lane hiện có (403 thiếu quyền, 400 ratePercent 8.5/-1/101, happy GET+PATCH hermetic mock Prisma).
- [x] Task 3: Backend orders domain — registry vatMode + create + snapshot (AC: #2)
  - [x] `backend/src/orders/domain/vat-mode.ts` (domain thuần): `VAT_MODE = { coVat: 'co_vat', khongVat: 'khong_vat' } as const` + `VAT_MODES` + type `VatMode` + `vatApplies(mode: string | null): boolean` (null hoặc `co_vat` → true — đơn tạo trước 4.4 có vatMode null phải tính như có VAT, khớp hành vi preview hiện tại).
  - [x] `orders.service.ts` `create()`: thêm `vatMode: VAT_MODE.coVat` TƯỜNG MINH vào `data` (cạnh `...scopePresetFor(...)` ~L245).
  - [x] `orderSnapshot()` (~L105–119) mở rộng: `vatMode`, `kWp`, `validityNote` (event/audit cần before→after).
  - [x] `orders.service.spec.ts`: create → assert payload `data` chứa `vatMode: 'co_vat'`; unit `vat-mode` exhaustive trên `VAT_MODES` (theo khuôn `scope-preset.spec.ts`). `order-totals.spec.ts` ĐÃ phủ applyVat=false + rate ≠ 8 + half-up boundary — KHÔNG viết lại.
- [x] Task 4: Backend PATCH mở rộng + preview resolve config (AC: #2, #3, #4)
  - [x] `UpdateOrderRequestDto` (file có sẵn, doc đã hứa "4.4 tự mở rộng"): thêm `vatMode?` (`@IsOptionalNotNull @IsIn(VAT_MODES)`); `kWp?: number | null` (`@IsNumber({maxDecimalPlaces: 2})` + `@Min(0.01)`, null được phép để XOÁ — xem cách `UpdateLineItemRequestDto.note` xử lý nullable, KHÔNG dùng `IsOptionalNotNull` cho 2 field xoá-được); `validityNote?: string | null` (`@IsString @MaxLength(200)`, null xoá). VẪN KHÔNG có `scopeThietBi`. CẤM `PartialType`.
  - [x] `domain/order-events.ts`: event mới `OrderMetaChanged` (before/after `OrderSnapshot` — shape như `OrderScopeChanged`).
  - [x] `orders.service.ts`: đổi tên `updateScopeFlags` → `update()` (tên cũ giờ nói dối — controller/test đổi theo, backend có tsc): `findOrThrow` → `assertMutable` → dto rỗng (không field nào) trả view không ghi/không event → MỘT `prisma.order.update` (undefined bỏ qua) → publish `OrderScopeChanged` NẾU dto có field scope, `OrderMetaChanged` NẾU dto có field vatMode/kWp/validityNote (một PATCH có thể publish 2 event, mỗi event đúng ngữ nghĩa nhóm) — publish SAU write.
  - [x] `previewTotal`: signature mới `previewTotal(dto, vatRatePercent: number)`; `applyVat = vatApplies(dto.vatMode ?? null)`; giữ `computeOrderTotals` nguyên chữ ký. Controller: inject `SettingsService`, handler preview thành async, `await this.settings.vatRatePercent()` truyền xuống — pattern `tieredPricingEnabled`, service GIỮ đúng 2 dep. Xoá import `VAT_RATE_MAC_DINH` khỏi service nếu không còn dùng (hằng số vẫn sống trong domain làm default registry? — KHÔNG: default 8 giờ ở `SETTING_DEFAULTS`; giữ `VAT_RATE_MAC_DINH` trong `order-totals.ts` nguyên vẹn vì test đang khoá nó, chỉ đừng dùng ở chỗ resolve).
  - [x] `PreviewTotalRequestDto`: thêm `vatMode?` (`@IsOptionalNotNull @IsIn(VAT_MODES)`) — client ECHO từ `Order.vatMode`, KHÔNG gửi rate (doc file đã hứa "additive").
  - [x] `PreviewTotalResponseDto`: thêm `vatRate!: number` (rate đã áp) + `applyVat!: boolean`; controller/service compose `{...computeOrderTotals(...), vatRate, applyVat}` — KHÔNG đổi chữ ký hàm domain.
  - [x] `OrderResponseDto`: cập nhật mô tả `kWp` (Float 2 lẻ, hành vi 4.4) + thêm `validityNote!: string | null`.
  - [x] Regen OpenAPI: `cd backend && npm run openapi:gen` (drift-guard so byte).
  - [x] Test service: update() assert payload `where`+`data` từng nhóm field; event đúng nhóm (chỉ scope → chỉ OrderScopeChanged; chỉ meta → chỉ OrderMetaChanged; cả hai → 2 event); 409 ngoài baogia; kWp/validityNote null → ghi null. Test e2e: 400 `vatMode: 'khac'` + `kWp: 8.825` (3 lẻ) có `fieldErrors`; preview `khong_vat` → `vatAmount 0` + body có `vatRate`/`applyVat`; preview đọc config (mock Prisma trả row `vat.rate_percent = '10'` → vatAmount theo 10%); 403 thiếu quyền.
- [x] Task 5: FE ports + fakes (AC: #5)
  - [x] `web/src/design-system/session/orders-port.ts`: `Order` thêm `validityNote: string | null`; `UpdateOrderMetaInput = { vatMode?: string; kWp?: number | null; validityNote?: string | null }`; method MỚI `updateOrderMeta(orderId, input): Promise<Order>` (GIỮ `updateScopeFlags` nguyên — cùng PATCH endpoint, hai method typed, không churn 4.3); `PreviewTotalInput` thêm `vatMode?: string`; `OrderTotals` thêm `vatRate: number; applyVat: boolean`. Twin `orders_port.dart` đồng bộ (parity guard): `Order.kWp` đổi `int?` → `double?` (L82), thêm `validityNote String?`, `OrderTotals`/`previewTotal` input mở rộng tương ứng, method `updateOrderMeta` mới.
  - [x] Fakes (web + dart, twin logic): `create` đặt `vatMode: 'co_vat'`; `previewTotal` đọc `input.vatMode` (`khong_vat` → vat 0) + trả `vatRate: 8, applyVat` (fake là backend surrogate — logic được phép); `updateOrderMeta` đổi state trả Order mới.
  - [x] Web-only port mới `web/src/design-system/session/settings-port.ts`: `getVatRate(): Promise<number>` + `updateVatRate(ratePercent: number): Promise<number>` + `fake-settings-port.ts` — khuôn `customer-sources-port.ts` (web-only, KHÔNG twin dart; xác nhận parity guard không đòi twin cho port web-only).
- [x] Task 6: Web UI (AC: #5, #6)
  - [x] `CreateQuoteScreen.tsx`: `refreshTotals` (~L128) gửi thêm `vatMode: fetched.vatMode`; khối totals (~L391): Checkbox "Tính VAT" `checked={order.vatMode !== 'khong_vat'}` → `updateOrderMeta({vatMode: checked ? 'co_vat' : 'khong_vat'})` → `setOrder` → `refreshTotals(orderMới)`; disable khi đang chờ (pattern `scopeBusy` 4.3); hiển thị `{totals.vatRate}%` cạnh checkbox (giá trị động từ backend, không nhãn tĩnh).
  - [x] Card khách: 2 `Field` "Công suất (kWp)" + "Hiệu lực báo giá" prefill từ `order`; commit onBlur KHI giá trị đổi → `updateOrderMeta` (kWp: parse `"8,82"`/`"8.82"` → `Number(text.replace(',', '.'))` — chuyển đổi input, KHÔNG phải số học tiền; rỗng → `null`; parse NaN → giữ nguyên + báo lỗi field); lỗi port → `setError` Banner + giỏ + input revert về giá trị order cũ (pattern k).
  - [x] `CustomerSourceConfigScreen.tsx`: mục "Thuế suất VAT" — Frame/Card RIÊNG dưới bảng nguồn khách (mockup vẽ tabs nhưng design-system CHƯA có component Tabs; dựng Tabs mới ngoài scope — deviation ghi ở Dev Notes): load `getVatRate` khi mount, input số + Button "Lưu" → `updateVatRate` → hiện giá trị mới; lỗi → Banner. Nhận `settingsPort` qua props như `customerSourcesPort` hiện tại.
  - [x] CSS vào `orders.css`/`settings.css` nếu cần — 0 shadow/gradient, radius từ token (guard f). KHÔNG bare `<button>`/`<input>` (guard b).
- [x] Task 7: Mobile UI + widget test (AC: #5)
  - [x] `create_quote_screen.dart`: `_refreshTotals` (~L116) gửi `vatMode`; khối `mtotals` (~L700): `AppCheckbox` "Tính VAT" + hiện `'{vatRate}%'` từ `_totals`; card khách (~L587): 2 `AppField` "Công suất (kWp)" + "Hiệu lực báo giá" commit (onFieldSubmitted/focus-lost) → `updateOrderMeta` → `setState`; lỗi → Banner, giỏ + state cũ nguyên.
  - [x] Widget test `create_quote_screen_test.dart` (BẮT BUỘC — C-4, gồm error case): (a) untick "Tính VAT" → fake nhận `vatMode: 'khong_vat'`, totals hiển thị vat 0; (b) nhập kWp "8,82" commit → fake nhận `8.82`; (c) nhập "Hiệu lực báo giá" commit → fake nhận đúng chuỗi; (d) port throw (`OrderPortException` qua fake subclass) → Banner + dòng giỏ còn nguyên + checkbox giữ state cũ. `ensureVisible` TRƯỚC tap (bài học 4.3 tap-miss). `dart format -o none --set-exit-if-changed` CHỈ file đã sửa.
- [x] Task 8: Guards design-system (AC: #5, #6)
  - [x] `design-system/screens/orders.test.mjs`: (b) allowlist import nếu thiếu (`Field` đã dùng ở màn khác — kiểm); (c.2) thêm `updateOrderMeta` vào danh sách port-method màn phải gọi; (e) nhãn byte-identical mới: "Tính VAT", "Công suất (kWp)", "Hiệu lực báo giá"; negative assert mới nếu viết sạch được (vd cấm literal `'khong_vat'` xuất hiện quá 2 chỗ/màn — cân nhắc, đừng gượng ép) — MỌI negative assert mới PHẢI mutation-check (bẻ code thật → RED → revert bằng cp backup, KHÔNG git checkout).
  - [x] `design-system/screens/settings-customer-sources.test.mjs`: mở rộng — nhãn "Thuế suất VAT" + "Lưu", màn gọi `getVatRate`/`updateVatRate`.
  - [x] `design-system/session/parity.test.mjs`: cặp orders port web↔dart re-check twin mới; settings-port web-only không đăng ký twin.
  - [x] Chạy `cd design-system && npm test` (drift + source-guard + parity). Guard quét file như TEXT — tránh chuỗi bị cấm (`shadow`, `gradient`, `* 8`, `Math.floor(`, `reduce(`…) kể cả trong comment.
- [x] Task 9: Chạy toàn bộ lane + hồ sơ story (AC: tất cả)
  - [x] `cd backend && npm test` (unit + e2e + 7 source-guard + drift openapi/permissions).
  - [x] `cd backend && npm run test:db` nếu có DATABASE_URL (story này CÓ migration — khác 4.3).
  - [x] `cd mobile && flutter test && flutter analyze`.
  - [x] `cd design-system && npm test`.
  - [x] Tick tasks, điền Dev Agent Record + File List + Change Log.

### Review Follow-ups (AI)

- [ ] [AI-Review][Medium] Chạy `cd backend && npm run test:db` khi có Postgres (cần mở Docker Desktop bằng GUI) — migration `20260717000000_add_system_settings_and_order_metadata` sinh OFFLINE, chưa từng deploy lên DB thật; spec `backend/test/settings.db.integration.spec.ts` đã sẵn 4 case tự-skip. Review 2026-07-17 xác nhận: daemon Docker + port 5432 đều không khả dụng trong phiên headless.
- [ ] [AI-Review][Low] Mobile: 2 input "Công suất (kWp)"/"Hiệu lực báo giá" không disable khi `!editable`/`_metaBusy` (web có `disabled={!editable || metaBusy}`) — `AppField` chưa có param `enabled`; nếu muốn parity đầy đủ cần mở rộng component design-system (story riêng). Rủi ro thực tế thấp: màn Tạo báo giá đơn luôn ở `baogia`, backend chặn 409, lỗi → Banner + revert (đã có widget test).

## Dev Notes

### Quyết định spec đã chốt (đọc trước khi code)

- **kWp là Float, không Int:** spine ERD phác `int kWp` nhưng mockup hiển thị "8,82 kWp"/"8,2 kWp"/"5,4 kWp" nhiều chỗ và thực tế solar 14 tấm × 630W = 8,82 kWp — số lẻ là bản chất. AD-10 "integer" áp cho TIỀN, không áp cho công suất. Cột `k_wp` chưa từng được ghi (4.1 tạo sẵn không hành vi) → alter Int→double precision không mất dữ liệu. Field/DTO/port giữ tên `kWp` (đã publish từ 4.1). [Source: mockups/all-screens.html L1378, L759; ARCHITECTURE-SPINE.md#ERD]
- **`vatMode` registry 2 giá trị:** `'co_vat' | 'khong_vat'` — String trong DB (nhất quán `Order.status`/`custType`, KHÔNG Postgres enum), bộ khoá sống Ở MỘT NƠI `orders/domain/vat-mode.ts` (mirror `CUST_TYPE`/`FLAG` — literal ngoài registry là mầm bug chính tả). Đơn tạo TRƯỚC 4.4 có `vatMode` null → `vatApplies(null) = true` (khớp hành vi preview hiện hành `applyVat: true`); đơn MỚI luôn ghi `'co_vat'` tường minh (bài học preset 4.3 — default DB không mang ngữ nghĩa).
- **Thuế suất là config HỆ THỐNG, KHÔNG override per-Đơn:** PRD FR-3 có `[ASSUMPTION: override được ở cấp Đơn]` nhưng epic AC 4.4 chỉ yêu cầu tick có/không + rate cấu hình; ERD chỉ có `vatRate` trên `OrderVersion` (snapshot lúc Chốt — 4.5), KHÔNG có trên `Order`. Làm đúng epic; per-order rate là scope mở rộng phải hỏi Đại Ca.
- **Bảng `system_settings` key-value + registry:** mirror chính xác khuôn feature-flags (bảng giữ TRẠNG THÁI, registry giữ DANH SÁCH key hợp lệ + default). YAGNI: đúng MỘT setting `vat.rate_percent`, KHÔNG dựng framework settings tổng quát. Row vắng = default 8 — không cần seed.
- **Preview VẪN stateless:** client echo `vatMode` (như đã echo `unitPrice` — không có phép suy diễn nào ở client ngoài forward giá trị order), KHÔNG gửi orderId, KHÔNG BAO GIỜ gửi rate. Backend resolve rate MỘT lần mỗi request qua `SettingsService` — Ở CONTROLLER rồi truyền int xuống (giữ kỷ luật service 2-dep như `tieredPricingEnabled`). Response thêm `vatRate`/`applyVat` để UI hiển thị "%" mà không client nào phải biết config.
- **Cửa sổ sửa = `baogia` cho CẢ vatMode/kWp/validityNote:** 4.5 snapshot `vatRate`+`vatMode` lúc Chốt; đổi tick sau chốt là đổi tiền đã đóng băng. kWp/validityNote cùng cửa sổ cho nhất quán (một `assertMutable`, một ngữ nghĩa 409).
- **KHÔNG snapshot gì trong story này:** snapshot `vatRate`/`vatMode` lên `OrderVersion` là Story 4.5 — cột đã có sẵn, ĐỪNG ghi.
- **Tabs màn Cấu hình — deviation có chủ đích:** mockup vẽ tabs "Nguồn khách | Thuế suất VAT" nhưng design-system chưa có component Tabs; dựng section Frame/Card riêng dưới bảng nguồn khách thoả FR-3, tránh component mới ngoài scope (AD-13: mọi màn dùng component có sẵn). Nếu Đại Ca muốn tabs đúng mockup → story design-system riêng.
- **Hạn hiệu lực = chuỗi tự do `validityNote`:** epic ghi ví dụ "48h kể từ ngày lên PO" — Phase 1 chỉ hiển thị (trên báo giá PDF ở 4.8), không auto khoá. Noti #11 "sắp hết hiệu lực" (Epic 9, FR-34) nếu cần datetime sẽ tự thêm cột — đừng đoán trước cấu trúc.

### Hiện trạng code (đã scout, tin được)

**Backend:**
- `orders/domain/order-totals.ts`: `computeOrderTotals({lines, vatRate, applyVat})` ĐÃ nhận đủ tham số 4.4 — chỗ duy nhất phải đổi là NƠI RESOLVE (`orders.service.ts` L270–279 `previewTotal` đang hardcode `VAT_RATE_MAC_DINH` + `applyVat: true`, doc tại chỗ ghi rõ "Story 4.4 mở rộng chỗ resolve, không đổi chữ ký hàm domain"). `order-totals.spec.ts` ĐÃ phủ: applyVat=false → 0, half-up boundary rate 5 (1010→51, 1009→50), một-điểm-làm-tròn, `VAT_RATE_MAC_DINH = 8`.
- `orders.service.ts`: `create()` L218–263 ($transaction 3 op, ghi tường minh preset — thêm `vatMode` cạnh đó); `updateScopeFlags()` L314–345 là khuôn cho `update()` (assertMutable → body rỗng no-op → update partial → publish sau commit); `orderSnapshot()` L105–119 THIẾU vatMode/kWp/validityNote.
- `orders.controller.ts`: PATCH `/orders/:id` ĐÃ TỒN TẠI (4.3) gate `PERM.quotesCreateEdit`, controller đã inject `FeatureFlagsService` (mẫu inject `SettingsService`). Route tĩnh `preview-total` khai báo TRƯỚC `:id`.
- DTO: `UpdateOrderRequestDto` + `PreviewTotalRequestDto` đều có doc hứa sẵn chỗ mở 4.4; `OrderResponseDto` ĐÃ có `kWp`/`vatMode` (thêm `validityNote`); `PreviewTotalResponseDto` 3 số (thêm `vatRate`/`applyVat`). Khuôn nullable-clear: xem `UpdateLineItemRequestDto.note`.
- `feature-flags/` là mirror hoàn chỉnh cho module `settings` mới: registry domain thuần + service 2-dep + controller Swagger đủ bộ + event + spec. LƯU Ý khác biệt: GET feature-flags là `@AuthenticatedOnly` (sale cần biết cờ) — GET vat-rate thì `settings.manage` (sale nhận rate qua preview response, không cần endpoint).
- `PERM.settingsManage = 'settings.manage'` (permission-registry.ts L61) — có sẵn, KHÔNG thêm quyền mới, `permissions.json` không đổi.
- Prisma `Order`: `kWp Int? @map("k_wp")` L333, `vatMode String? @map("vat_mode")` L334 — cả hai null từ 4.1, chưa hành vi. `OrderVersion.vatRate/vatMode/chotAt` L353–355 — CỦA 4.5, không đụng.
- Guard backend sẽ tự bắt: handler thiếu `@RequirePermissions` / permission literal / naming convention (bảng snake_case số nhiều: `system_settings` ✓) / openapi drift.

**FE web:**
- `CreateQuoteScreen.tsx` (~560 dòng): `refreshTotals` L128 (ticket `useRef` chống stale — GIỮ nguyên pattern, chỉ thêm `vatMode` vào input); totals `dl.quote-totals` L391–397 nhãn "Tổng trước VAT"/"Tiền VAT"/"Tổng sau VAT" (guard e đang khoá — ĐỪNG đổi); card khách + hàng Phạm vi + `scopeBusy` pattern từ 4.3.
- `orders-port.ts`: `Order` có `kWp: number | null` + `vatMode: string | null` sẵn (L50–51) — thêm `validityNote`; `OrderTotals` + `PreviewTotalInput` cần mở rộng; `updateScopeFlags` giữ nguyên, THÊM `updateOrderMeta`.
- `fake-orders-port.ts`: `previewTotal` L189–199 (fake tính 8% — mở rộng đọc vatMode); `create` đặt `kWp: null, vatMode: null` L80–81 → đổi `vatMode: 'co_vat'`.
- Màn cấu hình: `CustomerSourceConfigScreen.tsx` nhận port qua props, dùng `usePermissions` + `filterNav`; port web-only `customer-sources-port.ts` là khuôn cho `settings-port.ts`.
- Web KHÔNG có tsc/bundler — text-guard là lớp bảo vệ duy nhất cho `.tsx`.

**FE mobile:**
- `create_quote_screen.dart` (~750 dòng): `_refreshTotals` L116–132; card khách L587–604 (AppCustomerTypeChip + hàng Phạm vi 4.3); totals `mtotals` L700–710 qua widget `_TotalsRow`; `AppField`/`AppCheckbox`/`AppBanner` có sẵn trong `mobile/lib/design_system/components/`.
- `orders_port.dart`: `Order.kWp int?` L82 → đổi `double?`; `vatMode String?` L83; fake dart truyền kWp/vatMode qua copy L102–103, L256–257.
- Mobile không có app runtime — transport qua port tiêm + fake trong test.

**Guards:**
- `design-system/screens/orders.test.mjs`: (b) allowlist import, (c.2) port-method list, (e) nhãn byte-identical (thêm 3 nhãn mới), (h/h.2/h.3) cấm số học tiền, (k) failure không mất giỏ, (l) khối negative assert 4.3.
- `settings-customer-sources.test.mjs`: guard màn cấu hình — mở rộng cho mục VAT.
- `session/parity.test.mjs`: twin port web↔dart (orders); `customer-sources-port` web-only đã có tiền lệ không-twin.

### Bài học từ story trước (4.1–4.3)

- Assert **payload ghi DB** (`data`/`where`), không đếm số lần gọi mock; test thứ tự `['write','publish']` chứng minh event sau commit.
- Mọi negative assert guard mới phải **mutation-check** (bẻ code thật → RED → revert bằng `cp` backup, KHÔNG `git checkout` — story code chưa commit).
- Widget test mobile BẮT BUỘC cho mọi thay đổi màn (C-4), gồm error case; `ensureVisible` trước tap (4.3 dính tap-miss).
- Lỗi thao tác màn Tạo báo giá → Banner + KHÔNG wipe giỏ (finding High 4.1).
- Partial DTO viết tay, CẤM `PartialType`; nested array cần `@Type()` (4.2).
- `dart format` mặc định GHI đè hàng loạt — luôn `-o none --set-exit-if-changed <file>`.
- OpenAPI là artifact sinh — đổi DTO/route xong PHẢI `npm run openapi:gen`.
- Backend lane từng flake ở `customer-sources.e2e` — đỏ không liên quan thì rerun trước.
- Dev Agent Record phải cập nhật SAU QA phase (finding Medium 4.2 + 4.3 — đừng tái phạm lần ba).
- `resolve_customization.py` fail trên máy này (Python < 3.11) — merge workflow block tay nếu cần.

### Web research

Không thư viện/API mới — stack đã pin (NestJS 11.1.27, Prisma 7.8.0, React 19.2.7, Flutter 3.44). Gotcha Prisma 7 liên quan story: (1) `migrate diff` chỉ nhận `--from-schema`/`--to-schema`; (2) empty-createMany guard không áp (không dùng createMany); (3) P2003 chỉ trên INSERT — không liên quan.

### Project Structure Notes

- File MỚI: `backend/src/settings/{settings.module.ts, settings.controller.ts, settings.service.ts, domain/setting-registry.ts, domain/setting-events.ts, dto/vat-rate-response.dto.ts, dto/update-vat-rate-request.dto.ts}`, `backend/src/orders/domain/vat-mode.ts`, `backend/prisma/migrations/<ts>_add_system_settings_and_order_metadata/`, `backend/test/settings.service.spec.ts` (+ e2e case), `web/src/design-system/session/{settings-port.ts, fake-settings-port.ts}`.
- File SỬA: `backend/prisma/schema.prisma`, `backend/src/app.module.ts`, `backend/src/orders/{orders.service.ts, orders.controller.ts, orders.module.ts, domain/order-events.ts, dto/update-order-request.dto.ts, dto/preview-total-request.dto.ts, dto/preview-total-response.dto.ts, dto/order-response.dto.ts}`, `backend/openapi/openapi.json` (regen), `backend/test/{orders.service.spec.ts, orders.e2e.spec.ts, *.db.integration.spec.ts}`, `web/src/design-system/session/{orders-port.ts, fake-orders-port.ts}`, `web/src/screens/orders/CreateQuoteScreen.tsx` (+`orders.css`), `web/src/screens/settings/CustomerSourceConfigScreen.tsx` (+`settings.css`), `mobile/lib/design_system/session/{orders_port.dart, fake_orders_port.dart}`, `mobile/lib/screens/orders/create_quote_screen.dart`, `mobile/test/screens/orders/create_quote_screen_test.dart`, `design-system/screens/{orders.test.mjs, settings-customer-sources.test.mjs}`.
- KHÔNG đụng: `order-totals.ts`/`line-amount.ts` (hàm pricing nguyên vẹn — chỉ đổi nơi resolve), `OrderVersion` (4.5), các file chip design-system, permission registry, `scope-preset.ts`.
- Naming: kebab-case (TS) / snake_case (Dart); bảng `system_settings` snake số nhiều; route `/settings/vat-rate`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.4] — 3 AC gốc
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-3, #FR-4] — VAT tick + rate cấu hình (mặc định 8%) + assumption phạm vi; kWp + hạn hiệu lực (Phase 1 chỉ hiển thị)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-16] — round-half-up grand-subtotal, MỘT điểm làm tròn, vatRate resolve một lần, snapshot lúc Chốt (4.5); #AD-14 cờ/config nghiệp vụ sống trên DB
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md#Điểm-quyết-định] — "tick VAT có/không đổi kết quả tức thì" (L123)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-quote L1489–1497, #s-source-config L4662] — totals "VAT 8% [Bật]", pill "8,82 kWp", tab "Thuế suất VAT" trong màn cấu hình
- [Source: _bmad-output/implementation-artifacts/4-3-co-pham-vi-loai-khach-preset.md] — pattern PATCH/DTO/event/guard/widget-test + toàn bộ Dev Notes hiện trạng
- [Source: backend/src/feature-flags/] — mirror hoàn chỉnh cho module settings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) — BMAD dev-story workflow.

### Debug Log References

- `resolve_customization.py` không chạy (Python < 3.11 — đã biết) → merge workflow block tay: prepend/append rỗng, persistent_facts = `**/project-context.md`, on_complete rỗng.
- Backend lane đỏ 2 test một lần do flake đã biết (`customer-sources.e2e`-style) → rerun sạch 54 suites / 817 tests, không sửa gì.
- **DB lane CHƯA chạy được**: `backend/.env` có DATABASE_URL nhưng Postgres (Docker Desktop) không khởi động được trong phiên headless (`open -a Docker` không tạo được daemon socket — cần GUI session). Spec `settings.db.integration.spec.ts` đã viết đủ 4 case (migrate deploy đè lịch sử, upsert idempotent, `k_wp` double precision, `validity_note` text) và TỰ SKIP khi vắng DATABASE_URL. **Cần chạy `cd backend && npm run test:db` khi có Postgres** — migration 4.4 sinh OFFLINE, chưa từng deploy thật.
- Mutation-check guard mới: M1 nhãn `'8%'` tĩnh web → RED; M2 `handleMetaUpdate` bỏ `refreshTotals` → RED; M3 echo preview bỏ `vatMode` → RED; M4 nhãn tĩnh mobile → RED; M5 tạo `settings_port.dart` lậu → RED; M6 `PreviewTotalInput` web thêm `vatRate` → **false-GREEN lần đầu** (regex `[^}]*` cắt ở `}` lồng trong `Array<{...}>`) → sửa guard thành `[\s\S]*?\n\}` → RED đúng; M7 `UpdateOrderMetaInput` dart thêm `vatRate` → RED. Tất cả revert bằng `cp` backup, sanity xanh lại.
- Test cũ `xoá dòng (swipe)` mobile đỏ sau khi card khách cao thêm 2 input → thêm `ensureVisible` trước drag (đúng bài học tap-miss 4.3); test `dòng tự do` phải scope finder vào `AppSheet` vì 2 TextField rỗng mới của card đứng trước trong cây widget.

### Completion Notes List

- **AC-1**: Module `settings` mới mirror `feature-flags`: registry domain thuần (`SETTING.vatRatePercent = 'vat.rate_percent'`, default '8' — row vắng = 8, không seed), service đúng 2 dep (upsert → publish `SystemSettingChanged` before→after SAU write), controller GET+PATCH `/settings/vat-rate` CẢ HAI gate `PERM.settingsManage` (khác feature-flags có chủ đích — sale nhận rate qua preview response). E2e phủ 401/403 (quotes.create_edit + system.feature_flags KHÔNG thay thế được), 400 (8.5/-1/101/null/chuỗi), biên 0 & 100 hợp lệ, happy GET/PATCH + audit qua AuditSubscriber thật.
- **AC-2**: Registry `vat-mode.ts` domain thuần (`co_vat`/`khong_vat`, `vatApplies(null) = true` — đơn trước 4.4 tính như có VAT); `create()` ghi `vatMode: 'co_vat'` TƯỜNG MINH trong payload (test assert toàn bộ `data`); `updateScopeFlags` đổi tên `update()` — MỘT `prisma.order.update`, publish `OrderScopeChanged` nếu có field scope, `OrderMetaChanged` nếu có field meta (một PATCH 2 nhóm = 2 event, cả hai SAU write — test khoá thứ tự `['write','publish-scope','publish-meta']`); 409 ngoài `baogia`; `orderSnapshot` mở rộng vatMode/kWp/validityNote.
- **AC-3**: `previewTotal(dto, vatRatePercent)` — controller inject `SettingsService`, resolve rate MỘT lần mỗi request rồi truyền số xuống (pattern `tieredPricingEnabled`, service giữ đúng 2 dep); `applyVat = vatApplies(dto.vatMode ?? null)`; `computeOrderTotals` nguyên chữ ký, `VAT_RATE_MAC_DINH` giữ nguyên trong `order-totals.ts` (test khoá) nhưng KHÔNG còn dùng ở chỗ resolve. Response thêm `vatRate` + `applyVat` (openapi-drift cập nhật 3→5 field bắt buộc). E2e: `khong_vat` → vat 0; row config '10' → tính theo 10% + `vatRate: 10`; `vatMode: 'khac'` → 400 fieldErrors.
- **AC-4**: `UpdateOrderRequestDto` viết tay thêm `vatMode` (`@IsOptionalNotNull @IsIn`), `kWp` (`@IsNumber(maxDecimalPlaces: 2) @Min(0.01)`, `@IsOptional` — null XOÁ, khuôn `note`), `validityNote` (`@MaxLength(200)`, null xoá); vẫn không `scopeThietBi`, cấm `PartialType`. E2e: kWp 8.825 (3 lẻ) + vatMode lạ → 400 đủ 2 fieldErrors; kWp 0 + note 201 ký tự → 400; null-clear → 200; vatMode null → 400; 409 sau chốt.
- **AC-5**: Port web+dart twin: `updateOrderMeta` method MỚI (giữ `updateScopeFlags` — không churn 4.3), `PreviewTotalInput.vatMode` echo, `OrderTotals.vatRate/applyVat`, `Order.validityNote`, dart `kWp int?`→`double?`. Dart `UpdateOrderMetaInput` dùng sentinel `kMetaFieldAbsent` giữ tri-state absent/set/null-clear (Dart không có undefined) — call-site parity với web (`kWp: null` = xoá). Fake 2 bên: create đặt `co_vat`, preview đọc `vatMode` (khong_vat → 0) + trả `vatRate: 8, applyVat`. UI 2 nền tảng: Checkbox "Tính VAT" + `%` động từ `totals.vatRate`, 2 input kWp/hiệu lực commit-on-blur (web `onBlur`, mobile `Focus.onFocusChange` — AppField không có onSubmitted, không đụng component), parse "8,82"→8.82 (chuyển đổi input), lỗi port → Banner + giỏ + revert input về giá trị cũ. Meta handler RE-PREVIEW totals (tick đổi tiền — ngược với scope 4.3). 4 widget test mới (a–d gồm error case) + `ensureVisible` trước tap/drag.
- **AC-6**: `CustomerSourceConfigScreen` nhận thêm prop `settingsPort`; mục "Thuế suất VAT" là Frame RIÊNG dưới bảng nguồn (deviation có chủ đích: design-system chưa có Tabs, AD-13 — muốn tabs đúng mockup cần story design-system riêng); load `getVatRate` khi mount, input digits-only + Lưu disable in-flight, lỗi → Banner + fieldError `ratePercent`.
- **Guards**: orders.test.mjs — (c.2) + `updateOrderMeta`, (e) +3 nhãn byte-identical, (h.3) formula fake đổi `* vatRate` + pin `= 8`, khối (m) MỚI (cấm '8%' tĩnh, meta re-preview, echo vatMode, chuẩn hoá dấu phẩy); settings-customer-sources.test.mjs — (h.1) "no VAT tab" của 3.5 nghỉ hưu CÙNG story ship feature, thay bằng assert mục VAT + vẫn cấm Tabs; parity.test.mjs — twin orders re-check (không input nào mang vatRate — 2 phía) + settings-port web-only exception (khuôn customer-sources). 7 mutation-check, 1 false-green bắt được và sửa.
- **Lanes**: backend 54 suites / 817 tests xanh (unit + e2e + 7 source-guard + drift openapi/permissions, openapi regen); mobile 167 tests + analyze 0 issue + `dart format -o none --set-exit-if-changed` sạch trên file sửa; design-system 271 tests xanh. DB lane: spec sẵn, CHƯA chạy được (xem Debug Log).
- **QA automation (bmad-qa-generate-e2e-tests, sau dev)**: 8 gap thật → 8 test mới. Backend +5 (orders.e2e: smuggle `vatRate: 50` vào preview bị strip + vẫn tính theo config — ĐÃ mutation-check bẻ DTO+controller → RED → revert `cp`; preview `co_vat` tường minh qua `@IsIn`; PATCH meta biên HỢP LỆ kWp 0.01 + note đúng 200 ký tự. settings.e2e: PATCH `{}` ratePercent vắng hẳn → 400, khác nhánh null; smuggle `key`/`value` → upsert vẫn đúng key registry). Mobile +3 widget test (tick LẠI co_vat — nhánh checked=true trước đây zero test; kWp rác "abc" → lỗi field + KHÔNG gọi port; kWp xoá rỗng → PATCH null qua sentinel tri-state). Lanes sau QA: backend 822, mobile 170, design-system 271 (không đổi). Summary: `_bmad-output/implementation-artifacts/tests/test-summary-story-4-4.md`.

### File List

**Mới:**
- backend/prisma/migrations/20260717000000_add_system_settings_and_order_metadata/migration.sql
- backend/src/settings/domain/setting-registry.ts
- backend/src/settings/domain/setting-events.ts
- backend/src/settings/dto/vat-rate-response.dto.ts
- backend/src/settings/dto/update-vat-rate-request.dto.ts
- backend/src/settings/settings.service.ts
- backend/src/settings/settings.controller.ts
- backend/src/settings/settings.module.ts
- backend/src/orders/domain/vat-mode.ts
- backend/test/settings.service.spec.ts
- backend/test/settings.e2e.spec.ts
- backend/test/settings.db.integration.spec.ts
- backend/test/vat-mode.spec.ts
- web/src/design-system/session/settings-port.ts
- web/src/design-system/session/fake-settings-port.ts

**Sửa:**
- backend/prisma/schema.prisma
- backend/src/app.module.ts
- backend/src/orders/orders.module.ts
- backend/src/orders/orders.service.ts
- backend/src/orders/orders.controller.ts
- backend/src/orders/domain/order-events.ts
- backend/src/orders/dto/update-order-request.dto.ts
- backend/src/orders/dto/preview-total-request.dto.ts
- backend/src/orders/dto/preview-total-response.dto.ts
- backend/src/orders/dto/order-response.dto.ts
- backend/openapi/openapi.json (regen)
- backend/test/orders.service.spec.ts
- backend/test/orders.e2e.spec.ts
- backend/test/openapi-drift.spec.ts
- web/src/design-system/session/orders-port.ts
- web/src/design-system/session/fake-orders-port.ts
- web/src/design-system/session/index.ts
- web/src/screens/orders/CreateQuoteScreen.tsx
- web/src/screens/orders/orders.css
- web/src/screens/settings/CustomerSourceConfigScreen.tsx
- web/src/screens/settings/settings.css
- mobile/lib/design_system/session/orders_port.dart
- mobile/lib/design_system/session/fake_orders_port.dart
- mobile/lib/screens/orders/create_quote_screen.dart
- mobile/test/screens/orders/create_quote_screen_test.dart
- design-system/screens/orders.test.mjs
- design-system/screens/settings-customer-sources.test.mjs
- design-system/session/parity.test.mjs

## Senior Developer Review (AI)

**Reviewer:** Đại Ca (adversarial review tự động) — 2026-07-17
**Kết quả:** Approve — 0 Critical, 0 High, 1 Medium (action item), 1 Low (action item). Story → done.

- **Git vs File List:** 0 lệch — 15 file mới + 27 file sửa khớp chính xác git status.
- **AC 1–6:** tất cả IMPLEMENTED, mỗi AC có test khoá hành vi; đã đọc từng file trong File List và đối chiếu từng claim ở Completion Notes — không phát hiện task tick [x] nào chưa làm.
- **Lane re-run bởi reviewer (không tin số cũ):** backend 54 suites / 822 tests xanh; mobile 170 tests + `flutter analyze` 0 issue; design-system 271 tests xanh — khớp từng con số story ghi.
- **Security:** gate `settings.manage` cả GET/PATCH (e2e chứng minh `quotes.create_edit`/`system.feature_flags` không thay thế được); smuggle `vatRate` vào preview + smuggle `key`/`value` vào settings đều bị whitelist strip (e2e pin); client không đường nào gửi rate (parity guard 2 phía).
- **Medium (không fix được tại chỗ):** DB lane chưa chạy — reviewer xác nhận trực tiếp Docker daemon và port 5432 đều không khả dụng trong phiên headless; migration sinh offline chưa từng deploy thật → action item ở Review Follow-ups.
- **Low:** mobile 2 input metadata không disable khi `!editable`/`_metaBusy` (web có) — cần mở rộng `AppField` (component design-system, ngoài scope 4.4) → action item.

## Change Log

- 2026-07-17: Code review (adversarial, tự động) — Approve, story → done. 0 Critical/High; 1 Medium (DB lane chưa chạy — môi trường không có Postgres, action item) + 1 Low (mobile input metadata không disable — cần mở rộng AppField, action item) ghi ở Review Follow-ups. Reviewer tự chạy lại 3 lane: backend 822, mobile 170 + analyze 0, design-system 271 — tất cả xanh; git khớp File List 0 lệch.
- 2026-07-17: QA automation (sau dev) — +8 test cho gap thật: backend +5 (smuggle vatRate vào preview [mutation-checked], preview co_vat tường minh, biên hợp lệ kWp 0.01/note 200 ký tự, settings PATCH rỗng, settings smuggle key/value), mobile +3 widget (re-tick co_vat, kWp parse-fail, kWp null-clear). Backend 817→822, mobile 167→170, tất cả xanh.
- 2026-07-17: Story 4.4 hoàn thành — bảng `system_settings` key-value + module `settings` (GET/PATCH /settings/vat-rate, gate settings.manage, default 8 không seed); registry `vatMode` + create ghi tường minh `co_vat`; PATCH /orders/:id mở nhóm metadata (vatMode/kWp/validityNote, null-clear, event `OrderMetaChanged` tách khỏi `OrderScopeChanged`); preview-total resolve rate từ config server-side + trả `vatRate`/`applyVat`; `Order.kWp` Int→Float + `validityNote`; UI 2 nền tảng (tick "Tính VAT" + % động, 2 input commit-on-blur, màn Cấu hình web thêm mục Thuế suất VAT dạng Frame — không Tabs); guards + widget tests + mutation-check 7 mũi (1 false-green bắt và vá). Toàn bộ lane xanh trừ DB lane (Postgres không khởi động được — spec sẵn, cần chạy `npm run test:db` khi có DB).
