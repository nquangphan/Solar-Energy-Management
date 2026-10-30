# Kiến trúc

Trang này mô tả code đang có trong repo. Thiết kế đích nằm ở spine
`_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md`
(bất biến AD-1..21); chỗ code khác spine được ghi ở mục cuối. Khi hai nguồn lệch nhau, code là trạng thái thật.

## Thành phần

```text
web/ (React SPA)  ─┐                                   ┌─> PostgreSQL 18 (Prisma 7, chỉ backend chạm)
                   ├─ REST/JSON, contract = openapi.json ─> backend/ (NestJS 11) ─┤
mobile/ (Flutter) ─┘   (hiện qua port + fake port)                               ├─> Cloudflare R2 (S3 API)
                                                                                 └─> Chromium (Puppeteer, render báo giá)
design-system/ (generator Node) ──sinh──> web/src/design-system/…, mobile/lib/design_system/…
backend/openapi/permissions.json ──sinh──> key quyền web + mobile
```

- **Backend API (`backend/`)** là chủ duy nhất của DB và mọi luật nghiệp vụ (AD-1, AD-2). `main.ts` dựng
  app Nest, fail-fast khi thiếu/ngắn `JWT_ACCESS_SECRET` hoặc `PORT` sai, rồi `listen`. `app.module.ts` nối
  các module domain:
  - Hạ tầng: `CommonModule` (`AllExceptionsFilter` toàn cục dựng error envelope duy nhất + ValidationPipe),
    `PrismaModule` (`PrismaService`, driver adapter pg), `HealthModule` (`GET /health`), `EventsModule`
    (`EventBus` port, `@Global`, implementation `InProcessEventBus`), `StorageModule` (`StoragePort` →
    `R2StorageAdapter`, do `OrdersModule` import).
  - Domain: `AuthModule` (+ `AccountsModule`), `CatalogModule`, `CustomersModule`, `FeatureFlagsModule`,
    `SettingsModule`, `OrdersModule`, `InventoryModule`.
  - Consumer event: `AuditModule` (`AuditSubscriber` ghi `audit_logs`), `NotificationsModule`
    (`NotificationDispatcher`, bản đầu chỉ log).
  - Bảo vệ route: hai `APP_GUARD` theo thứ tự `JwtAuthGuard` → `PermissionsGuard` (khai trong `AuthModule`),
    fail-closed: mọi route cần access JWT trừ `@Public()`; quyền đọc tươi từ DB mỗi request.
  - Tầng trong mỗi module: controller (HTTP, DTO, Swagger) → service (transaction Prisma, khoá dòng, publish
    event sau commit) → `domain/` (hàm thuần: pricing/VAT, transition, tồn, giá vốn…, không import Nest/Prisma).
- **Web (`web/`)**: React 19 + Vite. `web/src/design-system/` là thư viện component/shell/token/icon và gating
  quyền; `web/src/screens/` là các màn theo miền. Màn nhận dữ liệu qua port (`web/src/design-system/session/*-port.ts`)
  mà hình dạng khớp contract backend; hiện mới có fake port, chưa có HTTP client, router hay composition root.
  `web/src/main.tsx` chỉ là shell demo nối màn Đăng nhập và Quên mật khẩu với `FakePasswordPort`.
- **Mobile (`mobile/`)**: Flutter package `pns_mobile` gồm widget design system, màn và port tiêm
  (`mobile/lib/design_system/session/`). Chưa có `main.dart`, `android/`, `ios/`: chưa có app chạy được,
  mọi màn được kiểm bằng widget test với fake port.
- **Design system (`design-system/`)**: nguồn sự thật cho token (`tokens/design-tokens.json`) và icon
  (`icons/icons.json`); generator `build-tokens.mjs`, `build-icons.mjs`, `build-permission-keys.mjs` sinh output
  cho cả web và mobile. Các file `*.test.mjs` là guard đọc thẳng source web + mobile (drift byte-for-byte,
  parity web↔mobile, cấm style ad-hoc, cấm in tiền thô, cấm client tự so tồn…).

Contract giữa client và backend là `backend/openapi/openapi.json`, sinh từ controller + DTO
(`npm run openapi:gen`, drift-guard `backend/test/openapi-drift.spec.ts`). Việc sinh client TS/Dart từ spec còn
hoãn; port phía client hiện khai type bằng tay theo spec.

## Lưu trữ dữ liệu

PostgreSQL là nơi lưu duy nhất của dữ liệu nghiệp vụ, khai trong `backend/prisma/schema.prisma`, migration SQL
viết tay trong `backend/prisma/migrations/` (CHECK constraint và index riêng nằm trong SQL vì Prisma không mô
hình hoá). Quy ước: model PascalCase, bảng snake_case số nhiều, ID UUID v4, tiền integer đồng, thời gian UTC.

