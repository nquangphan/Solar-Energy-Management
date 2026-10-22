---
baseline_commit: 859b894
---

# Story 10.9: Đăng nhập bằng số điện thoại (thay email)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a nhân viên,
I want đăng nhập bằng số điện thoại của mình,
so that không phải nhớ email công ty.

[Đại Ca chốt 2026-10-22: **chỉ SĐT**, bỏ đăng nhập bằng email; chạy sau 10.8, trước retro Epic 10.]

---

## 🛑 ĐỌC HẾT MỤC NÀY TRƯỚC KHI GÕ DÒNG CODE ĐẦU TIÊN

Story chạm **cả ba client + DB**: migration `accounts.phone`, contract `/auth/login|forgot-password|reset-password` đổi định danh `email` → `phone`, `/me` thêm `phone`, regen `openapi.json` + client web + client Dart, màn Đăng nhập + Quên mật khẩu web/mobile, seed. Đọc trước: `backend/src/auth/{auth.controller,auth.service,password-reset.service,me.controller,jwt-auth.guard,current-account.decorator}.ts`, `backend/src/auth/dto/*.ts`, `backend/src/accounts/accounts.service.ts`, `backend/src/customers/domain/phone.ts`, `backend/src/customers/customers.service.ts:60-85` (khuôn `normalizeOrThrow`), `backend/src/customers/dto/is-absent.decorator.ts`, `backend/prisma/seed.ts:112-160`, `web/src/screens/auth/{LoginScreen,ForgotPasswordScreen}.tsx`, `mobile/lib/screens/auth/{login_screen,forgot_password_screen}.dart`, `design-system/screens/{login,forgot-password}.test.mjs`, `design-system/session/parity.test.mjs:65-90`.

### 1. Hiện trạng (scout 2026-10-22, HEAD `859b894`)

