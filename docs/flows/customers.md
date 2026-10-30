# Khách hàng và nguồn khách

> Flow `customers`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow customers` in ra đúng danh sách đó.

## Mục đích

Quản lý hồ sơ khách hàng (FR-29) và danh mục **nguồn khách** (khách đến từ kênh nào) cho Phương Nam Solar.

- **Một SĐT = một khách hàng** trên toàn hệ thống: khoá chính `Customer.sdt` là SĐT Việt Nam đã chuẩn hoá
  E.164 (`+84…`, AD-9). Client gửi chuỗi thô, chỉ backend chuẩn hoá.
- Hai loại khách (`CUST_TYPE`): `CA_NHAN` (có CCCD, không MST/tài khoản công ty) và `THUONG_MAI` (có MST,
  tài khoản ngân hàng, không CCCD). Field lạc loại ⇒ 400.
- Mỗi khách bắt buộc có nguồn; nguồn mang cờ `isOther` ("Khác") buộc ghi `sourceNote`.
- Nguồn khách chỉ tắt/bật lại, không bao giờ xoá cứng — giữ lịch sử "khách này từ đâu tới" cho báo cáo
  theo nguồn.

Người dùng: sale / thợ khảo sát / quản lý / kế toán (`customers.manage`) tra, tạo, sửa khách; Admin
(`settings.manage`) cấu hình danh mục nguồn trên màn Cấu hình (chỉ có ở web).

## Điểm vào

HTTP (JWT bắt buộc):

- `POST /customers` — `CustomersController.create`, `customers.manage`.
- `GET /customers?q=&custType=&page=&pageSize=` — `CustomersController.list`, `customers.manage`.
- `GET /customers/lookup?sdt=` — `CustomersController.lookup`, `customers.manage` (khai trước `:sdt`; không thấy ⇒ `found: false`, không 404).
- `GET /customers/:sdt` — `CustomersController.findOne`, `customers.manage` (`:sdt` thô cũng được, backend chuẩn hoá).
- `PATCH /customers/:sdt` — `CustomersController.update`, `customers.manage` (`sdt` trong body ⇒ 400).
- `GET /customer-sources?includeInactive=true` — `CustomerSourcesController.findAll`, `customers.manage`.
- `POST /customer-sources` — `CustomerSourcesController.create`, `settings.manage`.
- `PATCH /customer-sources/:id` — `CustomerSourcesController.update`, `settings.manage`.
- `DELETE /customer-sources/:id` — `CustomerSourcesController.deactivate`, `settings.manage`, 204 (tắt, không xoá).
- `POST /customer-sources/:id/reactivate` — `CustomerSourcesController.reactivate`, `settings.manage`, 200.

Màn hình (chạy trên fake port; web chưa có router/port HTTP, mobile chưa có `main.dart`):

- Web: `CustomerListScreen`, `CustomerDetailScreen`, `CustomerPickScreen` (tra SĐT ⇒ chọn khách cũ hoặc tạo
  mới tại chỗ; API để lại cho báo giá là `onSelect(customer)`), và `CustomerSourceConfigScreen` (shared với
  `system-settings`: bảng nguồn khách + khung "Thuế suất VAT").
- Mobile: `CustomerListScreen`, `CustomerDetailScreen`, `CustomerPickScreen`. Màn cấu hình nguồn khách cố ý
  chỉ có ở web (header màn ghi "WEB-ONLY, by name (DESIGN.md)").

## Các bước

**A. Tra / tạo khách**

1. `web/src/screens/customers/CustomerPickScreen.tsx` / `mobile/lib/screens/customers/customer_pick_screen.dart` → `CustomerPickScreen`: gửi SĐT thô qua `CustomersPort.lookup` khi bấm nút/Enter (không tra theo từng phím); màn không có regex hay kiểm độ dài SĐT.
2. `backend/src/customers/customers.controller.ts` → `CustomersController.lookup` → `backend/src/customers/customers.service.ts` → `CustomersService.lookup`: chuẩn hoá bằng `normalizeVnPhone` rồi tra PK; trả `{ found, sdt, customer }`.
3. Không thấy ⇒ màn mở form tạo; `CustomersPort.listSources` lấy danh sách nguồn đang bật (`GET /customer-sources`).
4. `CustomersController.create` → `CustomersService.create`: theo đúng thứ tự, kiểm hết trước khi chạm DB — `normalizeOrThrow` (400 `isPhoneNumber`), `loadSourceOrThrow` (nguồn phải tồn tại, 400 `sourceId`), `assertSourceNote` (nguồn `isOther` ⇒ `sourceNote` không rỗng), `assertFieldsMatchType` (field lạc loại ⇒ 400).
5. Cùng hàm: `customer.create` với `sdt` ĐÃ chuẩn hoá; `P2002` (trùng PK) ⇒ `translateWriteError` trả 409 kèm `fieldErrors` `sdt`. Sau commit publish `CustomerCreated`.

**B. Danh sách, chi tiết, sửa**

1. `CustomersService.list`: `$transaction([findMany, count])` (trang và tổng cùng ảnh chụp); `q` khớp tên hoặc SĐT — nhánh SĐT dùng `phoneSearchNeedle` (bỏ số `0` đầu để `0903` khớp `+84903…`), needle rỗng thì bỏ nhánh SĐT; lọc `custType`, phân trang `page`/`pageSize`.
2. `CustomersService.findOne`: chuẩn hoá `:sdt` rồi đọc; không có ⇒ 404.
3. `CustomersService.update`: chuẩn hoá `:sdt`, đọc bản cũ, trộn PATCH (`effective`) rồi chạy lại luật nguồn/`sourceNote` và luật loại khách trên bản HIỆU LỰC (đổi loại mà còn `cccd` cũ ⇒ phải gửi `"cccd": null`); publish `CustomerUpdated` với trước/sau. `sdt` bất biến nhờ `@IsAbsent` trong `UpdateCustomerRequestDto`.
4. Web/mobile `CustomerListScreen` gửi `q` thô xuống port (không lọc/sắp/đếm phía client); `CustomerDetailScreen` chỉ hiện field thuộc loại của khách.

**C. Cấu hình nguồn khách (web)**

1. `web/src/screens/settings/CustomerSourceConfigScreen.tsx` → `CustomerSourceConfigScreen`: tải `CustomerSourcesPort.list(true)`; dialog Thêm/Sửa; nút Tắt bị disable trên dòng `isOther`; mọi thông báo lỗi là message của backend.
2. `backend/src/customers/customer-sources.controller.ts` → `CustomerSourcesController.create` → `backend/src/customers/customer-sources.service.ts` → `CustomerSourcesService.create`: `sortOrder` vắng ⇒ `nextSortOrder` (cuối danh sách); `isOther` luôn ghi `false`; tên trùng ⇒ 409; publish `CustomerSourceCreated`.
3. `CustomerSourcesService.update`: chỉ ghi `name`/`description`/`sortOrder` (`active`, `isOther` không có trong cột ghi); không đổi gì ⇒ không ghi, không event; publish `CustomerSourceUpdated`.
4. `CustomerSourcesService.deactivate`: dòng `isOther` ⇒ 409; đã tắt ⇒ no-op; ngược lại `active: false`, publish `CustomerSourceDeactivated`. `reactivate` ngược lại (đang bật ⇒ trả nguyên, không event), publish `CustomerSourceReactivated`.

## Bất biến

| Bất biến | Nơi enforce | Test / guard canh |
|----------|-------------|-------------------|
| PK khách = SĐT E.164; chuẩn hoá CHỈ ở backend (`normalizeVnPhone`, `libphonenumber-js`), mọi đường đọc/ghi đi qua `normalizeOrThrow` | `domain/phone.ts`, `CustomersService` | `phone.spec.ts` (hội tụ/từ chối, số cố định hợp lệ), `customers.service.spec.ts` (payload ghi dùng `sdt` đã chuẩn hoá) |
| Một SĐT = một khách kể cả khi hai request song song: PK DB + dịch `P2002` ⇒ 409 | PK `customers.sdt`, `translateWriteError` | `customers.db.integration.spec.ts`, `customers.service.spec.ts` |
| Client không có logic SĐT (không regex, không chuẩn hoá) | màn web/mobile gửi chuỗi thô | `design-system/screens/customers.test.mjs` (nhóm h) |
| `sdt` không đổi được qua PATCH (400, không bị `whitelist` cắt im lặng) | `@IsAbsent` | `customers.e2e.spec.ts` |
| Field lạc loại khách ⇒ 400, kiểm trên bản ghi hiệu lực sau PATCH | `assertFieldsMatchType`, `FORBIDDEN_FIELDS` | `customers.service.spec.ts`, `customers.e2e.spec.ts` |
| Nguồn "Khác" nhận biết bằng cờ `isOther` (không so tên) và buộc `sourceNote`; chạy lại khi đổi nguồn | `assertSourceNote` | `customers.service.spec.ts`, `customer-sources.service.spec.ts` (đổi tên không làm rơi cờ) |
| Nguồn khách chỉ soft-delete (`active: false`), không có đường xoá cứng ở đâu trong `src/` | `CustomerSourcesService.deactivate`, FK `ON DELETE RESTRICT` | `backend/test/no-hard-delete-customer-source.spec.ts` (source-guard), `customer-sources.db.integration.spec.ts` (P2003 thật) |
| Đúng một dòng `isOther`, không tắt được; API không có đường tạo dòng `isOther` thứ hai | partial unique index `customer_sources_single_is_other`, service ghi `isOther: false`, seed | `customer-sources.db.integration.spec.ts`, `customer-sources.service.spec.ts`, `customer-sources.e2e.spec.ts` |
| Đọc nguồn khách cần `customers.manage`, ghi cần `settings.manage` (cố ý khác nhau) | decorator `CustomerSourcesController` | `customer-sources.e2e.spec.ts` |
| Event publish SAU commit; ghi hỏng ⇒ không event | các service | `customers.service.spec.ts`, `customer-sources.service.spec.ts`, e2e (audit thật) |
| Fake port nguồn khách theo đúng luật backend (thứ tự, cờ `isOther`, xoá mô tả) | `FakeCustomerSourcesPort` | `design-system/session/fake-customer-sources-port.test.mjs` |

Ghi chú: `loadSourceOrThrow` chỉ kiểm nguồn TỒN TẠI, không kiểm `active` — nguồn đã tắt chỉ bị rút khỏi dropdown
của khách mới (đọc `GET /customer-sources` mặc định chỉ trả nguồn đang bật).

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/customers/customers.controller.ts` | Route khách hàng | `CustomersController` (`create`, `list`, `lookup`, `findOne`, `update`) |
| `backend/src/customers/customer-sources.controller.ts` | Route nguồn khách (hai gate) | `CustomerSourcesController` (`findAll`, `create`, `update`, `deactivate`, `reactivate`) |
| `backend/src/customers/customers.module.ts` | Module (imports rỗng có chủ đích) | `CustomersModule` |
| `backend/src/customers/customers.service.ts` | CRUD khách, chuẩn hoá SĐT, luật loại/nguồn | `CustomersService` |
| `backend/src/customers/customer-sources.service.ts` | CRUD nguồn, soft-delete, bảo vệ `isOther` | `CustomerSourcesService` |
| `backend/src/customers/domain/phone.ts` | Chuẩn hoá SĐT + needle tìm kiếm | `normalizeVnPhone`, `phoneSearchNeedle` |
| `backend/src/customers/domain/customer-type.ts` | Registry loại khách | `CUST_TYPE`, `CUST_TYPES`, `FORBIDDEN_FIELDS`, `CustType` |
| `backend/src/customers/domain/customer-events.ts` | Event khách | `CustomerCreated`, `CustomerUpdated` |
| `backend/src/customers/domain/customer-source-events.ts` | Event nguồn | `CustomerSourceCreated`, `CustomerSourceUpdated`, `CustomerSourceDeactivated`, `CustomerSourceReactivated` |
| `backend/src/customers/dto/create-customer-request.dto.ts`, `backend/src/customers/dto/update-customer-request.dto.ts` | Body khách | `CreateCustomerRequestDto`, `UpdateCustomerRequestDto` |
| `backend/src/customers/dto/list-customers-query.dto.ts`, `backend/src/customers/dto/lookup-customer-query.dto.ts` | Query danh sách / tra SĐT | `ListCustomersQueryDto`, `LookupCustomerQueryDto` |
| `backend/src/customers/dto/customer-response.dto.ts`, `backend/src/customers/dto/customer-list-response.dto.ts`, `backend/src/customers/dto/customer-lookup-response.dto.ts` | Response khách | `CustomerResponseDto`, `CustomerListResponseDto`, `CustomerLookupResponseDto` |
| `backend/src/customers/dto/create-customer-source-request.dto.ts`, `backend/src/customers/dto/update-customer-source-request.dto.ts`, `backend/src/customers/dto/customer-source-response.dto.ts` | Body/response nguồn | `CreateCustomerSourceRequestDto`, `UpdateCustomerSourceRequestDto`, `CustomerSourceResponseDto` |
| `backend/src/customers/dto/customer-source-limits.ts` | Trần `sortOrder` (int4) | `SORT_ORDER_MAX` |
| `backend/src/customers/dto/is-absent.decorator.ts` | Field có mặt là sai (dùng cho `sdt` khi PATCH) | `IsAbsent` |
| `backend/prisma/migrations/20260713020000_add_customers_and_customer_sources/migration.sql` | Bảng `customer_sources`, `customers` (PK `sdt`, FK `source_id`) | — |
| `backend/prisma/migrations/20260714000000_customer_source_single_isother/migration.sql` | Partial unique index `customer_sources_single_is_other` | — |
| `web/src/screens/customers/CustomerListScreen.tsx` | Màn danh sách khách web | `CustomerListScreen` |
| `web/src/screens/customers/CustomerDetailScreen.tsx` | Màn chi tiết khách web | `CustomerDetailScreen` |
| `web/src/screens/customers/CustomerPickScreen.tsx` | Tra SĐT / tạo khách tại chỗ | `CustomerPickScreen`, `CustomerFacts`, `typeLabel`, `orDash` |
| `web/src/screens/customers/customers.css` | Style màn khách | — |
| `web/src/screens/settings/CustomerSourceConfigScreen.tsx` (shared với `system-settings`) | Màn Cấu hình: nguồn khách + thuế suất VAT (web-only) | `CustomerSourceConfigScreen` |
| `web/src/screens/settings/settings.css` (shared) | Style màn Cấu hình | — |
| `web/src/design-system/session/customers-port.ts` | Port khách | `CustomersPort` (`lookup`, `list`, `get`, `create`, `listSources`), `CustomerPortError` |
| `web/src/design-system/session/customer-sources-port.ts` | Port cấu hình nguồn | `CustomerSourcesPort` (`list`, `create`, `update`, `deactivate`, `reactivate`), `CustomerSourcePortError` |
| `web/src/design-system/session/fake-customers-port.ts`, `web/src/design-system/session/fake-customer-sources-port.ts` | Fake port + dữ liệu demo | `FakeCustomersPort`, `DEMO_CUSTOMERS`, `DEMO_CUSTOMER_SOURCES`, `FakeCustomerSourcesPort`, `DEMO_CUSTOMER_SOURCE_ROWS` |
| `mobile/lib/screens/customers/customer_list_screen.dart`, `mobile/lib/screens/customers/customer_detail_screen.dart`, `mobile/lib/screens/customers/customer_pick_screen.dart` | Ba màn khách mobile | `CustomerListScreen`, `CustomerDetailScreen`, `CustomerPickScreen`, `CustomerFacts` |
| `mobile/lib/design_system/session/customers_port.dart` | Port khách mobile | `CustomersPort`, `CustomerPortException` |
| `mobile/lib/design_system/session/fake_customers_port.dart` | Fake port mobile | `FakeCustomersPort` |

