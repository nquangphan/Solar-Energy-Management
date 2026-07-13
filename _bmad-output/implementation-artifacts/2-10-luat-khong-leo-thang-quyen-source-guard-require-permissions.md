---
baseline_commit: 3a00af9d806e0621cc988d6af36aba4fa2b7d071
---

# Story 2.10: Luật không-leo-thang quyền + source-guard `@RequirePermissions`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên backend**,
I want **thực thi luật không-leo-thang quyền trong `account-permissions.service.ts` (không cấp quyền mình không có; không sửa/vô hiệu hoá account mang quyền mình không có) + một source-guard khẳng định "mọi handler không `@Public` phải khai quyền"**,
so that **chủ doanh nghiệp không thể tự gia tăng quyền hay xoá Super Admin, và Epic 3+ không thể lộ `Product.costPrice` vì một route quên guard**.

## Acceptance Criteria

1. **AC-1 — Luật #1: không cấp quyền mình không có.** **Given** `AccountPermissionsService.setForAccount()` được gọi bởi một actor, **When** bộ key chuẩn bị ghi chứa ít nhất một key **không** nằm trong effective set của actor, **Then** ném `AppException(FORBIDDEN, 403)` và **KHÔNG chạm DB** (kiểm TRƯỚC transaction). Bộ key ⊆ quyền actor ⇒ cho ghi (FR-18, AD-4).

2. **AC-2 — Luật #2: không sửa account mang quyền mình không có.** **Given** một hành động sửa/vô hiệu hoá account target, **When** effective set **hiện tại** của target chứa ít nhất một key actor **không** có, **Then** từ chối `AppException(FORBIDDEN, 403)`; ngược lại cho sửa. Hệ quả bắt buộc: `ADMIN` (không có `audit.read`/`system.feature_flags`) **KHÔNG** sửa/thu quyền được account `SUPER_ADMIN` — "xoá Super Admin" bất khả (FR-18, AC-3 Epic 2).

3. **AC-3 — Cấp/thu quyền publish domain event → ghi Audit.** **Given** `setForAccount()` ghi thành công, **When** transaction commit, **Then** publish `AccountPermissionsChanged` qua `EventBus` port **sau commit** (ai = actor, đối tượng = Account target, trước→sau = bộ key cũ→mới, **sorted** để tất định). **CẤM** inject `AuditService`/`NotificationDispatcher` trực tiếp (AD-18, source-guard `no-direct-side-effect-outside-eventbus` enforce).

4. **AC-4 — Source-guard: mọi handler không `@Public` phải khai quyền.** **Given** bất biến `CONVENTIONS.md` ("Guard quyền server-side"), **When** chạy test mới quét `src/**/*.controller.ts`, **Then** mọi handler HTTP (`@Get/@Post/@Put/@Patch/@Delete`) phải mang **đúng một trong ba**: `@Public()` (class hoặc method) · `@RequirePermissions(...)` · `@AuthenticatedOnly()` — thiếu cả ba ⇒ **test FAIL**. Guard có test sanity "bắt được handler trần" (chống guard chết luôn xanh) (AD-4, NFR-7).

5. **AC-5 — Hai handler self-service hiện có được khai tường minh, KHÔNG nới guard.** **Given** `GET /me` và `POST /auth/change-password` cố ý chỉ-cần-đăng-nhập (không quyền cụ thể), **When** áp AC-4, **Then** hai handler này mang `@AuthenticatedOnly()` — quyết định "chỉ cần phiên hợp lệ" trở thành **tuyên bố tường minh tại code site**, không phải "quên khai" im lặng. Hành vi runtime **không đổi** (`PermissionsGuard` vẫn cho qua khi không có `@RequirePermissions`).

**Bằng chứng "done" (hermetic — KHÔNG cần Postgres):**

- `npm test` xanh **33 suite** (31 hiện có + 2 mới: `permission-escalation.spec.ts`, `no-handler-without-require-permissions.spec.ts`), 0 regression.
- `account-permissions.service.spec.ts` có case: actor thiếu quyền cấp → 403 + `$transaction` **không được gọi**; actor thiếu quyền của target → 403; happy path → ghi + publish event đúng payload.
- `no-permission-literal-outside-registry.spec.ts` xanh (code mới dùng `PERM.*`/`PermissionKey`, không literal).
- `no-direct-side-effect-outside-eventbus.spec.ts` xanh (service chỉ inject `EventBus`).
- `openapi-drift.spec.ts` + `permissions-drift.spec.ts` xanh **không cần regen** — story này KHÔNG thêm endpoint, KHÔNG đổi registry (`@AuthenticatedOnly` là `SetMetadata` thuần, không chạm Swagger schema).
- `npm run lint`, `npm run format:check`, `nest build` sạch.

## Tasks / Subtasks