| Bề mặt | Hiện trạng |
|---|---|
| `Account` (`backend/prisma/schema.prisma:31`) | `email String @unique` là định danh đăng nhập; KHÔNG có cột SĐT. 24 migration, mới nhất `20261022200000_add_invoice_pdfs` |
| `AccountsService` | `findByEmail(email)` (chuẩn hoá `normalizeEmail` trim+lowercase), `findById`, `updatePasswordHash` — write method duy nhất (CRUD account là Epic 8) |
| `AuthService.login(email, password)` | `findByEmail` → verify argon2 **luôn** (dummy hash khi vắng) → mọi nhánh sai ném `AppException(UNAUTHENTICATED, 401, AUTH_FAILED_MESSAGE)` = `'Thông tin đăng nhập không đúng'` |
| `PasswordResetService` | `requestCode(email)` (băm luôn, trả `{expiresInSeconds}` giống hệt dù có account hay không) + `reset(email, code, newPassword)` — cả hai gọi `findByEmail` |
| DTO auth | `LoginRequestDto { email @IsEmail, password }`, `ForgotPasswordRequestDto { email @IsEmail }`, `ResetPasswordRequestDto { email @IsEmail, code, newPassword }`, `MeResponseDto { id, email, displayName, permissions }` |
| `/me` | `MeController` trả `{ ...request.account, permissions }`; `request.account` dựng ở `JwtAuthGuard:82-86` = `{ id, email, displayName }` (interface `AuthenticatedAccount`, `current-account.decorator.ts:8`) |
| Chuẩn hoá SĐT | `normalizeVnPhone(raw): string \| null` ở `customers/domain/phone.ts` (libphonenumber-js, trả E.164 hoặc `null`). `orders.service.ts:11` đã import thẳng từ `../customers/domain/phone` — **tiền lệ dùng chéo module** |
| ValidationPipe | `whitelist: true`, **KHÔNG** `forbidNonWhitelisted` ⇒ field lạ bị **cắt im lặng** (`common/validation/validation-pipe.factory.ts:18`). Khuôn chặn có sẵn: `@IsAbsent(message)` (`customers/dto/is-absent.decorator.ts`, dùng ở `update-customer-request.dto.ts:40`) |
| Kênh gửi mã reset | Chỉ publish `PasswordResetRequested` — **không consumer nào** trong `src/` (CONVENTIONS.md:136 "chưa có kênh email/SMS"). "Giữ nguyên kênh" = không đụng seam này |
| Seed | `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (vắng cả hai ⇒ bỏ qua; thiếu một ⇒ ném), `upsert where email`; `.env.example:31-35`; `backend/README.md:34,38,42-43` |
| Web | `LoginScreen.tsx`: ô "Tài khoản" `type="email"`, regex email cục bộ, `port.login({ email, password })`. `ForgotPasswordScreen.tsx`: ô "Email đã đăng ký", `EMAIL_RE`, `maskEmail` (cũng có ở WEB, không chỉ mobile), lỗi request luôn "Không gửi được mã. Thử lại sau.". Port: `AuthPort.login(input: { email; password })`, `PasswordPort.requestResetCode(email)`, `resetPassword({ email, code, newPassword })`; adapter `web/src/api/http-{auth,password}-port.ts`; `Field` KHÔNG có prop lỗi — khuôn lỗi dưới ô = `<Banner tone="danger">` ngay sau `Field` (`CustomerPickScreen.tsx:149` + `fieldErrorsOf` :359) |
| Mobile | `login_screen.dart`: ô "Tài khoản" `TextInputType.emailAddress`, regex email, `port.login(email:, password:)`. `forgot_password_screen.dart`: `_emailRe`, `maskEmail` public (dòng 32, dùng 249), `_email` controller. Port `auth_port.dart:11`, `password_port.dart:26-30`, fake `fake_{auth,password,me}_port.dart`, adapter `lib/api/http_{auth,password}_port.dart` (`LoginRequestDto(email:…)`, `ForgotPasswordRequestDto(email:…)`, `ResetPasswordRequestDto(email:…)`). `ApiError.fieldErrors` là `List<FieldErrorDto>?`; khuôn lỗi dưới ô: `_fieldError(field)` ở `customer_pick_screen.dart:170` |
| Guard design-system | `screens/login.test.mjs:57-66,106-122` (nhãn byte-identical gồm `'Email đăng nhập'`, `'Tài khoản phải là email hợp lệ.'`), `screens/forgot-password.test.mjs:125-170` (gồm `'Email đã đăng ký'`, `'Đã gửi mã 6 số đến '`, `'Email không hợp lệ.'`; regex cấm `email không tồn tại`), `session/parity.test.mjs:77-78,84-85` (chữ ký port có `email`), `session/session.test.mjs:44` (field `/me`), `screens/profile.test.mjs:109` (`me?.email` — GIỮ) |

### 2. 🔥 BẪY SỐ 1 — `email` thừa trong body bị cắt im lặng, không phải 400

`whitelist: true` cắt field không khai báo. Chỉ đổi `email` → `phone` trong DTO ⇒ `{ phone, password, email }` trả 200 và AC "email bị từ chối (400)" gãy mà mọi test happy-path vẫn xanh. **Phải** khai `email` trong DTO với `@IsAbsent('…')` **và** `@ApiHideProperty()`.

Vì sao `@ApiHideProperty()` bắt buộc (khác `UpdateCustomerRequestDto` dùng `@ApiPropertyOptional`): nếu `email` lọt vào `openapi.json`, `swagger_parser` sinh `LoginRequestDto(email: …)` và `toJson` Dart **ghi mọi key kể cả null** (memory `json-serializable-null-vs-absent-isoptionalnotnull`) ⇒ mobile gửi `"email": null` ⇒ `@ValidateIf(value !== undefined)` coi `null` là CÓ MẶT ⇒ **mọi lần đăng nhập mobile 400**. Hidden ⇒ client sinh không có field ⇒ không bao giờ gửi. Test: guard drift `openapi.json` + grep `email` trong `LoginRequestDto` sinh (web `schema.d.ts`, Dart `login_request_dto.dart`) phải rỗng.

### 3. 🔥 BẪY SỐ 2 — e2e auth hiện mock `AuthService` ⇒ chuẩn hoá SĐT không bao giờ chạy

`test/auth.e2e.spec.ts:21-38` override `AuthService` bằng `authMock`; `password-reset.e2e.spec.ts` mock `PasswordResetService`. AC "e2e login bằng SĐT nhiều dạng" đo trên mock = đo `jest.fn` (memory `dev-pins-ac-deviation-as-green-test`). Ca e2e SĐT phải chạy **`AuthService`/`PasswordResetService` THẬT**, chỉ override `PrismaService`/`AccountsService` (khuôn `password-reset.e2e.spec.ts:46-60` override `AccountsService` bằng `accountsMock`) + hash argon2 thật tính trong `beforeAll`. Assert: `accountsMock.findByPhone` nhận đúng `'+84912345678'` cho cả `'0912 345 678'` và `'+84912345678'`; 200 trả token. Ca DTO (400) giữ `authMock` được.

### 4. 🔥 BẪY SỐ 3 — `account.phone = null` không được trở thành "khớp"

Account cũ chưa có SĐT ⇒ `phone` NULL. Tra **chỉ** bằng chuỗi E.164 đã chuẩn hoá (không bao giờ `null`) qua `findUnique({ where: { phone } })` — số không phân giải được đã bị chặn 400 TRƯỚC khi tra. Không viết `findFirst({ where: { phone: input ?? undefined } })` (Prisma bỏ `undefined` ⇒ khớp account đầu tiên ⇒ đăng nhập nhầm người). Ca unit: account `phone: null` + đúng mật khẩu ⇒ 401 `AUTH_FAILED_MESSAGE`.

### 5. Thiết kế đã chốt (YOLO — mỗi quyết định có lý do)

- **D1 — Cột:** `phone String? @unique` trên `Account` (Prisma), migration tay `20261022230000_add_account_phone`: `ALTER TABLE "accounts" ADD COLUMN "phone" TEXT; CREATE UNIQUE INDEX "accounts_phone_key" ON "accounts"("phone");`. Postgres cho nhiều NULL trong unique index ⇒ account cũ cùng NULL không xung đột. KHÔNG thêm CHECK định dạng: `customers.sdt` cũng không có, bất biến E.164 giữ ở tầng app (chỉ một cửa ghi: seed; Epic 8 form account). Sinh SQL bằng `npx prisma migrate diff --from-schema … --to-schema …` (Prisma 7 đổi tên flag — memory `prisma7-migrate-diff-flag-rename`) rồi đặt tên tay.
- **D2 — Helper chuẩn hoá:** dùng thẳng `normalizeVnPhone` từ `customers/domain/phone.ts` — **KHÔNG** chuyển ra `common/` (tiền lệ `orders.service.ts:11`; dời file đụng 4 importer + `phone.spec.ts` mà không giảm độ phức tạp nào). Epics cho phép "chuyển ra common/ NẾU cần" — không cần.
- **D3 — Một cửa 400 cho auth:** hàm `accountPhoneOrThrow(raw: string): string` ở file mới `backend/src/auth/account-phone.ts` (khuôn `CustomersService.normalizeOrThrow`): `normalizeVnPhone` → `null` ⇒ `AppException(VALIDATION_ERROR, 400, 'Số điện thoại không hợp lệ.', [{ field: 'phone', code: 'isPhoneNumber', message: 'Số điện thoại không hợp lệ — cần số Việt Nam (vd 0912345678).' }])`. Câu chữ **giống hệt** customers. Gọi ở đầu `AuthService.login`, `PasswordResetService.requestCode`, `PasswordResetService.reset`. Số sai định dạng ⇒ 400 không lộ gì về account (định dạng là thuộc tính của chuỗi, không của DB).
- **D4 — `AccountsService.findByPhone(e164: string)`** thay `findByEmail` ở cả 3 chỗ gọi; nhận chuỗi ĐÃ chuẩn hoá (không tự chuẩn hoá lần hai). Sau story `findByEmail` không còn caller ⇒ **xoá** (chính story làm nó thừa); `normalizeEmail` cũng xoá nếu không còn caller (seed tự lowercase, chỉ nhắc trong comment — sửa comment).
- **D5 — DTO:** `LoginRequestDto { phone, password, email(hidden, IsAbsent) }`, `ForgotPasswordRequestDto { phone, email(hidden, IsAbsent) }`, `ResetPasswordRequestDto { phone, code, newPassword, email(hidden, IsAbsent) }`. `phone`: `@IsString() @IsNotEmpty() @MaxLength(32)` (khuôn `LookupCustomerQueryDto`), `@ApiProperty({ description: 'SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.', example: '0912345678' })`. Message `IsAbsent`: `'Đăng nhập bằng số điện thoại — không gửi email.'`. Áp cho cả 3 DTO (AC chỉ nêu login; forgot/reset cùng định danh ⇒ cùng luật, chi phí 0, client cũ gửi email nhận lời giải thích thay vì chỉ "thiếu phone"). Import `IsAbsent` từ `../../customers/dto/is-absent.decorator` (không dời — cùng lý do D2).
- **D6 — Message:** `AUTH_FAILED_MESSAGE`/`RESET_FAILED_MESSAGE` giữ nguyên chữ; chỉ sửa **comment** "email lạ" → "SĐT lạ". Nhánh "account chưa có SĐT" rơi tự nhiên vào "không tìm thấy" ⇒ dummy hash ⇒ cùng 401.
- **D7 — `/me` + danh tính request:** `AuthenticatedAccount` thêm `phone: string | null`; `JwtAuthGuard` gắn `phone: account.phone`; `MeResponseDto.phone` = `@ApiProperty({ type: String, nullable: true, description: 'SĐT đăng nhập (E.164) — null khi account chưa có số.' })` (guard `openapi-no-untyped-object.spec.ts`: `X | null` phải khai `type` tường minh; allowlist RỖNG). `email` trong `/me` GIỮ (thông tin liên hệ). `@CurrentAccount` mở rộng field là cộng thêm — rà caller dùng `AuthenticatedAccount` dựng tay trong test (fixture thiếu `phone` ⇒ tsc đỏ, sửa fixture).
- **D8 — Seed:** đọc `SEED_ADMIN_PHONE`; quy tắc "vắng CẢ BA ⇒ bỏ qua; có một/hai mà thiếu cái khác ⇒ ném" (mở rộng đúng quy tắc hiện có). `normalizeVnPhone(raw)` → `null` ⇒ ném `Error('SEED_ADMIN_PHONE không phải SĐT Việt Nam hợp lệ.')`. `upsert where { email }`, `update: { passwordHash, isActive: true, phone }`, `create: { …, phone }`. Log in E.164. `.env.example` thêm `SEED_ADMIN_PHONE=0900000000` (số giả, comment "bắt buộc cùng EMAIL/PASSWORD; đăng nhập bằng số này"); README dòng 34/38/42-43 đổi "POST /auth/login với SĐT/mật khẩu admin". **KHÔNG đọc/sửa `backend/.env`** — ghi vào Completion Notes rằng máy Đại Ca cần thêm `SEED_ADMIN_PHONE` trước lần seed tới (không có ⇒ seed ném, đúng thiết kế).
- **D9 — Web màn Đăng nhập:** nhãn ô `'Tài khoản'` đổi thành `'Số điện thoại'` (AC: ô "Số điện thoại" thay ô email). `Field label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" placeholder="Nhập số điện thoại"`. Validate cục bộ CHỈ rỗng: `'Nhập đủ số điện thoại và mật khẩu.'`; bỏ regex email + câu `'Tài khoản phải là email hợp lệ.'`. Gửi `value.trim()` (trim hai đầu không phải chuẩn hoá SĐT) nhưng KHÔNG bỏ khoảng trắng giữa/dấu chấm/`+84`. Lỗi: `ApiError` có `fieldErrors` field `phone` ⇒ hiện `<Banner tone="danger">` ngay dưới ô SĐT (message đầu tiên của field), không lặp ở Banner trên form; lỗi khác ⇒ Banner trên như cũ. Port: `login(input: { phone: string; password: string })`.
- **D10 — Web Quên mật khẩu:** ô `label="Số điện thoại đã đăng ký" type="tel" inputMode="tel" autoComplete="tel" placeholder="Nhập số điện thoại đã đăng ký"`; rỗng ⇒ `'Nhập số điện thoại đã đăng ký.'`; bỏ `EMAIL_RE`, `'Email không hợp lệ.'`, `maskEmail`. Request lỗi: `fieldErrors.phone` ⇒ dưới ô; khác ⇒ `'Không gửi được mã. Thử lại sau.'` như cũ. Câu xác nhận bước 2 thay `Đã gửi mã 6 số đến {mask}. Mã có hiệu lực 5 phút.` bằng **`Nếu số điện thoại đã đăng ký, mã 6 số sẽ được gửi tới số đó. Mã có hiệu lực 5 phút.`** — không chứa số người dùng gõ, không khẳng định đã gửi (không lộ tồn tại). Reset: `fieldErrors.phone` không thể xảy ra ở bước 2 (đã qua bước 1) nhưng nếu có ⇒ vẫn rơi vào câu chung duy nhất (giữ guard "ONE failure message"). Port: `requestResetCode(phone: string)`, `resetPassword({ phone, code, newPassword })`.
- **D11 — Mobile:** mirror byte-identical D9/D10: `AppField(label: 'Số điện thoại', keyboardType: TextInputType.phone, placeholder: 'Nhập số điện thoại')` (bàn phím số điện thoại — gõ được `+`, khoảng trắng); xoá `maskEmail` + `_emailRe`; `_email` → `_phone`; lỗi field dưới ô theo khuôn `customer_pick_screen.dart:170` (đọc `ApiError.fieldErrors` phần tử ĐẦU có `field == 'phone'`). Port: `login({required String phone, required String password})`, `requestResetCode(String phone)`, `resetPassword({required String phone, …})`. Fake ports đổi theo (map credential theo `phone`).
- **D12 — Hồ sơ/Menu:** KHÔNG thêm dòng SĐT (AC không đòi; `profile.test.mjs:109` ghim `me?.email`). Fake `/me` web/mobile + `app_harness.dart:72` thêm `phone` vì type sinh bắt buộc key (nullable).
- **D13 — Regen:** `cd backend && npm run openapi:gen` → `cd web && npm run api:gen` → `cd mobile && dart run tool/generate_api.dart` — cùng commit (3 drift-guard byte-for-byte). Không sửa tay file sinh.

