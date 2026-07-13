---
baseline_commit: 0fba7c2
---

# Story 3.2: Giá phân tầng sau cờ

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **người vận hành app (`system.feature_flags`) + người có quyền sửa danh mục (`catalog.manage`)**,
I want **một cờ nghiệp vụ nằm trong DB để bật/tắt giá phân tầng (lẻ/sỉ), và khi bật thì cấu hình được nhiều mức giá cho mỗi Sản phẩm qua entity `ProductPrice`**,
so that **hệ thống hỗ trợ giá sỉ khi cần, còn mặc định (cờ TẮT) vẫn đơn giản: mỗi Sản phẩm đúng một giá**.

**Đây là story backend-only.** Không có màn hình web/mobile. Không đụng `Customer` (Story 3.3), không đụng `Order`/`OrderLineItem` (Epic 4), không tạo `ProductGroup` (Story 3.6).

**Story này KHÔNG nối giá phân tầng vào báo giá.** Nó giao **kho lưu + cờ + một hàm phân giải thuần** (`resolveUnitPrice`). Điểm gọi hàm đó là Story 4.1 ("dòng pick từ Sản phẩm — auto-điền đơn giá theo danh mục hiện tại"). Đừng import gì từ `orders/` trong story này.

## Acceptance Criteria

1. **AC-1 — Cờ nghiệp vụ sống trong DB, KHÔNG ở Remote Config.** **Given** AD-14 ("Cờ giá phân tầng (FR-15) vẫn lưu trên DB — đó là nguồn chân lý nghiệp vụ… KHÔNG bằng Remote Config"), **When** thêm model `FeatureFlag` vào `backend/prisma/schema.prisma`, **Then** model có: `key` (String, **@id** — khoá chính là chính cái tên cờ), `enabled` (Boolean, default `false`), `updatedAt` **And** cờ của story này là `catalog.tiered_pricing`, khai trong registry `feature-flags/domain/feature-flag-registry.ts` theo khuôn `permission-registry.ts` (`FLAG = { catalogTieredPricing: 'catalog.tiered_pricing' } as const`) — **cấm** rải chuỗi literal tên cờ khắp code **And** **KHÔNG** đụng `firebase_remote_config` (AD-14, FR-15).

2. **AC-2 — Cờ vắng mặt = TẮT (fail-closed), KHÔNG seed.** **Given** bảng `feature_flags` rỗng (chưa ai bấm cờ bao giờ), **When** đọc cờ, **Then** `FeatureFlagsService.isEnabled(FLAG.catalogTieredPricing)` trả `false` — **không** ném lỗi, **không** cần dòng seed. Bật cờ = `upsert` (tạo dòng nếu chưa có). Mặc định TẮT là **hệ quả của việc vắng dòng**, không phải một dòng seed phải nhớ tạo (FR-15: "mặc định tắt").

3. **AC-3 — Bấm cờ gate bởi `system.feature_flags`; cấu hình mức giá gate bởi `catalog.manage`. HAI quyền khác nhau, KHÔNG gộp.** **Given** AD-14 ("Việc **bấm cờ** được gate bởi quyền `system.feature_flags` — chỉ `SUPER_ADMIN` mang sẵn") và AC epic ("người có quyền **sửa danh mục**" cấu hình giá), **When** khai controller, **Then**:
   - `GET /feature-flags` → `@AuthenticatedOnly()` — danh sách cờ + trạng thái. **Lý do KHÔNG gate `catalog.manage`:** Epic 4 sale dựng báo giá **không có** `catalog.manage` nhưng vẫn phải biết cờ đang bật để hiển thị đúng. Cờ là công tắc hệ thống, **không** phải dữ liệu nhạy cảm.
   - `PATCH /feature-flags/:key` → `@RequirePermissions(PERM.systemFeatureFlags)` — bật/tắt. Key lạ (không có trong registry) ⇒ `AppException(ErrorCode.NOT_FOUND, 404, 'Cờ tính năng không tồn tại.')`.
   - `GET /products/:productId/prices` → `@RequirePermissions(PERM.catalogManage)` — đọc bậc thang giá.
   - `PUT /products/:productId/prices` → `@RequirePermissions(PERM.catalogManage)` — **thay thế nguyên khối** bậc thang giá.
   (Param là `:productId`, **không** `:id` — tránh lẫn với `ProductsController`.) Chữ ký `AppException(errorCode, status, message, fieldErrors?)` — **`message` là bắt buộc**, đừng gọi thiếu.
   **CẤM** `@Public()`. Source-guard `no-handler-without-require-permissions` fail nếu thiếu (AD-4, AD-14, AD-17, NFR-7).

4. **AC-4 — Entity `ProductPrice`: bậc thang theo SỐ LƯỢNG (`minQty`), KHÔNG theo Loại khách.** **Given** ERD spine `PRODUCT_PRICE { uuid id PK, uuid productId FK, int minQty, int price }` (ARCHITECTURE-SPINE.md:305-310) và **KHÔNG tồn tại** `Customer` (Story 3.3 còn backlog) lẫn `Order.custType` (Story 4.3), **When** thêm model, **Then**: `id` (uuid PK) · `productId` (FK → `Product`, `onDelete: Cascade`) · `minQty` (**Int**, mua **từ** bao nhiêu trở lên thì ăn mức này) · `price` (**Int** — integer đồng, AD-10) · `createdAt`/`updatedAt` **And** thêm back-relation `prices ProductPrice[]` vào `Product` **And** `@@unique([productId, minQty])` (một sản phẩm không thể có hai mức cho cùng một ngưỡng) **And** `@@index([productId])`.

   **Bất biến `minQty >= 2` — đọc kỹ:** giá gốc (`Product.price`) **chính là** mức `minQty = 1` ngầm định. Nếu cho phép tạo dòng `ProductPrice` với `minQty = 1`, sẽ có **hai nguồn chân lý** cho giá gốc và AC-1 của epic ("cờ TẮT ⇒ mỗi Sản phẩm **một giá duy nhất**") vỡ ngay. ⇒ DTO ràng `@Min(2)`; vi phạm ⇒ **400** kèm `fieldErrors`.

   **KHÔNG** thêm cột `costPrice` vào `ProductPrice`. Giá vốn là **một con số duy nhất trên `Product`**, bị Story 6.3 ghi đè bằng bình quân gia quyền lúc nhập kho ("một chỗ gõ"). Bậc thang **không** nhân giá vốn lên (AD-20, Epic 6 §4).

5. **AC-5 — Cờ TẮT ⇒ mỗi Sản phẩm một giá duy nhất (bằng hành vi, không bằng lời hứa).** **Given** cờ `catalog.tiered_pricing` = `false`, **When** gọi API, **Then**:
   - `GET /products` và `GET /products/:id` trả payload **KHÔNG có** trường `prices` (loại hẳn key — cùng khuôn `stripCostPrice`, không phải trả `[]`).
   - `PUT /products/:id/prices` ⇒ `AppException(CONFLICT, 409, 'Cờ giá phân tầng đang TẮT.')` — **chặn ghi trước khi chạm DB**.
   - `resolveUnitPrice(...)` trả `Product.price`, **bỏ qua hoàn toàn** mọi dòng `ProductPrice` đang tồn tại.
   **Given** cờ = `true`, **When** gọi `GET /products/:id`, **Then** payload **có** `prices` (mảng, sắp xếp `minQty` tăng dần; rỗng nếu sản phẩm chưa cấu hình mức nào) (FR-15).

   **Cách nối cờ vào `ProductsService` — theo ĐÚNG khuôn `canViewCosts` đã có, KHÔNG phát minh khuôn mới:** `ProductsController` resolve cờ (`featureFlags.isEnabled(...)`) rồi **truyền xuống service như một tham số `boolean`** — y hệt cách `canViewCosts` được resolve ở controller (`products.controller.ts:60-63`) rồi truyền vào service. ⇒ **Constructor của `ProductsService` GIỮ NGUYÊN 2 tham số** (`PrismaService` + `EventBus`); **CẤM** inject `FeatureFlagsService` vào `ProductsService`. Lý do: (a) giữ service thuần prisma+eventbus, (b) `test/products.service.spec.ts` dựng service bằng `new ProductsService(prisma, eventBus)` **2 tham số** ở 2 chỗ — inject thêm sẽ làm suite đó **không compile**, (c) test `Proxy` của AC-5 story 3.1 (chặn service chạm model ≠ `product`) vẫn còn giá trị.

6. **AC-6 — Tắt cờ KHÔNG xoá dữ liệu.** **Given** một sản phẩm đã có 3 mức giá và cờ đang BẬT, **When** tắt cờ, **Then** 3 dòng `ProductPrice` **vẫn nằm nguyên trong DB** (ngủ đông, không bị xoá) — bật lại cờ ⇒ 3 mức đó trở lại y nguyên. Cờ là **công tắc đọc**, không phải lệnh xoá dữ liệu. Có test khẳng định: `setEnabled(actor, key, false)` ⇒ `FeatureFlagsService` **KHÔNG chạm** `prisma.productPrice` ở bất kỳ method nào (Task 7 — `feature-flags.service.spec.ts`).