Port client chưa có thao tác sửa khách (`PATCH`); `CustomerDetailScreen` web chỉ nhận callback `onEdit`.

## Dữ liệu

- Bảng ghi/đọc: `customers` (PK `sdt`), `customer_sources` (unique `name`, partial unique `is_other`).
- Seed: `backend/prisma/seed.ts` tạo danh mục nguồn ban đầu với đúng một dòng `isOther` (ngoài flow này).
- Bảng dùng bởi flow khác: `orders` FK tới `customers` và `customer_sources`.
- Sự kiện phát: `CustomerCreated`, `CustomerUpdated`, `CustomerSourceCreated`, `CustomerSourceUpdated`,
  `CustomerSourceDeactivated`, `CustomerSourceReactivated` — qua `EventBus` sau commit; `AuditSubscriber` ghi `audit_logs`.
- Gọi ngoài: không có (chuẩn hoá SĐT dùng thư viện `libphonenumber-js` tại chỗ).

## Flow liên quan

- orders: báo giá chọn khách qua `CustomerPickScreen` / `CustomersPort`; đơn tham chiếu khách và nguồn khách; tra bảo hành theo SĐT dùng lại `normalizeVnPhone`.
- system-settings: chung màn `CustomerSourceConfigScreen` (khung Thuế suất VAT) và `settings.css`.
- accounts-permissions: key `customers.manage`, `settings.manage`.
- auth-session: JWT, `PermissionsGuard`, `@RequirePermissions`.
- domain-events-audit: `EventBus`, `AuditSubscriber`.
- backend-platform: `PrismaService`, `AppException` / error envelope, `ValidationPipe` (`whitelist`).
- design-system: component, shell, gating; text-guard trong `design-system/screens/`.