### 6. Phạm vi

- **Trong:** migration + schema, DTO/service/guard/`/me` auth, seed + `.env.example` + README + `backend/CONVENTIONS.md` (dòng 79 ví dụ, 111, 125, 153, 156 nhắc email làm định danh), regen 3 nơi, màn + port + adapter + fake Đăng nhập/Quên mật khẩu web + mobile, guard design-system, test 5 lane, smoke web + emulator, `project-context.md` (G-5: một dòng về đăng nhập SĐT).
- **Ngoài:** form tạo/sửa account (Epic 8 — form account BẮT BUỘC SĐT, ghi khi viết Story 8.3); OTP SMS / kênh gửi mã thật; đăng nhập email song song; đổi `ChangePasswordController` (không có định danh); hiển thị SĐT trên Hồ sơ/Menu; backfill SĐT cho account có sẵn (vận hành — xem Câu hỏi mở 1).

## Acceptance Criteria

### AC gốc (nguyên văn `epics.md` Story 10.9)

- **Given** bảng `Account` chỉ có `email`, **When** migration, **Then** thêm cột `phone` (E.164, `@unique`, nullable vì account cũ chưa có số); `email` GIỮ làm thông tin liên hệ, không còn là định danh đăng nhập.
- **Given** `POST /auth/login`, **When** gửi `{ phone, password }`, **Then** backend chuẩn hoá SĐT bằng đúng helper AD-9 của khách (`backend/src/customers/domain/phone.ts`, chuyển ra `common/` nếu cần dùng chung) rồi mới tra; số không phân giải được ⇒ 400 + `fieldErrors.phone`; sai SĐT/mật khẩu/account chưa có SĐT/inactive ⇒ cùng 401 `AUTH_FAILED_MESSAGE` (không dò được SĐT nào tồn tại); field `email` trong body login bị từ chối (400), không lặng lẽ bỏ qua.
- **Given** quên/đặt lại mật khẩu, **When** `POST /auth/forgot-password` + `/auth/reset-password`, **Then** định danh cũng là `phone` (cùng chuẩn hoá, cùng body trả giống hệt nhau dù số tồn tại hay không); kênh gửi mã giữ nguyên như hiện tại.
- **Given** seed, **When** `npx prisma db seed`, **Then** đọc thêm `SEED_ADMIN_PHONE` (bắt buộc cùng `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`); `.env.example` + `backend/README.md` cập nhật; KHÔNG đọc/sửa `backend/.env`.
- **Given** `GET /me`, **When** gọi, **Then** trả thêm `phone`; `openapi.json` sinh lại, client web + Dart sinh lại (drift-guard xanh).
- **Given** màn Đăng nhập + Quên mật khẩu web và mobile, **When** dùng, **Then** ô "Số điện thoại" (bàn phím số trên mobile, `autocomplete="tel"` trên web) thay ô email; gửi chuỗi THÔ, client không tự chuẩn hoá (AD-9); lỗi `fieldErrors.phone` hiện dưới ô; bỏ `maskEmail` ở mobile, câu xác nhận không lộ số có tồn tại hay không.
- **Given** test, **When** 5 lane, **Then** ca unit + e2e login bằng SĐT nhiều dạng (`0912 345 678`, `+84912345678`), ca email-trong-body ⇒ 400, ca account chưa có SĐT ⇒ 401 cùng message; ca DB: hai account trùng SĐT ⇒ unique vi phạm; widget test mobile + vitest web cho ô SĐT; smoke thật đăng nhập bằng SĐT trên web và emulator.
- **Ngoài phạm vi:** form tạo/sửa account (Epic 8 — form account Epic 8 phải BẮT BUỘC SĐT, ghi vào Story 8.x khi viết); OTP SMS; đăng nhập bằng email song song.

### AC dẫn xuất (đo được)

