---
baseline_commit: e60ef01e51f7c68e30e4a297af2504ee9c4a41b8
---

# Story 2.5: Endpoint `/me` + guard quyền server-side mỗi request

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người dùng nội bộ**,
I want **`/me` trả bộ quyền hiệu lực và backend enforce quyền mỗi request**,
so that **UI biết ẩn/hiện gì còn bảo mật vẫn nằm ở server — gọi thẳng API mà thiếu quyền vẫn bị từ chối bất kể client hiển thị gì**.

## Acceptance Criteria

1. **Given** phiên hợp lệ (access JWT còn hạn), **When** gọi `GET /me`, **Then** backend xác thực token, phân giải Account rồi trả **effective permission set** của Account (tập key lấy từ `account_permissions`, mọi key ∈ registry) — cùng danh tính tối thiểu để UI dựng phiên (AD-4, AD-12).
2. **Given** một request tới endpoint yêu cầu quyền, **When** guard chạy, **Then** backend **enforce quyền server-side mỗi request**: thiếu/không hợp lệ token → `401 UNAUTHENTICATED`; xác thực được nhưng **thiếu quyền yêu cầu → `403 FORBIDDEN`** (envelope chuẩn AD-5). Gọi trực tiếp API mà thiếu quyền **bị từ chối bất kể client hiển thị gì** (AD-4, NFR-7).
3. **Given** mô hình bảo mật, **When** đánh giá, **Then** ẩn/disable ở client **chỉ là UX**, KHÔNG phải lớp bảo mật: một endpoint không được coi là an toàn nhờ FE giấu nút — chỉ guard server-side mới là ranh giới bảo mật (AD-4).

**Bằng chứng "done" (backend, kiểm được không cần Postgres cho phần hermetic):**
- `GET /me` tồn tại, **được guard xác thực** (không có Bearer hợp lệ → 401 envelope `UNAUTHENTICATED`, KHÔNG lộ chi tiết). Có Bearer hợp lệ → 200 `MeResponseDto { id, email, displayName, permissions: string[] }`; `permissions` là mảng key **tất định (sorted)** đúng bằng effective set của account; **KHÔNG** lộ `passwordHash` hay field nhạy cảm.
- `JwtAuthGuard` (unit, mock `JwtService` + `AccountsService`): Bearer thiếu/sai định dạng/hết hạn/chữ ký sai → ném `AppException(UNAUTHENTICATED, 401)`; token hợp lệ nhưng account không tồn tại **hoặc `isActive=false`** → 401; token hợp lệ + account active → gắn danh tính vào request, cho qua.
- `PermissionsGuard` + `@RequirePermissions(...)` (unit, mock `Reflector` + `AccountPermissionsService`): endpoint khai `@RequirePermissions(PERM.x)` mà effective set **chứa đủ** → cho qua; **thiếu bất kỳ** key nào → ném `AppException(FORBIDDEN, 403)`; endpoint KHÔNG khai `@RequirePermissions` (chỉ cần đăng nhập) → cho qua sau xác thực; route `@Public()` → bỏ qua cả hai guard.
- **Fail-closed toàn cục:** guard đăng ký qua `APP_GUARD` (mọi request mặc định phải xác thực) + `@Public()` opt-out cho `/health` và `/auth/*`. e2e chứng minh: `/health` + `/auth/login` vẫn 200/401 như cũ (regression xanh), `/me` không token → 401, một route test `@RequirePermissions` thiếu quyền → 403.
- e2e `/me` (mirror `auth.e2e.spec.ts`: override `PrismaService` no-op, ký JWT thật bằng `JwtService` với `JWT_ACCESS_SECRET` test): no token → 401; token rác → 401; token hợp lệ → 200 shape đúng.
- Source-guard `no-permission-literal-outside-registry` vẫn xanh: guard/decorator **import `PERM`/`PermissionKey`**, KHÔNG literal quyền.
- OpenAPI regen: `/me` + `MeResponseDto` + bearer security scheme vào `openapi.json`; `npm run openapi:gen` chạy; drift-guard byte-for-byte xanh. Lint/format/typecheck/`nest build` sạch.

## Tasks / Subtasks

- [x] **Task 1 — `@Public()` + `JwtAuthGuard`: xác thực access JWT mỗi request (AC: 2)**
  - [x] `src/auth/public.decorator.ts`: `export const IS_PUBLIC_KEY = 'isPublic'; export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);` — đánh dấu route **không cần xác thực** (opt-out của guard toàn cục).
  - [x] `src/auth/jwt-auth.guard.ts` (`@Injectable() implements CanActivate`): đọc metadata `IS_PUBLIC_KEY` (qua `Reflector.getAllAndOverride`, handler + class) → nếu `@Public` thì `return true`. Ngược lại: lấy header `Authorization: Bearer <jwt>`; thiếu/không phải Bearer → `AppException(UNAUTHENTICATED, 401)`. Verify JWT bằng `JwtService.verifyAsync<{ sub: string }>(token)` (secret từ `JWT_ACCESS_SECRET` như `AuthService` ký) — lỗi verify (hết hạn/chữ ký sai/malformed) → **bắt** và ném `AppException(UNAUTHENTICATED, 401)` (KHÔNG để lộ `JsonWebTokenError` ra filter → giữ envelope generic, chống enumeration).
  - [x] Phân giải account: `AccountsService.findById(payload.sub)` → **null hoặc `isActive=false`** ⇒ `AppException(UNAUTHENTICATED, 401)` (deactivate có hiệu lực ngay, không đợi hết TTL — "enforce mỗi request", chọn phương án chặt hơn). Gắn danh tính vào request: `request.account = { id, email, displayName }` (KHÔNG gắn `passwordHash`).
  - [x] **KHÔNG** đọc `process.env` trực tiếp trong guard cho secret — dùng `JwtService` đã cấu hình ở `AuthModule` (`JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })`). Verify **cùng** secret đã ký (2.3) ⇒ token do login phát ra verify được.

