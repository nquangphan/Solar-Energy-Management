# Backend Conventions — Phương Nam Solar

Hợp đồng đặt tên & quy ước cho **mọi** story backend. Nguồn: `ARCHITECTURE-SPINE.md#Consistency Conventions` + `project-context.md#Coding style`. Khi mâu thuẫn: **spine thắng**.

## Đặt tên (AC-3)

| Concern | Quy ước | Ví dụ |
|---|---|---|
| Entity (Prisma model) | **PascalCase** | `Order`, `OrderLineItem`, `Account` |
| Bảng DB | **snake_case số nhiều** (qua `@@map`) | `orders`, `order_line_items`, `accounts` |
| File | **kebab-case** | `prisma.service.ts`, `allowed-transition.ts` |
| REST route | **danh từ số nhiều, kebab-case** | `/orders`, `/orders/{id}/line-items`, `/stock-vouchers` |
| Action nghiệp vụ | **POST sub-resource** (không phải verb ở path) | `POST /orders/{id}/stock-issue`, `POST /stock-vouchers/{id}/return` |
| Ngôn ngữ contract | Route, field DTO/OpenAPI, mã `fieldErrors` **mới** viết **tiếng Anh** (Đại Ca chốt 2026-10-21, xem `project-context.md`). Route, tham số và operationId đã tiếng Anh từ Story 10.1 (guard `no-vietnamese-api-contract.spec.ts`); field DTO tiếng Việt cũ đổi ở Story 10.2; enum value nghiệp vụ giữ nguyên | `lines.{i}.qty`, không `dong.{i}.qty` |
| ID | **UUID v4** mọi entity — **trừ** `Customer` (PK = SĐT chuẩn hoá **E.164**, chỉ chuẩn hoá ở backend `customers`, AD-9) | `id: uuid` |
| Tiền | **integer đồng** — KHÔNG float/decimal (AD-10) | `unitPriceSnapshot: int` |
| Ngày giờ | **ISO-8601 UTC** lưu DB; client hiển thị UTC+7 | `2026-07-08T09:00:00.000Z` |

> `GET /health` là ngoại lệ có chủ ý: endpoint **hạ tầng**, không phải resource nghiệp vụ → không áp quy ước danh từ số nhiều.

## Prisma `@@map` / `@map` (khi thêm model ở story sau)

Entity Prisma PascalCase → map sang bảng snake_case số nhiều. Skeleton (2.1) cố ý **chưa** khai model nào; mỗi story sở hữu entity của nó (`Account`+`Session` = 2.3 · `AccountPermission` = 2.4 · `AuditLog` = 2.7 · `PasswordResetCode` = 2.8 · `Order` = E4…). Mẫu:

```prisma
model Account {
  id    String @id @default(uuid())
  // ...
  @@map("accounts")
}

model OrderLineItem {
  id             String @id @default(uuid())
  unitPriceSnapshot Int  @map("unit_price_snapshot")
  // ...
  @@map("order_line_items")
}
```

## OpenAPI — SINH TỪ CODE, CẤM SỬA TAY (AD-12)

- `openapi/openapi.json` là **artifact SINH TỰ ĐỘNG** từ code NestJS (controller + DTO là **chân lý**). Đây là **hợp đồng cross-repo DUY NHẤT**: cả web lẫn mobile gen/validate client từ file này.
- **CẤM sửa tay** spec. Đổi contract = sửa DTO/controller rồi chạy:

  ```bash
  npm run openapi:gen
  ```

- **Drift-guard**: test regen in-memory rồi so **byte-for-byte** với file đã commit. Quên regen hoặc sửa tay → test fail (mirror drift-guard byte-for-byte của design-system Epic 1).
- Version của spec = version backend (`package.json`) → spec versioned.

## Permission registry — SSOT + generated artifact (AD-17)

Quyền dùng CHUNG cho ba bên (FE gating, BE guard, noti resolver) — **một** nguồn, không literal rải rác.