1. Migration `…_add_account_phone` áp được bằng `npx prisma migrate deploy` trên `pns-postgres`; `\d accounts` có `phone text` nullable + unique index `accounts_phone_key`; account có sẵn giữ `phone` NULL, đăng nhập email cũ không còn đường nào.
2. `POST /auth/login` `{ phone: '0912 345 678', password }` và `{ phone: '+84912345678', password }` ⇒ 200 `AuthTokensDto` với `AuthService` THẬT (bẫy 2); `findByPhone` nhận `'+84912345678'` cả hai lần.
3. `{ phone: 'abc', password }` ⇒ 400 `VALIDATION_ERROR`, `fieldErrors` có đúng phần tử `{ field: 'phone', code: 'isPhoneNumber' }`, KHÔNG gọi `findByPhone`; `{ phone: '', … }` / thiếu `phone` ⇒ 400 `fieldErrors[phone]` từ ValidationPipe.
4. `{ phone, password, email: 'x@y.z' }` ⇒ 400, `fieldErrors` có `field: 'email'`, code `isAbsent`, KHÔNG gọi service (đo bằng `toHaveBeenCalledTimes(0)`). Cùng luật ở forgot/reset. `email: null` cũng 400.
5. SĐT không tồn tại / account `phone: null` / `isActive: false` / sai mật khẩu ⇒ 401, `message === 'Thông tin đăng nhập không đúng'` — một assert so sánh 4 envelope (bỏ `traceId`) bằng nhau. Nhánh vắng account vẫn gọi `passwords.verify` (dummy hash) — giữ ca timing có sẵn.
6. `forgot-password` số tồn tại vs số lạ (định dạng hợp lệ) ⇒ cùng status 200 + cùng body; số sai định dạng ⇒ 400 `fieldErrors.phone`. `reset-password` mọi nhánh sai ⇒ một 401 `RESET_FAILED_MESSAGE`. `PasswordResetRequested` vẫn publish đúng một lần khi phát mã (kênh gửi không đổi).
7. `GET /me` trả `phone` (E.164 hoặc `null`) cạnh `email`; e2e `me.e2e.spec.ts` assert key-set gồm `phone`.
8. `openapi.json`: `LoginRequestDto`/`ForgotPasswordRequestDto`/`ResetPasswordRequestDto` có `phone` (required), **không** có `email`; `MeResponseDto.phone` `nullable: true`, `type: string`. 3 drift-guard xanh (backend `openapi-drift.spec.ts`, web `npm test`, mobile `generated_client_drift_test.dart`). `grep -n email` trong 3 DTO request sinh (web `schema.d.ts` khối tương ứng, Dart `login_request_dto.dart`, `forgot_password_request_dto.dart`, `reset_password_request_dto.dart`) rỗng.
9. Seed: thiếu `SEED_ADMIN_PHONE` khi có EMAIL+PASSWORD ⇒ ném; SĐT rác ⇒ ném; đủ ba ⇒ account có `phone` E.164; vắng cả ba ⇒ bỏ qua (nguồn khách vẫn seed). Không file nào đọc `backend/.env` ngoài `dotenv` sẵn có.
10. Lane DB: hai `account.create` cùng `phone` ⇒ Prisma `P2002` (unique); hai account `phone: null` ⇒ tạo được cả hai.
11. Web: `LoginScreen` có `type="tel"` + `autoComplete="tel"` + nhãn `Số điện thoại`; không còn `type="email"`/regex email; gửi `'0912 345 678'` nguyên văn (đã trim hai đầu) tới port — vitest assert đối số port; 400 `fieldErrors.phone` ⇒ message nằm NGAY SAU ô SĐT (DOM order), Banner trên form không lặp. Tương tự `ForgotPasswordScreen`; câu bước 2 không chứa chuỗi SĐT đã gõ.
12. Mobile: `keyboardType: TextInputType.phone`; widget test: gõ `'0912 345 678'` ⇒ `FakeAuthPort`/port ghi nhận đúng chuỗi đó; `ApiError` 400 có `fieldErrors[phone]` ⇒ text lỗi hiện dưới ô; `grep -rn maskEmail mobile/lib web/src` rỗng; câu bước 2 không chứa số đã gõ.
13. Guard design-system cập nhật (nhãn mới byte-identical web↔mobile, chữ ký port `phone`, field `/me` gồm `phone`) — và **mutation**: đổi nhãn một phía ⇒ guard ĐỎ; đổi `phone` → `email` trong một port ⇒ `parity.test.mjs` ĐỎ.
14. Smoke thật: web (vite + backend `start:prod`) đăng nhập bằng `0912 345 678`-dạng của account smoke ⇒ vào app; emulator (APK debug, `API_BASE_URL=http://10.0.2.2:3000`) đăng nhập bằng dạng `+84…` ⇒ vào app; thử số rác ⇒ thấy lỗi dưới ô. Không chạy được ⇒ ghi rõ chưa chạy + lý do, không giả kết quả.
15. 5 lane xanh: backend `npm test` + `npm run test:db`, design-system `npm test`, web `npm run typecheck && npm test && npm run build`, mobile `flutter analyze` + `flutter test` — số test ≥ baseline đo trước khi sửa (không xoá ca, đổi fixture). Lint backend: không thêm lỗi mới so với baseline (memory `backend-lint-red-at-baseline` — đo bằng stash).

## Tasks / Subtasks

- [x] **T0 — Baseline** (AC 15): ghi số test 5 lane + số lỗi `npm run lint` backend trước khi sửa; Docker/`pns-postgres` sẵn cho lane DB (chưa chạy ⇒ nhờ Đại Ca bật Docker Desktop — memory `db-lane-needs-docker-desktop-gui`).
- [x] **T1 — DB** (AC 1, 10): `schema.prisma` `phone String? @unique` (comment: E.164, nullable vì account cũ; định danh đăng nhập từ 10.9; email giữ làm liên hệ); migration `20261022230000_add_account_phone/migration.sql`; `npx prisma generate`; ca DB mới `test/account-phone.db.integration.spec.ts` (trùng ⇒ P2002; hai NULL ⇒ OK; dọn dữ liệu của chính nó).
- [x] **T2 — Backend auth** (AC 2–7): `auth/account-phone.ts` (D3); `AccountsService.findByPhone` (D4); DTO (D5, bẫy 1); `AuthService.login(phone, …)`, `PasswordResetService.requestCode(phone)` / `reset(phone, …)` (D3/D6, bẫy 3); controller truyền `body.phone` + sửa mô tả `@ApiOkResponse` "email" → "SĐT"; `AuthenticatedAccount.phone` + `JwtAuthGuard` + `MeResponseDto.phone` (D7).
  - [x] Fixture: sau `prisma generate`, kiểu `Account` có `phone: string | null` ⇒ mọi fixture khai kiểu `Account` trong ~20 spec có `email:` (`auth-decorators`, `contracts.e2e`, `invoices.e2e`, `orders.e2e`, `payments.e2e`, …) có thể đỏ tsc ⇒ thêm `phone: null`, không đổi hành vi ca. `error-envelope.spec.ts` dùng DTO riêng — không đụng.
  - [x] Unit: `auth.service.spec.ts`, `password-reset.service.spec.ts`, `change-password.spec.ts` (mock `findByEmail` → `findByPhone`), `jwt-auth.guard.spec.ts` (gắn `phone`), ca `accountPhoneOrThrow` (rác/rỗng/`84…`/`+84…`/cố định).
  - [x] e2e: `auth.e2e.spec.ts` ca DTO (phone thiếu/rỗng, email-trong-body, email null) + **describe mới với `AuthService` thật** (bẫy 2): 2 dạng số ⇒ 200; rác ⇒ 400 không gọi `findByPhone`; 4 nhánh 401 envelope bằng nhau. `password-reset.e2e.spec.ts`: field `email` → `phone`, ca số rác 400, ca email-trong-body 400, ca neutral body với `PasswordResetService` thật (hoặc unit tương đương đã có — giữ ít nhất một ca chạy service thật). `me.e2e.spec.ts`: `phone` trong shape.
- [x] **T3 — Seed + docs backend** (AC 9): `prisma/seed.ts` (D8) + test nếu seed có test (không có ⇒ chạy tay `npx prisma db seed` với biến trên lệnh trên DB local, ghi kết quả); `.env.example`; `backend/README.md`; `backend/CONVENTIONS.md` (các dòng nêu ở §6).
- [x] **T4 — Regen** (AC 8): `npm run openapi:gen` → web `npm run api:gen` → mobile `dart run tool/generate_api.dart`; kiểm `email` vắng khỏi 3 DTO request sinh.
- [x] **T5 — Web** (AC 11): `auth-port.ts`, `password-port.ts` (+ comment "email" → "phone"), `http-{auth,password}-port.ts`, fake auth/password/me ports, `LoginScreen.tsx` (D9; sửa comment đầu file "Sign-in is by email only — accounts carry no phone"), `ForgotPasswordScreen.tsx` (D10). Test: `login-screen.test.tsx` (gửi thô, lỗi dưới ô, rỗng), `http-auth-port.test.ts`, `http-password-port.test.ts` (body `{ phone }`), `screens-render.test.tsx`/`app-entry.test.tsx`/`app-routes.test.tsx`/`transport.test.ts`/`http-me-port.test.ts` đổi fixture; ca ForgotPassword (lỗi dưới ô + câu bước 2 không chứa số).
- [x] **T6 — Mobile** (AC 12): `auth_port.dart`, `password_port.dart`, `fake_{auth,password,me}_port.dart`, `api/http_{auth,password}_port.dart`, `login_screen.dart`, `forgot_password_screen.dart` (D11); test `login_screen_test.dart`, `forgot_password_screen_test.dart`, `http_{auth,password,me}_port_test.dart`, `api_error_test.dart`, `http_stack_loopback_test.dart`, `session_test.dart`, `shell_behavior_test.dart`, `pns_app_test.dart`, `signed_in_app_test.dart`, `menu_screen_test.dart`, `profile_screen_test.dart`, `support/app_harness.dart` — đổi fixture, không xoá ca. `dart format` CHỈ file mình sửa, kiểm `-o none` (memory `dart-format-writes-files-cascade`).
- [x] **T7 — Guard design-system** (AC 13): `screens/login.test.mjs` (nhãn + câu validate mới; assert không còn `type="email"`, có `type="tel"`/`autoComplete="tel"` web và `TextInputType.phone` mobile), `screens/forgot-password.test.mjs` (nhãn mới; thay `'Đã gửi mã 6 số đến '`/`'Email không hợp lệ.'`; thêm assert `maskEmail` vắng cả hai; mở rộng regex cấm lộ tồn tại: thêm `số điện thoại không tồn tại|chưa đăng ký`), `session/parity.test.mjs:77-78,84-85` (chữ ký `phone`), `session/session.test.mjs:44` (thêm `phone`). Mutation từng guard sửa (cp backup, KHÔNG `git checkout`).
- [x] **T8 — Smoke** (AC 14): như "Smoke đầu-cuối" dưới đây.
- [x] **T9 — Docs & trạng thái**: `project-context.md` §Testing/§Critical — một dòng "đăng nhập bằng SĐT (10.9): định danh `phone` E.164 qua `normalizeVnPhone`, `email` trong body auth ⇒ 400 (`@IsAbsent` + `@ApiHideProperty`), `/me` có `phone`"; `epics.md` Story 8.3 thêm một gạch đầu dòng "form account BẮT BUỘC SĐT (chuẩn hoá `normalizeVnPhone`, unique)" theo lời dặn AC ngoài phạm vi; story → review; sprint-status.

