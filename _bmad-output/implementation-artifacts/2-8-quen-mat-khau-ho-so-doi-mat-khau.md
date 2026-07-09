---
baseline_commit: d97f9bc1ef7ac21ca8bfd5c0d9eeba77a02ad71d
---

# Story 2.8: Quên mật khẩu + Hồ sơ & đổi mật khẩu

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người dùng nội bộ**,
I want **đặt lại mật khẩu qua mã xác thực và xem hồ sơ + tự đổi mật khẩu**,
so that **tôi tự khôi phục được truy cập khi quên mật khẩu và tự quản lý tài khoản của mình, mọi thay đổi mật khẩu để lại vết Audit bất biến**.

## Acceptance Criteria

1. **AC-1 — Quên mật khẩu: phát mã, đặt mật khẩu mới, lỗi trả envelope chuẩn.** **Given** màn Quên mật khẩu, **When** người dùng yêu cầu đặt lại, **Then** backend sinh **mã 6 chữ số** (CSPRNG), lưu **HASH** của mã kèm `expiresAt` (5 phút) + bộ đếm số lần thử, **publish domain event** `PasswordResetRequested` qua `EventBus` (AD-18 — producer KHÔNG tự gửi mã/không gọi notification trực tiếp); người dùng nhập mã + mật khẩu mới → mật khẩu được cập nhật, mã bị **tiêu thụ (single-use)**, **mọi phiên hiện có bị thu hồi**. Mọi thao tác lỗi trả **envelope chuẩn** do filter trung tâm dựng (AD-5).
   - **Chống user-enumeration (bắt buộc):** `POST /auth/forgot-password` trả **cùng một response** (`200 { expiresInSeconds }`) dù email tồn tại hay không, với **thời gian phản hồi cân bằng** (mirror `dummyHash` của `AuthService.login`). `POST /auth/reset-password` trả **một** `AppException(UNAUTHENTICATED, 401)` + **một message duy nhất** cho MỌI nhánh sai (email lạ / không có mã sống / mã sai / mã hết hạn / vượt số lần thử).
   - **Mã KHÔNG BAO GIỜ xuất hiện trong response/DTO/log.** Không có DTO nào mang field mã; `forgot-password` chỉ trả `expiresInSeconds` (hằng số từ config).

2. **AC-2 — Hồ sơ: đổi mật khẩu có kiểm mật khẩu cũ, ghi Audit QUA EVENT.** **Given** màn Hồ sơ, **When** người dùng đổi mật khẩu, **Then** backend **verify mật khẩu hiện tại** (`PasswordService.verify`), từ chối mật khẩu mới trùng mật khẩu cũ, cập nhật `passwordHash` (argon2id), **thu hồi mọi phiên**, rồi **publish** `PasswordChanged` qua `EventBus` → `AuditSubscriber` ghi `AuditLog` **append-only**.
   - **Audit đi QUA event, KHÔNG gọi trực tiếp:** `AuthService`/`PasswordResetService` **CHỈ** inject `EventBus`; **CẤM** inject `AuditService`/`NotificationDispatcher` (source-guard `no-direct-side-effect-outside-eventbus` enforce).
   - **KHÔNG vật liệu mật khẩu trong Audit:** `before`/`after` của cả 3 event **KHÔNG** chứa mật khẩu thô, `passwordHash`, hay mã xác thực. Audit chỉ ghi *sự kiện đã xảy ra* (ai/gì/đối tượng/khi nào).

3. **AC-3 — Hai màn dựng từ design system, parity web+mobile.** **Given** cả hai màn (Quên mật khẩu, Hồ sơ), **When** dựng, **Then** compose 100% từ component đã ship (`Field`/`AppField`, `Button`/`AppButton`, `Banner`/`AppBanner`, `Card`/`AppCard`, `Frame`/`AppFrame`, `Stepper`/`AppStepper`) — **cấm** `<input>`/`<button>` trần, **cấm** style ad-hoc (AD-13); nhãn tiếng Việt **byte-identical** web↔mobile (UX-DR-27); màn Quên mật khẩu **không có** nav xác thực (web `sidebar={null}`, mobile không bottom-nav — UX-DR-15); màn Hồ sơ nằm **trong** app shell (web Sidebar, mobile bottom-nav tab Menu).

**Bằng chứng "done":**

*Backend (hermetic — KHÔNG cần Postgres):*
- `POST /auth/forgot-password` email tồn tại **và** email lạ → **cùng** `200` + **cùng** body shape; assert hai nhánh cùng đi qua một lần hash (cân bằng timing). Email lạ → **KHÔNG** tạo row, **KHÔNG** publish event.
- Đang có mã sống (chưa hết hạn, chưa tiêu thụ) → gọi lại `forgot-password` **KHÔNG** sinh mã mới (cooldown = vòng đời mã), vẫn trả `200` trung tính.
- `POST /auth/reset-password`: mã đúng → `204`, `passwordHash` đổi, `consumedAt` set, **mọi** `Session.revokedAt` được set; dùng lại **chính** mã đó → `401` (single-use).
- Mã sai `MAX_ATTEMPTS` lần → lần kế tiếp `401` **kể cả khi nhập đúng mã** (bộ đếm khoá mã); `attemptCount` tăng **atomic** (`updateMany` có điều kiện, mirror rotate refresh của 2.3).
- Mã hết hạn → `401`. Bốn nhánh sai (email lạ / không mã / mã sai / hết hạn / quá số lần) trả **message giống hệt nhau** (assert `===`).
- `POST /auth/change-password`: sai mật khẩu hiện tại → `401`; mật khẩu mới == mật khẩu cũ → `400 VALIDATION_ERROR` + `fieldErrors[].field === 'newPassword'`; đúng → `204` + `passwordHash` đổi + mọi phiên thu hồi.
- DTO sai (mã không đủ 6 số, mật khẩu <8 ký tự hoặc thiếu chữ/số) → `400 VALIDATION_ERROR` + `fieldErrors` (ValidationPipe 2.2).
- **Event contract:** publish đúng **3** concrete event `PasswordResetRequested` / `PasswordResetCompleted` / `PasswordChanged` qua `EventBus` (mock port), đúng `type`/`actorAccountId`/`target={type:'Account',id}`/`occurredAt`; assert **`before`/`after` KHÔNG chứa** chuỗi mật khẩu thô, `passwordHash`, hay mã.
- Không response/log nào chứa `passwordHash` hoặc mã xác thực.
- `openapi/openapi.json` **regen** chứa 3 route mới + DTO; drift-guard byte-for-byte xanh. `permissions.json` **KHÔNG đổi** (không quyền mới — self-service).
- Toàn bộ suite hiện có (26 suite / 134 test) **vẫn xanh**; 6 source-guard hiện có xanh; lint/format/`nest build` sạch.

*FE (text-guard web + `flutter test` mobile — KHÔNG cần app-runtime):*
- `design-system/screens/forgot-password.test.mjs` + `profile.test.mjs` (mirror `login.test.mjs`): mỗi màn import component design-system; dùng `size="lg"`/`AppFieldSize.large`, `variant="primary"`/`AppButtonVariant.primary`, `type="password"`/`obscureText: true`, `tone="danger"`/`AppBannerTone.danger`; **KHÔNG** `fetch(`/`axios`/`http`/`dio` (transport chỉ qua port tiêm); nhãn VN **byte-identical** web↔Dart.
- Guard: `ForgotPasswordScreen` **không** tham chiếu `Sidebar`, truyền `sidebar={null}`; `forgot_password_screen.dart` **không** dùng `AppBottomNav`. `ProfileScreen`/`profile_screen.dart` **có** shell.
- `mobile/test/screens/...`: submit rỗng → `AppBanner`; mã ≠ 6 số → banner đúng message; mật khẩu mới không khớp xác nhận → banner; mật khẩu yếu → banner; password field `obscureText == true`.
- CSS màn mới: 0 `box-shadow` / `gradient` / `drop-shadow`; chỉ dùng `var(--token)` đã định nghĩa; radius qua `var(--radius*)`.
- `cd design-system && npm test` + `cd mobile && flutter test && flutter analyze` xanh, **0 regression** (162 Node + 107 flutter hiện có).

## Tasks / Subtasks

