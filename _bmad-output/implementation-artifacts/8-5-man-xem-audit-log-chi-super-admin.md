---
baseline_commit: 1089f757332eb68de76d3f3e91da9a13837d519f
---

# Story 8.5: Màn xem Audit log (gate theo quyền `audit.read`, không theo role)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a người có quyền `audit.read`,
I want xem nhật ký Audit bất biến,
so that có bằng chứng minh bạch mọi hành động.

## Acceptance Criteria

1. **Đọc audit (FR-20, AD-8):** `GET /audit-logs` trả từng bản ghi với đủ 5 chiều: **ai** (`actorAccountId` + `actorDisplayName`; cả hai `null` = hệ thống tự chạy), **làm gì** (`eventType` + `eventLabel` tiếng Việt), **đối tượng** (`targetType` + `targetId`, có thể `null`), **khi nào** (`occurredAt` ISO-8601 UTC, client hiển thị giờ VN), **trước→sau** (`changes: { field, before, after }[]`). Sắp mới nhất trước (`occurredAt desc, id desc`), phân trang `page`/`pageSize` (mặc định 20, trần 100) + `total`.
2. **Bất biến:** không có endpoint/handler nào sửa/xoá audit (chỉ `GET`); guard `audit-log-append-only.spec.ts` vẫn xanh; web/mobile không có nút sửa/xoá trên màn Audit.
3. **Gate theo QUYỀN, không theo role (FR-20, UX-DR-22, AD-4):** endpoint gate `@RequirePermissions(PERM.auditRead)`, quyền đọc FRESH từ DB mỗi request. Account thiếu `audit.read` ⇒ 403 — kể cả account có `settings.manage` và account có MỌI quyền khác của preset `ADMIN` (đường đỏ spine). Nav web (sidebar mục "Audit") và Menu mobile chỉ hiện khi có `audit.read`; route `/audit` gate cùng dữ liệu nav (không bảng quyền thứ hai). Không chuỗi nào trên màn nói "chỉ Super Admin".
4. **Cấp quyền (FR-20, AC-3 cũ, AD-21):** `audit.read` vẫn chỉ nằm sẵn trong preset `SUPER_ADMIN`; account có `audit.read` cấp được nó cho account bất kỳ qua màn Phân quyền 8.2 ⇒ account đó mở được `GET /audit-logs`; account KHÔNG có `audit.read` cấp nó ⇒ 403 (luật không-leo-thang giữ nguyên). Nhãn quyền trong registry đổi từ `'Xem Audit log (Super Admin)'` thành `'Xem Audit log'` (nhãn không gắn role).
5. **Bộ lọc (FR-20):** query `targetType` (một trong 9 loại đối tượng đang phát event), `from`/`to` (`YYYY-MM-DD`, ngày VN, hai đầu tính cả; lọc trên `occurredAt` theo khoảng nửa mở UTC+7). `from > to` ⇒ 400 `fieldErrors.to`; sai định dạng/giá trị lạ ⇒ 400 câu tiếng Việt.
6. **Màn web + mobile parity (FR-20, UX `s-audit`):** web `/audit` dùng `Table` (cột Ai · Hành động · Đối tượng · Trước → Sau · Thời gian) + bộ lọc đối tượng (seg/chip "Tất cả" + 9 loại) + hai ô ngày + phân trang; mobile mở qua Menu → "Audit log" (`/audit`), danh sách card cùng thông tin + cùng bộ lọc + phân trang, dựng bằng Cubit. Đủ trạng thái loading (skeleton) / rỗng / lỗi có thử lại.

## Tasks / Subtasks

- [x] **T1 — Backend domain thuần (AC: 1, 5)**
  - [x] `backend/src/audit/domain/audit-event-labels.ts`: `AUDIT_EVENT_LABELS: Readonly<Record<string, string>>` cho đủ **47** event type đang có (danh sách ở Dev Notes) + `auditEventLabel(type)` trả nhãn hoặc chính `type` khi lạ (bản ghi cũ/tương lai không vỡ).
  - [x] `backend/src/audit/domain/audit-target-types.ts`: `AUDIT_TARGET_TYPES = ['Order','Account','Product','ProductGroup','Customer','CustomerSource','StockVoucher','FeatureFlag','SystemSetting'] as const`.
  - [x] `backend/src/audit/domain/audit-changes.ts`: `auditChanges(before: unknown, after: unknown): AuditChange[]` — hàm thuần (luật ở Dev Notes "Trước → Sau").
  - [x] Unit `backend/test/audit-changes.spec.ts` + `backend/test/audit-event-labels.spec.ts`. Test nhãn **quét `src/**/domain/*.ts` tìm `readonly type = '…'`** ⇒ mọi type có nhãn (chống-guard-rỗng: tìm thấy ≥ 47). Test target types quét `target = { type: '…'` / `type: '…', id` trong `src/**/domain/*.ts` ⇒ tập tìm thấy ⊆ `AUDIT_TARGET_TYPES` và bằng nhau (chống rỗng ≥ 9).
- [x] **T2 — Migration index (AC: 1, 5)**
  - [x] `schema.prisma` `AuditLog` thêm `@@index([occurredAt])`; migration `backend/prisma/migrations/<ts>_add_audit_logs_occurred_at_index/migration.sql` (chỉ `CREATE INDEX`, comment tiếng Anh). Prisma 7: `migrate diff --from-schema/--to-schema` (memory `prisma7-migrate-diff-flag-rename`).