7. **AC-7 — `PUT /products/:id/prices` là thay-thế-nguyên-khối, nguyên tử.** **Given** một bậc thang giá là **một tập hợp** (không phải các dòng rời rạc), **When** `PUT` với mảng mức giá, **Then** chạy trong **một `prisma.$transaction`**: `deleteMany({ where: { productId } })` rồi `createMany(...)` — khuôn atomic-replace của `account-permissions.service.ts` **And** mảng rỗng `[]` là **hợp lệ** (nghĩa là "xoá hết bậc thang, quay về một giá") **And** trùng `minQty` trong cùng payload ⇒ **400** (bắt ở DTO/service, đừng để DB `P2002` quyết) **And** sản phẩm không tồn tại ⇒ **404**.

   > **🔥 CẠM BẪY PRISMA 7 — ĐÃ CẮN MỘT LẦN, ĐỪNG CẮN LẠI:** `createMany({ data: [] })` với mảng **rỗng** làm hỏng atomic-replace (revocation im lặng không chạy). **Phải `if (rows.length > 0)` trước khi gọi `createMany`** — `deleteMany` vẫn chạy vô điều kiện. Test bắt buộc: `PUT` với `[]` ⇒ 200 **và** bậc thang thật sự trống sau đó.

8. **AC-8 — Hàm phân giải giá là PURE, và là thứ duy nhất Epic 4 sẽ gọi.** **Given** `catalog/domain/price-resolution.ts` (**pure**: không import Nest/Prisma), **When** khai, **Then**:
   ```ts
   export function resolveUnitPrice(input: {
     basePrice: number;
     tiers: readonly { minQty: number; price: number }[];
     quantity: number;
     tieredPricingEnabled: boolean;
   }): number
   ```
   Luật, theo đúng thứ tự:
   1. `tieredPricingEnabled === false` ⇒ trả `basePrice`. (Chốt chặn đầu tiên — không thèm nhìn `tiers`.)
   2. Không có `tier` nào có `minQty <= quantity` ⇒ trả `basePrice`.
   3. Ngược lại ⇒ trả `price` của tier có **`minQty` LỚN NHẤT** mà vẫn `<= quantity` (mua càng nhiều, ăn bậc càng cao).
   **And** hàm **KHÔNG** giả định `tiers` đã sắp xếp — tự chọn max, không `tiers[tiers.length - 1]`.
   **And** trả về **integer đồng**, không làm tròn, không nhân chia (AD-10, AD-16).

9. **AC-9 — Mọi thay đổi publish domain event → Audit.** **Given** AD-18, **When** ghi thành công, **Then** publish **sau khi commit** qua `EventBus`:
   - `FeatureFlagToggled` — `target = { type: 'FeatureFlag', id: key }`, `before`/`after` = `{ key, enabled }`.
   - `ProductPricesReplaced` — `target = { type: 'Product', id: productId }`, `before`/`after` = **cả bậc thang** (mảng `{ minQty, price }`) trước và sau. Ghi cả tập, không ghi từng dòng — vì thao tác nghiệp vụ là "đổi bậc thang", không phải "sửa một dòng".
   **CẤM** inject `AuditService`/`NotificationDispatcher`; chỉ `EventBus` (AD-18, guard `no-direct-side-effect-outside-eventbus`).

10. **AC-10 — Artifact + guard xanh.** **Given** endpoint mới, **When** `npm run openapi:gen`, **Then** `backend/openapi/openapi.json` regen + commit ⇒ `openapi-drift.spec.ts` xanh. **`permissions.json` KHÔNG đổi** — `PERM.systemFeatureFlags` và `PERM.catalogManage` **đã có sẵn** từ Story 2.9 ⇒ **KHÔNG** thêm permission key, **KHÔNG** chạy `permissions:gen`, **KHÔNG** đụng generator FE (AD-12, AD-17).

11. **AC-11 — Hai suite test CŨ của story 3.1 PHẢI được cập nhật (không phải "0 regression miễn phí").** **Given** `ProductsService.findAll/findOne` nhận thêm tham số `tieredPricingEnabled` và `ProductsService` bắt đầu trả về `prices`, **When** chạy `npm test`, **Then** hai file **có sẵn** phải được sửa, nếu không suite sẽ ĐỎ:
   - `backend/test/products.service.spec.ts` — mọi lời gọi `findAll(...)`/`findOne(...)` phải truyền tham số mới. **Constructor giữ 2 tham số** (xem AC-5) nên `new ProductsService(prisma, eventBus)` ở dòng ~84 và ~272 **không cần đổi**.
   - `backend/test/products.e2e.spec.ts` — `prismaMock` hiện là `{ product: productRepo, auditLog: auditRepo }` (**không có `featureFlag`**). Vì `ProductsController` giờ gọi `featureFlags.isEnabled()` trên **mọi** request đọc product, mock **phải thêm `featureFlag: { findUnique: jest.fn() }`** — thiếu nó ⇒ `undefined.findUnique` ⇒ 500 ⇒ **toàn bộ ma trận 403 và test strip `costPrice` của 3.1 chuyển ĐỎ**.
   **Đây là thay đổi BẮT BUỘC, không phải tuỳ chọn.** Sau khi sửa, 309 test cũ phải xanh trở lại — *đó* mới là "0 regression".

**Bằng chứng "done" (hermetic — KHÔNG cần Postgres):**

- `cd backend && npm test` xanh: 35 suite cũ (**trong đó 2 suite được cập nhật theo AC-11**) + 4 suite mới. Baseline: 35 suite / 309 test ⇒ sau story: 39 suite, 309 test cũ **vẫn xanh** + test mới.
- 7 source-guard xanh, đặc biệt `no-handler-without-require-permissions` (4 handler mới), `no-permission-literal-outside-registry`, `no-direct-side-effect-outside-eventbus`, `naming-convention`.
- `openapi-drift.spec.ts` xanh **sau khi** commit `openapi.json` mới.
- `npm run lint` · `npm run format:check` · `nest build` sạch.

## Tasks / Subtasks

