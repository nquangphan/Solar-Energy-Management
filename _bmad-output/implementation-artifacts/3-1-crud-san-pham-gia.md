---
baseline_commit: 710333c
---

# Story 3.1: CRUD Sản phẩm & giá + cột mới (costPrice, tracksStock, priceEditable, warrantyMonths)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người có quyền sửa danh mục (`catalog.manage`)**,
I want **thêm/sửa/xoá Sản phẩm và cập nhật giá bất kỳ lúc nào, kèm bốn cột mới `costPrice` / `tracksStock` / `priceEditable` / `warrantyMonths`**,
so that **báo giá luôn lấy giá mới nhất từ danh mục, và Epic 4–8 (chiết khấu, tồn kho, bảo hành, báo cáo lợi nhuận) có sẵn dữ liệu gốc mà không phải sửa schema ngược**.

**Đây là story backend-only.** Không có màn hình web/mobile trong story này (màn danh mục thuộc Epic 8/story sau). Không tạo `ProductPrice` (Story 3.2), không tạo `StockItem` (Epic 6), không tạo `ProductGroup` (Story 3.6).

## Acceptance Criteria

1. **AC-1 — Entity `Product` + migration offline.** **Given** danh mục vật tư (FR-14), **When** thêm model `Product` vào `backend/prisma/schema.prisma`, **Then** model có: `id` (uuid PK), `name` (String), `sku` (String, **unique**), `unit` (String — đơn vị: "tấm", "bộ", "m"…), `price` (**Int** — giá bán, integer đồng), `costPrice` (**Int** — giá vốn, integer đồng), `tracksStock` (Boolean, default `true`), `priceEditable` (Boolean, default `false`), `warrantyMonths` (**Int?** — nullable, tính bằng **tháng**), `isActive` (Boolean, default `true`), `createdAt`/`updatedAt` **And** sinh migration **offline** bằng `prisma migrate diff --from-schema <prev> --to-schema` (KHÔNG có Postgres cục bộ), đặt tên `<timestamp>_add_products`, SQL chỉ chứa delta bảng mới (AD-1, §2, §3).

2. **AC-2 — Tiền là integer đồng, KHÔNG float.** **Given** `price` và `costPrice`, **When** khai schema + DTO, **Then** kiểu là `Int` ở Prisma và `@IsInt() @Min(0)` ở DTO — **cấm** `Float`/`Decimal`/`number` không ràng buộc. `warrantyMonths` là `Int?`, `@Min(0)`, **KHÔNG viết validation chặn null** (công lắp / phí lắp đặt = `null`, có chủ đích — §3) (AD-10, AD-16).

3. **AC-3 — CRUD endpoint gate bởi `catalog.manage`.** **Given** quyền `PERM.catalogManage` (`'catalog.manage'`, đã có sẵn trong registry — **KHÔNG thêm key mới**), **When** khai `ProductsController`, **Then** **mọi** handler mang `@RequirePermissions(PERM.catalogManage)`:
   - `POST /products` → tạo (201)
   - `GET /products` → danh sách (mặc định chỉ `isActive=true`; query `?includeInactive=true` để xem cả đã ẩn)
   - `GET /products/:id` → chi tiết (404 nếu không có)
   - `PATCH /products/:id` → sửa (partial; sửa được cả giá)
   - `DELETE /products/:id` → **soft-delete**: set `isActive=false`, HTTP 204
   **CẤM** `@AuthenticatedOnly()`, **CẤM** `@Public()` trên module này. Source-guard `no-handler-without-require-permissions` sẽ fail nếu thiếu (AD-4, AD-17, NFR-7).

4. **AC-4 — `costPrice` chỉ lộ cho người có `costs.view`.** **Given** `Product.costPrice` là **giá vốn** (dữ liệu nhạy cảm — lý do Story 2.10 phải xong trước Epic 3), **When** trả response từ **mọi** endpoint đọc (`GET /products`, `GET /products/:id`) và mọi endpoint ghi trả về entity (`POST`, `PATCH`), **Then** trường `costPrice` **chỉ có mặt** khi caller mang `PERM.costsView` (`'costs.view'`); caller không có quyền → field **bị loại khỏi payload** (không phải trả `0`, không phải trả `null`) **And** ghi `costPrice` (trong `POST`/`PATCH`) yêu cầu **cả** `catalog.manage` **và** `costs.view` — thiếu `costs.view` mà body có `costPrice` ⇒ `AppException(FORBIDDEN, 403)` (AD-4, quyết định khách hàng §5).

5. **AC-5 — Sửa giá KHÔNG hồi tố đơn đã chốt.** **Given** cơ chế snapshot của Epic 4 (`OrderLineItem.unitPriceSnapshot` đóng băng lúc chốt — AD-6, AD-20), **When** story này sửa giá danh mục, **Then** `ProductsService` **chỉ** ghi bảng `products`, **KHÔNG** đọc/ghi `orders`/`order_line_items` và **KHÔNG** có bất kỳ code path nào lan giá ngược vào đơn. Không hồi tố là **hệ quả kiến trúc**, không phải một nhánh `if` (FR-14, FR-5).

6. **AC-6 — Mọi thay đổi publish domain event → Audit.** **Given** AD-18, **When** create/update/soft-delete thành công, **Then** publish **sau khi commit** qua `EventBus` port: `ProductCreated` · `ProductUpdated` · `ProductDeactivated`, mỗi event mang `actorAccountId` (từ `@CurrentAccount()`), `target = { type: 'Product', id }`, `before`/`after` là snapshot sản phẩm (bao gồm cả `costPrice` — audit ghi sự thật đầy đủ, không lọc theo quyền). **CẤM** inject `AuditService`/`NotificationDispatcher`; chỉ inject `EventBus` (AD-18, FR-14).

