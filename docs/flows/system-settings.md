# Cấu hình hệ thống: thuế VAT và cờ nghiệp vụ

> Flow `system-settings`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow system-settings` in ra đúng danh sách đó.

## Mục đích

Giữ hai loại cấu hình nghiệp vụ trên DB (AD-14 — không biến môi trường, không Firebase Remote Config, không
hằng số rải trong code):

- **Thuế suất VAT** (`vat.rate_percent`, FR-3): số nguyên 0..100, mặc định 8 khi chưa ai cấu hình. Báo giá,
  chốt đơn và xuất báo giá đọc rate hiệu lực tươi mỗi request; khi chốt, rate được đóng băng vào `OrderVersion`
  (flow `orders`).
- **Cờ tính năng** (`feature_flags`, AD-14): hiện có đúng một cờ `catalog.tiered_pricing` (giá phân tầng lẻ/sỉ,
  FR-15), mặc định TẮT. Cờ gate việc ghi/đọc bậc thang giá ở flow `catalog` và phân giải giá ở `orders`.

Mỗi loại có một registry domain thuần là nguồn chân lý duy nhất cho tên key (`SETTING`, `FLAG`); bảng chỉ giữ
trạng thái. Vắng dòng = giá trị mặc định (VAT 8, cờ tắt) — không cần seed. Admin (`settings.manage`) đổi VAT;
người vận hành app (`system.feature_flags`, preset `SUPER_ADMIN`) bấm cờ.

## Điểm vào

HTTP:

- `GET /settings/vat-rate` — `SettingsController.getVatRate`, `settings.manage`. Trả `{ ratePercent }`.
- `PATCH /settings/vat-rate` — `SettingsController.updateVatRate`, `settings.manage`. Body `{ ratePercent }` Int 0..100.
- `GET /feature-flags` — `FeatureFlagsController.findAll`, `@AuthenticatedOnly()` (mọi phiên hợp lệ; sale cần biết cờ để hiển thị đúng).
- `PATCH /feature-flags/:key` — `FeatureFlagsController.toggle`, `system.feature_flags`. Body `{ enabled }`; key ngoài registry ⇒ 404.

Sale không gọi `/settings/vat-rate`: rate hiệu lực về cùng response `POST /orders/preview-total` (`vatRate`).

Màn hình: chỉ web — khung "Thuế suất VAT" nằm dưới bảng nguồn khách trong `CustomerSourceConfigScreen`
(`web/src/screens/settings/`, shared với flow `customers`). Mockup vẽ tab "Nguồn khách | Thuế suất VAT" nhưng
design-system chưa có component Tabs nên dựng thành Frame riêng (lệch có chủ đích, ghi trong code). Không có
màn bấm cờ, không có port cờ ở web/mobile, và không có bản mobile của `SettingsPort` (header port ghi "WEB-ONLY,
AND THAT IS DELIBERATE"). Web nối `HttpSettingsPort` vào app thật; `FakeSettingsPort` chỉ dùng trong test.

## Các bước

**A. Đổi thuế suất VAT**

1. `web/src/screens/settings/CustomerSourceConfigScreen.tsx` → `CustomerSourceConfigScreen`: lúc mở gọi `SettingsPort.getVatRate`; ô nhập chỉ giữ chữ số, nút Lưu disable khi ô trống hoặc đang lưu; `saveVatRate` gọi `SettingsPort.updateVatRate(Number(vatText))` và hiện nguyên lỗi backend (`SettingsPortError`).
2. `backend/src/settings/settings.controller.ts` → `SettingsController.updateVatRate`: `ValidationPipe` kiểm `UpdateVatRateRequestDto` (`@IsInt @Min(0) @Max(100)`, bắt buộc — không `@IsOptional`).
3. `backend/src/settings/settings.service.ts` → `SettingsService.updateVatRate`: đọc giá trị hiệu lực trước (`vatRatePercent`, vắng row ⇒ `SETTING_DEFAULTS`), `systemSetting.upsert` theo `SETTING.vatRatePercent` với `value` dạng chuỗi, rồi publish `SystemSettingChanged` (trước/sau) SAU khi ghi.
4. `SettingsService.vatRatePercent`: đọc row, `Number(row?.value ?? '8')`. Được `OrdersController` gọi ở `previewTotal`, `confirm` (`POST /orders/:id/chot`) và `exportQuote` (`POST /orders/:id/xuat-bao-gia`) rồi truyền xuống service — client không bao giờ gửi rate.

**B. Bật/tắt cờ tính năng**

1. `backend/src/feature-flags/feature-flags.controller.ts` → `FeatureFlagsController.toggle`: `isFeatureFlagKey(key)` sai ⇒ 404 (không tạo cờ mới từ URL); body `ToggleFeatureFlagRequestDto`.
2. `backend/src/feature-flags/feature-flags.service.ts` → `FeatureFlagsService.setEnabled`: đọc trạng thái trước (`isEnabled`), `featureFlag.upsert`, publish `FeatureFlagToggled` sau khi ghi; trả `{ key, label, enabled }`.
3. `FeatureFlagsService.listAll`: trả MỌI cờ trong `FEATURE_FLAGS` theo thứ tự registry, cờ chưa có dòng ⇒ `enabled: false`.
4. Tiêu thụ: `ProductsController` (đính `prices` khi cờ bật), `ProductPricesService.replace` (cờ tắt ⇒ 409), `OrdersController.tieredPricingEnabled` (truyền vào `confirm`, xuất báo giá, `resolveUnitPrice`) — đều gọi `FeatureFlagsService.isEnabled(FLAG.catalogTieredPricing)`.

## Bất biến

| Bất biến | Nơi enforce | Test canh |
|----------|-------------|-----------|
| Vắng row = mặc định (VAT 8, cờ tắt), không ném lỗi, không cần seed | `SettingsService.vatRatePercent`, `FeatureFlagsService.isEnabled` | `settings.service.spec.ts`, `feature-flags.service.spec.ts`, `settings.e2e.spec.ts` ("chưa cấu hình ⇒ 8") |
| `0` là thuế suất hợp lệ, không rơi về mặc định | `Number(row.value)` | `settings.service.spec.ts` (row "0" ⇒ 0), `settings.e2e.spec.ts` (biên 0 và 100) |
| VAT là Int 0..100 bắt buộc; 8.5 / -1 / 101 / `null` / body rỗng ⇒ 400, không ghi | `UpdateVatRateRequestDto` | `settings.e2e.spec.ts` |
| Key chỉ đến từ registry (`SETTING`, `FLAG`); body nhét `key`/`value` bị strip; `PATCH /feature-flags/<key lạ>` ⇒ 404 | `setting-registry.ts`, `feature-flag-registry.ts`, `isFeatureFlagKey` | `settings.e2e.spec.ts` ("smuggle key/value"), `backend/test/product-prices.e2e.spec.ts` (flow `catalog`) |
| Đọc và ghi VAT đều cần `settings.manage` (`quotes.create_edit` không thay được); đọc cờ chỉ cần phiên hợp lệ, bấm cờ cần `system.feature_flags` (`catalog.manage` không thay được) | decorator controller | `settings.e2e.spec.ts`, `product-prices.e2e.spec.ts` |
| Tắt cờ không xoá bậc thang giá (dữ liệu ngủ đông, bật lại là có) | `FeatureFlagsService` chỉ chạm `feature_flags` | `feature-flags.service.spec.ts` (AC-6, không gọi `productPrice`) |
| Ghi là `upsert` idempotent theo PK `key` | PK `system_settings.key`, `feature_flags.key` | `settings.service.spec.ts` (payload upsert), `settings.db.integration.spec.ts` (hai lần upsert ⇒ một row) |
| Event publish SAU ghi, mang giá trị hiệu lực trước → sau | `updateVatRate`, `setEnabled` | `settings.service.spec.ts`, `feature-flags.service.spec.ts`, `settings.e2e.spec.ts` (audit thật) |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/settings/settings.controller.ts` | Route VAT | `SettingsController` (`getVatRate`, `updateVatRate`) |
| `backend/src/settings/settings.service.ts` | Đọc/ghi `system_settings` | `SettingsService` (`vatRatePercent`, `updateVatRate`) |
| `backend/src/settings/settings.module.ts` | Module; export `SettingsService` cho `OrdersModule` | `SettingsModule` |
| `backend/src/settings/domain/setting-registry.ts` | Registry key + mặc định | `SETTING`, `SETTING_DEFAULTS`, `SettingKey` |
| `backend/src/settings/domain/setting-events.ts` | Event đổi cấu hình | `SystemSettingChanged` |
| `backend/src/settings/dto/update-vat-rate-request.dto.ts`, `backend/src/settings/dto/vat-rate-response.dto.ts` | Body/response VAT | `UpdateVatRateRequestDto`, `VatRateResponseDto` |
| `backend/src/feature-flags/feature-flags.controller.ts` | Route cờ | `FeatureFlagsController` (`findAll`, `toggle`) |
| `backend/src/feature-flags/feature-flags.service.ts` | Đọc/ghi `feature_flags` | `FeatureFlagsService` (`isEnabled`, `listAll`, `setEnabled`), `FeatureFlagState` |
| `backend/src/feature-flags/feature-flags.module.ts` | Module; export `FeatureFlagsService` cho `CatalogModule` (và `orders`) | `FeatureFlagsModule` |
| `backend/src/feature-flags/domain/feature-flag-registry.ts` | Registry cờ | `FLAG`, `FEATURE_FLAGS`, `FEATURE_FLAG_KEYS`, `isFeatureFlagKey`, `FeatureFlagKey` |
| `backend/src/feature-flags/domain/feature-flag-events.ts` | Event bấm cờ | `FeatureFlagToggled` |
| `backend/src/feature-flags/dto/feature-flag-response.dto.ts`, `backend/src/feature-flags/dto/toggle-feature-flag-request.dto.ts` | Response/body cờ | `FeatureFlagResponseDto`, `ToggleFeatureFlagRequestDto` |
| `backend/prisma/migrations/20260713010000_add_feature_flags_and_product_prices/migration.sql` (shared với `catalog`) | Bảng `feature_flags` (PK `key`, không seed) + `product_prices` | — |
| `backend/prisma/migrations/20260717000000_add_system_settings_and_order_metadata/migration.sql` (shared với `orders`) | Bảng `system_settings` (PK `key`); cùng migration thêm `orders.validity_note`, đổi `orders.k_wp` sang double precision | — |
| `web/src/design-system/session/settings-port.ts` | Port VAT (web-only) | `SettingsPort` (`getVatRate`, `updateVatRate`), `SettingsPortError` |
| `web/src/design-system/session/fake-settings-port.ts` | Fake port | `FakeSettingsPort` |
| `web/src/screens/settings/CustomerSourceConfigScreen.tsx` (shared với `customers`) | Màn Cấu hình: khung "Thuế suất VAT" | `CustomerSourceConfigScreen` (`saveVatRate`) |
| `web/src/screens/settings/settings.css` (shared) | Style màn Cấu hình | — |