## Dev Notes

### Smoke đầu-cuối (khuôn 10.5/10.8) — bắt buộc trước khi chuyển review

- KHÔNG đọc/sửa `backend/.env`. Backend chạy `npm run start:prod` với `JWT_ACCESS_SECRET` ngẫu nhiên ≥32 ký tự + `DATABASE_URL` Postgres local 5433 trên lệnh (memory `scout-block-hook-dist-build-words`: không gõ `node dist/main`).
- `npx prisma migrate deploy` trên `pns-postgres` TRƯỚC (migration mới). Lane `test:db` xoá sạch dữ liệu ⇒ seed account smoke bằng SQL sau khi chạy lane (memory `smoke-headless-share-and-db-lane-wipe`): `smoke-10-9@local.test`, `phone` E.164 (vd `+84900000109`), mật khẩu ngẫu nhiên băm argon2id như backend; xoá account + phiên khi xong (`audit_logs` append-only để lại).
- Web: `cd web && npm run dev` (proxy `/api`), Playwright/MCP browser: đăng nhập bằng `0900 000 109` ⇒ vào app; số `abc` ⇒ lỗi dưới ô; Quên mật khẩu với số lạ ⇒ bước 2 câu trung tính.
- Mobile: AVD cold boot `-no-snapshot` (memory `emulator-snapshot-boot-hangs-adb-install`), APK debug `--dart-define=API_BASE_URL=http://10.0.2.2:3000` (hook chặn chữ "build" trong Bash ⇒ viết script bằng Write tool), đăng nhập bằng `+84900000109` ⇒ vào app; bàn phím hiện là bàn phím số điện thoại (`uiautomator dump`/`screencap`).
- `curl`: `POST /auth/login` với `email` thừa ⇒ 400 thật qua pipe thật.

### Quyết định đã chốt — không bàn lại

- Chỉ SĐT, bỏ email làm định danh (Đại Ca 2026-10-22). AD-9: chuẩn hoá chỉ ở backend, client gửi thô. AD-5: lỗi qua `AppException`, filter dựng envelope. AD-12: client sinh, không sửa tay; một composition root mỗi client (story này không đụng `main.tsx`/`main.dart` — port interface đổi field, adapter đổi body).
- Luật ngôn ngữ: code/comment/tên test tiếng Anh (code MỚI và đoạn đang sửa); chuỗi UI + message lỗi trả client tiếng Việt. Tên test cũ tiếng Việt trong file đang sửa: không đổi hàng loạt; ca MỚI viết tiếng Anh.

### Hiện trạng phải giữ

- Chống enumeration: dummy hash ở cả `login` lẫn `requestCode`/`reset`; cùng message/status mọi nhánh; `forgot-password` body giống hệt. Cổng atomic rotate/attempt/single-use không đụng.
- `ChangePasswordController` + `change-password.spec.ts` hành vi không đổi (chỉ mock).
- `ProfileScreen`/`menu_screen` vẫn hiện `email` (guard `profile.test.mjs:109`).
- `AuthPort.restoreSession/logout`, transport refresh single-flight, session generation — không đụng.
- `openapi-no-untyped-object` allowlist RỖNG; `no-vietnamese-api-contract` (field `phone` tiếng Anh — ổn).

### Tình huống biên đã tính

- `'84912345678'` (không `+`) ⇒ `normalizeVnPhone` thêm `+` ⇒ khớp. Số cố định `028 3822 1234` hợp lệ về định dạng ⇒ tra ⇒ không có account ⇒ 401 (không 400).
- Số nước ngoài `+1 202…` ⇒ `null` ⇒ 400 (account VN-only).
- `phone` là mảng/object ⇒ `@IsString` chặn 400 trước khi tới `normalizeVnPhone`.
- Chuỗi 10 KB ⇒ `@MaxLength(32)` chặn.
- Hai tab đăng nhập đồng thời cùng số ⇒ hai phiên — hành vi cũ, không đổi.
- Admin seed lại với SĐT khác ⇒ `upsert where email` cập nhật `phone`; SĐT trùng account khác ⇒ P2002 ⇒ seed ném (đúng — không đè danh tính người khác).
- Account bị vô hiệu hoá có SĐT ⇒ 401 cùng message.
- Client cũ (bản app trước 10.9) gửi `{ email, password }` ⇒ 400 có `fieldErrors` `phone` + `email` — chấp nhận, app nội bộ cập nhật đồng loạt.

### Kiểm thử — luật dự án áp dụng trực tiếp

- AC về mã HTTP chỉ đo ở e2e qua ValidationPipe thật (memory `dev-pins-ac-deviation-as-green-test`); không ghim lệch AC thành test xanh.
- Unique chỉ chứng minh ở lane DB; `describe.skip` không tách lane (memory `describe-skip-does-not-separate-test-lane`) — file `.db.integration.spec.ts`.
- Đếm lời gọi bằng `toHaveBeenCalledTimes` (memory `publish-count-unasserted-duplicate-survives`).
- Mutation bắt buộc cho: (a) gỡ `@IsAbsent` ⇒ ca email-trong-body ĐỎ; (b) gỡ `@ApiHideProperty` ⇒ drift/grep ĐỎ; (c) bỏ `accountPhoneOrThrow` (tra chuỗi thô) ⇒ ca `0912 345 678` ĐỎ; (d) bỏ dummy-hash verify nhánh vắng ⇒ ca timing có sẵn ĐỎ; (e) nhãn một phía ⇒ guard design-system ĐỎ; (f) mobile gửi chuỗi đã bỏ khoảng trắng ⇒ widget test ĐỎ. Backup `cp`, KHÔNG `git checkout` (code chưa commit — memory `mutation-test-never-git-checkout`); mutant phải biên dịch (memory `mutation-must-compile-or-false-red`); vòng mutant qua hàm/array, in dòng tổng mỗi mutant (memory `zsh-command-var-no-word-split-mutation`).
- Mobile: widget test cho màn đổi hành vi (memory `mobile-screens-need-widget-tests`); `tester.pump(10ms)` vòng khi có Dio; DTO Dart null ≠ vắng.
- Web: Node 24 `localStorage` stub `memoryStorage()` (memory `node24-localstorage-shadows-jsdom`); `.tsx` có lỗi cú pháp lọt text-guard ⇒ typecheck là cổng (memory `web-tsx-syntax-error-passes-all-lanes`).
- Prisma 7: `prisma migrate diff --from-schema/--to-schema` (memory `prisma7-migrate-diff-flag-rename`).

### Previous Story Intelligence