- [x] **T3 — Backend đọc + endpoint (AC: 1, 2, 3, 5)**
  - [x] `backend/src/audit/audit-log-read.service.ts` (`AuditLogReadService.list(query)`): `where` từ `targetType` + khoảng `vietnamRangeToInstants` (tái dùng `backend/src/dashboard/domain/dashboard-period.ts` — KHÔNG viết lại); `findMany` + `count` trong cùng `$transaction` (khuôn `OrderListResponseDto`); sau đó **một** `account.findMany({ where: { id: { in: distinctActorIds } }, select: { id, displayName } })` để gắn tên (KHÔNG N+1). `AuditService` giữ nguyên chỉ `record` (không thêm đọc vào service ghi).
  - [x] DTO: `dto/list-audit-logs-query.dto.ts` (`targetType?` `@IsIn(AUDIT_TARGET_TYPES)`, `from?`/`to?` `@IsISO8601({strict:true})` + `@Matches(/^\d{4}-\d{2}-\d{2}$/)` với câu tiếng Việt như `record-payment-request.dto.ts:54-56`, `page`/`pageSize` y hệt `list-orders-query.dto.ts`); `dto/audit-log-list-response.dto.ts`; `dto/audit-log-entry.dto.ts`; `dto/audit-change.dto.ts`. Mọi field `string | null` khai `type: String, nullable: true` (guard `openapi-no-untyped-object`). Field tiếng Anh.
  - [x] `from > to` ⇒ `new AppException(ErrorCode.VALIDATION_ERROR, 400, …, [{ field: 'to', code: …, message: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.' }])` (khuôn `account-permissions.service.ts:103`).
  - [x] `backend/src/audit/audit.controller.ts`: `@Controller('audit-logs')`, `@Get()` + `@RequirePermissions(PERM.auditRead)` + `@ApiOkResponse/@ApiBadRequestResponse/@ApiForbiddenResponse` (khuôn `dashboard.controller.ts`). `AuditModule` thêm controller + `AuditLogReadService`; vẫn KHÔNG export gì.
  - [x] `npm run openapi:gen` ⇒ `backend/openapi/openapi.json`.
  - [x] Test: `backend/test/audit-log-read.service.spec.ts` (where/orderBy/skip/take, khoảng ngày, gắn tên actor 1 query, actor null, account không còn ⇒ tên null nhưng id giữ), `backend/test/audit-logs.e2e.spec.ts` qua `initAppOnLoopback` (200 với `audit.read`; 403 với preset `ADMIN` đầy đủ; 403 chỉ `settings.manage`; 400 `from > to`, `targetType=Foo`, `pageSize=101`, `from=2026-13-01`; không có route PATCH/PUT/DELETE `audit-logs` ⇒ 404), `backend/test/audit-logs.db.integration.spec.ts` (Postgres thật: ranh giới ngày VN 23:59:59+07 vs 00:00+07 ngày sau; thứ tự `occurredAt desc, id desc` khi trùng giờ; lọc targetType; `total` đúng khi nhiều trang).
- [x] **T4 — Cấp quyền (AC: 4)**
  - [x] `permission-registry.ts:88` label → `'Xem Audit log'`; `npm run permissions:gen` (sinh lại PERM web + `AppPermissionKeys` mobile nếu output đổi); sửa chuỗi nhãn ở fake/test web + mobile (`web/src/test/permissions-screen.test.tsx:311`, `mobile/test/screens/permissions/account_permissions_screen_test.dart:344-347`, fake ports nếu có).
  - [x] e2e trong `audit-logs.e2e.spec.ts` (hoặc `accounts-permissions.e2e.spec.ts`): actor có `audit.read` + `permissions.manage` cấp `audit.read` cho account thợ ⇒ 200, account thợ gọi `GET /audit-logs` ⇒ 200; actor `ADMIN` (không `audit.read`) cấp ⇒ 403. Không thêm entry `PERMISSION_REQUIRES`/`PERMISSION_REQUIRES_ANY` cho `audit.read` (màn Audit không cần quyền đọc nào khác).
- [x] **T5 — Web (AC: 3, 6)**
  - [x] `npm run api:gen` ⇒ `web/src/api/generated/schema.d.ts`.
  - [x] Port `web/src/design-system/session/audit-logs-port.ts` (type = alias type sinh; method `listAuditLogs(query)`), `fake-audit-logs-port.ts` (seed thật: actor null, targetType null, nhiều trang, change status), export ở `session/index.ts`; adapter `web/src/api/http-audit-logs-port.ts`; ráp ở `web/src/main.tsx` (composition root duy nhất).
  - [x] `NAV_ROUTES.audit = '/audit'` (`web/src/app/routes.ts`) — mục `audit` trong `SIDEBAR_NAV` (`Sidebar.tsx:114`, `requires: PERM.auditRead`) có sẵn, KHÔNG sửa; route trong `AppRoutes.tsx`.
  - [x] `web/src/screens/audit/AuditLogScreen.tsx` (+ `audit.css` chỉ token) — Table, seg đối tượng, 2 `Field type="date"`, phân trang khuôn `OrdersListScreen.tsx`; `Banner` "Bản ghi bất biến — chỉ đọc, không sửa/xoá." (KHÔNG chữ "Super Admin"); KHÔNG nút "Xuất CSV" (xem Quyết định).
  - [x] Test: `web/src/test/audit-log-screen.test.tsx` (render hàng; actor null ⇒ "Hệ thống"; status qua `STATUS_LABELS`; đổi filter gửi đúng query + về trang 1; lỗi + thử lại; rỗng), `http-audit-logs-port.test.ts`, ca render trong `screens-render.test.tsx`, cập nhật `app-routes.test.tsx` (audit hiện với `audit.read`, ẩn khi thiếu — dòng 98 giữ đúng), `composition-root.test.ts` nếu nó liệt kê port.
- [x] **T6 — Mobile Cubit (AC: 3, 6)**
  - [x] `cd mobile && dart run tool/generate_api.dart` (client sinh); `mobile/lib/design_system/session/{audit_logs_port,fake_audit_logs_port}.dart` (typedef = DTO sinh); `mobile/lib/api/http_audit_logs_port.dart`; `AppPorts.auditLogs` + ráp ở `main.dart`.
  - [x] Menu: `kMobileMenu` thêm `AppNavLink(key: 'audit', label: 'Audit log', subtitle: 'Nhật ký bất biến', icon: 'ic-audit', requires: AppPermissionKeys.auditRead)` trước `profile` (thứ tự mockup `s-menu`); `kAuditPath = '/audit'` + `kNavRoutes['audit']` (`app_routes.dart`); route ở `signed_in_app.dart`.
  - [x] `mobile/lib/screens/audit/{audit_log_screen,audit_log_cubit,audit_log_state}.dart` — chỉ cubit gọi port; state `final class` + `Equatable`; controller ô ngày ở `State`.
  - [x] Test: `mobile/test/screens/audit/audit_log_cubit_test.dart` (bloc_test: ca đầu / thành công / lỗi port / đóng sớm cả nhánh thành công lẫn lỗi; đổi filter về trang 1; vé cũ bị bỏ — fake trả KHÁC nhau mỗi lần; seed mọi field khác mặc định; kỳ vọng field-by-field bằng constructor), `audit_log_screen_test.dart` (render, actor null, tháo màn khi port chờ, wiring màn↔cubit), `mobile/test/api/http_audit_logs_port_test.dart`, cập nhật `app_routes_test.dart` + `signed_in_app_test.dart` + harness (`test/app/support/app_harness.dart`) cho port mới.