- **Nguồn chân lý DUY NHẤT:** `src/accounts/domain/permission-registry.ts` (chủ sở hữu `accounts/domain`). Đây là **NƠI DUY NHẤT** được chứa permission string literal; mọi nơi khác `import { PERM }` (định danh). **Source-guard** `no-permission-literal-outside-registry.spec.ts` quét `src/` (bỏ comment, giữ string) → fail nếu literal quyền lọt ra file khác.
- **Naming key:** `domain.action` **snake_case** (vd `orders.view_all`, `payments.record`). 4 key giữ **nguyên văn** literal FE stub Story 1.10 (`orders.view_all`/`orders.view_own`/`audit.read`/`permissions.manage`) để Story 2.6 đổi *nguồn*, không đổi *chuỗi*. "Xem tất cả đơn" (`orders.view_all`) và "đơn của mình" (`orders.view_own`) là **hai entry tường minh** (AC-2).
- **Lưu quyền per-account:** bảng `account_permissions` (`account_id × permission`), `permission` kiểu **String** validate theo registry ở tầng app (`AccountPermissionsService.setForAccount` ném `VALIDATION_ERROR` nếu key ngoài registry) — KHÔNG Postgres-enum (registry evolve không cần migration enum). Nguồn chân lý RBAC = bộ quyền trên từng Account (AD-8).
- **Preset = hằng số code** (`domain/role-presets.ts`, Role → key[]): **nạp giá trị lúc tạo/seed, KHÔNG ràng buộc sau** (AD-8) — Phase 1 không bảng `Role` DB. **CHỈ `SUPER_ADMIN`** chứa `audit.read` (AC-3, chỉ một account Super Admin chỉ định qua seed).
- **Artifact SINH TỰ ĐỘNG — CẤM SỬA TAY:** `openapi/permissions.json` sinh từ registry. Đổi bộ quyền = sửa `permission-registry.ts` rồi:

  ```bash
  npm run permissions:gen
  ```

- **Drift-guard** `permissions-drift.spec.ts`: regen in-memory so **byte-for-byte** với file committed (mirror OpenAPI drift-guard). FE (Story 2.6) gen key từ artifact này.
- **Key quyền FE sinh từ `permissions.json` (Story 2.6):** generator zero-dep `design-system/permissions/build-permission-keys.mjs` derive web `web/src/design-system/gating/permission-keys.generated.ts` + mobile `mobile/lib/design_system/gating/app_permission_keys.g.dart` — **CẤM SỬA TAY**, regen bằng `cd design-system && npm run build:permissions`. Drift-guard `design-system/permissions/permission-keys.test.mjs`: generated byte-for-byte + mọi `PERM`/`AppPerm`/`SIDEBAR_NAV.requires` ∈ registry ⇒ drift FE↔BE không thể tái diễn (đóng action item Epic 1). Gating chỉ UX (AD-4); guard server-side mỗi request là ranh giới thật (Story 2.5).

## Error envelope — MỘT shape, MỘT nơi dựng (AD-5)

Mọi lỗi backend trả về **đúng một** shape (`ErrorEnvelopeDto`):

```jsonc
{
  "code": "VALIDATION_ERROR",        // string enum có tài liệu (ErrorCode); FE map theo MÃ, không theo message
  "message": "Dữ liệu không hợp lệ", // người đọc được, có thể đổi/đa ngôn ngữ
  "fieldErrors": [                    // CHỈ có ở lỗi validation; vắng mặt với lỗi khác
    { "field": "email", "code": "isEmail", "message": "email phải hợp lệ" }
  ],
  "traceId": "3f2b0c9e-…"            // UUID v4 hoặc x-request-id — tra log server-side
}
```

**Luật (không vi phạm):**