- [x] **Task 2 — `@RequirePermissions()` + `PermissionsGuard`: enforce quyền mỗi request (AC: 2, 3)**
  - [x] `src/auth/require-permissions.decorator.ts`: `export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions'; export const RequirePermissions = (...keys: PermissionKey[]) => SetMetadata(REQUIRE_PERMISSIONS_KEY, keys);` — **tham số kiểu `PermissionKey`** (import type từ `accounts/domain/permission-registry`), gọi bằng `PERM.xxx` (KHÔNG literal). Semantics **AND**: endpoint đòi *tất cả* key liệt kê.
  - [x] `src/auth/permissions.guard.ts` (`@Injectable() implements CanActivate`): đọc `IS_PUBLIC_KEY` → `@Public` thì `true`. Đọc `REQUIRE_PERMISSIONS_KEY` (handler + class) → **không có** metadata (endpoint chỉ cần đăng nhập, vd `/me`) ⇒ `true` (JwtAuthGuard đã lo xác thực). Có metadata: lấy `request.account.id` (JwtAuthGuard đã gắn — thứ tự guard: Jwt TRƯỚC Permissions), gọi `AccountPermissionsService.listForAccount(accountId)` → nếu effective set **chứa đủ mọi** key yêu cầu ⇒ `true`; thiếu ≥1 ⇒ `AppException(FORBIDDEN, 403, 'Không đủ quyền thực hiện')`.
  - [x] **Thứ tự guard bắt buộc:** `JwtAuthGuard` chạy trước `PermissionsGuard` (Permissions phụ thuộc `request.account`). Đăng ký `APP_GUARD` **đúng thứ tự** (Task 4). Nếu `request.account` vắng khi Permissions chạy (lỗi wiring) → coi như 401 (fail-closed), KHÔNG cho qua âm thầm.

- [x] **Task 3 — Endpoint `GET /me` + `MeResponseDto` (AC: 1)**
  - [x] `src/auth/dto/me-response.dto.ts`: `MeResponseDto` với `@ApiProperty` — `id: string`, `email: string`, `displayName: string`, `permissions: string[]` (mô tả: "bộ quyền hiệu lực, mỗi phần tử là một key trong `openapi/permissions.json`; FE dựng `PermissionSet` từ mảng này"). **KHÔNG** field nhạy cảm (`passwordHash`, token…).
  - [x] `src/auth/current-account.decorator.ts`: param decorator `@CurrentAccount()` — `createParamDecorator((_, ctx) => ctx.switchToHttp().getRequest().account)` trả `{ id, email, displayName }` (JwtAuthGuard gắn). Tránh controller đọc `request` thô.
  - [x] `src/auth/me.controller.ts` (`@ApiTags('auth')` `@Controller()` route `me` — `@Get('me')` hoặc `@Controller('me')`+`@Get()`): endpoint **chỉ cần xác thực** (KHÔNG `@RequirePermissions` — mọi phiên hợp lệ đọc được quyền CỦA MÌNH). Inject `AccountPermissionsService`; `@CurrentAccount() account` → `const perms = await listForAccount(account.id)` → trả `{ ...account, permissions: [...perms].sort() }` (**sort** cho tất định + so khớp test/FE ổn định). `@ApiOkResponse({ type: MeResponseDto })` + `@ApiBearerAuth()`.
  - [x] `/me` là **danh từ số ít có chủ ý** (như `/health`, `/auth/*` — ngoại lệ hạ-tầng, spine "Consistency Conventions: `/me` trả permission set"); KHÔNG vi phạm quy ước "route danh từ số nhiều". Ghi 1 dòng lý do ở TSDoc controller.

- [x] **Task 4 — Wiring guard toàn cục fail-closed + `@Public()` route hiện có (AC: 2, 3)**
  - [x] `AuthModule`: thêm `MeController` vào `controllers`; provide `JwtAuthGuard`, `PermissionsGuard`; đăng ký **toàn cục** qua `APP_GUARD` **đúng thứ tự** (Jwt trước Permissions):
    ```ts
    providers: [
      // …existing…
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ]
    ```
    `AuthModule` đã import `AccountsModule` (có `AccountPermissionsService` export) + `JwtModule` (có `JwtService`) → guard inject được. `Reflector` + `PrismaService` global. **Export** `JwtAuthGuard`/`PermissionsGuard`/decorator nếu module domain sau muốn `@UseGuards` cục bộ (không bắt buộc vì đã toàn cục).
  - [x] **Mark route hiện có `@Public()` (regression — bắt buộc):** guard toàn cục fail-closed ⇒ mọi route cần token TRỪ KHI `@Public`. Thêm `@Public()` cho: `HealthController.check` (`/health` phải mở — probe hạ tầng), `AuthController.login|refresh|logout` (đăng nhập/refresh/logout KHÔNG thể đòi token trước). **Nếu quên** → e2e `auth.e2e.spec.ts` + `health.spec.ts` sẽ **fail 401** (đó là lưới an toàn — sửa bằng `@Public`, KHÔNG nới guard).
  - [x] Kiểm `app.module.ts` không cần đổi (AuthModule đã trong graph; APP_GUARD khai trong AuthModule áp toàn app). Xác nhận sinh OpenAPI (`scripts/openapi-app-context.ts` → `app.init()`) không cần JWT secret lúc **build doc** (guard chỉ *khởi tạo*, không *chạy* verify khi createDocument) — nếu app-context thiếu secret mà `JwtModule.register` cần, giữ nguyên hành vi 2.3 (OpenAPI/introspect không ký token). Chạy `npm run openapi:gen` xác minh.

- [x] **Task 5 — OpenAPI: bearer security scheme + regen artifact (AC: 1)**
  - [x] `src/openapi/openapi-document.ts`: thêm `.addBearerAuth()` vào `DocumentBuilder` (khai security scheme "bearer JWT" cho FE gen client biết `/me` cần Authorization). `@ApiBearerAuth()` trên `MeController` (và mọi endpoint guarded sau). `MeResponseDto` tự vào `components.schemas` khi controller tham chiếu (như `AuthTokensDto`).
  - [x] `npm run openapi:gen` regen `openapi/openapi.json`; `test/openapi-drift.spec.ts` byte-for-byte phải xanh (regen rồi commit — CẤM sửa tay, AD-12). Xác nhận diff spec: thêm path `/me`, schema `MeResponseDto`, `securitySchemes.bearer`.
  - [x] **KHÔNG** đụng `permissions.json` (2.4) — registry không đổi ở story này (không thêm/bớt key). `/me` chỉ **tiêu thụ** registry qua `AccountPermissionsService`, không sinh artifact mới.