## Dữ liệu

- Bảng: `system_settings` (key/value chuỗi, hiện có một key `vat.rate_percent`), `feature_flags` (key/enabled,
  hiện có một key `catalog.tiered_pricing`).
- Đọc từ flow khác: `orders` (VAT + cờ, mỗi request), `catalog` (cờ). Rate đóng băng vào `order_versions.vat_rate`
  khi chốt là việc của `orders`.
- Sự kiện phát: `SystemSettingChanged`, `FeatureFlagToggled` — qua `EventBus` sau khi ghi; `AuditSubscriber` ghi `audit_logs`.
- Gọi ngoài: không có.

## Flow liên quan

- catalog: cờ `catalog.tiered_pricing` gate bậc thang giá (`ProductsController`, `ProductPricesService`, `resolveUnitPrice`).
- orders: `OrdersController` resolve VAT và cờ tươi mỗi request cho `preview-total`, chốt, xuất báo giá.
- customers: chung màn `CustomerSourceConfigScreen` và `settings.css`.
- accounts-permissions: key `settings.manage`, `system.feature_flags`.
- auth-session: JWT, `PermissionsGuard`, `@RequirePermissions`, `@AuthenticatedOnly`.
- domain-events-audit: `EventBus`, `AuditSubscriber`.
- backend-platform: `PrismaService`, `AppException` / error envelope, `ValidationPipe`.

