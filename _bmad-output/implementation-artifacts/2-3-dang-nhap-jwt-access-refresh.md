---
baseline_commit: 7be0495d0af15ef16c6fbb52c5f46babc5bed1bf
---

# Story 2.3: Đăng nhập JWT access+refresh

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người dùng nội bộ**,
I want **đăng nhập thật với JWT access + refresh**,
so that **phiên áp đúng danh tính và có thể làm mới token an toàn**.

## Acceptance Criteria

1. **Given** thông tin đăng nhập hợp lệ, **When** đăng nhập, **Then** backend cấp **access token ngắn hạn** + **refresh token**; đăng nhập **sai** trả **envelope lỗi chuẩn** (`UNAUTHENTICATED` 401, message generic — KHÔNG lộ email hay mật khẩu sai) (NFR-6, AD-12, AD-5).
2. **Given** access token hết hạn, **When** gọi **refresh**, **Then** cấp **access token mới** (rotate refresh token); **đăng xuất thu hồi phiên phía server** — refresh token đã thu hồi/hết hạn không đổi được token nữa (AD-12).
3. **Given** app online-only, **When** mất mạng, **Then** hiển thị **lỗi cụ thể + "Thử lại"**, KHÔNG có offline mode (FR-22, NFR-11). *(FE UX — xem Ranh giới phạm vi: hợp đồng lỗi publish ở story này; hiện thực FE nối cùng tầng HTTP client — Open Question #1.)*

**Bằng chứng "done" (backend, kiểm được không cần FE):**
- `POST /auth/login` creds đúng → `200` + `{ accessToken, refreshToken, expiresIn }`; creds sai (email lạ **hoặc** mật khẩu sai) → `401` + envelope `UNAUTHENTICATED` message **giống hệt** cho cả hai (chống user-enumeration).
- `POST /auth/refresh` refresh token hợp lệ → `200` + access token mới + refresh token **mới** (token cũ hết hiệu lực); token đã revoke/hết hạn/sai → `401` `UNAUTHENTICATED`.
- `POST /auth/logout` → thu hồi phiên; refresh token của phiên đó sau đó → `401`.
- `passwordHash` **KHÔNG bao giờ** xuất hiện trong bất kỳ response/DTO/log nào.
- OpenAPI `openapi/openapi.json` chứa schema `LoginRequestDto` / `AuthTokensDto` / `RefreshRequestDto` (+ `LogoutRequestDto`); drift-guard byte-for-byte xanh.

## Tasks / Subtasks

- [x] **Task 1 — Prisma: model `Account` (base) + `Session` + migration đầu tiên (AC: 1, 2)**
  - [x] `prisma/schema.prisma`: khai **`Account`** (base tối giản — chủ sở hữu danh tính, AD-8): `id String @id @default(uuid())`, `email String @unique` (định danh đăng nhập — xem Open Question #2 nếu muốn SĐT), `passwordHash String`, `displayName String`, `isActive Boolean @default(true)`, `createdAt`/`updatedAt`, `@@map("accounts")`. **CHỈ** field cần cho xác thực; **KHÔNG** thêm cột permission/role ở đây — **Story 2.4 mở rộng** Account với registry quyền + `AccountPermission` (migration riêng, KHÔNG tạo lại bảng).
  - [x] `prisma/schema.prisma`: khai **`Session`** (auth sở hữu — nơi refresh token sống để **thu hồi được**, AD-12): `id`, `accountId String` + relation về `Account`, `refreshTokenHash String` (**băm**, KHÔNG lưu token thô), `expiresAt DateTime`, `revokedAt DateTime?`, `createdAt`, `@@map("sessions")`. Index `accountId`.
  - [x] Tạo migration đầu tiên: `npm run prisma:migrate:dev -- --name init_auth_accounts_sessions` → `prisma/migrations/` (bảng `accounts` + `sessions`). Đây là **migration đầu tiên của dự án** (2.1 chủ ý chưa có model). `npm run prisma:generate` để có typed client.
  - [x] Naming: entity PascalCase, bảng snake_case số nhiều (`@@map`), tiền/ngày không liên quan story này. [Source: CONVENTIONS.md, ARCHITECTURE-SPINE.md#Consistency Conventions]

- [x] **Task 2 — Module `accounts/` tối giản (read-only cho auth) (AC: 1)**
  - [x] Tạo `src/accounts/` với `AccountsModule` + `AccountsService` cung cấp **CHỈ** cái auth cần: `findByEmail(email)` và `findById(id)` (đọc qua `PrismaService`). Đây là chủ sở hữu entity `Account` theo spine (`accounts/` — AD-8); 2.4 sẽ mở rộng module này với registry quyền. **KHÔNG** build permission/`/me`/guard ở đây (2.4/2.5).
  - [x] `AccountsModule` export `AccountsService`; `AuthModule` import nó. **KHÔNG** để `auth/` tự `new PrismaClient()` hay truy vấn bảng `accounts` trực tiếp ngoài `AccountsService` (giữ ranh giới domain + AD-1: chỉ `PrismaService` chạm DB).

- [x] **Task 3 — Băm mật khẩu (AC: 1)**
  - [x] Thêm dependency băm mật khẩu **argon2id** (`argon2`, xác minh bản stable mới nhất lúc implement) — OWASP ưu tiên argon2id. *(Fallback `bcrypt` nếu VPS vướng native build — ghi lý do nếu đổi.)* Không tự cài thuật toán băm.
  - [x] `auth/password.service.ts` (hoặc util): `hash(plain)` + `verify(hash, plain)`. Dùng ở seed (Task 7) + login (Task 4). **KHÔNG** log mật khẩu thô/hash.

- [x] **Task 4 — `auth/` service: login / refresh / logout (AC: 1, 2)**
  - [x] `AuthModule` import `JwtModule` (`@nestjs/jwt` ^11) cấu hình từ env (secret + TTL access). Import `AccountsModule` + `PrismaModule` (Session repo).
  - [x] `AuthService.login(email, password)`:
    - `AccountsService.findByEmail` → nếu không có account **hoặc** `!isActive` **hoặc** `password.verify` fail → **`throw new AppException(ErrorCode.UNAUTHENTICATED, 401, <message generic>)`** — **cùng một message** cho mọi nhánh (chống user-enumeration). Filter dựng envelope (AD-5).
    - Thành công → ký **access JWT** (payload `{ sub: accountId }`, TTL ngắn — vd 15m) + sinh **refresh token opaque** (`crypto.randomBytes` → chuỗi), lưu `Session { refreshTokenHash = hash(refresh), expiresAt = now + REFRESH_TTL }`. Trả `{ accessToken, refreshToken, expiresIn }`.
  - [x] `AuthService.refresh(refreshToken)`: tra `Session` theo hash, kiểm `revokedAt == null` + `expiresAt > now` → **rotate**: revoke session cũ (`revokedAt = now`) + tạo session mới + access JWT mới. Sai/hết hạn/đã revoke → `AppException(UNAUTHENTICATED, 401)`.
  - [x] `AuthService.logout(refreshToken)`: set `revokedAt = now` cho session khớp (idempotent — không lỗi nếu đã revoke/không tồn tại; trả `204`/`200` trung tính, KHÔNG tiết lộ token có tồn tại không).
  - [x] **Access = JWT** (stateless, 2.5 guard sẽ verify cùng secret); **refresh = opaque + lưu hash server-side** (thu hồi được — AD-12). Ghi rõ lựa chọn này trong Dev Notes/CONVENTIONS.
  - [x] **KHÔNG** publish domain event ở đây (EventBus port là **Story 2.7**; login không nằm trong danh sách sự kiện AD-18). **KHÔNG** ghi audit (module `audit/` sau). **KHÔNG** tạo guard access-token (thuộc **2.5** `/me` + guard).

- [x] **Task 5 — DTO + controller + tài liệu OpenAPI (AC: 1, 2, 3-hợp-đồng)**
  - [x] DTO (mirror mẫu `HealthResponseDto` — `@ApiProperty` tường minh để OpenAPI có schema thật; class-validator để ValidationPipe/`fieldErrors` chạy):
    - `LoginRequestDto { email: string (@IsEmail), password: string (@IsString @IsNotEmpty) }`
    - `AuthTokensDto { accessToken: string, refreshToken: string, expiresIn: number }` — **KHÔNG** chứa `passwordHash`/thông tin account nhạy cảm.
    - `RefreshRequestDto { refreshToken: string }`, `LogoutRequestDto { refreshToken: string }`.
  - [x] `auth/auth.controller.ts`: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. Route `/auth/*` là **ngoại lệ hạ tầng-xác-thực có chủ ý** (như `/health`), không áp quy ước "danh từ số nhiều" cho verb login/refresh/logout. *(Thay thế: `POST /auth/sessions` = login, `POST /auth/tokens` = refresh, `DELETE /auth/sessions` = logout nếu muốn REST thuần — Open Question #3, giữ mặc định verb cho quen thuộc.)*
  - [x] `@ApiOkResponse({ type: AuthTokensDto })` cho login/refresh; `@ApiResponse` 401 tham chiếu `ErrorEnvelopeDto` (đã có trong schemas từ 2.2). Đăng ký `AuthModule` vào `AppModule.imports` (module domain đầu tiên được nối — chống scope-creep: **chỉ** thêm `AuthModule` + phần `accounts/` nó cần).

- [x] **Task 6 — Config/env + validate khởi động (AC: 1, 2)**
  - [x] `.env.example` (+ `.env` local, **KHÔNG commit secret thật**): `JWT_ACCESS_SECRET=` (placeholder, đủ dài/ngẫu nhiên), `ACCESS_TOKEN_TTL=15m`, `REFRESH_TOKEN_TTL_DAYS=30`, (+ `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` cho Task 7).
  - [x] `main.ts`: **fail-fast** như pattern `PORT` hiện có — nếu thiếu/rỗng `JWT_ACCESS_SECRET` (hoặc quá ngắn) → `throw` rõ ràng lúc bootstrap (KHÔNG để ký JWT bằng secret rỗng). Giữ `import 'dotenv/config'` **đầu file**. *(Nếu đọc env qua `JwtModule.registerAsync`/`ConfigModule`, vẫn cần chốt "thiếu secret = fail khởi động".)*
  - [x] Refresh opaque được **băm** trước khi lưu (Task 1); nếu muốn "pepper" thì thêm env riêng — YAGNI, mặc định băm argon2/sha-256 không pepper là đủ cho ~20 user nội bộ (ghi rõ lựa chọn).

- [x] **Task 7 — Seed account đầu tiên (AC: 1 — có gì để đăng nhập)**
  - [x] `prisma/seed.ts`: upsert **một** Account admin từ `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (băm qua `password.service`), `isActive: true`. Khai `prisma.seed` trong `package.json`/`prisma.config.ts` để `prisma db seed` chạy. **KHÔNG** hardcode mật khẩu trong repo — đọc env. Ghi hướng dẫn seed vào `backend/README.md`.

- [x] **Task 8 — Test (AC: 1, 2)**
  - [x] **Unit `AuthService`** (hermetic, mock `AccountsService` + Session repo qua `PrismaService` stub; dùng **argon2 + jwt thật**): login đúng → phát token + tạo session; login sai (account không tồn tại / `isActive=false` / sai mật khẩu) → `AppException(UNAUTHENTICATED)` **cùng message**; refresh rotate + revoke cũ; refresh với token revoked/expired → `UNAUTHENTICATED`; logout revoke idempotent.
  - [x] **e2e controller** (supertest + Nest testing, mock `AuthService` HOẶC app-context với `PrismaService` override như `openapi-app-context.ts`): `POST /auth/login` body sai DTO → `400` `VALIDATION_ERROR` + `fieldErrors` (chứng minh ValidationPipe 2.2 áp cho route mới); creds sai → `401` envelope `UNAUTHENTICATED`; đường thành công trả `AuthTokensDto` **không** chứa `passwordHash`.
  - [x] **Security assertions:** (a) message 401 của "email lạ" **===** "sai mật khẩu" (chống enumeration); (b) không response/log nào chứa chuỗi `passwordHash` (thêm assert hoặc mở rộng source-guard). Cân nhắc source-guard: `AuthTokensDto`/controller **không** serialize field account nhạy cảm.
  - [x] e2e **cần DB** (bảng accounts/sessions): nếu môi trường test chưa có Postgres, giữ **unit hermetic là bắt buộc** + đánh dấu integration-e2e chạy khi có DB (đừng để test fail vì thiếu DB — mock ở tầng controller cho nhánh không cần DB). Ghi rõ chiến lược trong Dev Notes.

- [x] **Task 9 — Regen OpenAPI + drift-guard (AC: 1, 2, 3-hợp-đồng)**
  - [x] `npm run openapi:gen` → `openapi/openapi.json` chứa 3 route `/auth/*` + schema `LoginRequestDto`/`AuthTokensDto`/`RefreshRequestDto`/`LogoutRequestDto`. **CẤM sửa tay** spec (AD-12).
  - [x] `openapi-drift.spec.ts`: giữ so byte-for-byte; thêm assert `paths['/auth/login']` + `components.schemas.AuthTokensDto` tồn tại (chứng minh FE gen được client auth). `openapi-app-context.ts` đã override `PrismaService` → sinh spec không cần DB; đảm bảo `AuthModule` nằm trong `AppModule` để controller auth được introspect.

- [x] **Task 10 — Cập nhật CONVENTIONS.md + README (tài liệu hợp đồng)**
  - [x] `CONVENTIONS.md`: thêm mục **"Auth — JWT access (stateless) + refresh opaque (revocable)"**: shape token response, luật "access=JWT ngắn / refresh=opaque băm ở `sessions` / rotate khi refresh / revoke khi logout", "login sai = `UNAUTHENTICATED` generic, chống enumeration", "guard access-token + `/me` là 2.5", "`Account` base tạo ở 2.3, quyền mở rộng ở 2.4".
  - [x] `README.md`: bước chạy migration + seed admin để đăng nhập được lúc dev.

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

Story này **CHỈ** dựng **xác thực thật ở backend** + **publish hợp đồng auth qua OpenAPI**. Cụ thể:

- **Trong phạm vi:** `Account` base (identity + password) + `Session` (refresh revocable) + migration đầu tiên; `accounts/` tối giản (read-only cho auth); băm mật khẩu argon2id; `auth/` (login/refresh/logout, JWT access + refresh opaque rotate/revoke); DTO + controller `/auth/*`; config/env + fail-fast secret; seed admin; test unit + e2e; regen OpenAPI + drift-guard; tài liệu.
- **Ngoài phạm vi (thuộc story khác — ĐỪNG làm ở đây):**
  - **Permission registry + lưu quyền theo Account** → **Story 2.4**. 2.3 tạo `Account` **base**; 2.4 **mở rộng** (thêm `AccountPermission` + cột quyền, migration riêng, KHÔNG tạo lại bảng). 2.3 **KHÔNG** khai enum quyền, **KHÔNG** literal quyền nào (AD-17).
  - **Endpoint `/me` + guard quyền server-side mỗi request** → **Story 2.5**. 2.3 **KHÔNG** tạo `JwtAuthGuard`/`/me`. Login trả **token thôi** (chưa kèm permission set — 2.5 mới trả effective permissions qua `/me`). Access JWT được ký ở 2.3 để 2.5 verify bằng **cùng secret**.
  - **FE single-interceptor + login wiring + network-loss UX (AC-3)** → nối cùng **tầng HTTP client FE** (xem Open Question #1). Web hiện **không có runtime tooling** (chưa bundler/tsc — action item Epic 1 còn mở); mobile có Flutter runtime nhưng **chưa có tầng networking**; hai màn login (`web/src/screens/auth/LoginScreen.tsx`, `mobile/lib/screens/auth/login_screen.dart`) đang là **demo**. 2.3 **publish hợp đồng envelope + token qua OpenAPI ngay** để FE gen type; hiện thực interceptor "một chỗ parse envelope + map fieldErrors" (AD-5) và UX mất-mạng land khi dựng FE HTTP client. Cùng pattern 2.2 dùng cho AC-3 của nó.
  - **EventBus port + publish domain event** → **Story 2.7**. Login/logout **KHÔNG** publish event (không nằm trong danh sách AD-18) và **KHÔNG** gọi notification/audit trực tiếp.
  - **Audit log đăng nhập** → module `audit/` (Epic 8). Không build ở đây.
  - **Quên mật khẩu / đổi mật khẩu** → **Story 2.8**. Không làm ở đây.

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-12 — Auth JWT access+refresh, OpenAPI sinh-từ-code:** access token ngắn hạn + refresh token; **session revoke được** (⇒ refresh lưu server-side ở `sessions`, logout/rotate set `revokedAt`). Thêm route/DTO auth = sửa **code** rồi `npm run openapi:gen`; **CẤM sửa tay** `openapi.json`. [Source: ARCHITECTURE-SPINE.md#AD-12]
- **AD-5 — Error envelope tập trung:** đăng nhập sai / token sai → **ném `AppException(UNAUTHENTICATED, 401)`**; **KHÔNG** controller/service tự dựng envelope — filter trung tâm (2.2) dựng. Message 401 **generic + giống nhau** mọi nhánh auth-fail (an toàn > tiện; "khi phân vân chọn phương án chặt hơn"). [Source: ARCHITECTURE-SPINE.md#AD-5, CONVENTIONS.md#Error envelope]
- **AD-8 — RBAC per-account, `accounts/domain` sở hữu `Account`:** `Account` là **nguồn danh tính duy nhất**; đặt entity ở `accounts/`. 2.3 chỉ tạo base; **cấm** nhánh identity thứ hai (không tạo `User` riêng). [Source: ARCHITECTURE-SPINE.md#AD-8]
- **AD-4 — Backend enforce mọi request; client gating chỉ UX:** 2.3 đặt nền token; **enforcement guard là 2.5**. Đừng coi việc FE giữ token là bảo mật — server verify ở 2.5. [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-1 — Chỉ `PrismaService` chạm DB:** `auth/`/`accounts/` truy vấn qua `PrismaService` (`AccountsService`, Session repo); **cấm** `new PrismaClient()` (source-guard `no-manual-prisma-client.spec.ts` enforce). [Source: ARCHITECTURE-SPINE.md#AD-1, CONVENTIONS.md]
- **Layered:** controller/DTO = tầng API; `AuthService` = Application; `Account`/quy tắc phiên = Domain; Prisma/JWT/argon2 = Infrastructure. Domain **không** phụ thuộc Infrastructure trực tiếp. [Source: ARCHITECTURE-SPINE.md#Design Paradigm]

### Đọc file bị SỬA / mở rộng (bắt buộc — trước khi code)

Giữ hành vi hiện có; đây là các file 2.1/2.2 mà 2.3 **UPDATE**:

- `backend/src/app.module.ts` — hiện import `CommonModule` + `PrismaModule` + `HealthModule`, **cố ý chưa** import module domain. **2.3 thêm:** `AuthModule` (+ `AccountsModule` được `AuthModule` import). Đây là module **domain đầu tiên** — chỉ thêm đúng cái auth cần.
- `backend/src/main.ts` — giữ `import 'dotenv/config'` **đầu file** + validate `PORT`. **2.3 thêm:** validate `JWT_ACCESS_SECRET` (fail-fast). KHÔNG thêm `useGlobalPipes/Filters` (đã qua `APP_PIPE`/`APP_FILTER` ở `CommonModule`).
- `backend/prisma/schema.prisma` — hiện **chưa có model** (chỉ `datasource`/`generator`). **2.3 thêm:** `Account` + `Session` + migration đầu tiên. Đọc comment file (giải thích driver adapter Prisma 7 + `@@map`).
- `backend/prisma.config.ts` — `datasource.url = env('DATABASE_URL')`, `migrations.path`. **2.3 thêm:** khai `seed` nếu chạy `prisma db seed` qua đây (hoặc `package.json#prisma.seed`).
- `backend/src/openapi/openapi-document.ts` — `buildOpenApiDocument` + `extraModels: [ErrorEnvelopeDto, FieldErrorDto]`. **Không cần đổi** cho DTO auth (chúng được tham chiếu bởi controller → tự vào schemas); chỉ regen.
- `backend/scripts/openapi-app-context.ts` — override `PrismaService` no-op để sinh spec/drift-guard không cần DB. Đảm bảo `AuthModule` (qua `AppModule`) introspect được **mà không** cần DB thật (service init không được `$connect`).
- `backend/test/openapi-drift.spec.ts`, `backend/test/health.spec.ts` — drift-guard so byte-for-byte (thêm assert route/DTO auth); health test không đổi hành vi.
- `backend/.env.example` — thêm biến JWT/seed (placeholder). `.env` thật gitignored, KHÔNG commit secret.
- `backend/CONVENTIONS.md`, `backend/README.md` — thêm mục auth + bước migration/seed.

### Tái dùng (scout-before-code — DRY)

- **`AppException` + `ErrorCode.UNAUTHENTICATED`** đã có (`common/errors/`) — **ném** nó cho mọi auth-fail; **KHÔNG** tạo cơ chế lỗi mới. `UNAUTHENTICATED`/`FORBIDDEN` đã được 2.2 khai sẵn "cho luồng auth thật 2.3" (xem TSDoc `error-code.ts`).
- **ValidationPipe (`APP_PIPE`) + `AllExceptionsFilter` (`APP_FILTER`)** của 2.2 tự áp cho route `/auth/*` — không cần cấu hình lại; body sai DTO tự ra `VALIDATION_ERROR` + `fieldErrors`.
- **Mẫu DTO + `@ApiProperty`** ở `health/dto/health-response.dto.ts`; **mẫu controller + `@ApiOkResponse`/`@ApiTags`** ở `health/health.controller.ts` — auth DTO/controller mirror, không phát minh phong cách.
- **`stripToCode` helper** `backend/test/util/strip-to-code.ts` — tái dùng nếu viết source-guard mới (vd "response auth không lộ passwordHash"). **KHÔNG** viết lại parser.
- **`PrismaService`** (`prisma/`) — `AccountsService`/Session repo inject nó; **mẫu override no-op** ở `openapi-app-context.ts` + `health.spec.ts` cho test không-DB.
- **Không tạo trùng:** chưa có `auth/`, `accounts/`, model nào, migration nào (xác nhận: `find backend/src` = `common/ health/ openapi/ prisma/`; `schema.prisma` rỗng model). Đây là code MỚI, không đè.

### Tra cứu kỹ thuật (pin version — xác minh bản mới nhất lúc implement)

- **NestJS 11.1.27** + **`@nestjs/jwt` ^11** (thêm mới) — `JwtModule.register(Async)`, `JwtService.signAsync`/`verifyAsync`. Access JWT payload `{ sub }`, `expiresIn` từ env.
- **`argon2`** (thêm mới, argon2id) — `hash`/`verify`. *(Bcrypt fallback nếu native build vướng trên VPS.)* **KHÔNG** dùng thuật toán băm tự chế.
- **`crypto.randomBytes`/`randomUUID`** (node:crypto, Node 24) — sinh refresh token opaque; **không** thêm lib `uuid`.
- **Prisma 7.8.0** — model + `prisma migrate dev` (migration đầu tiên). Runtime dùng driver adapter (`@prisma/adapter-pg`) đã cấu hình ở `PrismaService`; CLI đọc `DATABASE_URL` qua `prisma.config.ts`.
- **class-validator 0.15 / class-transformer 0.5** (đã có) — `@IsEmail`/`@IsString`/`@IsNotEmpty` cho `LoginRequestDto`.
- **KHÔNG** thêm `passport`/`passport-jwt` ở 2.3 (guard access-token thuộc 2.5 — cân nhắc passport ở đó; 2.3 chỉ **ký/phát** token nên `@nestjs/jwt` là đủ, YAGNI).

### Thiết kế token & phiên (chốt để dev nhất quán)

- **Access token = JWT** ký bằng `JWT_ACCESS_SECRET`, TTL ngắn (mặc định 15m), **stateless** — 2.5 guard verify. Payload tối thiểu `{ sub: accountId }` (KHÔNG nhét permission — 2.5 resolve qua `/me`).
- **Refresh token = opaque random** (không phải JWT), lưu **băm** ở `sessions.refreshTokenHash`, TTL dài (mặc định 30 ngày). Chọn opaque vì đằng nào cũng lưu server-side để **revoke** (AD-12) → không cần chữ ký; đơn giản + thu hồi tức thì.
- **Rotate** khi refresh: revoke session cũ (`revokedAt=now`) + tạo session mới → refresh token cũ dùng lại không được (giảm rủi ro replay). **Logout** = set `revokedAt` (idempotent, trung tính).
- **Chống user-enumeration:** login-fail mọi nhánh (email lạ / inactive / sai mật khẩu) → **cùng** `UNAUTHENTICATED` + **cùng** message. Cân nhắc verify hash cả khi email không tồn tại (dummy hash) để giảm lệch thời gian — tùy chọn, ghi nếu làm.
- **Không leak:** `AuthTokensDto` chỉ `{ accessToken, refreshToken, expiresIn }`; **không** trả `Account`/`passwordHash`. Không log token/hash/mật khẩu.

### Chiến lược test (quan trọng — DB vs hermetic)

- 2.1/2.2 test **hermetic** (không cần Postgres). 2.3 lần đầu chạm bảng thật (accounts/sessions).
- **Bắt buộc + luôn chạy được:** **unit `AuthService`** với `AccountsService` + Session repo **mock** (qua `PrismaService` stub), dùng **argon2 + jwt thật** → phủ login đúng/sai, refresh rotate/revoke/expired, logout idempotent, chống-enumeration (assert message ===).
- **e2e controller:** ưu tiên mock `AuthService` (hoặc app-context override `PrismaService` như `openapi-app-context.ts`) để test **wiring + DTO validation + envelope** không cần DB: body sai → `400 VALIDATION_ERROR`; creds sai → `401 UNAUTHENTICATED`; success shape `AuthTokensDto`.
- **Integration cần Postgres** (login→refresh→logout end-to-end trên DB thật): chạy khi có DB; **đừng để suite fail vì thiếu DB** — tách/skip có điều kiện, ghi rõ. [Source: project-context.md#Testing — "backend unit domain + e2e endpoint quan trọng"]

### Project Structure Notes

Cây mục tiêu — 2.3 tạo phần **in đậm**:

- `backend/src/auth/` → **`auth.module.ts`**, **`auth.service.ts`**, **`auth.controller.ts`**, **`password.service.ts`**, **`dto/login-request.dto.ts`**, **`dto/auth-tokens.dto.ts`**, **`dto/refresh-request.dto.ts`**, **`dto/logout-request.dto.ts`**, (**`session.repository.ts`** hoặc truy vấn Session trong service).
- `backend/src/accounts/` → **`accounts.module.ts`**, **`accounts.service.ts`** (read-only `findByEmail`/`findById`).
- `backend/prisma/` → **`schema.prisma`** (model `Account`+`Session`), **`migrations/*_init_auth_accounts_sessions/`**, **`seed.ts`**.
- UPDATE: `src/app.module.ts` (import `AuthModule`), `src/main.ts` (validate `JWT_ACCESS_SECRET`), `prisma.config.ts`/`package.json` (seed), `.env.example`, `openapi/openapi.json` (**regen**), `CONVENTIONS.md`, `README.md`.
- Test MỚI: `test/auth.service.spec.ts` (unit), `test/auth.e2e-spec.ts` (controller/e2e). UPDATE: `test/openapi-drift.spec.ts` (assert route/DTO auth).
- **Biến thể có chủ đích:** 2.1 comment `schema.prisma` ghi "`Account` thuộc 2.4" — 2.3 **override** vì login (2.3) cần danh tính **trước** quyền (2.4). `Account` **base** ở 2.3, **mở rộng quyền** ở 2.4 (một entity, hai story bồi đắp — KHÔNG hai entity danh tính). Ghi rõ để tránh 2.4 tạo lại bảng. **KHÔNG** tạo `guards/`/`/me` (2.5), `audit/` (E8), EventBus (2.7).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — 3 AC verbatim (access+refresh; login sai → envelope chuẩn; refresh cấp access mới + logout thu hồi; online-only lỗi cụ thể + Thử lại).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 + NFR-6] — JWT session; login required; session áp đúng permission set (permission set thuộc 2.4/2.5).
- [Source: ARCHITECTURE-SPINE.md#AD-12] — Auth JWT access(ngắn)+refresh; session **revoke được**; OpenAPI sinh-từ-code, cấm sửa tay; access/refresh TTL + rotation + revocation "chốt ở implementation" (mục Deferred).
- [Source: ARCHITECTURE-SPINE.md#AD-8, #Backend module tree] — `Account` (+`AccountPermission`) do `accounts/domain` sở hữu; `auth/` = JWT access+refresh, `/me` (2.5).
- [Source: ARCHITECTURE-SPINE.md#AD-5] — envelope tập trung; auth-fail ném `AppException`, filter dựng.
- [Source: ARCHITECTURE-SPINE.md#AD-4] — backend enforce mỗi request (guard = 2.5); client gating chỉ UX.
- [Source: _bmad-output/project-context.md] — stack (Node 24, NestJS 11.1.27, Prisma 7.8.0, Postgres 18.4), contract-first, "khi phân vân chọn phương án chặt hơn", web tooling chưa có runtime tới hết Epic 1, testing (unit domain + e2e endpoint quan trọng).
- [Source: _bmad-output/implementation-artifacts/2-2-error-envelope-thong-nhat-xu-ly-loi-tap-trung.md] — `AppException`/`ErrorCode`/`AllExceptionsFilter`/`APP_PIPE`+`APP_FILTER`; `UNAUTHENTICATED` để dành cho 2.3; quyết định publish-hợp-đồng-ngay + hoãn interceptor sang 2.3 (Open Question #1 kế thừa).
- [Source: _bmad-output/implementation-artifacts/2-1-skeleton-backend-prisma-openapi-sinh-tu-code.md + backend/prisma/schema.prisma] — skeleton chưa có model; "`Account` = 2.4" (2.3 override, xem Project Structure Notes); driver adapter Prisma 7; artifact `openapi/openapi.json` + drift-guard.
- [Source: backend/CONVENTIONS.md] — naming (entity/bảng/file/route), `@@map`, OpenAPI sinh-từ-code, error envelope, AD-1/AD-12.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- Không có Postgres cục bộ (không `psql`/`pg_isready`/docker pg) → migration đầu tiên sinh **offline** bằng `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` (không cần DB) rồi tạo thủ công thư mục `prisma/migrations/…/migration.sql` + `migration_lock.toml`. Áp bằng `prisma migrate deploy` khi có DB.
- `JwtService.signAsync({ expiresIn })` không nhận `string` thô (type `number | StringValue`) → ký bằng **giây** (`accessTokenTtlSeconds`), dùng chung một giá trị cho cả `signOptions.expiresIn` lẫn `AuthTokensDto.expiresIn`.
- `resolve_customization.py` cần Python ≥3.11 (mặc định 3.9 fail) → chạy bằng `python3.13`.

### Completion Notes List

- **AC-1 (login + envelope):** `POST /auth/login` phát `{ accessToken (JWT), refreshToken (opaque), expiresIn }`; mọi nhánh sai (email lạ / inactive / sai mật khẩu) ném `AppException(UNAUTHENTICATED, 401)` **cùng message** → filter 2.2 dựng envelope. Verify-giả bằng dummy argon2 hash khi email không tồn tại (cân bằng timing, chống enumeration).
- **AC-2 (refresh rotate + logout revoke):** refresh tra `Session` theo **SHA-256** của token, kiểm chưa revoke + chưa hết hạn → rotate (revoke phiên cũ + phát phiên mới); logout `updateMany(revokedAt:null → now)` idempotent, trung tính. Refresh sai/hết hạn/đã revoke → `UNAUTHENTICATED`.
- **AC-3 (FE UX mất-mạng):** ngoài phạm vi backend theo Open Question #1 — **hợp đồng** token + envelope đã publish qua OpenAPI (FE gen client được); interceptor + UX "Thử lại" land cùng tầng HTTP client FE.
- **Thiết kế token:** access = JWT stateless ký `JWT_ACCESS_SECRET` (fail-fast <32 ký tự ở `main.ts`); refresh = opaque `randomBytes(32)` lưu **HASH SHA-256 tất định** ở `sessions` (tra + thu hồi được, AD-12). Mật khẩu băm **argon2id** (`PasswordService`); SHA-256 chỉ cho refresh token entropy cao (không cần hàm chậm). Ghi lý do khác biệt trong code + CONVENTIONS.
- **`Account` base ở 2.3** (override note 2.1 "Account=2.4"): chỉ field xác thực, KHÔNG cột quyền — 2.4 mở rộng cùng entity (không tạo lại bảng).
- **Không leak:** `AuthTokensDto` chỉ 3 field token; e2e assert response không chứa `passwordHash`; source-guard hiện có (`no-controller-error-envelope`, `no-manual-prisma-client`, `naming-convention`) đều xanh cho code mới.
- **Test:** `test/auth.service.spec.ts` (unit hermetic — argon2+jwt thật, mock accounts+Session repo) + `test/auth.e2e.spec.ts` (controller/e2e, mock AuthService — validate DTO 400 + envelope 401 + shape 200). Integration login→refresh→logout trên DB thật để lại khi có Postgres (chiến lược test trong Dev Notes). **42/42 test xanh**, lint/format/build sạch, OpenAPI drift-guard byte-for-byte xanh.
- **Deps mới (đã được story cho phép):** `@nestjs/jwt@^11`, `argon2@^0.44` (native binding load OK trên darwin/Node 24 — KHÔNG cần fallback bcrypt).

### File List

**Mới:**
- `backend/prisma/migrations/20260708000000_init_auth_accounts_sessions/migration.sql`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/seed.ts`
- `backend/src/accounts/accounts.module.ts`
- `backend/src/accounts/accounts.service.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.config.ts`
- `backend/src/auth/password.service.ts`
- `backend/src/auth/dto/login-request.dto.ts`
- `backend/src/auth/dto/auth-tokens.dto.ts`
- `backend/src/auth/dto/refresh-request.dto.ts`
- `backend/src/auth/dto/logout-request.dto.ts`
- `backend/test/auth.service.spec.ts`
- `backend/test/auth.e2e.spec.ts`

**Sửa:**
- `backend/prisma/schema.prisma` (model `Account` + `Session`)
- `backend/src/app.module.ts` (import `AuthModule`)
- `backend/src/main.ts` (fail-fast `JWT_ACCESS_SECRET`)
- `backend/prisma.config.ts` (khai `migrations.seed`)
- `backend/tsconfig.json` / `backend/tsconfig.build.json` (đưa `prisma/**/*.ts` vào typecheck, loại khỏi build)
- `backend/.env.example` (biến JWT + seed)
- `backend/openapi/openapi.json` (regen — 3 route `/auth/*` + 4 DTO)
- `backend/test/openapi-drift.spec.ts` (assert route/DTO auth)
- `backend/CONVENTIONS.md` (mục Auth) / `backend/README.md` (bước migration + seed)
- `backend/package.json` (thêm deps `@nestjs/jwt`, `argon2`)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | **Code review (bảo mật) → Status: done.** Sửa lỗi rotate refresh KHÔNG tất định: `refresh()` revoke phiên cũ bằng `update` theo id (không điều kiện) tách rời `findUnique` ⇒ hai request đồng thời cùng một refresh token đều qua kiểm và đều phát phiên mới (phá single-use, mở replay). Chuyển sang revoke ATOMIC `updateMany({ where: { id, revokedAt: null } })` + kiểm `count === 1` làm cổng — chỉ request lật được `revokedAt` mới rotate, kẻ thua nhận `UNAUTHENTICATED`. Thêm test đua đồng thời (count=0). Suite 62/62 xanh, build + lint sạch. |
| 2026-07-08 | **Hiện thực 2.3 (dev-story):** model `Account`+`Session` + migration đầu tiên (sinh offline, không DB); `accounts/` read-only; `PasswordService` argon2id; `AuthService` login/refresh(rotate)/logout(revoke) — access JWT stateless + refresh opaque băm SHA-256 server-side; DTO + controller `/auth/*`; `main.ts` fail-fast `JWT_ACCESS_SECRET`; `.env.example` + seed admin; unit + e2e (42/42 xanh); regen OpenAPI + drift-guard route/DTO auth; CONVENTIONS/README. Deps mới: `@nestjs/jwt`, `argon2`. AC-3 (FE UX) hoãn cùng tầng HTTP client FE (Open Question #1), hợp đồng đã publish. Status → review. |
| 2026-07-08 | Tạo story context 2.3 (Đăng nhập JWT access+refresh): phạm vi backend xác thực thật — `Account` base + `Session` revocable + migration đầu tiên; `accounts/` tối giản; băm argon2id; `auth/` login/refresh(rotate)/logout(revoke); JWT access stateless + refresh opaque băm server-side; DTO/controller `/auth/*`; config + fail-fast secret; seed admin; unit+e2e; regen OpenAPI + drift-guard. Chốt 2 quyết định phạm vi: (A) `Account` base tạo ở 2.3 (override note 2.1 "Account=2.4"), 2.4 mở rộng quyền; (B) FE single-interceptor + login wiring + UX mất-mạng (AC-3) hoãn cùng tầng HTTP client FE, publish hợp đồng ngay (Open Question #1). Guard `/me` = 2.5, EventBus = 2.7 — ngoài phạm vi. |

## Open Questions

1. **FE single-interceptor + login wiring + UX mất-mạng (AC-3) làm ở 2.3 hay cùng tầng HTTP client FE?** Web **chưa có runtime tooling** (bundler/tsc — action item Epic 1 còn mở); mobile có Flutter runtime nhưng **chưa có tầng networking**; hai màn login là demo. **Đề xuất:** 2.3 hiện thực **backend auth thật + publish hợp đồng token/envelope qua OpenAPI**; hiện thực interceptor "một chỗ" (AD-5) + login screen wiring + lỗi mất-mạng + "Thử lại" **land khi dựng FE HTTP client** (web cần dựng tooling — lift lớn, riêng biệt). Rủi ro nếu ép làm ngay: phải dựng cả web tooling trong story backend-foundation (scope phình, không có runtime web để test). **Cần chủ dự án xác nhận** backend-primary, hoặc yêu cầu kèm 1 nền tảng (mobile có runtime) làm vertical-slice.
2. **Định danh đăng nhập của `Account`: `email` hay SĐT?** Đề xuất **`email` `@unique`** (chuẩn, đơn giản cho ~20 staff nội bộ). Màn demo 1.11 cho nhập "SĐT/email". `Customer` PK là SĐT E.164 (khác khái niệm — khách hàng, không phải account). Nếu muốn đăng nhập bằng SĐT, chốt định dạng/chuẩn hoá trước khi code Task 1.
3. **Route auth: verb (`/auth/login|refresh|logout`) hay REST sub-resource (`POST /auth/sessions`, `POST /auth/tokens`, `DELETE /auth/sessions`)?** Convention spine ưu tiên danh-từ-số-nhiều; nhưng `/auth/login` là quy ước phổ biến (như `/health` là ngoại lệ hạ tầng). Đề xuất **verb** cho quen thuộc + rõ ý; đổi sang sub-resource nếu muốn REST thuần (ảnh hưởng client gen — chốt trước regen OpenAPI).
4. **Access/refresh TTL cụ thể** (mục Deferred AD-12): đề xuất access **15m**, refresh **30 ngày**, refresh **rotate** mỗi lần dùng. Chốt theo yêu cầu bảo mật/tiện dụng (~20 user nội bộ, online-only).
</content>
</invoke>
