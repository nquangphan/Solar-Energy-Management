# Nền tảng backend: bootstrap, lỗi, Prisma, OpenAPI, storage

> Flow `backend-platform`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow backend-platform` in ra đúng danh sách đó.

## Mục đích

Hạ tầng dùng chung mà mọi module domain của backend NestJS dựa vào. Flow này không có nghiệp vụ;
nó lo năm việc:

- khởi động HTTP server và kiểm env bắt buộc (`main.ts`, `AppModule`);
- một shape lỗi duy nhất (error envelope) và một ValidationPipe dùng chung cho runtime và test (AD-5);
- một điểm truy cập DB duy nhất qua `PrismaService` (AD-1), cùng schema, migration và seed;
- hợp đồng API cross-repo `openapi/openapi.json` sinh từ code, có drift guard (AD-12);
- port lưu file nhị phân `StoragePort` với adapter Cloudflare R2 (AD-3).

Người dùng: dev backend (thêm module, model, route), dev web/mobile (đọc `openapi.json`, map lỗi
theo `code`). Quy ước chi tiết: [`backend/CONVENTIONS.md`](../../backend/CONVENTIONS.md), lệnh:
[`backend/README.md`](../../backend/README.md).

## Điểm vào

- `npm run start` / `start:dev` / `start:prod` → `backend/src/main.ts` → `bootstrap()`.
- `GET /health` → `HealthController.check()` (route `@Public()`, không cần token).
- `npm run openapi:gen` → `backend/scripts/generate-openapi.ts` → `generate()` ghi `openapi/openapi.json`.
- Prisma CLI (`npm run prisma:migrate:dev`, `prisma:migrate:deploy`, `prisma:generate`, `npx prisma db seed`)
  đọc `backend/prisma.config.ts`.

## Các bước

1. `backend/src/main.ts` → `bootstrap()`: `import 'dotenv/config'` nạp `.env` trước mọi import; dừng
   ngay nếu `JWT_ACCESS_SECRET` vắng hoặc ngắn hơn `MIN_JWT_SECRET_LENGTH` (32); `NestFactory.create(AppModule)`;
   `app.enableShutdownHooks()` để `PrismaService.onModuleDestroy` chạy khi SIGTERM; kiểm `PORT`
   (mặc định 3000, ném lỗi nếu không phải số nguyên 0–65535) rồi `app.listen`.
2. `backend/src/app.module.ts` → `AppModule`: import `CommonModule`, `PrismaModule`, `HealthModule`, rồi các
   module domain (`AuthModule`, `EventsModule`, `AuditModule`, `NotificationsModule`, `FeatureFlagsModule`,
   `CatalogModule`, `CustomersModule`, `OrdersModule`, `SettingsModule`, `InventoryModule`).
3. `backend/src/common/common.module.ts` → `CommonModule`: đăng ký `AllExceptionsFilter` qua `APP_FILTER` và
   `createValidationPipe()` qua `APP_PIPE` (không dùng `useGlobalFilters/Pipes` trong `main.ts`), nên mọi
   app-context (runtime, OpenAPI gen, e2e test) dùng chung một cấu hình.
4. `backend/src/common/validation/validation-pipe.factory.ts` → `createValidationPipe()`: `whitelist` +
   `transform`; `exceptionFactory` gói `ValidationError[]` (làm phẳng qua `flattenValidationErrors`, field
   dạng `address.city`, `code` là constraint key như `isEmail`) thành `AppException(VALIDATION_ERROR, 400)`.
   Pipe không dựng envelope.
5. Code nghiệp vụ ném `AppException(errorCode, status, message, fieldErrors?)`
   (`backend/src/common/errors/app.exception.ts`) hoặc `HttpException` chuẩn Nest. Vi phạm UNIQUE của Prisma
   nhận diện bằng `isUniqueViolation(err)` (duck-typing `code === 'P2002'`), dùng ở catalog và customers.
6. `backend/src/common/errors/all-exceptions.filter.ts` → `AllExceptionsFilter.catch()`: `@Catch()` bắt mọi
   lỗi, `resolveTraceId()` tái dùng header `x-request-id` nếu hợp lệ (≤128 ký tự, charset `[A-Za-z0-9._-]`)
   hoặc sinh UUID v4, rồi `toEnvelope()`:
   - `AppException` → giữ `errorCode`, status, `message`, `fieldErrors`;
   - `HttpException` 4xx → `statusToErrorCode()` (400→`VALIDATION_ERROR`, 401→`UNAUTHENTICATED`,
     403→`FORBIDDEN`, 404→`NOT_FOUND`, 409→`CONFLICT`, khác→`INTERNAL`), giữ message;
   - `HttpException` 5xx và lỗi thường → message chung `'Lỗi hệ thống'` (`GENERIC_ERROR_MESSAGE`), log stack
     phía server kèm traceId.
7. `backend/src/prisma/prisma.service.ts` → `PrismaService`: kế thừa `PrismaClient`, truyền driver adapter
   `PrismaPg({ connectionString: DATABASE_URL })` (Prisma 7 không còn engine Rust); `$connect` ở
   `onModuleInit`, `$disconnect` ở `onModuleDestroy`. `PrismaModule` là `@Global`.
8. `backend/src/health/health.controller.ts` → `HealthController.check()`: gọi `this.prisma.$queryRaw` với `SELECT 1` rồi trả
   `HealthResponseDto { status: 'ok', database: 'up', timestamp }`. DB lỗi thì lỗi đi qua filter thành 500.
9. `backend/scripts/generate-openapi.ts` → `generate()`: `createOpenApiApp()` (`scripts/openapi-app-context.ts`)
   dựng `AppModule` với `PrismaService` thay bằng stub no-op (không cần DB), `buildOpenApiDocument(app)`
   (`src/openapi/openapi-document.ts`: title, version lấy từ `package.json` qua `getBackendVersion()`,
   `addBearerAuth()`, `extraModels: [ErrorEnvelopeDto, FieldErrorDto]`), rồi `serializeOpenApiDocument()`
   (JSON 2 dấu cách + newline cuối) ghi vào `OPENAPI_OUTPUT_PATH`.
10. `backend/src/storage/storage.module.ts` → `StorageModule`: provide `StoragePort` bằng `R2StorageAdapter`.
    Module không `@Global`; hiện chỉ `OrdersModule` import (xuất báo giá, ảnh đính kèm).
    `R2StorageAdapter.resolveClient()` tạo `S3Client` lười ở lần dùng đầu từ 4 biến `R2_*`, với
    `region: 'auto'` và `requestChecksumCalculation`/`responseChecksumValidation` = `'WHEN_REQUIRED'`
    (R2 chưa hỗ trợ CRC32 mặc định của SDK). `getObject` dịch `NoSuchKey`/HTTP 404 thành
    `AppException(NOT_FOUND, 404)`.
11. `backend/prisma/seed.ts` → `main()`: `seedCustomerSources()` (danh mục nguồn khách, đúng một dòng
    `isOther`, idempotent) rồi `seedAdminAccount()` (chỉ khi có cả `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`;
    băm qua `PasswordService`; `SEED_ADMIN_IS_SUPER_ADMIN=true` thì thay bộ quyền bằng `ROLE_PRESETS.SUPER_ADMIN`).

## Bất biến

| Bất biến | Nơi enforce |
|----------|-------------|
| Chỉ `PrismaService` mở kết nối DB: không có `new PrismaClient(` trong `backend/src/` (quét trên code đã bỏ comment/string). `prisma/seed.ts` là CLI ngoài `src/` nên được phép. | `backend/test/no-manual-prisma-client.spec.ts` |
| `PrismaModule` là `@Global`, `PrismaService` kế thừa `PrismaClient` | `backend/test/prisma-wiring.spec.ts` |
| Chỉ `AllExceptionsFilter` dựng envelope: không file `*.controller.ts` / `*.service.ts` nào nhắc `traceId` | `backend/test/no-controller-error-envelope.spec.ts` |
| Mọi lỗi ra HTTP có đúng shape `{ code, message, fieldErrors?, traceId }`; 5xx không lộ message/stack | `backend/test/error-envelope.spec.ts` |
| `openapi/openapi.json` là file sinh, cấm sửa tay: phải khớp byte-for-byte với spec sinh lại trong bộ nhớ | `backend/test/openapi-drift.spec.ts` |
| File `.ts` trong `src/` đặt tên kebab-case theo từng đoạn (`health-response.dto.ts`) | `backend/test/naming-convention.spec.ts` |
| R2 khởi tạo lười: boot và test không cần env `R2_*`; thiếu env lúc dùng thì báo đủ 4 tên biến | `backend/test/r2-storage.adapter.spec.ts` |
| `/health` phụ thuộc thật vào DB, không báo `database: 'up'` khi ping lỗi | `backend/test/health.spec.ts` |

Mọi source-guard đều có ca "guard thực sự quét được file" để không xanh giả khi tập quét rỗng.
Fail-fast `JWT_ACCESS_SECRET`/`PORT` trong `bootstrap()` hiện chưa có test riêng.

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/main.ts` | Bootstrap HTTP server, kiểm env | `bootstrap`, `MIN_JWT_SECRET_LENGTH` |
| `backend/src/app.module.ts` | Module gốc, nối mọi module | `AppModule` |
| `backend/src/common/common.module.ts` | Đăng ký filter + pipe global qua DI | `CommonModule` |
| `backend/src/common/errors/all-exceptions.filter.ts` | Nơi duy nhất dựng error envelope | `AllExceptionsFilter`, `resolveTraceId`, `statusToErrorCode` |
| `backend/src/common/errors/app.exception.ts` | Lỗi có mã do code nghiệp vụ ném | `AppException` |
| `backend/src/common/errors/error-code.ts` | Enum mã lỗi hạ tầng (`as const`); mã domain khai ở module riêng | `ErrorCode` |
| `backend/src/common/errors/dto/error-envelope.dto.ts`, `backend/src/common/errors/dto/field-error.dto.ts` | Schema OpenAPI của envelope và lỗi cấp field | `ErrorEnvelopeDto`, `FieldErrorDto` |
| `backend/src/common/errors/prisma-unique-violation.ts` | Nhận diện P2002 | `isUniqueViolation` |
| `backend/src/common/validation/validation-pipe.factory.ts` | ValidationPipe dùng chung | `createValidationPipe`, `flattenValidationErrors` |
| `backend/src/prisma/prisma.module.ts`, `backend/src/prisma/prisma.service.ts` | Truy cập DB duy nhất (driver adapter pg) | `PrismaModule`, `PrismaService` |
| `backend/src/health/health.controller.ts`, `backend/src/health/health.module.ts`, `backend/src/health/dto/health-response.dto.ts` | `GET /health` | `HealthController`, `HealthModule`, `HealthResponseDto` |
| `backend/src/openapi/openapi-document.ts` | Dựng + chuỗi hoá spec (dùng chung bởi script và drift guard) | `buildOpenApiDocument`, `serializeOpenApiDocument`, `getBackendVersion`, `OPENAPI_OUTPUT_PATH` |
| `backend/scripts/generate-openapi.ts` | Script `openapi:gen` | `generate` |
| `backend/scripts/openapi-app-context.ts` | App-context không DB cho OpenAPI | `createOpenApiApp` |
| `backend/openapi/openapi.json` | Artifact sinh (hiện 50 path, 91 schema, version `0.1.0`); web/mobile gen client từ đây | (file sinh) |
| `backend/src/storage/storage.port.ts` | Port đọc/ghi/xoá object | `StoragePort` (`putObject`, `getObject`, `deleteObject`) |
| `backend/src/storage/r2-storage.adapter.ts` | Adapter Cloudflare R2 qua S3 API | `R2StorageAdapter` |
| `backend/src/storage/storage.module.ts` | Bind port → adapter | `StorageModule` |
| `backend/prisma/schema.prisma` | Schema Prisma của toàn hệ thống (datasource chỉ khai `provider`) | 23 model, xem bảng dưới |
| `backend/prisma/migrations/migration_lock.toml` | Khoá provider `postgresql`, do Prisma quản lý | — |
| `backend/prisma.config.ts` | Cấu hình Prisma CLI: schema, thư mục migration, lệnh seed, `datasource.url = env('DATABASE_URL')` | `defineConfig` |
| `backend/prisma/seed.ts` | Seed nguồn khách + admin đầu tiên | `main`, `seedCustomerSources`, `seedAdminAccount` |
| `backend/.env.example` | Mẫu biến môi trường (copy sang `.env` gitignored) | `DATABASE_URL`, `PORT`, `JWT_ACCESS_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `PASSWORD_RESET_CODE_TTL_MINUTES`, `PASSWORD_RESET_MAX_ATTEMPTS`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_IS_SUPER_ADMIN`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `PUPPETEER_NO_SANDBOX` |

## Dữ liệu

- Bảng: flow này sở hữu schema và cơ chế migration, không đọc/ghi bảng nghiệp vụ nào. `GET /health` chỉ
  chạy `SELECT 1`. Seed ghi `customer_sources`, `accounts`, `account_permissions`.
- Sự kiện: không phát và không nghe domain event.
- Gọi ngoài: PostgreSQL 18 qua `@prisma/adapter-pg`; Cloudflare R2 qua `@aws-sdk/client-s3`
  (`PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`). Bucket không public: mọi truy cập file đi qua
  backend sau JWT + guard quyền, không dùng presigned URL.

### Model Prisma → flow sở hữu

| Model (`@@map`) | Flow sở hữu | Ghi chú |
|-----------------|-------------|---------|
| `Account` (`accounts`) | auth-session | Bảng gốc tạo ở migration `init_auth_accounts_sessions`; CRUD tài khoản ở accounts-permissions |
| `Session` (`sessions`) | auth-session | Refresh token thu hồi được |
| `PasswordResetCode` (`password_reset_codes`) | auth-session | |
| `AccountPermission` (`account_permissions`) | accounts-permissions | `permission` là String, validate theo registry |
| `AuditLog` (`audit_logs`) | domain-events-audit | Append-only |
| `Product` (`products`) | catalog | Dòng `products` cũng là đích khoá `FOR UPDATE` của inventory |
| `ProductPrice` (`product_prices`) | catalog | Migration chung với `feature_flags` |
| `ProductGroup` (`product_groups`), `ProductGroupItem` (`product_group_items`) | catalog | |
| `FeatureFlag` (`feature_flags`) | system-settings | Vắng dòng = tắt |
| `SystemSetting` (`system_settings`) | system-settings | Migration chung với metadata đơn hàng |
| `CustomerSource` (`customer_sources`), `Customer` (`customers`) | customers | Unique index lọc `customer_sources_single_is_other` chỉ có trong SQL |
| `Order` (`orders`), `OrderVersion` (`order_versions`), `OrderLineItem` (`order_line_items`) | orders | |
| `DiscountApproval` (`discount_approvals`), `QuoteExport` (`quote_exports`), `Attachment` (`attachments`) | orders | Bytes của `QuoteExport`/`Attachment` nằm trên R2 qua `StoragePort` |
| `StockItem` (`stock_items`), `StockMovement` (`stock_movements`), `StockVoucher` (`stock_vouchers`), `StockVoucherLine` (`stock_voucher_lines`) | inventory | Nhiều CHECK constraint chỉ có trong `migration.sql` |

Mỗi thư mục migration được liệt kê trong `files` của flow sở hữu trong `docs/flows.yaml`; flow này chỉ giữ
`migration_lock.toml`.

### Thêm một migration

1. Sửa `backend/prisma/schema.prisma` theo quy ước: model PascalCase → `@@map` bảng snake_case số nhiều, cột
   `@map` snake_case, ID UUID (xem [CONVENTIONS.md › Prisma `@@map` / `@map`](../../backend/CONVENTIONS.md)).
   Không thêm `url` vào datasource: Prisma 7 đọc URL từ `prisma.config.ts`.
2. Cần Postgres thật và `DATABASE_URL` trong `.env` (máy dev: container `pns-postgres`, cổng 5433, theo
   `_bmad-output/project-context.md`). Chạy `npm run prisma:migrate:dev` (Prisma hỏi tên; hoặc
   `npm run prisma:migrate:dev -- --name <ten_snake_case>`). Thư mục mới có dạng
   `prisma/migrations/<timestamp>_<ten>/migration.sql`.
3. Prisma không mô hình hoá CHECK constraint và filtered unique index: thêm tay vào `migration.sql` và ghi
   chú `///` trên model như các model tồn kho đang làm. Nếu dùng `prisma migrate diff`, Prisma 7 nhận cờ
   `--from-schema`/`--to-schema` (không còn `--from-schema-datamodel`).
4. Không sửa migration đã commit và không sửa tay `migration_lock.toml`; cần đổi thì tạo migration mới.
5. `npm run prisma:generate`; nếu DTO/route đổi thì `npm run openapi:gen` để drift guard xanh.
6. Thêm đường dẫn `migration.sql` vào `files` của flow sở hữu trong `docs/flows.yaml` (luật R2), chạy
   `crew-docs generate`, cập nhật bảng model ở trên nếu thêm model.
7. Ràng buộc DB (unique, FK, CHECK, khoá dòng) chỉ đo được ở lane DB: viết ca `*.db.integration.spec.ts`,
   rồi `npx prisma migrate deploy` và `npm run test:db`. CI chạy `npx prisma migrate deploy` + `npx prisma db seed`
   trước `test:db` (xem build-ci).

## Flow liên quan

- auth-session: `@Public()` mà `HealthController` dùng; `PasswordService` mà seed dùng để băm mật khẩu; đọc `JWT_ACCESS_SECRET` mà `bootstrap()` kiểm.
- accounts-permissions: `ROLE_PRESETS` cho seed Super Admin; lỗi 401/403 do guard quyền ném cũng đi qua `AllExceptionsFilter`.
- catalog, customers, orders, inventory, system-settings: inject `PrismaService`, ném `AppException`, dùng `isUniqueViolation` (catalog, customers); route của họ nằm trong `openapi.json`.
- orders: consumer duy nhất hiện tại của `StorageModule`/`StoragePort` (xuất báo giá, ảnh đính kèm).
- domain-events-audit: `EventsModule`, `AuditModule`, `NotificationsModule` được nối trong `AppModule`.
- design-system: `money-fields.mjs` lấy danh sách field tiền từ `openapi.json`.
- build-ci: lane backend chạy lint, format, build, `npm test`, migrate + seed + `test:db`.

## Tests

| Loại | Test | Kiểm tra |
|------|------|----------|
| e2e (hermetic, mock Prisma) | `backend/test/error-envelope.spec.ts` | Mỗi loại lỗi ra đúng status + `code`; `fieldErrors` khi body sai DTO; 5xx/lỗi thường trả message chung; quy tắc tái dùng/sinh `traceId` |
| e2e (hermetic) | `backend/test/health.spec.ts` | `GET /health` trả 200 + shape + ping DB; `/accounts` 404; DB lỗi thì 500 `INTERNAL`, không `database: 'up'` |
| Unit | `backend/test/prisma-wiring.spec.ts` | `PrismaModule` `@Global`, `PrismaService` inject được và kế thừa `PrismaClient` |
| Unit (hermetic, mock SDK) | `backend/test/r2-storage.adapter.spec.ts` | Khởi tạo lười, lỗi thiếu env, cấu hình `S3Client`, cache client, put/get/delete, `NoSuchKey`/404 → `NOT_FOUND`, lỗi khác ném nguyên |
| Drift guard | `backend/test/openapi-drift.spec.ts` | `openapi.json` khớp byte-for-byte; spec không rỗng; các route/DTO của auth, khách hàng, gói vật tư, preview-total, xuất báo giá có mặt; route nào cần bearer; không schema nào lộ `passwordHash`, mã xác thực, `costPrice` của gói; version = version backend |
| Source-guard | `backend/test/no-manual-prisma-client.spec.ts`, `backend/test/no-controller-error-envelope.spec.ts`, `backend/test/naming-convention.spec.ts` | Xem mục Bất biến |
| Tiện ích test | `backend/test/util/strip-to-code.ts` (`stripToCode`: bỏ comment + string literal), `backend/test/util/strip-comments.ts` (`stripComments`: chỉ bỏ comment, giữ string) | Dùng chung bởi các source-guard; chọn `stripComments` khi guard cần soi string literal |
| Tiện ích test | `backend/test/util/listen-loopback.ts` (`initAppOnLoopback`) | Bind app e2e đúng `127.0.0.1` để supertest không rơi vào tiến trình lạ trên macOS |
| Tiện ích test | `backend/test/util/fake-storage.ts` (`fakeStorage`, `FakeStorage`) | `StoragePort` giả giữ object trong `Map`, dùng cho test dựng `OrdersService` |