## Mở rộng: pháp nhân công ty (bên bán trên hợp đồng và hoá đơn)

`GET /settings/company-legal-entity` và `PUT /settings/company-legal-entity` (`SettingsController`, cần `settings.manage`)
đọc và ghi các trường pháp nhân trong `system_settings`. Các trường mặc định rỗng; trường rỗng in "Chưa cấu hình" trên
hợp đồng và hoá đơn và KHÔNG chặn sinh chứng từ (`missingLegalEntityFields` chỉ liệt kê những trường còn thiếu).

| Đường dẫn | Vai trò |
|-----------|---------|
| `backend/src/settings/domain/company-legal-entity.ts` | Trường pháp nhân theo thứ tự hiển thị (`LEGAL_ENTITY_FIELDS`), `missingLegalEntityFields` |
| `backend/src/settings/dto/company-legal-entity.dto.ts` | DTO đọc và ghi pháp nhân |
| `web/src/api/http-settings-port.ts` | Port thật của màn Cấu hình (web) |

## Tests

Backend, hermetic (`npm test`):

- `backend/test/settings.service.spec.ts`: bảng rỗng ⇒ 8; parse chuỗi "10"/"0"; payload `upsert` đúng key registry; event trước → sau (row vắng ⇒ trước là "8"); publish sau khi ghi.
- `backend/test/feature-flags.service.spec.ts`: bảng rỗng ⇒ tắt; `listAll` trả đủ key registry kể cả key chưa có dòng; bật/tắt ⇒ `upsert` + `FeatureFlagToggled` sau khi ghi; tắt cờ không chạm `productPrice`.
- `backend/test/settings.e2e.spec.ts`: không token ⇒ 401; thiếu `settings.manage` ⇒ 403 trên GET và PATCH; mặc định 8 / giá trị đã cấu hình; validation 8.5 / -1 / 101 / `null` / body rỗng ⇒ 400 không ghi; key/value nhét vào body bị strip; biên 0 và 100; audit `SystemSettingChanged` qua `AuditSubscriber` thật.

Backend, lane DB (`*.db.integration.spec.ts`, tự skip khi không có `DATABASE_URL`; chạy `npm run test:db`):

- `backend/test/settings.db.integration.spec.ts`: migration `20260717000000` đã áp trên lịch sử có sẵn; hai lần upsert cùng key ⇒ một row; `orders.k_wp` là double precision; cột `validity_note` tồn tại.

Ngoài danh sách test của flow: HTTP của `/feature-flags` (401, 403, 404 key lạ, `enabled: null` ⇒ 400, audit
`FeatureFlagToggled`) được phủ trong `backend/test/product-prices.e2e.spec.ts` (flow `catalog`); khung VAT của màn
Cấu hình chỉ có ca smoke render trong `web/src/test/screens-render.test.tsx` và text-guard
`design-system/screens/settings-customer-sources.test.mjs` (flow `customers`). Flow này không có source-guard,
test web hay flutter riêng.
