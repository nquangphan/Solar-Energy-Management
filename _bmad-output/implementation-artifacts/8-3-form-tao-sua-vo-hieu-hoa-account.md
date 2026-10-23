---
baseline_commit: 098df7ac452491f3cef367d60e1f80b6e20e7aa4
---

# Story 8.3: Form tạo/sửa/vô hiệu hoá Account

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Admin,
I want tạo/sửa/vô hiệu hoá Account và chọn Role preset lúc tạo,
so that quản lý người dùng nội bộ.

## Acceptance Criteria

1. **Tạo account nạp preset.** Given account có `permissions.manage` mở màn Phân quyền, When bấm **"Tạo account"** (web: topbar action "+ Tạo account"; mobile: action trên topbar danh sách account), điền Họ tên, Số điện thoại (dùng đăng nhập), Email, Mật khẩu ban đầu, chọn **Role preset**, Trạng thái (mặc định Kích hoạt) rồi **"Lưu account"**, Then backend tạo `Account` + ghi `account_permissions` = đúng `ROLE_PRESETS[preset]` **trong cùng một transaction**; không lưu role trên account (AD-8 — preset chỉ nạp). Danh sách preset trong form = `GET /accounts/permission-options` `.presets` (đã lọc theo người gọi — Admin không thấy Super Admin). Body gửi preset KHÔNG cấp trọn được (luật #1 Story 2.10) ⇒ 403, không ghi gì. Tạo xong ⇒ đáp ngay vào ma trận quyền của account mới (web: `/permissions` chọn sẵn account đó; mobile: pop form rồi push `permissionAccountPath(id)`) để tick/bỏ thêm (EXPERIENCE Flow 3) (FR-16).
2. **SĐT bắt buộc, chuẩn hoá backend, unique.** Given form tạo/sửa, When lưu, Then `phone` BẮT BUỘC; client gửi chuỗi THÔ, backend chuẩn hoá qua `accountPhoneOrThrow` (→ `normalizeVnPhone`, E.164) — số rác ⇒ 400 `fieldErrors[0].field = 'phone'`. Trùng SĐT account khác (`accounts_phone_key`) ⇒ **409 `CONFLICT`** + `fieldErrors.phone` "Số điện thoại đã thuộc tài khoản khác." — cả khi hai lần tạo đồng thời (P2002 ⇒ 409, không 500). Email (bắt buộc — cột `accounts.email` NOT NULL `@unique`) lowercase + trim như seed; trùng ⇒ 409 `fieldErrors.email` "Email đã thuộc tài khoản khác." Lỗi field hiện dưới đúng ô trên cả hai nền tảng (FR-16, AD-9, 10.9).
3. **Sửa account.** Given account target mà người gọi sửa được (`editable == true` trong `GET /accounts` — không phải chính mình, không mang quyền người gọi không có), When bấm **"Sửa account"** ở thẻ account đang chọn (web) / màn quyền của account (mobile), sửa Họ tên / SĐT / Email / Trạng thái rồi lưu, Then `PUT /accounts/{id}` ghi đủ bốn field (thay thế toàn bộ, không PATCH thưa) và trả summary mới; bộ quyền KHÔNG đổi (sửa quyền vẫn ở ma trận 8.2). Form sửa không có ô mật khẩu. Account `editable == false` ⇒ không có nút sửa; gọi thẳng API ⇒ 403 (tự sửa mình: "Không thể tự sửa tài khoản của chính mình."; mang quyền người gọi không có: câu leo thang hiện có). Account không tồn tại ⇒ 404 (FR-16, Story 2.10).
4. **Vô hiệu hoá giữ dữ liệu, chặn đăng nhập tức thì.** Given account đang kích hoạt, When lưu với Trạng thái "Tạm khoá" (`isActive: false`), Then: (a) `POST /auth/login` của account đó ⇒ 401 `AUTH_FAILED_MESSAGE` (như hiện có); (b) access token đang sống bị từ chối ở **request kế tiếp** (`JwtAuthGuard` kiểm `isActive` mỗi request — có sẵn); (c) **mọi `sessions` của account bị thu hồi trong cùng transaction** (`revokedAt = now`) nên kích hoạt lại KHÔNG làm sống lại refresh token cũ; (d) KHÔNG xoá/sửa gì khác — đơn, báo giá, phiếu kho, thanh toán, audit trỏ tới account vẫn nguyên (không hard delete, không đổi FK). Kích hoạt lại ⇒ đăng nhập lại được bằng mật khẩu cũ. Danh sách account hiện "Đã vô hiệu" (có sẵn từ 8.2) (FR-16).
5. **Audit qua event.** Given tạo hoặc sửa account thành công, When commit, Then publish **đúng một** event SAU commit qua `EventBus` (AD-18): `AccountCreated` (`after` = snapshot `{ displayName, phone, email, isActive }` + `permissions` + `preset`) hoặc `AccountUpdated` (`before`/`after` = snapshot, đọc `before` **dưới khoá**). Payload TUYỆT ĐỐI không có mật khẩu thô / `passwordHash`. Lỗi validate/403/404/409 ⇒ không publish. `AuditSubscriber` có sẵn ghi `AuditLog` (`target = { type: 'Account', id }`) (FR-16, AD-18).
6. **Ghi dưới khoá, luật quyền đọc tươi.** Given tạo/sửa, When ghi, Then op đầu của transaction là `SELECT id FROM accounts WHERE id = ANY(…::text[]) ORDER BY id FOR UPDATE` (tạo: khoá actor; sửa: khoá actor + target), quyền actor (và target) đọc **qua `tx`** dưới khoá — một lần thu quyền `permissions.manage` của actor chạy song song thì hoặc thấy trọn hoặc chờ. Sửa đồng thời hai lần cùng account ⇒ dòng cuối = đúng một payload, `before` của event thứ hai = `after` của event thứ nhất.
7. **Parity web ↔ mobile, BLoC, design system.** Web: route `/permissions/new` + `/permissions/:id/edit` (con của gate `permissions`), màn `AccountFormScreen` theo mockup `s-account-form` (topbar eyebrow "QUẢN TRỊ · ACCOUNT", tiêu đề "Tạo tài khoản mới" / "Sửa tài khoản", card max 520px, `Banner` info về preset, nút "Huỷ" ghost + "Lưu account" primary). Mobile: route `/permissions/new` + `/permissions/:id/edit`, màn `account_form_{screen,cubit,state}.dart` dựng Cubit (chỉ cubit gọi port; guard `no_port_call_in_screens_test` phủ). Chọn preset bằng nút mở `Sheet`/`AppSheet` (không có select component — không tạo mới); Trạng thái bằng hai cờ `ScopeFlag`/`AppScopeFlag` (● Kích hoạt / Tạm khoá) đặt trong phần tử bấm được của màn (primitive giữ nguyên là cờ hiển thị — xem Dev Notes). Preset chỉ hiện khi **tạo**. Đang lưu ⇒ Lưu disabled + chặn quay lại (khuôn review 8.2); lỗi lưu giữ nguyên mọi ô đã gõ.

## Tasks / Subtasks

- [x] **T1 — Domain + event** (AC: #1, #5)
  - [x] `backend/src/accounts/domain/account-events.ts`: thêm `AccountSnapshot { displayName; phone; email; isActive }` (type domain thuần, không type Prisma), `AccountCreated` (`after: AccountSnapshot & { permissions: string[] (sorted); preset: RolePreset }`) và `AccountUpdated` (`before`, `after`: `AccountSnapshot`), `target = { type: 'Account', id }`. Sửa comment đầu file: bất biến là **không bí mật** (mật khẩu thô, `passwordHash`, token) — SĐT/email là thông tin liên hệ admin đã thấy ở `GET /accounts`, cùng tiền lệ `CustomerSnapshot` (`customers/domain/customer-events.ts`). `AccountPermissionsChanged` giữ nguyên.
  - [x] Unit `backend/test/account-events.spec.ts` (khuôn `password-events.spec.ts`): payload hai event không có key nào khớp `/password|hash|token/i` (đệ quy), `permissions` sorted, `target` đúng.
- [x] **T2 — Service ghi dưới khoá** (AC: #1–#6)
  - [x] `PasswordService`: chuyển **đăng ký provider** sang `AccountsModule` (`providers` + `exports`), bỏ khỏi `providers` của `AuthModule` (AuthModule import AccountsModule nên vẫn inject được). KHÔNG dời file `auth/password.service.ts` (seed + `auth-phone.e2e.spec.ts` import đường dẫn đó). Không import `AuthModule` vào `AccountsModule` (vòng).
  - [x] Thêm vào `AccountsService` (chỗ sở hữu entity `Account`; cập nhật comment "write method DUY NHẤT … CRUD thuộc Epic 8"):
    - `create(actorId, input: { displayName, phone (thô), email, password, preset, isActive })`: chuẩn hoá trước tx (`accountPhoneOrThrow`; email `trim().toLowerCase()`; `displayName.trim()` rỗng ⇒ 400 `fieldErrors.displayName` "Không được để trống."); băm mật khẩu **trước** tx (argon2 chậm — không giữ khoá lúc băm); tx: khoá actor `FOR UPDATE` → đọc quyền actor qua `tx` (`AccountPermissionsService.listForAccount(actorId, tx)`) → `keysActorCannotGrant(actorPerms, ROLE_PRESETS[preset])` ≠ ∅ ⇒ 403 câu leo thang hiện có → `tx.account.create` → `tx.accountPermission.createMany` (preset không bao giờ rỗng, vẫn giữ guard rỗng theo khuôn) → trả id; publish `AccountCreated` SAU commit; trả `AccountPermissionsService.summary(actorId, id)`.
    - `update(actorId, targetId, input: { displayName, phone (thô), email, isActive })`: chuẩn hoá trước tx; `actorId === targetId` ⇒ 403 "Không thể tự sửa tài khoản của chính mình." (trước mọi đọc DB, như self-edit của `setForAccount`); tx: khoá actor + target `ORDER BY id FOR UPDATE` → target không có ⇒ 404 "Không tìm thấy tài khoản." → đọc quyền actor + target qua `tx` → `keysBlockingActorFromTarget` ≠ ∅ ⇒ 403 → đọc snapshot `before` qua `tx` → `tx.account.update` → nếu `before.isActive && !input.isActive` ⇒ `tx.session.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: now } })` (comment: kích hoạt lại không được làm sống lại refresh token cũ; guard đã chặn access token mỗi request) → publish `AccountUpdated` SAU commit; trả summary.
    - Trùng unique: KHÔNG tự `findUnique` rồi mới ghi để quyết (đua). Bắt lỗi bằng `isUniqueViolation` (`common/errors/prisma-unique-violation.ts`), rồi **tra lại** cột nào trùng (`findFirst` theo `phone` / theo `email`, loại chính target khi sửa) để chọn `fieldErrors.phone` hay `.email` — không parse `meta.target` (Prisma 7 + adapter-pg mang meta khác; nếu muốn dùng meta, chứng minh ở lane DB). 409 `ErrorCode.CONFLICT` theo khuôn `customers.service.ts:344-360`.
    - Thứ tự kiểm fail-closed, không ghi gì khi từ chối: DTO (400) → chuẩn hoá phone/displayName (400) → self (403, chỉ update) → [tx] khoá → 404 → leo thang (403) → ghi (409 nếu unique) → commit → publish.
  - [x] Unit `backend/test/accounts.service.spec.ts` (mới; mock `$transaction(async cb)` **chạy callback** với tx giả): thứ tự kiểm (self thắng 404; số rác thắng self; 404 thắng leo thang), preset vượt quyền ⇒ 403 và `create` không gọi, quyền đọc qua `tx` không qua `this.prisma`, băm mật khẩu gọi ngoài tx, vô hiệu hoá ⇒ `session.updateMany` gọi trong tx đúng `accountId`; kích hoạt lại / sửa tên ⇒ không gọi; P2002 phone vs email ⇒ đúng `field`; publish `toHaveBeenCalledTimes(1)` chỉ khi thành công, payload không có mật khẩu/hash.
- [x] **T3 — Controller + DTO + OpenAPI** (AC: #1–#4)
  - [x] `accounts.controller.ts` (inject thêm `AccountsService`): `@Post()` `create` → 201 `AccountPermissionSummaryDto`; `@Put(':id')` `update` (`UUID_PARAM`) → 200 `AccountPermissionSummaryDto`. Cả hai `@RequirePermissions(PERM.permissionsManage)` + `@CurrentAccount()`; khai `@ApiBadRequestResponse`/`Forbidden`/`NotFound`/`ConflictResponse` với `ErrorEnvelopeDto`. `GET permission-options` vẫn khai TRƯỚC route `:id` (route `:id` mới không được nuốt nó); `PUT ':id'` và `PUT ':id/permissions'` không xung đột.
  - [x] DTO mới `dto/create-account-request.dto.ts`: `displayName` (`@IsString @IsNotEmpty @MaxLength(200)`), `phone` (`@IsString @IsNotEmpty @MaxLength(32)`, thô — mô tả như `CreateCustomerRequestDto.phone`), `email` (`@IsEmail() @MaxLength(254)`), `password` (`@IsPasswordPolicy()` từ `auth/dto/password-policy.ts` — câu "Mật khẩu tối thiểu 8 ký tự, có chữ và số."), `preset` (`@IsIn(ROLE_PRESET_KEYS)`, `enum`/`enumName: 'RolePreset'` dùng lại enum có sẵn để client sinh không đẻ enum thứ hai), `isActive` (`@IsBoolean`). `dto/update-account-request.dto.ts`: `displayName`, `phone`, `email`, `isActive` — cùng decorator, **mọi field bắt buộc** (PUT thay thế; không cần `sparse_bodies.dart` ở mobile). `createValidationPipe` chỉ bật `whitelist: true` (không `forbidNonWhitelisted` — `validation-pipe.factory.ts:18`) ⇒ field thừa bị **lặng lẽ bỏ**. Riêng `password` trong body PUT phải 400, không bỏ qua (khuôn `email` của 10.9): `@IsAbsent()` (`customers/dto/is-absent.decorator.ts`) + `@ApiHideProperty()` để client sinh không bao giờ gửi. `preset`/`permissions` thừa: để whitelist bỏ (không đổi hành vi pipe toàn cục). Mọi tên tiếng Anh (guard `no-vietnamese-api-contract`).
  - [x] `cd backend && npm run openapi:gen`. Registry KHÔNG đổi ⇒ không `permissions:gen`.
  - [x] E2E `backend/test/accounts-crud.e2e.spec.ts` (`initAppOnLoopback`, ValidationPipe thật, mock Prisma như `accounts-permissions.e2e.spec.ts`): 403 thiếu `permissions.manage` cả 2 route; POST thiếu `phone` / phone rác ⇒ 400 `field === 'phone'`; mật khẩu yếu ⇒ 400 `field === 'password'`; email sai ⇒ 400 câu "Email không hợp lệ."; preset lạ ⇒ 400; ADMIN tạo preset SUPER_ADMIN ⇒ 403; POST hợp lệ ⇒ 201 + summary không có `passwordHash`/`password` (assert key ⊆ contract, khuôn memory "response key-set vs mock rows"); P2002 ⇒ 409 `field` đúng; PUT self ⇒ 403; PUT `:id` không phải UUID ⇒ 400 câu tiếng Việt; PUT có `password` ⇒ 400; PUT không tồn tại ⇒ 404.
  - [x] DB lane `backend/test/accounts-crud.db.integration.spec.ts` (Postgres 5433): (a) tạo với preset THO_KS ⇒ `account_permissions` đúng bằng `ROLE_PRESETS.THO_KS`, `phone` E.164 từ `0912 345 678`, email lowercase; (b) **hai lần tạo đồng thời cùng SĐT** (khác email) ⇒ đúng một 201, một 409 `field: 'phone'`, chỉ một dòng account; tương tự trùng email ⇒ `field: 'email'` (chứng minh nhận diện cột không dựa meta); (c) vô hiệu hoá ⇒ mọi session `revokedAt` khác null, đơn/`AuditLog` cũ của account vẫn còn (seed một order trỏ `ownerAccountId`), `AuthService.login` ⇒ 401; kích hoạt lại ⇒ session cũ vẫn bị thu hồi, login lại được; (d) **interleaving** khoá theo CONVENTIONS "Khoá dòng": tx holder đã `UPDATE accounts SET display_name = 'X'` cho target (GHI đúng dòng primitive đọc — memory "bare lock-holder masks a missing FOR UPDATE") chưa commit, `update(...)` song song với tên 'Y' ⇒ sau cả hai, tên = 'Y' và `AuditLog` của lần 2 có `before.displayName === 'X'`; đột biến gỡ `FOR UPDATE` ⇒ ĐỎ (before đọc cũ); nếu ca không với tới được cửa sổ thì ghi rõ và phủ bằng unit mock-forced (memory "DB race test can't reach a short pre-tx window"); (e) actor bị thu `permissions.manage` trong lúc đang tạo ⇒ một ca chứng minh quyền actor đọc dưới khoá (holder ghi `account_permissions` của actor chưa commit); (f) đúng 1 dòng `AuditLog` mỗi lần lưu thành công, 0 dòng khi 409.
- [x] **T4 — Web** (AC: #1–#4, #7)
  - [x] `cd web && npm run api:gen`.
  - [x] `accounts-port.ts`: thêm `createAccount(input: CreateAccountInput): Promise<AccountPermissionSummary>` và `updateAccount(id, input: UpdateAccountInput)` — type = alias `Schemas['CreateAccountRequestDto']` / `['UpdateAccountRequestDto']` (guard composition root đòi alias type sinh); doc comment liệt kê 400/403/404/409. Cập nhật `fake-accounts-port.ts` (trả khác nhau mỗi lần), `http-accounts-port.ts` (qua client sinh, POST/PUT), `web/src/test/http-accounts-port.test.ts` (đường dẫn, body, lỗi 409 mang `fieldErrors`). Số adapter trong `composition-root.test.ts` KHÔNG đổi (cùng port).
  - [x] `routes.ts`: `ACCOUNT_NEW_PATH = '/permissions/new'`, `accountEditPath(id)` = `/permissions/${encodeURIComponent(id)}/edit` (con của `permissions`, thừa gate — comment như các route con khác). `AppRoutes.tsx`: hai `Route` qua `gate('permissions', …)`, khai `new` trước `:id/edit`.
  - [x] `web/src/screens/permissions/AccountFormScreen.tsx` (+ rule CSS thật trong `permissions.css` cho mọi className tĩnh mới): props `{ port, accountId?: string, onDone(accountId), onCancel }` — chế độ sửa nạp account từ `listAccounts()` (không thêm `GET /accounts/:id` — YAGNI; không thấy / `editable == false` ⇒ `ErrorState` "Không sửa được tài khoản này." + `readOnlyReason`), chế độ tạo nạp `getPermissionOptions()` cho preset (rỗng ⇒ `EmptyState` + Lưu disabled). Ô: `Field` "Họ tên", "Số điện thoại (dùng đăng nhập)" (`inputMode="tel"`, `autoComplete="tel"`, class `mono`), "Email" (`type="email"`), "Mật khẩu ban đầu" (`type="password"`, `autoComplete="new-password"`, chỉ khi tạo, hint "Tối thiểu 8 ký tự, có chữ và số."), "Role preset" (nút hiện nhãn preset đang chọn → `Sheet` danh sách như 8.2; chỉ khi tạo, không chọn sẵn — chưa chọn ⇒ Lưu disabled), "Trạng thái kích hoạt" (hai `ScopeFlag` bấm được). `Banner` info đúng câu mockup. Client chỉ validate rỗng; KHÔNG chuẩn hoá SĐT, KHÔNG regex mật khẩu (backend nói). Lỗi: `fieldErrors` ⇒ dưới ô theo `field`; lỗi không có field ⇒ `Banner` lỗi trên form; mọi ô giữ nguyên. Đang lưu ⇒ nút disabled, double-click không gửi hai lần.
  - [x] `PermissionsScreen.tsx`: topbar action "+ Tạo account" (`ic-plus`) → `ACCOUNT_NEW_PATH`; nút "Sửa account" trong card của account đang chọn khi `editable` → `accountEditPath`. Sau tạo/sửa ⇒ về `/permissions` với account đó được chọn (router `state: { selectAccountId }` hoặc prop tương đương — màn đọc một lần sau khi tải danh sách; ghi rõ cách chọn trong Dev Notes). Không đổi hành vi ma trận 8.2.
  - [x] Tests: ca render `AccountFormScreen` (tạo + sửa) trong `screens-render.test.tsx`; `web/src/test/account-form-screen.test.tsx`: tạo gửi đúng body (SĐT thô `0912 345 678` nguyên văn), chưa chọn preset ⇒ Lưu disabled, sheet chỉ có preset từ options, 409 `phone` ⇒ câu dưới ô SĐT và ô giữ giá trị, 400 `password` ⇒ dưới ô mật khẩu, lỗi không field ⇒ banner, sửa không có ô mật khẩu/preset và gửi đủ 4 field, account `editable:false` ⇒ ErrorState, double-click gửi 1 lần, vé chống trả lời cũ khi đổi `accountId`. `permissions-screen.test.tsx`: có nút "Tạo account"; "Sửa account" chỉ khi `editable`; quay về chọn đúng account mới. `app-routes.test.tsx`: hai route mới bị gate như `/permissions`.
- [x] **T5 — Mobile (Cubit)** (AC: #1–#4, #7)
  - [x] `cd mobile && dart run tool/generate_api.dart`.
  - [x] `accounts_port.dart`: `createAccount`, `updateAccount` (`typedef CreateAccountInput = CreateAccountRequestDto;` … — guard composition root); `fake_accounts_port.dart`; `http_accounts_port.dart` (đổi `ApiError` → `AccountsPortException` mang `message` + `fieldErrors` ở MỘT chỗ có sẵn — 409 cũng qua đó); `test/api/http_accounts_port_test.dart` thêm ca POST/PUT + 409 + mất mạng.
  - [x] `app_routes.dart`: `kAccountNewPath = '$kPermissionsPath/new'`, `accountEditPath(id)`; `signed_in_app.dart`: hai `GoRoute` khai **trước** `'$kPermissionsPath/:id'` (không thì `new` bị đọc là id), gate như route Phân quyền. Danh sách: action "Tạo" → push form; tạo xong ⇒ form trả id ⇒ **pop rồi push** `permissionAccountPath(id)` (memory: `pushReplacement` làm rơi future) và danh sách đọc lại khi quay về (khuôn callback `Future` 10.8). Màn quyền của account: nút "Sửa account" khi `editable` ⇒ push form sửa; quay về ⇒ đọc lại im lặng (topbar "Quyền · {tên mới}").
  - [x] `mobile/lib/screens/permissions/account_form_{screen,cubit,state}.dart`: topbar eyebrow "ACCOUNT", tiêu đề "Tạo tài khoản" / "Sửa tài khoản", action Lưu + nút "Lưu account" `btn--wide`; `AppField` (SĐT bàn phím `TextInputType.phone`, class mono), mật khẩu `obscureText`; preset qua `AppSheet`; trạng thái qua `AppScopeFlag` bấm được; `AppBanner` info "Preset nạp quyền mặc định; chỉnh thêm ở màn Phân quyền." `TextEditingController` ở lại `State`; cubit giữ `saving`, `fieldErrors`, `formError`, `preset`, `isActive`, `options`/`account` đã tải. `PopScope(canPop: !saving)` + nút back bỏ qua khi đang lưu (finder `byWidgetPredicate((w) => w is PopScope)` — memory).
  - [x] Tests: `bloc_test` cho cubit theo checklist project-context (đầu / tải thành công / lỗi tải / lưu thành công / lưu lỗi 400-409 giữ input / đóng sớm cả nhánh thành công lẫn lỗi; seed MỌI field khác mặc định; kỳ vọng field-by-field bằng constructor, không `copyWith`; fake trả khác nhau mỗi lần; carry-over sweep xoá từng `x: state.x`); widget test màn (wiring màn ↔ cubit, chưa chọn preset ⇒ Lưu disabled, lỗi field dưới đúng ô, sửa không có ô mật khẩu/preset, back bị chặn khi lưu, tháo màn khi port còn chờ); `app_routes_test.dart` (`/permissions/new` không bị đọc thành id, gate theo quyền); `account_list_screen_test` / `account_permissions_screen_test` (nút Tạo / Sửa theo `editable`, đọc lại sau khi form đóng).
- [x] **T6 — Guard + tài liệu + cổng** (AC: tất cả)
  - [x] Mở rộng `design-system/screens/permissions.test.mjs` (đọc mobile qua `readMobileScreen` — đủ `account_form_cubit.dart`/`_state.dart`): nhãn chung hai nền tảng đứng riêng (literal nguyên văn, không chuỗi con — memory "nested label"): "Lưu account", "Họ tên", "Role preset", "Kích hoạt", "Tạm khoá"; màn form web + cubit mobile **không chuẩn hoá SĐT** (cấm `replace(` / `RegExp` / `.replaceAll(` trên giá trị SĐT — chọn neo cụ thể, có mẫu sanity + assert chống-guard-rỗng); không literal quyền. Đột biến: chèn `.replace(/\s/g, '')` vào màn web / `replaceAll(' ', '')` vào cubit mobile ⇒ ĐỎ.
  - [x] `epics.md` Story 8.3 — ghi "Quyết định giữa story" (luật 11): email bắt buộc trong form; mật khẩu ban đầu do admin đặt lúc tạo (sửa không đổi mật khẩu; admin reset mật khẩu ngoài phạm vi); tạo nhận `preset` (backend nạp), không nhận bộ quyền tuỳ ý; sửa = `PUT` đủ 4 field; vô hiệu hoá thu hồi mọi phiên; không tự sửa/vô hiệu hoá chính mình; route form. `backend/CONVENTIONS.md` mục Auth — gộp một dòng TD-9: "Phase 1 chấp nhận access token cũ sống ≤ `ACCESS_TOKEN_TTL` (15') sau đổi mật khẩu / đổi quyền / đăng xuất; vô hiệu hoá tức thì (guard kiểm `isActive` mỗi request) + thu hồi mọi phiên; không denylist." (hai dòng liên quan đã có ở dòng 135 và 156 — sửa cho khớp, không lặp).
  - [x] Chạy đủ 5 lane: `cd backend && npm test && npm run test:db`; `cd design-system && npm test`; `cd web && npm run typecheck && npm test && npm run build`; `cd mobile && flutter analyze && flutter test`. Lint backend đỏ sẵn (memory) — chỉ chịu eslint/prettier sạch trên file mình chạm.
  - [x] Smoke web (luật 13): backend local cổng riêng + JWT secret tạm trên dòng lệnh (KHÔNG đọc/sửa `.env`), account smoke ADMIN riêng có SĐT (argon2id); ADMIN `/permissions` → "+ Tạo account" → tạo thợ preset Thợ khảo sát với SĐT `09xx xxx xxx` có dấu cách ⇒ đáp vào ma trận account mới, bỏ tick "Xem tất cả đơn"… Lưu; đăng nhập account mới bằng SĐT ⇒ vào được; tạo lại cùng SĐT ⇒ lỗi dưới ô SĐT; ADMIN sửa tên ⇒ danh sách đổi; vô hiệu hoá ⇒ phiên của thợ ở tab khác bị đẩy về `/login` ở request kế tiếp, đăng nhập lại 401; kích hoạt lại ⇒ đăng nhập được; reload giữ phiên ADMIN; đăng xuất. Smoke emulator (chỉ emulator mình bật, cold boot `-no-snapshot`, `adb -s <serial>`): Menu → Phân quyền → Tạo → lưu ⇒ đáp vào ma trận; Sửa → Tạm khoá. Dọn account smoke, kill đúng PID, tắt đúng serial.

## Dev Notes

### Luật dự án (Trợ Lý, Epic 8) — bắt buộc

Toàn văn `_bmad-output/story-automator/extra-instructions-8-review.txt` — đọc trước khi code. Áp trực tiếp: (3) màn web mới vào `screens-render.test.tsx`; (4) màn mobile mới có widget test; (5) guard mới có assert chống-guard-rỗng; (6) e2e `initAppOnLoopback`; (7) không push, `git add` đường dẫn cụ thể, `package-lock.json` `-f`; (8) code + contract tiếng Anh, chuỗi hiển thị tiếng Việt; (11) quyết định giữa story vào `epics.md` cùng commit; (13) smoke đăng nhập thật bằng account riêng có SĐT, không đọc `.env`; (17) chỉ kill PID/serial mình bật; (18) Cubit + bloc_test checklist + guard "màn không gọi port" phủ màn mới (đột biến chứng minh); (19) key quyền chỉ từ registry, giữ luật không-leo-thang 2.10, gate theo QUYỀN. (1)(2)(9)(20) không áp.

### Quyết định phạm vi (mặc định tuyên bố — ghi `epics.md` 8.3 cùng commit)

- **Email bắt buộc trong form** dù mockup chỉ có tên/SĐT/preset/trạng thái: `accounts.email` là `String @unique` NOT NULL (`schema.prisma:33`), `/me` + `@CurrentAccount()` + Hồ sơ hai nền tảng đọc `email: string`. Cho email nullable = migration + đổi contract `/me` + client sinh + màn Hồ sơ — lan scope. ~20 user nội bộ đều có email công ty. Lowercase + trim như `prisma/seed.ts:124`.
- **Mật khẩu ban đầu do admin đặt lúc tạo** (`@IsPasswordPolicy`). Không có cách nào khác để account mới đăng nhập: luồng Quên mật khẩu chưa có kênh gửi mã (CONVENTIONS "Mã chưa tới tay người dùng"). Form sửa KHÔNG có ô mật khẩu; người dùng tự đổi ở Hồ sơ (2.8). "Admin đặt lại mật khẩu cho người khác" ngoài phạm vi.
- **Tạo nhận `preset`, không nhận bộ quyền.** AC "chọn Role preset ⇒ nạp bộ quyền mặc định" — backend nạp từ `ROLE_PRESETS` (AD-2: client không gửi bộ quyền tự dựng); tinh chỉnh ở ma trận 8.2 ngay sau khi tạo (đáp thẳng vào ma trận). Preset vượt quyền người gọi ⇒ 403 bằng đúng `keysActorCannotGrant` (có `PERMISSION_IMPLIES`); mọi preset đã thoả `PERMISSION_REQUIRES` (test 8.2) nên không cần kiểm phụ thuộc lúc tạo — nếu muốn phòng thủ, gọi `missingDependencies` và để 400 (rẻ).
- **Sửa = `PUT /accounts/{id}` đủ 4 field** (`displayName, phone, email, isActive`): form luôn có đủ giá trị; PATCH thưa kéo theo bẫy `null` ≠ vắng ở mobile (`sparse_bodies.dart`, memory "Dart DTO toJson nulls vs IsOptionalNotNull"). Không gộp quyền vào route này — `PUT /accounts/{id}/permissions` (8.2) giữ nguyên.
- **Vô hiệu hoá = `isActive: false` trong form sửa** (không route riêng), thu hồi mọi phiên cùng tx. Không hard delete account (FK `Order`, `Payment`, `StockVoucher`… trỏ tới; `AuditLog.actorAccountId` là String không FK). Không tự vô hiệu hoá/sửa chính mình (403) — cùng luật "account của mình chỉ đọc" của 8.2, nên `editable` trong summary dùng chung cho nút Sửa; không thêm cờ mới.
- **Một event mỗi lần lưu**, kể cả lưu không đổi gì (giống 8.2 — bản ghi đúng hành động admin). Vô hiệu hoá là `AccountUpdated` với `isActive` đổi — Story 8.5 hiển thị trước→sau.
- **Đổi SĐT của người khác** = đổi định danh đăng nhập của họ; không thu hồi phiên (vẫn cùng account), audit ghi trước→sau. Báo trong Banner? Không — YAGNI.
- **G-2 / TD-9 (đã chốt):** access token cũ sống ≤15' sau đổi mật khẩu/quyền/đăng xuất; vô hiệu hoá tức thì; không denylist. Chỉ cập nhật CONVENTIONS mục Auth (đã có một phần ở dòng 135, 156).
- **Ngoài phạm vi:** admin reset mật khẩu người khác; xoá account; tìm kiếm/phân trang danh sách account; gửi thông tin đăng nhập cho người mới (SMS/email); quyền hành động mới (8.4); màn Audit (8.5).

### Trạng thái hiện tại các file sẽ sửa (đã đọc)

- `backend/src/accounts/accounts.service.ts`: `findByPhone`, `findById`, `updatePasswordHash(id, hash, tx?)`; comment nói "write method DUY NHẤT … CRUD thuộc Epic 8 (FR-16)" ⇒ sửa comment. Export `AccountsTransactionClient`. `auth/` dùng service này — giữ chữ ký cũ.
- `backend/src/accounts/account-permissions.service.ts`: `listForAccount(id, tx?)` (đọc dưới khoá), `setForAccount` (khuôn khoá `SELECT id FROM accounts WHERE id = ANY(${[a, b]}::text[]) ORDER BY id FOR UPDATE` — `accounts.id` là TEXT, KHÔNG cast `uuid[]`), `summary(actorId, targetId)` (trả `AccountPermissionSummary`, 404 nếu không có) — dùng lại cho response tạo/sửa. Câu leo thang: "Không thể sửa account mang quyền bạn không có: …", "Không thể cấp quyền bạn không có: …". `AccountsService` inject `AccountPermissionsService` (cùng module — không vòng; nếu Nest báo vòng thì đặt `create`/`update` vào service mới `account-admin.service.ts` inject cả hai, ghi lý do).
- `backend/src/accounts/accounts.controller.ts`: `GET /accounts`, `GET /accounts/permission-options` (khai trước `:id`), `PUT /accounts/:id/permissions`; mọi handler `permissions.manage`. Thêm `POST` + `PUT :id`.
- `backend/src/accounts/accounts.module.ts`: `controllers: [AccountsController]`, `providers: [AccountsService, AccountPermissionsService]`, export cả hai — thêm `PasswordService`.
- `backend/src/auth/auth.module.ts`: `providers` có `PasswordService` — bỏ ở đây (inject qua import `AccountsModule`). `AuthService.login` (dòng 72) đã chặn `!account.isActive`; `refresh` (dòng 120) cũng chặn; `JwtAuthGuard` chặn mỗi request — không sửa auth runtime.
- `backend/src/auth/account-phone.ts`: `accountPhoneOrThrow(raw)` ⇒ 400 `fieldErrors[{ field: 'phone', code: 'isPhoneNumber' }]` — dùng nguyên, không viết bản thứ hai.
- `backend/src/accounts/domain/account-events.ts`: chỉ `AccountPermissionsChanged`; comment "payload CHỈ mang id + danh sách permission key … không email" — viết lại cho đúng phạm vi (event mới mang snapshot liên hệ, vẫn không bí mật).
- `web/src/screens/permissions/PermissionsScreen.tsx` (258 dòng): `Topbar eyebrow="QUẢN TRỊ" title="Phân quyền & tài khoản"` chưa có action; `Frame "Tài khoản"` (cột trái), `Card variant="teal"` (cột phải: "Áp preset role", Lưu, checklist); danh sách bị disable khi `saving`; vé `loadTicket`. Thêm action + nút Sửa, nhận account cần chọn sau khi quay về.
- `web/src/app/routes.ts`: `NAV_ROUTES.permissions = '/permissions'`; route con khai hằng/hàm như `ORDER_NEW_PATH`/`orderPath`. `AppRoutes.tsx:363` route Phân quyền.
- `mobile/lib/app/app_routes.dart:18,32`: `kPermissionsPath`, `permissionAccountPath(id)`; `signed_in_app.dart:165-177`: `GoRoute` danh sách (`onOpen: context.push(permissionAccountPath)`) + `'$kPermissionsPath/:id'`.
- `mobile/lib/screens/permissions/account_list_screen.dart`: `AppTopbar` const không action, `onOpen` trả `Future` rồi đọc lại; `account_permissions_screen.dart`: topbar "Quyền · {tên}" + Lưu, `PopScope(canPop: !saving)`.
- Component có sẵn — đọc props trước: web `Field` (label/size/multiline, spread input props), `ScopeFlag({ on, children, className })`, `Sheet`, `Banner`, `Card`, `Button`, `ErrorState`, `EmptyState`, `Skeleton`; Flutter `AppField`, `AppScopeFlag({ label, on })`, `AppSheet`, `AppBanner`, `AppButton`, `AppCard`. Không có select — dùng Sheet.
- **`ScopeFlag`/`AppScopeFlag` là cờ HIỂN THỊ, cố ý không phải toggle** (`ScopeFlag.tsx:13-15`: "NOT a toggle … A screen owns the on/off decision"). Không thêm `onClick`/`onTap` vào primitive. Màn tự sở hữu lựa chọn: mỗi cờ đặt trong phần tử bấm được có sẵn (web `Button` ghost `type="button"` + `aria-pressed`; Flutter `InkWell`/`Semantics(button: true, selected: …)` với vùng chạm ≥ `tapTargetMin`). Nếu guard design-system chặn cách bọc này, dùng `Checkbox`/`AppCheckbox` "Kích hoạt" và ghi lệch mockup vào Dev Agent Record.

### Kiến trúc phải tuân

- AD-8 (preset chỉ nạp, quyền trên account là nguồn chân lý), AD-9 (SĐT chuẩn hoá chỉ ở backend), AD-4 (backend enforce, nút ẩn chỉ là UX), AD-5 (`AppException` + `fieldErrors`, không dựng envelope ở controller — guard `no-controller-error-envelope`), AD-18 (publish sau commit, không gọi `AuditService`), AD-1 (controller không chạm Prisma), AD-12 (OpenAPI sinh, regen web + mobile cùng commit), AD-17 (`PERM.x` / `PERMISSION_KEYS.x` / `AppPermissionKeys.x`; KHÔNG `AppPerm.x` ở màn mobile).
- Contract mới tiếng Anh: `POST /accounts` (operationId `create`), `PUT /accounts/{id}` (`update`); `CreateAccountRequestDto { displayName, phone, email, password, preset, isActive }`, `UpdateAccountRequestDto { displayName, phone, email, isActive }`; response `AccountPermissionSummaryDto` (có sẵn). Mã field lỗi: `displayName`, `phone`, `email`, `password`, `preset`.
- Thứ tự khoá: chỉ `accounts` (+ ghi `account_permissions`/`sessions` sau khoá), luôn `ORDER BY id` — không xung đột thứ tự toàn hệ thống (`orders` → `products`).

### Testing — bẫy đã biết (memory dự án)

- Mock `$transaction` phải chạy callback; `publish` assert `toHaveBeenCalledTimes(1)`; payload event soi đệ quy không có mật khẩu/hash.
- Ca "CHỜ khoá": holder phải GHI đúng dòng primitive đọc (`UPDATE accounts …` / ghi `account_permissions` của actor), không giữ khoá trần; mỗi nguồn của tập khoá (actor, target) một ca; đột biến bỏ từng id khỏi `ANY(…)` ⇒ ĐỎ.
- Prisma 7: P2002 mang meta khác bản cũ — nhận diện cột bằng tra lại, chứng minh ở lane DB (ca đồng thời cùng SĐT và cùng email); `createMany` rỗng giữ guard.
- Nest: không khai hai `@Put` chồng trên một handler; route tĩnh `permission-options` phải khai trước `:id` — e2e `GET /accounts/permission-options` vẫn 200 sau khi thêm `PUT :id` (đã có ca 8.2, chạy lại).
- Response key-set: assert tập key ⊆ contract, không bằng đúng (mock row thiếu cột nullable).
- Web: Node 24 `localStorage` ⇒ `memoryStorage()`; luôn `npm run typecheck` (`.tsx` lỗi cú pháp lọt guard text); mọi className tĩnh có rule CSS thật.
- Mobile: `Equatable` bỏ state trùng ⇒ fake trả khác nhau; carry-over sweep; expected field-by-field (không `copyWith`); `pushReplacement` làm rơi future ⇒ pop rồi push; route `new` khai trước `:id`; `PopScope` finder dùng predicate; ô số/chuỗi trống không ép thành giá trị mặc định (gửi đúng chuỗi người gõ, backend trả 400).
- Text-guard: `stripToCode` xoá string literal — guard soi literal đọc raw; nhãn phải khớp literal đứng riêng; neo dương khớp câu lệnh, không khớp dòng khai báo.
- Đột biến bắt buộc (cp backup, khôi phục `cp` + `cmp`, KHÔNG `git checkout`; mutant phải compile; không pipe lệnh mutant; grep literal đã chèn trước khi tin "sống"): gỡ `FOR UPDATE` ⇒ DB (d) ĐỎ; đọc quyền actor qua `this.prisma` ngoài tx ⇒ unit + DB (e) ĐỎ; bỏ kiểm self ⇒ unit + e2e ĐỎ; bỏ kiểm leo thang preset ⇒ e2e ĐỎ; bỏ `session.updateMany` ⇒ unit + DB (c) ĐỎ; bỏ nhánh 409 (để P2002 rò) ⇒ e2e + DB (b) ĐỎ; đổi `field` phone↔email ⇒ DB (b) ĐỎ; publish trước commit / hai lần ⇒ unit ĐỎ; web/mobile Lưu không disabled khi chưa chọn preset ⇒ test màn ĐỎ; web/mobile chuẩn hoá SĐT ⇒ text-guard ĐỎ; màn mobile gọi `widget.port.x` ⇒ `no_port_call_in_screens_test` ĐỎ; khai `GoRoute :id` trước `new` ⇒ `app_routes_test` ĐỎ.
- Smoke: `test:db` xoá sạch `pns-postgres` ⇒ seed account smoke SAU `test:db`; hook scout chặn `node dist/main` ⇒ `npm run start:prod`/`npm run start`; `uiautomator dump` xoá `/sdcard/ui.xml` trước mỗi lần; Chromium headless + share.

### Previous Story Intelligence (8.2)

- Khuôn đã chạy: port/fake/adapter accounts, `AccountsPortException` mobile, `held_accounts_port.dart` (giữ lời gọi để test đang lưu), vé tải chống trả lời cũ, PopScope + disable danh sách khi lưu, câu lỗi backend hiện nguyên. Tái dùng, không dựng lại.
- `matchingPresetLabel` có trong summary vì Admin không thấy preset Super Admin — form sửa không cần preset.
- Prettier: file mới `--single-quote --print-width 120` như code web xung quanh; KHÔNG chạy prettier mặc định lên file cũ (8.2 phải khôi phục 6 file). Backend theo prettier của backend.
- `health.spec.ts` từng dùng `/accounts` làm route không tồn tại — đã đổi; kiểm không còn test nào giả định `POST /accounts` là 404.
- `(a, b).wait` ở Dart bọc lỗi trong `ParallelWaitError` ⇒ màn hiện câu chung; tải song song phải bóc lỗi ở cubit.

### Git Intelligence

- `098df7a feat(story-8.2)` — accounts controller/DTO/service, màn Phân quyền web + mobile, `permission-dependencies.ts`. `11e14ff feat(story-8.1)` — khuôn màn Epic 8 + guard tiền. Commit theo khuôn `feat(story-8.3): …` tiếng Anh, không tham chiếu AI.

### Project Structure Notes

- Mới: `backend/src/accounts/dto/{create-account-request.dto.ts,update-account-request.dto.ts}`; `backend/test/{accounts.service.spec.ts,account-events.spec.ts,accounts-crud.e2e.spec.ts,accounts-crud.db.integration.spec.ts}`; `web/src/screens/permissions/AccountFormScreen.tsx`; `web/src/test/account-form-screen.test.tsx`; `mobile/lib/screens/permissions/account_form_{screen,cubit,state}.dart`; `mobile/test/screens/permissions/account_form_{cubit,screen}_test.dart`.
- Sửa: `backend/src/accounts/{accounts.service.ts,accounts.controller.ts,accounts.module.ts,domain/account-events.ts}`, `backend/src/auth/auth.module.ts`, `backend/openapi/openapi.json` (sinh), `backend/CONVENTIONS.md`; `web/src/api/generated/schema.d.ts` (sinh), `web/src/{api/http-accounts-port.ts,design-system/session/{accounts-port.ts,fake-accounts-port.ts},app/routes.ts,app/AppRoutes.tsx,screens/permissions/{PermissionsScreen.tsx,permissions.css}}`, `web/src/test/{screens-render.test.tsx,permissions-screen.test.tsx,http-accounts-port.test.ts,app-routes.test.tsx}`; `mobile/lib/api/generated/**` (sinh), `mobile/lib/{api/http_accounts_port.dart,design_system/session/{accounts_port,fake_accounts_port}.dart,app/{app_routes,signed_in_app}.dart,screens/permissions/{account_list,account_permissions}_screen.dart (+cubit nếu cần)}`, mobile tests tương ứng; `design-system/screens/permissions.test.mjs`; `epics.md`; `sprint-status.yaml`.
- `git check-ignore` mọi file mới trước khi add (gotcha `.git/info/exclude`, `assets/`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3] — AC gốc, ghi chú SĐT bắt buộc (từ 10.9 "Ngoài phạm vi"), G-2/TD-9
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2] — quyết định giữa story (không tự sửa mình, preset từ backend, "Nút Tạo account thuộc 8.3", khoá điều hướng khi lưu)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html#s-account-form] — dòng 4888-4985 (web + phone); nút "+ Tạo account" dòng 4769
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Solar-Energy-Management-2026-07-06/EXPERIENCE.md] — dòng 50 (màn), 178-185 (Flow 3)
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md] — FR-16
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md] — AD-4, AD-5, AD-8, AD-9, AD-18
- [Source: backend/CONVENTIONS.md#Auth] dòng 98-160; #Khoá dòng & test đồng thời (Epic 6)
- [Source: _bmad-output/implementation-artifacts/8-2-man-phan-quyen-ma-tran-per-account-ap-preset-role.md] — khuôn service/controller/port/cubit, review findings
- [Source: _bmad-output/implementation-artifacts/10-9-dang-nhap-bang-so-dien-thoai.md] — `accountPhoneOrThrow`, unique `accounts_phone_key`
- [Source: _bmad-output/project-context.md] — Testing (checklist cubit), Critical Don't-Miss

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, bmad-dev-story)

### Debug Log References

- Backend: `npx jest` 131 suites / 2665 pass; `npm run test:db` 30 suites / 343 pass (pns-postgres 5433). ESLint + Prettier sạch trên mọi file backend đã chạm (lint toàn repo đỏ sẵn — memory).
- Design-system `npm test` 534/534. Web `typecheck` sạch, vitest 43 files / 504 pass, `build` OK. Mobile `flutter analyze` sạch, `flutter test` 1444 pass.
- Đột biến backend (cp backup, khôi phục + cmp): gỡ `FOR UPDATE` ⇒ DB ĐỎ 3 ca; bỏ actor khỏi `ANY(...)` khi sửa ⇒ DB ĐỎ; đọc quyền actor ngoài tx ⇒ unit ĐỎ 3 ca — **lane DB SỐNG** (đúng dự đoán: sau khi chờ khoá, READ COMMITTED đọc bản đã commit dù qua `this.prisma`; cửa sổ không với tới được — phủ bằng unit mock-forced, memory "DB race test can't reach a short pre-tx window"); bỏ kiểm self ⇒ unit + e2e ĐỎ; bỏ kiểm leo thang preset ⇒ unit + e2e ĐỎ; bỏ `session.updateMany` ⇒ unit + e2e + DB ĐỎ; bỏ nhánh 409 ⇒ unit + e2e + DB ĐỎ; đổi field phone↔email ⇒ DB ĐỎ; publish hai lần / trước commit ⇒ unit + e2e ĐỎ; event giữ nguyên row ⇒ `account-events.spec` ĐỎ.
- Đột biến web: Lưu bật khi chưa chọn preset ⇒ ĐỎ; bỏ vé tải ⇒ ĐỎ; chuẩn hoá SĐT ⇒ ĐỎ (test màn + text-guard); bỏ `selectAccountId` ⇒ ĐỎ; "Sửa account" trên account không sửa được ⇒ ĐỎ. Mutant `inFlight` ref SỐNG ⇒ ref thừa (click là discrete event, React re-render disable nút trước click thứ hai) ⇒ đã gỡ.
- Đột biến mobile: canSave bỏ preset, cubit chuẩn hoá SĐT, bỏ vé tải, màn gọi `widget.port` (guard `no_port_call_in_screens_test`), PopScope không chặn, khai `:id` trước `new`, bỏ push ma trận sau tạo ⇒ cả 7 ĐỎ. Carry-over sweep 26 dòng: 1 sống (`account` trong state đang lưu — ca sửa dùng `skip: 1`) ⇒ thêm kỳ vọng state đang lưu ⇒ ĐỎ.
- Đột biến guard design-system: web `.replace(/\s/g,'')`, mobile `replaceAll(' ','')`, `split(' ').join('')`, bỏ nhãn "Lưu account" / "Tạm khoá" ⇒ cả 5 ĐỎ.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Backend: `POST /accounts` + `PUT /accounts/{id}` (`AccountsService.create/update`, cùng module — không vòng DI); `PasswordService` đăng ký ở `AccountsModule` (export), bỏ khỏi `AuthModule`. Băm mật khẩu trước tx; op đầu tx = `SELECT … FOR UPDATE` (tạo: actor; sửa: actor + target `ORDER BY id`); quyền đọc qua `tx`; vô hiệu hoá thu hồi mọi phiên cùng tx; 409 nhận diện cột bằng tra lại sau P2002 (`translateConflict`). Câu leo thang dùng chung (`blockingMessage`/`cannotGrantMessage` export từ `account-permissions.service.ts`). Event `AccountCreated`/`AccountUpdated` (snapshot chép đúng 4 key — row có `passwordHash` truyền nhầm cũng không lọt). Thứ tự kiểm: displayName/phone (400) → self (403) → [tx] khoá → 404 → leo thang (403) → ghi (409).
- `PUT` có `password` ⇒ 400 (`@IsAbsent` + `@ApiHideProperty`). `displayName` toàn khoảng trắng ⇒ 400 `fieldErrors.displayName` (service, sau trim).
- Web: `AccountFormScreen` (`/permissions/new`, `/permissions/:id/edit`, cùng gate); quay về `/permissions` mang `state.selectAccountId` — `PermissionsRoute` trong `AppRoutes.tsx` đọc `useLocation().state` và truyền prop `selectAccountId` (màn vẫn không import router); màn chọn account đó sau khi tải danh sách. Huỷ ở form sửa cũng quay về chọn đúng account.
- Mobile: `account_form_{screen,cubit,state}.dart`; list có action "+ Tạo" (push form → form `pop(id)` → push ma trận; list đọc lại khi luồng đóng); ma trận có "Sửa account" khi `editable`, quay về đọc lại im lặng (`load(silent: true)`, không skeleton). `AppField` không có kiểu mono ⇒ ô SĐT mobile dùng `TextInputType.phone`, không mono (lệch nhỏ so với mockup).
- Smoke web (backend local cổng 3083, JWT secret tạm trên dòng lệnh, account smoke ADMIN riêng có SĐT băm argon2id): đăng nhập SĐT; "+ Tạo account" → thợ preset Thợ khảo sát SĐT `0988 830 002` (có dấu cách) ⇒ đáp vào ma trận account mới đã chọn; tạo lại cùng SĐT ⇒ "Số điện thoại đã thuộc tài khoản khác." dưới ô SĐT, giá trị giữ; sửa tên + Tạm khoá ⇒ danh sách "Đã vô hiệu", access token cũ của thợ `/me` 401, login 401, refresh 401; kích hoạt lại ⇒ refresh cũ vẫn 401, login 200; reload giữ phiên ADMIN; đăng xuất ⇒ /login.
- Smoke emulator (Pixel_9_Pro cold boot `-no-snapshot`, serial riêng emulator-5584): Menu → Phân quyền → + Tạo → điền + preset Kế toán → Lưu ⇒ "Quyền · Smoke Mobile"; Sửa account → Tạm khoá → Lưu → back ⇒ danh sách "Đã vô hiệu"; login 401. (adb `input text` nuốt số 0 đầu SĐT ⇒ gửi `988 830 003`, backend vẫn chuẩn hoá ra `+84988830003`.) Đã xoá 3 account smoke, kill đúng PID backend/vite, `emu kill` đúng serial. Lưu ý: `verifier_verify_adb_installs` của AVD đã tắt để cài APK, chưa bật lại (emulator đã tắt).
- Quyết định giữa story ghi `epics.md` Story 8.3; `backend/CONVENTIONS.md` mục Auth gộp TD-9.

### File List

- backend/src/accounts/accounts.service.ts
- backend/src/accounts/account-permissions.service.ts
- backend/src/accounts/accounts.controller.ts
- backend/src/accounts/accounts.module.ts
- backend/src/accounts/domain/account-events.ts
- backend/src/accounts/dto/create-account-request.dto.ts (mới)
- backend/src/accounts/dto/update-account-request.dto.ts (mới)
- backend/src/auth/auth.module.ts
- backend/openapi/openapi.json (sinh)
- backend/CONVENTIONS.md
- backend/test/account-events.spec.ts (mới)
- backend/test/accounts.service.spec.ts (mới)
- backend/test/accounts-crud.e2e.spec.ts (mới)
- backend/test/accounts-crud.db.integration.spec.ts (mới)
- backend/test/account-phone.db.integration.spec.ts
- web/src/api/generated/schema.d.ts (sinh)
- web/src/api/http-accounts-port.ts
- web/src/design-system/session/accounts-port.ts
- web/src/design-system/session/fake-accounts-port.ts
- web/src/app/routes.ts
- web/src/app/AppRoutes.tsx
- web/src/screens/permissions/AccountFormScreen.tsx (mới)
- web/src/screens/permissions/PermissionsScreen.tsx
- web/src/screens/permissions/permissions.css
- web/src/test/account-form-screen.test.tsx (mới)
- web/src/test/screens-render.test.tsx
- web/src/test/permissions-screen.test.tsx
- web/src/test/http-accounts-port.test.ts
- web/src/test/app-routes.test.tsx
- mobile/lib/api/generated/accounts/accounts_client.dart (sinh)
- mobile/lib/api/generated/accounts/accounts_client.g.dart (sinh)
- mobile/lib/api/generated/export.dart (sinh)
- mobile/lib/api/generated/models/create_account_request_dto.dart (sinh, mới)
- mobile/lib/api/generated/models/create_account_request_dto.g.dart (sinh, mới)
- mobile/lib/api/generated/models/update_account_request_dto.dart (sinh, mới)
- mobile/lib/api/generated/models/update_account_request_dto.g.dart (sinh, mới)
- mobile/lib/api/http_accounts_port.dart
- mobile/lib/design_system/session/accounts_port.dart
- mobile/lib/design_system/session/fake_accounts_port.dart
- mobile/lib/app/app_routes.dart
- mobile/lib/app/signed_in_app.dart
- mobile/lib/screens/permissions/account_form_screen.dart (mới)
- mobile/lib/screens/permissions/account_form_cubit.dart (mới)
- mobile/lib/screens/permissions/account_form_state.dart (mới)
- mobile/lib/screens/permissions/account_list_screen.dart
- mobile/lib/screens/permissions/account_permissions_screen.dart
- mobile/lib/screens/permissions/account_permissions_cubit.dart
- mobile/test/api/http_accounts_port_test.dart
- mobile/test/app/app_routes_test.dart
- mobile/test/app/signed_in_app_test.dart
- mobile/test/screens/permissions/account_form_cubit_test.dart (mới)
- mobile/test/screens/permissions/account_form_screen_test.dart (mới)
- mobile/test/screens/permissions/account_list_screen_test.dart
- mobile/test/screens/permissions/account_permissions_cubit_test.dart
- mobile/test/screens/permissions/account_permissions_screen_test.dart
- mobile/test/screens/permissions/held_accounts_port.dart
- design-system/screens/permissions.test.mjs
- _bmad-output/implementation-artifacts/tests/test-summary-story-8-3.md (QA, mới)
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/8-3-form-tao-sua-vo-hieu-hoa-account.md

## Senior Developer Review (AI)

_Reviewer: Đại Ca (AI, bmad-story-automator-review + ck:code-review), 2026-10-23. Outcome: **Approve sau khi sửa** — 0 CRITICAL, 0 HIGH còn lại._

**Git vs File List:** lệch 1 file — `_bmad-output/implementation-artifacts/tests/test-summary-story-8-3.md` (bước QA) chưa ghi ⇒ đã thêm. `.githooks/`, `docs/*.xlsx` chưa track, không thuộc story — không đụng.

**Luật dự án đã kiểm:** (1)(2)(9)(20) không áp (không ghi đơn/tồn kho/tiền). Khoá `FOR UPDATE` + lane DB: đột biến lại bằng cp backup (không git checkout) — gỡ `FOR UPDATE` ⇒ DB 3 ĐỎ; khoá chỉ target khi sửa ⇒ DB ĐỎ; tạo không khoá actor ⇒ unit + DB ĐỎ; bỏ thu hồi phiên ⇒ DB ĐỎ; bỏ kiểm self ⇒ unit ĐỎ; bỏ leo thang preset / luật #2 ⇒ unit + DB ĐỎ. (3) màn web có ca `screens-render`; typecheck/test/bundle xanh. (4)(18) màn mobile có widget test + bloc_test; guard `no_port_call_in_screens` quét toàn `lib/screens`. (5) guard SĐT/nhãn có assert chống-guard-rỗng (`assertScanned`, anchor class cubit/state). (6) e2e `initAppOnLoopback`. (8) code/test tiếng Anh. (21) G-2/TD-9 có ở CONVENTIONS mục Auth dòng 135; không thêm đặt lại mật khẩu hộ.

**Findings (đã sửa hết):**

- [MEDIUM][AC #6] `create`/`update` đọc quyền actor dưới khoá nhưng KHÔNG kiểm lại `permissions.manage` — chỉ dựa luật #1/#2. Một lần thu RIÊNG `permissions.manage` (actor giữ phần còn lại của ADMIN) commit trong lúc chờ khoá ⇒ actor vẫn tạo được account THO_KS / vô hiệu hoá được thợ. Test DB cũ thu gần sạch quyền nên không thấy. Sửa: `assertStillManages` sau khi đọc quyền qua `tx` (403 "Không đủ quyền thực hiện", câu của `PermissionsGuard`) ở cả hai đường; +2 unit, +2 ca DB interleaving (holder ghi `account_permissions` của actor). Đột biến gỡ kiểm ⇒ unit 2 ĐỎ + DB 2 ĐỎ. Ghi chú: `setForAccount` (8.2, đã commit) có cùng khe — ngoài phạm vi 8.3, cần xử lý ở story sau.
- [MEDIUM][AC #2/#7] Web + mobile: lỗi có `fieldErrors` nhưng field không có ô trên màn (vd `password` ở form sửa, `isActive`) ⇒ không banner, không chữ dưới ô — bấm Lưu không thấy gì. Sửa: banner khi không field lỗi nào khớp ô đang hiện (web `shownFields`, cubit `_shownFields`); +1 test web, +1 bloc_test. Đột biến về logic cũ ⇒ cả hai ĐỎ.
- [LOW][AC #4c] Thu hồi phiên chỉ khi chuyển `isActive` true→false: account bị khoá bằng đường khác mà còn phiên sống thì lưu "Tạm khoá" không thu hồi, kích hoạt lại làm sống lại refresh token cũ. Sửa: mỗi lần lưu tạm khoá đều `updateMany(revokedAt: null)` (idempotent); +1 unit, +1 ca DB (khoá ngoài form → lưu khoá → kích hoạt ⇒ refresh cũ 401). Đột biến về điều kiện cũ ⇒ DB ĐỎ.
- [LOW][AC #2] `@IsEmail()` chạy trước trim của service ⇒ email có dấu cách thừa (bàn phím mobile hay chèn) bị 400 "Email không hợp lệ." dù backend tuyên bố trim. Sửa: `@Transform(trim)` ở hai DTO (khuôn `record-payment-request.dto.ts`); +2 e2e (POST 201 + PUT 200 với email có dấu cách, repo nhận bản đã trim).
- [LOW] File List thiếu test-summary QA — đã thêm.

**Không phải lỗi (đã kiểm):** nhãn mobile "Số điện thoại"/"Trạng thái" khớp mockup phone (`all-screens.html` s-account-form phone). Ma trận mobile đọc lại im lặng làm rơi draft chưa lưu — parity với web (rời màn cũng rơi draft), giữ.

**Cổng sau sửa:** backend `npx jest` 131 suites / 2670 pass; `npm run test:db` 31 suites / 368 pass; ESLint + Prettier sạch file đã chạm. Design-system 534/534. Web typecheck sạch, vitest 43 files / 512 pass, bundle OK. Mobile `flutter analyze` sạch, `flutter test` 1450 pass. OpenAPI không đổi (Transform không vào schema; drift test mobile xanh). Không chạy lại smoke web/emulator — các sửa nằm ở nhánh lỗi/đua đã phủ bằng test; luồng chính đã smoke không đổi.

## Change Log

- 2026-10-23: Story 8.3 implemented — `POST /accounts` (preset nạp cùng tx) + `PUT /accounts/{id}` (hồ sơ + vô hiệu hoá thu hồi phiên), ghi dưới khoá `accounts`, 409 phone/email, audit qua event; form tạo/sửa account web + mobile (Cubit), nút Tạo/Sửa trên màn Phân quyền, guard SĐT thô + nhãn chung; docs epics/CONVENTIONS. Status → review.
- 2026-10-23: Senior Developer Review (AI) — 2 MEDIUM + 3 LOW đã sửa (kiểm lại `permissions.manage` dưới khoá, banner cho lỗi field không có ô, thu hồi phiên mỗi lần lưu tạm khoá, trim email ở DTO, File List). Status → done.