## Tests

Backend, hermetic (`npm test`):

- `backend/test/phone.spec.ts`: `normalizeVnPhone` hội tụ mọi dạng thô về một E.164, từ chối rác/số ngoài VN, chấp nhận số cố định; `phoneSearchNeedle` bỏ `0` đầu.
- `backend/test/customers.service.spec.ts`: assert toàn bộ payload ghi (PK đã chuẩn hoá), luật loại khách trên bản hiệu lực, luật `isOther`/`sourceNote`, `P2002` ⇒ 409, ghi hỏng ⇒ không event, `list` dùng needle.
- `backend/test/customer-sources.service.spec.ts`: payload ghi, `isOther` luôn `false` khi tạo, đổi tên giữ cờ, PATCH không đổi gì ⇒ không ghi, không tắt được dòng `isOther`, tắt/bật lại idempotent.
- `backend/test/customers.e2e.spec.ts`: thiếu `customers.manage` ⇒ 403 mọi route, SĐT rác / `null` trên cột NOT NULL ⇒ 400 không chạm DB, `sdt` trong body PATCH ⇒ 400, audit thật.
- `backend/test/customer-sources.e2e.spec.ts`: hai gate (4 route ghi cần `settings.manage`, `GET` cần `customers.manage`), `isOther`/`active` trong body bị cắt, `:id/reactivate` không bị nuốt, audit thật.