- [x] **Task 1 — Domain thuần: luật không-leo-thang (AC: 1, 2)**
  - [x] Tạo `backend/src/accounts/domain/permission-escalation.ts` — **DOMAIN THUẦN**: chỉ `PermissionKey` + `Set`, **KHÔNG** import Nest/Prisma/`AppException` (mirror `role-presets.ts`). Hai hàm pure trả **danh sách key thiếu** (không throw — tầng service quyết định lỗi):
    ```ts
    /** Luật #1: key actor định cấp mà chính actor KHÔNG có. Rỗng ⇒ hợp lệ. */
    export function keysActorCannotGrant(
      actorPermissions: ReadonlySet<PermissionKey>,
      requestedKeys: readonly PermissionKey[],
    ): PermissionKey[];

    /** Luật #2: key target ĐANG mang mà actor KHÔNG có. Rỗng ⇒ actor được phép sửa target. */
    export function keysBlockingActorFromTarget(
      actorPermissions: ReadonlySet<PermissionKey>,
      targetPermissions: ReadonlySet<PermissionKey>,
    ): PermissionKey[];
    ```
  - [x] Cả hai trả về mảng **sorted + dedup** (thông điệp lỗi tất định, dễ test).
  - [x] Docstring nêu rõ bất biến: luật #2 là thứ chặn `ADMIN` thu quyền `SUPER_ADMIN` — vì `SUPER_ADMIN` mang `audit.read` + `system.feature_flags` mà `ADMIN` không có (xem `role-presets.ts`).

