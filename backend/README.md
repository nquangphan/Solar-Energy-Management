# Phương Nam Solar — Backend (NestJS)

Backend API — **chủ sở hữu DB duy nhất** (AD-1) và toàn bộ business logic. Web (React) + Mobile (Flutter) chỉ gọi REST, không chạm DB.

Story 2.1 dựng **skeleton hạ tầng**: bootstrap NestJS + `PrismaModule`/`PrismaService` + pipeline OpenAPI-sinh-từ-code + convention + một endpoint `GET /health`. Tính năng nghiệp vụ thuộc story sau.

## Stack

- Node.js **24 LTS** (`engines` pin `>=24 <25`) · NestJS **11.x** · Prisma **7.8.0** · PostgreSQL **18.x**

## Cài đặt

```bash
cd backend
npm install
cp .env.example .env      # điền DATABASE_URL thật (KHÔNG commit .env)
npm run prisma:generate
```

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run start:dev` | Chạy dev (watch) |
| `npm run build` / `npm run start:prod` | Build & chạy production |
| `npm run lint` / `npm run format` | Lint & format |
| `npm run format:check` | Kiểm format, không ghi file (dùng cho CI) |
| `npm test` | Jest — 116 suite (unit + e2e + 10 source-guard kiến trúc `test/no-*.spec.ts` + drift-guard OpenAPI/permissions). Hermetic: **không cần Postgres** — 26 suite `*.db.integration.spec.ts` bị loại qua `testPathIgnorePatterns` |
| `npm run test:db` | Jest — 26 suite `*.db.integration.spec.ts` (**cần Postgres** + `DATABASE_URL`; máy dev: container `pns-postgres` cổng 5433). `npm test` **KHÔNG** chạy nhóm này; unique/FK/CHECK/`FOR UPDATE`/idempotency chỉ được kiểm ở đây |
| `npm run openapi:gen` | Sinh `openapi/openapi.json` từ code (không cần server/DB) |
| `npm run permissions:gen` | Sinh `openapi/permissions.json` từ registry quyền (không cần server/DB) |
| `npm run prisma:migrate:dev` | Tạo/chạy migration (dev — cần Postgres) |
| `npm run prisma:migrate:deploy` | Áp migration đã commit (không tạo mới — dùng cho CI/prod) |
| `npx prisma db seed` | Seed account admin đầu tiên (đọc `SEED_ADMIN_*` từ `.env`) |

## Đăng nhập được lúc dev (Story 2.3)

Cần một Postgres đang chạy + `.env` có `DATABASE_URL` + `JWT_ACCESS_SECRET` (≥32 ký tự) + `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (xem `.env.example`). Sau đó:

```bash
npm run prisma:migrate:deploy   # áp toàn bộ migration đã commit (auth, danh mục, khách hàng, đơn hàng, tệp đính kèm, tồn kho…)
npx prisma db seed              # tạo account admin; SEED_ADMIN_IS_SUPER_ADMIN=true → cấp preset SUPER_ADMIN
npm run start:dev               # POST /auth/login với email/mật khẩu admin
```

Token trả về: `{ accessToken (JWT ngắn), refreshToken (opaque), expiresIn }`. Refresh qua `POST /auth/refresh` (rotate), thu hồi qua `POST /auth/logout`. Chi tiết luật token/phiên: `CONVENTIONS.md#Auth`.

## Quyền per-account & registry (Story 2.4)

Quyền là **một registry chính tắc** (`src/accounts/domain/permission-registry.ts`, AD-17) — nguồn duy nhất, cấm literal ngoài registry. Lưu per-account ở bảng `account_permissions`; preset role là hằng số code (`domain/role-presets.ts`), chỉ `SUPER_ADMIN` có `audit.read`. Artifact `openapi/permissions.json` **sinh tự động** (`npm run permissions:gen`) — FE gen key từ đó (Story 2.6). Chi tiết: `CONVENTIONS.md#Permission registry`.

## Enforce quyền server-side + `/me` (Story 2.5)

Guard **fail-closed toàn cục**: mọi endpoint mặc định cần `Authorization: Bearer <accessToken>` (`APP_GUARD`: `JwtAuthGuard` → `PermissionsGuard`). `@Public()` mở route hạ-tầng (`/health`, `/auth/*`); `@RequirePermissions(PERM.x)` (AND) đòi quyền cụ thể; thiếu token → 401, thiếu quyền → 403. `GET /me` trả bộ quyền hiệu lực `{ id, email, displayName, permissions: string[] }` (sorted) để FE dựng phiên — server enforce mỗi request, client gating chỉ UX (AD-4). Chi tiết: `CONVENTIONS.md#Guard quyền server-side`.

## Đặt lại & đổi mật khẩu (Story 2.8)

Ba route: `POST /auth/forgot-password` (công khai — trả `{ expiresInSeconds }`, **cùng một response** dù email tồn tại hay không), `POST /auth/reset-password` (công khai — mã 6 số + mật khẩu mới → `204`), `POST /auth/change-password` (**cần Bearer** — verify mật khẩu hiện tại → `204`). Sau reset **và** sau change: **mọi phiên bị thu hồi**.

Hai biến env (xem `.env.example`, có giá trị mặc định):

| Biến | Mặc định | Việc |
|---|---|---|
| `PASSWORD_RESET_CODE_TTL_MINUTES` | `5` | Vòng đời mã 6 số; cũng là cooldown gửi lại mã |
| `PASSWORD_RESET_MAX_ATTEMPTS` | `5` | Số lần nhập sai tối đa trước khi mã bị khoá |

> ⚠️ **Phase 1 mã KHÔNG tới tay người dùng cuối.** Stack chưa có kênh email/SMS; `PasswordResetRequested` chỉ được `NotificationDispatcher` (no-op) ghi log. Luồng Quên mật khẩu **chưa dùng được self-service** cho tới khi chốt kênh gửi. Chi tiết: `CONVENTIONS.md#Đặt lại / đổi mật khẩu`.

## Domain event qua `EventBus` port (Story 2.7)

Hành động nghiệp vụ có hệ quả (E4+) publish domain event qua **một `EventBus` port** (AD-18); `AuditSubscriber` (ghi `AuditLog` append-only) và `NotificationDispatcher` (bản đầu no-op/log; Epic 9 thay bằng FCM) **subscribe** — producer KHÔNG gọi audit/notification/FCM trực tiếp. Chi tiết: `CONVENTIONS.md#Domain Event & EventBus`.

## Ranh giới (đọc `CONVENTIONS.md`)

- Chỉ `PrismaService` chạm DB — không `new PrismaClient()` nơi khác (source-guard enforce). `prisma/seed.ts` là CLI script (ngoài `src/`) nên được phép tự tạo client với driver adapter.
- `openapi/openapi.json` là artifact **sinh tự động — CẤM SỬA TAY**; đổi contract = sửa code rồi `npm run openapi:gen`.
- Model + migration **đầu tiên** của dự án land ở Story 2.3 (`Account` + `Session`); Story 2.4 mở rộng `Account` với quyền (migration riêng, không tạo lại bảng).