- [x] **Task 6 — Test hermetic (AC: 1, 2, 3)**
  - [x] **Unit `JwtAuthGuard`** `test/jwt-auth.guard.spec.ts` (mock `JwtService`/`AccountsService`/`Reflector`, dựng `ExecutionContext` giả): `@Public` → true không cần token; thiếu header → 401; header không `Bearer ` → 401; `verifyAsync` throw (hết hạn/chữ ký) → 401 (envelope generic); account null → 401; `isActive=false` → 401; hợp lệ → true + `request.account` gắn đúng `{id,email,displayName}` (KHÔNG `passwordHash`).
  - [x] **Unit `PermissionsGuard`** `test/permissions.guard.spec.ts`: `@Public` → true; không metadata `@RequirePermissions` → true; đủ quyền (effective ⊇ required) → true; thiếu 1 key → 403 `FORBIDDEN`; nhiều key AND (thiếu 1 trong nhiều) → 403; đọc `account.id` từ request đúng.
  - [x] **Unit decorator** (nhẹ) `test/auth-decorators.spec.ts`: `Public()` set metadata `IS_PUBLIC_KEY=true`; `RequirePermissions(PERM.auditRead, PERM.ordersViewAll)` set mảng key đúng thứ tự; (tùy chọn) `@CurrentAccount` trả `request.account`.
  - [x] **e2e `/me`** `test/me.e2e.spec.ts` (mirror `auth.e2e.spec.ts`: `Test.createTestingModule({imports:[AppModule]})`, override `PrismaService` no-op; **set `process.env.JWT_ACCESS_SECRET` ≥32 ký tự TRƯỚC khi compile** để `JwtModule.register` + guard dùng cùng secret; override `AccountsService.findById` + `AccountPermissionsService.listForAccount` bằng mock trả account active + set quyền; ký access JWT hợp lệ bằng một `JwtService` cùng secret hoặc lấy từ moduleRef):
    - GET `/me` không header → 401 envelope `UNAUTHENTICATED` (+ `traceId`, KHÔNG `fieldErrors`).
    - GET `/me` `Authorization: Bearer rác` → 401.
    - GET `/me` Bearer hợp lệ → 200 `{ id, email, displayName, permissions: [...] }`, `permissions` sorted đúng mock, `JSON.stringify(body)` KHÔNG chứa `passwordHash`.
  - [x] **e2e enforcement 403** (cùng file hoặc `test/permissions-enforce.e2e.spec.ts`): thêm **controller test-only** trong module e2e với `@RequirePermissions(PERM.auditRead)` (vd `GET /__test-guarded`) → Bearer hợp lệ nhưng mock `listForAccount` trả set **không** có `audit.read` → **403 FORBIDDEN**; set **có** → 200. Chứng minh AC-2 "gọi trực tiếp thiếu quyền bị từ chối". *(Nếu không muốn controller throwaway, có thể assert qua e2e ở story domain đầu tiên dùng `@RequirePermissions` — nhưng story này NÊN tự chứng minh guard hoạt động end-to-end.)*
  - [x] **Regression:** chạy `npm test` toàn bộ — `auth.e2e.spec.ts` + `health.spec.ts` phải **vẫn xanh** sau khi thêm `@Public()` (nếu đỏ 401 ⇒ thiếu `@Public`). Đây là bằng chứng fail-closed không phá route công khai.
  - [x] **Chiến lược DB:** toàn bộ test 2.5 **hermetic** (mock Prisma/services, không Postgres) — mirror 2.3/2.4. Guard verify JWT (crypto thuần) + resolve qua service mock; KHÔNG cần DB thật. Ghi rõ trong Dev Notes.

- [x] **Task 7 — CONVENTIONS.md + README (AC: 2, 3)**
  - [x] `CONVENTIONS.md` mục Auth: thêm luật **guard toàn cục fail-closed** — "mọi endpoint mặc định cần access JWT (`APP_GUARD` Jwt→Permissions); `@Public()` cho route hạ-tầng (`/health`, `/auth/*`); `@RequirePermissions(PERM.x)` (AND) cho quyền cụ thể; `@CurrentAccount()` lấy danh tính; thiếu token→401, thiếu quyền→403; client gating chỉ UX (AD-4), server enforce mỗi request (NFR-7)". Nhấn: **cấm** để endpoint nghiệp vụ mới thiếu guard/`@RequirePermissions` — quên = mở toang (dùng checklist khi thêm route domain).
  - [x] `README.md`: một dòng "`/me` trả bộ quyền hiệu lực; endpoint cần `Authorization: Bearer <accessToken>`". Nếu thêm bearer scheme OpenAPI: không cần bước lệnh mới (đã có `openapi:gen`).

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

Story này **CHỈ** dựng **hạ tầng enforce quyền server-side + endpoint `/me`**. Cụ thể:

- **Trong phạm vi:** `JwtAuthGuard` (verify access JWT, resolve account, gắn danh tính); `@Public()` opt-out + mark `/health`+`/auth/*`; `PermissionsGuard` + `@RequirePermissions()` (AND, đọc effective set qua `AccountPermissionsService` 2.4); `@CurrentAccount()`; `GET /me` + `MeResponseDto`; đăng ký `APP_GUARD` fail-closed toàn cục **đúng thứ tự**; bearer security scheme + regen OpenAPI; test hermetic (unit guard/decorator + e2e `/me` + e2e 403); cập nhật CONVENTIONS/README.
- **Ngoài phạm vi (story/epic khác — ĐỪNG làm ở đây):**
  - **Nối UI gating vào `/me`** (web/mobile fetch `/me`, swap FE stub `PERM`/`AppPerm` sang gen từ artifact, dựng nav/scope theo quyền) → **Story 2.6**. 2.5 chỉ **cung cấp** contract `/me` (shape `MeResponseDto`) + enforce; KHÔNG đụng `web/`/`mobile/`.
  - **Registry quyền / bảng `account_permissions` / seed / artifact `permissions.json`** → **đã xong Story 2.4**. 2.5 **tiêu thụ** (`listForAccount`), KHÔNG sửa registry, KHÔNG thêm/bớt key, KHÔNG đụng migration/seed.
  - **Login/refresh/logout/JWT ký-phát** → **đã xong Story 2.3**. 2.5 chỉ **verify** access JWT (đối xứng với ký ở 2.3); KHÔNG đổi `AuthService`/token TTL/refresh flow.
  - **Endpoint nghiệp vụ có `@RequirePermissions` thật** (orders/customers/…) → **Epic 3+**. 2.5 chỉ dựng cơ chế + *route test-only* để chứng minh 403; KHÔNG tạo endpoint domain.
  - **Audit ghi truy cập / EventBus** → **Story 2.7**. `/me` + guard KHÔNG publish event, KHÔNG ghi audit.
  - **Màn/UI phân quyền, form account** → **Epic 8**.
  - **Rate-limit / brute-force / rotation nâng cao** → ngoài phạm vi (deferred spine "auth token TTL/rotation/revocation chốt ở implementation" — đã chốt ở 2.3).

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-4 — Backend enforce mọi request; client gating chỉ UX:** **ĐÂY là story hiện thực hóa AD-4.** Guard server-side là ranh giới bảo mật DUY NHẤT; FE ẩn/disable không được coi là bảo mật. Fail-closed toàn cục ⇒ endpoint mới **mặc định bị khoá** cho tới khi có `@Public()`/`@RequirePermissions` — không thể "quên guard mà lộ". [Source: ARCHITECTURE-SPINE.md#AD-4, project-context.md#gotchas "Ẩn/disable UI theo quyền không phải bảo mật"]
- **AD-17 — Registry quyền, cấm literal ngoài registry:** guard/decorator **import `PERM`/`PermissionKey`**; `@RequirePermissions(PERM.x)` — KHÔNG chuỗi `'audit.read'`. Source-guard `no-permission-literal-outside-registry` sẽ fail nếu lọt literal. [Source: ARCHITECTURE-SPINE.md#AD-17, backend/CONVENTIONS.md#Permission registry]
- **AD-12 — JWT access+refresh; `/me` trả permission set; OpenAPI sinh-từ-code:** access = JWT stateless ký `JWT_ACCESS_SECRET` (2.3), guard **verify cùng secret**; `/me` là contract chính tắc cho FE lấy quyền; spec regen (`openapi:gen`), cấm sửa tay, drift-guard byte-for-byte. [Source: ARCHITECTURE-SPINE.md#AD-12 + #Consistency Conventions (`/me`, "guard server-side mỗi request; client gating chỉ UX"), backend/CONVENTIONS.md#Auth]
- **AD-8 — RBAC per-account:** effective set = tập row `account_permissions` của account (nguồn chân lý), đọc qua `AccountPermissionsService.listForAccount` (2.4). Guard KHÔNG suy quyền từ role/JWT payload — luôn resolve từ storage per-account. [Source: ARCHITECTURE-SPINE.md#AD-8]
- **AD-5 — Error envelope trung tâm:** guard **ném `AppException`** (`UNAUTHENTICATED`/`FORBIDDEN`), KHÔNG tự dựng envelope; `AllExceptionsFilter` (2.2) dựng envelope + `traceId`. Nuốt `JsonWebTokenError` → ném `AppException(UNAUTHENTICATED)` (KHÔNG leak lý do verify — envelope generic, chống enumeration như 2.3). [Source: ARCHITECTURE-SPINE.md#AD-5, backend/src/common/errors/*]
- **AD-1 — Chỉ `PrismaService` chạm DB:** guard/`/me` đọc DB **qua service** (`AccountsService`/`AccountPermissionsService`), KHÔNG `new PrismaClient()`, KHÔNG query trực tiếp. [Source: ARCHITECTURE-SPINE.md#AD-1]
- **Layered:** guard/decorator/controller = tầng **API** (NestJS infra); phụ thuộc Application service (`accounts/`), KHÔNG nhét business logic. Domain KHÔNG import guard. [Source: ARCHITECTURE-SPINE.md#Design Paradigm]

### Đọc file bị SỬA / mở rộng (bắt buộc — trước khi code)

Giữ hành vi hiện có (2.1/2.2/2.3/2.4); 2.5 **UPDATE**:

- `backend/src/auth/auth.module.ts` — hiện: import `AccountsModule`+`JwtModule.register`, controller `AuthController`, providers `AuthService`/`PasswordService`/`AUTH_CONFIG`. **2.5 thêm:** `MeController` vào `controllers`; providers `JwtAuthGuard`/`PermissionsGuard` + **hai `APP_GUARD`** (Jwt trước Permissions); export guard/decorator nếu cần. **KHÔNG** đổi JwtModule/AuthService.
- `backend/src/auth/auth.controller.ts` — **2.5 thêm:** `@Public()` cho `login`/`refresh`/`logout` (nếu không → guard toàn cục khoá đăng nhập → deadlock). Giữ nguyên logic.
- `backend/src/health/health.controller.ts` — **2.5 thêm:** `@Public()` cho `check` (`/health` phải mở cho probe hạ tầng). Giữ nguyên `$queryRaw` ping.
- `backend/src/openapi/openapi-document.ts` — **2.5 thêm:** `.addBearerAuth()` vào `DocumentBuilder`. `MeResponseDto` vào schemas tự động qua controller. Regen `openapi.json`.
- `backend/openapi/openapi.json` — **regen** (thêm path `/me`, schema `MeResponseDto`, `securitySchemes`). Artifact sinh tự động — chỉ đổi qua `openapi:gen`.
- `backend/CONVENTIONS.md`, `backend/README.md` — thêm luật guard toàn cục + `/me`.
- **KHÔNG đụng:** `permission-registry.ts`, `role-presets.ts`, `account-permissions.service.ts` (chỉ **gọi** `listForAccount`), `accounts.service.ts` (chỉ **gọi** `findById`), `schema.prisma`, `seed.ts`, migration, `permissions.json` (2.4). `auth.service.ts`/`auth.config.ts`/`password.service.ts` (2.3).

### Tái dùng (scout-before-code — DRY)

- **`JwtService`** đã cấu hình ở `AuthModule` (`JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })`) — guard **inject `JwtService`** dùng `verifyAsync`, **KHÔNG** tự đọc secret / tự verify bằng `jsonwebtoken`. Đối xứng với `AuthService.jwt.signAsync({ sub: accountId })` (2.3): payload `{ sub }` → guard đọc `payload.sub` = accountId. [Source: backend/src/auth/auth.service.ts:122-126, auth.module.ts:21]
- **`AccountsService.findById`** (2.3) — có sẵn, dùng resolve account + kiểm `isActive` trong guard. KHÔNG viết truy vấn account mới. [Source: backend/src/accounts/accounts.service.ts:23-25]
- **`AccountPermissionsService.listForAccount(accountId): Promise<Set<PermissionKey>>`** (2.4) — **API đọc quyền mà story này gọi** ở cả `/me` lẫn `PermissionsGuard`. KHÔNG tạo service quyền mới. [Source: backend/src/accounts/account-permissions.service.ts:25-31]
- **`PERM` / `PermissionKey` / `isPermissionKey`** (2.4) — import cho `@RequirePermissions(PERM.x)` + type param. KHÔNG literal. [Source: backend/src/accounts/domain/permission-registry.ts]
- **`AppException` + `ErrorCode.UNAUTHENTICATED`(401)/`FORBIDDEN`(403)`** (2.2) — **đã có sẵn** đúng mã cần; guard ném các mã này, filter dựng envelope. KHÔNG thêm mã mới, KHÔNG dựng envelope. [Source: backend/src/common/errors/error-code.ts:18-21, app.exception.ts]
- **Pattern controller + DTO + `@ApiTags`/`@ApiOkResponse`** — mirror `HealthController` (GET đơn giản) + `AuthController` + `AuthTokensDto` (DTO "không lộ field nhạy cảm"). `MeResponseDto` mirror `AuthTokensDto` (chỉ field an toàn). [Source: backend/src/health/health.controller.ts, backend/src/auth/dto/auth-tokens.dto.ts]
- **e2e pattern** — mirror `auth.e2e.spec.ts`: `Test.createTestingModule({imports:[AppModule]})` + override `PrismaService` no-op + mock service; supertest. **Khác biệt 2.5:** cần **ký JWT thật** → set `process.env.JWT_ACCESS_SECRET` (≥32) trước compile, ký bằng `JwtService` cùng secret. [Source: backend/test/auth.e2e.spec.ts]
- **Message generic auth-fail** — mirror `AuthService` (2.3): mọi nhánh 401 cùng message-ish generic, KHÔNG tiết lộ "token hết hạn" vs "account inactive" (chống enumeration). Guard nên dùng message trung tính (vd "Chưa xác thực" / reuse pattern). [Source: backend/src/auth/auth.service.ts:12-18]
- **Không tạo trùng:** chưa có guard/`/me`/decorator nào (`src/auth/` chỉ có controller/service/config/dto login-refresh-logout; `src/common/` chỉ errors/validation — KHÔNG có `guards/`). Code MỚI. [Source: file tree §Project Structure]

### Thiết kế enforce (chốt để dev nhất quán)

- **Hai guard toàn cục, fail-closed, đúng thứ tự:**
  1. `JwtAuthGuard` (APP_GUARD #1): `@Public`? → skip. Else verify Bearer → resolve account (active) → gắn `request.account`. Fail → 401.
  2. `PermissionsGuard` (APP_GUARD #2): `@Public`? → skip. Không `@RequirePermissions`? → pass (chỉ cần đăng nhập). Có? → `listForAccount` ⊇ required (AND)? pass : 403.
  Thứ tự APP_GUARD = thứ tự khai trong `providers`. Permissions **phải** sau Jwt (đọc `request.account`).
- **Vì sao toàn cục (không opt-in per-controller):** AC-2 "enforce **mỗi request**" + NFR-7 → fail-closed mặc định an toàn hơn (endpoint domain mới ở Epic 3+ **tự động** cần token; dev chỉ thêm `@RequirePermissions` cho quyền cụ thể). Opt-in `@UseGuards` từng controller **dễ quên** = lộ endpoint. Đổi lại phải `@Public()` cho `/health`+`/auth/*` (chi phí một lần, rõ ràng). Chọn phương án **chặt hơn** (project-context: "khi phân vân chọn an toàn/chặt hơn"). *(Xem Open Question #1 nếu chủ dự án muốn opt-in.)*
- **`/me` chỉ cần xác thực (không `@RequirePermissions`):** mọi phiên hợp lệ đọc được quyền CỦA CHÍNH MÌNH (không cần quyền đặc biệt để tự-đọc). Trả `permissions` **sorted** (tất định) → FE/test so khớp ổn định; FE dựng `ReadonlySet` từ mảng.
- **`isActive` check trong guard:** resolve `findById` mỗi request cho phép **deactivate có hiệu lực tức thì** (không đợi access TTL 15m hết) — đúng "enforce mỗi request" + hỗ trợ Epic 8 vô hiệu account. Chi phí: 1 query/request (~20 user nội bộ ⇒ negligible). Access JWT vẫn "stateless" ở tầng **chữ ký**; kiểm `isActive` là tầng **authorization** (chấp nhận stateful — an toàn hơn). *(Open Question #2.)*
- **Payload JWT:** `{ sub: accountId }` (2.3 KHÔNG nhét permission vào token — cố ý: quyền đổi runtime, token không stale). Guard **luôn** resolve quyền tươi từ DB, KHÔNG đọc quyền từ JWT. Đây là lý do `/me` tồn tại (một nguồn quyền: storage, không phải claim token).

### Chiến lược test (DB vs hermetic — mirror 2.3/2.4)

- **Bắt buộc + luôn chạy được (hermetic, không Postgres):** unit `JwtAuthGuard` (mock JwtService/AccountsService/Reflector), unit `PermissionsGuard` (mock Reflector/AccountPermissionsService), unit decorator (metadata), e2e `/me` + e2e 403 (override `PrismaService` no-op, mock service, ký JWT thật bằng secret test). Guard = crypto verify + service call ⇒ mock được hết, KHÔNG cần DB.
- **Regression bắt buộc:** `auth.e2e.spec.ts` + `health.spec.ts` xanh sau `@Public()` (bằng chứng fail-closed không phá route công khai).
- **Integration cần Postgres** (đọc `account_permissions` thật qua `/me` end-to-end, kiểm `isActive` DB thật): chạy khi có DB; **đừng để suite fail vì thiếu DB** — hermetic phủ đủ AC. [Source: project-context.md#Testing, 2-3/2-4 chiến lược test]
- **Gotcha JWT secret trong test:** `JwtModule.register` đọc `process.env.JWT_ACCESS_SECRET` lúc **import module** → phải `process.env.JWT_ACCESS_SECRET = '<≥32 ký tự test>'` **TRƯỚC** `Test.createTestingModule` compile (đầu file spec, hoặc `beforeAll` trước import động). Ký token test bằng `moduleRef.get(JwtService)` (cùng secret) để guard verify được.

### Previous Story Intelligence (2.4 — vừa done)

- **Chốt Open Question theo mặc định YOLO** rồi ghi rõ ở Completion Notes (không lừa dối subtask nhánh-không-chọn) — làm tương tự 2.5.
- **Source-guard literal:** guard mới **không được** chứa literal quyền (dùng `PERM`); `no-permission-literal-outside-registry.spec.ts` (dùng `strip-comments`, so theo 17 key) sẽ bắt. Đừng viết `'audit.read'` kể cả trong test config — import `PERM.auditRead`. *(Test file cũng bị quét? Guard quét `src/` — test ở `test/` nên an toàn, nhưng vẫn nên import `PERM` cho nhất quán.)*
- **Hermetic-first:** toàn bộ 2.4 test hermetic, 92 test xanh không cần Postgres — 2.5 giữ nguyên kỷ luật.
- **Prisma 7 gotcha (empty createMany):** KHÔNG liên quan 2.5 (không ghi DB); chỉ **đọc** qua `listForAccount`.
- **OpenAPI/artifact regen discipline:** thêm endpoint → PHẢI `openapi:gen` + commit; drift-guard byte-for-byte fail nếu quên (mirror design-system Epic 1). [Source: 2-4-…md#Debug Log, Completion Notes; get_observations 14752/14777]

### Git Intelligence (5 commit gần nhất)

`e60ef01 feat(story-2.4)` · `3b77460 feat(story-2.3)` · `7be0495 feat(story-2.2)` · `11cde47 feat(story-2.1)` · `74a56b6 fix(design-system)`. Pattern: mỗi story = một commit conventional `feat(story-X.Y): <mô tả tiếng Việt>`, KHÔNG tham chiếu AI. Backend dựng tăng dần: skeleton(2.1)→error-envelope(2.2)→JWT login(2.3)→registry quyền(2.4)→**enforce+`/me`(2.5)**. 2.5 khép mạch bảo mật: 2.3 phát token, 2.4 lưu quyền, 2.5 **verify token + enforce quyền**. Commit đề xuất: `feat(story-2.5): Endpoint /me + guard quyền server-side mỗi request`.

### Latest Tech Notes (versions từ project-context)

- **NestJS 11.1.27 · @nestjs/jwt ^11.0.2** — dùng `JwtService.verifyAsync` (không cần `@nestjs/passport`/`passport-jwt` — **KHÔNG có** trong deps, đừng thêm; verify trực tiếp gọn hơn, khớp cách 2.3 ký bằng `signAsync`). Guard = `CanActivate` thuần + `Reflector`. `APP_GUARD` từ `@nestjs/core`.
- **`@ApiBearerAuth()` + `DocumentBuilder.addBearerAuth()`** (@nestjs/swagger) — khai security scheme; FE gen client biết gắn `Authorization: Bearer`.
- **Node 24 LTS** — `createParamDecorator`, async guard OK. Không cần polyfill.

### Project Structure Notes

Cây mục tiêu — 2.5 tạo phần **in đậm**:

- `backend/src/auth/` → **`jwt-auth.guard.ts`**, **`permissions.guard.ts`**, **`public.decorator.ts`**, **`require-permissions.decorator.ts`**, **`current-account.decorator.ts`**, **`me.controller.ts`**, **`dto/me-response.dto.ts`**; UPDATE `auth.module.ts` (MeController + APP_GUARD ×2), `auth.controller.ts` (`@Public`).
- `backend/src/health/health.controller.ts` → UPDATE (`@Public`).
- `backend/src/openapi/openapi-document.ts` → UPDATE (`.addBearerAuth()`); `backend/openapi/openapi.json` → **regen**.
- Test MỚI: `test/jwt-auth.guard.spec.ts`, `test/permissions.guard.spec.ts`, `test/auth-decorators.spec.ts`, `test/me.e2e.spec.ts` (+ e2e 403 cùng file hoặc `test/permissions-enforce.e2e.spec.ts`).
- UPDATE: `CONVENTIONS.md`, `README.md`.
- **Biến thể có chủ đích:** guard/decorator đặt trong `auth/` (KHÔNG `common/guards/` như gợi ý spine module-tree) vì guard phụ thuộc `JwtService`(AuthModule)+`AccountsModule` — đặt ở `common/` sẽ đảo ngược phụ thuộc (common→domain). `auth/` là module nền tảng, các domain sau import guard/decorator từ đây. Ghi rõ lý do (surgical, đúng dependency direction). *(Xem Project Structure conflict bên dưới.)*

### Project Structure Notes — Alignment & Variances

- **Alignment:** route `/me` khớp spine "Consistency Conventions: `/me` trả permission set" + module-tree "`auth/` = JWT access+refresh, /me effective permissions". DTO không lộ field nhạy cảm khớp pattern `AuthTokensDto`. Error 401/403 qua `AppException`→filter khớp AD-5. File kebab-case khớp `naming-convention.spec.ts`.
- **Variance có chủ đích:** spine module-tree ghi `common/ = …guards (AD-4, AD-5)`. 2.5 đặt guard ở **`auth/`** thay vì `common/` vì hướng phụ thuộc (guard cần JwtService+AccountsModule). Đây là biến thể **có lý do**, không mâu thuẫn bất biến (bất biến = "guard enforce mỗi request", vị trí file thứ yếu). Nếu chủ dự án muốn theo đúng spine, có thể để decorator thuần (`@RequirePermissions`/`@Public`/`@CurrentAccount` — không phụ thuộc gì) ở `common/`, chỉ guard ở `auth/`. Mặc định YOLO: gộp ở `auth/` cho cohesion. *(Open Question #3.)*

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] — 3 AC verbatim (`/me` trả effective permission set từ registry; guard enforce server-side mỗi request, gọi thẳng thiếu quyền bị từ chối; client gating chỉ UX).
- [Source: ARCHITECTURE-SPINE.md#AD-4] — UI gating theo quyền, **backend luôn enforce mỗi request**; ẩn/disable chỉ UX. Story 2.5 hiện thực hóa.
- [Source: ARCHITECTURE-SPINE.md#AD-12 + #Consistency Conventions] — JWT access+refresh; Bearer header; `/me` trả permission set; "guard server-side mỗi request; client gating chỉ UX"; OpenAPI sinh-từ-code cấm sửa tay.
- [Source: ARCHITECTURE-SPINE.md#AD-17, #AD-8] — registry một nguồn (cấm literal ngoài); RBAC per-account (effective set = `account_permissions`); guard resolve quyền tươi từ storage, không từ role/token.
- [Source: ARCHITECTURE-SPINE.md#AD-5, #AD-1] — envelope trung tâm (guard ném `AppException`, filter dựng); chỉ `PrismaService` chạm DB (guard đọc qua service).
- [Source: backend/CONVENTIONS.md#Auth] — access JWT stateless payload `{ sub }` KHÔNG nhét permission (2.5 resolve qua `/me`); "guard verify access-token thuộc Story 2.5"; fail-fast secret ≥32.
- [Source: backend/src/auth/auth.service.ts, auth.module.ts, auth.config.ts] — ký JWT `{ sub: accountId }` bằng `JwtService`/`JWT_ACCESS_SECRET`; JwtModule cấu hình sẵn (guard verify đối xứng).
- [Source: backend/src/accounts/account-permissions.service.ts] — `listForAccount(accountId): Promise<Set<PermissionKey>>` (API đọc quyền cho `/me`+guard); [permission-registry.ts] — `PERM`/`PermissionKey`/`isPermissionKey`.
- [Source: backend/src/common/errors/error-code.ts] — `UNAUTHENTICATED`(401)/`FORBIDDEN`(403) đã có; [app.exception.ts, all-exceptions.filter.ts] — ném `AppException`, filter dựng envelope+traceId.
- [Source: backend/test/auth.e2e.spec.ts, health.spec.ts] — pattern e2e override PrismaService + regression phải xanh sau `@Public`.
- [Source: web/src/design-system/gating/permissions.ts + mobile/.../app_permissions.dart] — FE `PermissionSet = ReadonlySet<PermissionKey>` "Epic 2 = `/me`"; `/me` trả `permissions: string[]` để FE dựng Set (2.6 nối). Registry key-agnostic — 2.5 chỉ cấp shape + enforce.
- [Source: PRD#NFR-7] — enforce quyền server-side mỗi request (bảo mật không phụ thuộc client).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (BMAD dev-story workflow)

### Debug Log References

- **Source-guard AD-17 bắt literal trong DTO example:** `MeResponseDto` ban đầu dùng `example: ['audit.read', 'orders.view_all']` (literal quyền) → `no-permission-literal-outside-registry.spec.ts` fail (guard dùng `stripComments` GIỮ string). Sửa: `example: [PERM.auditRead, PERM.ordersViewAll]` (định danh registry, KHÔNG literal). Giá trị JSON sinh ra không đổi ⇒ drift-guard vẫn xanh.
- **Gotcha JWT secret trong e2e:** `JwtModule.register` đọc `JWT_ACCESS_SECRET` lúc *import module*. Static-import `AppModule` bị hoist → env set ở top-level không kịp. Giải: set `process.env.JWT_ACCESS_SECRET` (≥32) ở top-level + `await import('../src/app.module')` ĐỘNG trong `beforeAll` để guard + `JwtService` (lấy từ `moduleRef`) dùng cùng secret → token ký test verify được.

### Completion Notes List

Tất cả 7 task hoàn tất; 117/117 test xanh (20 suite); lint/format/build sạch; OpenAPI drift byte-for-byte xanh.

- **AC-1 (`/me` trả effective permission set):** `GET /me` (`MeController`, chỉ cần xác thực) trả `MeResponseDto { id, email, displayName, permissions: string[] }`; `permissions` = `[...listForAccount(id)].sort()` (tất định). KHÔNG lộ `passwordHash` (e2e assert `JSON.stringify` không chứa). Bearer scheme + path `/me` + schema vào `openapi.json` qua `openapi:gen`.
- **AC-2 (enforce mỗi request, 401/403):** `JwtAuthGuard` (APP_GUARD #1) verify access JWT qua `JwtService` (cùng secret 2.3), resolve account qua `AccountsService.findById`, kiểm `isActive`, gắn `request.account` — thiếu/rác/hết hạn/account null/inactive → 401. `PermissionsGuard` (APP_GUARD #2) đọc `@RequirePermissions` (AND) → effective set thiếu ≥1 key → 403. e2e chứng minh gọi thẳng `/__test-guarded` thiếu `audit.read` → 403; có → 200.
- **AC-3 (client gating chỉ UX):** guard toàn cục fail-closed là ranh giới bảo mật duy nhất; route test-only chứng minh server từ chối bất kể client. Ghi luật vào CONVENTIONS.md#Guard quyền server-side + README.
- **Open Questions chốt theo mặc định YOLO:** (1) guard **toàn cục** `APP_GUARD` fail-closed (Jwt→Permissions); (2) **có kiểm `isActive`** mỗi request (deactivate hiệu lực tức thì); (3) guard + decorator **gộp ở `auth/`** (đúng hướng phụ thuộc `JwtService`+`AccountsModule`); (4) `MeResponseDto` **4 field** tối giản. Không chọn nhánh opt-in/stateless/common/ — ghi rõ để không lừa dối.
- **Regression:** `auth.e2e.spec.ts` + `health.spec.ts` vẫn xanh sau khi thêm `@Public()` (cấp class cho `AuthController`/`HealthController`) — bằng chứng fail-closed không phá route công khai.
- **Không đụng scope 2.3/2.4:** chỉ **gọi** `listForAccount`/`findById`; KHÔNG sửa registry/`account_permissions`/`AuthService`/migration/seed. KHÔNG đụng `web/`/`mobile/` (nối FE = 2.6).

### File List

**Tạo mới (backend):**
- `src/auth/public.decorator.ts`
- `src/auth/require-permissions.decorator.ts`
- `src/auth/current-account.decorator.ts`
- `src/auth/jwt-auth.guard.ts`
- `src/auth/permissions.guard.ts`
- `src/auth/me.controller.ts`
- `src/auth/dto/me-response.dto.ts`
- `test/jwt-auth.guard.spec.ts`
- `test/permissions.guard.spec.ts`
- `test/auth-decorators.spec.ts`
- `test/me.e2e.spec.ts`

**Sửa (backend):**
- `src/auth/auth.module.ts` (thêm `MeController` + 2 `APP_GUARD` Jwt→Permissions)
- `src/auth/auth.controller.ts` (`@Public()` cấp class)
- `src/health/health.controller.ts` (`@Public()` cấp class)
- `src/openapi/openapi-document.ts` (`.addBearerAuth()`)
- `openapi/openapi.json` (regen: path `/me` + `MeResponseDto` + `securitySchemes.bearer`)
- `CONVENTIONS.md` (mục Guard quyền server-side fail-closed)
- `README.md` (mục Enforce quyền + `/me`)

**Sửa (tracking):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-5 → in-progress → review)
- `_bmad-output/implementation-artifacts/2-5-endpoint-me-guard-quyen-server-side-moi-request.md` (task checkboxes + Dev Agent Record)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-09 | Hiện thực Story 2.5: 7 file mới trong `src/auth/` (2 guard, 3 decorator, `MeController`, `MeResponseDto`) + wiring `APP_GUARD` fail-closed toàn cục (Jwt→Permissions) trong `AuthModule`; `@Public()` cho `AuthController`/`HealthController`; `.addBearerAuth()` + regen `openapi.json` (path `/me`, schema, security scheme). Test hermetic: unit `JwtAuthGuard`/`PermissionsGuard`/decorator + e2e `/me` & enforcement 403 (ký JWT thật, mock service). 117/117 test xanh, lint/format/build sạch, drift byte-for-byte xanh. Chốt 4 Open Question theo mặc định YOLO (toàn cục / có isActive / gộp `auth/` / DTO 4 field). |
| 2026-07-08 | Tạo story context 2.5 (Endpoint `/me` + guard quyền server-side mỗi request): phạm vi = `JwtAuthGuard` (verify access JWT đối xứng 2.3, resolve account active, gắn danh tính) + `@Public()` opt-out (mark `/health`+`/auth/*`) + `PermissionsGuard` + `@RequirePermissions()` (AND, đọc effective set qua `AccountPermissionsService.listForAccount` 2.4) + `@CurrentAccount()` + `GET /me`+`MeResponseDto` + đăng ký `APP_GUARD` fail-closed toàn cục đúng thứ tự (Jwt→Permissions) + bearer security scheme + regen OpenAPI + test hermetic (unit guard/decorator, e2e `/me`, e2e 403, regression `@Public`) + CONVENTIONS/README. Enforce AD-4/NFR-7: server là ranh giới bảo mật duy nhất, client gating chỉ UX. Nối FE gating = 2.6; audit truy cập/EventBus = 2.7; endpoint domain `@RequirePermissions` thật = E3+. 3 Open Question: (1) guard toàn cục fail-closed vs opt-in per-controller; (2) kiểm `isActive` mỗi request (stateful authz) vs stateless thuần; (3) vị trí guard `auth/` vs `common/` theo spine module-tree. Mặc định YOLO: toàn cục / có kiểm isActive / gộp ở `auth/`. |

## Open Questions

1. **Guard toàn cục fail-closed (`APP_GUARD`) hay opt-in per-controller (`@UseGuards`)?** Đề xuất **toàn cục** — endpoint mới mặc định khoá (an toàn hơn, khớp "enforce mỗi request" NFR-7), đổi lại phải `@Public()` cho `/health`+`/auth/*`. Opt-in gọn hơn cho route công khai nhưng **dễ quên guard** = lộ endpoint domain. Mặc định YOLO: **toàn cục**.
2. **Kiểm `isActive` (resolve `findById` mỗi request) hay verify JWT thuần stateless?** Đề xuất **có kiểm** — deactivate account có hiệu lực tức thì (không đợi TTL 15m), hỗ trợ Epic 8 vô hiệu account; chi phí 1 query/request negligible (~20 user). Stateless thuần nhanh hơn nhưng account bị vô hiệu vẫn dùng được token tới hết TTL. Mặc định: **có kiểm isActive**.
3. **Vị trí guard: `auth/` (cohesion, đúng dependency) hay `common/guards/` (theo spine module-tree)?** Đề xuất **`auth/`** vì guard phụ thuộc `JwtService`+`AccountsModule`; đặt `common/` đảo ngược phụ thuộc. Có thể tách decorator thuần (`@Public`/`@RequirePermissions`/`@CurrentAccount`) sang `common/` nếu muốn domain module import mà không kéo `auth/`. Mặc định: **gộp `auth/`**, export cho domain sau.
4. **`MeResponseDto` có thêm field ngoài `{id,email,displayName,permissions}`?** (vd `roles`, `createdAt`) — đề xuất **tối giản** đúng AC (danh tính + quyền); thêm khi FE thực cần (2.6). Mặc định: 4 field.
</content>
</invoke>