7. **AC-7 — Artifact + guard xanh.** **Given** endpoint mới, **When** chạy `npm run openapi:gen`, **Then** `backend/openapi/openapi.json` được sinh lại và commit → `openapi-drift.spec.ts` xanh. `permissions.json` **KHÔNG** đổi (không thêm permission key) → **không** chạy `permissions:gen`, **không** đụng generator FE (AD-12, AD-17).

**Bằng chứng "done" (hermetic — KHÔNG cần Postgres):**

- `cd backend && npm test` xanh: 33 suite cũ + 2 suite mới (`products.service.spec.ts`, `products.e2e.spec.ts`), **0 regression**.
- 7 source-guard xanh, đặc biệt `no-handler-without-require-permissions`, `no-permission-literal-outside-registry` (dùng `PERM.*`, cấm literal `'catalog.manage'`), `no-direct-side-effect-outside-eventbus`, `no-controller-error-envelope` (không có token `traceId`), `naming-convention` (file kebab-case), `no-manual-prisma-client`.
- `openapi-drift.spec.ts` xanh **sau khi** commit `openapi.json` mới.
- `npm run lint`, `npm run format:check`, `nest build` sạch.

## Tasks / Subtasks

- [x] **Task 1 — Prisma model `Product` + migration offline (AC: 1, 2)**
  - [x] Thêm model `Product` vào `backend/prisma/schema.prisma` — theo khuôn 5 model hiện có: `id String @id @default(uuid())`, cột camelCase + `@map("snake_case")`, `@@map("products")`, `///` doc comment nêu story + AD ràng buộc.
  - [x] Cột: `name String` · `sku String @unique @map("sku")` · `unit String` · `price Int` · `costPrice Int @map("cost_price")` · `tracksStock Boolean @default(true) @map("tracks_stock")` · `priceEditable Boolean @default(false) @map("price_editable")` · `warrantyMonths Int? @map("warranty_months")` · `isActive Boolean @default(true) @map("is_active")` · `createdAt`/`updatedAt`.
  - [x] **KHÔNG** dùng Prisma enum (repo cố ý không có enum nào — validate ở app layer).
  - [x] Sinh migration offline: `npx prisma migrate diff --from-schema-datamodel <schema trước> --to-schema-datamodel prisma/schema.prisma --script` → tách delta → `prisma/migrations/<timestamp>_add_products/migration.sql`, kèm comment header giải thích **vì sao sinh offline** (mirror `20260709000000_add_audit_logs/migration.sql`).
  - [x] `npm run prisma:generate` để cập nhật Prisma Client types.

- [x] **Task 2 — Module `catalog/` + domain thuần (AC: 3, 6)**
  - [x] Tạo `backend/src/catalog/` (**KHÔNG** phải `src/products/` — spine đặt tên module là `catalog/`, xem "Project Structure Notes").
  - [x] `catalog/domain/product-events.ts` — **pure** (không import Nest/Prisma): 3 class implement `DomainEvent` — `ProductCreated`, `ProductUpdated`, `ProductDeactivated`; mỗi class set `readonly type = '<TênClass>'`, `target = { type: 'Product', id }`, `before`/`after`, `occurredAt`, `actorAccountId`.
  - [x] `catalog/domain/product-visibility.ts` — **pure**: hàm `stripCostPrice(product, canViewCosts: boolean)` trả về object **không có key** `costPrice` khi `canViewCosts === false` (dùng destructuring + rest, không set `undefined`/`null`).
  - [x] `catalog/catalog.module.ts` — `@Module({ imports: [AccountsModule], controllers: [ProductsController], providers: [ProductsService] })`. Import `AccountsModule` **chỉ** để dùng `AccountPermissionsService` (kiểm `costs.view` — Task 5). **KHÔNG** import `PrismaModule`/`EventsModule` (cả hai `@Global`), **KHÔNG** re-register guard.
  - [x] Đăng ký `CatalogModule` vào `imports` của `backend/src/app.module.ts`.

- [x] **Task 3 — DTO + validation (AC: 2, 3)**
  - [x] `catalog/dto/create-product-request.dto.ts` — class-validator + `@ApiProperty` (khuôn `src/auth/dto/login-request.dto.ts`): `@IsString() @IsNotEmpty()` name/sku/unit; `@IsInt() @Min(0)` price; `@IsOptional() @IsInt() @Min(0)` costPrice; `@IsOptional() @IsBoolean()` tracksStock/priceEditable; `@IsOptional() @IsInt() @Min(0)` warrantyMonths.
  - [x] `catalog/dto/update-product-request.dto.ts` — mọi field optional (`PartialType` của Nest swagger là OK).
  - [x] `catalog/dto/product-response.dto.ts` — `costPrice` khai `@ApiPropertyOptional()` (vì bị strip theo quyền).
  - [x] Không tự tạo ValidationPipe — global `APP_PIPE` (`src/common/common.module.ts`) đã bật `whitelist: true, transform: true` và tự dựng `fieldErrors`.