| Nhóm | Bảng | Flow |
|------|------|------|
| Danh tính & phiên | `accounts`, `sessions`, `password_reset_codes` | `auth-session` |
| Quyền | `account_permissions` (quyền per-account; preset vai trò là hằng số code) | `accounts-permissions` |
| Audit | `audit_logs` (append-only, chỉ `create`) | `domain-events-audit` |
| Danh mục | `products`, `product_prices`, `product_groups`, `product_group_items` | `catalog` |
| Khách hàng | `customers` (PK = SĐT E.164), `customer_sources` | `customers` |
| Cấu hình | `system_settings` (VAT), `feature_flags` | `system-settings` |
| Đơn hàng | `orders`, `order_versions`, `order_line_items`, `discount_approvals`, `quote_exports`, `attachments` | `orders` |
| Kho | `stock_items` (onHand; giá vốn hiện hành là `products.cost_price`), `stock_movements` (ledger giữ hàng append-only), `stock_vouchers`, `stock_voucher_lines` | `inventory` |

- `reserved` không có cột: luôn là `SUM(stock_movements.qty)`; giải phóng là ghi thêm dòng, không xoá.
- Thứ tự khoá toàn hệ thống: `orders` `FOR UPDATE` trước, rồi `products` `ORDER BY id FOR UPDATE`.
- File nhị phân (ảnh đính kèm đơn, ảnh/PDF báo giá) nằm ở Cloudflare R2; DB chỉ giữ key + metadata.
- Không có cache, hàng đợi hay job nền: event bus chạy đồng bộ trong tiến trình (`InProcessEventBus`).

## Dịch vụ bên ngoài

- **Cloudflare R2** qua `@aws-sdk/client-s3` (`backend/src/storage/r2-storage.adapter.ts`). Client tạo lười ở
  lần dùng đầu; thiếu một trong `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` thì lỗi
  rõ ràng lúc đọc/ghi file, không lỗi lúc boot. Bốn biến này chưa có trong `backend/.env.example`.
- **Chromium qua Puppeteer** (`backend/src/orders/quote/puppeteer-quote-renderer.ts`): render HTML báo giá
  thành PDF/ảnh, font Be Vietnam Pro trong `backend/assets/fonts/`. `PUPPETEER_NO_SANDBOX` cho môi trường container.
- **Chưa có**: email/SMS (mã đặt lại mật khẩu chưa tới tay người dùng, `NotificationDispatcher` chỉ log),
  Firebase/FCM (Epic 9), cổng thanh toán.

## Triển khai

- Chưa có Dockerfile, compose hay script deploy trong repo; spine dự kiến backend + Postgres trên một VPS,
  web là static host, file ở R2 (môi trường cụ thể còn để ngỏ).
- Backend: `npm run build` → `npm run start:prod` (`node dist/main`). Migration production:
  `npm run prisma:migrate:deploy`; tài khoản admin đầu tiên: `npx prisma db seed`.
- Biến môi trường backend (đọc từ `backend/.env` qua dotenv; mẫu ở `backend/.env.example`). Repo chưa có
  `.gitignore` nên `.env`, `node_modules/`, `dist/` hiện là file untracked: đừng `git add` chúng. Danh sách biến: `DATABASE_URL`,
  `PORT`, `JWT_ACCESS_SECRET` (≥32 ký tự), `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`,
  `PASSWORD_RESET_CODE_TTL_MINUTES`, `PASSWORD_RESET_MAX_ATTEMPTS`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
  `SEED_ADMIN_IS_SUPER_ADMIN`, `PUPPETEER_NO_SANDBOX`, và bốn biến `R2_*` ở trên.
- Web: `npm run build` ra `web/dist/` (chưa dùng được cho người dùng thật vì chưa nối backend). Mobile: chưa build.
- CI: `.github/workflows/ci.yml` chạy năm lane (backend hermetic + DB với Postgres 18 service, design-system,
  web, mobile) nhưng chỉ chạy tay (`workflow_dispatch`). `.github/workflows/crew-docs.yml` tự chạy ở mọi push/PR
  để kiểm chuẩn docs (R1–R7).
- Vận hành lúc go-live (nhập tồn đầu kỳ): `docs/van-hanh-go-live.md`.

## Khác với spine

- Chưa có các module `payments/`, `contracts/`, `invoices/`, `dashboard/` (Epic 7–8); `notifications/` mới là
  consumer no-op, chưa có `DeviceToken`/hộp thư/FCM (Epic 9).
- Guard JWT/quyền và decorator nằm ở `auth/`, không ở `common/` (tránh `common` phụ thuộc domain).
- Ảnh đính kèm và chiết khấu là hành vi trên `Order` trong `orders/`, không thành module riêng (giữ một đường
  ghi lên `Order`, AD-11).
- File R2 đi qua backend (backend proxy bytes sau guard quyền), không dùng presigned URL như sơ đồ triển khai
  của spine.
- Web chưa có router/HTTP client, mobile chưa có app-runtime (`main.dart`); spine giả định cả hai gọi REST trực tiếp.
- Backend chưa bật CORS hay global prefix (`main.ts` chỉ `listen`), vì chưa có client thật gọi vào.
