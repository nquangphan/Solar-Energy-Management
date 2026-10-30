# Tài khoản, phân quyền và gating giao diện

> Flow `accounts-permissions`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow accounts-permissions` in ra đúng danh sách đó.

## Mục đích

Một nguồn chân lý cho quyền (AD-17) dùng chung cho ba bên: guard backend, gating UI web/mobile và
(sau này) bộ resolve người nhận thông báo. Quyền lưu **theo từng account** ở `account_permissions` (AD-8);
preset vai trò chỉ là hằng số nạp lúc tạo/seed. Backend enforce quyền mỗi request (`PermissionsGuard`,
fail-closed); UI chỉ ẩn/hiện theo `GET /me` (AD-4: gating là UX, không phải ranh giới bảo mật). Luật gốc:
[`backend/CONVENTIONS.md`](../../backend/CONVENTIONS.md) mục "Permission registry", "Guard quyền
server-side" và "Luật không-leo-thang quyền".

Giới hạn hiện tại (theo code):

- `AccountPermissionsService.setForAccount` được gọi từ `PUT /accounts/:id/permissions` (`AccountsController.updatePermissions`). `ROLE_PRESETS` (`accounts/domain/role-presets.ts`) được `AccountPermissionsService`, `AccountsService` và `backend/prisma/seed.ts` dùng.
- `MePort` có bản HTTP thật (`HttpMePort`) trên web và mobile; `FakeMePort` chỉ dùng trong test. `SessionGatingExample` / `AppSessionGatingExample` là điểm ghép demo. Composition root: `web/src/main.tsx`, `mobile/lib/main.dart` (flow `app-shell`).
- `PermissionsGuard` cho qua handler không khai metadata quyền; việc chặn "quên khai" nằm ở source-guard,
  chỉ quét `*.controller.ts`.

## Điểm vào

- `GET /me` — `MeController.me` (`@AuthenticatedOnly()`): danh tính + bộ quyền hiệu lực đã sort.
- Guard toàn cục `PermissionsGuard` (`APP_GUARD`, khai sau `JwtAuthGuard` trong `AuthModule`) cho mọi route
  có `@RequirePermissions` / `@RequireAnyPermissions`.
- CLI `cd backend && npm run permissions:gen` → `backend/scripts/generate-permissions.ts`: sinh
  `backend/openapi/permissions.json`.
- CLI `cd design-system && npm run build:permissions` → `design-system/permissions/build-permission-keys.mjs`:
  sinh key FE web + mobile từ `permissions.json`.
- UI: `PermissionsProvider` (web React context / Flutter `StatefulWidget`) gọi `MePort.fetchMe` khi mount.

## Các bước

**Định nghĩa và phát tán quyền**

1. `backend/src/accounts/domain/permission-registry.ts` → `PERM`, `PERMISSIONS`: khai 21 key `domain.action`
   (label + group). Đây là file DUY NHẤT được chứa literal quyền.
2. `backend/src/accounts/permissions-artifact.ts` → `buildPermissionsArtifact`, `serializePermissionsArtifact`:
   map registry thành `{ key, label, group }[]`; `backend/scripts/generate-permissions.ts` → `generate` ghi
   ra `PERMISSIONS_OUTPUT_PATH` (`backend/openapi/permissions.json`).
3. `design-system/permissions/build-permission-keys.mjs` → `buildOutputs`: đọc `permissions.json`, sinh
   `PERMISSION_KEYS` (web `permission-keys.generated.ts`) và `AppPermissionKeys` (mobile
   `app_permission_keys.g.dart`) với tên camelCase (`camel`).

**Enforce ở backend mỗi request**

4. `backend/src/auth/require-permissions.decorator.ts` → `RequirePermissions` (AND) /
   `require-any-permission.decorator.ts` → `RequireAnyPermissions` (OR) / `authenticated-only.decorator.ts` →
   `AuthenticatedOnly` (marker self-service, không đổi runtime): gắn metadata lên handler.
5. `backend/src/auth/permissions.guard.ts` → `PermissionsGuard.canActivate`: bỏ qua `@Public()`; không khai
   quyền ⇒ cho qua; thiếu `request.account` ⇒ 401; resolve `AccountPermissionsService.listForAccount` đúng
   MỘT lần, kiểm AND + OR; thiếu ⇒ 403 `FORBIDDEN` `Không đủ quyền thực hiện`.

**`GET /me`**

6. `backend/src/auth/me.controller.ts` → `MeController.me`: lấy `@CurrentAccount()`, gọi `listForAccount`,
   trả `MeResponseDto` `{ id, email, displayName, permissions }` với `permissions` đã sort.

**Ghi quyền (data API, chưa có route)**

7. `backend/src/accounts/account-permissions.service.ts` → `setForAccount(actor, target, keys)`: key ngoài
   registry (`isPermissionKey`) ⇒ 400; luật #2 `keysBlockingActorFromTarget` (quyền HIỆN TẠI của target ⊆
   actor) rồi luật #1 `keysActorCannotGrant` ⇒ 403, không chạm DB; `$transaction([deleteMany, createMany?])`
   (bỏ `createMany` khi bộ rỗng); publish `AccountPermissionsChanged` sau commit.
8. `backend/src/accounts/domain/role-presets.ts` → `ROLE_PRESETS`: 7 preset (`SUPER_ADMIN`, `ADMIN`, `QUAN_LY`,
   `KE_TOAN`, `THO_KS`, `THI_CONG`, `KHO_GIAO`), chỉ dùng để nạp giá trị.
9. `backend/src/accounts/accounts.service.ts` → `AccountsService`: `findByEmail` (chuẩn hoá `normalizeEmail`),
   `findById`, `updatePasswordHash` (nhận `tx` tuỳ chọn) — dùng bởi flow auth-session.

**Gating UI**

10. `web/src/design-system/session/PermissionsProvider.tsx` → `PermissionsProvider`: `port.fetchMe()` →
    `toPermissionSet` (`session.ts`) → state `loading | ready | error`; `use-permissions.ts` →
    `usePermissions` trả `{ status, perms, orderScope, me }`.
11. `web/src/design-system/gating/permissions.ts` → `can`, `orderScope` (`all | mine | none`), `filterNav`
    (`requires` / `requiresAny`); `Gate.tsx` → `Gate` trả `null` khi thiếu quyền (không disable/làm mờ).
12. Mobile tương ứng: `app_session.dart` → `PermissionsProvider` + `PermissionsScope` (InheritedWidget,
    `PermissionsScope.of`), `app_permissions.dart` → `can`, `orderScope`, `filterNav`, `AppPerm`;
    `app_gate.dart` → `AppGate` (trả `SizedBox.shrink()`).

## Bất biến

| Bất biến | Nơi enforce | Test / guard |
|----------|-------------|--------------|
| Literal quyền chỉ nằm trong `permission-registry.ts`; nơi khác dùng `PERM` | quy ước AD-17 | `no-permission-literal-outside-registry.spec.ts` |
| Registry: key duy nhất, `domain.action` snake_case, 21 key, `view_all`/`view_own` là hai entry riêng, thứ tự ổn định | `PERMISSIONS` | `permission-registry.spec.ts` |
| `openapi/permissions.json` khớp byte-for-byte với registry (cấm sửa tay) | `generate-permissions.ts` | `permissions-drift.spec.ts` |
| Key FE sinh ra khớp byte-for-byte; mọi `PERM`/`AppPerm`/`SIDEBAR_NAV.requires` ∈ registry; màn không dùng key "ma" | `build-permission-keys.mjs` | `design-system/permissions/permission-keys.test.mjs`, `permission-registry-fe-stub-parity.spec.ts` |
| Mọi handler không `@Public` phải khai `@RequirePermissions` / `@RequireAnyPermissions` / `@AuthenticatedOnly` | source-guard | `no-handler-without-require-permissions.spec.ts` |
| Guard: AND + OR, resolve quyền tươi đúng một lần, thiếu `request.account` ⇒ 401, thiếu quyền ⇒ 403 | `PermissionsGuard` | `permissions.guard.spec.ts`, `permissions-guard.spec.ts`, `me.e2e.spec.ts` |
| `/me` trả quyền sort tất định, không `passwordHash`, account inactive ⇒ 401 | `MeController`, `JwtAuthGuard` | `me.e2e.spec.ts` |
| Không leo thang: không cấp key mình không có; không sửa account mang key mình không có (kể cả `keys = []`) | `permission-escalation.ts`, `setForAccount` | `permission-escalation.spec.ts`, `account-permissions.service.spec.ts` |
| Chỉ `SUPER_ADMIN` có `audit.read` và `system.feature_flags`; mỗi preset đúng một scope xem đơn | `ROLE_PRESETS` | `role-presets.spec.ts` |
| Ghi quyền atomic (một `$transaction`), bộ rỗng không gọi `createMany`, publish sau commit | `setForAccount` | `account-permissions.service.spec.ts` |
| Engine transition chỉ nhận bộ quyền thật của actor, không dựng tập quyền từ registry | `orders/` (call-site) | `no-fabricated-actor-permissions.spec.ts` |
| Session FE không import `DEMO_PERMISSIONS`; fake port đánh dấu TEST/DEMO-ONLY; mapping `/me` đối xứng web↔mobile | `session/*` | `design-system/session/session.test.mjs`, `parity.test.mjs` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/accounts/domain/permission-registry.ts` | SSOT quyền | `PERM`, `PERMISSIONS`, `PERMISSION_KEYS`, `PermissionKey`, `isPermissionKey` |
| `backend/src/accounts/domain/role-presets.ts` | Preset vai trò (hằng số) | `ROLE_PRESETS`, `RolePreset` |
| `backend/src/accounts/domain/permission-escalation.ts` | Luật không-leo-thang (domain thuần) | `keysActorCannotGrant`, `keysBlockingActorFromTarget` |
| `backend/src/accounts/domain/account-events.ts` | Domain event đổi quyền | `AccountPermissionsChanged` |
| `backend/src/accounts/account-permissions.service.ts` | Đọc/ghi quyền per-account | `AccountPermissionsService` (`listForAccount`, `setForAccount`) |
| `backend/src/accounts/accounts.service.ts` | Đọc danh tính, ghi hash mật khẩu | `AccountsService`, `AccountsTransactionClient` |
| `backend/src/accounts/accounts.module.ts` | Export hai service | `AccountsModule` |
| `backend/src/accounts/permissions-artifact.ts` | Dựng artifact JSON | `buildPermissionsArtifact`, `serializePermissionsArtifact`, `PERMISSIONS_OUTPUT_PATH` |
| `backend/scripts/generate-permissions.ts` | CLI `permissions:gen` | `generate` |
| `backend/openapi/permissions.json` | Artifact sinh tự động (cấm sửa tay) | — |
| `backend/prisma/migrations/20260708010000_add_account_permissions/migration.sql` | Tạo `account_permissions`, unique `(account_id, permission)` | — |
| `backend/src/auth/me.controller.ts` | `GET /me` | `MeController` |
| `backend/src/auth/dto/me-response.dto.ts` | Shape `/me` | `MeResponseDto` |
| `backend/src/auth/permissions.guard.ts` | Guard toàn cục #2 | `PermissionsGuard` |
| `backend/src/auth/require-permissions.decorator.ts`, `require-any-permission.decorator.ts`, `authenticated-only.decorator.ts` | Metadata quyền | `RequirePermissions`, `RequireAnyPermissions`, `AuthenticatedOnly` |
| `design-system/permissions/build-permission-keys.mjs` | Generator key FE | `buildOutputs`, `loadRegistry`, `camel`, `OUT_PATHS` |
| `web/src/design-system/gating/permission-keys.generated.ts`, `mobile/lib/design_system/gating/app_permission_keys.g.dart` | Key FE sinh tự động | `PERMISSION_KEYS`, `AppPermissionKeys` |
| `web/src/design-system/gating/permissions.ts`, `Gate.tsx`, `index.ts` | Primitive gating web + barrel | `can`, `orderScope`, `filterNav`, `PERM`, `DEMO_PERMISSIONS`, `Gate` |
| `mobile/lib/design_system/gating/app_permissions.dart`, `app_gate.dart`, `gating.dart` | Primitive gating mobile + barrel | `can`, `orderScope`, `filterNav`, `AppPerm`, `demoPermissions`, `AppGate` |
| `web/src/design-system/session/me-port.ts`, `fake-me-port.ts` | Port `/me` + fake | `MePort`, `MeResponse`, `FakeMePort`, `DEMO_ME` |
| `web/src/design-system/session/session.ts`, `PermissionsProvider.tsx`, `use-permissions.ts` | Provider + hook phiên web | `toPermissionSet`, `PermissionsProvider`, `usePermissionsContext`, `usePermissions` |
| `web/src/design-system/session/SessionGatingExample.tsx` | Điểm ghép demo gating | `SessionGatingExample` |
| `web/src/design-system/session/index.ts` | Barrel mọi port/fake/provider (dùng chung nhiều flow) | — |
| `mobile/lib/design_system/session/me_port.dart`, `fake_me_port.dart` | Port `/me` + fake mobile | `MePort`, `MeResponse`, `FakeMePort`, `kDemoMe` |
| `mobile/lib/design_system/session/app_session.dart` | Provider + scope mobile | `PermissionsProvider`, `PermissionsScope`, `SessionStatus`, `toPermissionSet` |
| `mobile/lib/design_system/session/app_session_gating_example.dart` | Điểm ghép demo gating mobile | `AppSessionGatingExample`, `kMenuSections` |
| `mobile/lib/design_system/session/session.dart` | Barrel session mobile (dùng chung nhiều flow) | — |

## Dữ liệu

- Bảng: `account_permissions` (đọc mỗi request có khai quyền và ở `/me`; ghi qua `setForAccount`),
  `accounts` (đọc qua `AccountsService`).
- Sự kiện phát: `AccountPermissionsChanged` (`before`/`after` là danh sách key đã sort, không bí mật). Flow
  này không subscribe event nào.
- Gọi ngoài: không. Artifact trung gian: `backend/openapi/permissions.json` (backend → design-system).

## Flow liên quan

- auth-session: `JwtAuthGuard` gắn `request.account` trước `PermissionsGuard`; `AuthService` /
  `PasswordResetService` dùng `AccountsService`; `ProfileScreen` đọc danh tính từ session provider.
- domain-events-audit: `AccountPermissionsChanged` đi qua `EventBus`, `AuditSubscriber` ghi `audit_logs`.
- orders: `GET /orders` dùng `@RequireAnyPermissions(orders.view_all, orders.view_own)`; engine transition
  bị `no-fabricated-actor-permissions.spec.ts` canh.
- catalog, customers, inventory, system-settings: route khai `@RequirePermissions(PERM.x)`; màn dùng `filterNav`
  / `Gate` / `AppGate`.
- design-system: shell (`Sidebar`, `SIDEBAR_NAV`) tiêu thụ `filterNav`.
- backend-platform: `AppException`/`ErrorCode`, `PrismaService`, seed (`backend/prisma/seed.ts`).

## Mở rộng: quản trị tài khoản và màn Phân quyền

Route quản trị tài khoản và luật phụ thuộc quyền (Epic 8). Màn quản lý nằm ở hai client; port thật
dùng client sinh tự động. Cổng của mọi route là `permissions.manage`.

- `GET /accounts`, `GET /accounts/permission-options`, `POST /accounts`, `PUT /accounts/:id`, `PUT /accounts/:id/permissions`
  (`AccountsController`). `PUT /accounts/:id/permissions` gọi `AccountPermissionsService.setForAccount`.
- `permission-dependencies.ts` khai báo hai loại phụ thuộc: `PERMISSION_REQUIRES` (cần đủ mọi khoá) và
  `PERMISSION_REQUIRES_ANY` (cần ít nhất một khoá). Bộ quyền thiếu phụ thuộc bị từ chối 400 (`missingDependencies`, `dependencyMessage`).

| Đường dẫn | Vai trò |
|-----------|---------|
| `backend/src/accounts/accounts.controller.ts` | Route quản trị tài khoản (`AccountsController`) |
| `backend/src/accounts/domain/permission-dependencies.ts` | Luật phụ thuộc quyền (AND/OR) |
| `backend/src/accounts/dto/account-permission-summary.dto.ts` | Tóm tắt quyền của một tài khoản |
| `backend/src/accounts/dto/create-account-request.dto.ts`, `update-account-request.dto.ts` | Body tạo và sửa tài khoản |
| `backend/src/accounts/dto/update-account-permissions-request.dto.ts`, `permission-options-response.dto.ts` | Body ghi quyền và danh mục quyền cho màn |
| `mobile/lib/screens/permissions/account_list_screen.dart`, `account_list_cubit.dart`, `account_list_state.dart` | Danh sách tài khoản (mobile) |
| `mobile/lib/screens/permissions/account_form_screen.dart`, `account_form_cubit.dart`, `account_form_state.dart` | Tạo và sửa tài khoản (mobile) |
| `mobile/lib/screens/permissions/account_permissions_screen.dart`, `account_permissions_cubit.dart`, `account_permissions_state.dart` | Checklist quyền của một tài khoản, "Áp preset role" (mobile) |
| `mobile/lib/design_system/session/accounts_port.dart`, `fake_accounts_port.dart` | Port và fake quản trị tài khoản (mobile) |
| `mobile/lib/design_system/session/permissions_cubit.dart` | `PermissionsCubit`: quyền tươi cho gating giao diện |
| `mobile/lib/api/http_accounts_port.dart`, `mobile/lib/api/http_me_port.dart` | Port thật: quản trị tài khoản và `/me` |
| `web/src/screens/permissions/PermissionsScreen.tsx`, `web/src/screens/permissions/AccountFormScreen.tsx`, `web/src/screens/permissions/permissions.css` | Màn Phân quyền và Tạo/sửa tài khoản (web) |
| `web/src/design-system/session/accounts-port.ts`, `fake-accounts-port.ts` | Port và fake quản trị tài khoản (web) |
| `web/src/api/http-accounts-port.ts`, `web/src/api/http-me-port.ts` | Port thật: quản trị tài khoản và `/me` (web) |

## Tests

**Backend hermetic (Jest)**

- `backend/test/permission-registry.spec.ts`: tính duy nhất, naming, 21 key, thứ tự append, label/group.
- `backend/test/role-presets.spec.ts`: ranh giới `SUPER_ADMIN`/`ADMIN`, `costs.view`, `settings.manage`, scope
  xem đơn XOR.
- `backend/test/permission-escalation.spec.ts`: luật #1, #2 và bất biến "ADMIN không đụng được SUPER_ADMIN".
- `backend/test/account-permissions.service.spec.ts`: key lạ ⇒ 400, hai luật ⇒ 403 không chạm DB, tx
  xoá-cũ-tạo-mới, dedup, bộ rỗng chỉ `deleteMany`, publish sau commit.
- `backend/test/permissions.guard.spec.ts`, `backend/test/permissions-guard.spec.ts`: hành vi AND, OR, kết hợp,
  `@Public`, resolve đúng một lần, fail-closed khi thiếu `request.account`.
- `backend/test/auth-decorators.spec.ts`: metadata `@Public`, `@RequirePermissions`, `@CurrentAccount`.
- `backend/test/permissions-drift.spec.ts`: `permissions.json` khớp byte-for-byte với registry.

**Backend e2e**

- `backend/test/me.e2e.spec.ts`: `GET /me` 401/200/shape/sort/inactive và enforcement 403 trên một route
  thử `@RequirePermissions(PERM.auditRead)`.

**Source-guard (`no-*.spec.ts` và parity)**

- `backend/test/no-permission-literal-outside-registry.spec.ts`: literal quyền ngoài registry.
- `backend/test/no-handler-without-require-permissions.spec.ts`: handler không khai quyền (bỏ comment, giữ string).
- `backend/test/no-fabricated-actor-permissions.spec.ts`: bộ quyền tự chế truyền vào engine transition.
- `backend/test/permission-registry-fe-stub-parity.spec.ts`: literal trong `permissions.ts` / `app_permissions.dart`
  ∈ registry.

**Design-system (node --test)**

- `design-system/permissions/permission-keys.test.mjs`: file sinh khớp byte-for-byte, không drift, không key ma.
- `design-system/session/session.test.mjs`: shape module session web, không `DEMO_PERMISSIONS` trên đường thật.
- `design-system/session/parity.test.mjs`: twin file web↔mobile cho session và mọi port (phần lớn ca thuộc
  flow khác: customers, orders, warranty, inventory).

**Flutter widget test**

- `mobile/test/design_system/session_test.dart`: `toPermissionSet`, `orderScope`, ẩn/hiện Audit, `AppGate`
  doanh thu, trạng thái loading/error của `PermissionsProvider`.

Không có ca `*.db.integration.spec.ts`: tính atomic của `setForAccount` (`$transaction([deleteMany,
createMany])`, không khoá dòng) chỉ được kiểm ở lane mock.