- [x] **Task 4 — `ProductsService` (AC: 4, 5, 6)**
  - [x] Inject **chỉ** `PrismaService` + `EventBus`. Ghi qua `this.prisma.product.*`.
  - [x] `create(actor, dto, canViewCosts)` / `update(actor, id, dto, canViewCosts)` / `deactivate(actor, id)` / `findAll(includeInactive, canViewCosts)` / `findOne(id, canViewCosts)`.
  - [x] **Gate ghi `costPrice`:** nếu `dto.costPrice !== undefined && !canViewCosts` ⇒ `throw new AppException(ErrorCode.FORBIDDEN, 403, 'Không có quyền xem/sửa giá vốn.')` **trước** khi chạm DB.
  - [x] Không tìm thấy id ⇒ `AppException(ErrorCode.NOT_FOUND, 404, …)`. `sku` trùng ⇒ bắt lỗi Prisma unique (`P2002`) ⇒ `AppException(ErrorCode.CONFLICT, 409, …, fieldErrors: [{ field: 'sku', … }])`. **KHÔNG** tự dựng error envelope, **KHÔNG** viết chữ `traceId` ở bất kỳ đâu trong `src/`.
  - [x] `deactivate` = `update({ isActive: false })` — **KHÔNG** `prisma.product.delete()` (Epic 4 sẽ có FK `OrderLineItem.productId`; hard delete sẽ mồ côi dòng đơn cũ).
  - [x] Publish event **sau** khi write commit (mirror `account-permissions.service.ts:117-129`), `await this.eventBus.publish(new ProductCreated(...))`. **Payload event luôn đủ `costPrice`** — không strip theo quyền (audit ghi sự thật).
  - [x] Service trả về entity đã đi qua `stripCostPrice(...)` theo `canViewCosts` của caller.

- [x] **Task 5 — `ProductsController` (AC: 3, 4)**
  - [x] `@ApiTags('catalog') @ApiBearerAuth() @Controller('products')`. 5 handler như AC-3, **mỗi handler** `@RequirePermissions(PERM.catalogManage)` (import `PERM` từ `../accounts/domain/permission-registry` — **cấm** literal chuỗi quyền, kể cả trong `example:` của `@ApiProperty`).
  - [x] Lấy actor bằng `@CurrentAccount() account: AuthenticatedAccount` — **KHÔNG** đọc raw `request`.
  - [x] Tính `canViewCosts` — **đường đã có, KHÔNG viết resolver mới**: `PermissionsGuard` resolve effective set nhưng **KHÔNG gắn nó vào request** (`request.account` chỉ có `{ id, email, displayName }`). ⇒ Lấy quyền bằng `AccountPermissionsService.listForAccount(account.id)` (`src/accounts/account-permissions.service.ts:35`, trả `Set<PermissionKey>`) rồi `.has(PERM.costsView)`. Service này **đã được export** từ `AccountsModule` ⇒ `CatalogModule` phải `imports: [AccountsModule]`. Đây đúng bất biến AD-8 (resolve **tươi** mỗi request, KHÔNG suy quyền từ JWT/role).
  - [x] Handler viết dạng method thường, **thụt 2 space** (regex source-guard yêu cầu; arrow-function property sẽ bị coi là offender).
  - [x] Khai đủ `@ApiOkResponse/@ApiCreatedResponse/@ApiNoContentResponse` + `@ApiBadRequestResponse({ type: ErrorEnvelopeDto })` / `@ApiForbiddenResponse` / `@ApiNotFoundResponse` (khuôn `change-password.controller.ts`).

- [x] **Task 6 — Test (AC: mọi AC)**
  - [x] `backend/test/products.service.spec.ts` (unit, mock Prisma bằng `jest.fn()` cast `as unknown as PrismaService`, khuôn `account-permissions.service.spec.ts:65-71`): tạo/sửa/soft-delete happy path; publish đúng event + đúng payload `before`/`after`; `costPrice` trong body + không có `costs.view` ⇒ 403 **và `prisma.product.create` KHÔNG được gọi**; response bị strip `costPrice` khi thiếu quyền (assert bằng `expect(result).not.toHaveProperty('costPrice')` — không phải `toBeUndefined()`); `warrantyMonths: null` được chấp nhận; sku trùng (P2002) ⇒ 409.
  - [x] `backend/test/products.e2e.spec.ts` (supertest + `AppModule` override `PrismaService`): JWT không có `catalog.manage` ⇒ 403 trên cả 5 route; có `catalog.manage` nhưng không `costs.view` ⇒ 200 và body **không chứa** `costPrice`. **Gotcha bắt buộc:** set `process.env.JWT_ACCESS_SECRET` ở top-level rồi `await import('../src/app.module')` **động** trong `beforeAll` — static import sẽ làm `JwtModule.register` đọc secret rỗng (xem `test/me.e2e.spec.ts:13-21`).
  - [x] Chạy `npm test` — 35 suite xanh.

- [x] **Task 7 — Artifact + quality gate (AC: 7)**
  - [x] `npm run openapi:gen` → commit `backend/openapi/openapi.json` mới (drift-guard byte-for-byte sẽ fail nếu quên).
  - [x] **KHÔNG** chạy `permissions:gen`, **KHÔNG** chạy `design-system && npm run build:permissions` — registry không đổi.
  - [x] `npm run lint` · `npm run format:check` · `nest build` sạch.

## Dev Notes

### Ràng buộc kiến trúc bắt buộc (vi phạm = fail guard hoặc fail review)

| Ràng buộc | Nguồn | Hệ quả cụ thể cho story này |
|---|---|---|
| Tiền = **integer đồng** | AD-10, AD-16 | `price`, `costPrice` là `Int`. Không `Float`, không `Decimal`, không nhân/chia ở client. |
| **KHÔNG** hồi tố đơn đã chốt | AD-6, AD-20, FR-5 | Service chỉ chạm bảng `products`. Không import gì từ `orders/`. |
| **EventBus** cho mọi side-effect | AD-18 | Chỉ inject `EventBus`. Cấm `AuditService`/`NotificationDispatcher`/`firebase-admin`. Publish **sau commit**. |
| **Permission registry** là SSOT | AD-17 | Import `PERM` từ `accounts/domain/permission-registry.ts`. Cấm chuỗi `'catalog.manage'`/`'costs.view'` ở bất kỳ file nào khác — kể cả trong `example:` của decorator. |
| Backend **luôn enforce**, UI gating chỉ là UX | AD-4 | `costPrice` phải bị strip **ở server**, không phải "để FE tự ẩn". |
| Error envelope **một chỗ** | AD-5 | Throw `AppException`. Cấm token `traceId` trong `src/**/*.controller.ts` và `*.service.ts`. |
| OpenAPI **sinh từ code** | AD-12 | Không sửa tay `openapi.json`; chạy `openapi:gen`. |

