# Đăng nhập, phiên và mật khẩu

> Flow `auth-session`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow auth-session` in ra đúng danh sách đó.

## Mục đích

Xác thực nhân viên nội bộ và quản lý vòng đời phiên: đăng nhập phát access JWT ngắn hạn + refresh token
opaque thu hồi được, refresh có rotate, logout idempotent, quên/đặt lại mật khẩu bằng mã 6 chữ số, và tự
đổi mật khẩu khi đang đăng nhập. Flow này cũng sở hữu `JwtAuthGuard` toàn cục (fail-closed) mà mọi route
nghiệp vụ khác dựa vào. Luật gốc: [`backend/CONVENTIONS.md`](../../backend/CONVENTIONS.md) mục "Auth" và
"Đặt lại / đổi mật khẩu (Story 2.8)".

Giới hạn đã biết (ghi trong CONVENTIONS, chưa xử):

- Mã reset **chưa tới tay người dùng**: chưa có kênh email/SMS, `NotificationDispatcher` chỉ log ⇒ Quên mật
  khẩu chưa self-service được. Chưa có nút "Gửi lại mã".
- Thu hồi phiên không tức thì: access JWT cũ vẫn dùng được tới hết `ACCESS_TOKEN_TTL` (mặc định 15 phút).
- Không rate-limit IP trên các route công khai; cooldown mã reset là read-then-write, chưa atomic.
- Màn Đăng nhập (web + mobile) **chỉ validate trình bày**, chưa gọi `POST /auth/login`, chưa lưu token. Màn
  chấp nhận "SĐT hoặc email" nhưng `LoginRequestDto` chỉ nhận email (`@IsEmail`).
- Web chưa có router/composition root: `web/src/main.tsx` là shell demo nối Login ↔ Quên mật khẩu bằng
  `FakePasswordPort`. Mobile chưa có `main.dart`; màn nhận `PasswordPort` qua constructor, test dùng fake port.

## Điểm vào

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` — `AuthController` (`@Public()` cấp class).
- `POST /auth/forgot-password`, `POST /auth/reset-password` — `AuthController` (công khai).
- `POST /auth/change-password` — `ChangePasswordController` (cần Bearer, `@AuthenticatedOnly()`).
- Guard toàn cục `JwtAuthGuard` (`APP_GUARD` trong `AuthModule`) chạy trên MỌI request không `@Public()`.
- Web: `web/src/main.tsx` (`DemoShell`), `LoginScreen`, `ForgotPasswordScreen`, `ProfileScreen`.
- Mobile: `LoginScreen`, `ForgotPasswordScreen`, `ProfileScreen` (Flutter widget, chưa có entry app).

## Các bước

**Đăng nhập**

1. `backend/src/auth/auth.controller.ts` → `AuthController.login`: nhận `LoginRequestDto` (ValidationPipe trả
   400 nếu sai shape).
2. `backend/src/auth/auth.service.ts` → `AuthService.login`: `AccountsService.findByEmail`, luôn
   `PasswordService.verify` (dùng `dummyHash` khi email lạ); sai/inactive ⇒ 401 `AUTH_FAILED_MESSAGE`.
3. `backend/src/auth/auth.service.ts` → `issueTokens`: ký JWT `{ sub }` HS256 với TTL `accessTokenTtlSeconds`,
   sinh refresh `randomBytes(32)`, lưu `hashToken` (SHA-256) vào `sessions`, trả `AuthTokensDto`.

**Refresh / logout**

4. `AuthService.refresh`: tra `sessions` theo hash; sai/đã thu hồi/hết hạn ⇒ 401. Rotate bằng
   `session.updateMany({ id, revokedAt: null })` và đòi `count === 1`; kiểm lại account còn `isActive`; rồi
   `issueTokens`.
5. `AuthService.logout`: `updateMany` đặt `revokedAt` cho phiên chưa thu hồi; không lỗi nếu không khớp (204).

**Xác thực mỗi request**

6. `backend/src/auth/jwt-auth.guard.ts` → `JwtAuthGuard.canActivate`: bỏ qua nếu `IS_PUBLIC_KEY`; rút Bearer,
   `verifyAsync`, `AccountsService.findById`, kiểm `isActive`, gắn `request.account` (`AuthenticatedAccount`).
   Mọi nhánh lỗi ⇒ 401 `Chưa xác thực`.
