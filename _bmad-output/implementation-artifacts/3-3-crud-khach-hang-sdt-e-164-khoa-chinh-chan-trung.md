---
baseline_commit: 4de636247619408aa325686a1884815ab213fdce
---

# Story 3.3: CRUD Khách hàng — SĐT E.164 khoá chính, chặn trùng, thêm sourceId/sourceNote

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền quản lý khách hàng** (`customers.manage`),
I want **tạo/sửa Khách hàng với SĐT là khoá chính chuẩn hoá E.164 và ghi nguồn khách**,
so that **mỗi khách được định danh duy nhất trên toàn hệ thống và biết khách đến từ đâu**.

**Phạm vi story này = BACKEND, KHÔNG UI.** Màn danh sách/chi tiết khách + tra SĐT inline là **Story 3.4**. Màn cấu hình Nguồn khách là **Story 3.5**. Nếu thấy mình đang viết `.tsx` hay `.dart` ⇒ **dừng lại, sai story**.

## Acceptance Criteria

**AC-1 — Chuẩn hoá E.164 CHỈ ở backend (AD-9).**
Given client gửi SĐT **thô** (`0912 345 678`, `0912.345.678`, `+84912345678`, `84912345678`),
When backend lưu/tra Khách hàng,
Then domain `customers` chuẩn hoá về **đúng một** dạng E.164 (`+84912345678`) trước khi chạm DB; **PK của `Customer` là chuỗi đã chuẩn hoá**. Client KHÔNG bao giờ tự chuẩn hoá.
**And** hàm chuẩn hoá là **MỘT hàm thuần DUY NHẤT** (`customers/domain/phone.ts`), không phụ thuộc Prisma/Nest — Story 3.4 (tra SĐT) `import` **chính hàm đó**, KHÔNG viết lại.

**AC-2 — SĐT không hợp lệ ⇒ 400, không phải 500.**
Given SĐT rác (`abc`, `123`, `+1650…` số ngoài VN, chuỗi rỗng, 20 chữ số),
When gọi `POST /customers`,
Then trả **400 `VALIDATION_ERROR`** kèm `fieldErrors: [{ field: 'sdt', … }]`. **KHÔNG** ghi vào DB, **KHÔNG** 500.

**AC-3 — Chặn trùng SĐT: một SĐT = một Khách hàng (FR-29).**
Given SĐT đã tồn tại **sau chuẩn hoá**,
When tạo khách mới với SĐT ở **bất kỳ dạng thô nào** phân giải về cùng E.164 (`0912345678` vs `+84912345678` vs `84912345678`),
Then hệ thống **chặn**, trả **409 `CONFLICT`** kèm `fieldErrors: [{ field: 'sdt', code: 'isUnique', … }]`.
**And** việc chặn này được **ràng buộc ở tầng DB** (PK `customers.sdt`), KHÔNG chỉ bằng một câu `if` ở tầng app — xem AC-9.

**AC-4 — Hai Loại khách, hai bộ trường (FR-29).**
Given `custType`,
When nhập dữ liệu,
Then:
- `CA_NHAN` — lưu `name` (họ tên), `cccd`, `address`, `sdt`.
- `THUONG_MAI` — lưu `name` (tên công ty), `taxCode` (MST), `address`, `sdt`, `bankAccount`.
- Field **không thuộc** loại khách đang chọn mà có mặt trong body ⇒ **400** (vd `CA_NHAN` kèm `taxCode` ⇒ từ chối). Fail-closed: không âm thầm nuốt field lạc chỗ rồi để nó nổ ở Hoá đơn (FR-27).
- `custType` chỉ nhận đúng hai giá trị trên ⇒ giá trị khác ⇒ 400.

**AC-5 — `sourceId` BẮT BUỘC, KHÔNG có mặc định (§1).**
Given khách hàng mới,
When tạo,
Then `sourceId` (FK → `CustomerSource`) **bắt buộc**; thiếu ⇒ 400. **KHÔNG** có giá trị mặc định, **KHÔNG** tự chọn "Khác" hộ người dùng.
**And** `sourceId` trỏ tới dòng không tồn tại ⇒ **400** (`fieldErrors.field = 'sourceId'`), không phải 500 do FK violation.

**AC-6 — `sourceNote` bắt buộc KHI nguồn có cờ `isOther` (§1).**
Given nguồn khách được chọn có `isOther = true`,
When tạo/sửa khách mà `sourceNote` rỗng/thiếu,
Then **400** kèm `fieldErrors: [{ field: 'sourceNote', … }]`.
**And** backend nhận biết "Khác" **bằng cờ `isOther`**, **KHÔNG** bằng so chuỗi tên (`name === 'Khác'` ⇒ **sai, fail review**).
**And** nguồn **không** `isOther` thì `sourceNote` là optional (nhập cũng được, để trống cũng được).

**AC-7 — `sdt` là BẤT BIẾN sau khi tạo.**
Given khách đã tồn tại,
When `PATCH /customers/:sdt` với body chứa `sdt`,
Then **400**. Đổi SĐT = đổi danh tính (PK), Epic 4 sẽ FK vào đây — không có đường đổi PK trong story này.

**AC-8 — Mọi thay đổi Khách hàng ghi Audit qua EventBus (AD-18).**
Given tạo/sửa Khách hàng,
When write commit **xong**,
Then publish `CustomerCreated` / `CustomerUpdated` qua **`EventBus` port** (before/after = snapshot đầy đủ) ⇒ `AuditSubscriber` ghi `AuditLog`.
**And** service **CHỈ** inject `PrismaService` + `EventBus` — **CẤM** inject `AuditService`/`NotificationDispatcher` (source-guard sẽ fail).

**AC-9 — 🔴 Ràng buộc DB được CHỨNG MINH trên Postgres THẬT (nợ kỹ thuật đến hạn).**
Given Postgres đã chạy (container `pns-postgres`, 6 migration đã `deploy`),
When chạy lane test tích hợp mới,
Then chứng minh **bằng DB thật**, không phải bằng mock:
- PK `customers.sdt` **thực sự** chặn insert trùng (Prisma ném `P2002`).
- FK `customers.source_id → customer_sources.id` **thực sự** chặn `sourceId` ma.
- Migration mới chạy được `prisma migrate deploy` trên DB có sẵn 6 migration cũ (**không** phải trên DB rỗng).
**And** lane này **tự SKIP khi vắng `DATABASE_URL`/Postgres** ⇒ `npm test` mặc định vẫn hermetic, không ai bị chặn.
**And** đây là lần đầu repo kiểm được ràng buộc tầng DB — **KHÔNG** dùng nó để nhận vơ rằng các ràng buộc của story 3.1/3.2 đã được kiểm.