- **10.8** (`859b894`): smoke emulator đầy đủ (AVD Pixel_9_Pro cold boot, `adb input` + `uiautomator dump`, seed SQL argon2id, dọn theo FK); `json_serializable` `toJson` ghi null mọi key ⇒ `sparse_bodies.dart` — lý do bẫy 1 chọn `@ApiHideProperty`; regen Dart ~16s, drift-guard chạy lại script; review M3/M4: test 401/lỗi phải rơi đúng lời gọi đang đo.
- **10.6** (`47761e7`): `HttpAuthPort` mobile + `pns_app_test.dart` (bàn phím che nút — `Scaffold` gốc giữ, memory `mobile-app-root-needs-scaffold-keyboard`); login widget test có sẵn.
- **10.3/10.4**: `HttpAuthPort`/`HttpPasswordPort` web + `login-screen.test.tsx`; `ApiError.fieldErrors` có sẵn.
- **2.3/2.8**: thiết kế chống enumeration + reset code (CONVENTIONS.md §Auth) — giữ nguyên, chỉ đổi định danh.
- **3.1/3.4**: `normalizeVnPhone` + `normalizeOrThrow` + `IsAbsent` — tái dùng, không viết bản thứ hai.

### Git intelligence

- HEAD `859b894` (10.8), `d2dc62f` (dọn backup 10.7), `78a2a2c` (thêm story 10.9 vào epics + sprint-status). Mỗi story MỘT commit `feat(story-10.9): …` tiếng Anh gồm story file + sprint-status + docs; `git add` đường dẫn cụ thể (không `-A`: `.githooks/`, 2 file `docs/*.xlsx`, `_bmad-output/story-automator/*` không thuộc story); `git check-ignore` file mới (memory `git-info-exclude-drops-all-gitignore-files`, `dot-gitignore-assets-swallows-backend-assets`). KHÔNG push.

### Latest tech notes (đo 2026-10-22)

- Không thêm/nâng dependency. `libphonenumber-js ^1.13.8` có sẵn ở backend. `@nestjs/swagger` `@ApiHideProperty()` loại property khỏi schema; `class-validator` vẫn chạy decorator trên property đó. Prisma 7.8: `String? @unique` ⇒ unique index cho phép nhiều NULL (Postgres mặc định `NULLS DISTINCT`). Flutter `TextInputType.phone` = bàn phím quay số (số + `*#+`). HTML `type="tel"` không ép định dạng — chỉ gợi bàn phím, đúng AD-9.

### Project Structure Notes

- Backend: file mới `src/auth/account-phone.ts`, `prisma/migrations/20261022230000_add_account_phone/`, `test/account-phone.db.integration.spec.ts` (+ unit `test/account-phone.spec.ts` nếu tách). Không tạo module mới. `auth/` → `customers/domain` + `customers/dto` là phụ thuộc một chiều vào hàm thuần/decorator (tiền lệ `orders/`).
- Web/mobile: chỉ sửa file có sẵn (port, adapter, fake, màn, test). Lệch có chủ đích web↔mobile: không có.

### Câu hỏi mở (không chặn dev — đã có mặc định)