7. `backend/src/auth/current-account.decorator.ts` → `CurrentAccount`: controller đọc danh tính từ đây.

**Quên / đặt lại mật khẩu**

8. `backend/src/auth/password-reset.service.ts` → `PasswordResetService.requestCode`: luôn sinh + băm một mã
   (`generateCode` dùng `randomInt`); email lạ/inactive hoặc còn mã sống ⇒ trả trung tính; ngược lại tạo dòng
   `password_reset_codes` và publish `PasswordResetRequested`. Luôn trả `{ expiresInSeconds }`.
9. `PasswordResetService.reset`: tra mã sống mới nhất theo `accountId`; tăng `attemptCount` atomic
   (`lt passwordResetMaxAttempts`) TRƯỚC khi verify; verify argon2; trong một `$transaction`: lật `consumedAt`
   (đòi `count === 1`), `AccountsService.updatePasswordHash`, thu hồi mọi `sessions`. Publish
   `PasswordResetCompleted` sau commit.

**Đổi mật khẩu**

10. `backend/src/auth/change-password.controller.ts` → `ChangePasswordController.changePassword`: `accountId`
    lấy từ `@CurrentAccount()`, không từ body.
11. `AuthService.changePassword`: verify mật khẩu hiện tại (sai ⇒ 401), trùng mật khẩu cũ ⇒ 400
    `fieldErrors[newPassword].code = 'sameAsCurrent'`; một `$transaction` ghi hash mới + thu hồi mọi phiên +
    tiêu thụ mọi mã reset còn sống; publish `PasswordChanged` sau commit.

**Giao diện**

12. `web/src/screens/auth/ForgotPasswordScreen.tsx` / `mobile/lib/screens/auth/forgot_password_screen.dart` →
    `ForgotPasswordScreen`: hai bước (`request` → `verify`) trong state, gọi `PasswordPort.requestResetCode`
    rồi `resetPassword`; đếm ngược "Gửi lại mã sau MM:SS"; mọi lỗi backend ⇒ một message chung.
13. `ProfileScreen` (web + mobile): đọc danh tính từ session provider (không gọi `/me` lần hai), gọi
    `PasswordPort.changePassword`.

## Bất biến

