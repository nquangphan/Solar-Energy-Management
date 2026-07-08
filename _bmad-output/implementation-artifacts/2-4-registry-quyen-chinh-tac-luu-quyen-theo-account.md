---
baseline_commit: 3b774609762aa98b64b91b15278d8491cc8d8989
---

# Story 2.4: Registry quyền chính tắc + lưu quyền theo account

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **lập trình viên nền tảng**,
I want **một registry quyền duy nhất do `accounts/domain` sở hữu và lưu bộ quyền trên từng Account**,
so that **ba bên (FE gating, BE guard, notification resolver) dùng chung một danh sách key quyền — không lệch chính tả, không literal rải rác**.

## Acceptance Criteria

1. **Given** yêu cầu registry, **When** khai báo quyền, **Then** tồn tại **một enum/registry quyền DUY NHẤT** do `accounts/domain` sở hữu, publish dưới dạng **artifact sinh tự động** (mirror pattern OpenAPI/design-system: SSOT → generator → drift-guard); **KHÔNG** permission string literal nào tồn tại **ngoài** registry (source-guard enforce) (AD-17).
2. **Given** mô hình RBAC per-account, **When** lưu quyền, **Then** nguồn chân lý là bộ quyền trên `Account` — entity `Account` liên kết bảng `AccountPermission` (join `account_id` × `permission`); **"xem tất cả đơn" (`orders.view_all`) và "đơn của mình" (`orders.view_own`) là HAI entry tường minh** trong registry (AD-8, AD-17, FR-18).
3. **Given** Super Admin, **When** khai báo quyền xem Audit, **Then** key `audit.read` chỉ được cấp cho **một** account Super Admin được chỉ định (qua seed/preset), **KHÔNG** cấp mặc định cho mọi Admin (AD-8, FR-20).

**Bằng chứng "done" (backend, kiểm được không cần FE / không cần Postgres cho phần hermetic):**
- File registry `src/accounts/domain/permission-registry.ts` export danh sách key chính tắc; unit test khẳng định: mọi key **duy nhất** (không trùng), chứa đủ 4 key mà FE stub Story 1.10 đang dùng (`orders.view_all`, `orders.view_own`, `audit.read`, `permissions.manage`), và giá trị string khớp **byte-for-byte** literal FE stub (chống drift — action item Epic 1).
- Artifact sinh tự động `openapi/permissions.json` (hoặc tương đương chốt ở Task 3) khớp **byte-for-byte** với registry; drift-guard fail nếu artifact commit ≠ code hoặc bị sửa tay.
- Source-guard mới: quét `src/` (đã strip comment) → **KHÔNG** file nào ngoài `permission-registry.ts` chứa permission string literal (vd `'audit.read'`, `'orders.view_all'`).
- Migration mới tạo bảng `account_permissions` (join) — **KHÔNG** tạo lại `accounts`/`sessions` (đã có từ 2.3). Prisma client regenerate, schema hợp lệ.
- Seed cấp cho account Super Admin (được chỉ định qua env) **toàn bộ** quyền gồm `audit.read`; account admin thường (nếu có) **KHÔNG** có `audit.read`. Unit test khẳng định preset Super Admin chứa `audit.read`, preset khác không.
- `AccountPermissionsService.listForAccount(accountId)` trả `Set<PermissionKey>` — API đọc mà Story 2.5 (`/me`) sẽ gọi. Test hermetic (mock Prisma) xanh.
- Lint/format/build sạch; OpenAPI drift-guard byte-for-byte xanh (nếu Task 3 chọn đường nhúng vào OpenAPI).

## Tasks / Subtasks

- [x] **Task 1 — Registry quyền chính tắc: SSOT enum trong `accounts/domain` (AC: 1, 2)**
  - [x] Tạo `src/accounts/domain/permission-registry.ts` — **nguồn chân lý DUY NHẤT** cho mọi permission key (AD-17). Khai một cấu trúc bất biến (vd `export const PERMISSIONS = [...] as const` + `export type PermissionKey = typeof PERMISSIONS[number]['key']`), mỗi entry gồm `key` (string chính tắc) + `label` (nhãn tiếng Việt cho màn Phân quyền Epic 8) + tuỳ chọn `group` (nhóm hiển thị). **Chỉ file này** được chứa literal quyền — mọi nơi khác import từ đây.
  - [x] **Khai đủ bộ key chính tắc** từ ma trận PRD FR-18 (§4.6) — enumerate **một lần** để tránh literal-drift về sau (đây là toàn bộ ý nghĩa của registry). Bắt buộc gồm (giữ **đúng** literal FE stub Story 1.10 đã dùng để 2.6 nối không phải đổi chuỗi):
    - `orders.view_all` — Xem tất cả đơn *(khớp `PERM.ordersViewAll` web + `AppPerm.ordersViewAll` mobile)*
    - `orders.view_own` — Chỉ xem đơn của mình *(entry tường minh thứ hai — AC-2; FE `orderScope` suy ra scope từ có/không `orders.view_all`, registry vẫn phải khai `orders.view_own` tường minh)*
    - `audit.read` — Xem Audit log (Super Admin) *(khớp `PERM.auditRead`)*
    - `permissions.manage` — Quản lý account & phân quyền *(khớp `PERM.permissionsManage`)*
    - Phần còn lại của ma trận FR-18 (chốt naming ở Dev Notes → "Bộ key chính tắc"): `quotes.create_edit`, `orders.confirm`, `discounts.apply`, `discounts.approve`, `construction.transition`, `delivery.confirm`, `payments.record`, `catalog.manage`, `contracts.generate`, `dashboard.finance_view`, `customers.manage`, `inventory.manage`, `invoices.manage`.
  - [x] Naming key: `snake_case` domain-prefixed (`domain.action`) — nhất quán với literal FE stub hiện có (`orders.view_all`). Ghi quy tắc naming vào CONVENTIONS.md (Task 8).
  - [x] **KHÔNG** build endpoint `/me`, guard, hay resolver notification ở đây (2.5 / 2.7). **KHÔNG** dựng UI ma trận phân quyền (Epic 8). Story này chỉ: registry + storage + artifact + seed super admin.