- [ ] **Task 1 — Prisma: model `PasswordResetCode` + migration (AC: 1)**
  - [ ] `prisma/schema.prisma` **thêm model** (KHÔNG tạo lại `accounts`/`sessions`/`account_permissions`/`audit_logs`):
    ```prisma
    /// Mã đặt lại mật khẩu — LƯU HASH, không bao giờ lưu/đọc mã thô (mirror Session.refreshTokenHash, AD-12).
    /// Mã entropy thấp (6 chữ số) ⇒ an toàn dựa vào: TTL ngắn + single-use + trần số lần thử + response trung tính.
    /// Tra cứu theo `accountId` (KHÔNG theo hash) — mã 6 số có thể trùng hash giữa các account.
    model PasswordResetCode {
      id           String    @id @default(uuid())
      accountId    String    @map("account_id")
      account      Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
      codeHash     String    @map("code_hash")
      attemptCount Int       @default(0) @map("attempt_count")
      expiresAt    DateTime  @map("expires_at")
      consumedAt   DateTime? @map("consumed_at")
      createdAt    DateTime  @default(now()) @map("created_at")

      @@index([accountId])
      @@map("password_reset_codes")
    }
    ```
    Thêm `passwordResetCodes PasswordResetCode[]` vào `Account`.
  - [ ] Migration mới tên mô tả hành vi: `add_password_reset_codes` (KHÔNG nhét số story vào tên). Không có Postgres cục bộ → sinh **offline** bằng `prisma migrate diff --from-schema <schema-cũ> --to-schema prisma/schema.prisma --script` (mirror Debug Log 2.3/2.7), rồi `npm run prisma:generate`. **KHÔNG sửa tay SQL.**

- [ ] **Task 2 — Config + env (AC: 1)**
  - [ ] `src/auth/auth.config.ts`: mở rộng `AuthConfig` + `loadAuthConfig()` thêm `passwordResetTtlMs` (env `PASSWORD_RESET_CODE_TTL_MINUTES`, default **5**) và `passwordResetMaxAttempts` (env `PASSWORD_RESET_MAX_ATTEMPTS`, default **5**). Giữ nguyên `accessTokenTtlSeconds`/`refreshTokenTtlMs`.
  - [ ] `.env.example`: thêm hai biến (giá trị mặc định, KHÔNG secret).

- [ ] **Task 3 — Concrete domain events (DOMAIN thuần) — producer ĐẦU TIÊN của AD-18 (AC: 1, 2)**
  - [ ] `src/auth/domain/password-events.ts` — 3 event conform `DomainEvent` (2.7 chỉ khai base contract; concrete event do **story sở hữu** khai — đây là story đầu tiên có producer thật):
    - `PasswordResetRequested` — `type: 'PasswordResetRequested'`, `actorAccountId = account.id`, `target = { type: 'Account', id: account.id }`.
    - `PasswordResetCompleted` — như trên.
    - `PasswordChanged` — như trên.
  - [ ] **BẮT BUỘC:** `before`/`after` **KHÔNG** mang mật khẩu thô, `passwordHash`, hay mã xác thực. `AuditLog` chỉ Super Admin đọc nhưng vẫn là **bản ghi bất biến vĩnh viễn** — không đặt bí mật vào đó. Chỉ ghi *đã xảy ra*: `after: { changedAt: <ISO> }` (hoặc bỏ hẳn `before`/`after`).
  - [ ] KHÔNG import Nest/Prisma vào file này (Domain không phụ thuộc Infrastructure).

- [ ] **Task 4 — `AccountsService`: write method tối thiểu (AC: 1, 2)**
  - [ ] Thêm `updatePasswordHash(accountId, passwordHash): Promise<void>` (qua `PrismaService`, AD-1). **KHÔNG** thêm method thừa (YAGNI) — CRUD account đầy đủ là **Epic 8 / FR-16**.

- [ ] **Task 5 — `PasswordResetService` (AC: 1)**
  - [ ] `src/auth/password-reset.service.ts` (`@Injectable()`), inject `AccountsService`, `PasswordService`, `PrismaService`, `EventBus`, `AUTH_CONFIG`.
  - [ ] `requestCode(email): Promise<{ expiresInSeconds }>`:
    1. `accounts.findByEmail(email)`; **luôn** thực hiện một lần `passwords.hash(...)` (mã thật **hoặc** mã giả khi account không tồn tại/`!isActive`) để cân bằng timing — mirror `dummyHash` của `AuthService`.
    2. Không có account hợp lệ → **return response trung tính** (không tạo row, không publish).
    3. Đang tồn tại mã **sống** (`consumedAt == null && expiresAt > now`) → **cooldown**: KHÔNG sinh mã mới, vẫn trả response trung tính. *(Cooldown = vòng đời mã ⇒ khớp countdown "Gửi lại mã sau MM:SS" của mockup mà KHÔNG cần cột mới.)*
    4. Sinh mã: `randomInt(0, 1_000_000).toString().padStart(6, '0')` (`node:crypto` — **rejection sampling, không modulo bias**). Hash bằng `passwords.hash` (argon2id). `prisma.passwordResetCode.create({ codeHash, expiresAt, accountId })`.
    5. `eventBus.publish(new PasswordResetRequested(...))` — **đây là seam gửi mã** (AD-18). Producer KHÔNG gửi email/SMS/FCM.
    6. Trả `{ expiresInSeconds }` từ config.
  - [ ] `reset(email, code, newPassword): Promise<void>`:
    1. Tra account; tra mã sống mới nhất (`orderBy createdAt desc`). Nhánh nào thiếu → verify với hash giả rồi ném `AppException(UNAUTHENTICATED, 401, RESET_FAILED_MESSAGE)`.
    2. **Tăng attempt ATOMIC** trước khi verify: `updateMany({ where: { id, consumedAt: null, attemptCount: { lt: max } }, data: { attemptCount: { increment: 1 } } })`; `count === 0` → ném cùng lỗi (mirror cổng atomic của `AuthService.refresh` 2.3).
    3. `passwords.verify(row.codeHash, code)` sai → ném cùng lỗi (attempt đã bị tính).
    4. Đúng → `prisma.$transaction`: set `consumedAt = now` (single-use), `accounts.updatePasswordHash(...)`, `session.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: now } })` (**thu hồi mọi phiên**).
    5. **Sau khi commit** → `eventBus.publish(new PasswordResetCompleted(...))`.
  - [ ] `RESET_FAILED_MESSAGE` = **một hằng string duy nhất** cho mọi nhánh sai (mirror `AUTH_FAILED_MESSAGE`). KHÔNG dựng envelope trong service (chỉ ném `AppException`).

- [ ] **Task 6 — `AuthService.changePassword` (AC: 2)**
  - [ ] `changePassword(accountId, currentPassword, newPassword)`:
    1. `accounts.findById`; `passwords.verify(account.passwordHash, currentPassword)` sai → `AppException(UNAUTHENTICATED, 401, 'Mật khẩu hiện tại không đúng')`.
    2. Mật khẩu mới **trùng** mật khẩu hiện tại → `AppException(VALIDATION_ERROR, 400, ..., [{ field: 'newPassword', code: 'sameAsCurrent', message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' }])`.
    3. Cập nhật hash → **rồi** thu hồi mọi phiên (thứ tự này an toàn: nếu update lỗi thì phiên không bị huỷ oan).
    4. `eventBus.publish(new PasswordChanged(...))` sau khi ghi thành công.
  - [ ] `AuthService` inject thêm **`EventBus`** (port công khai — được phép). **CẤM** inject `AuditService`/`NotificationDispatcher`.