### AD-20 — hai mốc đóng băng khác nhau (đọc kỹ, dễ làm sai)

`Product.costPrice` trong story này là **giá vốn hiện hành**, KHÔNG phải snapshot:
- **Giá bán** (`OrderLineItem.unitPriceSnapshot`) đóng băng lúc **chốt đơn** — lời hứa với khách (Epic 4).
- **Giá vốn** (`OrderLineItem.costPriceSnapshot`) đóng băng lúc **xuất kho** — sự thật (Epic 6).
- Duyệt chiết khấu (Epic 4) sẽ đọc **thẳng `Product.costPrice`** làm **biên ước tính**.
- Từ Story 6.3, `Product.costPrice` sẽ được **hệ thống tự cập nhật bằng bình quân gia quyền** từ `StockVoucherLine.unitCost` khi nhập kho. ⇒ Đường ghi tay `costPrice` mà story này tạo ra là **đường ghi ban đầu / hiệu chỉnh**, sẽ **cùng tồn tại** với đường tự động sau này. Đừng thiết kế nó như thể nó là đường ghi duy nhất mãi mãi, nhưng cũng **đừng** dựng sẵn abstraction cho 6.3 (YAGNI).

### Ngữ nghĩa bốn cột mới (quyết định khách hàng 2026-07-10 — KHÔNG diễn giải lại)

- **`tracksStock`** — pin / inverter / battery / dây = `true`; công lắp, phí vận chuyển, phí lắp đặt = `false`. Epic 6 chỉ tạo `StockItem` cho sản phẩm `tracksStock=true`. Default `true` (đa số vật tư có tồn).
- **`priceEditable`** — phí lắp đặt = `true` (nhà một tầng khác nhà bốn tầng); tấm pin = `false` (giá lấy từ catalog). Default `false` (mặc định an toàn: **không** cho sale sửa giá tại chỗ, vì sửa giá là **cửa sau né duyệt chiết khấu**).
- **`warrantyMonths`** — mặc định **của sản phẩm**, tính bằng **tháng** (int). Công lắp / phí lắp đặt = `null`. **KHÔNG viết validation chặn null** — cố ý để null. (Giá trị thật của từng dòng đơn nằm ở `OrderLineItem.warrantyMonths`, Epic 4.)
- **`costPrice`** — giá vốn. Gate bởi `costs.view`. Đây chính là **lý do Story 2.10 (source-guard `@RequirePermissions`) bắt buộc phải xong trước Epic 3**: một route quên guard ⇒ mọi user đọc được giá vốn.
- **`priceEditable = true` ⇒ Epic 4 sẽ lưu SONG SONG giá catalog và giá đã sửa** trên `OrderLineItem` (để chênh lệch không nằm trong bóng tối). Story 3.1 **không** làm phần đó — chỉ khai cờ.

### Quyết định của story này (ghi rõ để không bị lật ở review)

1. **Soft-delete, không hard-delete.** AC epic viết "xoá Sản phẩm". Hiện thực = `isActive=false` (`DELETE /products/:id` → 204). Lý do: Epic 4 (`OrderLineItem.productId`) và Epic 6 (`StockItem.productId`) đều FK vào `Product`; hard delete sẽ mồ côi dòng đơn/tồn kho lịch sử. Cùng khuôn với `Account.isActive` (đã có) và quy tắc soft-delete của `CustomerSource` (Story 3.5). ⇒ Ghi câu hỏi xác nhận ở cuối file.
2. **Module dir = `src/catalog/`, route = `/products`.** Spine đặt tên module `catalog/` (Capability map: "Danh mục vật tư & giá (FR-14, FR-15) → `catalog/`"); CONVENTIONS quy định route là **danh từ số nhiều kebab-case** ⇒ `/products`. Đây **không** phải mâu thuẫn — dir là ranh giới domain (sẽ chứa cả `ProductPrice` của 3.2 và `ProductGroup` của 3.6), route là tài nguyên REST. **Đừng tạo `src/products/`.**
3. **`sku` unique.** Spine có cột `sku`; danh mục vật tư cần mã tra cứu duy nhất. Ràng buộc unique ở tầng DB — **nhưng chưa từng chạy trên Postgres thật** (xem cảnh báo dưới).
4. **`price` + `unit` là cột trên `Product`.** Spine ERD vẽ `PRODUCT` thiếu `price`/`unit`, nhưng AC epic 3.1 nói rõ "tạo/sửa Sản phẩm (tên, **đơn vị**, **giá**)" và FR-15 nói "cờ tiered **TẮT** ⇒ mỗi Sản phẩm **một giá duy nhất**". Một giá duy nhất **phải** sống trên `Product`. `ProductPrice` (Story 3.2) chỉ là các mức bổ sung khi bật cờ. ⇒ Đây là biến thể có chủ đích so với ERD; ghi vào Dev Agent Record.

### ⚠️ Nợ kỹ thuật đến hạn ở story này