| Bất biến | Nơi enforce | Test / guard |
|----------|-------------|--------------|
| Mọi nhánh login sai trả cùng 401 + cùng message; email lạ vẫn verify dummy hash | `AuthService.login` | `auth.service.spec.ts`, `auth.e2e.spec.ts` |
| Refresh single-use: rotate atomic `revokedAt: null` + `count === 1`; account inactive không rotate | `AuthService.refresh` | `auth.service.spec.ts` (ca đua đồng thời, inactive) |
| Refresh token chỉ lưu SHA-256, không lưu token thô | `hashToken` | `auth.service.spec.ts` |
| JWT ký/verify pin HS256 | `AuthModule` (`JwtModule.register`) | chưa có test riêng |
| Guard fail-closed, 401 trung tính, kiểm `isActive` mỗi request, `request.account` không có `passwordHash` | `JwtAuthGuard` | `jwt-auth.guard.spec.ts` |
| `/auth/change-password` KHÔNG công khai (controller riêng, ngoài `@Public()` cấp class) | `ChangePasswordController` | `password-reset.e2e.spec.ts` (không Bearer ⇒ 401); `no-handler-without-require-permissions.spec.ts` đòi handler khai `@AuthenticatedOnly()` (flow accounts-permissions) |
| `forgot-password` cùng status + cùng body cho email lạ/có thật, không trả mã | `PasswordResetService.requestCode`, `ForgotPasswordResponseDto` | `password-reset.service.spec.ts`, `password-reset.e2e.spec.ts` |
| Mã reset: hash argon2id, attempt tăng atomic trước verify, single-use atomic, một message cho mọi nhánh sai | `PasswordResetService.reset` | `password-reset.service.spec.ts` |
| Reset và change-password thu hồi MỌI phiên trong cùng transaction với ghi hash; change còn tiêu thụ mã reset sống | `PasswordResetService.reset`, `AuthService.changePassword` | `password-reset.service.spec.ts`, `change-password.spec.ts` |
| Event mật khẩu không mang mật khẩu/hash/mã; `before` vắng, `after` chỉ `changedAt` | `AccountPasswordEvent` | `password-events.spec.ts` |
| Producer chỉ publish qua `EventBus`, sau commit; không inject `AuditService`/`NotificationDispatcher` | `AuthService`, `PasswordResetService` | `no-direct-side-effect-outside-eventbus.spec.ts` (flow domain-events-audit) |
| Chính sách mật khẩu một nguồn: ≥8 ký tự, có chữ và số | `IsPasswordPolicy` | `password-reset.e2e.spec.ts` |
| Env TTL không hợp lệ rơi về mặc định (15m / 30 ngày / 5 phút / 5 lần) | `loadAuthConfig` | `auth.config.spec.ts` |
| Màn chỉ đi qua `PasswordPort`, không fetch/dio; màn auth không có nav; nhãn Việt trùng byte web↔mobile | các màn auth/profile | `design-system/screens/*.test.mjs` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/auth/auth.controller.ts` | Route công khai login/refresh/logout/forgot/reset | `AuthController` |
| `backend/src/auth/change-password.controller.ts` | Route đổi mật khẩu cần Bearer | `ChangePasswordController` |
| `backend/src/auth/auth.service.ts` | Login, refresh rotate, logout, change password | `AuthService`, `hashToken` |
| `backend/src/auth/password-reset.service.ts` | Phát/tiêu thụ mã reset | `PasswordResetService`, `generateCode` |
| `backend/src/auth/password.service.ts` | Băm/kiểm argon2id | `PasswordService` |
| `backend/src/auth/jwt-auth.guard.ts` | Guard toàn cục #1 | `JwtAuthGuard` |
| `backend/src/auth/public.decorator.ts` | Opt-out guard | `Public`, `IS_PUBLIC_KEY` |
| `backend/src/auth/current-account.decorator.ts` | Danh tính từ request | `CurrentAccount`, `AuthenticatedAccount`, `RequestWithAccount` |
| `backend/src/auth/auth.config.ts` | TTL + trần thử từ env | `AUTH_CONFIG`, `AuthConfig`, `loadAuthConfig`, `durationToSeconds` |
| `backend/src/auth/auth.module.ts` | Nối controller, `JwtModule` HS256, `APP_GUARD` | `AuthModule` |
| `backend/src/auth/domain/password-events.ts` | Domain event mật khẩu | `PasswordResetRequested`, `PasswordResetCompleted`, `PasswordChanged` |
| `backend/src/auth/dto/{login,refresh,logout}-request.dto.ts`, `auth-tokens.dto.ts` | Body/response phiên | `LoginRequestDto`, `RefreshRequestDto`, `LogoutRequestDto`, `AuthTokensDto` |
| `backend/src/auth/dto/{forgot-password-request,forgot-password-response,reset-password-request,change-password-request}.dto.ts` | Body/response mật khẩu | `ForgotPasswordRequestDto`, `ForgotPasswordResponseDto`, `ResetPasswordRequestDto`, `ChangePasswordRequestDto` |
| `backend/src/auth/dto/password-policy.ts` | Chính sách mật khẩu dùng chung | `IsPasswordPolicy`, `PASSWORD_POLICY_MESSAGE` |
| `backend/prisma/migrations/20260708000000_init_auth_accounts_sessions/migration.sql` | Tạo `accounts`, `sessions` | — |
| `backend/prisma/migrations/20260709010000_add_password_reset_codes/migration.sql` | Tạo `password_reset_codes` | — |
| `web/src/main.tsx` | Entry Vite tối thiểu, shell demo | `DemoShell` |
| `web/src/screens/auth/LoginScreen.tsx`, `login.css` | Màn Đăng nhập (chỉ validate) | `LoginScreen` |
| `web/src/screens/auth/ForgotPasswordScreen.tsx`, `forgot-password.css` | Màn Quên mật khẩu 2 bước | `ForgotPasswordScreen` |
| `web/src/screens/account/ProfileScreen.tsx`, `profile.css` | Màn Hồ sơ + đổi mật khẩu | `ProfileScreen` |
| `web/src/design-system/session/password-port.ts`, `fake-password-port.ts` | Port 3 method + fake demo/test | `PasswordPort`, `FakePasswordPort` |
| `mobile/lib/screens/auth/login_screen.dart` | Màn Đăng nhập mobile | `LoginScreen` |
| `mobile/lib/screens/auth/forgot_password_screen.dart` | Màn Quên mật khẩu mobile | `ForgotPasswordScreen` |
| `mobile/lib/screens/account/profile_screen.dart` | Màn Hồ sơ mobile | `ProfileScreen` |
| `mobile/lib/design_system/session/password_port.dart`, `fake_password_port.dart` | Port + fake mobile | `PasswordPort`, `FakePasswordPort` |

## Dữ liệu

- Bảng: `accounts` (đọc qua `AccountsService`, ghi `password_hash`), `sessions` (tạo/thu hồi phiên),
  `password_reset_codes` (tạo, tăng `attempt_count`, lật `consumed_at`).
- Sự kiện phát: `PasswordResetRequested`, `PasswordResetCompleted`, `PasswordChanged` (qua `EventBus`, sau
  commit). Flow này không subscribe event nào.
- Gọi ngoài: không. Env đọc: `JWT_ACCESS_SECRET` (`AuthModule`), `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`,
  `PASSWORD_RESET_CODE_TTL_MINUTES`, `PASSWORD_RESET_MAX_ATTEMPTS` (`loadAuthConfig`).

## Flow liên quan

- accounts-permissions: `AccountsService` (đọc account, `updatePasswordHash`), `PermissionsGuard` chạy sau
  `JwtAuthGuard`, `GET /me` và `@AuthenticatedOnly()`.
- domain-events-audit: `EventBus` nhận ba event mật khẩu; `AuditSubscriber` ghi `audit_logs`,
  `NotificationDispatcher` là seam gửi mã.
- backend-platform: `AppException`/`ErrorCode`, `AllExceptionsFilter`, `ValidationPipe`, `PrismaService`,
  fail-fast `JWT_ACCESS_SECRET` ở `main.ts`.
- design-system: component, `WebShell`/`AppPhoneFrame`/`AppMobileShell`, session provider dùng cho các màn.

## Tests

**Backend hermetic (Jest, mock Prisma)**

- `backend/test/auth.config.spec.ts`: `durationToSeconds` và mặc định an toàn của `loadAuthConfig`.
- `backend/test/auth.service.spec.ts`: login (dummy hash, inactive, cùng message), refresh rotate + đua
  đồng thời + hết hạn/thu hồi, logout idempotent.
- `backend/test/change-password.spec.ts`: đổi hash + thu hồi phiên + tiêu thụ mã reset trong một tx, sai mật
  khẩu hiện tại, trùng mật khẩu cũ, publish `PasswordChanged`.
- `backend/test/password-reset.service.spec.ts`: `requestCode` trung tính + cooldown; `reset` attempt atomic,
  vượt trần, đua tiêu thụ, cùng message mọi nhánh.
- `backend/test/jwt-auth.guard.spec.ts`: mọi nhánh 401 của guard và `request.account` không lộ `passwordHash`.
- `backend/test/password-events.spec.ts`: payload ba event không chứa bí mật, đúng 5 chiều audit.

**Backend e2e (supertest, service mock)**

- `backend/test/auth.e2e.spec.ts`: `/auth/login|refresh|logout` qua ValidationPipe + envelope lỗi.
- `backend/test/password-reset.e2e.spec.ts`: forgot/reset công khai, chống enumeration, change-password đòi
  Bearer và lấy `accountId` từ token.

**Design-system source-guard (node --test)**

- `design-system/screens/{login,forgot-password,profile}.test.mjs`: màn ghép từ component đã ship, không gọi
  mạng trực tiếp, không nav ở màn auth, nhãn Việt trùng byte web↔mobile, không literal quyền ở Hồ sơ. Web
  không có tsc nên `.tsx` chỉ được kiểm dạng text.

**Flutter widget test**

- `mobile/test/screens/auth/login_screen_test.dart`: bố cục, không nav, banner validate.
- `mobile/test/screens/auth/forgot_password_screen_test.dart`: luồng 2 bước với `FakePasswordPort`, đếm ngược
  huỷ Timer khi dispose, một message chung khi backend từ chối.
- `mobile/test/screens/account/profile_screen_test.dart`: danh tính từ `PermissionsScope`, validate, thành
  công xoá form.

Không có ca `*.db.integration.spec.ts` cho flow này: các cổng atomic (`count === 1`) chỉ được kiểm ở lane mock.