- [x] **Task 2 — Đổi `setForAccount` sang có actor + enforce hai luật (AC: 1, 2, 3)**
  - [x] `backend/src/accounts/account-permissions.service.ts` — đổi chữ ký:
    ```ts
    async setForAccount(
      actorAccountId: string,
      targetAccountId: string,
      keys: PermissionKey[],
    ): Promise<void>
    ```
    **An toàn:** grep xác nhận **không caller nào trong `src/`** (Epic 8 mới dựng màn Phân quyền); `prisma/seed.ts` ghi thẳng qua Prisma, **KHÔNG** gọi method này ⇒ đổi chữ ký không vỡ seed. Cấm thêm biến thể "không actor" (backdoor bỏ qua luật).
  - [x] Thứ tự kiểm — **fail-closed, KHÔNG chạm DB khi từ chối**:
    1. Validate key ∈ registry (`isPermissionKey`) → `VALIDATION_ERROR` 400 (**giữ nguyên logic hiện có**, chạy TRƯỚC).
    2. Resolve `actorPermissions = await listForAccount(actorAccountId)` và `targetPermissions = await listForAccount(targetAccountId)` — resolve TƯƠI từ DB (AD-8), KHÔNG nhận quyền actor từ tham số/JWT (caller có thể nói dối).
    3. Luật #2 trước (`keysBlockingActorFromTarget`) → có key chặn ⇒ `AppException(FORBIDDEN, 403)`.
    4. Luật #1 (`keysActorCannotGrant`) → có key vượt ⇒ `AppException(FORBIDDEN, 403)`.
    5. Chỉ khi cả hai sạch: chạy `$transaction` xoá-cũ-tạo-mới **giữ nguyên** (kể cả nhánh `createMany` rỗng — xem Gotcha #2).
  - [x] Message lỗi tiếng Việt, nêu key vi phạm (đây là màn quản trị nội bộ, không phải bề mặt chống enumeration): vd `Không thể cấp quyền bạn không có: costs.view` / `Không thể sửa account mang quyền bạn không có: audit.read`.
  - [x] **KHÔNG** đụng `listForAccount` (guard toàn cục gọi mỗi request — đổi = ảnh hưởng toàn hệ).

- [x] **Task 3 — Domain event + publish sau commit (AC: 3)**
  - [x] Tạo `backend/src/accounts/domain/account-events.ts` (mirror `auth/domain/password-events.ts`): class `AccountPermissionsChanged implements DomainEvent` với `type = 'AccountPermissionsChanged'`, `actorAccountId`, `target = { type: 'Account', id: targetAccountId }`, `before = { permissions: string[] }` (bộ cũ, **sorted**), `after = { permissions: string[] }` (bộ mới, **sorted**), `occurredAt`. DOMAIN THUẦN: KHÔNG import Nest/Prisma.
  - [x] `AccountPermissionsService` inject `EventBus` (constructor). **KHÔNG** cần sửa `accounts.module.ts` — `EventsModule` là `@Global` (xác nhận tại `src/events/events.module.ts:14`).
  - [x] Publish **SAU khi `$transaction` resolve** (không publish trong tx — audit ghi best-effort, xem CONVENTIONS "Audit ghi best-effort").
  - [x] Payload **KHÔNG** chứa bí mật (không `passwordHash`, không email) — chỉ id + danh sách key. `AuditLog` là bản ghi bất biến vĩnh viễn.

- [x] **Task 4 — Decorator `@AuthenticatedOnly()` (AC: 5)**
  - [x] Tạo `backend/src/auth/authenticated-only.decorator.ts` — marker `SetMetadata(AUTHENTICATED_ONLY_KEY, true)`, mirror `public.decorator.ts`. Docstring: "*Tuyên bố tường minh: route CHỈ cần phiên hợp lệ, KHÔNG quyền cụ thể (self-service: đọc/sửa dữ liệu CỦA CHÍNH MÌNH). Runtime không đổi hành vi — `PermissionsGuard` vốn cho qua khi thiếu `@RequirePermissions`. Tồn tại để source-guard phân biệt 'cố ý mở cho mọi phiên' với 'quên khai quyền'. KHÔNG dùng cho route nghiệp vụ chạm dữ liệu người khác.*"
  - [x] **KHÔNG** sửa `PermissionsGuard` — đây là marker cho source-guard, không phải nhánh runtime mới (YAGNI; thêm nhánh = thêm rủi ro cho guard bảo mật đang chạy).
  - [x] Áp `@AuthenticatedOnly()` lên `MeController.me` (`src/auth/me.controller.ts`) và `ChangePasswordController.changePassword` (`src/auth/change-password.controller.ts`). **Chỉ thêm decorator**, không đổi logic/DTO/response.
  - [x] Cập nhật docstring hai controller: câu "KHÔNG `@RequirePermissions`" → nêu decorator mới (xem **Gotcha #1** — câu này trong comment sẽ bị `stripComments` bỏ, nhưng để comment và code kể cùng một chuyện).

- [x] **Task 5 — Source-guard `no-handler-without-require-permissions.spec.ts` (AC: 4)**
  - [x] Tạo `backend/test/no-handler-without-require-permissions.spec.ts`, mirror **cấu trúc** `no-permission-literal-outside-registry.spec.ts` (đọc file bằng `readdirSync` đệ quy + `stripComments`, describe tiếng Việt, có test sanity).
  - [x] Thuật toán (text scan, hermetic, không cần Nest runtime):
    1. Thu mọi file `src/**/*.controller.ts`.
    2. `stripComments(readFileSync(...))` — **BẮT BUỘC**, xem Gotcha #1.
    3. Khai báo cấp CLASS (`@Public()`/`@RequirePermissions`/`@AuthenticatedOnly` đứng trước `class X`) miễn mọi handler của **chính class đó** — tính RIÊNG cho từng class (`AuthController`, `HealthController` dùng lối này). *(Sửa ở review: bản đầu miễn cả FILE theo class đầu tiên ⇒ controller thứ hai cùng file lọt lưới.)*
    4. Quét theo **khối**: mọi dòng từ ranh giới trước (dòng khai class / dòng khai method của handler liền trước) tới dòng khai method của handler đang xét. Khối phải chứa `@RequirePermissions(` **hoặc** `@AuthenticatedOnly(` **hoặc** `@Public(`. Thứ tự decorator KHÔNG quan trọng (đúng như TS/Nest hiểu). Verb quét: **toàn bộ** decorator định tuyến Nest — `@All/@Get/@Post/@Put/@Patch/@Delete/@Options/@Head/@Search`. *(Sửa ở review: bản đầu chỉ soi 5 verb và chỉ đọc decorator DƯỚI `@Get`.)*
    5. Thiếu ⇒ offender `{ file, handler }`. `expect(offenders).toEqual([])`.
  - [x] Test sanity **bắt buộc** (chống guard chết luôn xanh): dựng source giả một handler `@Get()` trần ⇒ hàm phân tích trả offender; handler có `@RequirePermissions(PERM.x)` ⇒ không offender; handler chỉ được comment `// @RequirePermissions` ⇒ **vẫn** offender (chứng minh `stripComments` chạy đúng).
  - [x] Kỳ vọng lần chạy đầu: **4 file controller** hiện có đều PASS (`auth` + `health` exempt class-level `@Public`; `me` + `change-password` nhờ Task 4).

- [x] **Task 6 — Test luật không-leo-thang (AC: 1, 2, 3)**
  - [x] Tạo `backend/test/permission-escalation.spec.ts` (unit domain thuần): luật #1 — subset ⇒ rỗng; thừa 1 key ⇒ trả đúng key đó; luật #2 — target ⊆ actor ⇒ rỗng; target có `audit.read` mà actor không ⇒ trả `['audit.read']`; kết quả **sorted**.
  - [x] **Test bất biến "không xoá được Super Admin"** (dùng `ROLE_PRESETS` thật, KHÔNG hardcode key): actor = `new Set(ROLE_PRESETS.ADMIN)`, target = `new Set(ROLE_PRESETS.SUPER_ADMIN)` ⇒ `keysBlockingActorFromTarget` **KHÔNG rỗng** (chứa `audit.read` + `system.feature_flags`). Test này là lưới an toàn cho AC-3 Epic 2 — nếu ai đó lỡ thêm `audit.read` vào `ADMIN_PRESET`, test đỏ.
  - [x] Mở rộng `backend/test/account-permissions.service.spec.ts` (mock Prisma + **mock `EventBus`**): (a) actor thiếu quyền định cấp ⇒ `FORBIDDEN` 403 **và** `$transaction` không được gọi **và** `eventBus.publish` không được gọi; (b) target mang quyền actor không có ⇒ 403; (c) key ngoài registry ⇒ vẫn `VALIDATION_ERROR` 400 (regression 2.4); (d) happy path ⇒ `$transaction` chạy + publish đúng **một** event với `before`/`after` sorted, `actorAccountId`, `target.id` = target.
  - [x] Mock `listForAccount` trả **hai** giá trị khác nhau cho actor và target (mock `findMany` theo `where.accountId`) — mock trả cùng một Set cho cả hai sẽ khiến test luật #2 giả xanh.

- [x] **Task 7 — Đồng bộ tài liệu (AC: 4)**
  - [x] `backend/CONVENTIONS.md` mục "Guard quyền server-side": bổ sung luật "**Mọi handler không `@Public` phải khai `@RequirePermissions` hoặc `@AuthenticatedOnly` — source-guard `no-handler-without-require-permissions.spec.ts` enforce**"; và ở khối "Giới hạn đã biết", gạch bỏ mục *"Authz cho route không khai `@RequirePermissions` = allow mọi user đã đăng nhập… Cần source-guard…"* → thay bằng ghi nhận đã có guard (nợ đã trả).
  - [x] `backend/CONVENTIONS.md` thêm mục ngắn về luật không-leo-thang (hai luật + nơi enforce + vì sao chặn xoá Super Admin).
  - [x] `_bmad-output/project-context.md` §Testing: "31 suite … 6 source-guard" → "**33 suite … 7 source-guard**" (thêm `no-handler-without-require-permissions`).

## Dev Notes

### Vì sao story này chặn Epic 3

Epic 3 thêm `Product.costPrice` (giá vốn). Hôm nay, route **quên** `@RequirePermissions` = **mọi user đã đăng nhập đọc được** (authn fail-closed, authz thì KHÔNG — `PermissionsGuard.canActivate` dòng 46–49 cho qua khi metadata rỗng). Đây là lỗ hổng đã được ghi nợ tường minh ở `CONVENTIONS.md` ("Giới hạn đã biết"). AC-4 trả nợ đó **trước** khi route nghiệp vụ đầu tiên xuất hiện.

### Trạng thái hiện tại của file bị SỬA (đọc kỹ — đây là nơi hay vỡ)

| File | Hôm nay làm gì | Story này đổi gì | Phải giữ nguyên |
|---|---|---|---|
| `src/accounts/account-permissions.service.ts` | `listForAccount` (guard toàn cục gọi **mỗi request**); `setForAccount(accountId, keys)` validate registry → `$transaction` xoá-cũ-tạo-mới | `setForAccount` + actor, 2 luật, publish event | `listForAccount` **không đổi**; validate registry vẫn chạy TRƯỚC; nhánh `createMany` rỗng (Gotcha #2) |
| `src/auth/me.controller.ts` | `GET /me` → `{ id, email, displayName, permissions[] sorted }`; không `@RequirePermissions` | thêm `@AuthenticatedOnly()` | contract response (FE Story 2.6 phụ thuộc), `@ApiBearerAuth` |
| `src/auth/change-password.controller.ts` | `POST /auth/change-password`, controller RIÊNG vì `AuthController` mang `@Public()` cấp class | thêm `@AuthenticatedOnly()` | **KHÔNG** gộp lại vào `AuthController` (sẽ thành public — đây chính là lý do nó tách ra) |
| `backend/CONVENTIONS.md` | ghi nợ "cần source-guard" | ghi nhận nợ đã trả + luật mới | phần còn lại |

**KHÔNG sửa:** `permission-registry.ts`, `role-presets.ts` (Story 2.9 vừa chốt), `permissions.guard.ts`, `jwt-auth.guard.ts`, `openapi/*.json`, `prisma/schema.prisma` (không cột mới), `prisma/seed.ts`.

### Gotchas (đọc trước khi code)

1. **`stripComments` là BẮT BUỘC trong source-guard.** `me.controller.ts:20` và `change-password.controller.ts:25` có docstring chứa nguyên văn chuỗi `@RequirePermissions`. Quét raw text ⇒ hai handler này **giả PASS** ngay cả khi thiếu decorator ⇒ guard chết mà vẫn xanh. Dùng `stripComments` từ `test/util/strip-comments.ts` (GIỮ string, bỏ comment) — **không** dùng `stripToCode` (bỏ cả string ⇒ mất `@Post('login')`). Test sanity ở Task 5 tồn tại chính để chứng minh điểm này.
2. **Prisma 7 + adapter-pg: `createMany` rỗng có thể ném.** `setForAccount` hiện xây mảng ops và **chỉ** push `createMany` khi `unique.length > 0` (bộ rỗng = thu hồi TẤT CẢ quyền, chỉ `deleteMany`). **Giữ nguyên nhánh này** — thu hồi toàn bộ quyền là ca dùng thật (vô hiệu hoá account) và là ca dễ vỡ nhất khi refactor.
3. **Resolve quyền actor TỪ DB, không từ tham số.** Cám dỗ: truyền `actorPermissions` từ guard/controller cho "đỡ một query". Không. Guard resolve tươi mỗi request (AD-8); service là ranh giới bảo mật cuối và phải tự tin vào dữ liệu của mình. Hai `listForAccount` phụ trong một thao tác quản trị hiếm = chi phí chấp nhận được.
4. **Luật #2 kiểm bộ quyền HIỆN TẠI của target, không phải bộ mới.** Kiểm nhầm sang `keys` sẽ cho `ADMIN` thu sạch quyền `SUPER_ADMIN` (gửi `keys = []` ⇒ luật #1 rỗng-vượt-qua, luật #2 nếu kiểm nhầm cũng qua) ⇒ **thủng đúng cái AC-2 muốn chặn**. Ca test (b) ở Task 6 phải dùng `keys = []` để bắt đúng lỗi này.
5. **`EventsModule` là `@Global`** — inject `EventBus` **không** cần import module. Đừng thêm `imports: [EventsModule]` vào `AccountsModule` (dư thừa, khác pattern hiện có).
6. **Publish SAU commit, KHÔNG trong `$transaction`.** Audit là consumer best-effort; `InProcessEventBus` nuốt lỗi consumer. Publish trong tx = trộn side-effect vào ranh giới giao dịch, sai AD-18.
7. **Source-guard chỉ quét `*.controller.ts`.** Handler nằm ở file tên khác (vd `*.gateway.ts`) sẽ lọt lưới — Phase 1 chỉ có REST controller, ghi vào Open Questions, không mở rộng scope.

### Bất biến kiến trúc áp cho story này

- **AD-4/NFR-7:** backend là ranh giới bảo mật DUY NHẤT; enforce **mỗi request**. Ẩn/disable ở FE là UX.
- **AD-17:** cấm permission literal ngoài `permission-registry.ts` — code mới dùng `PERM.*`/`PermissionKey`. Thông điệp lỗi ghép key từ **giá trị biến** (không viết literal `'audit.read'` trong service/test — test dùng `PERM.auditRead` / `ROLE_PRESETS.*`).
- **AD-18:** producer chỉ `EventBus.publish`. **CẤM** inject `AuditService`/`NotificationDispatcher` — `no-direct-side-effect-outside-eventbus.spec.ts` sẽ đỏ.
- **AD-8:** RBAC per-account là nguồn chân lý; role chỉ là preset nạp lúc tạo. KHÔNG suy quyền từ JWT claim.
- **AD-1:** truy vấn DB CHỈ qua `PrismaService`.

### Phạm vi — làm gì và KHÔNG làm gì

**KHÔNG thuộc story này (Epic 8 sở hữu):** endpoint/màn Phân quyền, `AccountsService.create/update/deactivate`, controller nào gọi `setForAccount`. Story này cung cấp **luật + seam**; AC-2 nói "sửa/vô hiệu hoá account" — luật được enforce tại `setForAccount` (đổi bộ quyền của một account **là** sửa account đó) và **export hàm domain** để CRUD account của Epic 8 gọi lại cùng luật. **KHÔNG** dựng CRUD account trước để "có chỗ gọi" (YAGNI, vi phạm build-order).

### Testing

- Chạy: `cd backend && npm test` (Jest, hermetic — mock Prisma, không cần Postgres). Hẹp trước: `npm test -- permission-escalation account-permissions no-handler`.
- Sau đó full suite + `npm run lint` + `npm run format:check` + `npm run build`.
- **KHÔNG** cần `npm run openapi:gen` / `permissions:gen` — story không thêm endpoint, không đổi registry. Nếu drift-guard đỏ ⇒ bạn đã lỡ đụng thứ không nên đụng.
- Mọi test mới đặt ở `backend/test/*.spec.ts` (flat, kebab-case) — đúng convention 31 suite hiện có.

### Project Structure Notes

File **MỚI** (4): `src/accounts/domain/permission-escalation.ts` · `src/accounts/domain/account-events.ts` · `src/auth/authenticated-only.decorator.ts` · `test/permission-escalation.spec.ts` · `test/no-handler-without-require-permissions.spec.ts` *(5 kể cả 2 test)*.
File **SỬA** (6): `src/accounts/account-permissions.service.ts` · `src/auth/me.controller.ts` · `src/auth/change-password.controller.ts` · `test/account-permissions.service.spec.ts` · `backend/CONVENTIONS.md` · `_bmad-output/project-context.md`.

Đặt luật ở `accounts/domain/` (không phải `auth/`) vì đây là **luật nghiệp vụ phân quyền** thuộc `accounts`, không phải cơ chế xác thực. Decorator ở `auth/` cạnh `public.decorator.ts`/`require-permissions.decorator.ts` — nơi guard toàn cục sống.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.10] — 3 AC gốc (luật #1, luật #2 + publish event, source-guard) + ràng buộc "xong TRƯỚC Epic 3".
- [Source: backend/CONVENTIONS.md#Guard quyền server-side — fail-closed toàn cục] — `@Public`/`@RequirePermissions` semantics AND, mã lỗi 401/403, quyền resolve tươi mỗi request.
- [Source: backend/CONVENTIONS.md#Giới hạn đã biết] — nợ tường minh: "Authz cho route không khai `@RequirePermissions` = allow mọi user đã đăng nhập… Cần source-guard trước khi thêm route nghiệp vụ."
- [Source: backend/CONVENTIONS.md#Domain Event & EventBus] — publish sau commit; audit best-effort; cấm bí mật trong payload.
- [Source: _bmad-output/project-context.md#Bất biến kiến trúc] — AD-1/4/8/17/18.
- [Source: backend/src/accounts/account-permissions.service.ts] — trạng thái hiện tại `setForAccount`.
- [Source: backend/src/auth/permissions.guard.ts:46-49] — nhánh "không khai quyền ⇒ cho qua" (lỗ hổng AC-4 vá).
- [Source: backend/src/accounts/domain/role-presets.ts:54] — `SUPER_ADMIN = [...ADMIN_PRESET, audit.read, system.feature_flags]` — cơ sở của bất biến "không xoá được Super Admin".
- [Source: backend/test/no-permission-literal-outside-registry.spec.ts] — khuôn source-guard chuẩn (đệ quy `src/`, `stripComments`, test sanity).
- [Source: _bmad-output/implementation-artifacts/2-9-*.md] — 20 key registry, ma trận preset vừa chốt.

## Previous Story Intelligence (2.9)

- Registry đã **20 key**; `ADMIN` có `settings.manage` + `costs.view`, **không** có `audit.read`/`system.feature_flags` → hai key này là "lằn ranh" khiến luật #2 chặn được `ADMIN` đụng `SUPER_ADMIN`. **Đừng hardcode** hai key đó trong test — đọc từ `ROLE_PRESETS` để test tự bắt khi ma trận đổi.
- Bài học 2.9 (đắt): **sinh lại artifact FE** (`design-system/permissions/build-permission-keys.mjs`) bị quên vì `npm test` backend vẫn xanh — không CI nào chạy cả hai repo. Story 2.10 **không đổi registry** ⇒ không cần regen. Nếu bạn thấy mình đang sửa `permission-registry.ts`, bạn đã đi lạc khỏi scope.
- Khuôn test bất biến đã có ở `role-presets.spec.ts` (golden-master ma trận) — Task 6 mở rộng cùng tinh thần: khẳng định **quan hệ** giữa preset, không lặp lại danh sách key.

## Git Intelligence

`3a00af9` (2.9): registry 17→20 key + role-presets + test bất biến + regen `permissions.json`. `a669eca` (1.12): chip trạng thái web+mobile. Pattern commit: `feat(story-X.Y): mô tả tiếng Việt`, không tham chiếu AI. Story 2.10 chạm **duy nhất** `backend/` + 2 file docs — không đụng `web/`/`mobile/`/`design-system/`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, workflow `bmad-dev-story`)

### Debug Log References

- `npx jest permission-escalation` → RED trước khi có `permission-escalation.ts` (xác nhận test thật sự chạm code mới).
- **Mutation check source-guard:** xoá dòng `@AuthenticatedOnly()` khỏi `me.controller.ts` → `no-handler-without-require-permissions` ĐỎ đúng một offender (`me.controller.ts → async me(`). Đây là bằng chứng `stripComments` chạy đúng: docstring của file này chứa nguyên văn chuỗi `@RequirePermissions` mà guard vẫn bắt được. File đã restore từ backup (không dùng `git checkout` — story code chưa commit).
- `npm test` → **33 suite / 241 test xanh** (230 lúc dev + 4 test bổ sung lúc dev + 7 test pin lỗi tìm ra ở review), 0 regression. `openapi-drift` + `permissions-drift` xanh **không cần regen** (đúng dự đoán: không thêm endpoint, không đổi registry; `@AuthenticatedOnly` là `SetMetadata` thuần).
- `npm run lint` · `npm run format:check` · `npm run build` sạch.

### Completion Notes List

- **AC-1/AC-2 (hai luật):** domain thuần `permission-escalation.ts` trả danh sách key vi phạm (không throw); `setForAccount(actor, target, keys)` enforce theo thứ tự validate-registry → luật #2 → luật #1, **KHÔNG chạm DB khi từ chối** (test khẳng định `$transaction` và `eventBus.publish` đều không được gọi).
- **Bất biến "không xoá được Super Admin"** được test bằng `ROLE_PRESETS` thật (không hardcode key): `ADMIN` vs `SUPER_ADMIN` ⇒ luật #2 chặn, chứa `audit.read` + `system.feature_flags`. Ca `keys = []` (thu sạch quyền) có test riêng ở tầng service — đây chính là lối đánh mà chỉ luật #2 chặn được.
- **AC-3 (event):** `AccountPermissionsChanged` publish qua `EventBus` **sau** `$transaction` resolve; payload chỉ id + key sorted. Service chỉ inject `EventBus` — `no-direct-side-effect-outside-eventbus` vẫn xanh. `AccountsModule` KHÔNG sửa (`EventsModule` là `@Global`).
- **AC-4 (source-guard):** quét `src/**/*.controller.ts`, `@Public()` cấp class miễn cả file (`auth`, `health`); 4 controller hiện có PASS ngay lần chạy đầu. Có 5 test sanity dựng source giả, gồm ca "decorator chỉ nằm trong comment ⇒ VẪN offender".
- **AC-5:** `@AuthenticatedOnly()` áp lên `MeController.me` + `ChangePasswordController.changePassword`, chỉ thêm decorator — không đổi logic/DTO/response. `PermissionsGuard` KHÔNG sửa (marker chỉ phục vụ source-guard, không thêm nhánh runtime cho guard bảo mật đang chạy).
- Không caller nào của `setForAccount` tồn tại trong `src/` (đã grep) và `prisma/seed.ts` ghi thẳng qua Prisma ⇒ đổi chữ ký không vỡ seed.

### File List

**Mới (5):**

- `backend/src/accounts/domain/permission-escalation.ts`
- `backend/src/accounts/domain/account-events.ts`
- `backend/src/auth/authenticated-only.decorator.ts`
- `backend/test/permission-escalation.spec.ts`
- `backend/test/no-handler-without-require-permissions.spec.ts`

**Sửa (6):**

- `backend/src/accounts/account-permissions.service.ts`
- `backend/src/auth/me.controller.ts`
- `backend/src/auth/change-password.controller.ts`
- `backend/test/account-permissions.service.spec.ts`
- `backend/CONVENTIONS.md`
- `_bmad-output/project-context.md`

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-13 · **Kết luận:** Approve (sau khi sửa 4 lỗi của source-guard)

Phương pháp: **mutation testing** trên chính hai bất biến story hứa — cố tình phá code rồi xem guard/test có ĐỎ không. Guard xanh trong khi code đã hỏng = guard chết.

### 🔴 CRITICAL — source-guard giả PASS (đã sửa)

Cả hai đều là đúng cái AC-4 sinh ra để chặn: **handler không khai quyền mà guard vẫn xanh**.

1. **Chỉ soi 5 verb — `@All`/`@Options`/`@Head`/`@Search` vô hình.** Thêm handler trần `@All('leak')` vào `me.controller.ts` ⇒ guard **XANH**. `@All` đăng ký MỌI verb HTTP, nên đây là bề mặt rộng nhất có thể mà lại lọt lưới hoàn toàn. Sửa: `HTTP_METHOD` quét đủ 9 decorator định tuyến của Nest. Đã pin bằng 4 test (mỗi verb một test).
2. **`@Public()` cấp class miễn cả FILE, không phải cả CLASS.** Thêm `SecretsController` (không `@Public`, handler trần) vào cuối `health.controller.ts` — file mà class đầu có `@Public()` ⇒ guard **XANH**, controller thứ hai lọt sạch. Nguyên nhân: miễn trừ tính theo `code.slice(0, indexOf('export class'))`. Sửa: tính miễn trừ **riêng cho từng class**. Đã pin bằng test hai-controller-một-file.

### 🟡 HIGH — source-guard giả FAIL (đã sửa)

Guard báo đỏ trên code **đúng ở runtime**. Nguy hiểm gián tiếp: nó dạy dev "guard này sai, đừng tin" hoặc gỡ guard cho nhanh.

3. **Chỉ đọc decorator nằm DƯỚI `@Get`.** Viết `@AuthenticatedOnly()` **trên** `@Get('me')` (TS/Nest coi như nhau) ⇒ guard báo offender. Sửa: quét theo khối, thứ tự decorator không còn quan trọng.
4. **`@RequirePermissions` cấp class không được công nhận.** Runtime `Reflector.getAllAndOverride([handler, class])` **có** honor nó, guard thì không ⇒ controller gate cả class (lối viết rất tự nhiên cho Epic 3+) sẽ đỏ oan. Sửa: miễn trừ cấp class dùng cả ba khai báo, khớp ngữ nghĩa runtime.

### ✅ Đã xác minh bằng mutation (không sửa gì — code đúng)

| Phá gì | Guard/test | Kết quả |
|---|---|---|
| Gỡ `@AuthenticatedOnly()` khỏi `/me` | source-guard | 🔴 ĐỎ ✓ |
| Luật #2 kiểm nhầm sang bộ key **MỚI** (gotcha #4 — lối đánh "ADMIN thu sạch quyền SUPER_ADMIN" bằng `keys=[]`) | `account-permissions.service.spec` | 🔴 ĐỎ ✓ |
| Bỏ hẳn luật #2 | service spec | 🔴 ĐỎ ✓ |
| Chạm DB **trước** khi kiểm luật | service spec (4 test) | 🔴 ĐỎ ✓ |

**Bất biến "không xoá được Super Admin" đứng vững:** `permission-escalation.spec.ts` đọc `ROLE_PRESETS` **thật** (không hardcode key) ⇒ `ADMIN` vs `SUPER_ADMIN` luôn bị luật #2 chặn; nếu ai thêm `audit.read` vào `ADMIN_PRESET`, test đỏ. Ở tầng service, ca `keys = []` (thu sạch = vô hiệu hoá) có test riêng và **chỉ** luật #2 bắt được — thứ tự kiểm trong `setForAccount` đúng.

### Chốt lại

- 33 suite / **241 test** xanh (thêm 7 test pin 4 lỗi trên), `lint` · `format:check` · `build` sạch. 0 regression.
- File List không đổi — sửa nằm gọn trong `test/no-handler-without-require-permissions.spec.ts`.
- **Không** đụng `src/` production: 4 lỗi đều nằm trong bản thân source-guard.

## Change Log

- 2026-07-13 — Implement story 2.10: hai luật không-leo-thang quyền (domain thuần + enforce tại `setForAccount` với actor, fail-closed trước DB), domain event `AccountPermissionsChanged` publish sau commit, decorator `@AuthenticatedOnly()` + source-guard bắt handler thiếu khai quyền. Status: ready-for-dev → review.
- 2026-07-13 — Code review: sửa 4 lỗi của source-guard (2 giả PASS: bỏ sót `@All`/`@Options`/`@Head`/`@Search`, `@Public()` miễn cả file thay vì cả class; 2 giả FAIL: bỏ qua decorator đứng trên `@Get`, không công nhận `@RequirePermissions` cấp class). Thêm 7 test pin. 33 suite / 241 test xanh, lint/format/build sạch. Status: review → done.

## Open Questions (sau khi implement, không chặn)

1. Source-guard chỉ quét `*.controller.ts` — nếu Phase sau thêm WebSocket gateway/GraphQL resolver, guard mù. Mở rộng khi có handler ngoài REST.
2. Luật #2 chặn actor sửa account "mạnh hơn" mình, kể cả khi actor chỉ đổi `displayName`. Chặt hơn cần thiết ở vài ca (an toàn hơn — chọn chặt, đúng chỉ dẫn project-context "khi phân vân chọn phương án chặt hơn"). Epic 8 xác nhận lại với Đại Ca khi dựng màn Phân quyền.
3. Chưa có route nào gọi `setForAccount` ⇒ luật chỉ được kiểm bằng unit test cho tới Epic 8 (chưa có e2e end-to-end qua HTTP).
4. **(Từ review — Epic 8 phải chốt)** `setForAccount` **không** kiểm actor có `permissions.manage` hay không; nó chỉ kiểm hai luật không-leo-thang. Hệ quả: một actor yếu (vd `KY_THUAT_VIEN`) vẫn có thể cấp **chính bộ quyền của mình** cho một account yếu hơn — luật #1/#2 đều không bắt. Hôm nay **bất khả thi** (chưa route nào gọi). Epic 8 **BẮT BUỘC** khai `@RequirePermissions(PERM.permissionsManage)` trên route Phân quyền (source-guard nay đảm bảo route đó không thể quên khai quyền). Cân nhắc thêm kiểm `permissions.manage` ngay trong service như phòng thủ theo lớp — **không** làm ở story này vì đổi contract domain mà Epic 8 sở hữu.