- [ ] **Task 7 — DTO + controller + OpenAPI (AC: 1, 2)**
  - [ ] DTO (`@ApiProperty` + class-validator, mirror `LoginRequestDto`):
    - `ForgotPasswordRequestDto { email: string }` — `@IsEmail()`.
    - `ForgotPasswordResponseDto { expiresInSeconds: number }` — **hằng số**, không tiết lộ tồn tại account.
    - `ResetPasswordRequestDto { email, code, newPassword }` — `@IsEmail()`; `@Matches(/^\d{6}$/)`; password policy (dưới).
    - `ChangePasswordRequestDto { currentPassword, newPassword }`.
  - [ ] **Password policy** (hợp đồng UX từ mockup: *"Tối thiểu 8 ký tự, có chữ và số"*): `@MinLength(8)` + `@Matches(/(?=.*[A-Za-z])(?=.*\d)/)` với `message` tiếng Việt. Khai **một** decorator/hằng dùng chung cho `newPassword` ở cả hai DTO (DRY). *(Xem Open Question #5 — NIST 800-63B Rev 4 khuyến nghị BỎ composition rule; ta giữ theo hợp đồng UX đã chốt.)*
  - [ ] `auth.controller.ts` (class đã `@Public()`): thêm `POST /auth/forgot-password` (200, `ForgotPasswordResponseDto`) và `POST /auth/reset-password` (204).
  - [ ] `POST /auth/change-password` **cần xác thực** ⇒ đặt trong **controller riêng** `src/auth/change-password.controller.ts` (`@ApiBearerAuth()`, **KHÔNG** `@Public()`, **KHÔNG** `@RequirePermissions` — self-service; guard toàn cục 2.5 lo xác thực), dùng `@CurrentAccount()`. *(Không thêm `@Public()` cấp method vào `AuthController` — cả class đang `@Public()`; tách controller là cách an toàn nhất để không nới guard.)*
  - [ ] `@ApiUnauthorizedResponse({ type: ErrorEnvelopeDto })` cho reset/change. Controller **KHÔNG** dựng envelope.
  - [ ] `npm run openapi:gen` → commit `openapi/openapi.json`. Cập nhật assert route/DTO mới trong `test/openapi-drift.spec.ts`. **CẤM sửa tay spec.**

- [ ] **Task 8 — Wiring module (AC: 1, 2)**
  - [ ] `auth.module.ts`: thêm `PasswordResetService` vào `providers`, `ChangePasswordController` vào `controllers`. `EventBus` inject được (EventsModule `@Global`) — **KHÔNG** import `AuditModule`/`NotificationsModule`.
  - [ ] `app.module.ts` **KHÔNG đổi** (AuthModule đã đăng ký).

- [ ] **Task 9 — Test backend hermetic (AC: 1, 2)**
  - [ ] `test/password-reset.service.spec.ts` (mock Prisma + `EventBus`, argon2 thật): cân bằng timing/không-publish với email lạ; cooldown khi còn mã sống; single-use; trần attempt (atomic `count === 0`); mã hết hạn; **mọi** nhánh sai cùng message (assert `===`); thu hồi phiên khi reset thành công.
  - [ ] `test/change-password.spec.ts`: sai mật khẩu hiện tại → 401; trùng mật khẩu cũ → 400 + `fieldErrors[0].field === 'newPassword'`; thành công → hash đổi + phiên thu hồi + publish `PasswordChanged`.
  - [ ] `test/password-events.spec.ts` (**security assertion**): với cả 3 event, `JSON.stringify(event)` **KHÔNG** chứa mật khẩu thô, mã, hay `passwordHash`.
  - [ ] `test/password-reset.e2e.spec.ts` (mirror `auth.e2e.spec.ts` — mock service): DTO sai → `400 VALIDATION_ERROR` + `fieldErrors`; `forgot-password` email lạ vs tồn tại → **cùng** status + body; `reset-password` sai → `401` envelope; `change-password` thiếu Bearer → `401` (chứng minh KHÔNG `@Public()`).
  - [ ] Regression: `npm test` toàn bộ xanh; 6 source-guard hiện có xanh (đặc biệt `no-direct-side-effect-outside-eventbus` — chứng minh `auth/` chỉ chạm `EventBus`).

- [ ] **Task 10 — FE port + mở rộng session provider (AC: 3)**
  - [ ] Web `web/src/design-system/session/password-port.ts` (mirror `me-port.ts`):
    ```ts
    export interface PasswordPort {
      requestResetCode(email: string): Promise<{ expiresInSeconds: number }>;
      resetPassword(input: { email: string; code: string; newPassword: string }): Promise<void>;
      changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
    }
    ```
    + `fake-password-port.ts` (test/demo). Comment TODO: impl HTTP thật (gắn Bearer, parse envelope AD-5) **land cùng app-runtime**.
  - [ ] Mobile song sinh: `mobile/lib/design_system/session/password_port.dart` + `fake_password_port.dart`.
  - [ ] **Mở rộng provider để phơi danh tính** (màn Hồ sơ cần `displayName`/`email`): provider **đã fetch `/me` nhưng VỨT BỎ** payload — `PermissionsProvider.tsx:59-60` chỉ giữ `toPermissionSet(me)`, không lưu `me`. Phải **lưu lại** rồi phơi: web `usePermissions()` trả thêm `me: MeResponse | null`; mobile `PermissionsScope` thêm field `me` (`app_session.dart` tương tự). **Additive** — chữ ký `Gate`/`can`/`filterNav`/`orderScope` KHÔNG đổi; test 1.10/2.6 phải xanh nguyên. **KHÔNG** gọi `/me` lần thứ hai cho màn Hồ sơ.
  - [ ] Export qua barrel `session/index.ts` / `session.dart`.

- [ ] **Task 11 — Màn Quên mật khẩu (web + mobile) (AC: 3)**
  - [ ] Web `web/src/screens/auth/ForgotPasswordScreen.tsx` + `forgot-password.css`; mobile `mobile/lib/screens/auth/forgot_password_screen.dart`.
  - [ ] Compose: `WebShell sidebar={null}` / `AppPhoneFrame` (+ `AppTopbar` back→login, **KHÔNG** `AppBottomNav`) → `Card`/`AppCard` → `Stepper`/`AppStepper` 2 bước → `Banner tone="info"` (mã đã gửi + hết hạn) → 4 `Field` → `Button variant="primary" size="wide"` → link "Gửi lại mã sau MM:SS".
  - [ ] **State machine trong component** (không router): `step: 'request' | 'verify'`. Bước 1 gọi `port.requestResetCode(email)` → sang bước 2, hiện Banner info với **email đã che client-side** (`ab•••@domain`) + đếm ngược từ `expiresInSeconds`. Bước 2 gọi `port.resetPassword(...)`.
  - [ ] Validation trình bày (mirror `LoginScreen._submit`), lỗi hiện qua **một** `Banner tone="danger" role="alert"` đầu form (`Field` **không có** slot lỗi riêng — đừng phát minh).
  - [ ] Đếm ngược: `useEffect` + `setInterval` (web) / `Timer.periodic` (mobile) — **dọn dẹp** khi unmount/`dispose()`.
  - [ ] Nối link "Quên mật khẩu?" của màn Đăng nhập: đổi từ stub sang **callback prop** `onForgotPassword?: () => void` (web `<a href="#">` → `<button type="button">`; mobile `GestureDetector onTap`). **KHÔNG** thêm router (app-runtime).

- [ ] **Task 12 — Màn Hồ sơ (web + mobile) (AC: 2, 3)**
  - [ ] Web `web/src/screens/account/ProfileScreen.tsx` + `profile.css`; mobile `mobile/lib/screens/account/profile_screen.dart`.
  - [ ] Web: **trong** `WebShell` với `<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} />` (đọc từ `usePermissions()`). Mobile: **trong** `AppMobileShell` (topbar eyebrow `TÀI KHOẢN` + `AppBottomNav` activeIndex = Menu).
  - [ ] Khối thông tin: `Card variant="teal"` — avatar `ic-user`, `displayName`, danh sách `Tên hiển thị` / `Email` / `Trạng thái` (`Đang hoạt động`). **Chỉ render field có thật** trong `/me` (xem Quyết định #3).
  - [ ] Khối đổi mật khẩu: `Frame label="Đổi mật khẩu"` / `AppFrame(label: 'Đổi mật khẩu')` → 3 `Field type="password"` → `Banner tone="info"` mang hint policy + "Đổi mật khẩu sẽ ghi vào Audit log." → `Button variant="ghost"` Huỷ + `Button variant="primary"` Cập nhật mật khẩu. Gọi `port.changePassword(...)`.
  - [ ] `notecard` và `kv` (mockup) **không có** trong design system → compose bằng `Banner tone="info"` + `Card` + text token. **KHÔNG** thêm component design-system mới (sẽ kéo theo parity + source-guard, ngoài phạm vi).

- [ ] **Task 13 — Guard FE + parity (AC: 3)**
  - [ ] `design-system/screens/forgot-password.test.mjs` + `design-system/screens/profile.test.mjs` — mirror `screens/login.test.mjs`: (a) compose từ design-system; (b) canonical size/variant/tone; (c) `type="password"`/`obscureText: true`; (d) **nhãn VN byte-identical** web↔Dart; (e) **KHÔNG** `fetch(`/`axios`/`XMLHttpRequest`/`http`/`dio` trong file màn (transport chỉ qua port); (f) forgot: `sidebar={null}` + không `Sidebar`/`AppBottomNav`; profile: có shell.
  - [ ] CSS màn mới: 0 `box-shadow`/`gradient`/`drop-shadow`/`filter:`; radius chỉ `var(--radius*)`; **không** literal `999px`/`9999px`; chỉ dùng `var(--token)` đã định nghĩa trong `tokens.css`.
  - [ ] `mobile/test/screens/auth/forgot_password_screen_test.dart` + `mobile/test/screens/account/profile_screen_test.dart` (mirror `login_screen_test.dart`, host bằng `MaterialApp(home: Scaffold(body: ...))`, inject `FakePasswordPort`).
  - [ ] Chạy: `cd design-system && npm test`, `cd mobile && flutter test && flutter analyze`. **0 regression.**

- [ ] **Task 14 — Tài liệu (AC: 1, 2)**
  - [ ] `backend/CONVENTIONS.md` mục **"Đặt lại / đổi mật khẩu"**: mã 6 số lưu **hash**, TTL + single-use + trần attempt + response trung tính; **thu hồi mọi phiên** sau reset/change; **audit qua `EventBus`**, không gọi trực tiếp; **cấm** đưa bí mật vào payload event.
  - [ ] `backend/README.md`: một dòng về ba route mới + hai biến env.
  - [ ] **KHÔNG** đụng `permissions.json`, `permission-registry.ts`, `role-presets.ts`, `seed.ts`.

## Dev Notes

### Ranh giới phạm vi (đọc TRƯỚC — chống scope-creep)

- **Trong phạm vi:** backend **thật** (model `PasswordResetCode` + migration; `PasswordResetService`; `AuthService.changePassword`; 3 route + DTO; regen OpenAPI); **3 concrete domain event** đầu tiên + publish qua `EventBus`; hai màn **presentational** trên cả hai nền tảng, compose từ design system, transport qua **port tiêm** (`PasswordPort`) + fake port; provider phơi thêm `me`; guard/parity test; CONVENTIONS/README.
- **NGOÀI phạm vi (ĐỪNG làm ở đây):**
  - **App-runtime web** (bundler/tsc/router/HTTP client/token store) + **app-runtime mobile** (`main.dart`, `android/`, `ios/`, `dio`, BLoC) → nợ TD-1/TD-2, story app-scaffold riêng. **Đừng cố `tsc` `web/`.**
  - **Kênh gửi mã thật** (email/SMS) → **không tồn tại trong stack**; xem Quyết định #1 + Open Question #1.
  - **CRUD account, Role preset, ma trận quyền, cột `phone`/`username`/`lastLoginAt`** → **Epic 8** (FR-16/17/18). 2.8 chỉ thêm **một** write method `updatePasswordHash`.
  - **Endpoint đọc Audit** (`audit.read`, Super Admin) → **Story 8.5**. 2.8 chỉ **ghi** qua event.
  - **Bộ gửi FCM / `DeviceToken` / resolver theo quyền** → **Epic 9**.
  - **Rate-limit toàn cục (`@nestjs/throttler`)** → xem Open Question #4 (mặc định: hoãn; trần attempt + cooldown + response trung tính đã chặn brute-force/enumeration).
  - **Sửa hồ sơ (đổi `displayName`)** → mockup Hồ sơ là **chỉ đọc**; không có affordance sửa. Xem Quyết định #3 + Open Question #3.
  - **Component design-system mới** (`notecard`, `kv`, `Field` có slot lỗi/`textAlign`) → compose từ cái đã có; thêm mới sẽ kéo theo SSOT/generator/parity guard.

### Quyết định chốt (mặc định YOLO — ghi rõ nhánh không chọn)

**#1 — "Hệ thống gửi mã" đi qua seam `EventBus`, KHÔNG thêm dependency email/SMS.**
Scout xác nhận **toàn bộ backend không có** nodemailer/SMTP/Twilio/SMS/OTP/`firebase-admin`; spine cũng **không** liệt kê kênh gửi ở mục Deferred. Ba phương án:
- **(A) Publish `PasswordResetRequested` qua `EventBus`; `NotificationDispatcher` (no-op/log) là consumer.** ✅ **Chọn.** Đúng AD-18 ("producer KHÔNG gọi FCM/notification trực tiếp"), 0 dependency mới, 0 quyết định hạ tầng. Epic 9 thay implementation dispatcher → **không mở lại code 2.8** (đúng lời hứa AC-3 của 2.7).
- (B) Thêm `nodemailer` + SMTP: kéo theo dep mới + secret + nhà cung cấp + quyết định vận hành mà spine chưa duyệt → vượt phạm vi story nền tảng.
- (C) Trả mã trong response: **tuyệt đối không** (lỗ hổng chiếm tài khoản).

> ⚠️ **Hệ quả phải nói thẳng:** với (A), **Phase 1 mã KHÔNG thực sự đến tay người dùng cuối** — nó chỉ được `Logger.log` phía server. Luồng Quên mật khẩu **chưa dùng được self-service thật** cho tới khi có kênh gửi. Và **FCM (Epic 9) không giải được bài này**: FR-30 gỡ device token khi đăng xuất, nên người *đã quên mật khẩu* (chưa đăng nhập) không có token để nhận push. ⇒ **Cần một quyết định sản phẩm về email/SMS** (Open Question #1). 2.8 dựng **đúng và đủ** phần cơ chế + bảo mật + seam; phần "ống dẫn" chờ quyết định.

**#2 — Định danh là `email`, KHÔNG phải SĐT.** `Account` chỉ có `email @unique` (2.3); **không có cột phone**. Mockup ghi *"SĐT / Email đã đăng ký"* nhưng dữ liệu không tồn tại ⇒ nhãn màn dùng **`Email đã đăng ký`**. Đây là **variance có chủ đích so với mockup** (mockup thắng về *thị giác*; spine/dữ liệu thắng về *hành vi*). Thêm `phone` vào `Account` = **Epic 8** (form account, FR-16). *(Lưu ý: màn Đăng nhập 1.11 đang ghi "Số điện thoại hoặc email" và validate cả hai, trong khi `POST /auth/login` chỉ nhận email — bất nhất này **đã tồn tại**; 2.8 KHÔNG mở rộng nó.)*

**#3 — Màn Hồ sơ = chỉ đọc + đổi mật khẩu.** Mockup hiển thị `Tài khoản` / `Vai trò` / `SĐT` / `Đăng nhập gần nhất` — **không cột nào tồn tại**; hơn nữa **Role không được lưu** (AD-8: role chỉ là *preset* áp lúc tạo, không phải nguồn chân lý) nên "Vai trò" **không thể** hiển thị trung thực. Phase 1 render đúng cái `/me` đã trả: `displayName`, `email`, `Trạng thái = Đang hoạt động` (phiên hợp lệ ⇒ `isActive` đúng, vì `JwtAuthGuard` chặn account bị vô hiệu **mỗi request**). Phần còn lại: **Epic 8**. Không thêm field vào `/me`, không thêm cột.

**#4 — Hash mã bằng argon2id (không SHA-256).** Refresh token (2.3) dùng SHA-256 vì **entropy cao** (32 byte ngẫu nhiên) — brute-force offline bất khả thi. Mã 6 số chỉ **~20 bit**: nếu DB bị đọc, `SHA-256(code)` **vỡ tức thì** (10⁶ phép thử) và kẻ tấn công có thể dùng mã **còn sống** để chiếm tài khoản. argon2id chặn đúng đường đó, `PasswordService` **đã có sẵn** (0 dep mới), chi phí ~50–100ms/lần verify là không đáng kể ở quy mô ~20 user.
> Nghiên cứu (OWASP Forgot Password Cheat Sheet) nói fast-hash "đủ" vì **compensating controls gánh phần lớn rủi ro** — đúng, và ta **vẫn** hiện thực đủ bộ đó (TTL 5', single-use, trần 5 lần, response trung tính). Chọn argon2id là **chặt hơn**, đúng chỉ dẫn project-context *"khi phân vân chọn phương án an toàn/chặt hơn"*. Đây là bổ sung, không mâu thuẫn nguồn.

**#5 — Publish event SAU khi commit (giữ cô lập lỗi của 2.7).** 2.7 để ngỏ Open Question #2 ("audit có cùng transaction với producer không") và hẹn quyết ở producer đầu tiên — **2.8 chính là producer đầu tiên**. Chọn: ghi DB thành công → **rồi** publish. Lý do: đổi mật khẩu **không được rollback** chỉ vì audit ghi lỗi; `InProcessEventBus` đã cô lập lỗi + log. **Đánh đổi (nói thẳng):** nếu `auditLog.create` fail, mật khẩu **vẫn đổi** mà **không có** vết audit — chỉ còn dòng log. Với AD-8 coi audit là "xương sống bằng chứng", đây là rủi ro thật; nếu chủ dự án muốn **audit-hoặc-rollback**, đưa `AuditService.record` vào cùng `$transaction` (phá cô lập lỗi của port). Xem Open Question #6.

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-18 — publish qua MỘT `EventBus` port:** `AuthService`/`PasswordResetService` inject **`EventBus`** và chỉ gọi `publish`. **CẤM** import/inject `AuditService`, `AuditSubscriber`, `NotificationDispatcher` — source-guard `no-direct-side-effect-outside-eventbus.spec.ts` sẽ fail. [Source: ARCHITECTURE-SPINE.md#AD-18; backend/test/no-direct-side-effect-outside-eventbus.spec.ts]
- **AD-8 — AuditLog append-only:** chỉ `create`. Guard `audit-log-append-only.spec.ts` cấm `auditLog.update|updateMany|delete|deleteMany|upsert` trong `src/`. Đọc audit = 8.5. [Source: ARCHITECTURE-SPINE.md#AD-8]
- **AD-5 — envelope trung tâm:** service ném `AppException`; **không** controller/service nào dựng envelope. Guard `no-controller-error-envelope.spec.ts` cấm token `traceId` xuất hiện trong `*.controller.ts`/`*.service.ts` — **đừng viết chữ đó vào file service/controller** (kể cả ví dụ). [Source: ARCHITECTURE-SPINE.md#AD-5]
- **AD-12 — OpenAPI sinh-từ-code:** thêm route ⇒ `npm run openapi:gen` + commit; **cấm sửa tay** `openapi.json`; drift-guard byte-for-byte.
- **AD-4 — backend enforce mọi request:** `change-password` **không** `@Public()`; guard toàn cục fail-closed lo xác thực. Ẩn/hiện UI chỉ là UX.
- **AD-1 — chỉ `PrismaService` chạm DB:** guard `no-manual-prisma-client.spec.ts` cấm `new PrismaClient(`.
- **AD-17 — cấm permission literal ngoài registry:** 2.8 **không** thêm quyền (self-service). `permissions.json` **không đổi**.
- **AD-13 — design-system-first:** hai màn compose từ component đã ship; **cấm** style ad-hoc, `<input>`/`<button>` trần.
- **UX-DR-15 — màn xác thực không có nav:** Quên mật khẩu: web `sidebar={null}`, mobile **không** `AppBottomNav`. Bottom-nav vẫn khoá cứng 5 tab.
- **Naming:** entity PascalCase → bảng `password_reset_codes` (snake_case số nhiều `@@map`, cột `@map`); file kebab-case (`password-reset.service.ts`) — guard `naming-convention.spec.ts`.

### Đọc file bị SỬA / mở rộng (bắt buộc — đọc TRƯỚC khi code)

| File | Hiện trạng | 2.8 làm gì | Phải giữ nguyên |
|---|---|---|---|
| `backend/prisma/schema.prisma` | `Account`, `AccountPermission`, `AuditLog`, `Session` | **Thêm** `PasswordResetCode` + back-relation trên `Account` | KHÔNG tạo lại 4 model cũ; migration chỉ `CREATE TABLE password_reset_codes` |
| `backend/src/auth/auth.service.ts` | `login`/`refresh`/`logout`, `dummyHash`, `hashToken`, `AUTH_FAILED_MESSAGE` | **Thêm** `changePassword`; inject `EventBus` | Cổng rotate atomic của `refresh`; message generic chống enumeration |
| `backend/src/auth/auth.controller.ts` | class `@Public()`, 3 route | **Thêm** 2 route công khai (forgot/reset) | `@Public()` cấp class; không dựng envelope |
| `backend/src/auth/auth.config.ts` | `accessTokenTtlSeconds`, `refreshTokenTtlMs` | **Thêm** 2 field TTL/attempt | Không đổi TTL cũ |
| `backend/src/auth/auth.module.ts` | providers + 2 `APP_GUARD` | **Thêm** provider/controller mới | **Thứ tự guard** (Jwt trước Permissions) |
| `backend/src/accounts/accounts.service.ts` | chỉ `findByEmail`/`findById` | **Thêm** `updatePasswordHash` | Không thêm CRUD thừa (Epic 8) |
| `backend/openapi/openapi.json` | artifact | **Regen** (không sửa tay) | — |
| `web/src/screens/auth/LoginScreen.tsx` | link "Quên mật khẩu?" là `<a href="#">` | Đổi sang callback prop | Nhãn VN hiện có (guard byte-identical); `sidebar={null}` |
| `mobile/lib/screens/auth/login_screen.dart` | `GestureDetector onTap: () {}` (dòng ~99–113, ghi chú `s-forgot = Story 2.8`) | Nối callback | 7 test hiện có phải xanh |
| `web/.../session/PermissionsProvider.tsx` + `use-permissions.ts` | phơi `{status, perms, orderScope}` | **Additive**: phơi thêm `me` | Chữ ký `Gate`/`can`/`filterNav`/`orderScope` |
| `mobile/.../session/app_session.dart` | `PermissionsScope{status, perms, orderScope}` | **Additive**: thêm `me` | `assert(_tabs.length == 5)` ở bottom-nav |

**KHÔNG đụng:** `permission-registry.ts`, `role-presets.ts`, `permissions.json`, `seed.ts`, `app.module.ts`, `audit/*`, `notifications/*`, `events/*`, migration cũ, file **generated** (`tokens.ts/css`, `app_tokens.dart`, `sprite.ts`, `Icon.tsx`, `permission-keys.generated.ts`, `app_permission_keys.g.dart`).

### Tái dùng (scout-before-code — DRY)

- **`PasswordService`** (`auth/password.service.ts`) — argon2id `hash`/`verify` (verify trả `false`, không ném). Dùng cho **cả** mật khẩu **và** hash mã. KHÔNG cài lib băm mới.
- **`dummyHash` timing-equalization** (`auth.service.ts:31-46`) — mirror y hệt cho `forgot-password`/`reset-password`.
- **Cổng atomic `updateMany` + kiểm `count === 1`** (`auth.service.refresh`, sửa ở code-review 2.3) — mirror cho tăng `attemptCount` và cho `consumedAt` (chống đua đồng thời/replay).
- **`AppException` + `ErrorCode`** — dùng `UNAUTHENTICATED`/`VALIDATION_ERROR` **có sẵn**. **KHÔNG** thêm mã lỗi mới: gộp mọi nhánh reset-fail vào **một** message generic ⇒ không cần code mới (YAGNI + chống enumeration). [Source: `common/errors/error-code.ts` TSDoc "KHÔNG nhét mã lỗi domain vào đây"]
- **`ValidationPipe` + `AllExceptionsFilter`** (`CommonModule`, `APP_PIPE`/`APP_FILTER`) — tự áp cho route mới; body sai → `400 VALIDATION_ERROR` + `fieldErrors`, không cấu hình lại.
- **`EventBus` port + `DomainEvent`** (2.7) — port công khai, inject tự do; concrete event do story này khai.
- **`@CurrentAccount()` + `RequestWithAccount`** (2.5) — lấy `accountId` cho change-password.
- **Component đã ship:** web `Field`(`size="lg"`)/`Button`(`variant`,`size="wide"`)/`Banner`(`tone`,`icon`,`role="alert"`)/`Card`(`variant="teal"`)/`Frame`(`label`)/`Stepper`; mobile `AppField`(`AppFieldSize.large`,`obscureText`)/`AppButton`(`AppButtonVariant`,`wide`)/`AppBanner`(`AppBannerTone`)/`AppCard`(`AppCardVariant.teal`)/`AppFrame`/`AppStepper`+`AppStepItem`(`AppStepState.done|current`)/`AppTopbar`/`AppMobileShell`/`AppBottomNav`/`AppPhoneFrame`.
- **`MePort`/`FakeMePort` + `PermissionsProvider`** (2.6) — **mẫu port tiêm** để chép cho `PasswordPort`.
- **`screens/login.test.mjs`** — mẫu guard per-screen (compose + parity byte-identical + no-nav).
- **`test/util/strip-comments.ts` / `strip-to-code.ts`** — nếu viết source-guard mới, tái dùng, KHÔNG viết parser mới.
- **Không tạo trùng:** grep xác nhận `src/` chưa có `forgot|reset.?password|resetToken|passwordReset|otp`; `web/src/screens/` chỉ có `auth/LoginScreen.tsx`; `mobile/lib/screens/` chỉ có `auth/login_screen.dart`. Code MỚI.

### Thiết kế bảo mật (chốt để dev nhất quán — nguồn: OWASP Forgot Password / Authentication Cheat Sheet, NIST SP 800-63B Rev 4)

| Kiểm soát | Giá trị | Vì sao |
|---|---|---|
| Độ dài mã | 6 chữ số, `randomInt(0, 1_000_000)` | CSPRNG **rejection sampling** — `randomInt` KHÔNG lệch phân phối (đừng dùng `% 1000000` trên `randomBytes`) |
| Lưu trữ | **argon2id hash**, không bao giờ lưu mã thô | Quyết định #4 |
| TTL | **5 phút** (hợp đồng mockup) | Cửa sổ tấn công hẹp |
| Single-use | `consumedAt` set trong `$transaction` | Chống replay |
| Trần số lần thử | **5**, tăng **atomic** trước khi verify | Chặn brute-force online (5 lần / 5 phút ⇒ xác suất đoán ≈ 5·10⁻⁶) |
| Cooldown gửi lại | Không phát mã mới khi còn mã sống | Chống flood; khớp countdown mockup, **không cần cột mới** |
| Chống enumeration | `forgot-password` **luôn** cùng response + cân bằng timing; `reset-password` **một** message cho mọi nhánh sai | OWASP |
| Sau reset **và** sau change | **Thu hồi mọi `Session`** | OWASP + HackerOne consensus: kết thúc mọi phiên |
| Change password | Bắt buộc verify mật khẩu hiện tại; từ chối trùng mật khẩu cũ | OWASP |
| Bí mật trong Audit | **Cấm tuyệt đối** mật khẩu/hash/mã trong `before`/`after` | `AuditLog` là bản ghi **bất biến vĩnh viễn** |

> ⚠️ **Giới hạn đã biết (ghi vào Completion Notes, đừng giấu):** access JWT là **stateless** — sau khi thu hồi `Session`, access token cũ **vẫn hợp lệ tối đa `ACCESS_TOKEN_TTL` (mặc định 15 phút)**. Thu hồi *tức thì* sẽ cần denylist/kiểm tra DB mỗi request (đánh đổi với thiết kế stateless của 2.3). Chấp nhận ở Phase 1; ghi rõ.
> ⚠️ **Không có IP rate-limit.** Trần attempt + cooldown + response trung tính chặn được đoán mã và enumeration, **không** chặn spam/DoS vào endpoint công khai. Xem Open Question #4.

### Chiến lược test (hermetic-first — mirror 2.3/2.5/2.7)

- **Backend bắt buộc, luôn chạy được (không Postgres):** unit `PasswordResetService` + `changePassword` (mock `PrismaService`/`EventBus`, **argon2 thật**); unit event-payload security; e2e controller (mock service, mirror `auth.e2e.spec.ts` — nhớ set `process.env.JWT_ACCESS_SECRET` ở top-level và `await import('../src/app.module')` **trong** `beforeAll`, vì `JwtModule` đọc secret lúc import).
- **Integration cần Postgres** (reset end-to-end trên DB thật): chạy khi có DB; **đừng để suite fail vì thiếu DB**.
- **Web = Node text-guard** (`design-system/**/*.test.mjs`) — **không** tsc/JSDOM. **Mobile = `flutter test` + `flutter analyze`** với `FakePasswordPort`.
- **0 regression:** 26 suite/134 test backend + 162 Node + 107 flutter phải xanh.
- **Prisma 7 gotcha:** dùng `create` đơn (không `createMany` rỗng — memory `prisma7-empty-createmany-atomic-replace`). Cột `Json?` không dùng ở story này; nếu event payload cần `null` → `Prisma.JsonNull` (memory `prisma7-nullable-json-jsonnull`) — nhưng tốt nhất **bỏ hẳn** `before`/`after` cho event mật khẩu.

### Điểm sai kinh điển phải tránh (Gotchas)

1. **ĐỪNG inject `AuditService`/`NotificationDispatcher`** để "ghi audit cho chắc" — source-guard fail. Audit đến **qua `EventBus`**. Đây là toàn bộ lý do 2.7 tồn tại.
2. **ĐỪNG đặt mật khẩu/mã/hash vào `before`/`after`** của event. `AuditLog` bất biến, không xoá được.
3. **ĐỪNG trả mã trong response** (kể cả "chỉ ở môi trường dev") và **đừng** log mã ở mức `log`/`warn` trong `AuthService`. Mã chỉ tồn tại trong bộ nhớ đủ lâu để hash.
4. **ĐỪNG tra mã theo `codeHash`.** Mã 6 số ⇒ hash có thể trùng giữa account. Tra theo `accountId`, rồi verify. (`Session.refreshTokenHash` unique được vì entropy cao — đừng bắt chước máy móc.)
5. **ĐỪNG dùng `% 1000000`** trên `randomBytes` (modulo bias). Dùng `crypto.randomInt`.
6. **ĐỪNG viết chuỗi `traceId`** trong `*.controller.ts`/`*.service.ts` (guard `no-controller-error-envelope` quét token này).
7. **ĐỪNG thêm `@Public()` cho change-password**, và đừng gắn nó vào `AuthController` (class đó **đã** `@Public()` toàn bộ) → tách controller riêng.
8. **ĐỪNG sửa tay file generated** (`app_tokens.dart`, `tokens.ts/css`, `sprite.ts`, `permission-keys.generated.ts`…) — bài học Story 1.10; drift-guard byte-for-byte sẽ fail.
9. **ĐỪNG viết chuỗi bị cấm** (`box-shadow`, `gradient`, `drop-shadow`, `999px`, `toUpperCase`, literal quyền) vào CSS/TSX/Dart mới — **kể cả trong comment** ở những file guard quét toàn văn. (A-1 của retro đã strip comment cho phần lớn guard, nhưng giữ kỷ luật.)
10. **ĐỪNG dựng router/bundler/`main.dart`/`dio`** để "chạy thật". Không có runtime nào cả — dùng port + fake port (đó là lý do port tồn tại).
11. **`Field`/`AppField` KHÔNG có slot lỗi.** Lỗi hiện qua **một** `Banner tone="danger" role="alert"` đầu form. Đừng thêm affordance mới.
12. **ĐỪNG quên `dispose()`/`clearInterval`** cho đếm ngược gửi lại mã (leak timer trong widget test sẽ fail `flutter test`).
13. **Nhãn stepper phải giống nhau hai nền tảng.** Mockup ghi `Nhập mã & mật khẩu mới` (web) và `Mã & MK mới` (mobile) — parity guard byte-identical ⇒ **chọn một** cho cả hai: `Gửi mã` + `Mã & mật khẩu mới`.

### Previous Story Intelligence (2.7 vừa done + mạch 2.1–2.6)

- **2.8 là producer AD-18 ĐẦU TIÊN.** 2.7 cố ý *không* khai concrete event ("story sở hữu khai"), và để ngỏ **Open Question #2** (coupling transaction audit↔producer) **hẹn quyết ở producer đầu tiên** → chốt tại đây (Quyết định #5).
- **2.7 Debug Log:** integration test cần `import PrismaModule` (@Global) **rồi** `.overrideProvider(PrismaService)`, nếu không token không resolve. Mirror khi test wiring.
- **2.3 code-review bắt lỗi thật:** rotate refresh không tất định (hai request cùng token cùng qua) → sửa bằng `updateMany` **atomic có điều kiện** + kiểm `count`. **Áp đúng bài học đó** cho `attemptCount` và `consumedAt` của 2.8 (nếu không, hai request song song đều "tiêu thụ" một mã).
- **2.3 Open Question #2** đề xuất `email` làm định danh — 2.8 kế thừa (Quyết định #2).
- **2.6:** cả hai client **chưa có app-runtime**; chọn **seam + port tiêm** thay vì dựng nguyên app; provider/mapping parity web↔mobile; guard byte-identical. 2.8 lặp lại đúng khuôn.
- **2.4/2.5:** source-guard bắt literal quyền kể cả trong `example:` của DTO. 2.8 không thêm quyền ⇒ không rủi ro, nhưng đừng viết literal quyền vào màn Hồ sơ.
- **Kỷ luật chung:** chốt Open Question theo mặc định YOLO, **ghi rõ nhánh không chọn** ở Completion Notes.

### Git Intelligence (5 commit gần nhất)

`d97f9bc feat(story-2.7)` · `60d57ee feat(story-2.6)` · `e10f35f feat(story-2.5)` · `e60ef01 feat(story-2.4)` · `3b77460 feat(story-2.3)`. Pattern: **một story = một commit** conventional `feat(story-X.Y): <mô tả tiếng Việt>`, **không** tham chiếu AI, **không** số plan/audit trong tên migration/test. Mạch Epic 2: skeleton → envelope → JWT → registry → `/me`+guard → FE gating → EventBus port → **2.8 khép Epic 2 bằng producer thật đầu tiên + hai màn tài khoản**. Commit đề xuất: `feat(story-2.8): Quên mật khẩu + Hồ sơ & đổi mật khẩu`.

### Latest Tech Notes (version ghim từ project-context)

- **Node 24 LTS** — `crypto.randomInt(min, max)` dùng rejection sampling ⇒ **không modulo bias**. `randomInt(0, 1_000_000).toString().padStart(6, '0')`.
- **argon2 0.44.0** — argon2id, không CVE tồn đọng đầu 2026; native binding chạy OK trên darwin/Node 24 (đã xác minh ở 2.3). `PasswordService` bọc sẵn.
- **NestJS 11.1.27** — `@nestjs/jwt ^11`; guard toàn cục qua `APP_GUARD`. **KHÔNG** thêm `@nestjs/throttler` ở story này (Open Question #4); nếu thêm sau: v6.5+ tương thích Nest 11, storage in-memory đủ cho 1 VPS/~20 user (không cần Redis).
- **Prisma 7.8.0 + adapter-pg** — migration qua `prisma migrate diff --from-schema … --script` khi không có DB (`--from-migrations` cần shadow DB).
- **class-validator 0.15** — `@IsEmail`, `@Matches`, `@MinLength`; `fieldErrors[].code` = tên constraint (vd `matches`, `minLength`) — FE map theo **code**, không theo message.
- **NIST SP 800-63B Rev 4 (7/2025)** — **khuyến nghị BỎ** composition rule kiểu "phải có chữ và số"; ưu tiên độ dài + blocklist mật khẩu lộ. Hợp đồng UX của dự án đang **yêu cầu** rule này ⇒ giữ nguyên, ghi nợ (Open Question #5). [Chi tiết: `plans/reports/researcher-260709-1014-password-reset-change-guidance-report.md`]

### Project Structure Notes

Cây mục tiêu — 2.8 tạo phần **in đậm**:

- `backend/src/auth/` → **`password-reset.service.ts`**, **`change-password.controller.ts`**, **`domain/password-events.ts`**, **`dto/forgot-password-request.dto.ts`**, **`dto/forgot-password-response.dto.ts`**, **`dto/reset-password-request.dto.ts`**, **`dto/change-password-request.dto.ts`**; UPDATE `auth.service.ts`, `auth.controller.ts`, `auth.config.ts`, `auth.module.ts`.
- `backend/src/accounts/accounts.service.ts` → UPDATE (`updatePasswordHash`).
- `backend/prisma/` → UPDATE `schema.prisma`; **`migrations/*_add_password_reset_codes/`**.
- Test MỚI: **`test/password-reset.service.spec.ts`**, **`test/change-password.spec.ts`**, **`test/password-events.spec.ts`**, **`test/password-reset.e2e.spec.ts`**; UPDATE `test/openapi-drift.spec.ts`.
- `web/src/screens/auth/` → **`ForgotPasswordScreen.tsx`**, **`forgot-password.css`**; `web/src/screens/account/` → **`ProfileScreen.tsx`**, **`profile.css`**.
- `web/src/design-system/session/` → **`password-port.ts`**, **`fake-password-port.ts`**; UPDATE `PermissionsProvider.tsx`, `use-permissions.ts`, `index.ts`.
- `mobile/lib/screens/auth/` → **`forgot_password_screen.dart`**; `mobile/lib/screens/account/` → **`profile_screen.dart`**.
- `mobile/lib/design_system/session/` → **`password_port.dart`**, **`fake_password_port.dart`**; UPDATE `app_session.dart`, `session.dart`.
- Test MỚI: **`design-system/screens/forgot-password.test.mjs`**, **`design-system/screens/profile.test.mjs`**, **`mobile/test/screens/auth/forgot_password_screen_test.dart`**, **`mobile/test/screens/account/profile_screen_test.dart`**.
- UPDATE: `backend/openapi/openapi.json` (**regen**), `backend/CONVENTIONS.md`, `backend/README.md`, `backend/.env.example`, `web/src/screens/auth/LoginScreen.tsx`, `mobile/lib/screens/auth/login_screen.dart`.

### Project Structure Notes — Alignment & Variances

- **Alignment:** `auth/` sở hữu reset/change-password khớp spine module-tree (`auth/ = JWT access+refresh, /me`); `accounts/` vẫn sở hữu `Account` (AD-8); event ở `auth/domain/` giữ Domain thuần (không phụ thuộc Infra); bảng `password_reset_codes` khớp naming convention.
- **Variance có chủ đích #1:** màn Hồ sơ đặt ở `screens/account/` (không phải `screens/auth/`) — nó là màn **office** (trong shell), không phải màn xác thực. `s-profile` trong EXPERIENCE.md thuộc nhóm "A · Xác thực & Nền" nhưng điều hướng từ Menu/sidebar ⇒ thư mục theo **vai trò điều hướng**, không theo nhóm tài liệu.
- **Variance có chủ đích #2:** nhãn `Email đã đăng ký` thay `SĐT / Email đã đăng ký` (mockup) — dữ liệu không có phone (Quyết định #2).
- **Variance có chủ đích #3:** `notecard`/`kv` của mockup compose từ `Banner`/`Card` thay vì tạo component mới (tránh mở rộng bề mặt design-system + parity guard ngoài phạm vi).
- **Variance có chủ đích #4:** field mã xác thực **không** căn giữa/letter-spacing trên mobile (`AppField` chưa có `textAlign`/`maxLength`). Web làm được qua screen CSS. Thêm param cho `AppField` sẽ chạm design-system + parity → xem Open Question #7.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8] — 3 AC verbatim (gửi mã + đặt mật khẩu mới, lỗi trả envelope chuẩn; đổi mật khẩu kiểm mật khẩu cũ + **ghi Audit qua event**; hai màn dùng component design system, parity web+mobile).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 overview] — "…quên mật khẩu; hồ sơ. Chừa sẵn Domain Event port…".
- [Source: PRD prd.md] — **KHÔNG có FR nào** cho quên/đổi mật khẩu; FR-22 chỉ nói "Login & session". Story bắt nguồn từ **EXPERIENCE.md IA** + scope line Epic 2 ⇒ tự do thiết kế trong khuôn bất biến, và **thiếu quyết định sản phẩm về kênh gửi mã** (Open Question #1).
- [Source: EXPERIENCE.md#Information Architecture] — `s-forgot` "Đặt lại mật khẩu qua mã"; `s-profile` "Thông tin cá nhân, đổi mật khẩu"; "Màn xác thực (Đăng nhập, Quên MK) **không có bottom nav**"; sidebar web có mục "Hồ sơ".
- [Source: mockups/all-screens.html#s-forgot (dòng 483–575)] — stepper 2 bước; banner info "Đã gửi mã 6 số đến 098•••1234. Mã có hiệu lực 5 phút."; 4 field (`SĐT / Email đã đăng ký`, `Mã xác thực` field-lg mono 6 số, `Mật khẩu mới`, `Xác nhận mật khẩu mới`); nút `Đặt lại mật khẩu`; "Gửi lại mã sau 04:12"; mobile có topbar back→login, **không** botnav.
- [Source: mockups/all-screens.html#s-profile (dòng 928–1010)] — card teal + kv (`Tài khoản`/`Vai trò`/`SĐT`/`Email`/`Trạng thái`/`Đăng nhập gần nhất`); `frame` label "Đổi mật khẩu" + 3 field password; notecard **"Tối thiểu 8 ký tự, có chữ và số. Đổi mật khẩu sẽ ghi vào Audit log."**; nút `Huỷ` (ghost) + `Cập nhật mật khẩu` (primary); web trong sidebar shell.
- [Source: ARCHITECTURE-SPINE.md#AD-18] — publish domain event qua **MỘT** `EventBus` port; producer **KHÔNG** gọi FCM/notification/audit trực tiếp; consumer subscribe; bộ gửi lắp sau không mở lại code.
- [Source: ARCHITECTURE-SPINE.md#AD-8 + #Consistency Conventions] — AuditLog bất biến append-only (ai/gì/đối tượng/khi nào/trước→sau), đọc chỉ Super Admin; **Role = preset áp lúc tạo, không phải nguồn chân lý** (⇒ không hiển thị "Vai trò" ở Hồ sơ).
- [Source: ARCHITECTURE-SPINE.md#AD-5, #AD-12, #AD-4, #AD-1, #AD-13] — envelope trung tâm; OpenAPI sinh-từ-code + JWT access/refresh; backend enforce mọi request; chỉ `PrismaService` chạm DB; design-system-first.
- [Source: ARCHITECTURE-SPINE.md#Deferred] — "Chi tiết OpenAPI codegen & auth token TTL … chốt ở implementation"; **kênh gửi email/SMS KHÔNG nằm trong danh sách** ⇒ khoảng trống thật.
- [Source: backend/prisma/schema.prisma] — `Account { id, email @unique, passwordHash, displayName, isActive, createdAt, updatedAt }` (**không phone/username/role/lastLoginAt**); `Session { refreshTokenHash @unique, expiresAt, revokedAt }`; `AuditLog` append-only.
- [Source: backend/src/auth/auth.service.ts] — `AUTH_FAILED_MESSAGE` generic; `dummyHash` cân bằng timing; `refresh` revoke **atomic** `updateMany` + `count===1`; `hashToken` SHA-256 (chỉ cho refresh entropy cao).
- [Source: backend/src/auth/password.service.ts] — argon2id `hash`/`verify` (verify không ném).
- [Source: backend/src/auth/jwt-auth.guard.ts, permissions.guard.ts, auth.module.ts] — guard toàn cục fail-closed (Jwt → Permissions); `@Public()` opt-out; `JwtAuthGuard` kiểm `isActive` **mỗi request**.
- [Source: backend/src/auth/me.controller.ts + dto/me-response.dto.ts] — `/me` → `{ id, email, displayName, permissions[] }`; auth-only, không `@RequirePermissions`.
- [Source: backend/src/common/errors/error-code.ts] — 6 mã; TSDoc: **"KHÔNG nhét mã lỗi domain vào đây"** ⇒ 2.8 tái dùng `UNAUTHENTICATED`/`VALIDATION_ERROR`, không thêm mã.
- [Source: backend/src/events/domain-event.ts, event-bus.ts] — `DomainEvent` 5 chiều; `EventBus` abstract kiêm DI token; `EventsModule` @Global.
- [Source: backend/src/audit/audit.service.ts] — `record(event)` → `auditLog.create` (chỉ create); `toJsonInput` xử lý `Prisma.JsonNull`.
- [Source: backend/test/no-direct-side-effect-outside-eventbus.spec.ts] — cấm tham chiếu `NotificationDispatcher`/`AuditSubscriber`/`AuditService`/`InProcessEventBus` ngoài module sở hữu; cấm `firebase-admin` ngoài `notifications/`.
- [Source: backend/test/audit-log-append-only.spec.ts, no-controller-error-envelope.spec.ts, no-manual-prisma-client.spec.ts, no-permission-literal-outside-registry.spec.ts, naming-convention.spec.ts] — 5 guard còn lại + chuỗi bị cấm.
- [Source: backend/test/auth.e2e.spec.ts, me.e2e.spec.ts] — mẫu e2e hermetic (`JWT_ACCESS_SECRET` top-level + `await import('../src/app.module')` trong `beforeAll`).
- [Source: web/src/screens/auth/LoginScreen.tsx + design-system/screens/login.test.mjs] — mẫu màn presentational + guard per-screen (compose, canonical variant, nhãn VN byte-identical, `sidebar={null}`).
- [Source: web/src/design-system/components/Field.tsx, Button.tsx, Banner.tsx, Card.tsx, Frame.tsx] — props chính xác; `Field` **không có** slot lỗi.
- [Source: mobile/lib/screens/auth/login_screen.dart] — stub `Quên mật khẩu?` `onTap: () {}` kèm ghi chú `s-forgot = Story 2.8`.
- [Source: mobile/lib/design_system/components/field.dart, button.dart, banner.dart, card.dart, stepper.dart] — `AppFieldSize.large`, `AppButtonVariant/Size`+`wide`, `AppBannerTone`, `AppCardVariant.teal`, `AppFrame`, `AppStepper`/`AppStepItem`/`AppStepState`.
- [Source: web/.../session/me-port.ts + mobile/.../session/me_port.dart] — mẫu port tiêm + `FakeMePort`; TODO "impl HTTP thật land cùng app-runtime".
- [Source: _bmad-output/implementation-artifacts/2-7-…md#Open Questions] — OQ#2 "coupling transaction audit↔producer — **quyết ở E4 khi có producer thật**" ⇒ 2.8 là producer đầu tiên, chốt tại Quyết định #5.
- [Source: _bmad-output/implementation-artifacts/2-3-…md] — thiết kế token/phiên; OQ#2 định danh `email`; "Quên mật khẩu / đổi mật khẩu → **Story 2.8**".
- [Source: _bmad-output/implementation-artifacts/2-6-…md] — seam + port tiêm; web/mobile chưa có app-runtime; parity guard.
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-07-08.md] — TD-1 (web thiếu tooling, **vẫn mở**), TD-2 (mobile chưa scaffold `android/`/`ios/`, **vẫn mở**), bẫy file generated, false-positive comment trong guard.
- [Source: _bmad-output/project-context.md] — "khi phân vân chọn phương án an toàn/chặt hơn"; "Đừng cố `tsc` web/"; scout-before-code; cấm sửa tay file generated.
- [Source: plans/reports/researcher-260709-1014-password-reset-change-guidance-report.md] — OWASP/NIST: hash mã + trần thử + TTL + single-use; response trung tính; **thu hồi mọi phiên** sau reset/change; `crypto.randomInt` không bias; `@nestjs/throttler` v6.5+ cho Nest 11 (in-memory đủ 1 VPS); **NIST Rev 4 khuyến nghị bỏ composition rule**.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-09 | Tạo story context 2.8 (Quên mật khẩu + Hồ sơ & đổi mật khẩu): phạm vi = backend thật (model `PasswordResetCode` + migration; `PasswordResetService` với mã 6 số CSPRNG, hash argon2id, TTL 5', single-use, trần 5 lần thử atomic, cooldown = vòng đời mã, response trung tính chống enumeration; `AuthService.changePassword` verify mật khẩu cũ + thu hồi mọi phiên; 3 route + DTO + regen OpenAPI) + **3 concrete domain event đầu tiên của AD-18** publish qua `EventBus` (audit đến qua subscriber, KHÔNG gọi trực tiếp; cấm bí mật trong payload) + hai màn presentational web/mobile compose từ design-system qua `PasswordPort` tiêm + guard parity byte-identical. Chốt 5 quyết định: (1) kênh gửi mã = seam `EventBus`, KHÔNG thêm dep email/SMS — **Phase 1 mã chưa thực sự tới người dùng**; (2) định danh = `email` (Account không có phone); (3) Hồ sơ = chỉ đọc + đổi mật khẩu, chỉ render field `/me` có thật (Role không được lưu — AD-8); (4) hash mã bằng argon2id (chặt hơn SHA-256 cho mã entropy thấp); (5) publish event **sau commit**, giữ cô lập lỗi của 2.7 (đóng OQ#2 của 2.7). Ngoài phạm vi: app-runtime web/mobile, kênh gửi thật, CRUD account + cột phone/role/lastLogin (Epic 8), endpoint đọc Audit (8.5), FCM (Epic 9), `@nestjs/throttler`. 7 Open Question — trọng tâm #1 (kênh gửi mã) là **quyết định sản phẩm còn thiếu**. |

## Open Questions

1. 🔴 **Mã xác thực đến tay người dùng bằng cách nào?** (**Chặn tính năng dùng thật, không chặn implement.**) Stack **không có** email/SMS/OTP; spine cũng không hoãn hạng mục này — đây là **khoảng trống sản phẩm**, không phải deferral. Và **FCM (Epic 9) không giải được**: FR-30 gỡ device token khi đăng xuất, nên người đã quên mật khẩu không có token nhận push. Phương án: **(a)** giữ seam `EventBus` + Phase 1 admin đọc log/đặt lại hộ (~20 user nội bộ — khả thi); **(b)** thêm SMTP (`nodemailer`) + biến môi trường + nhà cung cấp; **(c)** thêm SMS gateway (SĐT chưa có trên `Account` ⇒ kèm cột mới). **Mặc định YOLO: (a)** — 0 dep, đúng AD-18, Epic 9 thay dispatcher không mở lại code. **Cần chủ dự án chốt (b)/(c) trước khi tính năng phục vụ người dùng thật.**
2. **Định danh reset: `email` hay thêm `phone` vào `Account`?** Mockup ghi "SĐT / Email". Hiện `Account` **không có** phone ⇒ mặc định **email**, nhãn màn đổi thành `Email đã đăng ký`. Nếu chủ dự án muốn SĐT: thêm cột (+ chuẩn hoá E.164 — lưu ý AD-9 nói chuẩn hoá E.164 thuộc domain `customers`, `Account` là khái niệm khác) → thuộc **Epic 8**.
3. **Màn Hồ sơ có cho sửa `displayName` không?** User story ghi "xem/**sửa** hồ sơ" nhưng **AC-2 chỉ nói đổi mật khẩu**, và mockup là **danh sách chỉ đọc** (không có nút sửa). Mặc định: **chỉ đọc + đổi mật khẩu** (YAGNI). Nếu muốn sửa `displayName`: thêm `PATCH /me` + DTO + event `ProfileUpdated` (~nửa task).
4. **Có thêm `@nestjs/throttler` (rate-limit IP) ngay không?** Trần attempt + cooldown + response trung tính đã chặn **đoán mã** và **enumeration**; **chưa** chặn spam/DoS vào 2 endpoint công khai. Thêm throttler = 1 dep + cấu hình cross-cutting cho **mọi** route. Mặc định: **hoãn**, ghi rủi ro tồn dư. (Nếu thêm: v6.5+, storage in-memory, không cần Redis ở quy mô này.)
5. **Password policy "tối thiểu 8 ký tự, có chữ và số" trái khuyến nghị NIST SP 800-63B Rev 4 (7/2025)**, vốn khuyên **bỏ composition rule**, tăng độ dài tối thiểu và dùng **blocklist mật khẩu đã lộ**. Đây là **hợp đồng UX đã chốt** (in trên mockup) ⇒ 2.8 **giữ nguyên**, không tự ý đảo quyết định. Đề xuất ghi nợ: sau này bỏ rule chữ+số, nâng min-length, thêm blocklist.
6. **Audit ghi cùng transaction hay sau commit?** (Kế thừa OQ#2 của 2.7 — đến hạn ở producer đầu tiên.) Mặc định: **sau commit + cô lập lỗi** (đổi mật khẩu không rollback vì audit lỗi). Đánh đổi: audit có thể **mất** khi `auditLog.create` fail (chỉ còn dòng log) — mâu thuẫn tinh thần "audit = xương sống bằng chứng" (AD-8). Nếu chủ dự án muốn **audit-hoặc-rollback**, đưa `record` vào cùng `$transaction` (phá cô lập lỗi của port, và producer sẽ phụ thuộc audit — cần cân nhắc với AD-18).
7. **Field mã 6 số căn giữa + letter-spacing:** web làm được bằng screen CSS; `AppField` (mobile) **chưa có** `textAlign`/`maxLength`. Mặc định: **bỏ qua tinh chỉnh thị giác trên mobile** (không đụng design-system). Nếu muốn parity thị giác: thêm 2 param cho `AppField` → chạm SSOT/parity guard, nên tách task riêng.