1. **Account đang có (ngoài admin seed) sẽ KHÔNG đăng nhập được** sau khi deploy tới khi có SĐT — form account là Epic 8. Mặc định: chấp nhận (app chưa go-live; trước go-live Epic 8 đã có form). Nếu cần sớm hơn: Đại Ca gán SĐT bằng SQL tay — dev ghi câu SQL mẫu vào Completion Notes, không viết script.
2. Câu xác nhận bước 2 Quên mật khẩu đổi thành câu điều kiện "Nếu số điện thoại đã đăng ký, …" (D10). Muốn giữ dạng cũ có che số (`09•••678`) thì quyết — mặc định không, vì AC đòi "không lộ số có tồn tại".
3. `email` trong body forgot/reset cũng bị 400 (D5, rộng hơn AC một chút cho nhất quán). Muốn chỉ login thì bỏ 2 decorator.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 10 — Story 10.9 (dòng 744-753); Story 8.3]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md` AD-4, AD-5, AD-8, AD-9 (dòng 97-101), AD-12]
- [Source: `_bmad-output/project-context.md` §Testing, §Development Workflow (ngôn ngữ), §Critical Don't-Miss]
- [Source: `backend/CONVENTIONS.md:79,111,125,136-137,153,156`]
- [Source: `backend/src/auth/auth.service.ts` (`AUTH_FAILED_MESSAGE`, `login`, `dummyHash`), `password-reset.service.ts` (`RESET_FAILED_MESSAGE`, `requestCode`, `reset`), `auth.controller.ts`, `me.controller.ts`, `jwt-auth.guard.ts:82-86`, `current-account.decorator.ts:8-20`, `dto/{login-request,forgot-password-request,reset-password-request,me-response}.dto.ts`]
- [Source: `backend/src/accounts/accounts.service.ts:24-38`; `backend/src/customers/domain/phone.ts` (`normalizeVnPhone`); `backend/src/customers/customers.service.ts:60-85`; `backend/src/customers/dto/{is-absent.decorator,update-customer-request.dto,lookup-customer-query.dto}.ts`; `backend/src/common/validation/validation-pipe.factory.ts:16-28`]
- [Source: `backend/prisma/schema.prisma:31-56`, `backend/prisma/seed.ts:112-160`, `backend/.env.example:31-35`, `backend/README.md:34-43`]
- [Source: `backend/test/{auth.e2e,password-reset.e2e,me.e2e,auth.service,password-reset.service,change-password,jwt-auth.guard,phone,openapi-drift,openapi-no-untyped-object}.spec.ts`]
- [Source: `web/src/screens/auth/{LoginScreen,ForgotPasswordScreen}.tsx`, `web/src/design-system/session/{auth-port,password-port,fake-me-port}.ts`, `web/src/api/{http-auth-port,http-password-port,api-error}.ts`, `web/src/screens/customers/CustomerPickScreen.tsx:149,356-366`]
- [Source: `mobile/lib/screens/auth/{login_screen,forgot_password_screen}.dart`, `mobile/lib/design_system/session/{auth_port,password_port,fake_auth_port,fake_password_port,fake_me_port}.dart`, `mobile/lib/api/{http_auth_port,http_password_port,api_error}.dart`, `mobile/lib/screens/customers/customer_pick_screen.dart:170`, `mobile/tool/generate_api.dart`, `mobile/test/app/support/app_harness.dart:72`]
- [Source: `design-system/screens/{login,forgot-password,profile}.test.mjs`, `design-system/session/{parity,session}.test.mjs`]
- [Source: `_bmad-output/implementation-artifacts/10-8-mobile-adapter-don-kho-tien-chung-tu-va-nut-chi-tiet-don-theo-quyen.md` §Dev Notes, Review]

## Dev Agent Record

### Agent Model Used

claude-opus-5-5 (Claude Code, bmad-dev-story)

### Debug Log References

- Baseline (HEAD `859b894`, trước khi sửa): backend 2504, test:db 322, design-system 502, web 439 (typecheck OK), mobile 746 (analyze sạch), lint backend 52 lỗi / 7 cảnh báo. Lần đo test:db đầu đỏ 224 ca vì `prisma generate` chạy trước `migrate deploy` (client có cột `phone`, DB chưa có) — áp migration rồi đo lại: 322/322.
- Sau: backend 2536 (123 suite), test:db 325 (27 suite), design-system 504, web 446 + typecheck + `npm run build` OK, mobile 746 + analyze sạch, lint 52/7 (= baseline; 2 lỗi `no-unused-vars` của spec mới đã sửa).
- Web: một lần chạy song song cả 5 lane (CPU nặng) có 1 ca vitest đỏ không lặp lại; chạy riêng 2 lần liền 446/446. Ghi nhận là flaky do tải, không do story này — chưa xác định ca nào.
- Mobile: số ca = baseline (746) vì thay ca email bằng ca SĐT (bỏ 3 ca regex email ở login, 2 ở forgot; thêm ca bàn phím phone, lỗi dưới ô, gửi thô).
- Mutation (cp backup, script `mutate.py`, mỗi mutant in dòng tổng): 12/12 ĐỎ — (a) gỡ `@IsAbsent` ⇒ auth.e2e 2 đỏ; (b) `@ApiHideProperty`→`@ApiPropertyOptional` ⇒ openapi-drift đỏ; (c) login tra chuỗi thô ⇒ 5 đỏ; (c2) forgot tra chuỗi thô ⇒ 2 đỏ; (d) bỏ dummy-hash ⇒ ca timing đỏ; (e1) nhãn mobile lệch ⇒ login.test.mjs đỏ; (e2) web `AuthPort.login` về `email` ⇒ parity đỏ; (e3) câu bước 2 lộ "đã gửi" ⇒ 2 guard đỏ; (f) mobile bỏ khoảng trắng ⇒ widget đỏ; (f2) web bỏ khoảng trắng ⇒ vitest đỏ; (g) web lỗi phone lên banner trên ⇒ đỏ; (h) mobile forgot lỗi phone lên banner ⇒ đỏ. File đã khôi phục (grep dấu mutant = 0).

### Completion Notes List

- DB: `accounts.phone TEXT` nullable + unique `accounts_phone_key` (migration `20261022230000_add_account_phone`, SQL sinh bằng `prisma migrate diff --from-schema/--to-schema`). Lane DB mới chứng minh: trùng SĐT ⇒ P2002; hai NULL tạo được; `findByPhone` không trả account `phone` NULL.
- Backend: `accountPhoneOrThrow` (một cửa 400, câu chữ giống customers) gọi đầu `login`/`requestCode`/`reset`; `AccountsService.findByPhone(e164)` thay `findByEmail` (xoá `findByEmail` + `normalizeEmail` — hết caller). DTO 3 route auth: `phone` (`IsString/IsNotEmpty/MaxLength(32)`) + `email` ẩn (`@ApiHideProperty` + `@IsAbsent`) ⇒ `email` (kể cả `null`) ⇒ 400 `isAbsent`. `/me` + `AuthenticatedAccount` có `phone` (`type: String, nullable`). Message 401 không đổi.
- e2e mới `auth-phone.e2e.spec.ts` chạy `AuthService`/`PasswordResetService` THẬT (chỉ fake `AccountsService` bảng in-memory so khớp `phone` chặt + stub Prisma): `0912 345 678` và `+84912345678` ⇒ 200, `findByPhone('+84912345678')`; `abc` ⇒ 400 không tra; SĐT lạ/inactive/sai mật khẩu ⇒ envelope 401 bằng nhau; forgot số có/không ⇒ cùng body, `PasswordResetRequested` publish đúng 1 lần.
- Ca "account chưa có SĐT ⇒ 401": từ bên ngoài, account `phone` NULL không bao giờ tra ra được (khoá tra luôn là chuỗi E.164) — nên nó trùng nhánh "SĐT lạ"; bằng chứng thật nằm ở lane DB (`findByPhone` không trả account NULL), e2e assert account `acc-no-phone` không bao giờ được trả về.
- Seed: đọc `SEED_ADMIN_PHONE`, quy tắc "vắng cả ba ⇒ bỏ qua; thiếu một ⇒ ném; SĐT rác ⇒ ném". Seed không có test ⇒ chạy tay 4 ca trên DB local với biến trên dòng lệnh: bỏ qua ✓, thiếu SĐT ném ✓, `abc` ném ✓, đủ ba ⇒ `+84900000199` ✓ (đã xoá account thử). KHÔNG đọc/sửa `backend/.env`.
- ⚠️ **Máy Đại Ca cần thêm `SEED_ADMIN_PHONE=<số thật>` vào `backend/.env` trước lần `npx prisma db seed` tới** — thiếu ⇒ seed ném (đúng thiết kế).
- ⚠️ Account có sẵn (ngoài admin seed) chưa có SĐT ⇒ không đăng nhập được tới khi gán số (form account là Story 8.3). Gán tay nếu cần sớm: `UPDATE accounts SET phone = '+849xxxxxxxx' WHERE email = '…';` (số dạng E.164, unique).
- Web/mobile: ô "Số điện thoại" (`type="tel"`/`inputMode="tel"`/`autoComplete="tel"`; mobile `TextInputType.phone`), validate cục bộ chỉ rỗng, gửi chuỗi đã trim hai đầu; `fieldErrors.phone` hiện ngay dưới ô (không lặp ở banner trên). Quên mật khẩu: nhãn "Số điện thoại đã đăng ký", bỏ `maskEmail`/`EMAIL_RE`, câu bước 2 "Nếu số điện thoại đã đăng ký, mã 6 số sẽ được gửi tới số đó. Mã có hiệu lực 5 phút." Guard design-system cập nhật + thêm assert vắng `type="email"`/`maskEmail`/regex email, mở rộng regex chống lộ tồn tại.
- Regen 3 nơi; `email` vắng khỏi 3 DTO request sinh (openapi.json, `schema.d.ts`, Dart); `MeResponseDto.phone` `nullable: true`.
- Smoke thật: backend `start:prod` (secret ngẫu nhiên) + Postgres local, account smoke `+84900000109` băm argon2id. curl: `0900 000 109` và `+84900000109` ⇒ token; `email` thừa ⇒ 400 `isAbsent`; `abc` ⇒ 400 `fieldErrors.phone`; sai mật khẩu ⇒ 401; forgot số có/lạ ⇒ cùng `{"expiresInSeconds":300}`; `/me` có `phone`. Web (vite + Playwright): `abc` ⇒ lỗi ngay dưới ô SĐT; `0900 000 109` ⇒ vào app (Hồ sơ "Smoke 10.9"); Quên mật khẩu số lạ ⇒ câu trung tính. Emulator Pixel_9_Pro cold boot, APK debug `API_BASE_URL=http://10.0.2.2:3000`: bàn phím ô SĐT `inputType=0x3` (TYPE_CLASS_PHONE); `abc` ⇒ lỗi dưới ô; `+84900000109` ⇒ vào Menu "Smoke 10.9". Đã đăng xuất, xoá account smoke, bật lại verifier, tắt emulator/backend/vite.
- Câu hỏi mở 2/3 giữ mặc định của story (câu điều kiện ở bước 2; `email` bị 400 ở cả forgot/reset).

### File List

