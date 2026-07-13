---
baseline_commit: e4efc77
---

# Story 3.5: Danh mục Nguồn khách — CRUD + Seed + màn Cấu hình (gate `settings.manage`)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền cấu hình hệ thống** (`settings.manage`),
I want **quản lý danh mục Nguồn khách (bảng `CustomerSource`): thêm / sửa / tắt / bật lại, có ghi vết Audit**,
so that **mỗi khách ghi rõ nguồn nó đến, và danh mục sửa được khi công ty mở kênh mới mà không cần dev.**

**Phạm vi story này = 4 endpoint ghi (`POST`/`PATCH`/`DELETE`/`reactivate`) + 1 màn cấu hình WEB.**

🔴 **Bảng, migration, seed 5 dòng, và `GET /customer-sources` ĐÃ TỒN TẠI từ Story 3.3.** Story này **KHÔNG** tạo lại chúng.
Nếu thấy mình đang viết `model CustomerSource` vào `schema.prisma`, sinh migration mới, hay viết lại `seedCustomerSources()` ⇒ **dừng lại, đọc lại "Đã có sẵn — CẤM viết lại"**.

## Bối cảnh: story này chỉ còn một nửa việc

Story 3.3 đã ship (commit `b35e036`) toàn bộ phần đọc:

| Thứ đã có | Ở đâu | Story này làm gì với nó |
|---|---|---|
| `model CustomerSource` (id, name @unique, description?, active, sortOrder, isOther, timestamps) | `backend/prisma/schema.prisma:181-201` | **Không đụng.** Không migration mới. |
| Migration `20260713020000_add_customers_and_customer_sources` | `backend/prisma/migrations/` | **Không đụng.** |
| Seed 5 dòng (Facebook 1 · Zalo 2 · Fanpage 3 · Đại lý 4 · **Khác 99 `isOther:true`**), idempotent `upsert({where:{name}})` | `backend/prisma/seed.ts:30-85` | **Verify, không viết lại.** (AC-0) |
| `GET /customer-sources?includeInactive=` gate `PERM.customersManage` | `backend/src/customers/customer-sources.controller.ts` | **Giữ nguyên gate.** Xem Quyết định #2. |
| `CustomerSourcesService.findAll()` | `customer-sources.service.ts` | Mở rộng: + `EventBus`, + 4 method ghi. |
| `CustomerSourceResponseDto` | `dto/customer-source-response.dto.ts` | Tái dùng nguyên. |
| `PERM.settingsManage = 'settings.manage'` trong registry, đã vào preset `ADMIN`(→`SUPER_ADMIN`) | `accounts/domain/permission-registry.ts:61,116` · `role-presets.ts:47` | **Không đổi registry, KHÔNG chạy `permissions:gen`.** |

⇒ Việc còn lại: **4 endpoint ghi + gate `settings.manage` + domain event + màn cấu hình web + guard.**

## Acceptance Criteria

**AC-0 — Seed: verify, KHÔNG viết lại (FR-35, epics §Story 3.5).**
Given `backend/prisma/seed.ts` đã seed 5 dòng,
When bắt đầu story,
Then **đọc và xác nhận** 5 dòng đúng như AC gốc (`name` + `description` một câu phân biệt + `active` + `sortOrder` + `isOther`), **đúng một** dòng `isOther=true` (Khác).
- Sai lệch ⇒ sửa **seed data**, không sửa schema.
- **CẤM** tạo file seed thứ hai, **CẤM** seed lại từ service.

**AC-1 — `POST /customer-sources` — thêm nguồn (FR-35, AD-17).**
Given người dùng có `settings.manage`,
When `POST /customer-sources { name, description?, sortOrder? }`,
Then tạo dòng mới `active: true`, `isOther: false` **luôn luôn** ⇒ `201 CustomerSourceResponseDto`
- 🔴 **`isOther` KHÔNG có trong DTO ghi** (cả create lẫn update). Cờ này chỉ do **seed** đặt. Xem Quyết định #1.
- `name` trùng (đã `@unique` ở DB) ⇒ **409 `CONFLICT`** + `fieldErrors: [{ field: 'name', … }]` — qua `isUniqueViolation()` **đã có sẵn** (`common/errors/prisma-unique-violation.ts`), khuôn `ProductsService.translateWriteError`.
- `sortOrder` **vắng** ⇒ backend tự tính `max(sortOrder) + 1` (cột NOT NULL, không có default — vắng mà truyền thẳng xuống Prisma là **500**).
- `name` rỗng/thiếu ⇒ **400 `VALIDATION_ERROR`**.
**And** publish `CustomerSourceCreated` ⇒ Audit ghi (AD-18).

**AC-2 — `PATCH /customer-sources/:id` — sửa tên / mô tả / thứ tự (FR-35, AD-18).**
Given một nguồn tồn tại,
When `PATCH { name?, description?, sortOrder? }`,
Then cập nhật **chỉ field có mặt** ⇒ `200 CustomerSourceResponseDto`
- 🔴 **Dòng `isOther` SỬA TÊN ĐƯỢC** — đây là điểm mấu chốt của cả thiết kế: backend nhận ra "Khác" bằng **cờ**, không bằng so chuỗi, nên đổi tên nó **không** làm hỏng luật `sourceNote` bắt buộc của Story 3.3. (Mockup giữ nút Sửa sống trên dòng Khác — cố ý.)
- **CẤM** `active` trong body PATCH (tắt/bật đi đường riêng — AC-3/AC-4). **CẤM** `isOther`.
- `id` không tồn tại ⇒ **404 `NOT_FOUND`** (khuôn `findOrThrow` của `CustomersService`).
- `name` trùng dòng khác ⇒ **409**.
- ⚠️ `description` là cột **nullable** ⇒ dùng `@IsOptional()` (cho phép `null` để xoá mô tả). `name`/`sortOrder` là NOT NULL ⇒ **`@IsOptionalNotNull()`** (`catalog/dto/is-optional-not-null.decorator.ts`). **CẤM `PartialType`** — bài học HIGH review 3.1.
**And** publish `CustomerSourceUpdated` (snapshot **trước → sau**) ⇒ Audit.

**AC-3 — `DELETE /customer-sources/:id` = soft-delete, KHÔNG BAO GIỜ hard-delete (FR-35).**
Given khách cũ vẫn trỏ vào nguồn (`Customer.sourceId` FK `ON DELETE RESTRICT`),
When `DELETE /customer-sources/:id`,
Then set **`active = false`** ⇒ **204** (`@HttpCode(HttpStatus.NO_CONTENT)`, khuôn `ProductsService.deactivate`)
- 🔴 **CẤM** `prisma.customerSource.delete()` / `deleteMany()` ở bất kỳ đâu trong `src/`. Xoá cứng ⇒ lịch sử "khách này từ đâu tới" bốc hơi **và** báo cáo lợi nhuận nhóm theo nguồn (Epic 8) thủng một mảng. (FK sẽ chặn bằng P2003, nhưng đừng để tới đó.)
- 🔴 **Dòng `isOther` KHÔNG tắt được** ⇒ **409 `CONFLICT`**, message tiếng Việt nói rõ lý do. Tắt nó = giết luật "chọn Khác ⇒ bắt buộc `sourceNote`" của Story 3.3.
- Dòng **đã tắt** ⇒ 204, **không** publish event (không có gì đổi thì không có gì để ghi).
- `id` không tồn tại ⇒ 404.
**And** publish `CustomerSourceDeactivated` (khi trạng thái **thật sự** đổi) ⇒ Audit.

**AC-4 — `POST /customer-sources/:id/reactivate` — bật lại (mockup: nút "Bật lại").**
Given một nguồn đã tắt,
When `POST /customer-sources/:id/reactivate`,
Then set `active = true` ⇒ `200 CustomerSourceResponseDto`.
- Dòng **đang bật** ⇒ 200, **không** publish event.
- `id` không tồn tại ⇒ 404.
**And** publish `CustomerSourceReactivated` (khi trạng thái thật sự đổi) ⇒ Audit.
- Route là **sub-resource POST cho hành động nghiệp vụ** — đúng convention spine (`/orders/{id}/chot`). Xem Quyết định #3 (vì sao không nhét `active` vào PATCH).

**AC-5 — Quyền: 4 route ghi gate `settings.manage`; route ĐỌC giữ `customers.manage` (AD-4, AD-17, FR-18).**
Given `PERM.settingsManage` đã có trong registry,
When gate,
Then:
- `POST` · `PATCH` · `DELETE` · `POST :id/reactivate` ⇒ `@RequirePermissions(PERM.settingsManage)`.
- 🔴 `GET /customer-sources` ⇒ **GIỮ NGUYÊN `PERM.customersManage`**. Sale tạo khách cần đọc dropdown nguồn nhưng **không** có quyền cấu hình. Đổi gate GET sang `settings.manage` ⇒ **gãy luồng tạo khách của Story 3.4** trên mọi preset không phải Admin. (Comment ở `customer-sources.controller.ts:16-21` đã dặn đúng chuyện này.)
- **KHÔNG** thêm permission key. **KHÔNG** chạy `permissions:gen`. **CẤM** permission literal ngoài registry (guard `no-permission-literal-outside-registry` quét cả `example:` của `@ApiProperty` — đã cắn ở 3.1).
- 🔴 **Đường đỏ `settings.manage`** (spine): quyền này **KHÔNG BAO GIỜ** được gate màn phân quyền / ma trận quyền / audit log. Story này chỉ gate danh mục nguồn khách — **đừng** tiện tay gate thêm gì khác.