- [x] **Task 2 — Prisma: bảng `AccountPermission` + migration (KHÔNG tạo lại bảng cũ) (AC: 2)**
  - [x] `prisma/schema.prisma`: thêm model `AccountPermission` (join per-account — ERD `ACCOUNT ||--o{ ACCOUNT_PERMISSION`): `id String @id @default(uuid())`, `accountId String @map("account_id")` + relation `account Account @relation(fields:[accountId], references:[id], onDelete: Cascade)`, `permission String` (giá trị là một `PermissionKey` — **lưu String, validate ở tầng app** theo registry; mirror ERD "string status", tránh Postgres-enum migration churn — xem Open Question #2), `createdAt DateTime @default(now()) @map("created_at")`. `@@unique([accountId, permission])` (một quyền/account không trùng), `@@index([accountId])`, `@@map("account_permissions")`.
  - [x] `Account` model: **thêm** back-relation `permissions AccountPermission[]` — **CHỈ** thêm relation, **KHÔNG** sửa/tạo lại field xác thực đã có (2.3). Đọc kỹ comment đầu `schema.prisma` (giải thích 2.4 mở rộng cùng entity Account, không hai nhánh danh tính).
  - [x] Tạo migration mới `..._add_account_permissions` (chỉ `CREATE TABLE account_permissions` + FK/index) → `prisma/migrations/`. **KHÔNG** đụng bảng `accounts`/`sessions`. Không có Postgres cục bộ → sinh **offline** như 2.3: `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` (hoặc `--from-schema-datasource` khi có DB) rồi tạo thủ công thư mục migration + `migration.sql`. `npm run prisma:generate` để có typed client `AccountPermission`.
  - [x] Cập nhật comment `prisma.config.ts` nếu cần (dòng "Migration đầu tiên land cùng model đầu tiên (Story 2.4)" — thực tế migration đầu tiên đã land ở 2.3; sửa cho đúng lịch sử hoặc để yên nếu chỉ là comment lỗi thời — surgical, ghi rõ nếu sửa).

- [x] **Task 3 — Artifact registry sinh tự động + drift-guard (AC: 1)**
  - [x] Publish registry dưới dạng **artifact sinh tự động** để "ba bên tiêu thụ y hệt" (AD-17). **Đường mặc định (khuyến nghị — xem Open Question #1):** generator `scripts/generate-permissions.ts` đọc `permission-registry.ts` → ghi `openapi/permissions.json` (mảng `{ key, label, group? }` deterministic + newline cuối, mirror `serializeOpenApiDocument`). Thêm script `"permissions:gen"` vào `package.json`. Đây là artifact FE (web TS + Flutter) gen/consume ở Story 2.6.
  - [x] Drift-guard `test/permissions-drift.spec.ts` (mirror `openapi-drift.spec.ts`): build artifact từ registry in-memory rồi so **byte-for-byte** với `openapi/permissions.json` committed → fail nếu lệch (chống sửa tay / quên regen). Khẳng định thêm: artifact chứa `orders.view_all` + `orders.view_own` + `audit.read` + `permissions.manage`.
  - [x] *(Nếu Open Question #1 chốt đường "nhúng vào OpenAPI":* thay vì `permissions.json` riêng, khai enum `PermissionKey` tham chiếu qua DTO/`extraModels` để nó vào `components.schemas` của `openapi.json`; khi đó cập nhật `openapi-document.ts` + regen + `openapi-drift.spec.ts`. Chốt **một** đường, KHÔNG làm cả hai.*)

- [x] **Task 4 — `accounts/`: service đọc/ghi quyền per-account (AC: 2, 3)**
  - [x] `src/accounts/account-permissions.service.ts` (`@Injectable`, inject `PrismaService` — AD-1): 
    - `listForAccount(accountId): Promise<Set<PermissionKey>>` — đọc `account_permissions` theo `accountId`, trả Set các key. **Đây là API đọc mà Story 2.5 `/me` + guard sẽ gọi** (2.4 chỉ cung cấp, KHÔNG build `/me`).
    - `setForAccount(accountId, keys: PermissionKey[])` — thay thế bộ quyền (dùng ở seed Task 6; Epic 8 UI sẽ tái dùng). Validate mọi key ∈ registry trước khi ghi (ném `AppException(VALIDATION_ERROR/…)` nếu key lạ — không cho literal ngoài registry lọt vào DB). Ghi transaction (xoá cũ + tạo mới) để atomic.
  - [x] Đăng ký service trong `AccountsModule`; **export** để `auth/` (2.5) import được. **KHÔNG** để module khác `new PrismaClient()` — luôn qua `PrismaService` (source-guard `no-manual-prisma-client` enforce).
  - [x] **KHÔNG** thêm controller/route ở story này (route `/me` = 2.5). Chỉ service + registry + storage.

- [x] **Task 5 — Role preset (Phase 1: hằng số code, KHÔNG bảng DB) (AC: 3)**
  - [x] `src/accounts/domain/role-presets.ts`: khai map `RolePreset → PermissionKey[]` (vd `SUPER_ADMIN`, `ADMIN`, `QUAN_LY`, `KE_TOAN`, `THO_KS`, `THI_CONG`, `KHO_GIAO` theo cột ma trận FR-18). **Chỉ `SUPER_ADMIN` chứa `audit.read`** (AC-3). Preset chỉ **nạp giá trị lúc tạo/seed** ("áp preset = nạp giá trị, không ràng buộc sau" — AD-8, FR-17); import key từ `permission-registry.ts` (KHÔNG literal).
  - [x] **Quyết định phạm vi (Open Question #3):** Phase 1 preset = **hằng số code**, KHÔNG tạo bảng `Role`/`RolePermission` (ERD có nhưng YAGNI cho ~20 user; "preset không ràng buộc sau" ⇒ không cần entity). Form tạo account + màn quản lý preset là **Epic 8** (Story 8.2/8.3/8.4). Nếu chủ dự án muốn preset chỉnh runtime → mới cần bảng (defer).
  - [x] Unit test: `SUPER_ADMIN` preset ⊇ `{audit.read, permissions.manage}`; các preset khác **không** chứa `audit.read`; mọi key trong mọi preset ∈ registry.

- [x] **Task 6 — Seed: cấp quyền Super Admin cho account chỉ định (AC: 3)**
  - [x] Mở rộng `prisma/seed.ts`: sau khi upsert account admin (2.3), nếu account đó là Super Admin được chỉ định (đánh dấu qua env, vd `SEED_ADMIN_IS_SUPER_ADMIN=true` hoặc `SEED_SUPER_ADMIN_EMAIL` khớp), gọi `setForAccount(account.id, ROLE_PRESETS.SUPER_ADMIN)` (hoặc ghi trực tiếp `account_permissions` trong seed — seed là CLI, được phép, xem note seed 2.3). Đảm bảo **chỉ một** account có `audit.read` (AC-3).
  - [x] `.env.example`: thêm biến chỉ định Super Admin (vd `SEED_ADMIN_IS_SUPER_ADMIN=true`) + comment. **KHÔNG** commit secret thật.
  - [x] Seed **idempotent**: chạy lại không nhân đôi quyền (dùng `setForAccount` thay-thế, hoặc upsert theo `@@unique(accountId, permission)`).

- [x] **Task 7 — Test (AC: 1, 2, 3)**
  - [x] **Unit registry** `test/permission-registry.spec.ts`: mọi `key` duy nhất (Set.size === length); chứa đủ 4 key FE-stub + literal **khớp byte-for-byte** (`orders.view_all`/`orders.view_own`/`audit.read`/`permissions.manage`); mọi key theo pattern `snake_case` domain-prefixed; `PermissionKey` type suy ra đúng.
  - [x] **Source-guard** `test/no-permission-literal-outside-registry.spec.ts` (mirror `no-manual-prisma-client.spec.ts` + `stripToCode`): quét `src/` (strip comment), regex bắt permission literal (vd `/['"][a-z_]+\.[a-z_]+['"]/` giới hạn theo danh sách key registry, hoặc match chính các key) → **offenders = []** ngoại trừ `permission-registry.ts`. Ghi rõ regex bắt đúng để tránh false-positive (vd route path `/auth/login` KHÔNG được tính — dùng danh sách key registry làm nguồn so, không match mọi chuỗi có dấu chấm).
  - [x] **Unit `AccountPermissionsService`** (hermetic, mock `PrismaService`): `listForAccount` map rows → Set đúng; `setForAccount` validate key lạ → ném lỗi, không ghi DB; `setForAccount` transaction xoá-cũ-tạo-mới.
  - [x] **Unit role-presets** (Task 5): đã nêu.
  - [x] **Drift-guard** artifact (Task 3): byte-for-byte.
  - [x] **Chiến lược DB:** phần chạm bảng thật (`account_permissions` end-to-end) chạy khi có Postgres; **hermetic (mock Prisma) là bắt buộc + luôn chạy được** — đừng để suite fail vì thiếu DB (mirror chiến lược 2.3). Ghi rõ trong Dev Notes.

- [x] **Task 8 — Cập nhật CONVENTIONS.md + README + OpenAPI regen (nếu Task 3 chọn đường OpenAPI) (AC: 1)**
  - [x] `CONVENTIONS.md`: thêm mục **"Permission registry — SSOT + generated artifact (AD-17)"**: quy tắc naming key (`domain.action` snake_case), luật "chỉ `permission-registry.ts` chứa literal, mọi nơi import", "quyền lưu per-account ở `account_permissions` (String validate theo registry)", "preset = hằng số code, nạp lúc tạo, không ràng buộc sau (AD-8)", "`audit.read` chỉ Super Admin (AC-3)", "artifact sinh tự động — CẤM sửa tay, regen bằng `npm run permissions:gen`".
  - [x] `README.md`: bước regen artifact + (nếu cần) biến seed Super Admin.
  - [x] Nếu Task 3 nhúng vào OpenAPI: `npm run openapi:gen` + cập nhật `openapi-drift.spec.ts`.

## Dev Notes

### Ranh giới phạm vi (đọc trước — chống scope-creep)

Story này **CHỈ** dựng **registry quyền chính tắc (SSOT + artifact sinh tự động) + mô hình lưu quyền per-account + seed Super Admin**. Cụ thể:

- **Trong phạm vi:** `permission-registry.ts` (SSOT enum, chủ sở hữu = `accounts/domain`); bảng `AccountPermission` + migration (KHÔNG tạo lại bảng 2.3); artifact sinh tự động (`openapi/permissions.json` hoặc nhúng OpenAPI — chốt Open Question #1) + drift-guard; `AccountPermissionsService` (`listForAccount`/`setForAccount`); role-preset **hằng số code** (chỉ `SUPER_ADMIN` có `audit.read`); mở rộng seed cấp quyền Super Admin; source-guard "không literal ngoài registry"; test; CONVENTIONS/README.
- **Ngoài phạm vi (thuộc story/epic khác — ĐỪNG làm ở đây):**
  - **Endpoint `/me` + guard quyền server-side mỗi request** → **Story 2.5**. 2.4 **cung cấp** `AccountPermissionsService.listForAccount` (data), 2.5 **build** `/me` (trả effective set) + `JwtAuthGuard` + `@RequirePermissions` decorator/guard enforce. 2.4 **KHÔNG** tạo route/guard/decorator.
  - **Nối UI gating vào `/me`** (swap FE stub `PERM`/`AppPerm` sang gen từ artifact) → **Story 2.6**. 2.4 giữ literal registry **khớp** FE stub để 2.6 chỉ đổi nguồn, không đổi chuỗi.
  - **Notification resolver theo quyền** (bên tiêu thụ thứ ba của AD-17) → **AD-15 / Epic 9**. 2.4 chỉ khai registry; resolver consume sau.
  - **UI ma trận phân quyền / form tạo-sửa-vô hiệu account / áp preset runtime** → **Epic 8** (Story 8.2/8.3/8.4). 2.4 KHÔNG dựng màn nào; preset là hằng số code.
  - **Bảng `Role`/`RolePermission` DB** → defer (Open Question #3). Phase 1 preset = code constant (AD-8 "preset không ràng buộc sau").
  - **Audit log module** (`audit/`, ghi qua EventBus) → **Story 2.7 / Epic 8**. 2.4 chỉ khai **key** `audit.read`, KHÔNG build audit.
  - **EventBus / publish domain event** → **Story 2.7**. Cấp/đổi quyền ở 2.4 (seed) KHÔNG publish event.

### Kiến trúc & bất biến bắt buộc (KHÔNG vi phạm)

- **AD-17 — Registry quyền chính tắc, một nguồn ba bên tiêu thụ:** MỘT enum/registry DUY NHẤT do `accounts/domain` sở hữu, publish artifact sinh tự động; **cấm** permission literal ngoài registry (source-guard enforce). "Xem tất cả đơn" + "đơn của mình" là **hai entry tường minh**. [Source: ARCHITECTURE-SPINE.md#AD-17]
- **AD-8 — RBAC per-account:** nguồn chân lý = bộ quyền trên từng `Account` (bảng `account_permissions`). Role = **preset áp lúc tạo** (nạp giá trị, không ràng buộc sau) → Phase 1 là hằng số code. Quyền xem Audit chỉ cho **một** account Super Admin chỉ định. [Source: ARCHITECTURE-SPINE.md#AD-8, PRD#FR-16/17/18]
- **AD-4 — Backend enforce mọi request; client gating chỉ UX:** 2.4 đặt **dữ liệu** quyền; **enforcement guard là 2.5**. Registry + storage KHÔNG phải bảo mật cho tới khi 2.5 gắn guard. FE ẩn/hiện theo artifact chỉ là UX. [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-1 — Chỉ `PrismaService` chạm DB:** `AccountPermissionsService` inject `PrismaService`; **cấm** `new PrismaClient()` trong `src/` (seed CLI được phép — source-guard chỉ quét `src/`). [Source: ARCHITECTURE-SPINE.md#AD-1]
- **AD-12 — OpenAPI/artifact sinh-từ-code:** artifact quyền là **generated**, cấm sửa tay; regen bằng script; drift-guard byte-for-byte. Cùng triết lý "code là chân lý" như OpenAPI + design-system generator. [Source: ARCHITECTURE-SPINE.md#AD-12, project-context.md#design-system generator]
- **Layered:** `permission-registry.ts` + `role-presets.ts` = **Domain** (quy tắc thuần, không phụ thuộc Infra); `AccountPermissionsService` = Application/Infra (Prisma). Domain KHÔNG import Prisma. [Source: ARCHITECTURE-SPINE.md#Design Paradigm]

### Đọc file bị SỬA / mở rộng (bắt buộc — trước khi code)

Giữ hành vi hiện có (2.1/2.2/2.3); 2.4 **UPDATE**:

- `backend/prisma/schema.prisma` — có `Account` (base 2.3) + `Session`. **2.4 thêm:** relation `permissions AccountPermission[]` trên `Account` + model `AccountPermission`. **KHÔNG** sửa field xác thực / tạo lại bảng. Comment file đã báo trước "2.4 mở rộng cùng entity" — làm đúng vậy.
- `backend/prisma/seed.ts` — upsert account admin (argon2 hash, đọc env). **2.4 thêm:** cấp quyền Super Admin (preset) cho account chỉ định, idempotent.
- `backend/prisma.config.ts` — comment "migration đầu tiên land cùng model đầu tiên (Story 2.4)" đã **lỗi thời** (migration đầu land ở 2.3). Sửa comment cho đúng hoặc để yên (surgical — ghi rõ nếu sửa).
- `backend/src/accounts/accounts.module.ts` + `accounts.service.ts` — hiện read-only cho auth (`findByEmail`/`findById`). **2.4 thêm:** `AccountPermissionsService` + export; giữ nguyên `AccountsService`.
- `backend/.env.example` — có biến JWT/seed. **2.4 thêm:** biến chỉ định Super Admin seed.
- `backend/package.json` — **2.4 thêm:** script `permissions:gen` (nếu chọn artifact riêng).
- `backend/CONVENTIONS.md`, `backend/README.md` — thêm mục permission registry + bước regen.
- *(Nếu nhúng OpenAPI:)* `backend/src/openapi/openapi-document.ts` + `backend/openapi/openapi.json` (regen) + `backend/test/openapi-drift.spec.ts`.

### Tái dùng (scout-before-code — DRY)

- **FE stub Story 1.10 đã khai literal quyền** — `web/src/design-system/gating/permissions.ts` (`PERM = { ordersViewAll:'orders.view_all', auditRead:'audit.read', permissionsManage:'permissions.manage' }`) + `mobile/lib/design_system/gating/app_permissions.dart` (`AppPerm` cùng literal). **Registry backend PHẢI dùng đúng các literal này** để 2.6 chỉ đổi *nguồn* (stub → gen artifact), không đổi *chuỗi*. Đây là **action item Epic 1 retro**: "Xác minh contract PermissionKey/filterNav (1.10) khớp registry enum (2.4) trước khi code 2.6". [Source: sprint-status.yaml#action_items, web/…/permissions.ts, mobile/…/app_permissions.dart]
- **Ma trận quyền × preset** đã có sẵn ở **PRD FR-18** (§4.6) — dùng làm nguồn enumerate key + role-preset, KHÔNG tự bịa. [Source: prd.md#FR-18]
- **`stripToCode`** (`test/util/strip-to-code.ts`) + mẫu source-guard `test/no-manual-prisma-client.spec.ts` / `test/naming-convention.spec.ts` — **tái dùng** cho source-guard "không literal ngoài registry". KHÔNG viết lại parser.
- **Drift-guard** `test/openapi-drift.spec.ts` + `serializeOpenApiDocument` (deterministic JSON + newline cuối) — mẫu cho drift-guard artifact quyền.
- **`PrismaService`** + mẫu override no-op (`scripts/openapi-app-context.ts`, `test/health.spec.ts`) — cho test hermetic không-DB.
- **`AppException` + `ErrorCode`** (`common/errors/`) — nếu `setForAccount` cần ném lỗi key lạ, ném `AppException` (KHÔNG cơ chế lỗi mới); dùng code phù hợp (`VALIDATION_ERROR` hoặc `INTERNAL` — chốt theo error-code hiện có).
- **Không tạo trùng:** chưa có `accounts/domain/`, chưa có `AccountPermission`, chưa có registry nào (xác nhận: `src/accounts/` chỉ có `accounts.module.ts`+`accounts.service.ts`; `schema.prisma` chỉ `Account`+`Session`). Code MỚI, không đè.

### Bộ key chính tắc (chốt naming — nguồn: PRD FR-18 §4.6)

Registry khai **một lần** toàn bộ key (enumerate trước để tránh literal-drift — mục đích của AD-17). Naming `domain.action` snake_case. Ánh xạ ma trận FR-18 → key (giữ 4 key FE-stub **nguyên văn**):

| Quyền (PRD FR-18) | `key` chính tắc |
|---|---|
| Xem tất cả đơn | `orders.view_all` ✱ |
| Chỉ xem đơn của mình | `orders.view_own` ✱ (entry tường minh #2 — AC-2) |
| Xem Audit log (Super Admin) | `audit.read` ✱ |
| Quản lý account & phân quyền | `permissions.manage` ✱ |
| Tạo/sửa báo giá | `quotes.create_edit` |
| Chốt đơn | `orders.confirm` |
| Áp chiết khấu | `discounts.apply` |
| Duyệt chiết khấu | `discounts.approve` |
| Chuyển bước thi công | `construction.transition` |
| Xác nhận giao hàng | `delivery.confirm` |
| Ghi nhận thanh toán | `payments.record` |
| Sửa danh mục & giá | `catalog.manage` |
| Sinh hợp đồng | `contracts.generate` |
| Xem dashboard tài chính | `dashboard.finance_view` |
| Quản lý khách hàng | `customers.manage` |
| Nhập/Xuất kho | `inventory.manage` |
| Tạo/xuất hoá đơn | `invoices.manage` |

✱ = literal đã dùng ở FE stub 1.10 (khớp byte-for-byte, bắt buộc). Các key còn lại có thể tinh chỉnh naming lúc implement **miễn** giữ `domain.action` snake_case + ghi vào CONVENTIONS; điểm cốt lõi: **định nghĩa một lần, một chỗ**. `orders.view_all`/`orders.view_own` loại trừ nhau về mặt ngữ nghĩa nhưng đều là **entry tường minh** trong registry (FE `orderScope` suy scope từ có/không `orders.view_all`).

### Thiết kế lưu trữ & artifact (chốt để dev nhất quán)

- **Lưu quyền:** bảng join `account_permissions (account_id, permission)`, `@@unique([accountId, permission])`. `permission` kiểu **String** (validate theo registry ở tầng app), **không** Postgres-enum — nhất quán ERD "string status", tránh migration nặng mỗi lần thêm key (Open Question #2). Effective set của account = tập hợp row `permission`.
- **Artifact sinh tự động (khuyến nghị):** generator đọc `permission-registry.ts` → `openapi/permissions.json` deterministic; drift-guard byte-for-byte. FE (2.6) gen key từ artifact này. Lý do tách khỏi `openapi.json`: registry chưa có endpoint tham chiếu ở 2.4 (`/me` = 2.5) → enum khó vào `components.schemas` tự nhiên; artifact riêng đơn giản + kiểm được ngay (Open Question #1). Khi 2.5 build `/me`, permission set có thể **cũng** xuất hiện trong OpenAPI qua DTO của `/me` — hai artifact bổ sung, không mâu thuẫn (cùng SSOT registry).
- **Preset:** hằng số code `role-presets.ts` (Role → key[]), import key từ registry. `SUPER_ADMIN` = toàn bộ + `audit.read`; preset khác không `audit.read`. Áp lúc seed/tạo account (Epic 8), không ràng buộc runtime (AD-8).
- **Super Admin (AC-3):** chỉ account chỉ định (env seed) nhận `audit.read`. Test khẳng định bất biến "đúng một nguồn có audit.read qua preset SUPER_ADMIN".

### Chiến lược test (DB vs hermetic — mirror 2.3)

- **Bắt buộc + luôn chạy được (hermetic, không Postgres):** unit registry (key duy nhất/đủ/naming), unit role-preset, unit `AccountPermissionsService` (mock `PrismaService`: `listForAccount` map đúng, `setForAccount` validate + transaction), source-guard "không literal ngoài registry", drift-guard artifact.
- **Integration cần Postgres** (ghi/đọc `account_permissions` thật, seed super admin end-to-end): chạy khi có DB; **đừng để suite fail vì thiếu DB** — tách/skip có điều kiện, ghi rõ. [Source: project-context.md#Testing, 2-3-…md#Chiến lược test]

### Project Structure Notes

Cây mục tiêu — 2.4 tạo phần **in đậm**:

- `backend/src/accounts/domain/` → **`permission-registry.ts`** (SSOT enum), **`role-presets.ts`** (preset hằng số).
- `backend/src/accounts/` → **`account-permissions.service.ts`**; UPDATE `accounts.module.ts` (provide+export service), giữ `accounts.service.ts`.
- `backend/prisma/` → UPDATE `schema.prisma` (model `AccountPermission` + relation), **`migrations/*_add_account_permissions/`**, UPDATE `seed.ts` (cấp quyền super admin).
- `backend/scripts/` → **`generate-permissions.ts`** (nếu artifact riêng — Open Question #1).
- `backend/openapi/` → **`permissions.json`** (artifact sinh tự động) *(hoặc regen `openapi.json` nếu nhúng)*.
- UPDATE: `package.json` (script `permissions:gen`), `.env.example` (biến super admin), `CONVENTIONS.md`, `README.md`.
- Test MỚI: `test/permission-registry.spec.ts`, `test/role-presets.spec.ts`, `test/account-permissions.service.spec.ts`, `test/no-permission-literal-outside-registry.spec.ts`, `test/permissions-drift.spec.ts`.
- **Biến thể có chủ đích:** `Account` mở rộng ở 2.4 (thêm relation quyền) — **cùng entity** 2.3 tạo, KHÔNG bảng danh tính thứ hai (AD-8). Migration 2.4 chỉ thêm `account_permissions`. KHÔNG tạo `guards/`/`/me` (2.5), `audit/` (2.7/E8), bảng `Role` (defer).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] — 3 AC verbatim (registry duy nhất sinh tự động, không literal ngoài registry; nguồn chân lý = quyền trên Account + `AccountPermission`, hai entry tường minh view_all/view_own; `audit.read` chỉ Super Admin).
- [Source: ARCHITECTURE-SPINE.md#AD-17] — một registry, ba bên tiêu thụ (FE gating / BE guard / noti resolver); cấm literal ngoài registry; hai entry tường minh.
- [Source: ARCHITECTURE-SPINE.md#AD-8] — RBAC per-account; role = preset nạp lúc tạo, không ràng buộc sau; audit chỉ một Super Admin. ERD `ACCOUNT ||--o{ ACCOUNT_PERMISSION`, `ROLE`/`ROLE_PERMISSION` (defer bảng — Phase 1 preset code).
- [Source: ARCHITECTURE-SPINE.md#AD-4] — backend enforce mỗi request (guard = 2.5); client gating chỉ UX.
- [Source: ARCHITECTURE-SPINE.md#AD-12, #AD-1] — artifact sinh-từ-code cấm sửa tay; chỉ `PrismaService` chạm DB.
- [Source: prd.md#FR-16/17/18 §4.6] — ma trận quyền × preset (nguồn enumerate key + role-preset); "xem tất cả đơn vs đơn của mình là một Quyền"; sửa quyền một account không ảnh hưởng account khác; audit chỉ Super Admin (FR-20).
- [Source: web/src/design-system/gating/permissions.ts + mobile/lib/design_system/gating/app_permissions.dart] — literal FE stub (`orders.view_all`/`audit.read`/`permissions.manage`) registry PHẢI khớp; `orderScope`/`filterNav` key-agnostic, chỉ đổi nguồn ở 2.6.
- [Source: _bmad-output/implementation-artifacts/2-3-dang-nhap-jwt-access-refresh.md] — `Account` base + `Session` (2.4 mở rộng cùng entity, KHÔNG tạo lại bảng); migration sinh offline không DB; seed đọc env; source-guard `no-manual-prisma-client` chỉ quét `src/` (seed CLI được phép); chiến lược test hermetic-bắt-buộc + integration-khi-có-DB.
- [Source: backend/CONVENTIONS.md] — naming (entity/bảng/file/route), `@@map`/`@map`, OpenAPI sinh-từ-code cấm sửa tay, error envelope.
- [Source: sprint-status.yaml#action_items] — Epic 1 retro: xác minh contract PermissionKey/filterNav (1.10) khớp registry enum (2.4) trước khi code 2.6.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (BMAD dev-story workflow)

### Debug Log References

- **Prisma migrate diff offline:** flag `--to-schema-datamodel` bị Prisma 7 bỏ (đổi thành `--to-schema`); `--from-migrations` cần `datasource.shadowDatabaseUrl` (không có Postgres cục bộ). Giải: `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` để lấy DDL chuẩn của bảng mới, rồi tách delta `account_permissions` viết tay vào migration (giữ `accounts`/`sessions` nguyên).
- **Source-guard literal:** `stripToCode` (tái dùng từ 2.1) bỏ **cả string literal** — sai công cụ cho guard SOI string literal (guard sẽ luôn xanh giả). Thêm util mới `test/util/strip-comments.ts` (bỏ CHỈ comment, GIỮ string) cho guard `no-permission-literal-outside-registry`. Đã có test sanity chống "guard chết".

### Completion Notes List

Đã implement toàn bộ 8 task; 85/85 test xanh (15 suite), lint + format + typecheck + `nest build` sạch.

- **Chốt Open Question (theo mặc định YOLO):** (1) artifact **file riêng** `openapi/permissions.json` + generator `permissions:gen` + drift-guard — **KHÔNG** nhúng OpenAPI; (2) `permission` kiểu **String** validate app-layer; (3) preset = **hằng số code** (`role-presets.ts`), không bảng Role DB.
- **Subtask conditional N/A (không lừa dối):** Task 3 subtask "nhúng enum vào OpenAPI" và Task 8 subtask "openapi:gen regen nếu chọn đường OpenAPI" là **đường thay thế KHÔNG chọn** — không thực hiện (đã chọn đường file riêng). Đánh dấu [x] vì đó là nhánh "hoặc/hoặc" đã quyết, không phải việc bỏ sót.
- **SSOT + guard:** `permission-registry.ts` là nơi DUY NHẤT chứa literal quyền; source-guard `no-permission-literal-outside-registry.spec.ts` (dùng `strip-comments`, so theo chính 17 key registry → không false-positive route path) xác nhận `offenders = []`. 4 key FE-stub khớp byte-for-byte.
- **AC-2:** `orders.view_all` + `orders.view_own` là hai entry tường minh; bảng `account_permissions` (`@@unique([accountId, permission])`) là nguồn chân lý RBAC. `AccountPermissionsService.listForAccount` trả `Set<PermissionKey>` (API cho 2.5 `/me`); `setForAccount` validate key ∈ registry + transaction atomic.
- **AC-3:** chỉ `ROLE_PRESETS.SUPER_ADMIN` chứa `audit.read` (test khẳng định đúng một preset); seed cấp preset SUPER_ADMIN khi `SEED_ADMIN_IS_SUPER_ADMIN=true`, idempotent (xoá-cũ-tạo-mới).
- **Role preset matrix:** ánh xạ chính xác từ PRD FR-18 §4.6 (6 cột) + SUPER_ADMIN = Admin + `audit.read`. Role không có `orders.view_all` được cấp `orders.view_own` (quy ước AC-2).
- **Chiến lược test:** toàn bộ test 2.4 là **hermetic** (không cần Postgres) — registry/preset unit, service mock Prisma, source-guard, drift-guard. Phần chạm `account_permissions` thật (seed end-to-end) chạy khi có DB (mirror 2.3).
- **Surgical:** `prisma.config.ts` comment lỗi thời sửa cho đúng (migration đầu land ở 2.3). Không đụng field xác thực/bảng cũ.

### File List

**Tạo mới:**
- `backend/src/accounts/domain/permission-registry.ts`
- `backend/src/accounts/domain/role-presets.ts`
- `backend/src/accounts/account-permissions.service.ts`
- `backend/src/accounts/permissions-artifact.ts`
- `backend/scripts/generate-permissions.ts`
- `backend/openapi/permissions.json` (artifact sinh tự động)
- `backend/prisma/migrations/20260708010000_add_account_permissions/migration.sql`
- `backend/test/permission-registry.spec.ts`
- `backend/test/role-presets.spec.ts`
- `backend/test/account-permissions.service.spec.ts`
- `backend/test/no-permission-literal-outside-registry.spec.ts`
- `backend/test/permissions-drift.spec.ts`
- `backend/test/util/strip-comments.ts`

**Sửa:**
- `backend/prisma/schema.prisma` (thêm model `AccountPermission` + relation `permissions` trên `Account`)
- `backend/prisma/seed.ts` (cấp preset SUPER_ADMIN idempotent khi `SEED_ADMIN_IS_SUPER_ADMIN=true`)
- `backend/prisma.config.ts` (sửa comment lỗi thời về migration đầu)
- `backend/src/accounts/accounts.module.ts` (provide + export `AccountPermissionsService`)
- `backend/package.json` (script `permissions:gen`)
- `backend/.env.example` (biến `SEED_ADMIN_IS_SUPER_ADMIN`)
- `backend/CONVENTIONS.md` (mục "Permission registry — SSOT + generated artifact")
- `backend/README.md` (lệnh `permissions:gen` + mục quyền per-account)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-4 → in-progress → review)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-08 | Tạo story context 2.4 (Registry quyền chính tắc + lưu quyền theo account): phạm vi = SSOT `permission-registry.ts` (chủ sở hữu `accounts/domain`) + bảng `AccountPermission` (migration thêm, KHÔNG tạo lại bảng 2.3) + artifact sinh tự động + drift-guard + `AccountPermissionsService` + role-preset hằng số code (chỉ SUPER_ADMIN có `audit.read`) + seed super admin + source-guard "không literal ngoài registry". Chốt: giữ literal registry **khớp byte-for-byte** FE stub 1.10 (action item Epic 1) — `orders.view_all`/`orders.view_own`/`audit.read`/`permissions.manage`. `/me`+guard = 2.5; nối FE gating = 2.6; noti resolver = E9; UI phân quyền + bảng Role = E8/defer. 3 Open Question: (1) artifact riêng `permissions.json` vs nhúng OpenAPI; (2) `permission` String vs Postgres-enum; (3) preset hằng-số-code vs bảng Role DB. |
| 2026-07-08 | Implement 2.4: registry 17 key (4 key khớp FE stub byte-for-byte) + `role-presets.ts` (ánh xạ FR-18, chỉ SUPER_ADMIN có `audit.read`) + model/migration `account_permissions` (sinh offline, không đụng bảng 2.3) + `AccountPermissionsService` (list/set, validate registry, transaction atomic) + artifact `permissions.json` + generator `permissions:gen` + seed super admin idempotent. Source-guard mới dùng `strip-comments` (giữ string) thay `stripToCode`. Chốt Open Question theo mặc định: file riêng / String / preset code. 85/85 test xanh, lint+build sạch. Status → review. |

## Open Questions

1. **Artifact sinh tự động: file riêng `openapi/permissions.json` hay nhúng enum vào `openapi.json`?** Đề xuất **file riêng** (generator `permissions:gen` + drift-guard) vì `/me` (2.5) chưa có ở 2.4 nên enum khó vào `components.schemas` tự nhiên; file riêng đơn giản, kiểm được ngay, FE 2.6 gen từ đó. Đường nhúng OpenAPI gọn hơn về "một pipeline" nhưng cần DTO tham chiếu (đợi 2.5). **Chốt một đường, KHÔNG làm cả hai.** Mặc định YOLO: file riêng.
2. **`AccountPermission.permission`: String (validate app-layer) hay Postgres-enum (Prisma enum)?** Đề xuất **String** — nhất quán ERD "string status", registry evolve không cần migration enum mỗi lần thêm key; validate theo registry ở `setForAccount`. Prisma-enum chặt hơn ở DB nhưng churn migration + phải sync enum↔registry. Mặc định: String + app-validate.
3. **Role preset: hằng số code hay bảng `Role`/`RolePermission` DB?** ERD có `ROLE`/`ROLE_PERMISSION` nhưng AD-8 "preset nạp lúc tạo, không ràng buộc sau" ⇒ Phase 1 **hằng số code** đủ (YAGNI, ~20 user). Cần bảng chỉ khi muốn chỉnh preset runtime qua UI (Epic 8 có thể vẫn dùng hằng số + form tick từng quyền). Mặc định: hằng số code, defer bảng Role.
4. **Naming các key ngoài 4 key FE-stub** (vd `quotes.create_edit` vs `orders.create_edit`): đề xuất theo domain module (`orders/`, `discounts/`, `payments/`…) + action snake_case; chốt lúc implement, ghi CONVENTIONS. Không ảnh hưởng 2.6 (chỉ 4 key ✱ đang được FE dùng); các key còn lại consume từ Epic 3+.