- [x] **T7 — Design-system guard (AC: 3, 6)**
  - [x] `design-system/screens/audit-log.test.mjs`: (a) màn web + mobile (qua `readMobileScreen`, đọc cả cubit/state) KHÔNG chứa chuỗi "Super Admin"; (b) nhãn loại đối tượng web ↔ mobile **bằng nhau** (parse map hai bên, chống rỗng = 9 entry) và khớp `AUDIT_TARGET_TYPES` backend; (c) nhãn trạng thái chỉ qua map StatusChip (tái dùng khuôn `permissions.test.mjs`); (d) không gọi `.toLocaleString`/`Intl` cho thời gian. Mỗi assert có đột biến ĐỎ ghi trong Completion Notes.
  - [x] `menu-nav-parity.test.mjs` phải xanh với entry `audit` mới (key/requires khớp web).
- [x] **T8 — Tài liệu + lane (mọi AC)**
  - [x] `epics.md` Story 8.5 thêm khối "_Quyết định giữa story (2026-10-30, Story 8.5)_" chép các quyết định ở Dev Notes; spine dòng 195 "đọc chỉ Super Admin" → "đọc theo quyền `audit.read`" (cùng commit, luật 11).
  - [x] 5 lane: backend `npm test` + `npm run test:db` (`npx prisma migrate deploy` trước), design-system `npm test`, web `npm run typecheck && npm test && npm run build`, mobile `flutter analyze && flutter test`.
  - [x] Smoke web + emulator (luật 13, 17, 18): account smoke có `audit.read` thấy mục Audit, lọc theo Đơn + khoảng ngày; account smoke thiếu quyền không thấy mục, gõ `/audit` ⇒ về landing; curl `GET /audit-logs` thiếu quyền ⇒ 403.

## Dev Notes

### Luật dự án (Trợ Lý, Epic 8) — bắt buộc

Đọc nguyên văn `_bmad-output/story-automator/extra-instructions-8-review.txt` (luật 1–20). Với story này nổi bật:
- (3) màn web mới ⇒ ca `screens-render.test.tsx`; (4) màn mobile mới ⇒ widget test; (5) guard mới có chống-guard-rỗng; (6) e2e qua `initAppOnLoopback`; (7) không push, `git add` đường dẫn cụ thể; (8) code/comment/tên test tiếng Anh, chỉ chuỗi UI/lỗi tiếng Việt; (11) quyết định giữa story → `epics.md` + spine cùng commit; (13) smoke đăng nhập thật bằng account smoke riêng, JWT secret tạm trên dòng lệnh, KHÔNG đọc `.env`; (17) chỉ kill PID/serial của mình; (18) Cubit + bloc_test checklist + đột biến guard "màn không gọi port" trên màn mới; (19) key quyền chỉ từ registry, `permissions:gen` khi đổi registry, giữ không-leo-thang, gate theo quyền.
- Luật (1)(2)(9)(20) không áp: story CHỈ ĐỌC, không ghi đơn/tồn/tiền, không publish event.

### Quyết định phạm vi (đọc trước khi code — chép vào `epics.md`)

- **Một endpoint đọc:** `GET /audit-logs?targetType&from&to&page&pageSize`. Không endpoint chi tiết, không lọc theo actor/targetId, không tìm kiếm tự do. Ô "Lọc theo account, đối tượng…" và nút **"Xuất CSV"** trong mockup KHÔNG có AC ⇒ bỏ (YAGNI); muốn thì là story riêng.
- **Nhãn hành động ở backend (`eventLabel`), nhãn loại đối tượng ở client:** 47 event type là tri thức backend (một nguồn, test quét source đảm bảo đủ); 9 loại đối tượng cần nhãn TRƯỚC khi có dữ liệu (chip lọc) ⇒ map ở web + mobile, guard parity T7(b).
- **"Trước → Sau" là diff phẳng do backend tính** (`changes`), client chỉ hiển thị. Không trả JSON thô (`Json` reflect thành `type: object` trần ⇒ guard `openapi-no-untyped-object` đỏ và client sinh vô dụng). Luật `auditChanges`:
  - Cả hai bên là object thường (không mảng): hợp khoá theo thứ tự khoá của `after` rồi khoá chỉ có ở `before`; giữ khoá khi `JSON.stringify` hai bên khác nhau hoặc một bên vắng.
  - Một bên `undefined`/`null`, bên kia object ⇒ mọi khoá của bên có (bên kia `null`) — event "tạo"/"xoá".
  - Không phải object (mảng/scalar) ⇒ một dòng `field: ''`.
  - Giá trị → chuỗi: string giữ nguyên; number/boolean `String(v)`; `null`/vắng ⇒ `null`; object/mảng ⇒ `JSON.stringify`. Cắt ở **500** ký tự + `…` (bản đầy đủ vẫn trong DB).
  - **TIỀN PHẢI QUA FORMATTER (Trợ Lý sửa mặc định, 2026-10-30 — Đại Ca đã chốt '83.010.960 đ' cho MỌI màn web+mobile, không ngoại lệ):** mỗi dòng `changes` có thêm `isMoney: boolean` do backend gắn khi `field` thuộc tập tên field tiền (một hằng backend, vd `AUDIT_MONEY_FIELDS`), giá trị tiền giữ chuỗi số nguyên thô trong contract; client hiện qua formatter/Money có sẵn (`83.010.960 đ`) khi `isMoney` và giá trị là số nguyên hợp lệ, không thì hiện nguyên. Tập backend phải ⊇ tập `design-system/money/money-fields.mjs` — thêm guard design-system so hai tập (chống-guard-rỗng; đột biến bỏ một tên ⇒ ĐỎ). Guard tiền (money-render-guard) phải phủ màn Audit web + mobile. Client: khi `field === 'status'` và giá trị là khoá trạng thái đã biết ⇒ hiện nhãn qua `STATUS_LABELS`/`kStatusLabels`; khoá khác hiện nguyên.