**AC-10 — `CustomerSource` + seed 5 dòng (§1).**
Given `Customer.sourceId` là FK **bắt buộc**,
When story này chạy,
Then bảng `CustomerSource { id, name, description, active, sortOrder, isOther }` được tạo **trong story này** (xem "Quyết định lớn" #2) và seed **5 dòng**: Facebook, Zalo, Fanpage, Đại lý, Khác — mỗi dòng có `description` một câu, `active`, `sortOrder`; **đúng MỘT dòng** `isOther = true` (Khác).
**And** seed **idempotent** (chạy lại không nhân đôi — `upsert`).
**And** story này **KHÔNG** làm CRUD/màn cấu hình Nguồn khách (đó là **Story 3.5**) — chỉ bảng + seed + endpoint **đọc** danh sách nguồn (`GET /customer-sources`) để form khách có cái mà chọn.

**AC-11 — Không thêm permission key, không regen `permissions.json`.**
Given `PERM.customersManage` (`customers.manage`) **ĐÃ CÓ SẴN** trong registry từ Story 2.4,
When gate endpoint,
Then **dùng lại** nó — **KHÔNG** thêm key mới, **KHÔNG** chạy `permissions:gen`, **KHÔNG** đụng generator FE.
**And** **MỌI** handler khai `@RequirePermissions(...)` — không handler nào `@Public()` (source-guard `no-handler-without-require-permissions` fail-closed).

**AC-12 — OpenAPI regen; cổng chất lượng sạch.**
`npm run openapi:gen` chạy lại, `openapi.json` commit kèm (drift-guard xanh). `npm test` · `npm run lint` · `npm run format:check` · `nest build` đều sạch. **0 regression** trên 370 test hiện có.

## Tasks / Subtasks

- [x] **Task 1 — Domain chuẩn hoá SĐT (AC-1, AC-2)**
  - [x] `npm i libphonenumber-js` (xem "Quyết định lớn" #1 — đây là quyết định của story, đọc trước khi tự viết regex)
  - [x] `src/customers/domain/phone.ts` — **thuần**, không Nest/Prisma: `normalizeVnPhone(raw: string): string | null` → E.164 `+84…` hoặc `null` nếu không hợp lệ. Dùng `parsePhoneNumberFromString(raw, 'VN')` + `.isValid()` + `.number`.
  - [x] `test/phone.spec.ts` — bảng ca: `0912345678` · `0912 345 678` · `0912.345.678` · `+84912345678` · `84912345678` **⇒ cùng một** `+84912345678`. Rác (`abc`, `''`, `123`, 20 chữ số, số Mỹ `+16505550123`) ⇒ `null`. **Số cố định VN** (vd `02838221234`) ⇒ hợp lệ, không được reject.
- [x] **Task 2 — Schema + migration + seed (AC-3, AC-5, AC-10)**
  - [x] `prisma/schema.prisma` — + `CustomerSource`, + `Customer` (`sdt String @id`), + back-relation `CustomerSource.customers`
  - [x] Sinh migration: `npx prisma migrate diff --from-schema <schema cũ> --to-schema prisma/schema.prisma --script` ⚠️ **Prisma 7 chỉ nhận `--from-schema`/`--to-schema`** (KHÔNG `--from-schema-datamodel`). Schema "trước" lấy bằng `git show HEAD:backend/prisma/schema.prisma`.
  - [x] Tên migration: `20260713020000_add_customers_and_customer_sources`
  - [x] `prisma/seed.ts` — + seed 5 `CustomerSource` (`upsert` theo `name`, idempotent), đúng một `isOther`
  - [x] **Chạy thật:** `npx prisma migrate deploy` trên `pns-postgres` (DB đã có 6 migration) + `npx prisma db seed`
- [x] **Task 3 — Module `customers/` (AC-4..AC-8, AC-11)**
  - [x] `customers/customers.module.ts` (import `AccountsModule`; **KHÔNG** import `PrismaModule`/`EventsModule` — cả hai `@Global`)
  - [x] `customers/customers.controller.ts` — `POST /customers` · `GET /customers` · `GET /customers/:sdt` · `PATCH /customers/:sdt`; **mọi** handler `@RequirePermissions(PERM.customersManage)`
  - [x] `customers/customer-sources.controller.ts` — `GET /customer-sources` (chỉ ĐỌC; CRUD = Story 3.5)
  - [x] `customers/customers.service.ts` — inject **đúng** `PrismaService` + `EventBus`
  - [x] `customers/customer-sources.service.ts` — đọc danh mục nguồn (`active` mặc định)
  - [x] `customers/domain/customer-events.ts` — `CustomerCreated`, `CustomerUpdated` (+ `CustomerSnapshot`)
  - [x] `customers/domain/customer-type.ts` — `CUST_TYPE = { caNhan: 'CA_NHAN', thuongMai: 'THUONG_MAI' } as const` (khuôn registry `as const`, KHÔNG Postgres enum)
  - [x] `customers/dto/` — `create-customer-request.dto.ts` · `update-customer-request.dto.ts` · `customer-response.dto.ts` · `customer-source-response.dto.ts`
  - [x] `app.module.ts` — + `CustomersModule`
- [x] **Task 4 — Luật nghiệp vụ trong service (AC-4, AC-5, AC-6, AC-7)**
  - [x] Thứ tự kiểm trong `create()`: chuẩn hoá SĐT (400 nếu `null`) → nạp `CustomerSource` theo `sourceId` (400 nếu không có) → `isOther` ⇒ đòi `sourceNote` (400) → kiểm field lạc-loại-khách (400) → `prisma.customer.create` → dịch `P2002` ⇒ **409** → publish event **sau commit**
  - [x] `update()`: body có `sdt` ⇒ 400 (AC-7). Đổi `sourceId` ⇒ **kiểm lại** luật `isOther`/`sourceNote` trên nguồn MỚI (đừng chỉ kiểm lúc tạo).
  - [x] Tái dùng helper `P2002`: **trích** `isUniqueViolation` (hiện là hàm module-scope trong `catalog/products.service.ts:78`) ra `src/common/errors/prisma-unique-violation.ts`, cho **cả hai** service import. Hai call-site = đúng ngưỡng DRY. ⚠️ `products.service.ts` phải giữ **hành vi y nguyên**, `products.*.spec.ts` phải **xanh không sửa**.
- [x] **Task 5 — Test hermetic (AC-1..AC-8)**
  - [x] `test/phone.spec.ts` (pure — Task 1)
  - [x] `test/customers.service.spec.ts` — mock Prisma; ma trận `custType` × field lạc chỗ; `isOther` ⇒ đòi `sourceNote`; `P2002` ⇒ 409; publish **sau** commit
  - [x] `test/customers.e2e.spec.ts` — 403 khi thiếu `customers.manage`; 400 SĐT rác; 409 trùng (gửi **dạng thô khác nhau**, cùng E.164); 400 `sdt` trong PATCH; event tới `AuditSubscriber` thật
  - [x] ⚠️ **Test `null` tường minh** cho mọi field optional — mock Prisma **nuốt `null` không kêu ca** (bài học 3.1)
- [x] **Task 6 — 🔴 Lane test tích hợp DB thật (AC-9)** — *đây là phần trả nợ, đừng bỏ*
  - [x] `test/customers.db.integration.spec.ts` — kết nối Postgres thật qua `DATABASE_URL`; **`describe.skip` khi vắng DB** (không chặn ai)
  - [x] Chứng minh: insert trùng `sdt` ⇒ `P2002` **từ DB** · `sourceId` ma ⇒ FK violation · rollback `$transaction` thật
  - [x] Script riêng trong `package.json` (vd `test:db`) để CI/dev gọi có chủ đích; `npm test` **giữ nguyên hermetic**
- [x] **Task 7 — Cổng chất lượng (AC-12)**
  - [x] `npm run openapi:gen` + commit `openapi.json`; **verify tường minh** `CustomerResponseDto` có mặt trong `components.schemas` (drift-guard xanh **không** chứng minh hợp đồng đúng — bài học 3.2 AC-10)
  - [x] `npm test` · `npm run lint` · `npm run format:check` · `nest build`
  - [x] **Mutation-test** (luật 2.10 — chứng minh test không xanh-giả): (a) bỏ nhánh `isOther ⇒ đòi sourceNote`; (b) trả thẳng `raw` thay vì SĐT đã chuẩn hoá; (c) bỏ dịch `P2002` ⇒ 409. **Cả ba phải ĐỎ**, xanh lại sau khi khôi phục.

## Dev Notes

### Quyết định lớn của story này (đã cân nhắc — đừng lật ở review mà không có bằng chứng mới)

#### 1. 🔴 Chuẩn hoá E.164 dùng **`libphonenumber-js`**, KHÔNG tự viết regex

Đây chính là **action item mở của Epic 2 retro** ("Chốt cách chuẩn hoá SĐT E.164 (thư viện vs tự viết) trước khi code Story 3.3", owner: Winston) — story này **chốt nó**, và đây là câu hỏi #1 cuối file.

| Căn cứ | Nội dung |
|---|---|
| **SĐT là KHOÁ CHÍNH** | Chuẩn hoá sai ⇒ **hai bản ghi cho cùng một người** — đúng cái mà AD-9 tồn tại để chặn. Sai ở đây không phải lỗi hiển thị, mà là **hỏng danh tính**, và Epic 4/5/7 sẽ FK vào nó. |
| **Kế hoạch số VN có bẫy thật** | Chuyển đổi đầu số 2018 (`0120…`→`070…`, `0121…`→`079…`…), số cố định có **mã vùng dài ngắn khác nhau**, di động 10 số nhưng cố định cũng 10 số. Một regex "10 chữ số bắt đầu bằng 0" sẽ **từ chối số cố định hợp lệ** (`02838221234` — số công ty, mà khách Thương mại thì hay dùng đúng loại số này) hoặc **nhận số rác**. |
| **Rẻ** | Backend-only, không network, metadata tĩnh, deterministic ⇒ test hermetic vẫn chạy. Một dependency. |
| **Luật dự án** | project-context: "khi phân vân chọn phương án **an toàn/chặt hơn**". |

**API dùng:** `parsePhoneNumberFromString(raw, 'VN')` → `.isValid()` → `.number` (trả `+84…`). Bọc trong **một** hàm thuần `normalizeVnPhone()` — phần còn lại của hệ thống **không import thư viện trực tiếp**, chỉ import hàm này. Đổi thư viện sau ⇒ sửa một file.

⚠️ **Vì sao phải bọc:** AD-9 nói "tra SĐT (Story 3.4) chạy **CÙNG MỘT** bộ chuẩn hoá trước khi kiểm duy nhất". Hai chỗ gọi thư viện trực tiếp = hai cơ hội lệch tham số. Một hàm = một sự thật.

#### 2. `CustomerSource` (bảng + seed) thuộc story NÀY, không phải 3.5 — **bắt buộc, không phải sở thích**

`Customer.sourceId` là FK **bắt buộc** (AC-5). Không có bảng `customer_sources` thì story 3.3 **không chạy được một dòng nào**. Vì vậy:

| Thuộc Story 3.3 (story này) | Thuộc Story 3.5 |
|---|---|
| Bảng `CustomerSource` + migration | CRUD endpoint (POST/PATCH/DELETE) |
| Seed 5 dòng (idempotent) | Màn cấu hình + gate `settings.manage` |
| `GET /customer-sources` (chỉ đọc — để form khách có cái mà chọn) | Luật "không xoá/deactivate dòng `isOther`" |
| Cờ `isOther` + luật `sourceNote` | Audit khi đổi tên nguồn |

⚠️ **Story 3.5 KHÔNG được tạo lại migration/bảng này.** Ghi vào Completion Notes để 3.5 đọc được.

Vì sao không đảo thứ tự chạy 3.5 trước? Sprint order + epics đã cố định 3.3 → 3.5, và 3.4 (tra SĐT) chặn sau 3.3. Đảo thứ tự là **thay đổi phạm vi sprint** — quyết định của Đại Ca, không phải của dev agent.

#### 3. Bộ trường bắt buộc: **`sdt` + `custType` + `name` + `sourceId`** (+ `sourceNote` nếu `isOther`). `cccd`/`taxCode`/`address`/`bankAccount` là **optional**

Đây là **judgment call**, phải nói rõ (câu hỏi #2 cuối file):

- FR-29 nói Cá nhân "**lưu**: họ tên, CCCD, địa chỉ, SĐT" — "lưu" = **có chỗ chứa**, KHÔNG phải "bắt buộc nhập lúc tạo".
- **Story 3.4 đòi tạo khách INLINE giữa lúc dựng báo giá** (epics 3.4: *"tra SĐT chọn/tạo khách ngay tại chỗ, so that dựng đơn nhanh mà không rời màn"*). Bắt gõ CCCD/MST/số tài khoản NH ngay lúc đó ⇒ **giết chết chính luồng mà 3.4 tồn tại để phục vụ**. Sale đang có khách trên điện thoại, không có CCCD trong tay.
- MST **thật sự** cần thiết ở **Hoá đơn (FR-27)**, CCCD ở **Hợp đồng (FR-13)**. Đó là nơi đúng để **chặn thiếu field** — tại cổng dùng nó, không phải tại cổng tạo lead.

⇒ Story này: bắt buộc **cái định danh** (`sdt`, `name`, `custType`) + **cái mà §1 nói bắt buộc** (`sourceId`, `sourceNote`-khi-`isOther`). Phần còn lại nullable. **KHÔNG** tự ý siết chặt hơn — nếu Đại Ca muốn bắt buộc CCCD/MST ngay lúc tạo, đó là thay đổi ảnh hưởng AC của Story 3.4.

#### 4. Một bảng, cột nullable — KHÔNG hai bảng, KHÔNG bảng con theo loại khách

`name` và `address` có ở **CẢ HAI** loại khách ⇒ **một cột mỗi thứ** (đừng đẻ `fullName` + `companyName` rồi phải UNION khắp nơi). `cccd` chỉ Cá nhân; `taxCode` + `bankAccount` chỉ Thương mại ⇒ nullable, ràng buộc **chéo-field ở tầng app** (AC-4), không phải ở DB. Khớp ERD spine (`CUSTOMER { string sdt PK, string custType, uuid sourceId FK, string sourceNote }`) — ERD chỉ vẽ cái khung định danh, các cột dữ liệu là chi tiết của FR-29.

`custType` lưu **String** + validate `@IsIn` ở tầng app — **KHÔNG** Postgres enum. Nhất quán với `AccountPermission.permission` (`schema.prisma:55`) và ERD ("string custType"): registry evolve không cần migration enum.

#### 5. Tên field theo **ERD spine**: `sdt`, `custType`, `sourceId`, `sourceNote`

ERD spine (:283-288) viết **nguyên văn** `sdt`. Không đổi thành `phone`/`phoneNumber` — spine là artifact **ADOPTED**, và Epic 4..7 sẽ tham chiếu tên này. Cột DB snake_case (`cust_type`, `source_id`, `source_note`) theo CONVENTIONS.

### Ràng buộc kiến trúc bắt buộc (vi phạm = fail guard hoặc fail review)

| Ràng buộc | Nguồn | Hệ quả cụ thể cho story này |
|---|---|---|
| Chuẩn hoá SĐT **CHỈ ở backend** | AD-9 | **Cấm** mọi logic chuẩn hoá ở `web/`/`mobile/`. Client gửi chuỗi thô. |
| **MỘT** bộ chuẩn hoá dùng chung | AD-9 | `normalizeVnPhone()` là hàm **DUY NHẤT**; 3.4 import lại, không viết bản thứ hai. |
| **EventBus** cho mọi side-effect | AD-18 | Chỉ inject `EventBus`. Cấm `AuditService`/`NotificationDispatcher`. Publish **SAU** commit. |
| **Permission registry** là SSOT | AD-17 | Import `PERM.customersManage`. **Cấm literal `'customers.manage'`** ở bất kỳ file nào — **kể cả trong `example:` của `@ApiProperty`** (guard quét string, đã cắn ở 3.1). |
| Guard **fail-closed** mỗi handler | AD-4, Story 2.10 | **Mọi** handler `@RequirePermissions`. Method **thường**, thụt **2 space** (guard tính arrow-function property là offender). |
| Error envelope **một chỗ** | AD-5 | `throw new AppException(...)`. **Cấm** token `traceId` trong `src/`. Tái dùng `ErrorCode` có sẵn (`VALIDATION_ERROR`/`CONFLICT`/`NOT_FOUND`/`FORBIDDEN`) — **không thêm mã lỗi mới**. |
| Prisma là **điểm truy cập DB duy nhất** | AD-1 | Chỉ `PrismaService`. `new PrismaClient` chỉ được phép trong `prisma/seed.ts` (script CLI, guard chỉ quét `src/`). |
| OpenAPI **sinh từ code** | AD-12 | Không sửa tay `openapi.json`; chạy `openapi:gen`. |

### 🔴 Nợ kỹ thuật đến hạn ở CHÍNH story này — Postgres đã sẵn sàng

project-context ghi thẳng: *"Ràng buộc tầng DB (unique constraint, FK, PK) **chưa được kiểm** — mock không chứng minh được chúng. **Đến hạn ở Epic 3 (Story 3.3 'chặn trùng SĐT' là ràng buộc DB)**."* Review 3.2 nhắc lại y hệt.

**Tin tốt — hạ tầng nay đã có (đã verify khi soạn story này, 2026-07-13):**

```
docker ps  → pns-postgres  postgres:18  Up  0.0.0.0:5432->5432/tcp
DB phuong_nam_solar / user pns_app  →  9 bảng, 6/6 migration đã applied:
  20260708000000_init_auth_accounts_sessions … 20260713010000_add_feature_flags_and_product_prices
```

⇒ Story này **KHÔNG** được lặp lại câu "migration sinh offline, chưa kiểm ràng buộc". `migrate deploy` **chạy được ngay**, và AC-9 đòi một lane integration chứng minh PK + FK **thật sự** enforce.

**Vì sao mock KHÔNG đủ (đọc kỹ, đây là lỗi đã xảy ra hai lần ở repo này):** mock Prisma chỉ chứng minh *"service dịch đúng lỗi **khi** Prisma ném ra"*. Nó **không** chứng minh Postgres thật sự ném. AC-3 ("chặn trùng SĐT") mà chỉ có mock ⇒ **xanh bằng lời hứa**.

**Ranh giới:** lane integration **tự SKIP khi vắng DB** ⇒ `npm test` mặc định vẫn hermetic (39 suite/370 test), không ai bị chặn khi không bật Docker.

### Điểm nối với Story 3.4 và Epic 4 (viết cho người sau dùng)

- **Story 3.4** (`tra SĐT chọn/tạo khách inline`) sẽ `import { normalizeVnPhone }` — giữ nó **thuần, không đụng Prisma/Nest**, y như `resolveUnitPrice` của 3.2. Đó là toàn bộ "API" story này để lại.
- **Story 3.4** cũng phải quyết **quyền cho endpoint tra SĐT**: sale dựng báo giá có `quotes.create_edit` nhưng **chưa chắc** có `customers.manage`. Story này **cố ý không** giải quyết trước (YAGNI) — chỉ ghi lại để 3.4 không bị bất ngờ.
- **Story 4.1** sẽ **snapshot `Order.sourceId`** copy từ `Customer.sourceId` lúc tạo đơn (§1: khách quay lại qua kênh khác thì đơn cũ vẫn giữ kênh đã mang nó về — cùng bài học `unitPriceSnapshot`). Story này chỉ cần **không cản đường**: `Customer.sourceId` luôn có giá trị (bắt buộc) ⇒ 4.1 luôn có cái để copy.
- ⚠️ Nếu thấy mình đang `import` gì từ `orders/` ⇒ **dừng, sai hướng**.

### Testing

- Vị trí: **mọi spec nằm phẳng ở `backend/test/`**. Unit = `<subject>.spec.ts`; e2e = `<subject>.e2e.spec.ts`; integration DB = `<subject>.db.integration.spec.ts`.
- Lệnh: `cd backend && npm test` (Jest, hermetic, **không cần Postgres**). Lane DB: script riêng.
- Mock Prisma: object `jest.fn()` cast `as unknown as PrismaService` (**không** `jest-mock-extended`).
- e2e: `Test.createTestingModule({ imports: [AppModule] })` + `.overrideProvider(PrismaService | AccountsService | AccountPermissionsService)`; quyền giả lập bằng `accountPermissionsMock.listForAccount.mockResolvedValue(new Set([...]))`; JWT thật ký qua `moduleRef.get(JwtService)`. Nhớ mock **`prismaMock.customer` + `prismaMock.customerSource` + `auditLog`** — thiếu ⇒ mọi request thành 500 (bài học AC-11 của 3.2).
- **Bắt buộc test cho phần dễ sai** (project-context): chuẩn hoá SĐT (biên!), chặn trùng, luật `isOther`/`sourceNote`, ma trận field lạc-loại-khách, 403 khi thiếu quyền.

### Project Structure Notes

```
backend/
  package.json                                   # UPDATE: + libphonenumber-js, + script test:db
  prisma/
    schema.prisma                                # UPDATE: + Customer, + CustomerSource
    seed.ts                                      # UPDATE: + seed 5 CustomerSource (idempotent)
    migrations/20260713020000_add_customers_and_customer_sources/  # NEW
  src/
    app.module.ts                                # UPDATE: + CustomersModule
    common/errors/
      prisma-unique-violation.ts                 # NEW — trích từ catalog/products.service.ts:78 (2 call-site = ngưỡng DRY)
    catalog/
      products.service.ts                        # UPDATE: import helper đã trích (HÀNH VI Y NGUYÊN)
    customers/                                   # NEW — module domain
      customers.module.ts
      customers.controller.ts                    # /customers
      customer-sources.controller.ts             # /customer-sources (chỉ ĐỌC; CRUD = 3.5)
      customers.service.ts
      customer-sources.service.ts
      domain/
        phone.ts                                 # NEW — pure: normalizeVnPhone()  ← 3.4 import cái này
        customer-type.ts                         # NEW — pure: CUST_TYPE as const
        customer-events.ts                       # NEW — pure: CustomerCreated/CustomerUpdated
      dto/
        create-customer-request.dto.ts
        update-customer-request.dto.ts
        customer-response.dto.ts
        customer-source-response.dto.ts
  openapi/openapi.json                           # UPDATE: `npm run openapi:gen`
  test/
    phone.spec.ts                                # NEW (pure)
    customers.service.spec.ts                    # NEW
    customers.e2e.spec.ts                        # NEW
    customers.db.integration.spec.ts             # NEW — 🔴 AC-9, skip khi vắng DB
```

**Tái dùng, KHÔNG viết lại** (scout-before-code — đã scout, đây là kết quả):

- `PrismaService` (`@Global`), `EventBus` + `DomainEvent` (`src/events/`, `@Global`) — chỉ inject, **không import module**.
- `AppException` + `ErrorCode` (`src/common/errors/`) — **đã có** `VALIDATION_ERROR`/`FORBIDDEN`/`NOT_FOUND`/`CONFLICT` ⇒ **không thêm mã lỗi mới**.
- `@RequirePermissions`, `@CurrentAccount`, `AuthenticatedAccount` (`src/auth/`).
- `PERM.customersManage` — **đã có sẵn** trong registry (`permission-registry.ts:55`) và **đã nằm trong `ADMIN_PRESET` + `QUAN_LY`** (`role-presets.ts:43,72`) ⇒ không đụng preset, không regen `permissions.json`.
- `@IsOptionalNotNull()` (`src/catalog/dto/is-optional-not-null.decorator.ts`) — **dùng cho MỌI field optional**. Xem bài học #1 dưới.
- Khuôn service: `catalog/products.service.ts` (inject Prisma+EventBus, publish sau commit, `AppException`, dịch `P2002` ⇒ 409 + `fieldErrors`).
- Khuôn event: `catalog/domain/product-events.ts` (snapshot đầy đủ, domain thuần).
- Khuôn registry `as const`: `accounts/domain/permission-registry.ts` (áp cho `customer-type.ts`).
- Khuôn e2e: `test/products.e2e.spec.ts` (dynamic import `AppModule`, `JWT_ACCESS_SECRET` top-level, mock `auditLog`).
- Global `ValidationPipe` (`whitelist: true`) — `common/common.module.ts`. **Không** tự tạo pipe. **Không** re-register guard (`APP_GUARD` ở `AuthModule`).

**Naming guard:** mọi tên file kebab-case, mọi dot-segment khớp `^[a-z0-9]+(-[a-z0-9]+)*$` (`customers.db.integration.spec.ts` hợp lệ).

### Previous Story Intelligence (3.1 + 3.2 — cùng nhánh Epic 3, đọc kỹ, đây là máu đã đổ)

1. **🔴 Bài học đắt nhất (lỗi HIGH review 3.1): `@IsOptional()` cho `null` lọt qua.** `@IsOptional()` tắt **mọi** validator khi giá trị là `undefined` **HOẶC `null`** ⇒ `{"name": null}` đi thẳng xuống cột NOT NULL ⇒ **500** thay vì **400**. Và `PartialType(...)` **tự gắn `@IsOptional()` lên MỌI field** ⇒ hở toàn bộ. ⇒ **Story này: dùng `@IsOptionalNotNull()`, CẤM `PartialType`.** Mock Prisma **nuốt `null` không kêu ca** ⇒ phải viết test `null` **tường minh**.
2. **🔴 Bài học CRITICAL review 3.2: test đếm số lần gọi, không assert payload ⇒ xanh-giả.** Đột biến hoán vị hai field vẫn xanh 37/37. ⇒ **Story này: assert `prisma.customer.create` được gọi với `data` ĐÚNG** (nhất là `sdt` phải là chuỗi **đã chuẩn hoá**, không phải `raw`). Đây chính là mutation-test (b) ở Task 7.
3. **🟠 Bài học HIGH review 3.2: thiếu trần trên ⇒ tràn INT4 / lọt mảng lồng.** ⇒ Story này ít số hơn, nhưng **field chuỗi cần `@MaxLength`** (`name`, `address`, `sourceNote`, `cccd`, `taxCode`, `bankAccount`) — đừng để chuỗi 10MB xuống DB. Và `@IsString()` (không phải chỉ `@IsNotEmpty()`) để mảng/object lồng bị chặn.
4. **Guard `no-permission-literal-outside-registry` quét sau khi strip comment nhưng GIỮ NGUYÊN string** ⇒ literal `'customers.manage'` trong `@ApiProperty({ example: … })` **cũng fail**. Dùng `PERM.*`.
5. **Guard `no-handler-without-require-permissions` fail-closed:** handler hình dạng lạ (arrow-function property, thụt lề ≠ 2 space) bị tính là offender.
6. **Prisma 7 gotcha:** `datasource db` **không** chứa `url` (ở `prisma.config.ts`) · CLI chỉ nhận `--from-schema`/`--to-schema` · field Json nullable dùng `Prisma.JsonNull` (liên quan: `before`/`after` của event chảy vào `AuditLog`) · `createMany({ data: [] })` mảng rỗng làm hỏng atomic-replace.
7. **`stripCostPrice` dùng copy + `delete` key**, không rest-destructuring (ESLint `no-unused-vars` không bật `ignoreRestSiblings`).
8. **Quyền resolve 2 lần/request** (guard + controller) — đã ghi nhận LOW ở 3.1, **không sửa trong story này**. Story này **không** cần `canViewCosts` (không có giá vốn) ⇒ controller `customers` **không** cần inject `AccountPermissionsService`… trừ khi có nhu cầu thật. **Đừng** copy-paste `canViewCosts` vào đây theo quán tính.
9. **⚠️ Bài học QUY TRÌNH (review 3.2):** mutation-test song song trên **chung một working tree** ⇒ reviewer đọc phải file đang bị reviewer khác đột biến, rồi báo CRITICAL giả. Nếu chạy nhiều reviewer, **re-verify mọi phát hiện trên file hiện tại**.

### Git Intelligence (5 commit gần nhất)

`4de6362` story 3.2 (giá phân tầng sau cờ — `FeatureFlag` + `ProductPrice` + `resolveUnitPrice`) · `0fba7c2` story 3.1 (CRUD Product + 4 cột mới) · `710333c` story 2.10 (không-leo-thang + **source-guard `@RequirePermissions`**) · `3a00af9` story 2.9 (3 quyền mới) · `a669eca` story 1.12.

⇒ Khuôn module domain của Epic 3 **đã ổn định ở `catalog/`** (controller resolve context → truyền xuống service thuần Prisma+EventBus). `customers/` là **module domain thứ hai** — theo **cùng khuôn**, đừng phát minh khuôn mới. Commit conventional, **không tham chiếu AI**.

### Library / Framework

Node 24 LTS · NestJS 11.1.27 · Prisma 7.8.0 · PostgreSQL 18.4 (**đang chạy**: container `pns-postgres`) · class-validator + `@nestjs/swagger` (không zod).

**Dependency MỚI (duy nhất):** `libphonenumber-js` — chuẩn hoá/validate E.164. Backend-only, không network, metadata tĩnh. Cài bản stable mới nhất lúc code (`npm i libphonenumber-js`), ghim version vào `package.json` như mọi dep khác. Import mặc định (`from 'libphonenumber-js'`) là đủ — **không** cần bundle `/max` (story này không phân biệt di động/cố định).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3:375-381] — AC gốc (E.164 khoá chính, chặn trùng, `sourceId` bắt buộc, `sourceNote` khi `isOther`).
- [Source: epics.md#Story-3.4:383-387] — tra SĐT chạy **cùng bộ chuẩn hoá**; tạo khách **inline** (căn cứ cho quyết định #3: field optional).
- [Source: epics.md#Story-3.5:389-396] — CRUD + màn cấu hình Nguồn khách + gate `settings.manage` ⇒ **KHÔNG** thuộc story này.
- [Source: prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-29:392-398] — SĐT là khoá chính; bộ trường hai Loại khách; một SĐT = một Khách hàng; dữ liệu chảy vào Đơn/HĐ/Hoá đơn.
- [Source: prd.md:62] — Glossary: Khách hàng định danh bằng SĐT; hai Loại khách; không có tài khoản đăng nhập ở Phase 1.
- [Source: architecture/…/ARCHITECTURE-SPINE.md#AD-9:96-100] — chuẩn hoá **chỉ** ở backend `customers`; client gửi thô; lookup-or-create dùng **cùng** bộ chuẩn hoá.
- [Source: ARCHITECTURE-SPINE.md#Conventions:181] — ID UUID v4 cho mọi entity **trừ** `Customer` (PK = SĐT E.164).
- [Source: ARCHITECTURE-SPINE.md#ERD:283-288,340-347] — `CUSTOMER { sdt PK, custType, sourceId FK, sourceNote }` · `CUSTOMER_SOURCE { id PK, name, description, active, sortOrder, isOther }`.
- [Source: ARCHITECTURE-SPINE.md:436,472] — module tree `customers/` · Capability map FR-29 → `customers/` (AD-9).
- [Source: ARCHITECTURE-SPINE.md#AD-18:150-154] — mọi hành động nghiệp vụ publish domain event; producer không gọi audit trực tiếp.
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md:17-23] — `CustomerSource` 6 cột · seed 5 dòng · `isOther` đúng một dòng, nhận biết **bằng cờ không bằng tên** · `sourceId` bắt buộc không mặc định · `sourceNote` bắt buộc khi `isOther` · `Order.sourceId` snapshot (Story 4.1).
- [Source: backend/src/catalog/products.service.ts] — khuôn service (Prisma+EventBus, publish sau commit, `P2002` ⇒ 409 + `fieldErrors`); `isUniqueViolation` ở `:78` là hàm cần trích.
- [Source: backend/src/catalog/domain/product-events.ts] — khuôn domain event thuần + snapshot đầy đủ cho audit.
- [Source: backend/src/accounts/domain/permission-registry.ts:55] — `PERM.customersManage` **đã tồn tại**.
- [Source: backend/src/accounts/domain/role-presets.ts:43,72] — `customers.manage` đã có trong `ADMIN_PRESET` + `QUAN_LY`.
- [Source: backend/CONVENTIONS.md#Prisma-map] — entity PascalCase → bảng snake_case số nhiều; mỗi story sở hữu entity của nó.
- [Source: backend/CONVENTIONS.md#Error-envelope] — mã lỗi **domain** do story sở hữu tự khai; envelope chỉ dựng ở filter.
- [Source: _bmad-output/project-context.md:79] — "Ràng buộc tầng DB chưa được kiểm… **đến hạn ở Story 3.3**".
- [Source: _bmad-output/implementation-artifacts/3-2-gia-phan-tang-sau-co.md#Senior-Developer-Review] — CRITICAL payload không assert ⇒ xanh-giả; HIGH mảng lồng + tràn INT4; bài học mutation-test song song.
- [Source: 3-1-crud-san-pham-gia.md#Senior-Developer-Review] — HIGH `@IsOptional()` + `null`; cấm `PartialType`.
- [Source: sprint-status.yaml#action_items] — action item Epic 2 mở: *"Chốt cách chuẩn hoá SĐT E.164 (thư viện vs tự viết) trước khi code Story 3.3"* ⇒ **story này chốt** (Quyết định #1).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, workflow `bmad-dev-story`).

### Debug Log References

Ba lỗi gặp phải khi chạy, và cách xử lý:

1. **`prisma db seed` không chạy nổi** — `prisma/seed.ts` (từ Story 2.3) ném lỗi nếu vắng `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, mà `.env` của máy này không có hai biến đó ⇒ seed **thoát trước khi** chạm tới danh mục nguồn khách. Nhưng `Customer.sourceId` là FK bắt buộc: dữ liệu tham chiếu KHÔNG được phép phụ thuộc vào việc máy đó có credential admin hay không. ⇒ Tách `seedAdminAccount()` ra, cho nó **tự bỏ qua khi vắng CẢ HAI** biến (vẫn ném lỗi nếu chỉ có một — đó là cấu hình gõ nhầm, không phải chủ ý). Seed nguồn khách chạy độc lập.
2. **`@IsAbsent` chặn nhầm MỌI request PATCH** — bản đầu kiểm `'sdt' in object`, nhưng `class-transformer` **dựng sẵn mọi key đã khai** của DTO ⇒ `in` luôn đúng ⇒ mọi PATCH hợp lệ cũng 400. ⇒ Đổi sang kiểm `value !== undefined`. (Test bắt được ngay: 3 test PATCH hợp lệ đỏ.)
3. **`openapi:gen` vỡ vì `sdt?: never`** — `@nestjs/swagger` không phân giải được kiểu `never` và báo "circular dependency". ⇒ Khai `sdt?: string` + `@ApiPropertyOptional({ type: String })`; hợp đồng thật (gửi lên ⇒ 400) do `@IsAbsent` enforce, không phải do kiểu TS.

**Mutation test (luật 2.10 — chứng minh test không xanh-giả).** Bốn đột biến, mỗi cái phải làm test ĐỎ, và xanh lại sau khi khôi phục (73/73):

| Đột biến | Kết quả |
|---|---|
| (a) Bỏ luật `isOther ⇒ đòi sourceNote` ở `create()` | **3 ĐỎ** (đúng các test AC-6) |
| (a2) Nhận biết "Khác" bằng **so tên** `name === 'Khác'` thay vì cờ `isOther` | **1 ĐỎ** — đúng cái AC-6 cấm |
| (b) Ghi `dto.sdt` **thô** xuống PK thay vì chuỗi đã chuẩn hoá | **6 ĐỎ** |
| (c) Bỏ dịch `P2002` ⇒ 409 | **5 ĐỎ** |

⚠️ Ghi lại cho người sau: hai đột biến đầu tiên tôi thử (`return;` thừa, và `|| true`) làm **CẢ suite** đỏ vì lỗi **biên dịch TS** (unreachable code; TS 5.6 báo lỗi với biểu thức luôn-truthy), KHÔNG phải vì test bắt được. Đó là tín hiệu GIẢ — một đột biến không biên dịch được thì không chứng minh gì về độ phủ. Đột biến phải **biên dịch sạch** rồi mới đọc kết quả.

### Completion Notes List

**Ba quyết định lớn của story — đã thực hiện đúng như chốt:**

1. **`libphonenumber-js`** (đóng action item Epic 2 retro). `normalizeVnPhone()` là hàm thuần DUY NHẤT (`customers/domain/phone.ts`) — Story 3.4 `import` chính nó, KHÔNG viết bản thứ hai. Số **cố định VN** (`02838221234` ⇒ `+842838221234`) hợp lệ — đúng ca mà regex tự viết sẽ từ chối oan.
2. **Bảng + seed `CustomerSource` thuộc story này.** ⚠️ **Story 3.5 KHÔNG được tạo lại bảng/migration này** — chỉ thêm CRUD + màn cấu hình + gate `settings.manage` + luật "không xoá/deactivate dòng `isOther`".
3. **Chỉ `sdt`/`custType`/`name`/`sourceId` bắt buộc** — verify tường minh trong `openapi.json`: `CreateCustomerRequestDto.required = ['sdt','custType','name','sourceId']`.

**🔴 AC-9 — nợ kỹ thuật đã TRẢ.** Lần đầu repo kiểm được ràng buộc tầng DB bằng Postgres **thật** (`npm run test:db`, **8/8 xanh**): PK `customers.sdt` thật sự ném `P2002`; FK `source_id` thật sự ném `P2003`; `$transaction` rollback thật; `migrate deploy` chạy được **đè lên 6 migration cũ** (không phải DB rỗng — test đọc `_prisma_migrations` và khẳng định migration cũ vẫn nằm đó). **KHÔNG** dùng lane này để nhận vơ rằng ràng buộc của Story 3.1/3.2 đã được kiểm — chúng **chưa**.

⚠️ **Sửa ở review:** lane DB ban đầu chỉ tách bằng `describe.skip` khi vắng `DATABASE_URL`. Nhưng `testRegex` của Jest (`.*\.spec\.ts$`) **vẫn khớp** file đó ⇒ trên bất kỳ máy/CI nào có `DATABASE_URL` trong env (repo này **có** `.env` chứa nó), `npm test` **chạy thật** lane DB: xoá bản ghi fixture khỏi bảng `customers` thật và `execFileSync('npx prisma db seed')`. "Hermetic" khi đó chỉ là may mắn của biến môi trường, không phải một ranh giới. ⇒ Tách **bằng cấu trúc**: `testPathIgnorePatterns: ["\\.db\\.integration\\.spec\\.ts$"]` trong cấu hình Jest, và `test:db` **tự opt-in lại** bằng `--testPathIgnorePatterns=/node_modules/`. Kiểm chứng cả hai chiều **khi `DATABASE_URL` ĐANG được export**: `npm test` ⇒ 42 suite / 486 test, **không** có lane DB; `npm run test:db` ⇒ 8/8 xanh trên Postgres thật. `describe.skip` giữ nguyên làm lớp phòng thủ thứ hai (bảo vệ `test:db` khi gọi mà không có DB).

**Hai chỗ đi khác chữ trong Tasks (có lý do, cần Đại Ca xác nhận ở review):**

- **`customers.module.ts` KHÔNG import `AccountsModule`.** Task 3 ghi "import `AccountsModule`", nhưng module này không cần: khác `catalog/`, controller khách hàng không có quyền phụ nào phải resolve tại chỗ (không có giá vốn để che ⇒ không có `canViewCosts` để copy — đúng như Dev Notes #8 dặn đừng copy theo quán tính). Quyền `customers.manage` do `PermissionsGuard` toàn cục lo. Import thừa = dependency chết.
- **Cột nullable nhận `null` tường minh.** `cccd`/`taxCode`/`address`/`bankAccount`/`sourceNote` dùng `@IsOptional()` (không phải `@IsOptionalNotNull()`) vì chúng là cột **nullable** — ở đó `null` là giá trị nghiệp vụ ("không có"), y hệt `warrantyMonths` của 3.1. Cột NOT NULL (`custType`/`name`/`sourceId`) vẫn dùng `@IsOptionalNotNull()`. **Đây là điều kiện để đổi loại khách:** Cá nhân (đang có CCCD) → Thương mại phải gửi `{"custType":"THUONG_MAI","cccd":null,"taxCode":"…"}`. Không có đường xoá `cccd` thì việc đổi loại khách là ngõ cụt — và luật AC-4 được kiểm trên **bản ghi hiệu lực** (sau khi trộn PATCH vào bản ghi cũ), không chỉ trên body, nên một `cccd` cũ còn sót lại vẫn bị chặn 400.

**Ghi chú kiến trúc:** `isUniqueViolation` đã **trích** từ `catalog/products.service.ts` ra `common/errors/prisma-unique-violation.ts` (2 call-site = đúng ngưỡng DRY). `products.service.ts` giữ **hành vi y nguyên**; `products.*.spec.ts` xanh **không sửa một dòng nào**. Không thêm permission key, không chạy `permissions:gen` (AC-11). Không đụng `web/`/`mobile/` (backend-only).

**Kết quả cổng chất lượng (đo lại ở review):** `npm test` **486 xanh / 0 đỏ** (42 suite) — tăng từ 370, **0 regression**; lane DB tách hẳn khỏi lane này (xem AC-9 ở trên). `npm run test:db` **8/8 xanh** trên Postgres thật. `npm run lint` · `npm run format:check` · `nest build` sạch. `openapi.json` đã regen (drift-guard xanh) và **verify tường minh**: `/customers`, `/customers/{sdt}`, `/customer-sources` + 4 schema `Customer*` có mặt trong `components.schemas`.

### File List

**Mới:**

- `backend/src/customers/customers.module.ts`
- `backend/src/customers/customers.controller.ts`
- `backend/src/customers/customer-sources.controller.ts`
- `backend/src/customers/customers.service.ts`
- `backend/src/customers/customer-sources.service.ts`
- `backend/src/customers/domain/phone.ts`
- `backend/src/customers/domain/customer-type.ts`
- `backend/src/customers/domain/customer-events.ts`
- `backend/src/customers/dto/create-customer-request.dto.ts`
- `backend/src/customers/dto/update-customer-request.dto.ts`
- `backend/src/customers/dto/customer-response.dto.ts`
- `backend/src/customers/dto/customer-source-response.dto.ts`
- `backend/src/customers/dto/is-absent.decorator.ts`
- `backend/src/common/errors/prisma-unique-violation.ts`
- `backend/prisma/migrations/20260713020000_add_customers_and_customer_sources/migration.sql`
- `backend/test/phone.spec.ts`
- `backend/test/customers.service.spec.ts`
- `backend/test/customers.e2e.spec.ts`
- `backend/test/customers.db.integration.spec.ts`

**Sửa:**

- `backend/prisma/schema.prisma` — + `Customer`, + `CustomerSource`
- `backend/prisma/seed.ts` — + seed 5 nguồn khách (idempotent); tách seed admin thành bước tự-bỏ-qua khi vắng env
- `backend/src/app.module.ts` — + `CustomersModule`
- `backend/src/catalog/products.service.ts` — import `isUniqueViolation` đã trích (hành vi y nguyên)
- `backend/package.json` — + `libphonenumber-js`, + script `test:db`; **(review)** + `testPathIgnorePatterns` loại lane `*.db.integration.spec.ts` khỏi `npm test`
- `backend/test/openapi-drift.spec.ts` — + 3 test hợp đồng khách hàng (3 route + 4 schema `Customer*`; `CreateCustomerRequestDto.required` đúng 4 field; mọi route đòi bearer). *Thiếu trong File List bản đầu — bổ sung ở review.*
- `backend/openapi/openapi.json` — regen
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 3.3 → review → done

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-13 · **Kết quả:** ✅ **Approve** (0 CRITICAL sau khi sửa)

**Phạm vi soát:** 12 AC × implementation thật; 7 task đánh `[x]` × bằng chứng file:line; git reality vs File List; hai điểm Đại Ca chỉ đích danh (chuẩn hoá E.164, tính tách của lane `test:db`).

### Hai điểm được soát kỹ theo yêu cầu

**1. Chuẩn hoá E.164 — ĐÚNG.** Kiểm bằng cách gọi thẳng `normalizeVnPhone()` trên bảng 29 ca thô, tìm **hội tụ** (cái thật sự quyết định "một SĐT = một khách"), không chỉ tìm "có chạy không":

| Nhóm | Kết quả |
|---|---|
| `0912345678` · `0912 345 678` · `0912.345.678` · `+84912345678` · `84912345678` · `912345678` · `0084912345678` · `(+84) 912 345 678` · `+84-912-345-678` | **đều ⇒ `+84912345678`** — hội tụ một khoá |
| Số cố định `02838221234` · `028 3822 1234` · `+842838221234` | **đều ⇒ `+842838221234`** — không bị từ chối oan (đúng ca mà regex tự viết sẽ giết) |
| Đầu số Vinaphone `084`: `0842345678` · `84842345678` · `+84842345678` | **đều ⇒ `+84842345678`** — mẹo "thêm `+` khi thấy `84`" **không** làm hỏng ca này (ca nguy hiểm nhất, vì `84` vừa là mã quốc gia vừa là đầu số di động) |
| Rác: `abc` · `''` · `123` · 20 chữ số · `+16505550123` (số Mỹ) | **đều ⇒ `null`** ⇒ 400, không 500 |

⇒ **Không tìm thấy ca phân kỳ** (hai dạng thô của cùng một số ra hai khoá khác nhau) — đó là failure mode duy nhất thật sự làm vỡ AC-3. AD-9 giữ được: client gửi thô, backend chuẩn hoá, `web/`/`mobile/` không có một dòng chuẩn hoá nào.

**2. Lane `test:db` — TÁCH KHÔNG THẬT, đã sửa (HIGH).** Xem AC-9 trong Completion Notes. Tóm tắt: `describe.skip` chỉ phản ứng với **sự VẮNG MẶT** của `DATABASE_URL`, nhưng `testRegex` của Jest vẫn **nạp file đó vào lane mặc định**. Đo thật (export `DATABASE_URL` rồi chạy `npm test`): lane DB **CHẠY** — xoá fixture khỏi bảng `customers` thật và gọi `npx prisma db seed`. Đó không phải hermetic, đó là may. Đã tách bằng `testPathIgnorePatterns`, kiểm chứng cả hai chiều **khi biến môi trường ĐANG bật**.

### Bảng phát hiện

| # | Mức | Phát hiện | Xử lý |
|---|---|---|---|
| 1 | **HIGH** | Lane DB không tách khỏi `npm test`; hermetic chỉ đúng khi `DATABASE_URL` tình cờ vắng. Task 6 đánh `[x]` cho "`npm test` giữ nguyên hermetic" — đúng **có điều kiện**, không đúng vô điều kiện. | ✅ **Đã sửa** — `testPathIgnorePatterns` + `test:db` opt-in lại. |
| 2 | **MEDIUM** | `backend/test/openapi-drift.spec.ts` bị sửa (git) nhưng **vắng mặt** trong File List. Nội dung sửa là **cộng thêm** 3 test hợp đồng — đã đọc kỹ, **không** nới lỏng guard nào. | ✅ **Đã sửa** — bổ sung vào File List. |
| 3 | **MEDIUM** | Số liệu cổng chất lượng trong story **cũ**: "462 xanh / 6 skip", "test:db 6/6". Thực đo: **486 xanh**, **test:db 8/8**. | ✅ **Đã sửa** — cập nhật theo số đo lại. |
| 4 | LOW | `normalizeVnPhone` **rộng lượng** với rác đuôi: `'0912345678abc'` ⇒ `+84912345678` (libphonenumber trích số ra khỏi văn bản). Không vi phạm AC-2 (các ca AC-2 liệt kê đều ⇒ `null`) và **không** tạo khoá phân kỳ — chuỗi rác không bao giờ xuống DB, PK vẫn là E.164 sạch. | Ghi nhận, **không sửa** (hội tụ vẫn đúng; siết thêm là thay đổi hành vi không có AC đòi). |
| 5 | LOW | `GET /customers` **không phân trang** — danh bạ lớn dần sẽ trả cả bảng. | Ghi nhận cho **Story 3.4** (màn danh sách là của 3.4; thêm phân trang bây giờ là YAGNI + đổi hợp đồng mà 3.4 chưa chốt). |

### Đã verify là ĐẠT (không phải đọc lướt)

- **AC-1/AC-3** — hội tụ E.164 (bảng trên) + PK chặn trùng **bằng DB thật** (`test:db` 8/8: `P2002` từ Postgres, không phải từ mock). `create()` ghi **`sdt` đã chuẩn hoá**, không phải `dto.sdt` thô — assert tường minh ở `customers.e2e.spec.ts:207` (`create.mock.calls[0][0].data.sdt`), đúng bài học CRITICAL của review 3.2 (đếm số lần gọi ⇒ xanh-giả).
- **AC-5/AC-6** — `sourceId` ma ⇒ **400** (pre-check ở service), không để FK nổ thành 500; FK thật vẫn được chứng minh riêng ở lane DB (`P2003`). `isOther` nhận biết bằng **cờ**, không so tên (`customers.service.ts:117`) — và `update()` **kiểm lại** luật trên nguồn MỚI (`:234`), không chỉ lúc tạo.
- **AC-4/AC-7** — luật field-lạc-loại-khách chạy trên **bản ghi hiệu lực** (sau khi trộn PATCH), không chỉ trên body (`:235`) — đây là chi tiết dễ bỏ sót nhất và họ làm đúng. `@IsAbsent` chặn `sdt` trong PATCH bằng `value !== undefined` (không phải `in`).
- **AC-8/AC-11** — service chỉ inject `PrismaService` + `EventBus`; publish **sau** commit. Ba source-guard (`no-direct-side-effect-outside-eventbus`, `no-permission-literal-outside-registry`, `no-handler-without-require-permissions`) **xanh** ⇒ đây là bằng chứng máy, không phải lời hứa. Không thêm permission key.
- **AC-12** — `npm test` 486 xanh (0 regression từ 370) · `lint` · `format:check` · `nest build` sạch · drift-guard xanh.
- **DTO `null`-handling** — cột NOT NULL dùng `@IsOptionalNotNull()`, cột nullable dùng `@IsOptional()`. Đây là **đi khác chữ trong Task 4 nhưng ĐÚNG**: không cho `null` xuống cột nullable thì **không có đường đổi loại khách** (Cá nhân → Thương mại phải xoá được `cccd`). Không `PartialType`. Bài học 3.1 được áp đúng chỗ.

### Câu trả lời cho "hai chỗ đi khác chữ" trong Completion Notes

Cả hai **chấp nhận**: (1) `customers.module.ts` không import `AccountsModule` — đúng, không có quyền phụ nào phải resolve tại chỗ, import thừa là dependency chết; (2) cột nullable nhận `null` — đúng, xem trên.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-13 | **Code review (AI) — Approve.** 1 HIGH + 2 MEDIUM đã sửa, 0 CRITICAL. HIGH: lane test DB **không thật sự tách** — `describe.skip` chỉ phản ứng khi `DATABASE_URL` vắng, còn `testRegex` vẫn nạp file vào lane mặc định, nên hễ máy/CI có `DATABASE_URL` (repo này có `.env`) là `npm test` chạy thật vào Postgres và gọi `db seed`. Tách bằng `testPathIgnorePatterns`; `test:db` opt-in lại; kiểm chứng hai chiều khi biến môi trường đang bật (`npm test` 486 xanh không có lane DB · `test:db` 8/8). MEDIUM: bổ sung `openapi-drift.spec.ts` vào File List (bị sửa nhưng không khai; nội dung là **cộng** 3 test hợp đồng, không nới guard); cập nhật số liệu cổng chất lượng cũ (462→486, test:db 6/6→8/8). Chuẩn hoá E.164 soát riêng trên 29 ca thô: **hội tụ đúng một khoá**, số cố định và đầu số `084` đều không bị hỏng, rác ⇒ `null`. |
| 2026-07-13 | **Hoàn thành story 3.3.** Module `customers/` (CRUD khách + `GET /customer-sources` chỉ đọc), `normalizeVnPhone()` thuần bằng `libphonenumber-js`, bảng `Customer` (PK = SĐT E.164) + `CustomerSource` + migration + seed 5 nguồn idempotent. Trích `isUniqueViolation` ra `common/errors/` (dùng chung với `catalog`). 🔴 **Trả nợ kỹ thuật AC-9:** lane test tích hợp trên Postgres THẬT chứng minh PK chặn trùng (`P2002`), FK chặn nguồn ma (`P2003`), `$transaction` rollback thật, và `migrate deploy` chạy được đè lên 6 migration cũ — lane tự skip khi vắng `DATABASE_URL` nên `npm test` vẫn hermetic. 462 test xanh (từ 370), 0 regression; lint/format/build/openapi sạch. |
| 2026-07-13 | Tạo story 3.3 — CRUD Khách hàng, SĐT E.164 làm khoá chính. Chốt 3 quyết định: (1) dùng `libphonenumber-js` thay vì tự viết regex (đóng action item Epic 2 retro); (2) bảng + seed `CustomerSource` thuộc story này (FK bắt buộc, không chạy được nếu thiếu); (3) chỉ `sdt`/`custType`/`name`/`sourceId` bắt buộc — CCCD/MST/địa chỉ/TK ngân hàng optional để không giết luồng tạo khách inline của Story 3.4. Thêm AC-9: lane integration trên Postgres thật (container đã chạy, 6/6 migration đã applied) — trả nợ kỹ thuật mà project-context ghi là "đến hạn ở Story 3.3". |

## Câu hỏi cho Đại Ca (không chặn dev — trả lời được lúc review)

1. **🔴 Quan trọng nhất — chuẩn hoá SĐT bằng `libphonenumber-js`, không tự viết regex.** Đây là action item Epic 2 retro giao cho Winston, story này **chốt nó**. Lý do: SĐT **là khoá chính** — chuẩn hoá sai không phải lỗi hiển thị mà là **hai bản ghi cho cùng một người**, đúng cái AD-9 tồn tại để chặn; và kế hoạch số VN có bẫy thật (chuyển đổi đầu số 2018, số cố định 10 chữ số có mã vùng). Đổi lại: **một dependency** ở backend. Nếu Đại Ca muốn zero-dep (tự viết), báo ngay — nhưng khi đó phải chấp nhận rủi ro **từ chối số cố định hợp lệ** (khách Thương mại hay dùng) hoặc **nhận số rác** vào làm PK.

2. **Bộ trường bắt buộc lúc tạo khách: chỉ `sdt` + `custType` + `name` + `sourceId`** (+ `sourceNote` nếu nguồn là "Khác"). **CCCD / MST / địa chỉ / tài khoản NH là optional.** Lý do: Story 3.4 đòi **tạo khách inline giữa lúc dựng báo giá** — bắt sale gõ CCCD/MST ngay lúc đang nói chuyện điện thoại với khách sẽ giết chính luồng đó. Các field này chặn ở **nơi thật sự cần**: Hợp đồng (FR-13) và Hoá đơn (FR-27). **Nếu Đại Ca muốn bắt buộc ngay lúc tạo**, báo trước khi code 3.4 — đó là thay đổi AC của 3.4.

3. **`sdt` BẤT BIẾN sau khi tạo (PATCH không đổi được SĐT).** Đổi SĐT = đổi khoá chính = đổi danh tính, mà Epic 4 sẽ FK vào đây. Nếu nghiệp vụ **thật sự** có ca "khách đổi số điện thoại", đó là một thao tác riêng (merge/di trú) cần story riêng — không phải một `PATCH` lặng lẽ. Xác nhận?

4. **Bảng `CustomerSource` + seed 5 dòng nằm ở Story 3.3 này, không phải 3.5.** Bắt buộc, không phải sở thích: `Customer.sourceId` là FK bắt buộc ⇒ không có bảng thì 3.3 không chạy được. Story 3.5 sẽ chỉ còn **CRUD + màn cấu hình + gate `settings.manage`** (và **không được** tạo lại migration). Xác nhận đúng ý?

5. **Lane test tích hợp trên Postgres thật (AC-9) — có nên bắt buộc trong `npm test` không?** Story này để nó **tự skip khi vắng DB** (giữ `npm test` hermetic như hiện tại), chạy có chủ đích qua script riêng. Phương án chặt hơn: bắt `migrate deploy` + lane DB thành **cổng release bắt buộc** (đúng nợ #2 mà review 3.2 đã nêu). Đại Ca muốn siết ngay bây giờ hay để sau?