- [x] **Task 1 — Prisma: `FeatureFlag` + `ProductPrice` + migration offline (AC: 1, 2, 4)**
  - [x] `FeatureFlag`: `key String @id` · `enabled Boolean @default(false)` · `updatedAt DateTime @updatedAt @map("updated_at")` · `@@map("feature_flags")`. **Không** cột `id` uuid riêng — tên cờ *chính là* khoá.
  - [x] `ProductPrice`: `id String @id @default(uuid())` · `productId String @map("product_id")` · `minQty Int @map("min_qty")` · `price Int` · `createdAt`/`updatedAt` · `product Product @relation(fields: [productId], references: [id], onDelete: Cascade)` · `@@unique([productId, minQty])` · `@@index([productId])` · `@@map("product_prices")`.
  - [x] Thêm back-relation `prices ProductPrice[]` vào model `Product` (hiện `Product` **chưa có** relation field nào).
  - [x] **KHÔNG** dùng Prisma enum (repo cố ý không có enum nào — validate ở app layer).
  - [x] Migration offline: `npx prisma migrate diff --from-schema <schema cũ từ 'git show HEAD:backend/prisma/schema.prisma'> --to-schema prisma/schema.prisma --script`. ⚠️ **Prisma 7.8 chỉ nhận `--from-schema` / `--to-schema`** — cờ `--from-schema-datamodel` của story 3.1 là SAI, CLI in usage rồi thoát (xem Debug Log 3.1 #1). Đặt `prisma/migrations/<timestamp>_add_feature_flags_and_product_prices/migration.sql`, kèm comment header giải thích vì sao sinh offline (mirror `20260713000000_add_products`).
  - [x] `npm run prisma:generate`.

- [x] **Task 2 — Module `feature-flags/` (AC: 1, 2, 3, 9)**
  - [x] `feature-flags/domain/feature-flag-registry.ts` — **pure**: `FLAG = { catalogTieredPricing: 'catalog.tiered_pricing' } as const` · `type FeatureFlagKey` · `FEATURE_FLAGS: readonly FeatureFlagEntry[]` (`{ key, label }`) · `isFeatureFlagKey(v): v is FeatureFlagKey`. Khuôn: `accounts/domain/permission-registry.ts`.
  - [x] `feature-flags/domain/feature-flag-events.ts` — **pure**: class `FeatureFlagToggled implements DomainEvent`.
  - [x] `feature-flags/feature-flags.service.ts` — inject **chỉ** `PrismaService` + `EventBus`. API: `isEnabled(key): Promise<boolean>` (vắng dòng ⇒ `false`, fail-closed) · `listAll(): Promise<FeatureFlagState[]>` (trả **mọi** key trong registry, kèm `enabled` — key chưa có dòng DB ⇒ `enabled: false`; **đừng** chỉ trả những dòng có trong DB) · `setEnabled(actor, key, enabled)` (`upsert` + publish `FeatureFlagToggled` sau commit).
  - [x] `feature-flags/feature-flags.controller.ts` — `GET /feature-flags` (`@AuthenticatedOnly()`), `PATCH /feature-flags/:key` (`@RequirePermissions(PERM.systemFeatureFlags)`). Key không nằm trong registry ⇒ `AppException(NOT_FOUND, 404)` — **không** cho tạo cờ tuỳ tiện qua URL.
  - [x] `feature-flags/feature-flags.module.ts` — `providers: [FeatureFlagsService]`, `exports: [FeatureFlagsService]`, `controllers: [FeatureFlagsController]`. **KHÔNG** import `PrismaModule`/`EventsModule` (đều `@Global`). Đăng ký vào `app.module.ts`.

- [x] **Task 3 — Domain thuần: phân giải giá (AC: 8)**
  - [x] `catalog/domain/price-resolution.ts` — `resolveUnitPrice(...)` đúng chữ ký + 3 luật ở AC-8. **Pure**: không import Nest/Prisma/EventBus. Đây là hàm Story 4.1 sẽ gọi — viết nó cho **người khác** dùng, không phải cho service của mình.
  - [x] `catalog/domain/product-price-events.ts` — **pure**: class `ProductPricesReplaced implements DomainEvent` (`before`/`after` = mảng `{ minQty, price }`).

- [x] **Task 4 — DTO (AC: 4, 7)**
  - [x] `catalog/dto/product-price.dto.ts` — `minQty` (`@IsInt() @Min(2)`) · `price` (`@IsInt() @Min(0)`). **Tiền là `@IsInt()`, cấm `@IsNumber()`** (AD-10).
  - [x] `catalog/dto/replace-product-prices-request.dto.ts` — `prices: ProductPriceDto[]` với `@IsArray() @ValidateNested({ each: true }) @Type(() => ProductPriceDto)`. Mảng rỗng hợp lệ (AC-7). **KHÔNG** `@ArrayNotEmpty()`.
  - [x] `feature-flags/dto/toggle-feature-flag-request.dto.ts` — `enabled: boolean` (`@IsBoolean()`). **Dùng `@IsBoolean()` trần, KHÔNG `@IsOptional()`** — `enabled` là bắt buộc; `{"enabled": null}` phải chết thành 400, không được lọt xuống cột NOT NULL (bài học HIGH của review 3.1).
  - [x] Nếu có field optional nào ⇒ dùng `@IsOptionalNotNull()` (`catalog/dto/is-optional-not-null.decorator.ts`), **KHÔNG** `@IsOptional()`, **KHÔNG** `PartialType` (xem "Previous Story Intelligence").
  - [x] `feature-flags/dto/feature-flag-response.dto.ts` + `catalog/dto/product-price-response.dto.ts` — chỉ để OpenAPI.

- [x] **Task 5 — `ProductPricesService` + nối cờ vào `ProductsService` (AC: 5, 6, 7, 9)**
  - [x] `catalog/product-prices.service.ts` — inject `PrismaService` + `EventBus` + `FeatureFlagsService`. `findByProduct(productId)` (sắp `minQty` asc) · `replace(actor, productId, prices)`.
  - [x] `replace()` theo thứ tự: (1) cờ TẮT ⇒ `AppException(CONFLICT, 409)` **trước khi chạm DB**; (2) sản phẩm không tồn tại ⇒ 404; (3) trùng `minQty` trong payload ⇒ `AppException(VALIDATION_ERROR, 400, …, fieldErrors)`; (4) đọc `before` (bậc thang cũ); (5) `$transaction([deleteMany, …(rows.length ? [createMany] : [])])` — **nhớ cạm bẫy `createMany` mảng rỗng ở AC-7**; (6) publish `ProductPricesReplaced` sau commit.
  - [x] `CatalogModule` → `imports` hiện là `[AccountsModule]` ⇒ **thêm** `FeatureFlagsModule` (thành `[AccountsModule, FeatureFlagsModule]`); `providers: [..., ProductPricesService]`, `controllers: [..., ProductPricesController]`.
  - [x] **`ProductsService`: đính `prices` vào response CHỈ khi cờ BẬT** (AC-5). `findAll(includeInactive, canViewCosts, **tieredPricingEnabled**)` / `findOne(id, canViewCosts, **tieredPricingEnabled**)` — cờ là **tham số truyền vào**, resolve ở controller (AC-5). BẬT ⇒ `include: { prices: { orderBy: { minQty: 'asc' } } }`; TẮT ⇒ **không include**, payload **không có key** `prices` (giống `stripCostPrice`: loại hẳn key, không trả `[]`).
  - [x] **CẤM inject `FeatureFlagsService` vào `ProductsService`** — constructor giữ đúng 2 tham số (AC-5, AC-11).
  - [x] ⚠️ **Đừng phá `costs.view`**: `stripCostPrice` vẫn phải chạy trên object đã có `prices` (generic `<T extends { costPrice: number }>` chịu được field mới). `ProductPrice` **không** mang giá vốn ⇒ không cần strip gì trong mảng `prices`. Test hồi quy 3.1 (`costPrice` bị loại) phải vẫn xanh.
  - [x] **UPDATE `catalog/dto/product-response.dto.ts`** — thêm `prices?: ProductPriceResponseDto[]` khai `@ApiPropertyOptional({ type: [ProductPriceResponseDto] })`. Thiếu bước này, `prices` **biến mất khỏi `openapi.json`** mà `openapi-drift.spec.ts` **vẫn xanh** (nó so generated-vs-committed, không biết field bị thiếu) ⇒ hợp đồng API hỏng **âm thầm**. Đây là field chủ đạo của story — phải có mặt trong OpenAPI.

- [x] **Task 6 — `ProductPricesController` + nối cờ ở `ProductsController` (AC: 3, 5)**
  - [x] `catalog/product-prices.controller.ts` — `@ApiTags('catalog') @ApiBearerAuth() @Controller('products/:productId/prices')`; `GET` + `PUT`, **mỗi** handler `@RequirePermissions(PERM.catalogManage)`, actor qua `@CurrentAccount()`.
  - [x] **UPDATE `catalog/products.controller.ts`** — inject `FeatureFlagsService`; trong `findAll`/`findOne`, resolve `const tieredPricingEnabled = await this.featureFlags.isEnabled(FLAG.catalogTieredPricing)` rồi truyền xuống service. Đặt cạnh `canViewCosts` — **cùng một khuôn, cùng một chỗ** (`products.controller.ts:60-63`).
  - [x] Handler viết dạng **method thường, thụt 2 space** (regex source-guard; arrow-function property bị tính là offender — bài học 2.10).
  - [x] Swagger: `@ApiOkResponse` + `@ApiBadRequestResponse`/`@ApiForbiddenResponse`/`@ApiNotFoundResponse`/`@ApiConflictResponse`, mỗi cái `{ type: ErrorEnvelopeDto }`. **Controller KHÔNG tự dựng error envelope**, **không** viết chữ `traceId` (guard `no-controller-error-envelope`).

- [x] **Task 7 — Test (AC: mọi AC)**
  - [x] `backend/test/price-resolution.spec.ts` (**pure, không mock gì**) — bảng biên: cờ TẮT + có tiers ⇒ `basePrice`; `quantity` **đúng bằng** `minQty` ⇒ ăn bậc đó (biên `<=`, không phải `<`); `quantity` dưới bậc thấp nhất ⇒ `basePrice`; `tiers` **đảo lộn thứ tự** ⇒ vẫn chọn đúng bậc cao nhất `<= quantity` (chứng minh không phụ thuộc thứ tự); `tiers` rỗng ⇒ `basePrice`.
  - [x] `backend/test/feature-flags.service.spec.ts` — vắng dòng DB ⇒ `isEnabled` = `false` (fail-closed); `listAll` trả **đủ** key registry kể cả key chưa có dòng; `setEnabled` publish `FeatureFlagToggled` sau commit với `before`/`after` đúng; **(AC-6)** `setEnabled(actor, key, false)` ⇒ mock `prisma` **không** có method nào của `productPrice` được gọi (tắt cờ **không** xoá bậc thang) — dựng mock `productPrice: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() }` rồi assert cả ba `not.toHaveBeenCalled()`.
  - [x] `backend/test/product-prices.service.spec.ts` — cờ TẮT ⇒ `replace` ném 409 **và `prisma.$transaction` KHÔNG được gọi**; `minQty` trùng trong payload ⇒ 400; `PUT []` ⇒ `deleteMany` chạy, `createMany` **KHÔNG** được gọi (cạm bẫy Prisma 7); publish `ProductPricesReplaced` với `before`/`after` là cả bậc thang.
  - [x] `backend/test/product-prices.e2e.spec.ts` (supertest + `AppModule`) — ma trận 403: JWT thiếu `catalog.manage` ⇒ 403 trên cả `GET`/`PUT` prices; JWT thiếu `system.feature_flags` ⇒ 403 trên `PATCH /feature-flags/:key` **kể cả khi có `catalog.manage`** (hai quyền tách bạch — AC-3); cờ TẮT ⇒ `GET /products/:id` body **không có** key `prices` (assert `not.toHaveProperty('prices')`); cờ BẬT ⇒ có; `PATCH /feature-flags/<key lạ>` ⇒ 404; audit ghi `FeatureFlagToggled` + `ProductPricesReplaced` qua `AuditSubscriber` thật.
  - [x] **Gotcha e2e bắt buộc:** set `process.env.JWT_ACCESS_SECRET` ở **top-level** rồi `await import('../src/app.module')` **động** trong `beforeAll` (static import ⇒ `JwtModule.register` đọc secret rỗng). Mock Prisma phải có `featureFlag`, `productPrice`, **và `auditLog`** (`AuditSubscriber` chạy thật trong e2e). Khuôn: `backend/test/products.e2e.spec.ts`.
  - [x] **UPDATE `backend/test/products.service.spec.ts`** (AC-11) — truyền tham số `tieredPricingEnabled` vào mọi lời gọi `findAll`/`findOne`. **Không** đổi `new ProductsService(prisma, eventBus)` (vẫn 2 tham số).
  - [x] **UPDATE `backend/test/products.e2e.spec.ts`** (AC-11) — thêm `featureFlag: { findUnique: jest.fn().mockResolvedValue(null) }` vào `prismaMock` (dòng ~69). `null` ⇒ cờ TẮT ⇒ hành vi 3.1 giữ nguyên y hệt ⇒ 309 test cũ xanh lại. **Thiếu bước này ⇒ mọi request đọc product thành 500.**
  - [x] **Mutation-test 3 thứ dễ xanh-giả** (luật 2.10): (a) đổi `resolveUnitPrice` bỏ nhánh `tieredPricingEnabled === false` ⇒ test phải ĐỎ; (b) bỏ `if (rows.length > 0)` quanh `createMany` ⇒ test `PUT []` phải ĐỎ; (c) bỏ điều kiện cờ ở `ProductsService` (luôn include `prices`) ⇒ test "cờ TẮT ⇒ body không có key `prices`" phải ĐỎ. Xanh lại sau khi khôi phục.

- [x] **Task 8 — Artifact + quality gate (AC: 10)**
  - [x] `npm run openapi:gen` → commit `backend/openapi/openapi.json`.
  - [x] **KHÔNG** chạy `permissions:gen`, **KHÔNG** đụng generator FE — registry quyền không đổi.
  - [x] `npm run lint` · `npm run format:check` · `nest build` sạch.

### Review Follow-ups (AI)

Sinh ra từ code review 2026-07-13. Không có CRITICAL nào còn lại; ba mục dưới là nợ có ý thức, Đại Ca đã chốt hoãn.

- [ ] **[AI-Review][MEDIUM]** `before`/`after` đọc NGOÀI `$transaction` (`backend/src/catalog/product-prices.service.ts:79,104`). Hai admin `PUT` bậc thang cùng lúc trên cùng sản phẩm ⇒ event `ProductPricesReplaced` có thể ghi `before` đã cũ, và body 200 có thể mô tả bậc thang của người khác. **Dữ liệu KHÔNG hỏng** (mỗi tx nguyên tử, last-writer-wins) — chỉ audit nói sai. Sửa = chuyển sang `$transaction(async (tx) => …)` interactive, giữ nguyên guard mảng rỗng. **Hoãn có chủ đích:** AC-7/Task 5 chốt khuôn array-form và 2 unit test đang assert trên mảng `ops`; đổi khuôn là lệch story, không phải sửa lỗi.
- [ ] **[AI-Review][MEDIUM]** Đường ĐỌC sản phẩm giờ phụ thuộc CỨNG vào bảng `feature_flags` (`products.controller.ts:77`). Ship code trước khi chạy migration ⇒ Prisma ném `P2021` ⇒ **toàn bộ `GET /products` sập 500**, không "degrade về cờ tắt". Xử lý = ép `prisma migrate deploy` thành cổng bắt buộc lúc release. **KHÔNG** bọc `try/catch → false`: nó biến một lỗi deploy ồn ào thành một lỗi im lặng fail-OPEN.
- [ ] **[AI-Review][LOW]** `resolveUnitPrice` (`price-resolution.ts:49`) dùng `>` khi chọn max ⇒ `minQty` trùng thì phần tử ĐỨNG TRƯỚC trong mảng thắng — phụ thuộc thứ tự, trái với lời hứa "không giả định gì về caller" ở doc-comment. Hiện không với tới được (DB có `@@unique([productId, minQty])`), nhưng Story 4.1 sẽ gọi hàm này với tiers từ nguồn khác. Ghim tie-break bằng một test trước khi 4.1 dùng.

## Dev Notes

### Quyết định lớn của story này (đã cân nhắc — đừng lật ở review mà không có bằng chứng mới)

**`ProductPrice` khoá theo `minQty` (bậc thang số lượng), KHÔNG theo Loại khách.**

| Nguồn | Nói gì |
|---|---|
| ARCHITECTURE-SPINE ERD (ADOPTED) :305-310 | `PRODUCT_PRICE { uuid id PK, uuid productId FK, int minQty, int price }` — khoá theo **số lượng** |
| PRD FR-15 :231 | "chọn mức giá theo ngữ cảnh (vd theo Loại khách)" — gắn nhãn `[ASSUMPTION: … xác nhận]`, **chưa được xác nhận** |
| PRD :552 | Chính FR-15 nằm trong danh sách **câu hỏi mở** của PRD |
| Epic 3.2 AC :372 | "**vd** theo Loại khách" — *ví dụ*, không phải mệnh lệnh |

Căn cứ chốt `minQty`:
1. **Spine là quyết định ADOPTED và cụ thể**; "theo Loại khách" là giả định PRD tự đánh dấu là chưa chốt.
2. **Không có gì để khoá vào.** `Customer` chưa tồn tại (Story 3.3 còn backlog), `Order.custType` mãi Story 4.3 mới có. Khoá theo Loại khách ⇒ story này giao ra **kho lưu chỉ-ghi-không-đọc-được**, không test được đầu-cuối, và đẻ ra một enum `CustomerType` không có chủ sở hữu rõ ràng (3.3 hay 4.3 sẽ khai lại?).
3. **"Giá lẻ/sỉ" vốn dĩ LÀ bậc thang số lượng** — mua ≥ N tấm ⇒ ăn giá sỉ. `minQty` thoả đúng tiêu đề FR-15 ("hỗ trợ giá lẻ/sỉ") **ngay hôm nay**, không nợ entity nào.
4. NFR PRD:564 — "solo dev, ưu tiên đơn giản".

⇒ **Ghi câu hỏi xác nhận #1 ở cuối file.** Nếu Đại Ca muốn tầng theo Loại khách, đó là **thay đổi phạm vi**, phải đợi 3.3/4.3 và phải sửa AC của Story 4.1/4.3 — không phải một cột thêm vào lặng lẽ.

**Các quyết định phụ:**

1. **Cờ nằm ở bảng `feature_flags` (key/value), KHÔNG phải cột boolean trên bảng nào.** Spine bắt buộc "cờ trên DB" (AD-14) nhưng **chưa từng nói ở bảng nào** — đây là lỗ hổng thiết kế story này phải lấp. Bảng key/value nhỏ, một model, không framework. **KHÔNG** dựng "hệ thống feature-flag tổng quát" (rollout %, targeting, audience) — YAGNI, chỉ có đúng **một** cờ.
2. **`vatRate` (FR-3, Story 4.4) KHÔNG dùng bảng này.** Cờ là `boolean`; `vatRate` là **giá trị số**. Nhét cả hai vào một bảng key/value ⇒ cột `value` kiểu `String` ⇒ mất type-safety ở chỗ tính tiền. Để 4.4 tự quyết. **Đừng** tổng quát hoá sẵn.
3. **Xoá dòng `ProductPrice` = hard delete, an toàn.** Khác `Product` (soft-delete vì Epic 4/6 FK vào). Báo cáo lợi nhuận (Epic 8:690) chỉ đọc **snapshot** (`unitPriceSnapshot`, `costPriceSnapshot`), **không bao giờ** join ngược `ProductPrice`. ⇒ Bậc thang là **nguồn phân giải lúc đọc**, không phải dữ liệu lịch sử ⇒ không cần soft-delete, không cần versioning.
4. **Cờ TẮT thì `PUT` prices bị chặn (409), không phải "cho ghi nhưng lờ đi".** Ghi âm thầm vào một bảng không ai đọc là cách tạo dữ liệu ma. Muốn cấu hình bậc thang ⇒ bật cờ trước.

### Ràng buộc kiến trúc bắt buộc (vi phạm = fail guard hoặc fail review)

| Ràng buộc | Nguồn | Hệ quả cụ thể cho story này |
|---|---|---|
| Tiền = **integer đồng** | AD-10, AD-16 | `ProductPrice.price` là `Int`, DTO `@IsInt() @Min(0)`. `resolveUnitPrice` **không** làm tròn, **không** nhân chia. |
| Cờ nghiệp vụ **trên DB**, KHÔNG Remote Config | AD-14 | Cấm đụng `firebase_remote_config`. Cấm biến môi trường. Cấm hằng số trong code. |
| Bấm cờ = `system.feature_flags` | AD-14 | **KHÔNG** gộp với `catalog.manage`. Hai hành động khác nhau, hai quyền khác nhau. |
| **KHÔNG** hồi tố đơn đã chốt | AD-6, AD-20, FR-5 | Story chỉ chạm `products`/`product_prices`/`feature_flags`. **Không import gì từ `orders/`.** |
| **EventBus** cho mọi side-effect | AD-18 | Chỉ inject `EventBus`. Cấm `AuditService`/`NotificationDispatcher`. Publish **sau commit**. |
| **Permission registry** là SSOT | AD-17 | Import `PERM`. Cấm literal `'system.feature_flags'`/`'catalog.manage'` ở file khác — kể cả trong `example:` của `@ApiProperty`. |
| Backend **luôn enforce** | AD-4 | Cờ TẮT ⇒ server **không trả** `prices`. Không phải "để FE tự ẩn". |
| Error envelope **một chỗ** | AD-5 | Throw `AppException`. Cấm token `traceId` trong `src/`. |
| OpenAPI **sinh từ code** | AD-12 | Không sửa tay `openapi.json`; chạy `openapi:gen`. |

### Cờ tắt/bật và đơn đang dựng — chuyện phải hiểu đúng

- **Đơn ĐÃ CHỐT: miễn nhiễm, bằng kiến trúc.** Đơn đã chốt đọc `OrderLineItem.unitPriceSnapshot` (đóng băng lúc chốt — AD-20), **không** đọc `Product.price` hay `ProductPrice`. Bật/tắt cờ, sửa bậc thang ⇒ **không** đơn chốt nào đổi giá. Đây là hệ quả của snapshot, không phải một nhánh `if` story này phải viết.
- **Đơn ĐANG DỰNG (chưa chốt): sẽ ăn giá mới ở lần preview kế tiếp** — đúng FR-14 ("cập nhật giá phản ánh ngay vào báo giá đang dựng"). Story này **không** hiện thực preview; chỉ cần **không** cản đường nó.
- ⇒ Story 3.2 **không** cần bất kỳ code nào để "bảo vệ đơn cũ". Nếu thấy mình đang viết code đọc bảng `orders` ⇒ **dừng lại, sai hướng**.

### Điểm nối với Epic 4 (viết `resolveUnitPrice` cho người khác dùng)

Story 4.1 AC (epics.md:414): *"dòng pick từ Sản phẩm (**auto-điền đơn giá theo danh mục hiện tại**, trước chốt)"* — **đó chính là call-site** của `resolveUnitPrice`. Story 4.1 hiện **chưa** biết gì về bậc thang; nó sẽ phải gọi hàm này.

`OrderLineItem` (ERD:277) **đã có sẵn hai cột giá**: `catalogPriceSnapshot` và `unitPriceSnapshot`. Giá bậc thang phân giải ra sẽ chảy vào đó khi 4.1/4.5 làm. **Đừng** đẻ thêm cột "tierPriceSnapshot" thứ ba — thừa.

⇒ Trong story này: giữ `resolveUnitPrice` **thuần và độc lập** (không đụng Prisma, không đụng service), để 4.1 `import` thẳng. Đó là toàn bộ "API" mà story này để lại cho Epic 4.

### Testing

- Vị trí: **mọi spec nằm phẳng ở `backend/test/`**. Unit = `<subject>.spec.ts`; e2e = `<subject>.e2e.spec.ts`.
- Lệnh: `cd backend && npm test` (Jest, hermetic, **không cần Postgres**).
- Mock Prisma: object `jest.fn()` cast `as unknown as PrismaService` (không dùng `jest-mock-extended`).
- e2e: `Test.createTestingModule({ imports: [AppModule] })` + `.overrideProvider(PrismaService | AccountsService | AccountPermissionsService)`; quyền giả lập bằng `accountPermissionsMock.listForAccount.mockResolvedValue(new Set([...]))`; JWT thật ký qua `moduleRef.get(JwtService)`.
- **Bắt buộc test cho phần dễ sai/tiền bạc** (project-context): biên `minQty <= quantity`, cờ TẮT bỏ qua tiers, `createMany` mảng rỗng, ma trận 403 hai quyền.
- `$transaction` trong mock: `prisma.$transaction = jest.fn(async (ops) => Promise.all(ops))` (dạng array) — assert **cả** `deleteMany` và `createMany` được/không-được đưa vào mảng ops.

### Project Structure Notes

```
backend/
  prisma/
    schema.prisma                                    # UPDATE: + FeatureFlag, + ProductPrice, + Product.prices
    migrations/<ts>_add_feature_flags_and_product_prices/  # NEW (sinh offline)
  src/
    app.module.ts                                    # UPDATE: + FeatureFlagsModule
    feature-flags/                                   # NEW
      feature-flags.module.ts
      feature-flags.controller.ts                    # /feature-flags
      feature-flags.service.ts
      domain/
        feature-flag-registry.ts                     # pure: FLAG = { catalogTieredPricing }
        feature-flag-events.ts                       # pure: FeatureFlagToggled
      dto/
        toggle-feature-flag-request.dto.ts
        feature-flag-response.dto.ts
    catalog/                                         # UPDATE (module đã có từ 3.1)
      catalog.module.ts                              # UPDATE: + FeatureFlagsModule, + ProductPricesService/Controller
      products.controller.ts                         # UPDATE: resolve cờ, truyền xuống service
      products.service.ts                            # UPDATE: + tham số tieredPricingEnabled → include prices
      product-prices.controller.ts                   # NEW — /products/:productId/prices
      product-prices.service.ts                      # NEW
      domain/
        price-resolution.ts                          # NEW — pure: resolveUnitPrice()
        product-price-events.ts                      # NEW — pure: ProductPricesReplaced
      dto/
        product-response.dto.ts                      # UPDATE: + prices?: ProductPriceResponseDto[]
        product-price.dto.ts                         # NEW
        replace-product-prices-request.dto.ts        # NEW
        product-price-response.dto.ts                # NEW
  openapi/openapi.json                               # UPDATE: `npm run openapi:gen`
  test/
    price-resolution.spec.ts                         # NEW (pure)
    feature-flags.service.spec.ts                    # NEW
    product-prices.service.spec.ts                   # NEW
    product-prices.e2e.spec.ts                       # NEW
    products.service.spec.ts                         # UPDATE (AC-11) — thêm tham số cờ vào findAll/findOne
    products.e2e.spec.ts                             # UPDATE (AC-11) — prismaMock + featureFlag
```

**⚠️ Hai file `test/products.*.spec.ts` là UPDATE BẮT BUỘC, không phải tuỳ chọn** — xem AC-11. Bỏ qua ⇒ 309 test của story 3.1 chuyển ĐỎ.

**Index thừa có chủ đích:** `@@unique([productId, minQty])` + `@@index([productId])` là dư trên Postgres (unique index đã phục vụ tra cứu theo `productId`). **Vẫn giữ** vì đúng khuôn `AccountPermission` (`schema.prisma:58-59`) — nhất quán với repo quan trọng hơn tiết kiệm một index trên bảng nhỏ. Ghi ở đây để reviewer không tưởng là bloat vô ý.

**Naming guard:** mọi tên file kebab-case, mọi dot-segment khớp `^[a-z0-9]+(-[a-z0-9]+)*$`.

**Tái dùng, KHÔNG viết lại** (scout-before-code — đã scout, đây là kết quả):
- `PrismaService` (`@Global`), `EventBus` + `DomainEvent` (`src/events/`, `@Global`) — chỉ inject.
- `AppException` + `ErrorCode` — `src/common/errors/`. `ErrorCode` **đã có** `VALIDATION_ERROR`/`FORBIDDEN`/`NOT_FOUND`/`CONFLICT` ⇒ **không thêm error code mới**.
- `@RequirePermissions`, `@AuthenticatedOnly`, `@CurrentAccount`, `AuthenticatedAccount` — `src/auth/`.
- `PERM` / `PermissionKey` — `src/accounts/domain/permission-registry.ts`. **`systemFeatureFlags` và `catalogManage` đã có sẵn.**
- `@IsOptionalNotNull()` — `src/catalog/dto/is-optional-not-null.decorator.ts` (đã có từ review 3.1).
- `stripCostPrice` — `src/catalog/domain/product-visibility.ts`. Khuôn "loại hẳn key khỏi payload" ⇒ **dùng lại khuôn này cho `prices`**, đừng phát minh cách ẩn field mới.
- Atomic-replace trong `$transaction` — khuôn `src/accounts/account-permissions.service.ts`.
- Global `ValidationPipe` (`whitelist: true`) — `src/common/common.module.ts`. **Không** tự tạo pipe.
- **Không** re-register guard (`APP_GUARD` ở `AuthModule`), **không** import `PrismaModule`/`EventsModule`.

### Previous Story Intelligence (Story 3.1 — vừa xong, cùng module `catalog/`)

1. **🔴 Bài học đắt nhất của 3.1 (lỗi HIGH ở review): `@IsOptional()` cho `null` lọt qua.** `@IsOptional()` tắt **mọi** validator khi giá trị là `undefined` **HOẶC `null`** ⇒ `{"price": null}` đi thẳng xuống cột NOT NULL ⇒ **500** thay vì **400**. Và `PartialType(...)` **tự gắn `@IsOptional()` lên MỌI field** ⇒ hở toàn bộ. **Trong story này:** dùng `@IsOptionalNotNull()` cho field optional, **cấm `PartialType`**, và `enabled`/`minQty`/`price` là **bắt buộc** nên dùng validator trần (`@IsBoolean()`/`@IsInt()`). Mock Prisma **nuốt `null` không kêu ca** ⇒ test hermetic không tự thấy lỗi này. Phải viết test `null` tường minh.
2. **Cờ Prisma CLI:** Prisma 7.8 chỉ nhận `--from-schema` / `--to-schema` (**không** `--from-schema-datamodel`). Schema "trước" lấy bằng `git show HEAD:backend/prisma/schema.prisma`.
3. **`stripCostPrice` dùng copy + `delete` key**, không rest-destructuring (ESLint `no-unused-vars` không bật `ignoreRestSiblings` ⇒ biến `_costPrice` báo lỗi lint).
4. **Guard `no-permission-literal-outside-registry` quét sau khi strip comment nhưng GIỮ NGUYÊN string** ⇒ literal `'catalog.manage'` trong `@ApiProperty({ example: … })` **cũng fail**. Dùng `PERM.*`.
   ⚠️ **Kiểm tra khi code:** key cờ `'catalog.tiered_pricing'` **không** nằm trong 20 permission key ⇒ guard không bắt. Nhưng chạy `npm test` xác nhận, đừng đoán.
5. **Guard `no-handler-without-require-permissions` fail-closed:** handler hình dạng lạ (arrow-function property, thụt lề ≠ 2 space) bị tính là offender. Viết method thường, thụt 2 space.
6. **Quyền resolve 2 lần/request** (guard + controller) — đã ghi nhận ở review 3.1 là LOW, **không sửa trong story này**. `FeatureFlagsService.isEnabled` sẽ thêm **một** query nữa mỗi lần đọc product. Chấp nhận (~20 user nội bộ, PRD:564). **Đừng** dựng cache/request-scope trong story này — đó là abstraction dùng chung, thuộc story khác.
7. **Nợ kỹ thuật còn nguyên:** mọi migration sinh **offline**, **chưa từng** chạy `migrate deploy` trên Postgres thật. Test hermetic **không chứng minh được** ràng buộc DB thật sự chạy. Story này thêm `@@unique([productId, minQty])` + một FK `onDelete: Cascade` vào đống chưa kiểm đó. **Trong scope: viết migration đúng, mock test như thường lệ, và KHÔNG tuyên bố "đã kiểm ràng buộc unique/cascade".** Ghi giới hạn này vào Completion Notes.

### Git Intelligence (5 commit gần nhất)

`0fba7c2` story 3.1 (CRUD Product + 4 cột mới) · `710333c` story 2.10 (không-leo-thang + source-guard) · `3a00af9` story 2.9 (**3 quyền mới: `settings.manage`, `system.feature_flags`, `costs.view`**) · `a669eca` story 1.12 · `757efce` docs yêu cầu mới khách hàng.

⇒ `system.feature_flags` **đã có sẵn** trong registry từ 2.9, **chỉ append vào `SUPER_ADMIN`**, nằm **NGOÀI** `ADMIN_PRESET` (`role-presets.ts`). Story 3.2 **không thêm permission key nào** ⇒ **không** regen `permissions.json`, **không** chạm generator FE. Commit conventional, không tham chiếu AI.

### Library / Framework

Node 24 LTS · NestJS 11.1.27 · Prisma 7.8.0 · PostgreSQL 18.4 · class-validator + `@nestjs/swagger` (không zod).

**Prisma 7 gotcha (đã cắn, ghi lại):**
- `datasource db` trong `schema.prisma` **không** chứa `url` — URL ở `prisma.config.ts`.
- Field Json nullable: dùng `Prisma.JsonNull`, không `null` thuần (`audit.service.ts` có helper `toJsonInput`) — liên quan vì `before`/`after` của event đi vào `AuditLog`.
- **`createMany({ data: [] })` mảng rỗng làm hỏng atomic-replace** — xem AC-7. Đây là lỗi đã xảy ra thật ở repo này.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.2] — AC gốc (cờ mặc định TẮT; BẬT ⇒ `ProductPrice`; cờ trong DB).
- [Source: prds/prd-Solar-Energy-Management-2026-07-06/prd.md#FR-15:227-231] — "giá lẻ/sỉ, ẩn sau một cờ, mặc định tắt"; `[ASSUMPTION: … theo Loại khách; xác nhận]`.
- [Source: prd.md:552] — FR-15 nằm trong danh sách câu hỏi mở của PRD (quy tắc chọn mức chưa chốt).
- [Source: prd.md#FR-14:221-225] — cập nhật giá phản ánh ngay vào báo giá đang dựng; không hồi tố đơn đã chốt.
- [Source: architecture/…/ARCHITECTURE-SPINE.md#AD-14:126-130] — cờ giá phân tầng **lưu trên DB**, KHÔNG Remote Config; bấm cờ gate bởi `system.feature_flags`.
- [Source: ARCHITECTURE-SPINE.md#ERD:305-310] — `PRODUCT_PRICE { uuid id PK, uuid productId FK, int minQty, int price }`.
- [Source: ARCHITECTURE-SPINE.md#AD-10:102-106] — tiền là integer đồng.
- [Source: ARCHITECTURE-SPINE.md#AD-20:162-166] — hai mốc đóng băng: giá bán lúc chốt, giá vốn lúc xuất kho.
- [Source: ARCHITECTURE-SPINE.md:437] — module tree: `catalog/` = Product + tiered price (FR-14, FR-15).
- [Source: docs/quyet-dinh-yeu-cau-moi-khach-hang-2026-07-10.md:147,154,158] — `system.feature_flags` = cờ giá phân tầng, **CHỈ `SUPER_ADMIN`**, ngoài `ADMIN_PRESET`.
- [Source: epics.md#Story-4.1:414] — "auto-điền đơn giá theo danh mục hiện tại" = call-site tương lai của `resolveUnitPrice`.
- [Source: epics.md#Epic-8:690] — báo cáo lợi nhuận chỉ đọc snapshot ⇒ `ProductPrice` không cần soft-delete.
- [Source: backend/src/catalog/products.service.ts] — khuôn service: inject `PrismaService` + `EventBus`, publish sau commit, `AppException`.
- [Source: backend/src/catalog/domain/product-visibility.ts] — khuôn loại hẳn key khỏi payload.
- [Source: backend/src/accounts/account-permissions.service.ts] — khuôn atomic-replace trong `$transaction`.
- [Source: backend/src/accounts/domain/permission-registry.ts] — khuôn registry `as const` (áp cho `feature-flag-registry.ts`).
- [Source: backend/src/auth/authenticated-only.decorator.ts] — `@AuthenticatedOnly()` cho route chỉ cần phiên hợp lệ.
- [Source: backend/test/products.e2e.spec.ts] — khuôn e2e: dynamic import `AppModule`, `JWT_ACCESS_SECRET` top-level, mock `auditLog`.
- [Source: _bmad-output/implementation-artifacts/3-1-crud-san-pham-gia.md#Senior-Developer-Review] — lỗi HIGH `@IsOptional()` + `null`; cấm `PartialType`.
- [Source: backend/CONVENTIONS.md] — naming, error envelope, guard, EventBus, OpenAPI regen.
- [Source: _bmad-output/project-context.md] — stack, bất biến AD, testing, scout-before-code.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8)

### Debug Log References

1. **`nest build` đỏ — spread một union type làm hỏng kiểu Prisma.** Bản đầu viết helper trả `{}` hoặc `{ include: … }` rồi spread (`...tieredPriceInclude(flag)`) vào `findMany`/`findUnique`. TS suy union thành `{ include?: undefined }` ⇒ TS2345 ở cả hai call-site. **Cách sửa:** helper trả *giá trị* `include` (`{ prices: … }` hoặc `undefined`) và truyền tường minh `include: tieredPriceInclude(flag)`. Prisma coi `include: undefined` là "không include" ⇒ hành vi "cờ TẮT ⇒ payload không có key `prices`" giữ nguyên, và kiểu sạch. Ghi lại vì đây là cạm bẫy chung khi làm option Prisma có điều kiện.
2. **Prisma CLI:** xác nhận lại bài học 3.1 — Prisma 7.8 chỉ nhận `--from-schema` / `--to-schema` (KHÔNG `--from-schema-datamodel`). Schema "trước" lấy bằng `git show HEAD:backend/prisma/schema.prisma`.
3. **Prettier:** 2 file lệch format sau khi viết (`product-price-response.dto.ts`, `product-prices.service.ts`) — chạy `prettier --write` cho đúng 2 file đó, không đụng file khác.

### Completion Notes List

**Đã giao (mọi AC có test chứng minh, không có AC nào "xanh bằng lời hứa"):**

- **AC-1/AC-2** — `FeatureFlag` (`key` là PK, không có id uuid riêng) + registry `FLAG` thuần. Vắng dòng ⇒ `isEnabled` trả `false`; **không có dòng seed nào** — mặc định TẮT là hệ quả của việc vắng dòng. Không đụng `firebase_remote_config`.
- **AC-3** — hai quyền TÁCH BẠCH, có test e2e khẳng định: có `catalog.manage` mà thiếu `system.feature_flags` ⇒ **403 khi bấm cờ**. `GET /feature-flags` chỉ `@AuthenticatedOnly()` (sale Epic 4 không có `catalog.manage` vẫn đọc được cờ). Key lạ ⇒ 404, không âm thầm tạo cờ mới.
- **AC-4** — `ProductPrice` khoá theo `minQty` (+ `@@unique([productId, minQty])`, `@@index`, `onDelete: Cascade`). `@Min(2)` ràng ở DTO; `minQty = 1` ⇒ 400 (có test e2e). **Không** có cột giá vốn.
- **AC-5** — cờ TẮT ⇒ service **không `include`** ⇒ payload **không có key** `prices` (assert `not.toHaveProperty('prices')` qua HTTP thật). Cờ nối vào `ProductsService` **dạng tham số boolean** resolve ở controller — **constructor giữ đúng 2 tham số**, không inject `FeatureFlagsService` (test `Proxy` của 3.1 còn nguyên giá trị).
- **AC-6** — `setEnabled(actor, key, false)` ⇒ mock `prisma.productPrice` có `deleteMany`/`createMany`/`findMany` và **cả ba `not.toHaveBeenCalled()`**. Tắt cờ không xoá bậc thang.
- **AC-7** — atomic-replace trong một `$transaction`; `PUT []` hợp lệ ⇒ `deleteMany` chạy, **`createMany` KHÔNG được gọi** (cạm bẫy Prisma 7). Trùng `minQty` ⇒ 400 ở tầng app (không để DB `P2002` quyết sau khi `deleteMany` đã chạy).
- **AC-8** — `resolveUnitPrice` pure, tự chọn `minQty` lớn nhất `<= quantity` (test với `tiers` **đảo thứ tự** chứng minh không phụ thuộc thứ tự mảng). Cờ TẮT là chốt chặn đầu tiên.
- **AC-9** — chỉ inject `EventBus`; `FeatureFlagToggled` + `ProductPricesReplaced` (before/after = **cả bậc thang**) publish sau commit, e2e xác nhận chúng tới `AuditSubscriber` thật.
- **AC-10** — `openapi.json` regen + commit; `prices` **có mặt** trong `ProductResponseDto` (đã verify tường minh — thiếu bước này thì drift-guard vẫn xanh mà hợp đồng API hỏng âm thầm). **Không** thêm permission key, **không** chạy `permissions:gen`, **không** đụng generator FE.
- **AC-11** — hai suite cũ đã cập nhật: `products.service.spec.ts` (truyền tham số cờ) + `products.e2e.spec.ts` (`prismaMock` thêm `featureFlag`). Xác nhận đây là thay đổi **bắt buộc**: thiếu mock `featureFlag` thì mọi request đọc product thành 500.

**Mutation-test (luật 2.10 — chứng minh test không xanh-giả). Cả ba đều ĐỎ đúng chỗ, xanh lại sau khi khôi phục:**

| Đột biến | Kết quả |
|---|---|
| Bỏ nhánh `tieredPricingEnabled === false` trong `resolveUnitPrice` | 1 test ĐỎ ✅ |
| Bỏ `if (prices.length > 0)` quanh `createMany` | 2 test ĐỎ ✅ |
| `ProductsService` luôn `include` prices (bỏ điều kiện cờ) | 2 test ĐỎ ✅ |

**Kết quả kiểm thử:** `npm test` → **39 suite / 366 test xanh** (baseline 35/309 ⇒ +4 suite, +57 test, **0 regression**). 7 source-guard xanh. `npm run lint` · `npm run format:check` · `nest build` sạch. *(Con số "355" ở bản dev là sai — review đếm lại bằng `npx jest`: 366. Sau review: **370**.)*

**⚠️ GIỚI HẠN ĐÃ BIẾT — không tuyên bố quá lời:**

- Migration `20260713010000_add_feature_flags_and_product_prices` sinh **OFFLINE**, **chưa từng** chạy `migrate deploy` trên Postgres thật (nợ kỹ thuật có sẵn của repo). ⇒ **KHÔNG tuyên bố** đã kiểm chứng ràng buộc `@@unique([productId, minQty])` và FK `onDelete: Cascade` chạy thật ở tầng DB. Test hermetic chỉ chứng minh **service dịch đúng lỗi khi Prisma ném ra**, không chứng minh DB thực sự enforce. Nợ này đến hạn ở Story 3.3 ("chặn trùng SĐT" là ràng buộc DB).
- `FeatureFlagsService.isEnabled` thêm **một query mỗi request đọc product**. Chấp nhận có ý thức (~20 user nội bộ, PRD:564) — **cố ý không** dựng cache/request-scope: đó là abstraction dùng chung, thuộc story khác.
- Story này **không** nối giá phân tầng vào báo giá. `resolveUnitPrice` đã sẵn sàng cho Story 4.1 gọi; **không có** import nào từ `orders/`.

**5 câu hỏi cho Đại Ca ở cuối file vẫn còn nguyên — không chặn dev, nhưng câu #1 (bậc thang theo `minQty` chứ không theo Loại khách) nên được xác nhận lúc review.**

### File List

**NEW (13):**

- `backend/prisma/migrations/20260713010000_add_feature_flags_and_product_prices/migration.sql`
- `backend/src/feature-flags/feature-flags.module.ts`
- `backend/src/feature-flags/feature-flags.controller.ts`
- `backend/src/feature-flags/feature-flags.service.ts`
- `backend/src/feature-flags/domain/feature-flag-registry.ts`
- `backend/src/feature-flags/domain/feature-flag-events.ts`
- `backend/src/feature-flags/dto/toggle-feature-flag-request.dto.ts`
- `backend/src/feature-flags/dto/feature-flag-response.dto.ts`
- `backend/src/catalog/product-prices.controller.ts`
- `backend/src/catalog/product-prices.service.ts`
- `backend/src/catalog/domain/price-resolution.ts`
- `backend/src/catalog/domain/product-price-events.ts`
- `backend/src/catalog/dto/product-price.dto.ts`
- `backend/src/catalog/dto/replace-product-prices-request.dto.ts`
- `backend/src/catalog/dto/product-price-response.dto.ts`

**NEW — test (4):**

- `backend/test/price-resolution.spec.ts`
- `backend/test/feature-flags.service.spec.ts`
- `backend/test/product-prices.service.spec.ts`
- `backend/test/product-prices.e2e.spec.ts`

**MODIFIED (9):**

- `backend/prisma/schema.prisma` — + `FeatureFlag`, + `ProductPrice`, + `Product.prices` back-relation
- `backend/src/app.module.ts` — + `FeatureFlagsModule`
- `backend/src/catalog/catalog.module.ts` — + `FeatureFlagsModule`, + `ProductPricesService`/`Controller`
- `backend/src/catalog/products.controller.ts` — inject `FeatureFlagsService`, resolve cờ, truyền xuống service
- `backend/src/catalog/products.service.ts` — + tham số `tieredPricingEnabled` → include `prices` (constructor **giữ 2 tham số**)
- `backend/src/catalog/dto/product-response.dto.ts` — + `prices?: ProductPriceResponseDto[]`
- `backend/openapi/openapi.json` — regen (`npm run openapi:gen`)
- `backend/test/products.service.spec.ts` — **AC-11**: truyền tham số cờ + test cờ bật/tắt
- `backend/test/products.e2e.spec.ts` — **AC-11**: `prismaMock` + `featureFlag`

**MODIFIED — code review 2026-07-13 (5):**

- `backend/src/catalog/dto/product-price.dto.ts` — `@Max(INT4_MAX)` cho `minQty`/`price` (tràn INT4 ⇒ 400, không phải 500)
- `backend/src/catalog/dto/replace-product-prices-request.dto.ts` — `@IsObject({ each: true })` (mảng lồng ⇒ 400, không phải 500)
- `backend/src/catalog/products.controller.ts` — `Promise.all` cho hai truy vấn độc lập (quyền + cờ)
- `backend/test/product-prices.service.spec.ts` — assert **payload** `createMany`, không chỉ đếm số lần gọi (bịt CRITICAL xanh-giả)
- `backend/test/product-prices.e2e.spec.ts` — +4 test biên: mảng lồng, phần tử là chuỗi, tràn INT4 (`price`/`minQty`)

## Change Log

| Ngày | Thay đổi |
|---|---|
| 2026-07-13 | Hiện thực Story 3.2 — giá phân tầng sau cờ. Thêm `FeatureFlag` (cờ nghiệp vụ trên DB, fail-closed) + `ProductPrice` (bậc thang theo `minQty`) + `resolveUnitPrice` thuần cho Epic 4. Cờ TẮT ⇒ server loại hẳn key `prices` khỏi payload và chặn ghi bậc thang (409). Cập nhật 2 suite test cũ theo AC-11. 39 suite / 366 test xanh (baseline 35/309, 0 regression); 3 mutation-test xác nhận test không xanh-giả. |
| 2026-07-13 | **Code review (AI).** Vá 1 CRITICAL (payload `createMany` không được assert ở đâu — hoán vị `minQty`/`price` vẫn xanh) + 2 HIGH (mảng lồng và tràn INT4 lọt qua `ValidationPipe` ⇒ 500 thay vì 400) + 1 MEDIUM (2 truy vấn nối tiếp trên đường đọc danh mục ⇒ `Promise.all`). Thêm 4 test biên; 4 mutation-test xác nhận các bản vá thật sự cắn. 39 suite / **370 test** xanh. Status → done (0 CRITICAL). |

## Senior Developer Review (AI)

**Reviewer:** Đại Ca · **Ngày:** 2026-07-13 · **Kết quả: APPROVE** (0 CRITICAL còn lại)

**Cách review:** 3 reviewer song song (write-path · cờ+read-path · schema/contract), mỗi phát hiện đều phải **chứng minh bằng đột biến** — sửa code cho sai rồi chạy lại, test phải ĐỎ. Claim không có `file:line` hoặc output lệnh thì không tính là phát hiện.

**Đã kiểm và ĐÚNG (không phải lấp chỗ trống — đây là các nghi phạm chính):** thứ tự kiểm trong `replace()` (cờ → 404 → trùng → tx → publish) khớp AC-7; guard `createMany` mảng rỗng là thật, `deleteMany` chạy vô điều kiện; `isEnabled` fail-closed tuyệt đối (vắng dòng ⇒ `false`, lỗi DB thì **ném**, không bao giờ fail-open); cờ TẮT ⇒ body **không có key** `prices` qua HTTP thật; hai quyền `catalog.manage` / `system.feature_flags` tách bạch, có e2e chứng minh; `ProductsService` giữ đúng 2 tham số constructor; migration khớp schema **byte-identical** với DDL sinh lại từ `prisma migrate diff`; `prices` có mặt trong `ProductResponseDto` của `openapi.json`; `permissions.json` không đổi.

### Đã VÁ trong review

| # | Mức | Vấn đề | Bằng chứng | Bản vá |
|---|---|---|---|---|
| 1 | 🔴 **CRITICAL** | **Payload `createMany` không được assert ở đâu cả.** Test chỉ đếm `toHaveBeenCalledTimes(1)`, không bao giờ nhìn `data`. Vì `replace()` trả về một lần **đọc lại** từ mock, cả body HTTP lẫn event audit đều assert trên **giá trị mock**, không phải trên thứ đã ghi. | Đột biến hoán vị `minQty`↔`price` (ghi giá **10 đ** ở ngưỡng 2.300.000) ⇒ **37/37 vẫn XANH**. Đột biến ghi sang `productId` khác ⇒ **vẫn XANH**. Một lỗi sai giá đúng hình dạng này ship thẳng ra production. | `product-prices.service.spec.ts` — assert `toHaveBeenCalledWith({data: [...]})`. Nay cả hai đột biến đều ĐỎ. |
| 2 | 🟠 HIGH | `@ValidateNested({each:true})` **không loại phần tử bản thân nó là MẢNG**. `{"prices":[[{...}]]}` lọt pipe ⇒ `minQty`/`price` = `undefined` ⇒ xuống cột NOT NULL ⇒ **500** thay vì 400. Đúng họ lỗi `@IsOptional()`/`null` của review 3.1, chỉ đổi hình dạng: `null` đã chặn, mảng lồng thì chưa. | Chạy `ValidationPipe` thật + DTO thật: `PASSED-VALIDATION [nested array]`. | `replace-product-prices-request.dto.ts` — `@IsObject({each:true})`. |
| 3 | 🟠 HIGH | Không có trần trên ⇒ **tràn INT4**. Cột là `INTEGER` (max 2.147.483.647); `price: 9_999_999_999` qua pipe ⇒ Postgres `22003` ⇒ **500**. Gõ thừa một số 0 khi nhập giá là chuyện thường ngày, không phải tấn công. | `PASSED-VALIDATION [int32 overflow price / minQty]`. | `product-price.dto.ts` — `@Max(INT4_MAX)` cho cả `minQty` và `price`. |
| 4 | 🟡 MEDIUM | Mọi `GET /products` chạy **2 truy vấn nối tiếp** (quyền, rồi cờ) — cộng trọn một round-trip DB vào đường đọc nóng nhất. | `products.controller.ts:126-127,150-151`. | `Promise.all` — hai truy vấn độc lập, chạy song song. |

**+4 test biên** (mảng lồng · phần tử là chuỗi · tràn INT4 ×2). **4 mutation-test** xác nhận từng bản vá thật sự cắn: gỡ `@IsObject` ⇒ 1 ĐỎ; gỡ `@Max` ⇒ 2 ĐỎ; hoán vị payload ⇒ 1 ĐỎ; ghi sai `productId` ⇒ 1 ĐỎ.

**Cổng chất lượng sau vá:** `npm test` **39 suite / 370 test xanh** · lint · `format:check` · `nest build` sạch · `openapi.json` regen (drift guard xanh) · `permissions.json` không đổi.

### Đã BÁC BỎ (có bằng chứng)

- **"`isEnabled` fail-OPEN (`?? true`)" — SAI.** Một reviewer đọc phải file **đang bị reviewer khác đột biến** (3 agent chạy song song chung một working tree). Nguồn thật là `return row?.enabled ?? false;` (`feature-flags.service.ts:44`) và suite xanh 370/370. Cùng lý do với claim `productId: 'some-other-product'` là code thật — nó là đột biến, không phải nguồn. *(Bài học quy trình: mutation-test song song trên chung một cây làm việc thì reviewer đọc phải trạng thái rách của nhau.)*
- **"Concurrent `PUT` ⇒ `P2002` không map ⇒ 500"** — không với tới được: hai `PUT` đồng thời thì `deleteMany` của tx sau **khoá và chờ** tx trước commit, nên không có va chạm unique index. Không thêm handler suy đoán.

### Nợ có ý thức (Đại Ca đã chốt hoãn)

Xem **Review Follow-ups (AI)** ở mục Tasks. Tóm tắt: (1) `before`/`after` ngoài `$transaction` — audit có thể nói sai khi hai admin sửa cùng lúc, **dữ liệu không hỏng**; giữ khuôn array-form theo AC-7. (2) Ép `prisma migrate deploy` thành cổng release — đường đọc sản phẩm nay phụ thuộc cứng vào bảng `feature_flags`. (3) Tie-break `minQty` trùng trong `resolveUnitPrice` trước khi Story 4.1 gọi. **Không** thêm `@ArrayMaxSize` (YAGNI — endpoint đã gate bởi `catalog.manage`, người dùng nội bộ).

### Giới hạn vẫn còn nguyên (không tuyên bố quá lời)

Migration **chưa từng** chạy trên Postgres thật. Vẫn **CHƯA kiểm chứng**: `@@unique([productId, minQty])` enforce thật · FK `onDelete: Cascade` (hiện **không với tới được** vì `Product` là soft-delete) · rollback thật của `$transaction` · ngữ nghĩa `include: undefined` bỏ hẳn key `prices` trên Prisma client thật — **chính là cơ chế mà toàn bộ hợp đồng AC-5 dựa vào**. Rẻ nhất để đóng cả bốn: một spec tích hợp chạy Postgres qua Docker/testcontainers.

## Câu hỏi cho Đại Ca (không chặn dev — trả lời được lúc review)

1. **🔴 Quan trọng nhất — bậc thang giá khoá theo SỐ LƯỢNG (`minQty`), không theo Loại khách.** Story chốt `minQty` vì: ERD spine vẽ đúng vậy; PRD tự đánh dấu "theo Loại khách" là giả định **chưa xác nhận**; và **chưa có `Customer` lẫn `Order.custType`** để khoá vào (3.3, 4.3 còn ở phía trước). "Giá lẻ/sỉ" = mua ≥ N thì ăn giá sỉ — `minQty` diễn đạt đúng điều đó. **Nếu Đại Ca thực sự muốn giá theo Loại khách** (khách Thương mại luôn ăn giá sỉ bất kể mua 1 tấm), báo ngay — đó là **thay đổi phạm vi**, phải đợi Story 3.3/4.3 và phải sửa AC của Story 4.1/4.3.
2. **Cờ TẮT thì chặn ghi bậc thang (409).** Story chốt: muốn cấu hình mức giá ⇒ bật cờ trước. Phương án khác là "cho ghi thoải mái, chỉ lờ đi lúc đọc" — nhưng như vậy sinh dữ liệu ma không ai thấy. Xác nhận đúng ý?
3. **Tắt cờ KHÔNG xoá các mức giá đã cấu hình** (ngủ đông, bật lại là có ngay). Xác nhận? (Phương án xoá sạch khi tắt cờ là mất dữ liệu không hoàn tác được — story cố ý **không** làm.)
4. **Bảng `feature_flags` chỉ chứa cờ boolean.** `vatRate` (FR-3, Story 4.4) là **giá trị số**, story này **không** gộp vào — để 4.4 tự quyết bảng cấu hình của nó. Nếu Đại Ca muốn một bảng "cấu hình hệ thống" dùng chung ngay từ giờ, báo trước khi 4.4 chạy.
5. **Sửa spine (nhỏ):** AD-14 dòng `Binds:` chỉ liệt kê FR-30..34, **thiếu FR-15**, dù phần `Rule:` của chính nó điều chỉnh FR-15. Nên vá một dòng ở `ARCHITECTURE-SPINE.md` cho khớp.