- **Ai:** `actorAccountId` null ⇒ client hiện "Hệ thống". Account không còn (không có đường xoá account, nhưng cột không FK) ⇒ `actorDisplayName: null`, client hiện id.
- **Đối tượng:** hiện nhãn loại + `targetId` (`.mono`, web rút gọn 8 ký tự đầu cho UUID; Customer là SĐT E.164 hiện đủ). KHÔNG tra tên/mã đối tượng (9 bảng khác nhau — story riêng nếu cần).
- **Giờ:** `occurredAt` (thời điểm nghiệp vụ), không `createdAt`. Client hiển thị giờ VN bằng helper CÓ SẴN: web `ngayGio()`/`ngayNgan()` ở `web/src/screens/inventory/format-gio.ts:26,32` (import, không viết lại); mobile twin `ngayGio()`/`ngayNgan()` top-level public ở `mobile/lib/screens/inventory/stock_vouchers_screen.dart:60,68` — import được; nếu thấy import chéo màn khó đọc thì tách sang file chung cùng thư mục, giữ nguyên hành vi (test cũ xanh). CẤM `toLocaleString`/`Intl`.
- **Không thêm key quyền.** Đổi nhãn `audit.read` thôi (AC 4).
- **Index `occurred_at`:** màn sắp + lọc trên cột này; bảng tăng theo MỌI hành động ⇒ thêm index (khác dashboard 8.1 đã hoãn index).

### 47 event type cần nhãn (đọc từ `readonly type = '…'`, 2026-10-30)

`CustomerSourceCreated/Updated/Deactivated/Reactivated`, `CustomerCreated/Updated`, `SystemSettingChanged`, `DepositRecorded`, `PaymentRecorded`, `PaymentScheduleConfigured`, `InvoiceCreated`, `InvoicePdfExported`, `PasswordResetRequested/Completed`, `PasswordChanged`, `ContractGenerated`, `ProductGroupCreated/Updated/Deactivated/Reactivated/ItemsReplaced`, `ProductCreated/Updated/Deactivated`, `ProductPricesReplaced`, `FeatureFlagToggled`, `AccountCreated/Updated/PermissionsChanged`, `StockIssued`, `StockVoucherCreated`, `StockOutBlocked`, `OrderCreated`, `OrderLineAdded/Updated/Removed`, `OrderScopeChanged`, `OrderMetaChanged`, `OrderConfirmed`, `OrderRevised`, `DiscountRequested/Resolved`, `QuoteExported`, `StatusChanged`, `AttachmentAdded/Removed`, `OrderCancelled`. Nhãn theo mockup khi có ("Chốt đơn", "Duyệt chiết khấu", "Sửa giá" cho `ProductPricesReplaced`, "Ghi nhận thanh toán", "Xuất kho" cho `StockIssued`, "Sửa quyền account" cho `AccountPermissionsChanged`); còn lại tự đặt tiếng Việt ngắn. Đếm lại bằng test, KHÔNG tin con số này nếu source đã đổi.

### Trạng thái hiện tại các file sẽ sửa (đã đọc)

- `backend/src/audit/audit.service.ts`: chỉ `record(event)` → `auditLog.create` với `toJsonInput`. **Giữ nguyên.** Doc dòng 13-14 hẹn đọc ở 8.5 — cập nhật câu đó trỏ sang `AuditLogReadService`.
- `backend/src/audit/audit.module.ts`: `providers: [AuditService, AuditSubscriber]`, không export (guard AD-18 cấm producer inject audit). Thêm `controllers: [AuditController]`, provider `AuditLogReadService`; vẫn không export. Kiểm `no-direct-side-effect-outside-eventbus.spec.ts` không coi controller trong chính `audit/` là vi phạm (đọc guard trước).
- `backend/prisma/schema.prisma:82-96` `AuditLog`: index `actorAccountId`, `(targetType,targetId)`; không index `occurredAt`. `actorAccountId` String không FK (snapshot sống sót khi account đổi).
- `backend/test/audit-log-append-only.spec.ts`: cấm `auditLog.update*/delete*/upsert` + raw SQL UPDATE/DELETE `audit_logs`. Service đọc dùng `findMany`/`count` — hợp lệ. KHÔNG nới guard.
- `backend/src/accounts/domain/permission-registry.ts:32,88`: `auditRead: 'audit.read'`, label `'Xem Audit log (Super Admin)'`, group `audit`. `role-presets.ts:55`: chỉ `SUPER_ADMIN` có `audit.read` — test `role-presets.spec.ts` canh, giữ nguyên.
- `backend/test/permission-escalation.spec.ts:38-133`: đã phủ `audit.read` ở mức domain (thiếu ⇒ không cấp được/không sửa account mang nó). T4 chỉ thêm ca e2e đầu-cuối.
- `web/src/design-system/shell/Sidebar.tsx:114`: `{ key: 'audit', icon: 'ic-audit', label: 'Audit', requires: PERM.auditRead }` có sẵn, đang ẩn vì `AVAILABLE_NAV_KEYS` (= khoá của `NAV_ROUTES`) chưa có `audit`. Guard `design-system/components/gating.test.mjs:98-126` canh dòng này — không sửa.
- `web/src/app/routes.ts:12-21` `NAV_ROUTES`; `landingPath` = route mở được đầu tiên theo thứ tự sidebar — `audit` đứng sau `permissions` nên không đổi landing của ai.
- `mobile/lib/design_system/shell/app_menu_nav.dart`: `kMobileMenu` = customers, warranty, permissions, profile. Comment đầu file: chỉ entry có màn mới được liệt kê; key/requires phải khớp web (guard `menu-nav-parity.test.mjs`).
- `mobile/lib/app/app_routes.dart`: `kNavRoutes` chưa có audit; `isOpenable` gate qua `openableKeys` — thêm `'audit': kAuditPath` là đủ, KHÔNG thêm `subRoutePermission`.
- `mobile/lib/app/app_ports.dart:19-49`: 13 port; thêm `auditLogs` ⇒ mọi chỗ dựng `AppPorts` (main.dart, test harness, `signed_in_app_test`) phải cập nhật.
- Mockup `ux-designs/…/mockups/all-screens.html:4989-5080` (`s-audit`): web topbar eyebrow "QUẢN TRỊ", banner teal, toolbar seg, `table` 5 cột `.mono`, notecard; mobile card mỗi bản ghi (tên đậm + pill hành động + giờ phải; dòng 2 đối tượng · trước→sau). Banner mockup ghi "Chỉ Super Admin…" — **thay** bằng câu không role (AC 3).

### Kiến trúc phải tuân