Backend, lane DB (`*.db.integration.spec.ts`, tự skip khi không có `DATABASE_URL`; chạy `npm run test:db`):

- `backend/test/customers.db.integration.spec.ts`: migration đã áp, seed đủ 5 nguồn và chạy lại không nhân đôi, unique `customer_sources.name`, PK `sdt` ném `P2002`, FK `source_id` ném `P2003`, rollback giữa tx; tìm `0903` ra `+84903…`, `insensitive` với tiếng Việt, `q` chỉ chữ không thành `contains ''`, `total`/phân trang đúng, `lookup` bằng dạng thô.
- `backend/test/customer-sources.db.integration.spec.ts`: đúng một dòng `isOther` sau seed và DB từ chối dòng thứ hai; xoá cứng nguồn đang có khách ⇒ FK RESTRICT.

Backend, source-guard:

- `backend/test/no-hard-delete-customer-source.spec.ts`: không có `customerSource.delete`/`deleteMany` ở bất kỳ đâu trong `src/` (quét sau `stripToCode`).

Design-system (`node --test`):

- `design-system/screens/customers.test.mjs`: cả hai nền tảng có đủ ba màn, chỉ dùng component design-system, transport chỉ qua port tiêm, nhãn tiếng Việt giống từng byte, không literal quyền, không dữ liệu đơn hàng, không logic SĐT phía client.
- `design-system/screens/settings-customer-sources.test.mjs`: màn Cấu hình nguồn khách (web-only) dùng component barrel, port-only, shell + sidebar lọc quyền, copy đúng bảng SSOT, không tab VAT, không có đường tắt dòng `isOther`.
- `design-system/session/fake-customer-sources-port.test.mjs`: chạy thật `FakeCustomerSourcesPort` và giữ nó theo đúng luật của service backend.

Flutter widget test:

- `mobile/test/screens/customers/customer_screens_test.dart`: tra trượt hiện đúng câu trống, mỗi loại khách chỉ hiện field của mình, lỗi backend hiện đúng lời backend, trạng thái lỗi danh sách/chi tiết.

Web: flow không có file vitest riêng; ba màn khách và `CustomerSourceConfigScreen` chỉ có ca smoke render trong
`web/src/test/screens-render.test.tsx` (flow `design-system`). Header của hai text-guard design-system còn ghi "web
chưa có tsc/JSDOM (TD-1)" — đã lỗi thời từ khi TD-1 được trả (xem `_bmad-output/project-context.md`).