- **CHỈ `common/errors/all-exceptions.filter.ts` (`@Catch()` global) được dựng envelope.** Không controller/service nào tự nặn — `no-controller-error-envelope.spec.ts` enforce (fail nếu controller/service nhắc `traceId`).
- Code nghiệp vụ **ném lỗi**, không dựng envelope: `throw new AppException(ErrorCode.X, status, message[, fieldErrors])`, hoặc `HttpException` chuẩn của Nest (`NotFoundException`…). Filter dịch sang envelope + gắn `traceId`.
- ValidationPipe (`APP_PIPE` trong `CommonModule`) đóng gói lỗi class-validator thành `AppException(VALIDATION_ERROR)` mang `fieldErrors`; filter dựng envelope.
- Lỗi **không lường trước** → `INTERNAL` + 500 + message generic ("Lỗi hệ thống"); **KHÔNG leak** stack/chi tiết ra response, **log đầy đủ server-side** kèm `traceId`. `HttpException` **5xx** (vd `ServiceUnavailableException`) cũng được đối xử như lỗi server-side: giữ status, message generic, log đầy đủ — chỉ **4xx** mới phản chiếu message do dev soạn.
- `fieldErrors` **chỉ** đảm bảo có ở lỗi validation DTO (class-validator). Một số lỗi `400` khác (vd body JSON hỏng → `BadRequestException` của body-parser) cũng mang `code: VALIDATION_ERROR` nhưng **không** kèm `fieldErrors` — FE không được giả định `VALIDATION_ERROR` luôn có `fieldErrors`.

**Mã lỗi khởi đầu (`common/errors/error-code.ts`, tối giản YAGNI):** `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL` (500). **Mã lỗi domain** (pricing/VAT, transition, permission, tồn kho, trùng SĐT…) do **story sở hữu** tự khai theo cùng pattern `as const`, tái dùng `ErrorEnvelopeDto`. **KHÔNG** đổi/xoá mã đã publish mà không cân nhắc breaking FE.

`ErrorEnvelopeDto` + `FieldErrorDto` được ép vào `components.schemas` của OpenAPI (`extraModels`) để FE gen type ngay (AC-3), dù chưa endpoint nào tham chiếu.

## Auth — JWT access (stateless) + refresh opaque (revocable) (AD-12)

Đăng nhập (Story 2.3) phát **hai** token với vai trò khác nhau:

```jsonc
// POST /auth/login (creds đúng) & POST /auth/refresh → 200
{ "accessToken": "<JWT>", "refreshToken": "<opaque>", "expiresIn": 900 }
```

**Luật (không vi phạm):**

- **Access token = JWT** ký bằng `JWT_ACCESS_SECRET`, TTL ngắn (mặc định 15m), **stateless**. Payload tối thiểu `{ sub: accountId }` — KHÔNG nhét permission (Story 2.5 resolve quyền qua `/me`). Guard verify access-token thuộc **Story 2.5**; 2.3 chỉ **ký/phát**.
- **Refresh token = opaque random** (không phải JWT), lưu **HASH SHA-256 tất định** ở `sessions.refreshTokenHash` (KHÔNG lưu token thô) để **tra + thu hồi được** (AD-12). Dùng SHA-256 (không argon2) vì token entropy cao cần tra theo hash; argon2id chỉ dành cho **mật khẩu** (`PasswordService`).
- **Rotate** khi refresh: thu hồi phiên cũ (`revokedAt = now`) + phát phiên mới → refresh token cũ dùng lại không được. **Logout** = set `revokedAt` (idempotent, trung tính — không tiết lộ token có tồn tại).
- **Login sai = `UNAUTHENTICATED` (401) + message generic GIỐNG HỆT** cho mọi nhánh (email lạ / account inactive / sai mật khẩu) → chống user-enumeration. Ném `AppException`; filter trung tâm dựng envelope (AD-5). KHÔNG bao giờ trả `passwordHash`/field account nhạy cảm.
- **Fail-fast secret:** thiếu/quá ngắn `JWT_ACCESS_SECRET` (< 32 ký tự) → `main.ts` `throw` lúc bootstrap (không ký JWT bằng secret rỗng).
- **`Account`** (danh tính) là entity **base** tạo ở 2.3; Story 2.4 **mở rộng** cùng entity với registry quyền + `AccountPermission` (migration riêng, KHÔNG tạo lại bảng). Một entity, hai story bồi đắp — KHÔNG hai nhánh danh tính (AD-8).
- Route `/auth/login|refresh|logout` là **ngoại lệ hạ-tầng-xác-thực có chủ ý** (như `/health`) — không áp quy ước "danh từ số nhiều" cho verb auth.