- AD-1/AD-2: client chỉ hiển thị — diff, nhãn hành động tính ở backend. AD-4: backend enforce; ẩn nav chỉ là UX. AD-5: lỗi qua `AppException`/`createValidationPipe` (câu tiếng Việt; `isIn` đã có trong `BUILT_IN_MESSAGES`). AD-8: append-only. AD-12: OpenAPI sinh từ code, regen web + mobile cùng commit, cấm sửa tay. AD-13: chỉ component/token có sẵn (`Table`, `Field`, `Banner`, `Skeleton`, `EmptyState`, `ErrorState`, `Card`; Flutter `AppTable`/`AppCard`/`AppChip`/`AppField`…). AD-17: `PERM.auditRead` / `AppPermissionKeys.auditRead` (KHÔNG `AppPerm.x` ở màn mobile — memory `mobile-screens-use-apppermissionkeys-not-appperm`). AD-21: không leo thang.
- Path param: không có. Query DTO `@Type(() => Number)` cho `page`/`pageSize` bắt buộc.
- Guard `no-vietnamese-api-contract`: route `audit-logs`, field `items,total,page,pageSize,id,eventType,eventLabel,actorAccountId,actorDisplayName,targetType,targetId,occurredAt,changes,field,before,after`, query `targetType,from,to` — tiếng Anh. Description tiếng Việt OK.
- `money-fields.mjs` dùng `/đồng/i` trên description ⇒ KHÔNG viết chữ "đồng" (kể cả "hợp đồng") trong description DTO audit (memory `money-fields-dong-matches-hop-dong`). Kiểm `moneyFields()` không nhận field audit nào sau regen.

### Testing — bẫy đã biết (memory dự án)

- Mutation: backup `cp`, khôi phục `cp`+`cmp`, KHÔNG `git checkout`; mutant phải compile; không pipe lệnh mutant; grep chuỗi chèn trước khi tin "sống"; zsh không word-split `$VAR` lệnh.
- Đột biến bắt buộc: bỏ `@RequirePermissions(PERM.auditRead)` (đổi sang key khác compile được) ⇒ e2e ĐỎ; bỏ `+1 ngày` ở `toExclusive` (sửa tạm hàm dùng chung) ⇒ ca DB ranh giới ĐỎ; bỏ `id desc` tiebreak ⇒ ca DB trùng giờ ĐỎ; `auditChanges` bỏ nhánh "khoá chỉ ở before" ⇒ unit ĐỎ; xoá một nhãn event ⇒ test quét ĐỎ; bỏ `audit` khỏi `NAV_ROUTES`/`kNavRoutes` ⇒ test route ĐỎ; màn mobile gọi `widget.port…` ⇒ `no_port_call_in_screens_test` ĐỎ; chèn "Super Admin" vào màn ⇒ guard T7 ĐỎ.
- Gắn tên actor: test phải đo **số lần** gọi `account.findMany` (`toHaveBeenCalledTimes(1)`) — `mock.calls[0]` không bắt N+1 (memory `publish-count-unasserted-duplicate-survives`).
- Fixture số dẫn xuất (`total`, số trang) không gõ tay — in từ hàm thật/DB.
- e2e key-set: assert tập con khoá contract, không exact (mock rows bỏ cột nullable — memory `response-key-set-assert-mock-rows`).
- Web vitest: Node 24 `localStorage` che jsdom ⇒ `memoryStorage()`. Màn web có route ⇒ `.tsx` lỗi cú pháp vẫn có thể xanh ở guard text — typecheck + vitest render là lưới thật.
- Cubit: Equatable bỏ state trùng ⇒ fake trả khác nhau; `close` nhánh lỗi; `isClosed` sau await trong try là mutant tương đương; carry-over field sweep (xoá từng `x: state.x`) — kỳ vọng field-by-field. Một `pump()` sau tín hiệu có thể không đủ.
- Text-guard mobile đọc qua `readMobileScreen`; neo dương khớp câu lệnh, không khớp dòng khai báo/chuỗi con.
- Smoke: `npm run start` (không `node dist/main` — hook chặn chữ `dist`), lane DB xoá sạch `pns-postgres` ⇒ seed smoke SAU `test:db`; emulator cold boot `-no-snapshot`; `rm /sdcard/ui.xml` trước mỗi dump; bật lại `verifier_verify_adb_installs` nếu tắt. Smoke cần dữ liệu audit: đăng nhập + thao tác (vd đổi mật khẩu, sửa quyền) sinh bản ghi thật — KHÔNG insert audit giả bằng SQL.

### Project Structure Notes