**Ràng buộc tầng DB CHƯA TỪNG được kiểm.** 4 migration hiện có đều sinh **offline** (`prisma migrate diff --script`, không có Postgres cục bộ) và **chưa từng** chạy `migrate deploy`. Test toàn bộ **hermetic** (mock Prisma) — mock **không chứng minh được** `@unique` trên `sku` thật sự hoạt động. Story này thêm một ràng buộc unique nữa vào đống chưa kiểm đó. Story 3.3 (chặn trùng SĐT) sẽ là điểm vỡ nếu không trả nợ. **Trong scope story này: viết migration đúng, mock test như thường lệ, và KHÔNG tuyên bố "đã kiểm ràng buộc unique".** Ghi rõ giới hạn này vào Completion Notes.

### Testing

- Vị trí: **mọi spec nằm phẳng ở `backend/test/`**, không đặt cạnh source. Unit = `<subject>.spec.ts`; e2e = `<subject>.e2e.spec.ts`.
- Lệnh: `cd backend && npm test` (Jest, hermetic, **không cần Postgres**).
- Mock Prisma: object `jest.fn()` cast qua `as unknown as PrismaService` (không dùng `jest-mock-extended`).
- e2e: `Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue({...})` + supertest; JWT thật ký qua `moduleRef.get(JwtService)`.
- **Bắt buộc test cho phần dễ sai/tiền bạc** (project-context): gate `costs.view`, strip `costPrice`, integer đồng, publish event đúng payload.

### Project Structure Notes

```
backend/
  prisma/
    schema.prisma                          # UPDATE: + model Product
    migrations/<timestamp>_add_products/   # NEW (sinh offline)
  src/
    app.module.ts                          # UPDATE: + CatalogModule vào imports
    catalog/                               # NEW — tên module theo spine (KHÔNG phải products/)
      catalog.module.ts
      products.controller.ts               # route /products
      products.service.ts
      domain/
        product-events.ts                  # pure: ProductCreated/Updated/Deactivated
        product-visibility.ts              # pure: stripCostPrice()
      dto/
        create-product-request.dto.ts
        update-product-request.dto.ts
        product-response.dto.ts
  openapi/openapi.json                     # UPDATE: regen bằng `npm run openapi:gen`
  test/
    products.service.spec.ts               # NEW
    products.e2e.spec.ts                   # NEW
```

**Naming guard:** mọi tên file kebab-case, mọi dot-segment khớp `^[a-z0-9]+(-[a-z0-9]+)*$`.

**Tái dùng, KHÔNG viết lại** (scout-before-code):
- `PrismaService` — `@Global`, chỉ inject.
- `EventBus` (abstract class kiêm DI token) — `src/events/event-bus.ts`; `EventsModule` là `@Global`.
- `DomainEvent` interface — `src/events/domain-event.ts`.
- `AppException` + `ErrorCode` — `src/common/errors/`; `ErrorCode` đã có `NOT_FOUND`/`CONFLICT`/`FORBIDDEN` ⇒ **không thêm error code mới**.
- `@RequirePermissions`, `@CurrentAccount`, `AuthenticatedAccount` — `src/auth/`.
- `PERM` / `PermissionKey` — `src/accounts/domain/permission-registry.ts`.
- Global `ValidationPipe` — `src/common/common.module.ts` (đã dựng `fieldErrors`).
- **Không** re-register guard (`APP_GUARD` đã có ở `AuthModule`), **không** import `PrismaModule`/`EventsModule`.

### Previous Story Intelligence (Story 2.10 — vừa xong)

- Story 2.10 dựng source-guard `no-handler-without-require-permissions` **chính vì story 3.1 này**. Guard quét `src/**/*.controller.ts`, **fail-closed**: handler có hình dạng lạ (arrow-function property, thụt lề khác 2 space) ⇒ bị tính là offender. Viết controller theo đúng khuôn `change-password.controller.ts`.
- Guard `no-permission-literal-outside-registry` quét **sau khi strip comment nhưng GIỮ NGUYÊN string** ⇒ literal `'catalog.manage'` trong `@ApiProperty({ example: ... })` **cũng fail**. Dùng `PERM.catalogManage`.
- Guard `no-direct-side-effect-outside-eventbus` quét trên code đã strip **cả comment lẫn string** ⇒ nhắc `AuditService` trong comment là an toàn, nhưng **tham chiếu identifier trong code thì không**.
- Luật không-leo-thang (2.10) sống ở `accounts/`; story này **không đụng** vào nó.
- Bài học 2.10: khi thêm test guard mới, **mutation-test nó** (cố ý phá thứ nó bảo vệ, xác nhận test chuyển ĐỎ) — guard tự-sanity-check chỉ bắt được điều tác giả tưởng tượng ra. Story này **không thêm guard mới**, nhưng nếu phát sinh, áp luật này.

### Git Intelligence (5 commit gần nhất)

`710333c` story 2.10 (không-leo-thang + source-guard) · `3a00af9` story 2.9 (3 quyền mới: `settings.manage`, `system.feature_flags`, `costs.view`) · `a669eca` story 1.12 · `757efce` + `1d98217` docs yêu cầu mới khách hàng.

⇒ `catalog.manage` **và** `costs.view` **đã có sẵn** trong registry (2.9). Story 3.1 **không thêm permission key nào** ⇒ **không** regen `permissions.json`, **không** chạm generator design-system. Commit conventional, không tham chiếu AI.

### Library / Framework

Node 24 LTS · NestJS 11.1.27 · Prisma 7.8.0 · PostgreSQL 18.4 · class-validator + `@nestjs/swagger` (không dùng zod).