## Đặt lại / đổi mật khẩu (Story 2.8)

Ba route: `POST /auth/forgot-password` + `POST /auth/reset-password` (công khai, `@Public()`) và `POST /auth/change-password` (**cần Bearer** — nằm ở `change-password.controller.ts` riêng vì `AuthController` đã `@Public()` cấp class; **KHÔNG** nới guard).

**Luật (không vi phạm):**

- **Mã 6 chữ số sinh bằng `crypto.randomInt(0, 1_000_000)`** (rejection sampling ⇒ không modulo bias). **KHÔNG** dùng `% 1000000` trên `randomBytes`.
- **Lưu HASH argon2id**, không bao giờ lưu/trả/log mã thô. Khác refresh token (SHA-256): mã 6 số chỉ ~20 bit entropy nên fast-hash sẽ vỡ tức thì nếu DB lộ. **Tra theo `accountId`**, KHÔNG theo `codeHash` (mã ngắn có thể trùng hash giữa các account).
- **Bộ kiểm soát bù (đủ cả bộ, không bỏ cái nào):** TTL `PASSWORD_RESET_CODE_TTL_MINUTES` (mặc định 5') · **single-use** (`consumedAt` lật bằng cổng **atomic** `updateMany` + kiểm `count === 1`) · trần `PASSWORD_RESET_MAX_ATTEMPTS` (mặc định 5, tăng **atomic trước khi verify**) · **cooldown** = vòng đời mã (còn mã sống thì không phát mã mới).
- **Chống user-enumeration:** `forgot-password` **luôn** trả cùng `200 { expiresInSeconds }` dù email tồn tại hay không, cân bằng timing bằng dummy hash (mirror `AuthService.login`). `reset-password` trả **một** `AppException(UNAUTHENTICATED, 401)` + **một** message duy nhất (`RESET_FAILED_MESSAGE`) cho **mọi** nhánh sai: email lạ / không có mã sống / mã sai / mã hết hạn / vượt trần thử.
- **Sau reset VÀ sau change-password: thu hồi MỌI `Session`** của account (`session.updateMany({ revokedAt: null } → now)`).
- **Change-password** bắt buộc verify mật khẩu hiện tại; mật khẩu mới trùng mật khẩu cũ → `400 VALIDATION_ERROR` + `fieldErrors[].field = 'newPassword'`.
- **Audit đi QUA `EventBus`, KHÔNG gọi trực tiếp** (AD-18): `PasswordResetService`/`AuthService` chỉ inject `EventBus`, publish `PasswordResetRequested` / `PasswordResetCompleted` / `PasswordChanged` **sau khi commit**. **CẤM** inject `AuditService`/`NotificationDispatcher` — source-guard enforce.
- **CẤM tuyệt đối bí mật trong payload event:** `before`/`after` KHÔNG chứa mật khẩu thô, `passwordHash`, hay mã xác thực. `AuditLog` là bản ghi **bất biến vĩnh viễn**.
- **Password policy** (`dto/password-policy.ts`, dùng chung reset + change): ≥8 ký tự, có chữ **và** số. *Ghi nợ: NIST SP 800-63B Rev 4 khuyến nghị **bỏ** composition rule, ưu tiên độ dài + blocklist mật khẩu đã lộ. Giữ rule hiện tại vì là hợp đồng UX đã chốt — không tự ý đảo.*

**Giới hạn đã biết (đừng giấu, đừng coi là đã xử):**

- **Thu hồi phiên KHÔNG tức thì:** access JWT là stateless ⇒ sau reset/change, access token cũ **vẫn hợp lệ tối đa `ACCESS_TOKEN_TTL`** (mặc định 15 phút). Thu hồi tức thì cần denylist / kiểm DB mỗi request.
- **Không có rate-limit IP** trên 3 endpoint công khai. Trần attempt + cooldown + response trung tính chặn **đoán mã** và **enumeration**, **không** chặn spam/DoS.
- **Mã chưa tới tay người dùng:** chưa có kênh email/SMS; `NotificationDispatcher` bản đầu chỉ log. Luồng Quên mật khẩu chưa dùng được self-service.
- **Cooldown mã reset KHÔNG atomic (đua):** `requestResetCode` là read-then-write (`findFirst(live)` → `create`), chưa có ràng buộc DB ⇒ N request `forgot-password` đồng thời cùng email có thể tạo N mã sống, làm yếu phòng thủ của mã 6 số (mỗi mã có trần attempt riêng). Trần-attempt và single-use *đã* atomic; chỉ cooldown thì chưa. **Cần fix khi mở kênh gửi mã** (cùng B-8): partial unique index `(account_id) WHERE consumed_at IS NULL` + xử lý P2002 như "đang có mã sống". Chưa khai thác được end-to-end vì mã chưa có kênh gửi.
- **Audit ghi best-effort (có thể MẤT im lặng):** producer publish **sau** commit; `InProcessEventBus` cô lập + nuốt lỗi consumer ⇒ nếu `AuditService.record` throw (DB lỗi), thay đổi nghiệp vụ đã commit nhưng `AuditLog` không ghi, không ai quan sát được. Đúng cho notification, nhưng với audit append-only thì là trade-off Phase-1. Nếu audit cần mức compliance: ghi audit trong tx của producer, hoặc dead-letter để phát hiện mất.
- ~~**Authz cho route không khai `@RequirePermissions` = allow mọi user đã đăng nhập**… Cần source-guard trước khi thêm route nghiệp vụ.~~ **ĐÃ TRẢ (Story 2.10):** `no-handler-without-require-permissions.spec.ts` bắt mọi handler thiếu khai báo. Runtime của `PermissionsGuard` **không đổi** (thiếu metadata quyền vẫn cho qua) — chặn nằm ở source-guard, nên handler ngoài `*.controller.ts` (WebSocket gateway, GraphQL resolver…) vẫn ngoài tầm quét; mở rộng guard khi có handler như vậy.
- **Chưa có nút "Gửi lại mã":** đồng hồ "Gửi lại mã sau MM:SS" ở màn Quên mật khẩu hàm ý một affordance chưa nối (hoãn cùng kênh gửi mã).

## Guard quyền server-side — fail-closed toàn cục + `/me` (AD-4, Story 2.5)

Server là **ranh giới bảo mật DUY NHẤT**: backend enforce quyền **mỗi request**. Ẩn/disable ở client CHỈ là UX, KHÔNG phải bảo mật — gọi thẳng API mà thiếu quyền vẫn bị từ chối bất kể FE hiển thị gì (AD-4, NFR-7).

**Luật (không vi phạm):**

- **Hai guard toàn cục qua `APP_GUARD`, ĐÚNG thứ tự** (khai trong `AuthModule`): `JwtAuthGuard` **trước** `PermissionsGuard` (Permissions đọc `request.account` do Jwt gắn). Mọi endpoint **mặc định cần access JWT** — fail-closed: endpoint domain mới (Epic 3+) tự động bị khoá tới khi khai quyền, KHÔNG thể "quên guard mà lộ".
- **`@Public()`** opt-out cả hai guard — CHỈ cho route hạ-tầng-công-khai (`/health`, `/auth/login|refresh|logout`). Quên `@Public` cho route công khai ⇒ e2e fail 401 (lưới an toàn — sửa bằng `@Public`, KHÔNG nới guard).
- **`@RequirePermissions(PERM.x, PERM.y)`** (semantics **AND** — đòi *tất cả* key) đánh dấu quyền cụ thể; tham số kiểu `PermissionKey` (registry, KHÔNG literal — AD-17). Endpoint KHÔNG khai = chỉ cần đăng nhập.
- **`@RequireAnyPermissions(PERM.x, PERM.y)`** (semantics **OR** — đòi *ít nhất một* key) — **song song**, KHÔNG thay thế `@RequirePermissions`. Dùng khi hai key diễn đạt hai **phạm vi** của cùng một hành động và preset vai trò cấp key rộng **không** kèm key hẹp: đặt key hẹp làm sàn AND sẽ **khoá chính người có quyền rộng** (`GET /orders` gate `orders.view_all` **hoặc** `orders.view_own`; phạm vi dữ liệu do service thu hẹp sau, không do guard). Khai **cả hai** decorator ⇒ phải thoả **cả hai** (đủ AND-set *và* có ≥1 của OR-set); `PermissionsGuard` resolve effective set đúng MỘT lần cho cả hai phép. (Story 5.3)
- **Phạm vi dữ liệu là việc của service, không phải guard.** Guard trả lời "được gọi route này không"; **service** trả lời "được thấy/sửa BẢN GHI này không". Với `orders/`, đường đọc đi qua `findScopedOrThrow()` — ngoài phạm vi ⇒ **404 cùng thông điệp với không tồn tại** (không xác nhận sự tồn tại của bản ghi người khác). Đường **ghi** phải theo cùng luật: đọc-chặt-ghi-lỏng là lỗ uỷ quyền, không phải khác biệt phong cách.
- **`@CurrentAccount()`** lấy danh tính (`{ id, email, displayName }`) `JwtAuthGuard` gắn — controller KHÔNG đọc `request` thô, KHÔNG chạm `passwordHash`.
- **Mã lỗi:** thiếu/không hợp lệ token → **401 `UNAUTHENTICATED`**; xác thực được nhưng thiếu quyền → **403 `FORBIDDEN`**. Guard ném `AppException` (message trung tính, KHÔNG leak lý do verify — chống enumeration); filter dựng envelope + traceId (AD-5).
- **Quyền resolve TƯƠI mỗi request** qua `AccountPermissionsService.listForAccount` (AD-8) — KHÔNG suy quyền từ JWT claim/role. `JwtAuthGuard` kiểm `isActive` mỗi request ⇒ deactivate account có hiệu lực tức thì (không đợi hết TTL).
- **`GET /me`** trả `{ id, email, displayName, permissions: string[] }` — `permissions` là effective set **sorted (tất định)**; contract chính tắc để FE (Story 2.6) dựng `PermissionSet`. Chỉ cần xác thực (mọi phiên đọc quyền CỦA MÌNH). `/me` là danh từ số ít ngoại lệ hạ-tầng (như `/health`).
- **CẤM** để endpoint nghiệp vụ mới thiếu guard/`@RequirePermissions` — quên = mở toang. Thêm route domain: khai `@RequirePermissions(PERM.x)` cho quyền cần, dựa guard toàn cục lo xác thực.
- **Mọi handler không `@Public` phải khai quyền tường minh** — `@RequirePermissions(...)`, `@RequireAnyPermissions(...)` **hoặc** `@AuthenticatedOnly()`; source-guard `no-handler-without-require-permissions.spec.ts` enforce (Story 2.10). `@AuthenticatedOnly()` là marker `SetMetadata` thuần (KHÔNG đổi hành vi runtime) dùng cho route **self-service** đọc/sửa dữ liệu CỦA CHÍNH MÌNH (`GET /me`, `POST /auth/change-password`) — nó biến "chỉ cần phiên hợp lệ" thành **quyết định tuyên bố tại code site**, không phải "quên khai" im lặng. Route nghiệp vụ chạm dữ liệu người khác **KHÔNG** được dùng marker này.

## Luật không-leo-thang quyền (FR-18, Story 2.10)

Hai luật domain thuần (`accounts/domain/permission-escalation.ts`), enforce tại `AccountPermissionsService.setForAccount(actor, target, keys)` — **fail-closed, KHÔNG chạm DB khi từ chối** (403 `FORBIDDEN`):

- **Luật #1 — không cấp quyền mình không có:** mọi key sắp ghi phải ⊆ effective set của **actor**.
- **Luật #2 — không sửa account mang quyền mình không có:** effective set **HIỆN TẠI** của **target** phải ⊆ effective set của actor. Kiểm bộ *hiện tại* (không phải bộ mới) là điểm mấu chốt: gửi `keys = []` để "thu sạch" sẽ lọt luật #1, chỉ luật #2 chặn được.
- **Hệ quả — "xoá Super Admin" bất khả:** `SUPER_ADMIN` mang `audit.read` + `system.feature_flags` mà `ADMIN` không có (`role-presets.ts`) ⇒ luật #2 chặn mọi thao tác của `ADMIN` lên account `SUPER_ADMIN`. Đừng thêm hai key đó vào `ADMIN_PRESET` — mất luôn lằn ranh (`permission-escalation.spec.ts` sẽ đỏ).
- Quyền của actor **và** target resolve **tươi từ DB** mỗi lần gọi (AD-8) — KHÔNG nhận qua tham số/JWT claim; service là ranh giới bảo mật cuối.
- Ghi thành công ⇒ publish `AccountPermissionsChanged` qua `EventBus` **sau commit** (AD-18); payload chỉ id + danh sách key (sorted), KHÔNG bí mật.

## Domain Event & EventBus (AD-18, Story 2.7)

Mọi hành động nghiệp vụ **có hệ quả** (E4+) phát tín hiệu qua **MỘT `EventBus` port DUY NHẤT** — producer publish, consumer subscribe. Side-effect (audit, push) là **cross-cutting** lắp qua event, KHÔNG nhét trong service nghiệp vụ. Đây là seam để "bộ gửi thật lắp sau (Epic 9) KHÔNG phải mở lại code chức năng".

**Luật (không vi phạm):**

- **Producer chỉ `eventBus.publish(event)`** — inject `EventBus` (abstract class kiêm DI token, `src/events/`), **CẤM** gọi FCM/notification/audit trực tiếp. Đổi implementation port (queue/retry ở Epic 9) KHÔNG đụng producer. Source-guard `no-direct-side-effect-outside-eventbus.spec.ts` chặn: cấm `firebase-admin` ngoài `notifications/`; cấm inject `NotificationDispatcher`/`AuditSubscriber`/`AuditService` ngoài module sở hữu.
- **Thêm chức năng E4+ = định nghĩa concrete `DomainEvent` + publish**, KHÔNG tự gọi side-effect. Base `DomainEvent` (`src/events/domain-event.ts`) là **DOMAIN thuần** (không import Nest/Prisma), mang 5 chiều audit: `type` (gì) / `occurredAt` (khi nào) / `actorAccountId` (ai, optional=system) / `target` (đối tượng) / `before`+`after` (trước→sau). Concrete event do story sở hữu khai riêng — 2.7 CHỈ khai base contract (YAGNI).
- **Consumer tự đăng ký `onModuleInit`** (`this.eventBus.subscribe(this)`): `AuditSubscriber` (ghi `AuditLog`) và `NotificationDispatcher` (bản đầu no-op/log; Epic 9 thay bằng FCM). EventsModule (@Global) KHÔNG biết consumer nào — thêm consumer = thêm module, không sửa nền.
- **Fan-out đồng bộ + cô lập lỗi:** `InProcessEventBus.publish` await từng subscriber trong `try/catch` riêng — một subscriber ném → **log** (Logger, KHÔNG nuốt im lặng) + tiếp tục subscriber còn lại; `publish` KHÔNG sập vì một consumer hỏng. In-process đủ cho Phase 1 (~20 user, YAGNI — chưa cần queue/broker).
- **`AuditLog` append-only** (bảng `audit_logs`, AD-8): `AuditService` CHỈ `create` (KHÔNG `update`/`delete`/`upsert`) — nhật ký bất biến. `actorAccountId` lưu String **KHÔNG FK cascade** để bản ghi sống sót khi account bị vô hiệu/xoá. Đọc audit chỉ **Super Admin** (gate `audit.read`) = **Story 8.5**; 2.7 chỉ dựng đường **ghi**, KHÔNG endpoint mới → `openapi.json` không đổi.

## Khoá dòng & test đồng thời (Epic 6)

- **Thứ tự khoá toàn hệ thống:** `SELECT id FROM orders WHERE id = … FOR UPDATE` là op đầu tiên trong tx chạm đơn; khoá sản phẩm sau đó bằng **một** câu `SELECT id FROM products WHERE id = ANY(…) ORDER BY id FOR UPDATE` (khoá `products`, không khoá `stock_items` — dòng tồn sinh lười, `FOR UPDATE` trên tập rỗng không khoá gì). Đảo thứ tự = deadlock.
- **`FOR UPDATE` chỉ đo được ở lane DB** — lane hermetic mock Prisma luôn xanh khi gỡ khoá. Mỗi khoá mới cần một ca `*.db.integration.spec.ts` ép interleaving.
- **Tx giữ khoá trong test phải GHI đúng thứ primitive đọc** (vd `onHand + 3` dưới khoá, rồi assert kết quả cuối). Tx chỉ giữ khoá "trần" có thể bị một lệnh khác chặn hộ (FK lấy KEY SHARE, UPDATE cùng dòng) ⇒ ca "CHỜ khoá" vẫn xanh khi gỡ `FOR UPDATE`.
- **Tập khoá có nhiều nguồn** (vd dòng version mới + sản phẩm chỉ còn giữ ở version cũ): mỗi nguồn cần một ca interleaving riêng; mutate từng nguồn và đòi ĐỎ.
- **Chứng từ đánh số (hợp đồng, hoá đơn — Epic 7):** số cấp bằng `nextval(pg_get_serial_sequence(…))` **trong** tx dưới khoá đơn; không `count() + 1`. Dưới khoá phải đọc lại **cả** `status` và `currentVersionId`: `confirm` giữ nguyên version nên chỉ kiểm con trỏ version là mù với "sửa báo giá rồi chốt" giữa `getScoped` và `FOR UPDATE` (khuôn ở `invoices.service.ts` và `contracts.service.ts`, mỗi nơi có ca DB holder sửa qty + chốt ⇒ 409). Render PDF + upload nằm trong tx ⇒ đặt `timeout` tx (30 s) và có unit assert nó.
- **Barrier race test:** barrier "cả hai cùng tới" trên **cùng** đơn sẽ deadlock khi đường đó khoá `orders` — barrier trên 2 đơn khác nhau, cộng một ca cùng đơn tuần tự hoá bởi khoá, cộng ca holder.
- **Tiền INT4:** cột `Int` tràn ở 2.147.483.647. Số do server tự tính (đợt theo %, tổng) không đi qua `@Max` của DTO ⇒ domain tự chặn (`MAX_INSTALLMENT_AMOUNT`) và trả 400 field error; có ca lane DB với đơn > INT4.

## Source-guard regex — biến thể phải bắt (Epic 7)

Guard soi lời gọi Prisma bằng regex phải chịu được: khoảng trắng/xuống dòng quanh dấu chấm (`tx.payment\n.create(` sau prettier), hậu tố `*OrThrow` / `*AndReturn`, SQL thô trong template literal (`stripToCode` xoá literal ⇒ quét thêm nguồn RAW), nhãn lồng trong nhãn dài hơn (`'MST'` trong `'MST khách'`). Mỗi biến thể áp dụng được cần một ca mẫu "catches…" trong chính file guard, cạnh assert chống-guard-rỗng. SQL thô: dùng `test/util/raw-sql-write.ts` trên nguồn đã `stripComments` (giữ string, bỏ comment ⇒ nhãn trong comment không đỏ oan).

## Lint / format (bắt buộc)

- ESLint (flat config) + Prettier. Chạy: `npm run lint`, `npm run format`.
- Không "mỗi người/file một kiểu".

## Bất biến kiến trúc chạm tới backend skeleton

- **AD-1** — chỉ `prisma/PrismaService` chạm DB; chỉ backend giữ credential (`DATABASE_URL` trong `.env` gitignored). Cấm module domain tự `new PrismaClient()` (source-guard test enforce).
- **AD-12** — OpenAPI sinh từ code, cấm sửa tay (ở trên).
- Tầng: API → Application → Domain → Infrastructure; Domain KHÔNG phụ thuộc Infrastructure.