**AC-6 — Audit MỌI mutation, qua EventBus (FR-20, AD-18).**
Given AC gốc chỉ nêu "đổi tên ⇒ ghi Audit",
When thiết kế,
Then audit **cả 4** hành động (create · update · deactivate · reactivate) — FR-20 đòi *"mọi hành động thay đổi dữ liệu (tạo/sửa/xoá…)"* và Consistency Conventions đòi audit *"cho **mọi** mutation nghiệp vụ"*. AC gốc nhấn mạnh rename, **không** phải liệt kê đầy đủ. Đây **không** phải scope creep (xem Quyết định #4).
- Event publish **SAU** khi write commit, mang snapshot **trước → sau** (khuôn `CustomerCreated`/`CustomerUpdated` ở `customers/domain/customer-events.ts`).
- 🔴 **CẤM** service gọi `AuditService` trực tiếp — chỉ `EventBus`. Guard `no-direct-side-effect-outside-eventbus` sẽ đỏ.
- `target = { type: 'CustomerSource', id }`.

**AC-7 — Màn Cấu hình Nguồn khách — **WEB ONLY** (UX-DR-10, UX-DR-19, UX-DR-22, AD-13).**
Given DESIGN.md nêu tường minh *"30 màn, mỗi màn có cả bản Web lẫn Mobile (**riêng Cấu hình nguồn khách chỉ có Web**)"* và mockup gắn thẻ `Web`,
When dựng,
Then làm **web-only** — **KHÔNG** dựng màn Flutter. Xem Quyết định #5 (đây là ngoại lệ có tên, không phải quên parity).
Màn `web/src/screens/settings/CustomerSourceConfigScreen.tsx`:
- `WebShell` + `Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="settings"` + `Topbar` (eyebrow `CẤU HÌNH HỆ THỐNG`, title `Nguồn khách hàng`, action `+ Thêm nguồn`).
- `Banner tone="info"` — copy nguyên văn ở bảng "Copy tiếng Việt".
- `Frame label="Danh mục nguồn · thứ tự hiện trên form"` bọc `Table` **5 cột**: `#` (mono, `sortOrder`) · `Tên nguồn` (strong) · `Mô tả cho người nhập` · `Trạng thái` · `Thao tác` (`.num`, canh phải).
- Dòng `isOther` mang thêm chip `Cờ "Khác"` cạnh tên. Dòng đã tắt: trạng thái `Đã tắt`.
- Hành động mỗi dòng: `Sửa` (mọi dòng, **kể cả `isOther`**) · `Tắt` (dòng đang bật, **trừ `isOther`** ⇒ nút `Khoá` **disabled**) · `Bật lại` (dòng đã tắt).
- Thêm/Sửa ⇒ `Dialog` (component **đã có**: `Dialog.tsx`) chứa `Field` × 3 (`Tên nguồn` · `Mô tả cho người nhập` · `Thứ tự hiện trên form`).
- Tắt ⇒ 🔴 **`ConfirmDialog` nêu hệ quả** (EXPERIENCE §State Patterns đòi confirm cho hành động Xoá) — **KHÔNG** tắt bằng một cú bấm trần.
- 3 state thật của port: **Loading** ⇒ `Skeleton` · **Empty** ⇒ `EmptyState` · **Error** ⇒ `ErrorState` + `Thử lại` (`onRetry` **phải nối thật** — nút "Thử lại" chết là lỗi HIGH của review 3.4).
- Lỗi 400/409 ⇒ `Banner tone="danger"` + message **của backend** + `fieldErrors` ghim đúng ô (AD-5) — **CẤM** client tự chế thông báo lỗi nghiệp vụ.
- ⚠️ **KHÔNG** render tab `Thuế suất VAT` (mockup có vẽ) — VAT là **FR-3, chưa có story nào**. Tab dẫn tới hư vô là UI nói dối. ⇒ **không dựng thanh Tabs**.
- **CẤM** thêm component design-system mới (AD-13). `<select>`/checkbox không cần: `isOther` không sửa được, `active` đi qua nút Tắt/Bật lại.

**AC-8 — Gating FE + nav (UX-DR-22, AD-4).**
Given người dùng **không** có `settings.manage`,
When render,
Then link **Cấu hình** **KHÔNG xuất hiện** trong sidebar (bề mặt bị cấm **biến mất**, không "màn chặn", không nút xám).
- `web/src/design-system/shell/Sidebar.tsx` (**UPDATE**): thêm vào section `Quản trị`, **trên** `Phân quyền`: `{ key: 'settings', icon: 'ic-catalog', label: 'Cấu hình', requires: PERM.settingsManage }`.
- ⚠️ **Icon:** SSOT **không có** icon bánh răng. Mockup tự nó dùng `ic-catalog` ⇒ **dùng lại `ic-catalog`**, **KHÔNG** thêm icon mới (thêm icon = đụng `icons.json` + generator + drift-guard, không thuộc story này).
- `web/src/design-system/gating/permissions.ts` (**UPDATE**): + `settingsManage: 'settings.manage'` vào `PERM`.
- 🔴 `mobile/lib/design_system/gating/app_permissions.dart` (**UPDATE**): + `AppPerm.settingsManage` — **bắt buộc dù mobile không có màn này**. Guard `design-system/permissions/permission-keys.test.mjs` `deepEqual` **hai bộ key và so theo THỨ TỰ** ⇒ thêm một bên là **đỏ**. Thêm **cuối cùng, sau `customersManage`, ở CẢ HAI file** (parity key ≠ parity màn).
- 🔴 **Hai guard sẽ soi đúng ba file bạn vừa sửa — biết trước để khỏi đỏ bất ngờ:**
  - `design-system/components/shell-behavior.test.mjs:23` quét `SIDEBAR_NAV` **theo THỨ TỰ** ("8 link chính tắc, đúng thứ tự"). Chèn `settings` **giữa `inventory` và `permissions`** ⇒ **xanh**. Chèn sớm hơn hoặc đảo thứ tự ⇒ **đỏ**.
  - `backend/test/permission-registry-fe-stub-parity.spec.ts` là một test **của backend** nhưng **đọc file FE** (`web/…/permissions.ts` + `mobile/…/app_permissions.dart`) và đòi mọi literal quyền ∈ registry. ⇒ **Chạy lại `cd backend && npm test` SAU khi sửa FE**, không chỉ trước.
- Backend enforce mọi request (AD-4) — ẩn nav chỉ là UX.

**AC-9 — Transport chỉ qua port tiêm (AD-1, AD-2).**
Given màn cấu hình,
When gọi backend,
Then đi qua **`CustomerSourcesPort`** tiêm vào props — **CẤM** `fetch(`/`axios`/`XMLHttpRequest`.
- `web/src/design-system/session/customer-sources-port.ts` (**NEW**): `list(includeInactive)` · `create(payload)` · `update(id, patch)` · `deactivate(id)` · `reactivate(id)` + `CustomerSourcePortError` (mirror envelope AD-5, khuôn `CustomerPortError` ở `customers-port.ts:87-90`).
- `fake-customer-sources-port.ts` (**NEW**) — in-memory, khuôn `FakeCustomersPort`.
- 🔴 **KHÔNG** nhét 4 method ghi vào `CustomersPort` — port đó là **cặp song sinh web↔Dart**; thêm method chỉ-có-web vào nó ⇒ hoặc vỡ parity, hoặc phải viết code Dart chết (không ai gọi). Port mới, **web-only, cố ý**.
- 🔴 **KHÔNG CÓ GUARD NÀO ĐANG CANH VIỆC NÀY.** `parity.test.mjs:24-40` là **bản đồ file song sinh hardcode** (file mới **vô hình** với nó) và `:66-79` chỉ kiểm 5 tên method **có mặt** (`.includes`), **không** so hai tập method. ⇒ Bỏ 4 method vào `CustomersPort` sẽ **xanh hết**, và file port web-only cũng **xanh hết**. **Assert mà bạn viết ở dưới CHÍNH LÀ hàng rào duy nhất** — đừng tin là đã có sẵn.
- `design-system/session/parity.test.mjs` (**UPDATE**): thêm **assert tường minh** rằng (a) `customer-sources-port.ts` là ngoại lệ **web-only có chủ đích** (ghi ngoại lệ bằng máy, đừng để story sau tưởng là quên) và (b) `customers-port.ts` **KHÔNG** mọc thêm method ghi nguồn (`createSource`/`updateSource`/…).

**AC-10 — Guard (thứ duy nhất bảo vệ `.tsx` — Nợ TD-1).**
Given web **vẫn chưa** có tsc/bundler/JSDOM,
When merge,
Then `design-system/screens/settings-customer-sources.test.mjs` (**NEW**, khuôn `screens/customers.test.mjs`) khẳng định:
(a) màn tồn tại + compose từ barrel DS (không `<input>`/`<button>` trần) · (b) **port-only** (cấm `fetch(`/`axios`) · (c) `WebShell` + sidebar lọc quyền · (d) copy tiếng Việt **byte-identical** với bảng dưới · (e) Viền nét (CSS **0** shadow/gradient/filter, radius chỉ qua token) · (f) **không permission literal** · (g) 🔴 **assert phủ định**: không chứa `Thuế suất VAT` (AC-7) · (h) 🔴 **assert phủ định**: dòng `isOther` có nút Sửa nhưng **không** có đường tắt nó · (i) hành động Tắt **phải** đi qua `ConfirmDialog`.
- ⚠️ Guard quét **TOÀN VĂN như text** ⇒ **đừng viết** chuỗi bị cấm (`Thuế suất VAT`, `shadow`, `gradient`) **trong comment** — false-positive tái diễn qua ~7 story.

**AC-11 — Cổng chất lượng.**
- `cd backend && npm run openapi:gen` → commit `openapi.json` → **verify tường minh** 4 route mới + `CreateCustomerSourceRequestDto`/`UpdateCustomerSourceRequestDto` có trong `components.schemas` (drift-guard xanh **không** chứng minh hợp đồng đúng — bài học 3.2/3.3/3.4).
- `npm test` (hermetic, **544 test hiện có, 0 regression**) · `npm run lint` · `npm run format:check` · `nest build`.
- `npm run test:db` — 🔴 script hiện **hardcode** `--runTestsByPath test/customers.db.integration.spec.ts` ⇒ **UPDATE `package.json`** để chạy **cả** file DB mới.
- `cd design-system && npm test` (213 guard hiện có).
- `cd mobile && flutter analyze && flutter test` (145 test) — mobile chỉ đổi **một dòng** `AppPerm`, phải vẫn xanh. ⚠️ `dart format` **ghi đè file** — dùng `dart format -o none` khi chỉ muốn kiểm.
- **Mutation test** (luật 2.10): xem Task 8.

## Tasks / Subtasks

- [x] **Task 0 — Verify seed, KHÔNG viết lại (AC-0)**
  - [x] Đọc `backend/prisma/seed.ts:30-85`. Xác nhận 5 dòng + đúng một `isOther`. Chỉ sửa **nếu** lệch AC; **không** đụng schema, **không** sinh migration.

- [x] **Task 1 — Domain event (AC-6)**
  - [x] `src/customers/domain/customer-source-events.ts` (**NEW**, kebab-case — guard `naming-convention` canh): `CustomerSourceSnapshot` + `CustomerSourceCreated` · `CustomerSourceUpdated` · `CustomerSourceDeactivated` · `CustomerSourceReactivated`, mỗi class `readonly type = '<TênClass>'`, `target = { type: 'CustomerSource', id }`.
  - [x] **Thuần domain** — không `import` Nest/Prisma (khuôn `customer-events.ts`).

- [x] **Task 2 — DTO ghi (AC-1, AC-2)**
  - [x] `src/customers/dto/create-customer-source-request.dto.ts` (**NEW**): `name` (`@IsString @IsNotEmpty @MaxLength(…)`) · `description?` (`@IsOptional @IsString`) · `sortOrder?` (`@IsOptionalNotNull @IsInt @Min(0)`).
  - [x] `src/customers/dto/update-customer-source-request.dto.ts` (**NEW**): `name?` **`@IsOptionalNotNull`** · `description?` **`@IsOptional`** (nullable ⇒ cho phép `null` để xoá) · `sortOrder?` **`@IsOptionalNotNull`**.
  - [x] 🔴 **CẤM `PartialType`** · **CẤM** field `isOther` · **CẤM** field `active`.
  - [x] **CẤM** permission literal trong `@ApiProperty({ example })`.

- [x] **Task 3 — Service (AC-1..AC-4, AC-6)**
  - [x] `src/customers/customer-sources.service.ts` (**UPDATE**): + `constructor(prisma, eventBus)` (thêm `EventBus`, giữ `PrismaService`).
  - [x] `create()`: `sortOrder` vắng ⇒ `max+1` (`findFirst({ orderBy: { sortOrder: 'desc' } })`); `isOther: false` **cứng**; `translateWriteError()` (khuôn `CustomersService:348-362`) ⇒ `isUniqueViolation` → 409 + `fieldErrors[name]`; publish `CustomerSourceCreated`.
  - [x] `update()`: `findOrThrow` → 404; `effective(patched, current)` cho PATCH semantics; publish `CustomerSourceUpdated(before, after)`.
  - [x] `deactivate()`: `findOrThrow`; **`isOther` ⇒ throw `AppException(ErrorCode.CONFLICT, 409, …)`**; đã tắt ⇒ return sớm **không** event; ngược lại `update({ active: false })` + publish.
  - [x] `reactivate()`: `findOrThrow`; đang bật ⇒ return sớm không event; ngược lại `update({ active: true })` + publish.
  - [x] 🔴 **CẤM** `prisma.customerSource.delete(`/`deleteMany(` ở bất kỳ đâu. **CẤM** `import AuditService`.
  - [x] **KHÔNG** thêm `ErrorCode` mới — dùng `VALIDATION_ERROR`/`NOT_FOUND`/`CONFLICT` sẵn có.

- [x] **Task 4 — Controller (AC-1..AC-5)**
  - [x] `src/customers/customer-sources.controller.ts` (**UPDATE**): + `@Post()` (201) · `@Patch(':id')` · `@Delete(':id')` (`@HttpCode(HttpStatus.NO_CONTENT)`) · `@Post(':id/reactivate')`.
  - [x] Cả 4 ⇒ `@RequirePermissions(PERM.settingsManage)` + `@ApiForbiddenResponse({ type: ErrorEnvelopeDto })` (+ `@ApiNotFoundResponse`/`@ApiConflictResponse` đúng chỗ). Actor: `@CurrentAccount() account`.
  - [x] 🔴 `@Get()` **giữ nguyên** `PERM.customersManage` — **đừng đổi** (AC-5).
  - [x] ⚠️ Guard `no-handler-without-require-permissions` **fail-closed**: viết **method thường, thụt 2 space** (arrow-function property bị tính là offender).

- [x] **Task 5 — Test backend (AC-1..AC-6)**
  - [x] `test/customer-sources.service.spec.ts` (**NEW**, hermetic — mock Prisma + EventBus): 🔴 **assert PAYLOAD `data` truyền vào Prisma**, không đếm số lần gọi (CRITICAL review 3.2 ⇒ xanh-giả). Ca: create tính `sortOrder` max+1 · create luôn `isOther:false` · update chỉ ghi field có mặt (`undefined` giữ nguyên, `description:null` xoá được) · **đổi tên dòng `isOther` ⇒ CHO PHÉP** · **deactivate dòng `isOther` ⇒ 409** · deactivate dòng đã tắt ⇒ **không publish event** · reactivate dòng đang bật ⇒ **không publish event** · 404 khi id lạ · unique `name` ⇒ 409 + `fieldErrors`.
  - [x] **Assert event**: mỗi mutation publish **đúng một** event, đúng class, snapshot **trước→sau** đúng.
  - [x] `test/customer-sources.e2e.spec.ts` (**NEW**, khuôn `customers.e2e.spec.ts`): **403 khi thiếu `settings.manage`** cho cả 4 route ghi · **200 với chỉ `customers.manage`** cho `GET` (chứng minh sale vẫn đọc được dropdown — đây là test canh AC-5, đừng bỏ) · 400 khi `name` rỗng · 409 khi tắt dòng `isOther` · route `:id/reactivate` không bị route khác nuốt.
  - [x] `test/customer-sources.db.integration.spec.ts` (**NEW**, Postgres thật): **đúng một** dòng `isOther` sau seed · `name` unique thật sự chặn ở tầng DB · **FK `RESTRICT` chặn hard-delete** một nguồn đang có khách trỏ vào (chứng minh vì sao phải soft-delete) · soft-delete xong khách cũ **vẫn đọc được** nguồn.
  - [x] `package.json` (**UPDATE**): script `test:db` chạy **cả hai** file `*.db.integration.spec.ts` (hiện hardcode một file).
  - [x] `test/openapi-drift.spec.ts` (**UPDATE**): assert 4 route mới + 2 DTO mới có trong spec; 4 route ghi đòi bearer.

- [x] **Task 6 — Port web + fake (AC-9)**
  - [x] `web/src/design-system/session/customer-sources-port.ts` (**NEW**) + `fake-customer-sources-port.ts` (**NEW**) + `index.ts` (**UPDATE** — export cả hai).
  - [x] Type mirror **đúng** DTO backend. `CustomerSourcePortError { message; fieldErrors? }` (khuôn `CustomerPortError`).
  - [x] `design-system/session/parity.test.mjs` (**UPDATE**): assert ngoại lệ **web-only có chủ đích** cho cặp file này.

- [x] **Task 7 — Màn web + nav + gating (AC-7, AC-8)**
  - [x] `web/src/screens/settings/CustomerSourceConfigScreen.tsx` (**NEW**) + `settings.css` (**NEW**).
  - [x] Khuôn: `screens/customers/CustomerListScreen.tsx` (shell + `usePermissions()` + `LoadState` + `useCallback load` + **vé `latest`** chống đua nếu có thao tác nối tiếp; `ErrorState onRetry={load}` — **nối thật**).
  - [x] `Dialog` cho form thêm/sửa · `ConfirmDialog` cho Tắt (component **đã có**, không tự dựng modal).
  - [x] Copy lấy **nguyên văn** bảng dưới.
  - [x] `permissions.ts` (**UPDATE**) + `app_permissions.dart` (**UPDATE**) + `Sidebar.tsx` (**UPDATE**) — AC-8.

- [x] **Task 8 — Guard + cổng chất lượng (AC-10, AC-11)**
  - [x] `design-system/screens/settings-customer-sources.test.mjs` (**NEW**) — 9 nhóm ở AC-10.
  - [x] Chạy đủ cổng ở AC-11.
  - [x] **Mutation test** — ba đột biến, **mỗi cái phải làm test ĐỎ**, xanh lại sau khôi phục:
    (a) bỏ chặn `isOther` trong `deactivate()` ⇒ test 409 phải đỏ;
    (b) `create()` gán `isOther: dto.isOther ?? false` (tức để client set cờ) ⇒ test "luôn `isOther:false`" phải đỏ;
    (c) đổi gate `GET /customer-sources` sang `PERM.settingsManage` ⇒ e2e "sale chỉ có `customers.manage` vẫn đọc được dropdown" phải đỏ.
  - [x] ⚠️ Đột biến **phải biên dịch sạch** (`tsc --noEmit` xanh trước khi chạy) — mutant lỗi TS làm **cả suite** đỏ và **không chứng minh gì** (bài học 3.3).
  - [x] ⚠️ Khôi phục bằng **`cp` từ backup**, **KHÔNG `git checkout`** — code story chưa commit, checkout **xoá sạch** (bài học 3.4).

## Dev Notes

### Copy tiếng Việt — nguồn chân lý (bảng NÀY là hợp đồng, không phải mockup)

Phần lớn lấy **nguyên văn** từ mockup `#s-source-config`. **Ba hàng đánh dấu 🆕 là do story này viết** — mockup **không vẽ** dialog nào cả (không có form thêm/sửa, không có confirm tắt). Đừng đi tìm chúng trong mockup rồi tự chế ra chuỗi khác: **bảng này là SSOT** mà guard AC-10(d) so byte-identical.

| Bề mặt | Chuỗi |
|---|---|
| Topbar | `CẤU HÌNH HỆ THỐNG` (eyebrow) · `Nguồn khách hàng` (title) · `+ Thêm nguồn` (action) |
| Nav | `Cấu hình` |
| Banner info | `Mỗi nguồn có một câu mô tả để sale phân biệt lúc nhập — "Fanpage" và "Facebook" nghe giống nhau nhưng là hai kênh khác nhau. Đổi tên nguồn được ghi Audit.` |
| Frame | `Danh mục nguồn · thứ tự hiện trên form` |
| Cột bảng | `#` · `Tên nguồn` · `Mô tả cho người nhập` · `Trạng thái` · `Thao tác` |
| Trạng thái | `Đang dùng` · `Đã tắt` |
| Chip cờ | `Cờ "Khác"` |
| Hành động | 🆕 `Sửa` · `Tắt` · `Bật lại` · `Khoá` (disabled, dòng `isOther`) |
| 🆕 Dialog form | `Thêm nguồn khách` · `Sửa nguồn khách` · `Tên nguồn` · `Mô tả cho người nhập` · `Thứ tự hiện trên form` · `Lưu` · `Huỷ` |
| 🆕 Dialog xác nhận Tắt | `Tắt nguồn khách?` · `Khách cũ vẫn giữ nguồn này. Nguồn sẽ không còn hiện trên form tạo khách.` · `Tắt nguồn` · `Huỷ` |
| 🆕 List states | `Đang tải danh mục nguồn khách…` · `Chưa có nguồn khách nào` · `Không tải được danh mục nguồn khách.` · `Thử lại` |

⚠️ **`Sửa` là nút CHỮ, cố ý khác mockup.** Mockup vẽ nút sửa **chỉ có icon** (`ic-edit`, không nhãn). Nút icon-only **không có tên đọc được** ⇒ vi phạm a11y floor (UX-DR-26 đòi nhãn/`aria-label` cho nút icon-only). Dùng nút chữ `Sửa` — rẻ hơn và đúng hơn. (Nếu Đại Ca muốn giữ icon-only ⇒ **bắt buộc** `aria-label="Sửa"`.)

**CẤM** (AC-7): `Thuế suất VAT` — FR-3, chưa có story.

### Quyết định lớn của story này (đã cân nhắc — đừng lật ở review mà không có bằng chứng mới)

#### 1. `isOther` **không ghi được qua API** — chỉ seed đặt

AC gốc đòi *"**chỉ một** dòng có `isOther=true`"*, nhưng **không** artifact nào nói cơ chế thi hành, và DB **không** có partial-unique index cho nó. Ba cách: (a) index DB, (b) guard trong service khi ghi cờ, (c) **không cho ghi cờ qua API**.
Chọn **(c)** — rẻ nhất và chặt nhất: nếu cờ không có trong DTO ghi thì **không có đường nào** tạo dòng thứ hai qua API, và luật "đúng một" trở thành bất biến của **seed**, kiểm bằng test lane DB (Task 5). (a) là migration + rủi ro trên DB đã có dữ liệu, cho một thứ (c) đã đóng. (b) là viết guard cho một cửa mà ta có thể **khoá luôn**.
Hệ quả có ý thức: muốn dời cờ sang dòng khác ⇒ phải sửa seed + chạy `db seed`. Đó là **việc hiếm và nguy hiểm**, xứng đáng đi đường chậm.

#### 2. `GET /customer-sources` **giữ gate `customers.manage`** — đổi là gãy Story 3.4

Cám dỗ: "màn cấu hình gate `settings.manage` ⇒ cho cả `/customer-sources` luôn". **Sai.** Dropdown `Nguồn khách` ở form tạo khách (Story 3.4, AC-4) gọi đúng endpoint này, và preset `THO_KS`/`QUAN_LY`/`KE_TOAN` **có** `customers.manage` nhưng **không** có `settings.manage` (`role-presets.ts:47` — `settings.manage` chỉ ở ADMIN). Đổi gate ⇒ sale **không tạo được khách**. Chính comment ở `customer-sources.controller.ts:16-21` đã dặn trước. Mutation (c) ở Task 8 canh đúng chuyện này.

#### 3. Bật/tắt đi **route riêng**, không nhét `active` vào PATCH

`PATCH { active: false }` và `DELETE` cùng làm một việc ⇒ hai đường vào một trạng thái, hai chỗ phải nhớ chặn `isOther`, và audit khó đọc ("update" hay "deactivate"?). Spine đã có convention: *"action nghiệp vụ là sub-resource POST"*. ⇒ `DELETE :id` = tắt (đúng chữ "xoá ⇒ soft-delete" của AC gốc), `POST :id/reactivate` = bật lại (mockup có nút "Bật lại" nên **cần** đường bật). PATCH **chỉ** sửa nội dung. Một hành động = một route = một event.

#### 4. Audit **cả 4** mutation, không chỉ rename — FR-20 thắng

AC gốc viết *"đổi tên ⇒ ghi Audit"*. FR-20 đòi audit *"tạo/sửa/xoá"* và spine đòi *"mọi mutation nghiệp vụ"*. Đọc AC theo nghĩa liệt-kê-đầy-đủ sẽ để **create** và **deactivate** không có vết — tức không trả lời được "ai tắt nguồn Đại lý tháng trước?". Rename được nêu riêng vì nó là ca **nguy hiểm nhất** (đổi nghĩa dữ liệu cũ mà không đổi dữ liệu), không phải vì nó là ca **duy nhất**. Ghi ở đây để reviewer không gắn cờ scope creep.

#### 5. **Web-only** — ngoại lệ có tên, không phải quên parity

| Nguồn | Nói gì |
|---|---|
| `DESIGN.md:148` | *"30 màn, mỗi màn có cả bản Web lẫn Mobile (**riêng Cấu hình nguồn khách chỉ có Web**)"* |
| mockup `#s-source-config` | gắn thẻ `Web`, **không** có khung điện thoại |
| epics §Story 3.5 AC | **im lặng** về nền tảng (trong khi 3.6 nói rõ *"parity web+mobile"*) |
| EXPERIENCE.md · UX-DR-27 | *"full parity: mọi màn nghiệp vụ đều có cả bản web lẫn mobile"* |

Ba tín hiệu đầu **cụ thể và trùng khớp**; UX-DR-27 là **luật chung** — luật riêng có tên thắng luật chung. Lý lẽ nghiệp vụ cũng đứng: cấu hình danh mục là việc của chủ/admin ngồi bàn, không phải việc của thợ ngoài công trường. ⇒ **web-only**, và `AppPerm.settingsManage` vẫn phải thêm (parity **key**, không phải parity **màn**).
**Hệ quả phải biết:** màn này **không có runtime test** nào (web chưa có JSDOM) ⇒ guard văn bản + backend test là toàn bộ hàng rào. Nếu Đại Ca muốn parity đầy đủ ⇒ **báo trước khi code** (câu hỏi #1) — dựng thêm màn Flutter thì lại **có** widget test thật.

### Ràng buộc kiến trúc bắt buộc (vi phạm = fail guard hoặc fail review)

| Ràng buộc | Nguồn | Hệ quả cụ thể |
|---|---|---|
| Backend sở hữu nghiệp vụ; client chỉ REST | AD-1, AD-2 | Client **không** lọc/sắp/đánh số thứ tự tại chỗ. `sortOrder` do backend tính. |
| Backend enforce **mọi** request | AD-4 | 4 route ghi đều `@RequirePermissions`. Ẩn nav chỉ là UX. |
| Error envelope **một chỗ** | AD-5 | `throw new AppException(...)`. **Cấm** token `traceId` trong `src/` (guard `no-controller-error-envelope`). Không thêm `ErrorCode` mới. |
| Permission registry là SSOT | AD-17 | `PERM.settingsManage`. **Cấm literal** — kể cả trong `example:`. |
| EventBus là đường duy nhất cho side-effect | AD-18 | Publish event; **CẤM** `import AuditService`. |
| OpenAPI sinh từ code | AD-12 | `npm run openapi:gen`, **cấm sửa tay** `openapi.json`. |
| Design-system-first | AD-13 | Compose từ component đã ship (`Table` · `Dialog` · `ConfirmDialog` · `Field` · `Button` · `Banner` · `Frame` · `EmptyState` · `ErrorState` · `Skeleton` · `Chip`). **Không** thêm component DS mới. **Không** style ad-hoc. |
| Viền nét (0 shadow) | UX-DR-4 | CSS: **0** `box-shadow`/`gradient`/`filter:`; radius **chỉ** qua `var(--radius…)`. |
| Bề mặt thiếu quyền **biến mất** | UX-DR-22 | Không có màn 403, không nút xám. |
| Audit append-only | Conventions | Guard `audit-log-append-only` — chỉ `create` trên `auditLog`. |
| Đường đỏ `settings.manage` | ARCHITECTURE-SPINE §Consistency | Quyền này **KHÔNG BAO GIỜ** gate phân quyền / ma trận quyền / audit log. |

### 🔴 Nợ TD-1 — web vẫn CHƯA có tsc/bundler/JSDOM (đọc trước khi code `.tsx`)

`sprint-status.yaml#action_items` (Epic 2, **open**): *"Quyết TD-1: tạo story app-scaffold web trước Story 3.4, hoặc ghi nhận chấp nhận text-guard-only xuyên Epic 3"*.
Story 3.4 chạy **phương án 2**; story này **tiếp tục phương án 2** (đổi phương án = đổi phạm vi sprint = quyết định của Đại Ca, không phải của dev agent).
- `.tsx` **không được typecheck, không chạy runtime test**. Bảo vệ duy nhất = **text-guard** + review.
- ⇒ Guard `settings-customer-sources.test.mjs` là **bài test THẬT** của phần web, không phải thủ tục.
- ⇒ **Đừng cố `tsc` `web/`** — sẽ nổ vì đống tích luỹ Epic 1/2, không phải vì story này.
- Story này **cộng thêm 1 màn** vào đống chưa verify ⇒ tổng **9 màn** web chưa verify. Ghi vào Completion Notes để retro Epic 3 cân được nợ.
- 🔴 **Đối trọng:** phần **backend** của story này **có** test thật (unit + e2e + lane DB). Đó là nơi mọi luật nghiệp vụ (`isOther`, soft-delete, gate) phải được chứng minh — **đừng** để luật nào sống **chỉ** trong `.tsx`.

### Previous Story Intelligence (3.1 → 3.4 — máu đã đổ, đừng chảy lại)

1. **🔴 Đếm số lần gọi ⇒ xanh-giả (CRITICAL review 3.2).** ⇒ Task 5 **assert payload `data`/`where`** truyền vào Prisma, không `toHaveBeenCalledTimes`.
2. **🔴 Guard tự viết có thể xanh-giả (bài học 2.10).** Guard mới phải có **sanity test**: cố tình vi phạm ⇒ guard phải ĐỎ.
3. **`@IsOptional()` cho `null` lọt qua (HIGH review 3.1).** Cột NOT NULL (`name`, `sortOrder`) ⇒ `@IsOptionalNotNull()`; cột nullable (`description`) ⇒ `@IsOptional()`. **Cấm `PartialType`.**
4. **Thiếu trần trên ⇒ tràn (HIGH review 3.2).** ⇒ `@MaxLength` cho `name`/`description`; `@Min(0)` cho `sortOrder`.
5. **Guard `no-permission-literal-outside-registry` quét cả `@ApiProperty({ example })`** (đã cắn ở 3.1).
6. **Guard text quét toàn văn** ⇒ **đừng viết chuỗi bị cấm trong comment** (false-positive tái diễn ~7 story).
7. **Mutation phải biên dịch sạch** (3.3) — mutant lỗi TS làm cả suite đỏ, chứng minh **0**.
8. **Khôi phục sau mutation bằng `cp`, KHÔNG `git checkout`** (3.4) — code story chưa commit.
9. **Permission registry cross-package:** đổi `PERM` web ⇒ **bắt buộc** đổi `AppPerm` mobile **cùng vị trí** (guard `deepEqual` **so cả thứ tự**). Story này **không** đổi registry backend ⇒ **không** chạy `permissions:gen`, **không** chạy `build:permissions` (chỉ thêm key vào 2 file khai tay, giá trị phải khớp `permission-keys.generated.ts`).
10. **Lane DB tách bằng `testPathIgnorePatterns`** (HIGH review 3.3) — **đừng gỡ**. File DB mới phải theo đúng hậu tố `.db.integration.spec.ts` **và** được thêm vào script `test:db`.
11. **Nút "Thử lại" chết (HIGH review 3.4):** `ErrorState` chỉ render nút khi có **`onRetry`** — truyền `retryLabel` không đủ.
12. **Prisma 7:** `prisma.customerSource` là model delegate; `@map`/`@@map` đã lo snake_case — **không** viết raw SQL.

### Git Intelligence (5 commit gần nhất)

`e4efc77` 3.4 (lookup SĐT + 3 màn khách × 2 nền tảng + `CustomersPort` + `customers.test.mjs`) · `b35e036` 3.3 (**`CustomerSource` + seed + `GET /customer-sources`** — nền của story này) · `4de6362` 3.2 · `0fba7c2` 3.1 (**`ProductsService.deactivate()` — khuôn soft-delete**) · `710333c` 2.10 (source-guard `@RequirePermissions`).

⇒ Khuôn backend Epic 3 **đã ổn định**: controller mỏng → service (Prisma + EventBus) → domain thuần. Story này **chỉ mở rộng** `customers/`, **không** đẻ module mới. Commit **conventional**, không tham chiếu AI.

### Project Structure Notes

```
backend/
  src/customers/
    domain/customer-source-events.ts             # NEW (thuần domain)
    customer-sources.service.ts                  # UPDATE: + EventBus, + create/update/deactivate/reactivate
    customer-sources.controller.ts               # UPDATE: + 4 route ghi (GET giữ nguyên gate!)
    dto/create-customer-source-request.dto.ts    # NEW
    dto/update-customer-source-request.dto.ts    # NEW
  openapi/openapi.json                           # UPDATE: openapi:gen
  package.json                                   # UPDATE: script test:db chạy cả 2 file DB
  test/
    customer-sources.service.spec.ts             # NEW
    customer-sources.e2e.spec.ts                 # NEW
    customer-sources.db.integration.spec.ts      # NEW
    openapi-drift.spec.ts                        # UPDATE

web/src/
  design-system/session/customer-sources-port.ts · fake-customer-sources-port.ts   # NEW (web-only, cố ý)
  design-system/session/index.ts                 # UPDATE: export
  design-system/gating/permissions.ts            # UPDATE: + PERM.settingsManage
  design-system/shell/Sidebar.tsx                # UPDATE: + link Cấu hình (ic-catalog, requires)
  screens/settings/
    CustomerSourceConfigScreen.tsx · settings.css   # NEW

mobile/lib/
  design_system/gating/app_permissions.dart      # UPDATE: + AppPerm.settingsManage (CHỈ key — parity guard)

design-system/
  screens/settings-customer-sources.test.mjs     # NEW — guard duy nhất bảo vệ màn web
  session/parity.test.mjs                        # UPDATE: ghi nhận ngoại lệ web-only
```

**KHÔNG tạo/sửa:** `prisma/schema.prisma` · `prisma/migrations/**` · `permission-registry.ts` · `role-presets.ts` · `openapi/permissions.json` · `design-system/icons/**` · bất kỳ màn Flutter nào.

**Tái dùng, KHÔNG viết lại** (đã scout — đây là kết quả):

- `CustomerSourceResponseDto` + `CustomerSourcesService.findAll()` (3.3) — hợp đồng đọc **không đổi**.
- `AppException` + `ErrorCode` (`VALIDATION_ERROR`/`NOT_FOUND`/`CONFLICT`) — **không thêm mã mới**.
- `isUniqueViolation()` (`common/errors/prisma-unique-violation.ts`) + khuôn `translateWriteError()` (`customers.service.ts:348-362`).
- `@IsOptionalNotNull()` (`catalog/dto/is-optional-not-null.decorator.ts`) — **đã có, đừng viết lại**.
- `ProductsService.deactivate()` (`catalog/products.service.ts`) — **khuôn soft-delete + event**.
- `customers/domain/customer-events.ts` — **khuôn class event + snapshot**.
- `PERM.settingsManage` (`permission-registry.ts:61`) — **đã có, đã vào preset ADMIN**.
- Web components (barrel `web/src/design-system/components`): `Table` · `Dialog` · `ConfirmDialog` · `Field` · `Button` · `Banner` · `Frame` · `Card` · `Chip` · `EmptyState` · `ErrorState` · `Skeleton`. Shell: `WebShell` · `Sidebar` + `SIDEBAR_NAV` · `Topbar` · `Toolbar`.
- Khuôn màn: `web/src/screens/customers/CustomerListScreen.tsx`. Khuôn guard: `design-system/screens/customers.test.mjs`. Khuôn e2e: `backend/test/customers.e2e.spec.ts`.

**Naming:** web màn PascalCase (`CustomerSourceConfigScreen.tsx`); mọi file backend/guard **kebab-case** (guard `naming-convention` canh `src/`).

### Library / Framework

Node 24 LTS · NestJS 11.1.27 · Prisma 7.8.0 · PostgreSQL 18.4 · React 19.2.7 · class-validator + `@nestjs/swagger`.
**KHÔNG dependency mới.** Không đụng Flutter (ngoài một dòng `AppPerm`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.5:389-396] — AC gốc: seed 5 dòng · nhận "Khác" bằng **cờ** không bằng tên · dòng `isOther` **không xoá/không tắt** · rename ⇒ Audit · xoá = soft-delete · màn gate `settings.manage`, dùng Table + button CRUD.
- [Source: prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-35] — `CustomerSource { id, name, description, active, sortOrder, isOther }`; xoá = `active:false`, hard delete **bị chặn**; `isOther` **đúng một dòng**, không xoá/deactivate; màn cấu hình gate `settings.manage`; đổi tên ⇒ Audit. **`Order.sourceId` snapshot là việc của Story 4.1 — KHÔNG làm ở đây.**
- [Source: prd.md#FR-20] — audit **mọi** thay đổi dữ liệu (tạo/sửa/xoá), bản ghi bất biến ⇒ cơ sở của AC-6 (Quyết định #4).
- [Source: prd.md#FR-18] — quyền config được, không hardcode.
- [Source: architecture/…/ARCHITECTURE-SPINE.md#AD-4 · AD-5 · AD-12 · AD-13 · AD-17 · AD-18] — enforce mọi request · một envelope lỗi · OpenAPI sinh từ code · design-system-first · registry quyền SSOT · side-effect chỉ qua EventBus.
- [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions] — **đường đỏ `settings.manage`** (không gate phân quyền/ma trận/audit) · REST route số nhiều kebab-case, **action nghiệp vụ = sub-resource POST** (cơ sở của Quyết định #3) · AuditLog append-only cho **mọi** mutation.
- [Source: ARCHITECTURE-SPINE.md#Structural-Seed] — ERD `CUSTOMER_SOURCE { uuid id PK, string name, string description, bool active, int sortOrder, bool isOther }`; `CUSTOMER_SOURCE ||--o{ CUSTOMER`.
- [Source: epics.md#UX-DR-10:107] — Table dense · header `surface-2` + micro uppercase · viền dưới 1px · zebra `#F7FBFA` · cột số canh phải (`.num`) · giá trị mạnh in đậm.
- [Source: epics.md#UX-DR-19:116 · UX-DR-22:119 · UX-DR-4:101] — loading skeleton / empty câu ngắn + hành động / error + "Thử lại" / **confirm nêu hệ quả cho hành động Xoá** · bề mặt thiếu quyền **biến mất khỏi nav** · Viền nét (0 shadow).
- [Source: ux-designs/…/DESIGN.md:148] — *"riêng Cấu hình nguồn khách **chỉ có Web**"* ⇒ cơ sở của Quyết định #5.
- [Source: ux-designs/…/mockups/all-screens.html#s-source-config:4621-4730] — bố cục màn, 5 cột bảng, copy banner/frame/pill/hành động, nút `Khoá` disabled trên dòng `isOther`, nav dùng icon `ic-catalog`. ⚠️ Tab `Thuế suất VAT` trong mockup **không** thuộc story này (FR-3).
- [Source: ux-designs/…/EXPERIENCE.md#State-Patterns] — bảng state, **Confirm** bắt buộc cho hành động Xoá.
- [Source: backend/prisma/schema.prisma:181-201] — `CustomerSource` **đã tồn tại**: `name @unique`, `active`, `sortOrder` NOT NULL **không default**, `isOther @default(false)`.
- [Source: backend/prisma/migrations/20260713020000_add_customers_and_customer_sources/migration.sql:39] — FK `customers_source_id_fkey … ON DELETE RESTRICT` ⇒ hard-delete **sẽ** nổ P2003; soft-delete là đường duy nhất.
- [Source: backend/prisma/seed.ts:30-85] — 5 dòng đã seed, `upsert({where:{name}})` idempotent, `Khác` sortOrder 99 `isOther:true`.
- [Source: backend/src/customers/customer-sources.controller.ts:16-21] — comment của 3.3 **dành sẵn** POST/PATCH/DELETE + `settings.manage` cho story này, **và** giải thích vì sao `GET` phải giữ `customers.manage` (Quyết định #2).
- [Source: backend/src/accounts/domain/permission-registry.ts:61,116 · role-presets.ts:47] — `settings.manage` **đã có**, chỉ ở preset `ADMIN`(→`SUPER_ADMIN`).
- [Source: backend/src/catalog/products.service.ts#deactivate] — khuôn soft-delete + publish event.
- [Source: backend/src/customers/customers.service.ts:348-362] — khuôn `translateWriteError()` (P2002 ⇒ 409 + `fieldErrors`).
- [Source: design-system/permissions/permission-keys.test.mjs:44-67] — `deepEqual` web `PERM` ↔ mobile `AppPerm`, **so cả thứ tự** ⇒ AC-8.
- [Source: design-system/session/parity.test.mjs:24-40] — bản đồ cặp file song sinh web↔Dart ⇒ vì sao port mới phải là file riêng (AC-9).
- [Source: _bmad-output/implementation-artifacts/3-4-…md#Senior-Developer-Review] — 6 lỗi lọt qua **mọi** cổng vì không cổng nào chạy được `.tsx`; nút "Thử lại" chết; đua kết quả; guard văn bản không chứng minh màn render nổi.
- [Source: _bmad-output/project-context.md:80] — web **chưa có** tsc/bundler/JSDOM; **đừng cố `tsc` web/**.
- [Source: sprint-status.yaml#action_items] — TD-1 (**open**) ⇒ story này chạy phương án 2 (text-guard-only), ghi nhận nợ.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8[1m]`) — bmad-dev-story.

### Debug Log References

**Ba đột biến bắt buộc (Task 8) — mỗi cái biên dịch sạch (`tsc --noEmit` xanh) trước khi chạy; khôi phục bằng `cp` từ backup, KHÔNG `git checkout`:**

| # | Đột biến | Kết quả | Ghi chú |
|---|---|---|---|
| (a) | Bỏ chặn `isOther` trong `deactivate()` | **ĐỎ — 2 test** | unit "dòng isOther ⇒ 409" + e2e "DELETE dòng Khác ⇒ 409" |
| (b) | `create()` gán `isOther: dto.isOther ?? false` | **ĐỎ — 1 test** | unit "isOther LUÔN LUÔN false". ⚠️ e2e **vẫn xanh** vì `whitelist` của pipe đã cắt cờ ở tầng HTTP — đúng lý do vì sao hàng rào **thứ hai** ở service cần test riêng, và vì sao chỉ dựa vào e2e là xanh-giả. |
| (c) | Đổi gate `GET /customer-sources` sang `PERM.settingsManage` | **ĐỎ — 5 test** | Gồm cả `customers.e2e.spec.ts` của Story 3.4 ⇒ bằng chứng chạy được cho Quyết định #2: đổi gate GET là giết luồng tạo khách của sale. |

**Sanity test cho guard mới** (bài học 2.10 — guard tự viết có thể xanh-giả). Bốn vi phạm cố ý vào `CustomerSourceConfigScreen.tsx`, guard phải ĐỎ; baseline 15/15 xanh:

| Vi phạm | Guard |
|---|---|
| Nút `Tắt` gọi thẳng `port.deactivate` (bỏ qua `ConfirmDialog`) | **ĐỎ** |
| `ErrorState` chỉ có `retryLabel`, không `onRetry` (nút "Thử lại" chết — lỗi HIGH của 3.4) | **ĐỎ** |
| Chip cờ đọc `row.name === 'Khác'` thay vì cờ `isOther` | **ĐỎ** |
| Ô "Thứ tự" rỗng gửi `0` thay vì `undefined` (client tự quyết thứ tự) | **ĐỎ** |

**Lane DB (Postgres thật, 24/24 — 2 suite):** `test:db` sau khi sửa `package.json` chạy **cả hai** file `*.db.integration.spec.ts` (trước đó hardcode một file).

**🔴 Phát hiện Prisma 7 (khác với giả định của story):** FK violation **lúc INSERT** có `code: 'P2003'` (đường mà test 3.3 dựa vào), nhưng vi phạm **`ON DELETE RESTRICT` lúc DELETE** nổi lên dưới dạng `DriverAdapterError` **KHÔNG mang `code`** — chỉ có message `violates RESTRICT setting of foreign key constraint`. Ràng buộc DB **có** chặn (đã kiểm chứng); chỉ có mã lỗi là không đến. Test vì vậy assert **hành vi** (lệnh xoá bị từ chối + dòng còn sống + khách vẫn trỏ được vào nguồn) thay vì bám mã. Ai viết ca delete-restrict ở story sau cần biết.

### Completion Notes List

- **Task 0 — seed KHÔNG bị viết lại.** `prisma/seed.ts:30-85` đã đúng: 5 dòng, mỗi dòng có `description` phân biệt, **đúng một** `isOther: true` (Khác, sortOrder 99). Không sửa gì, không sinh migration, không đụng `schema.prisma`.
- **Bất biến "đúng một dòng `isOther`" được thi hành bằng cách KHOÁ CỬA, không bằng cách đi canh** (Quyết định #1): cờ không tồn tại trong DTO ghi nào ⇒ không có đường nào qua API tạo dòng thứ hai. Có **hai** hàng rào: `whitelist` của pipe cắt cờ ở tầng HTTP, và `isOther: false` **cứng** ở service. Đột biến (b) chứng minh hàng rào thứ hai là thật, không phải thừa.
- **Dòng `isOther` sửa tên được, tắt không được.** Cả hai nửa đều có test (unit + e2e + lane DB): đổi tên xong cờ **vẫn còn nguyên** trên Postgres thật ⇒ luật `sourceNote` của Story 3.3 sống sót.
- **`GET` giữ gate `customers.manage`** (Quyết định #2) — có test canh **hai chiều**: sale chỉ có `customers.manage` vẫn đọc được dropdown (200), và admin chỉ có `settings.manage` **không** đọc được (403 — `settings.manage` không phải quyền trùm).
- **Sai lệch duy nhất so với hợp đồng viết trong AC, đã sửa theo AC:** `@Post(':id/reactivate')` mặc định trả **201**; AC-4 đòi **200**. Thêm `@HttpCode(HttpStatus.OK)` — bật lại một nguồn đang tồn tại không TẠO ra tài nguyên nào.
- **Audit cả 4 mutation** (Quyết định #4), publish **sau** khi write commit, mang snapshot trước→sau. Dòng đã tắt mà gọi `DELETE` lần nữa ⇒ 204 nhưng **không** publish event (một dòng audit cho việc không xảy ra là một dòng audit nói dối). Đối xứng ở `reactivate`.
- **Port web-only là ngoại lệ CÓ CHỦ ĐÍCH, và giờ nó được ghi bằng máy** (AC-9). Story cảnh báo đúng: `parity.test.mjs` **không** canh việc này (bản đồ file song sinh là hardcode, và check method chỉ kiểm "có mặt", không so hai tập). Đã thêm 2 assert: (1) cặp file Dart tương ứng **phải KHÔNG tồn tại** — nếu story sau dựng màn cấu hình mobile, họ phải xoá assert này **có ý thức**; (2) `CustomersPort` **không** mọc thêm `createSource`/`updateSource`/… ở **cả hai** nền tảng.
- **🔴 Nợ TD-1 (cho retro Epic 3):** story này cộng thêm **1 màn web chưa verify runtime** ⇒ tổng **9 màn**. Guard `settings-customer-sources.test.mjs` (15 test) là hàng rào **duy nhất** của phần web — nó không chứng minh được màn render nổi. **Đối trọng:** mọi luật nghiệp vụ của story (cờ `isOther`, soft-delete, hai gate) sống ở backend và **có** test thật (unit 26 + e2e 32 + lane DB 24). Không luật nào sống chỉ trong `.tsx`.
- **Không đụng:** `schema.prisma` · `prisma/migrations/**` · `permission-registry.ts` · `role-presets.ts` · `openapi/permissions.json` · `design-system/icons/**` · màn Flutter nào. Không chạy `permissions:gen`/`build:permissions` (chỉ thêm key khai tay vào 2 file FE, giá trị khớp `permission-keys.generated.ts`). Không thêm dependency.
- **Ghi nhận, KHÔNG sửa (ngoài phạm vi):** `mobile/lib/design_system/gating/app_permissions.dart` **đã** không format-clean từ **trước** story này (kiểm chứng: `dart format --set-exit-if-changed` trên bản `HEAD` cũng exit 1). `flutter analyze` sạch và mobile không có cổng format trong CI, nên để nguyên.

**Cổng chất lượng — tất cả xanh:**

| Cổng | Kết quả |
|---|---|
| `backend npm test` | **604 / 604** (544 cũ + 60 mới, **0 regression**) |
| `backend npm run test:db` | **24 / 24**, 2 suite (Postgres thật) |
| `backend npm run lint` · `format:check` · `nest build` | sạch · sạch · OK |
| `backend npm run openapi:gen` | `openapi.json` commit; **verify tường minh** 4 route ghi + 2 DTO có trong `components.schemas`, và **không** DTO ghi nào phơi `isOther`/`active` |
| `design-system npm test` | **230 / 230** (213 cũ + 17 mới) |
| `mobile flutter analyze` · `flutter test` | sạch · **145 / 145** |

### File List

**Backend — NEW**
- `backend/src/customers/domain/customer-source-events.ts`
- `backend/src/customers/dto/create-customer-source-request.dto.ts`
- `backend/src/customers/dto/update-customer-source-request.dto.ts`
- `backend/src/customers/dto/customer-source-limits.ts` (trần `sortOrder` = trần `int4`, dùng chung create + update)
- `backend/test/customer-sources.service.spec.ts`
- `backend/test/customer-sources.e2e.spec.ts`
- `backend/test/customer-sources.db.integration.spec.ts`
- `backend/test/no-hard-delete-customer-source.spec.ts` (source-guard AC-3 — thêm ở review)

**Backend — UPDATE**
- `backend/src/customers/customer-sources.service.ts`
- `backend/src/customers/customer-sources.controller.ts`
- `backend/prisma/seed.ts` (khoá dòng `isOther` theo CỜ, không theo `name` — sửa ở review)
- `backend/test/openapi-drift.spec.ts`
- `backend/openapi/openapi.json`
- `backend/package.json` (script `test:db` chạy cả hai file DB)

**Web — NEW**
- `web/src/design-system/session/customer-sources-port.ts`
- `web/src/design-system/session/fake-customer-sources-port.ts`
- `web/src/screens/settings/CustomerSourceConfigScreen.tsx`
- `web/src/screens/settings/settings.css`

**Web — UPDATE**
- `web/src/design-system/session/index.ts`
- `web/src/design-system/gating/permissions.ts`
- `web/src/design-system/shell/Sidebar.tsx`

**Mobile — UPDATE**
- `mobile/lib/design_system/gating/app_permissions.dart` (chỉ `AppPerm.settingsManage` — parity KEY)

**Design-system — NEW**
- `design-system/screens/settings-customer-sources.test.mjs`
- `design-system/session/fake-customer-sources-port.test.mjs`

**Design-system — UPDATE**
- `design-system/session/parity.test.mjs`

**Story tracking — UPDATE**
- `_bmad-output/implementation-artifacts/3-5-danh-muc-nguon-khach-man-cau-hinh.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Senior Developer Review (AI)

**Ngày:** 2026-07-13 · **Kết quả:** Approve (0 CRITICAL còn lại) · **Đã sửa:** 3 lỗi đã biết + 6 lỗi review tìm thêm.

### Ba mục bắt buộc trước khi đóng story

1. **Drift-guard OpenAPI đang FAIL** ⇒ chạy `npm run openapi:gen`. Spec commit thiếu **cả 4 route ghi** (311 dòng), không chỉ thiếu `maximum`. Guard xanh trở lại.
2. **`@Max(SORT_ORDER_MAX)` thiếu ở update DTO** ⇒ đã thêm + test e2e `PATCH sortOrder: 9999999999 ⇒ 400`. Hoá ra `@Max` bên create DTO **cũng chưa có test nào** — trần đã "sửa" nhưng chưa ai chứng minh; đã bổ sung ca POST tràn.
3. **`update()` publish `CustomerSourceUpdated` vô điều kiện** ⇒ đã thêm early-return khi không cột nào đổi giá trị (đối xứng `deactivate`/`reactivate`). Test: `PATCH {}` rỗng, gửi lại y hệt giá trị cũ, và một ca rào chắn chứng minh **một** field đổi thật thì VẪN ghi + VẪN publish.

Cả ba đã **mutation-test**: gỡ từng fix ra thì đúng những test mới đỏ, không cái nào xanh giả.

### 🔴 HIGH — seed khoá theo `name`, mà story này cho phép ĐỔI TÊN ⇒ đẻ ra dòng `isOther` THỨ HAI

Bất biến trung tâm của story ("đúng một dòng mang cờ") **không đứng vững**, và nó gãy trên Postgres thật, không phải trên giấy:

`seed.ts` `upsert({ where: { name: 'Khác' } })` + AC-2 cho phép admin đổi tên dòng "Khác" ⇒ lần `prisma db seed` kế tiếp không thấy dòng nào tên "Khác" ⇒ chạy nhánh `create` ⇒ **hai dòng `isOther`**. Không có index DB nào chặn. Chính TSDoc của seed đã dặn "backend nhận biết nó bằng CỜ, không bằng tên" — rồi seed vẫn tìm nó bằng tên.

Đã tái hiện THẬT trên DB dev trong lúc review: sau đổi tên + seed lại, bảng có 2 dòng cờ (dòng gốc kẹt dưới tên tạm, dòng "Khác" mới toanh do seed đẻ) — đã dọn sạch, DB trả về 5 dòng / 1 cờ.

**Sửa:** seed tìm dòng cờ theo `isOther: true`, và **giữ nguyên `name`** nếu dòng đã tồn tại (tên đó có thể là admin vừa đặt — seed không có quyền đạp lại). Test lane DB mới chứng minh: đổi tên ⇒ seed lại ⇒ vẫn **đúng một** dòng cờ, tên admin đặt còn nguyên, không có "Khác" nào mọc lại.

### Các lỗi khác đã sửa

| # | Mức | Lỗi | Sửa |
|---|---|---|---|
| 1 | MEDIUM | Lane DB đổi tên dòng cờ THẬT thành `ZZ Test tên khác` — nằm ĐÚNG trong tiền tố mà `donDep()` xoá cứng. Chết giữa chừng (timeout/huỷ CI) ⇒ lần sau xoá luôn dòng cờ duy nhất của DB. | Đổi tên tạm ra NGOÀI tiền tố dọn dẹp. |
| 2 | MEDIUM | AC-3 cấm hard-delete "ở bất kỳ đâu trong `src/`" nhưng chỉ nằm trong một comment. Assert `expect(sourceRepo).not.toHaveProperty('delete')` soi chính cái **mock** của file test ⇒ không đổi code nào làm nó đỏ được. | Source-guard THẬT quét `src/` (`no-hard-delete-customer-source.spec.ts`), có ca tự kiểm regex. Mutation-test: cắm một `delete()` vào service ⇒ đỏ. |
| 3 | HIGH (web) | Banner báo lỗi backend render ở **thân trang**, trong khi `Dialog` phủ một `.scrim` `position:fixed` + `aria-modal` ⇒ lỗi nằm SAU lớp mờ và NGOÀI cây a11y của modal. Tắt nguồn thất bại (409/mất mạng) ⇒ admin **không thấy gì**, tưởng nút chết, bấm lại. | Banner render **trong** modal khi form mở; `ConfirmDialog` đóng TRƯỚC khi gọi port (nó không có chỗ nào hiện lỗi) ⇒ lỗi rơi về banner trang. |
| 4 | MEDIUM (web) | `fieldError` cũ dính sang dialog kế: 409 ở Sửa → Huỷ → mở Thêm ⇒ ô Tên trống mà đỏ chữ "Tên nguồn này đã có". | `setError(null)` khi mở/đóng form. |
| 5 | MEDIUM (web) | Không chặn double-submit: hai cú bấm Lưu ⇒ `create()` hai lần cùng một tên ⇒ cái sau 409 "tên đã tồn tại" ngay trên màn vừa tạo nó. | Cờ `busy` khoá Lưu/Bật lại khi đang bay; ConfirmDialog đóng ngay nên không còn nút để bấm lần hai. |
| 6 | MEDIUM (web) | `inputMode="numeric"` chỉ là GỢI Ý bàn phím: gõ `3a` ⇒ `Number()` ⇒ `NaN` ⇒ JSON `null` ⇒ 400 khó hiểu. | Ô `sortOrder` chỉ giữ chữ số. Trần vẫn là việc của backend (400 + `fieldErrors`). |

### Còn nợ (KHÔNG chặn story — cần Đại Ca quyết)

- **Bất biến `isOther` vẫn không có DB constraint nào đứng sau.** Seed đã hết đẻ dòng trùng, nhưng một `INSERT` tay/một story sau vẫn tạo được dòng cờ thứ hai. Bịt thật thì cần `CREATE UNIQUE INDEX ... ON customer_sources (is_other) WHERE is_other` — mà đó là **migration mới**, thứ story này cấm tường minh. **Không tự ý làm.** Đề nghị: một story nhỏ riêng.
- **Bốn dòng seed còn lại vẫn khoá theo `name`.** Đổi tên "Facebook" rồi seed lại ⇒ dòng "Facebook" cũ mọc lại thành mục trùng. Không gãy bất biến nào (chỉ dòng cờ mới mang bất biến), và bịt nó cần thêm cột `code` ⇒ đổi schema. Ghi nhận, chưa sửa.
- **TD-1 còn nguyên:** `settings-customer-sources.test.mjs` là guard **quét text**, không render. Nó KHÔNG chứng minh màn chạy được — reviewer chỉ ra hai đột biến giữ guard xanh mà vẫn giết nút "Thử lại" và lời gọi deactivate. Đã thêm guard cho 3 fix web mới (mutation-test đỏ đúng chỗ), nhưng **đừng đọc guard này như bằng chứng hành vi**. Bằng chứng hành vi của nửa web hiện là: `fake-customer-sources-port.test.mjs` (runtime thật, chỉ chứng minh cái fake) + review người đọc.
- **LOW:** `name` toàn khoảng trắng (`"   "`) lọt `@IsNotEmpty()` ở CẢ hai cửa. Không có `@Transform(trim)` ở bất kỳ DTO nào trong repo ⇒ đây là lỗ hổng chung toàn dự án, không phải hồi quy của story này. Chưa sửa (ngoài phạm vi).

### Quality gates (chạy lại sau khi sửa hết)

| Lane | Kết quả |
|---|---|
| `backend npm test` | **616 pass / 0 fail** (45 suite) — trước review: 604 |
| `backend npm run test:db` (Postgres THẬT) | **25 pass / 0 fail** |
| `backend tsc --noEmit` · `eslint` · `prettier --check` | sạch |
| `design-system npm test` | **250 pass / 0 fail** |
| `prisma db seed` chạy 2 lần liên tiếp | 5 dòng / đúng 1 cờ — idempotent |

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-13 | **Review:** regen `openapi.json` (thiếu cả 4 route ghi); `@Max` trần `int4` cho `sortOrder` ở update DTO + test tràn ở CẢ POST lẫn PATCH; `update()` early-return khi không có gì đổi (hết event audit nói dối `before === after`). **HIGH:** seed khoá dòng `isOther` theo CỜ thay vì theo `name` — đổi tên "Khác" rồi seed lại từng đẻ ra dòng cờ THỨ HAI (tái hiện trên Postgres thật). Source-guard cấm hard-delete `customerSource` trong `src/`. Web: lỗi backend không còn render sau lớp scrim của modal, hết dính `fieldError` cũ, chặn double-submit, `sortOrder` hết `NaN`. Status → done. |
| 2026-07-13 | Story 3.5 implement: 4 endpoint ghi `/customer-sources` (gate `settings.manage`; `GET` giữ `customers.manage`), soft-delete-only với dòng `isOther` không tắt được, 4 domain event qua EventBus, màn cấu hình web-only + `CustomerSourcesPort` mới, `PERM.settingsManage`/`AppPerm.settingsManage` + link nav `Cấu hình`. Sửa `@Post(':id/reactivate')` trả 200 theo AC-4. Sửa script `test:db` chạy cả hai file DB. Status → review. |

## Câu hỏi cho Đại Ca (không chặn dev — trả lời được lúc review)

1. **🔴 Web-only đúng ý chứ?** `DESIGN.md:148` + mockup nói **chỉ Web**; `EXPERIENCE.md`/UX-DR-27 nói **mọi màn nghiệp vụ có parity**. Tôi chọn **web-only** (luật riêng có tên thắng luật chung; cấu hình danh mục là việc ngồi bàn). **Hệ quả:** màn này **không có test runtime** nào — nếu dựng thêm bản Flutter thì lại **có** widget test thật (harness Flutter tồn tại; TD-1 chỉ áp cho web). Muốn parity đầy đủ ⇒ **báo trước khi code**.
2. **Tab `Thuế suất VAT`** nằm cùng màn trong mockup nhưng thuộc **FR-3**, chưa có story nào, và phạm vi cấu hình VAT vẫn là `[ASSUMPTION]` trong PRD. Tôi **không** dựng tab đó (tab dẫn tới hư vô = UI nói dối). Cần một story riêng cho VAT — thêm vào Epic 4 hay Epic 8?
3. **`sortOrder` chưa có UI sắp xếp** (mockup vẽ cột `#` chỉ để đọc, không có kéo-thả / nút lên-xuống). Story này cho **sửa số trong form** — đủ dùng, nhưng nếu Đại Ca muốn kéo-thả thì đó là **component DS mới** (không có sẵn) ⇒ story riêng.
4. **Dời cờ `isOther` sang dòng khác phải sửa seed + chạy `db seed`** (Quyết định #1 — không cho ghi cờ qua API). Nếu Đại Ca hình dung sẽ có ngày đổi "Khác" thành một dòng khác **qua giao diện**, báo — khi đó cần một endpoint riêng có khoá kép, không phải một checkbox trong form.
5. **`EXPERIENCE.md` chưa có màn Cấu hình trong IA** (25 màn, nav web không liệt kê "Cấu hình") — vì FR-35 sinh **sau** UX spine. Cần cập nhật `EXPERIENCE.md` cho khớp không, hay để retro Epic 3 gom một thể?