- Mới backend: `src/audit/{audit.controller.ts,audit-log-read.service.ts}`, `src/audit/domain/{audit-event-labels,audit-target-types,audit-changes}.ts`, `src/audit/dto/{list-audit-logs-query,audit-log-list-response,audit-log-entry,audit-change}.dto.ts`, migration `…_add_audit_logs_occurred_at_index`, test `audit-changes.spec.ts`, `audit-event-labels.spec.ts`, `audit-log-read.service.spec.ts`, `audit-logs.e2e.spec.ts`, `audit-logs.db.integration.spec.ts`.
- Mới web: `src/screens/audit/{AuditLogScreen.tsx,audit.css}`, `src/design-system/session/{audit-logs-port,fake-audit-logs-port}.ts`, `src/api/http-audit-logs-port.ts`, `src/test/{audit-log-screen.test.tsx,http-audit-logs-port.test.ts}`.
- Mới mobile: `lib/screens/audit/{audit_log_screen,audit_log_cubit,audit_log_state}.dart`, `lib/design_system/session/{audit_logs_port,fake_audit_logs_port}.dart`, `lib/api/http_audit_logs_port.dart`, generated `lib/api/generated/**` (audit client + models), test `test/screens/audit/*`, `test/api/http_audit_logs_port_test.dart`.
- Mới design-system: `screens/audit-log.test.mjs`.
- Sửa: `backend/src/audit/{audit.module,audit.service}.ts`, `backend/prisma/schema.prisma`, `backend/src/accounts/domain/permission-registry.ts`, `backend/openapi/openapi.json` (sinh), output `permissions:gen` (nếu đổi), `web/src/{main.tsx,app/routes.ts,app/AppRoutes.tsx,design-system/session/index.ts,api/generated/schema.d.ts}`, `web/src/test/{screens-render,app-routes,permissions-screen}.test.tsx` (+ `composition-root.test.ts` nếu cần), `mobile/lib/{main.dart,app/app_ports.dart,app/app_routes.dart,app/signed_in_app.dart,design_system/shell/app_menu_nav.dart}`, `mobile/test/{app/*,screens/permissions/account_permissions_screen_test.dart}`, `epics.md`, spine dòng 195, `sprint-status.yaml`.
- `git check-ignore` mọi file mới trước khi add (memory `.gitignore assets/`, `.git/info/exclude`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.5] — AC gốc; #Epic 8 (Mobile BLoC từ đầu)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-20] (dòng 297-302), ma trận quyền dòng 275-277
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md] — AD-8, AD-21 (dòng 175-180), Consistency "Logging / Audit" (195), "Đường đỏ settings.manage" (198), module `audit/` (535, 558)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md] — dòng 30, 51, 84, 117, 151
- [Source: …/mockups/all-screens.html#s-audit] dòng 4989-5080; `#s-menu` dòng 850-853, 929-932
- [Source: _bmad-output/implementation-artifacts/8-1-dashboard-van-hanh.md] — khuôn màn mới full-stack (port/adapter/route/Cubit/test), `vietnamRangeToInstants`
- [Source: _bmad-output/implementation-artifacts/8-4-cau-hinh-ma-tran-quyen-hanh-dong-duyet.md] — guard `no-role-based-authorization`, khuôn guard nhãn StatusChip
- [Source: _bmad-output/story-automator/extra-instructions-8-review.txt] — luật dự án
- [Source: _bmad-output/project-context.md] — Testing, Critical Don't-Miss
- [Source: backend/src/audit/*.ts, backend/src/events/domain-event.ts, backend/prisma/schema.prisma:82-96, backend/test/audit-log-append-only.spec.ts]
- [Source: backend/src/dashboard/{dashboard.controller.ts,domain/dashboard-period.ts}, backend/src/orders/dto/{list-orders-query,order-list-response}.dto.ts, backend/src/payments/dto/record-payment-request.dto.ts:54-56]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Backend:** `GET /audit-logs` (gate `@RequirePermissions(audit.read)`, quyền FRESH) qua `AuditLogReadService` riêng (chỉ `findMany`/`count` trong một `$transaction` + MỘT `account.findMany` gắn tên); `AuditService` vẫn chỉ `record`. Domain thuần: `AUDIT_EVENT_LABELS` (47 type, test quét source), `AUDIT_TARGET_TYPES` (9, test quét `target = { type: … }`), `auditChanges` (diff phẳng, cắt 500, `isMoney` theo `AUDIT_MONEY_FIELDS` = 18 field tiền contract + `giaVonSau/giaVonTruoc/installmentPaid/orderPaid` chỉ có trong payload). Khoảng ngày tái dùng `vietnamRangeToInstants` (mỗi đầu tính riêng). Index `audit_logs(occurred_at)`. Enum OpenAPI đặt tên `AuditTargetType` (một enum chung query + entry, tránh client Dart sinh `TargetType` tên chung + enum trùng).
- **Quyền:** nhãn `audit.read` → "Xem Audit log"; `permissions:gen` chỉ đổi `permissions.json` (output web/mobile không chứa nhãn); sửa chuỗi ở fake + test web/mobile/backend; comment khoá quyền web/mobile bỏ "Super Admin only". Không thêm key, không thêm `PERMISSION_REQUIRES`.
- **Web:** port/fake/adapter + `NAV_ROUTES.audit` (mục sidebar có sẵn tự hiện), `AuditLogScreen` (Banner không role, Seg 10 lựa chọn, 2 `Field type="date"`, Table 5 cột, phân trang, vé chống trả lời muộn, lỗi hiện câu backend + Thử lại). Không nút Xuất CSV (YAGNI theo Dev Notes).
- **Mobile:** Cubit (`AuditLogCubit`/`AuditLogState`), Menu "Audit log" trước Hồ sơ, `kAuditPath`, `AppPorts.auditLogs`. Ô ngày là `AppField` gõ `YYYY-MM-DD` (controller ở State); cubit chỉ gửi khi ngày đủ dạng hoặc ô trống, bỏ qua khi đang gõ dở / trùng giá trị. Card mỗi bản ghi: tên đậm + giờ phải, nhãn hành động, đối tượng, các dòng trước → sau.
- **Test:** backend unit (changes 8, labels 6, service 7), e2e 13 (200 / 403 ADMIN đủ preset / 403 mọi quyền trừ audit.read / 403 chỉ settings.manage / 5 ca 400 / 4 method ghi ⇒ 404) + ca cấp quyền đầu-cuối trong `accounts-permissions.e2e` (ADMIN cấp ⇒ 403; SUPER_ADMIN cấp ⇒ thợ đọc được 200), DB 6 (ranh giới 23:59:59/00:00 +07, tiebreak id desc, lọc, total nhiều trang, tên/ id account đã mất/ hệ thống). Web: screen 9, adapter 3, render, routes, composition-root. Mobile: cubit 14 (bloc_test, seed mọi field, kỳ vọng field-by-field, fake khác nhau mỗi lần, đóng sớm cả hai nhánh, vé cũ), screen 8 (render, wiring tab/ngày/pager/Thử lại, tháo màn khi port chờ), adapter 4, routes, signed_in_app (Menu → /audit qua adapter thật; thiếu quyền ⇒ về Trang chủ). Design-system `audit-log.test.mjs` 8 + `menu-nav-parity` thêm `audit`.
- **Đột biến (cp backup, khôi phục + cmp; tất cả ĐỎ trừ 1 tương đương):** bỏ nhánh "khoá chỉ ở before" ⇒ unit ĐỎ; xoá nhãn `StockOutBlocked` ⇒ quét ĐỎ; `@RequirePermissions(PERM.settingsManage)` ⇒ e2e 9 ĐỎ; tra tên N+1 ⇒ unit ĐỎ (`toHaveBeenCalledTimes(1)`); `addDays(range.to, 0)` ⇒ DB 6 ĐỎ; `id: 'asc'` ⇒ DB 2 ĐỎ; bỏ `audit` khỏi `NAV_ROUTES` (route để không gate) ⇒ web route ĐỎ; bỏ `'audit'` khỏi `kNavRoutes` ⇒ ĐỎ; màn mobile gọi `widget.port.listAuditLogs()` ⇒ `no_port_call_in_screens_test` ĐỎ; quét carry-over 15 dòng `x: state.x` ⇒ 15/15 ĐỎ; bỏ vé ⇒ ĐỎ; bỏ `isClosed` nhánh lỗi ⇒ ĐỎ; `selectTarget` giữ trang / `setFrom` bỏ kiểm trùng / tiền không format / bỏ "Hệ thống" ⇒ ĐỎ. Guard T7: "Super Admin" ở màn web và ở cubit mobile, lệch/thiếu nhãn loại mobile, bỏ `SystemSetting` backend, map trạng thái tự chế web, literal trạng thái mobile, `toLocaleString` web, `DateFormat` mobile, bỏ `vatAmount` khỏi `AUDIT_MONEY_FIELDS`, gate Menu mobile lệch ⇒ 13/13 ĐỎ. Guard tiền phủ màn mới: chèn `${_cubit.state.total}` (mobile) / `{total}` (web) ⇒ `money-render-guard` ĐỎ. **Sống:** bỏ `isClosed` ở nhánh thành công — mutant tương đương (emit sau close ném trong `try`, `catch` dừng ở `isClosed`), đúng memory `cubit-close-error-path-untested`.
- **5 lane:** backend `npm test` 136 suite / 2766 test xanh; `npm run test:db` 31 suite / 353 xanh (sau `prisma migrate deploy`); design-system 546/546; web typecheck + vitest 45 file / 532 + build xanh; mobile `flutter analyze` sạch + `flutter test` 1489 xanh. Lint: `eslint` + `prettier --check` sạch trên file backend của story (cả repo đỏ sẵn — memory `backend-lint-red-at-baseline`).
- **Smoke (backend `npm run start` cổng 3085, JWT secret tạm trên dòng lệnh, không đọc `.env`; 2 account smoke riêng `smoke-8-5-audit` (audit.read + quyền tạo khách/đơn) và `smoke-8-5-plain` (orders.view_own + settings.manage), argon2id, có SĐT):** API — tạo khách + đơn thật sinh `CustomerCreated`/`OrderCreated`; lọc `targetType=Order&from=to=hôm nay` ⇒ đúng 1 bản ghi "Tạo đơn" tên actor; plain ⇒ 403; `from > to` ⇒ 400 `fieldErrors.to`; `DELETE /audit-logs` ⇒ 404. (PUT quyền của plain từ account audit ⇒ 403 — đúng luật không-leo-thang vì plain mang `settings.manage`.) Web (vite 5185 proxy → 3085, Playwright): đăng nhập SĐT, sidebar có "Audit", mở `/audit` 20 dòng, reload giữ phiên, lọc Đơn hàng + 2 ngày ⇒ 1 dòng, không chữ "Super Admin", đăng xuất; plain không thấy mục, gõ `/audit` ⇒ `/dashboard`. Emulator (Pixel_9_Pro cold boot `-no-snapshot`, serial riêng `emulator-5584`): đăng nhập, Menu → "Audit log" hiện card, lọc Đơn hàng + ngày ⇒ chỉ bản ghi đơn; mở lại app giữ phiên; đăng xuất; plain không có mục. Dọn: tắt đúng emulator 5584 + PID backend/vite đã ghi, `verifier_verify_adb_installs` vốn đã 0 (không đổi), 2 account smoke vô hiệu hoá + xoá phiên (account audit sở hữu đơn smoke ⇒ FK RESTRICT, không xoá được).
- **Ghi chú cho review:** sự kiện "tạo" liệt kê mọi khoá `after` (đúng luật Dev Notes) nên dòng Trước → Sau của `OrderCreated` dài; mobile không có date picker (gõ tay `YYYY-MM-DD`, không có widget picker trong design system).

### File List

- backend/prisma/schema.prisma
- backend/prisma/migrations/20261030090000_add_audit_logs_occurred_at_index/migration.sql
- backend/src/audit/audit.module.ts
- backend/src/audit/audit.service.ts
- backend/src/audit/audit.controller.ts
- backend/src/audit/audit-log-read.service.ts
- backend/src/audit/domain/audit-changes.ts
- backend/src/audit/domain/audit-event-labels.ts
- backend/src/audit/domain/audit-target-types.ts
- backend/src/audit/dto/audit-change.dto.ts
- backend/src/audit/dto/audit-log-entry.dto.ts
- backend/src/audit/dto/audit-log-list-response.dto.ts
- backend/src/audit/dto/list-audit-logs-query.dto.ts
- backend/src/accounts/domain/permission-registry.ts
- backend/openapi/openapi.json
- backend/openapi/permissions.json
- backend/test/audit-changes.spec.ts
- backend/test/audit-event-labels.spec.ts
- backend/test/audit-log-read.service.spec.ts
- backend/test/audit-logs.e2e.spec.ts
- backend/test/audit-logs.db.integration.spec.ts
- backend/test/accounts-permissions.e2e.spec.ts
- backend/test/account-permissions.service.spec.ts
- web/src/api/generated/schema.d.ts
- web/src/api/http-audit-logs-port.ts
- web/src/design-system/session/audit-logs-port.ts
- web/src/design-system/session/fake-audit-logs-port.ts
- web/src/design-system/session/index.ts
- web/src/design-system/session/fake-accounts-port.ts
- web/src/design-system/gating/permissions.ts
- web/src/screens/audit/AuditLogScreen.tsx
- web/src/screens/audit/audit.css
- web/src/app/routes.ts
- web/src/app/AppRoutes.tsx
- web/src/main.tsx
- web/src/test/audit-log-screen.test.tsx
- web/src/test/http-audit-logs-port.test.ts
- web/src/test/screens-render.test.tsx
- web/src/test/app-routes.test.tsx
- web/src/test/composition-root.test.ts
- web/src/test/permissions-screen.test.tsx
- mobile/lib/api/generated/export.dart
- mobile/lib/api/generated/pns_api_client.dart
- mobile/lib/api/generated/audit/audit_client.dart
- mobile/lib/api/generated/audit/audit_client.g.dart
- mobile/lib/api/generated/models/audit_change_dto.dart
- mobile/lib/api/generated/models/audit_change_dto.g.dart
- mobile/lib/api/generated/models/audit_log_entry_dto.dart
- mobile/lib/api/generated/models/audit_log_entry_dto.g.dart
- mobile/lib/api/generated/models/audit_log_list_response_dto.dart
- mobile/lib/api/generated/models/audit_log_list_response_dto.g.dart
- mobile/lib/api/generated/models/audit_target_type.dart
- mobile/lib/api/http_audit_logs_port.dart
- mobile/lib/design_system/session/audit_logs_port.dart
- mobile/lib/design_system/session/fake_audit_logs_port.dart
- mobile/lib/design_system/session/fake_accounts_port.dart
- mobile/lib/design_system/gating/app_permissions.dart
- mobile/lib/design_system/shell/app_menu_nav.dart
- mobile/lib/screens/audit/audit_log_screen.dart
- mobile/lib/screens/audit/audit_log_cubit.dart
- mobile/lib/screens/audit/audit_log_state.dart
- mobile/lib/app/app_ports.dart
- mobile/lib/app/app_routes.dart
- mobile/lib/app/signed_in_app.dart
- mobile/lib/main.dart
- mobile/test/api/http_audit_logs_port_test.dart
- mobile/test/screens/audit/audit_log_cubit_test.dart
- mobile/test/screens/audit/audit_log_screen_test.dart
- mobile/test/screens/permissions/account_permissions_screen_test.dart
- mobile/test/app/app_routes_test.dart
- mobile/test/app/signed_in_app_test.dart
- mobile/test/app/pns_app_test.dart
- mobile/test/app/support/app_harness.dart
- design-system/screens/audit-log.test.mjs
- design-system/components/menu-nav-parity.test.mjs
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/8-5-man-xem-audit-log-chi-super-admin.md

## Senior Developer Review (AI)

_Reviewer: Đại Ca (AI review qua /ck:code-review) — 2026-10-30. Outcome: **Approve sau khi sửa** — 0 CRITICAL còn lại._

Git ↔ File List: khớp với các file của story. `.githooks/` (20/10) và hai file `docs/*.xlsx` chưa track là thay đổi ngoài story, không review, không add.

**Findings (đã sửa hết):**
- **[HIGH][Bảo mật] Giá vốn lộ qua audit:** `GET /audit-logs` trả nguyên `costPrice` (Product*), `unitCost`/`giaVonTruoc`/`giaVonSau` (phiếu kho, StockIssued) cho mọi người có `audit.read` — AC 4 cho cấp `audit.read` cho account bất kỳ ⇒ cửa sau vòng qua `stripCostPrice`/che giá vốn phiếu kho. Sửa: controller resolve `costs.view` tươi (khuôn `products.controller.ts`), `auditChanges(before, after, canViewCosts)` loại lá thuộc `AUDIT_COST_FIELDS`; `AuditModule` import `AccountsModule`. Test unit + service + e2e HTTP. Đột biến: bỏ lệnh loại / bỏ `unitCost` khỏi tập / controller đọc sai key ⇒ cả 3 ĐỎ.
- **[HIGH][Luật 21] Tiền lồng không qua formatter:** object lồng/mảng hiện JSON thô ⇒ `lines[].unitCost`, `giaVon…` (phiếu kho), `[].price` (bậc giá), `[].amount` (lịch thanh toán) hiện số trần; `giaVonSau/giaVonTruoc` trong `AUDIT_MONEY_FIELDS` là chết (không bao giờ là khoá gốc). Sửa: trải hai bên thành đường dẫn lá (`lines[0].unitCost`), `isMoney` theo khoá cuối. Đột biến bỏ trải mảng ⇒ ĐỎ. Contract `field` đổi nghĩa (đường dẫn) ⇒ cập nhật mô tả DTO, sinh lại OpenAPI + web + mobile.
- **[MEDIUM] Mobile gửi ngày không tồn tại** (`2026-13-01`, `2026-02-30`) ⇒ 400 "Dữ liệu không hợp lệ" + "Thử lại" vô vọng. Sửa: `_parseDay` kiểm khứ hồi `DateTime`; bloc_test ngày không có thật + ngày nhuận. Đột biến bỏ khứ hồi ⇒ ĐỎ.
- **[MEDIUM][Test] Mobile: cổng `isMoney` và regex số nguyên không bị canh:** bỏ `change.isMoney &&` hay `_integer` vẫn xanh. Thêm widget test (số lượng không `đ`, `1.5`/số quá lớn/`0x10` hiện nguyên, âm qua formatter). Cả 2 đột biến ĐỎ (`int.tryParse('0x10')` = 16 — regex là cần).
- **[LOW] Mobile: loại đối tượng lạ (`$unknown`) mất id** ⇒ giữ id. Đột biến ⇒ ĐỎ.
- **[LOW] Mobile ↔ web: ô ngày gõ dở** khác nhau ⇒ ghi rõ trong header màn mobile + epics.md.
- **[LOW][Test] Web: reset trang khi đổi "Đến ngày" không bị canh; `INTEGER`/`isSafeInteger` không bị canh.** Thêm ca. 3 đột biến ⇒ ĐỎ.
- **[LOW] Web: picker ngày cho chọn `from > to` / năm 5 chữ số** ⇒ `max`/`min` theo đầu kia + `9999-12-31`; test. Đột biến ⇒ ĐỎ.
- **[MEDIUM][Môi trường] Rác smoke làm đỏ lane DB:** đơn smoke của `smoke-8-5-audit` (FK RESTRICT nên lúc smoke không xoá được) làm `orders-list.db` ĐỎ 2 ca. Đã xoá đơn + version + khách smoke + 2 account smoke trên `pns-postgres` 5433 (audit giữ nguyên — append-only).

**Luật dự án:** (1)(2)(9)(20) không áp — story chỉ đọc, không ghi đơn/tồn/tiền. (21) đột biến bỏ `formatVnd` ⇒ web ĐỎ 3, mobile ĐỎ 2. Quyết định review ghi vào `epics.md` 8.5 + spine dòng Logging/Audit (luật 11).

**Lane sau sửa:** backend `npm test` 136 suite / 2775 xanh; `npm run test:db` 31 / 353 xanh; design-system 546/546; web typecheck + vitest 536/536 + build xanh (1 timeout `app-entry` chỉ khi chạy song song 4 lane, chạy riêng xanh); mobile `flutter analyze` sạch + `flutter test` 1494 xanh. ESLint + Prettier sạch trên file backend của story. Smoke web/emulator KHÔNG chạy lại sau sửa review (đường HTTP mới phủ bằng e2e `initAppOnLoopback`).

## Change Log

- 2026-10-30: Story 8.5 implemented — read-only `GET /audit-logs` gated on `audit.read` (backend labels + flat diff + money flag, Vietnam-day range, `occurred_at` index), `audit.read` label without role, web `/audit` screen, mobile Menu → Audit log (Cubit), design-system guard; epics.md decisions + spine updated. Status → review.
- 2026-10-30: Code review — cost fields hidden from audit readers without `costs.view`; nested payloads flattened to leaf paths so nested money is formatted; mobile rejects impossible dates; web date pickers bounded; test gaps closed; smoke residue removed from local DB. Status → done.