**Prisma 7 gotcha (đã cắn ở Epic 2):** `datasource db` trong `schema.prisma` **không** được chứa `url` — URL nằm ở `prisma.config.ts`. Với field Json nullable, dùng `Prisma.JsonNull` chứ không phải `null` thuần (`audit.service.ts` đã có helper `toJsonInput`) — liên quan nếu payload event đi vào `AuditLog.before/after`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1] — AC gốc.
- [Source: _bmad-output/planning-artifacts/prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-14] — CRUD Sản phẩm & Giá; không hồi tố đơn đã chốt; ghi Audit.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Solar-Energy-Management-2026-07-07/ARCHITECTURE-SPINE.md#AD-20] — hai mốc đóng băng: giá bán lúc chốt, giá vốn lúc xuất kho.
- [Source: ARCHITECTURE-SPINE.md#Backend-module-tree] — `catalog/` = Product + tiered price (FR-14, FR-15).
- [Source: ARCHITECTURE-SPINE.md#ERD] — `PRODUCT { uuid id PK, string name, string sku, int costPrice, bool tracksStock, bool priceEditable, int warrantyMonths }`.
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#2] — ngữ nghĩa `tracksStock` / `priceEditable`; gói vật tư; phí lắp đặt.
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#3] — `warrantyMonths` (tháng, nullable, không validation chặn null).
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#4] — `Product.costPrice` sẽ được bình quân gia quyền cập nhật từ Story 6.3.
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md#5] — `costs.view` gate `Product.costPrice`.
- [Source: backend/CONVENTIONS.md] — naming, error envelope, guard, EventBus, OpenAPI regen.
- [Source: _bmad-output/project-context.md] — stack, bất biến AD, testing, scout-before-code.
- [Source: backend/src/accounts/account-permissions.service.ts:117-129] — khuôn publish event sau commit.
- [Source: backend/src/auth/change-password.controller.ts] — khuôn controller có guard + Swagger decorator.
- [Source: backend/test/me.e2e.spec.ts:13-21] — gotcha `JWT_ACCESS_SECRET` + dynamic import `AppModule`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, BMAD dev-story workflow)

### Debug Log References

Ba lệch so với hướng dẫn story, đều là lệch của **story**, không phải của repo — ghi lại để story sau không lặp:

1. **Cờ Prisma CLI đổi tên.** Story viết `prisma migrate diff --from-schema-datamodel …`; Prisma 7.8 chỉ nhận `--from-schema` / `--to-schema` (cờ cũ ⇒ CLI in usage rồi thoát). Đã dùng cờ đúng; schema "trước" lấy từ `git show HEAD:backend/prisma/schema.prisma`. Delta sinh ra chỉ chứa `CREATE TABLE "products"` + unique index trên `sku` — không đụng bảng cũ.

2. **`warrantyMonths` phải là `number | null` ở DTO, không phải `number?`.** Khai `number?` thì AC-2 ("KHÔNG viết validation chặn null") *chạy* đúng ở runtime (class-validator `@IsOptional()` bỏ qua cả `null` lẫn `undefined`) nhưng *typecheck* lại cấm — PATCH không có đường đặt lại `warrantyMonths` về null. Đã khai `number | null`.

3. **`stripCostPrice` không dùng destructuring + rest.** Story chỉ định rest-destructuring, nhưng ESLint (`@typescript-eslint/no-unused-vars`, không bật `ignoreRestSiblings`) báo lỗi biến `_costPrice` không dùng. Đổi sang copy + `delete` — cùng ngữ nghĩa (key BIẾN MẤT khỏi object), lint sạch, không sửa config dùng chung.

**Mutation test source-guard** (áp bài học 2.10 dù story không thêm guard mới): gỡ `@RequirePermissions` khỏi handler `GET /products` ⇒ `no-handler-without-require-permissions.spec.ts` **và** e2e 403 đều chuyển ĐỎ; khôi phục ⇒ xanh lại. Guard thật sự phủ được controller mới, không phải xanh-giả.

### Completion Notes List

- **AC-1/AC-2 — schema + migration.** Model `Product` (11 cột) trong `schema.prisma`; migration offline `20260713000000_add_products`. Tiền là `Int` ở cả Prisma lẫn DTO (`@IsInt() @Min(0)`) — không `Float`/`Decimal` ở bất kỳ đâu. `warrantyMonths` là `Int?`, null hợp lệ có chủ đích (công lắp / phí lắp đặt).
- **AC-3 — 5 route, guard đầy đủ.** Cả 5 handler mang `@RequirePermissions(PERM.catalogManage)`; không `@Public()`/`@AuthenticatedOnly()` trong module. e2e khẳng định 403 trên **cả 5** route khi JWT thiếu `catalog.manage` (kể cả khi có `costs.view`) — quên guard ở route nào, route đó đỏ.
- **AC-4 — `costPrice` gate hai chiều.** ĐỌC: `stripCostPrice` **loại hẳn key** khỏi payload (test dùng `not.toHaveProperty`, không phải `toBeUndefined`) trên cả 4 endpoint trả entity. GHI: body có `costPrice` mà thiếu `costs.view` ⇒ 403 **trước khi chạm DB** (test khẳng định `prisma.product.create` KHÔNG được gọi). `costPrice: 0` cũng bị chặn — `0` là giá trị, không phải "vắng mặt". `canViewCosts` resolve **tươi** mỗi request qua `AccountPermissionsService.listForAccount` (AD-8), không suy từ JWT.
- **AC-5 — không hồi tố, bằng kiến trúc.** `ProductsService` chỉ inject `PrismaService` + `EventBus`, chỉ chạm `this.prisma.product.*`, không import gì từ `orders/`. Có test dựng `Proxy` quanh `PrismaService` ném ngay khi service chạm bất kỳ model nào ≠ `product` — "không hồi tố" là **bất biến được kiểm**, không phải một nhánh `if`.
- **AC-6 — event sau commit.** `ProductCreated` / `ProductUpdated` / `ProductDeactivated` publish qua `EventBus` **sau** khi write commit. Payload `before`/`after` luôn **đủ `costPrice`** — audit ghi sự thật, không lọc theo quyền người xem. e2e khẳng định event đi tới `AuditSubscriber` thật và `costPrice` có trong bản ghi audit **ngay cả khi** response gửi cho caller đã bị strip.
- **AC-7 — artifact.** `openapi.json` regen (+433 dòng), drift-guard xanh. `permissions.json` **không đổi** (không thêm permission key) ⇒ không chạy `permissions:gen`, không đụng generator FE.
- **Xoá = soft-delete** (`isActive=false`, HTTP 204). Test khẳng định `prisma.product.delete` **không** được gọi.
- **Quality gate:** `npm test` 35/35 suite, 294/294 test xanh (33 cũ + 2 mới, **0 regression**). `npm run lint` · `format:check` · `nest build` sạch. *(Sau review: 309 test — xem mục review bên dưới.)*

**⚠️ GIỚI HẠN PHẢI ĐỌC — ràng buộc unique trên `sku` CHƯA TỪNG được kiểm chạy thật.** Toàn bộ test là hermetic (mock Prisma); mock chỉ chứng minh service **dịch đúng** lỗi `P2002` thành 409 khi Prisma ném ra — nó **không** chứng minh Postgres thật sự từ chối `sku` trùng. Migration này (như 4 cái trước) sinh offline và chưa từng chạy `migrate deploy`. Story 3.3 (chặn trùng SĐT) sẽ là điểm vỡ nếu nợ này không được trả. **Không tuyên bố "đã kiểm ràng buộc unique".**

**Biến thể có chủ đích so với ERD spine:** `price` và `unit` là cột trên `Product` (ERD spine không vẽ). Căn cứ: AC epic 3.1 ("tạo/sửa Sản phẩm — tên, **đơn vị**, **giá**") + FR-15 ("cờ tiered TẮT ⇒ mỗi Sản phẩm **một giá duy nhất**") — một giá duy nhất phải sống trên `Product`. `ProductPrice` (3.2) chỉ là các mức bổ sung khi bật cờ.

### File List

**Mới:**
- `backend/prisma/migrations/20260713000000_add_products/migration.sql`
- `backend/src/catalog/catalog.module.ts`
- `backend/src/catalog/products.controller.ts`
- `backend/src/catalog/products.service.ts`
- `backend/src/catalog/domain/product-events.ts`
- `backend/src/catalog/domain/product-visibility.ts`
- `backend/src/catalog/dto/create-product-request.dto.ts`
- `backend/src/catalog/dto/update-product-request.dto.ts`
- `backend/src/catalog/dto/product-response.dto.ts`
- `backend/src/catalog/dto/is-optional-not-null.decorator.ts` (thêm ở review)
- `backend/test/products.service.spec.ts`
- `backend/test/products.e2e.spec.ts`

**Sửa:**
- `backend/prisma/schema.prisma` (+ model `Product`)
- `backend/src/app.module.ts` (+ `CatalogModule`)
- `backend/openapi/openapi.json` (regen — `npm run openapi:gen`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (3-1 → review)
- `_bmad-output/implementation-artifacts/3-1-crud-san-pham-gia.md` (story này)

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-13 · **Kết quả:** Approve (sau khi sửa 1 lỗi HIGH)

### Đã kiểm và ĐẠT

- **AC-4 (bài kiểm quan trọng nhất) — ĐẠT.** `GET /products` và `GET /products/:id` KHÔNG lộ `costPrice` cho caller thiếu `costs.view`: `stripCostPrice` loại HẲN key (test dùng `not.toHaveProperty`, không phải `toBeUndefined`), và e2e canh body ĐI QUA DÂY chứ không canh giá trị trả từ service. Chiều GHI cũng kín: `costPrice` trong body mà thiếu quyền ⇒ 403 **trước khi chạm DB** (`prisma.product.create` không được gọi), kể cả `costPrice: 0`.
- **AC-3 — ĐẠT.** Cả 5 handler mang `@RequirePermissions(PERM.catalogManage)`; e2e phủ 403 trên từng route riêng lẻ nên quên guard ở route nào, route đó đỏ.
- **AC-5 — ĐẠT, và được kiểm bằng bất biến chứ không bằng niềm tin.** Unit test bọc `PrismaService` trong `Proxy` ném ngay khi service chạm model ≠ `product`. Đây là cách kiểm đúng cho một ràng buộc kiến trúc.
- **AC-1/2/6/7 — ĐẠT.** Migration offline chỉ chứa delta bảng mới; tiền là `Int` ở cả Prisma lẫn DTO; event publish sau commit và mang đủ `costPrice` cho audit; `openapi.json` regen, drift-guard xanh; `permissions.json` không đổi.
- **Mọi task `[x]` đều có bằng chứng thật** trong code — không có task khai khống. File List khớp `git status`.

### 🔴 HIGH — đã sửa: `null` tường minh lọt xuống cột NOT NULL ⇒ 500 thay vì 400

`@IsOptional()` của class-validator tắt **mọi** validator khi giá trị là `undefined` **hoặc `null`**. Hệ quả: `PATCH {"price": null}` và `POST {"tracksStock": null}` đi qua `ValidationPipe` **không bị chặn**, rồi xuống thẳng Prisma trên cột NOT NULL. Đã dựng lại bằng probe e2e: payload ghi DB thật sự là `{"price": null}`. Với Postgres thật, Prisma ném `PrismaClientValidationError` — không phải `P2002` ⇒ không được dịch thành 409 ⇒ rơi vào `AllExceptionsFilter` thành **500**, trong khi đây là lỗi của người gọi và phải là **400 kèm `fieldErrors`** (AD-5). Mock Prisma nuốt `null` không kêu ca nên toàn bộ 294 test cũ vẫn xanh — đây đúng là loại lỗi mà test hermetic không tự thấy.

`PATCH` còn hở rộng hơn `POST`: `PartialType(CreateProductRequestDto)` **tự gắn `@IsOptional()` lên MỌI field**, nên cả `name`/`sku`/`unit`/`price`/`costPrice`/`tracksStock`/`priceEditable` đều nhận `null`.

**Sửa:**
- Thêm `catalog/dto/is-optional-not-null.decorator.ts` — `@IsOptionalNotNull()` = `@ValidateIf((_, v) => v !== undefined)`: tha `undefined` (vắng mặt thật sự, đúng ngữ nghĩa PATCH) nhưng **bắt `null` phải đi qua `@IsInt()`/`@IsString()`** và chết ở đó thành 400.
- `UpdateProductRequestDto` **bỏ `PartialType`**, khai tay từng field — không có cách nào ghi đè `@IsOptional()` mà `PartialType` đã gắn.
- `warrantyMonths` giữ nguyên `@IsOptional()` — là **ngoại lệ duy nhất**, `null` ở đó là giá trị nghiệp vụ hợp lệ ("không bảo hành"). AC-2 vẫn được tôn trọng: KHÔNG có validation chặn null ở cột này.
- +15 test hồi quy (`POST`/`PATCH` × 7 cột ⇒ 400 và **DB không bị chạm**; `PATCH warrantyMonths: null` ⇒ 200).

**Mutation test** (bài học 2.10): trả `UpdateProductRequestDto` về `PartialType` ⇒ **8 test chuyển ĐỎ**; khôi phục ⇒ xanh lại. Test hồi quy là thật, không xanh-giả.

### 🟢 LOW — ghi nhận, KHÔNG sửa (ngoài scope, không phải lỗi)

1. **Quyền được resolve 2 lần mỗi request** — `PermissionsGuard` gọi `listForAccount`, rồi `ProductsController.canViewCosts()` gọi lại. Hai round-trip DB cho cùng một câu hỏi. Đúng AD-8 (resolve tươi), chỉ là lãng phí. Sửa đúng cách là cache theo request-scope — một abstraction dùng chung, không thuộc story này.
2. **`PATCH` body rỗng `{}`** vẫn publish `ProductUpdated` với `before` ≡ `after` (audit ghi một thay đổi rỗng). Tương tự, `DELETE` một sản phẩm **đã** ẩn vẫn publish `ProductDeactivated` lần nữa. Nhiễu nhật ký, không sai dữ liệu.
3. **`GET /products` chưa phân trang** — danh mục vật tư hiện nhỏ; sẽ thành vấn đề khi danh mục lớn.

### Nợ kỹ thuật vẫn còn nguyên (KHÔNG bị lật bởi review này)

Ràng buộc `@unique` trên `sku` **vẫn chưa từng chạy trên Postgres thật** — test hermetic chỉ chứng minh service dịch đúng `P2002` → 409 khi Prisma ném ra. Story 3.3 (chặn trùng SĐT) sẽ là điểm vỡ nếu nợ này không được trả. Cảnh báo của dev agent là đúng và được giữ nguyên.

### Quality gate sau review

`npm test` **35 suite / 309 test xanh** (294 cũ + 15 hồi quy, **0 regression**) · 7 source-guard xanh · `openapi-drift` xanh sau regen · `lint` · `format:check` · `nest build` sạch.

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-13 | Hiện thực story 3.1: CRUD Sản phẩm (`/products`, 5 route gate bởi `catalog.manage`) + 4 cột mới (`costPrice`, `tracksStock`, `priceEditable`, `warrantyMonths`). Giá vốn gate hai chiều bởi `costs.view` (đọc: loại key khỏi payload; ghi: 403 trước khi chạm DB). Soft-delete. 3 domain event publish qua `EventBus` sau commit. 35 suite / 294 test xanh, 0 regression. Status: ready-for-dev → review. |
| 2026-07-13 | Code review: sửa 1 lỗi HIGH — `null` tường minh (`{"price": null}`, `{"tracksStock": null}`…) lọt qua `@IsOptional()` xuống cột NOT NULL ⇒ 500 thay vì 400. Thêm `@IsOptionalNotNull()`, bỏ `PartialType` ở `UpdateProductRequestDto`, +15 test hồi quy (mutation-tested). `openapi.json` regen. 35 suite / 309 test xanh. Status: review → done. |

## Câu hỏi cho Đại Ca (không chặn dev — trả lời được lúc review)

1. **Xoá sản phẩm = soft-delete (`isActive=false`)** — story này chốt vậy để không mồ côi dòng đơn/tồn kho lịch sử. Xác nhận đúng ý? (Nếu muốn hard-delete thật, phải nói rõ cách xử lý đơn cũ đang trỏ vào sản phẩm.)
2. **`sku` bắt buộc + unique?** Spine có cột `sku` nhưng chưa nói bắt buộc. Story chốt: bắt buộc, unique. Nếu thực tế có vật tư chưa kịp gán mã ⇒ cần `sku` nullable.
3. **`costPrice` bắt buộc lúc tạo sản phẩm?** Story chốt: **optional** (default 0), vì từ Story 6.3 hệ thống tự cập nhật bằng bình quân gia quyền khi nhập kho. Nếu muốn bắt buộc gõ tay lúc tạo ⇒ báo để đổi DTO.