- backend/prisma/schema.prisma
- backend/prisma/migrations/20261022230000_add_account_phone/migration.sql (mới)
- backend/prisma/seed.ts
- backend/.env.example
- backend/README.md
- backend/CONVENTIONS.md
- backend/openapi/openapi.json (sinh)
- backend/src/accounts/accounts.service.ts
- backend/src/auth/account-phone.ts (mới)
- backend/src/auth/auth.controller.ts
- backend/src/auth/auth.service.ts
- backend/src/auth/password-reset.service.ts
- backend/src/auth/current-account.decorator.ts
- backend/src/auth/jwt-auth.guard.ts
- backend/src/auth/dto/login-request.dto.ts
- backend/src/auth/dto/forgot-password-request.dto.ts
- backend/src/auth/dto/reset-password-request.dto.ts
- backend/src/auth/dto/me-response.dto.ts
- backend/test/account-phone.spec.ts (mới)
- backend/test/account-phone.db.integration.spec.ts (mới)
- backend/test/auth-phone.e2e.spec.ts (mới)
- backend/test/auth.e2e.spec.ts
- backend/test/auth.service.spec.ts
- backend/test/auth-decorators.spec.ts
- backend/test/change-password.spec.ts
- backend/test/jwt-auth.guard.spec.ts
- backend/test/me.e2e.spec.ts
- backend/test/password-reset.e2e.spec.ts
- backend/test/password-reset.service.spec.ts
- backend/test/openapi-drift.spec.ts (QA: phone required / email ẩn trong 3 DTO, `MeResponseDto.phone` nullable)
- backend/src/auth/dto/forgot-password-response.dto.ts (review: comment)
- backend/src/catalog/products.controller.ts (review: comment `@CurrentAccount()`)
- web/src/api/generated/schema.d.ts (sinh)
- web/src/api/http-auth-port.ts
- web/src/api/http-password-port.ts
- web/src/design-system/session/auth-port.ts
- web/src/design-system/session/password-port.ts
- web/src/design-system/session/fake-me-port.ts
- web/src/design-system/session/fake-password-port.ts
- web/src/screens/auth/LoginScreen.tsx
- web/src/screens/auth/ForgotPasswordScreen.tsx
- web/src/test/forgot-password-screen.test.tsx (mới)
- web/src/test/login-screen.test.tsx
- web/src/test/app-entry.test.tsx
- web/src/test/app-routes.test.tsx
- web/src/test/customer-screens.test.tsx
- web/src/test/http-auth-port.test.ts
- web/src/test/http-me-port.test.ts
- web/src/test/http-password-port.test.ts
- web/src/test/screens-render.test.tsx
- web/src/test/transport.test.ts
- mobile/lib/api/generated/models/{login_request,forgot_password_request,reset_password_request,me_response}_dto.dart + `.g.dart` (sinh)
- mobile/lib/api/http_auth_port.dart
- mobile/lib/api/http_password_port.dart
- mobile/lib/design_system/session/auth_port.dart
- mobile/lib/design_system/session/password_port.dart
- mobile/lib/design_system/session/me_port.dart (review: comment `/me` có `phone`)
- mobile/lib/design_system/session/fake_auth_port.dart
- mobile/lib/design_system/session/fake_password_port.dart
- mobile/lib/design_system/session/fake_me_port.dart
- mobile/lib/screens/auth/login_screen.dart
- mobile/lib/screens/auth/forgot_password_screen.dart
- mobile/test/screens/auth/login_screen_test.dart
- mobile/test/screens/auth/forgot_password_screen_test.dart
- mobile/test/api/http_auth_port_test.dart
- mobile/test/api/http_password_port_test.dart
- mobile/test/api/http_stack_loopback_test.dart
- mobile/test/app/pns_app_test.dart
- mobile/test/app/signed_in_app_test.dart
- mobile/test/app/support/app_harness.dart
- mobile/test/design_system/session_test.dart
- mobile/test/screens/account/profile_screen_test.dart
- mobile/test/screens/menu/menu_screen_test.dart
- design-system/screens/login.test.mjs
- design-system/screens/forgot-password.test.mjs
- design-system/session/parity.test.mjs
- design-system/session/session.test.mjs
- _bmad-output/project-context.md
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/10-9-dang-nhap-bang-so-dien-thoai.md

### Senior Developer Review (AI)

_Reviewer: Đại Ca (AI, bmad-story-automator-review + /ck:code-review) — 2026-10-23_

**Kết quả: Approve sau khi sửa** — 0 CRITICAL, 0 HIGH; 3 MEDIUM, 9 LOW. Tất cả AC 1–15 có bằng chứng (code + test + smoke dev đã ghi). Luật (1) scope ghi đơn và (2) khoá FOR UPDATE tồn kho: story KHÔNG chạm đường ghi đơn hay tồn kho ⇒ không áp dụng (không có guard phạm vi/khoá để bẻ).

Đã sửa:
- [MEDIUM] Guard parity `forgot-password.test.mjs` mù: placeholder `'Nhập số điện thoại đã đăng ký'` là tiền tố của câu validate ⇒ đổi placeholder một phía vẫn xanh (AC-13 gãy). Thêm test so khớp NGUYÊN literal `label="…"`/`placeholder="…"` (web) ↔ `label: '…'`/`placeholder: '…'` (mobile) ở cả `forgot-password.test.mjs` và `login.test.mjs`.
- [MEDIUM] Mobile không có test nào đo SĐT gửi ở bước đặt lại (`_RecordingPasswordPort.resetPassword` bỏ qua đối số) ⇒ thêm widget test "step 2 resets with the same raw phone typed in step 1" (ghi `(phone, code, newPassword)`).
- [MEDIUM] Luật (11): `epics.md` Story 10.9 chưa ghi quyết định giữa story (email ⇒ 400 ở cả 3 route, 400 phone trước khi tra, câu bước 2, client chỉ validate rỗng, luật seed) ⇒ đã thêm gạch "Quyết định chốt khi làm story".
- [LOW] Seed: `SEED_ADMIN_PHONE` trùng account khác ⇒ trước ném P2002 thô; giờ ném câu rõ ràng (try/catch, chạy thật trên Postgres local: ✓, account thử đã xoá).
- [LOW] Comment/doc cũ còn nói email: `products.controller.ts:50`, `forgot-password-response.dto.ts`, `password-port.ts`/`password_port.dart` (đầu file), `me_port.dart`; `CONVENTIONS.md:79` ví dụ message tiếng Anh ⇒ `'Không được để trống.'` (đúng bản dịch thật).
- [LOW] Tên test lỗi thời/tiếng Việt do story viết lại ⇒ tiếng Anh theo SĐT (`auth.service.spec.ts` ×3, `password-reset.service.spec.ts` ×4, `password-reset.e2e.spec.ts` ×2, `auth.e2e.spec.ts` ×1 + câu tiếng Anh chèn giữa dòng tiếng Việt ở header).
- [LOW] `login.test.mjs` (a.2): kiểm vắng regex email phía mobile không có neo dương ⇒ thêm assert mobile có câu validate rỗng (chống guard-rỗng, luật 5).
- [LOW] `login_screen.dart` header comment dòng quá dài ⇒ ngắt dòng.

Không đổi (có lý do):
- [MEDIUM — cần Đại Ca quyết] Không có rate-limit trên `/auth/login|forgot-password|reset-password`. Có sẵn từ Story 2.8 (CONVENTIONS.md §Auth "Không có rate-limit IP") — story không làm xấu đi về cơ chế, nhưng SĐT dễ đoán/công khai hơn email ⇒ dò mật khẩu theo số rẻ hơn. Ngoài AC; đề xuất thêm vào backlog trước go-live.
- [LOW] `normalizeVnPhone('0912345678abc')` ⇒ `+84912345678` (libphonenumber trích số khỏi chuỗi có rác) ⇒ seed với SĐT dính rác cuối không ném. Hành vi của helper AD-9 dùng chung với khách hàng; sửa helper đụng Epic 3 ⇒ để follow-up riêng, không sửa trong 10.9.
- [LOW] AC-5 so 3 envelope thay vì 4: account `phone` NULL không thể tra ra từ bên ngoài (khoá tra luôn E.164, `findUnique`) — bằng chứng nằm ở lane DB; giữ như Completion Notes đã giải thích.
- [LOW] Lỗi dưới ô SĐT không `role="alert"` — cùng khuôn `CustomerPickScreen` hiện có; đổi a11y nên làm đồng loạt, không riêng màn này.

Mutation (cp backup, không git checkout; 5/5 ĐỎ, file đã khôi phục): placeholder mobile quên mật khẩu lệch ⇒ guard mới đỏ (guard cũ xanh); placeholder login `'… di động'` ⇒ đỏ; mobile reset gửi SĐT chưa trim ⇒ widget đỏ; gỡ `@IsAbsent` login ⇒ `auth.e2e` 2 đỏ; login tra chuỗi thô ⇒ `auth-phone.e2e` 7 đỏ.

Lane sau review: backend `npm test` 2547/2547, `test:db` 325/325, lint 52 lỗi/7 cảnh báo (= baseline), design-system 506/506, web typecheck + 447/447 + build OK, mobile analyze sạch + 747/747.

### Change Log

- 2026-10-22: Story 10.9 — đăng nhập bằng SĐT thay email: cột `accounts.phone` (E.164, unique, nullable), `/auth/login|forgot-password|reset-password` nhận `phone` THÔ (chuẩn hoá `normalizeVnPhone`, 400 `fieldErrors.phone`), `email` trong body ⇒ 400, `/me` thêm `phone`, seed đòi `SEED_ADMIN_PHONE`, regen OpenAPI + client web/Dart, màn Đăng nhập/Quên mật khẩu web + mobile dùng ô SĐT, guard design-system cập nhật; status → review.
- 2026-10-23: Code review (AI) — sửa 3 MEDIUM + 8 LOW (guard parity literal, widget test bước đặt lại mobile, epics.md quyết định giữa story, seed báo trùng SĐT, comment/tên test); rate-limit auth ghi lại chờ quyết định; status → done.
