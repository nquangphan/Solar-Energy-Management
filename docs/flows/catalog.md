# Danh mục vật tư, nhóm hàng và bảng giá

> Flow `catalog`. Danh sách file chính thức nằm trong `docs/flows.yaml`; `crew-docs flow catalog` in ra đúng danh sách đó.

## Mục đích

Quản lý danh mục vật tư (FR-14) và giá bán theo bậc thang số lượng (FR-15) cho Phương Nam Solar:

- **Sản phẩm** (`Product`): tên, SKU duy nhất, đơn vị, giá bán `price`, giá vốn hiện hành `costPrice`
  (tiền là số nguyên đồng, AD-10/AD-16), cờ `tracksStock`, `priceEditable`, `warrantyMonths`, `isActive`.
- **Bậc thang giá** (`ProductPrice`): mua từ `minQty` (≥ 2) trở lên thì đơn giá là `price`; giá gốc là mức
  `minQty = 1` ngầm định. Chỉ có hiệu lực khi cờ `catalog.tiered_pricing` bật.
- **Gói vật tư** (`ProductGroup`): checklist sản phẩm có thứ tự để sale chọn nhanh khi dựng báo giá; gói
  không bao giờ gắn vào đơn.

Người quản lý danh mục (`catalog.manage`) sửa; người dựng báo giá (preset Thợ khảo sát, có `catalog.view`)
chỉ đọc. Giá vốn chỉ hiện với `costs.view`. Flow `orders` dùng `resolveUnitPrice` để điền và đóng băng
giá khi chốt; flow `inventory` cập nhật `costPrice` qua phiếu nhập.

## Điểm vào

HTTP (JWT bắt buộc; `@RequirePermissions` là AND):

- `POST /products` — `ProductsController.create`, `catalog.manage` (body có `costPrice` mà thiếu `costs.view` ⇒ 403).
- `GET /products?includeInactive=true` — `ProductsController.findAll`, `catalog.view`.
- `GET /products/:id` — `ProductsController.findOne`, `catalog.view`.
- `PATCH /products/:id` — `ProductsController.update`, `catalog.manage`.
- `DELETE /products/:id` — `ProductsController.remove`, `catalog.manage`, 204 (soft-delete).
- `GET /products/:productId/prices` — `ProductPricesController.findByProduct`, `catalog.view`.
- `PUT /products/:productId/prices` — `ProductPricesController.replace`, `catalog.manage` (cờ tắt ⇒ 409).
- `GET /product-groups?includeInactive=true` — `ProductGroupsController.findAll`, `catalog.view`.
- `POST /product-groups` — `ProductGroupsController.create`, `catalog.manage`.
- `POST /product-groups/:id/reactivate` — `ProductGroupsController.reactivate`, `catalog.manage`, 200.
- `PUT /product-groups/:id/items` — `ProductGroupsController.replaceItems`, `catalog.manage`.
- `GET /product-groups/:id` — `ProductGroupsController.findOne`, `catalog.view`.
- `PATCH /product-groups/:id` — `ProductGroupsController.update`, `catalog.manage`.
- `DELETE /product-groups/:id` — `ProductGroupsController.remove`, `catalog.manage`, 204 (soft-delete).

Route `:id/reactivate` và `:id/items` được khai TRƯỚC route `:id` trần để không bị nuốt.

Màn hình: flow này chưa có màn quản lý danh mục riêng. Web/mobile chỉ có port ĐỌC (`CatalogPort`) cho
picker "Chọn từ danh mục" / "Chọn gói vật tư" trong `CreateQuoteScreen` (web) và `create_quote_screen.dart`
(mobile), nối vào `HttpCatalogPort` ở app thật (web và mobile); test dùng `FakeCatalogPort`.

## Các bước

**A. Tạo / sửa / ẩn sản phẩm**

1. `backend/src/catalog/products.controller.ts` → `ProductsController.create` / `update`: resolve `canViewCosts` tươi mỗi request qua `AccountPermissionsService.listForAccount` (AD-8, không đọc từ JWT).
2. `backend/src/catalog/products.service.ts` → `ProductsService.assertMayWriteCostPrice`: body có `costPrice` (kiểm `!== undefined`) mà thiếu `costs.view` ⇒ 403 trước khi chạm DB.
3. `ProductsService.create` / `update`: ghi bảng `products` (create mặc định `costPrice ?? 0`); `sku` trùng ⇒ `translateWriteError` trả 409 kèm `fieldErrors` `sku`.
4. Sau commit publish `ProductCreated` / `ProductUpdated` với snapshot ĐỦ `costPrice` (audit ghi sự thật); response đi qua `stripCostPrice`.
5. `ProductsController.remove` → `ProductsService.deactivate`: `isActive = false`, publish `ProductDeactivated`; không bao giờ `delete` cứng.

**B. Đọc sản phẩm**

1. `ProductsController.findAll` / `findOne`: chạy song song `canViewCosts` và `tieredPricingEnabled` (`FeatureFlagsService.isEnabled(FLAG.catalogTieredPricing)`).
2. `ProductsService.findAll` / `findOne`: `include` bậc thang chỉ khi cờ bật (`tieredPriceInclude` trả `undefined` khi tắt ⇒ payload không có key `prices`); `stripCostPrice` (`domain/product-visibility.ts`) loại hẳn key `costPrice` khi thiếu quyền.

**C. Thay bậc thang giá**

1. `backend/src/catalog/product-prices.controller.ts` → `ProductPricesController.replace`: nhận `ReplaceProductPricesRequestDto` (`ProductPriceDto`: `minQty` ≥ 2, `price` ≥ 0).
2. `backend/src/catalog/product-prices.service.ts` → `ProductPricesService.replace`: cờ tắt ⇒ 409; sản phẩm không có ⇒ 404; trùng `minQty` trong payload ⇒ 400 (`assertNoDuplicateMinQty`), tất cả trước khi ghi.
3. Cùng hàm: một `$transaction([...])` gồm `SELECT id FROM products WHERE id = … FOR UPDATE`, `deleteMany` vô điều kiện, và `createMany` CHỈ khi mảng không rỗng (bẫy Prisma 7 `createMany` rỗng).
4. Sau commit publish `ProductPricesReplaced` với cả bậc thang trước/sau.

**D. Gói vật tư**

1. `backend/src/catalog/product-groups.controller.ts` → `ProductGroupsController.create` / `update` → `ProductGroupsService.create` / `update`: tên gói duy nhất (trùng ⇒ 409); publish `ProductGroupCreated` / `ProductGroupUpdated`.
2. `ProductGroupsService.deactivate` / `reactivate`: bật/tắt `isActive` (gói đã ở trạng thái đích ⇒ no-op, không event); publish `ProductGroupDeactivated` / `ProductGroupReactivated`.
3. `ProductGroupsService.replaceItems`: kiểm gói tồn tại (404), không trùng `productId` (400), mọi sản phẩm tồn tại (400, một `findMany`); `$transaction([...])` khoá `product_groups … FOR UPDATE` → `deleteMany` → `createMany` (chỉ khi không rỗng, `displayOrder` = vị trí trong mảng); publish `ProductGroupItemsReplaced`. Sản phẩm đã ẩn vẫn đưa vào gói được (cố ý).
4. `ProductGroupsService.findOne`: trả checklist với projection hẹp `ITEM_SELECT` (không có `costPrice`).

**E. Phân giải đơn giá (dùng bởi `orders`)**

1. `backend/src/catalog/domain/price-resolution.ts` → `resolveUnitPrice`: cờ tắt ⇒ `basePrice`; không bậc nào `minQty <= quantity` ⇒ `basePrice`; ngược lại lấy bậc có `minQty` lớn nhất ≤ số lượng (trùng `minQty` ⇒ giá thấp thắng). Không làm tròn, không nhân chia.

## Bất biến

| Bất biến | Nơi enforce | Test canh |
|----------|-------------|-----------|
| Giá vốn ẩn khi thiếu `costs.view`: loại HẲN key (không `0`/`null`), kể cả response của lệnh ghi | `stripCostPrice`, controller resolve quyền tươi | `products.service.spec.ts`, `products.e2e.spec.ts` (body qua dây không chứa `costPrice`) |
| Ghi `costPrice` cần `costs.view` (403 trước khi chạm DB) | `ProductsService.assertMayWriteCostPrice` | `products.service.spec.ts`, `products.e2e.spec.ts` |
| Cửa gói vật tư không bao giờ trả `costPrice` | `ITEM_SELECT` (select tường minh, không `include` trần) | `product-groups.e2e.spec.ts`, `product-groups.service.spec.ts`, `product-groups.db.integration.spec.ts` (payload đọc từ Postgres thật) |
| Cờ `catalog.tiered_pricing` tắt ⇒ mỗi sản phẩm một giá: không key `prices` trong payload, `resolveUnitPrice` bỏ qua bậc thang, `PUT …/prices` ⇒ 409 không ghi; dòng cũ vẫn nằm trong DB | `tieredPriceInclude`, `resolveUnitPrice`, `ProductPricesService.replace` | `price-resolution.spec.ts`, `product-prices.service.spec.ts`, `product-prices.e2e.spec.ts` |
| Cấu hình bậc thang (`catalog.manage`) và bấm cờ (`system.feature_flags`) là hai quyền tách bạch | decorator trên `ProductPricesController` / `FeatureFlagsController` | `product-prices.e2e.spec.ts` (AC-3) |
| Sửa giá không hồi tố đơn đã chốt: catalog không đọc/ghi bảng đơn; đơn giữ `unitPriceSnapshot` (lúc chốt) và `costPriceSnapshot` (lúc xuất kho) | cấu trúc module (`catalog/` không import `orders/`) | `products.service.spec.ts` ("KHÔNG đọc/ghi orders") |
| Xoá = soft-delete (`isActive = false`) cho sản phẩm và gói | `ProductsService.deactivate`, `ProductGroupsService.deactivate` | `products.service.spec.ts`, `product-groups.service.spec.ts` |
| Thay bậc thang / checklist là atomic-replace thật dưới đua: khoá `FOR UPDATE` dòng cha trước `deleteMany`; không gọi `createMany` rỗng | `ProductPricesService.replace`, `ProductGroupsService.replaceItems` | `product-prices.db.integration.spec.ts`, `product-groups.db.integration.spec.ts` (ca "lệnh thay khác đang dở dang"); không gọi `createMany` rỗng: `product-prices.service.spec.ts`, `product-groups.service.spec.ts` |
| `minQty >= 2` (mức 1 là giá gốc); unique `(product_id, min_qty)` | `ProductPriceDto` (`@Min(2)`), index DB | `product-prices.e2e.spec.ts`, `product-prices.db.integration.spec.ts` |
| SKU duy nhất; tên gói duy nhất; một sản phẩm không nằm hai lần trong một gói | unique index DB + kiểm ở tầng app | `products.service.spec.ts`, `product-groups.db.integration.spec.ts` |
| Gói xoá cứng ⇒ item CASCADE; sản phẩm đang trong gói ⇒ RESTRICT | FK trong migration | `product-groups.db.integration.spec.ts` |
| Mọi event publish SAU commit (AD-18), snapshot đầy đủ cho audit | các service | `products.service.spec.ts`, `product-prices.service.spec.ts`, `product-groups.service.spec.ts` |

## Files

| Đường dẫn | Vai trò | Symbol chính |
|-----------|---------|--------------|
| `backend/src/catalog/products.controller.ts` | Route CRUD sản phẩm, resolve `costs.view` + cờ | `ProductsController` (`create`, `findAll`, `findOne`, `update`, `remove`) |
| `backend/src/catalog/product-prices.controller.ts` | Route bậc thang giá | `ProductPricesController` (`findByProduct`, `replace`) |
| `backend/src/catalog/product-groups.controller.ts` | Route gói vật tư | `ProductGroupsController` (`findAll`, `create`, `reactivate`, `replaceItems`, `findOne`, `update`, `remove`) |
| `backend/src/catalog/catalog.module.ts` | Module; import `AccountsModule`, `FeatureFlagsModule` | `CatalogModule` |
| `backend/src/catalog/products.service.ts` | Ghi/đọc `products`, gate giá vốn, soft-delete | `ProductsService`, `VisibleProduct` |
| `backend/src/catalog/product-prices.service.ts` | Atomic-replace bậc thang | `ProductPricesService`, `ProductPriceRow` |
| `backend/src/catalog/product-groups.service.ts` | Gói + checklist, projection không giá vốn | `ProductGroupsService`, `ProductGroupDetail`, `ProductGroupItemRow` |
| `backend/src/catalog/domain/price-resolution.ts` | Chọn đơn giá theo bậc thang (domain thuần) | `resolveUnitPrice`, `PriceTier` |
| `backend/src/catalog/domain/product-visibility.ts` | Che giá vốn | `stripCostPrice` |
| `backend/src/catalog/domain/product-events.ts` | Event sản phẩm | `ProductCreated`, `ProductUpdated`, `ProductDeactivated` |
| `backend/src/catalog/domain/product-price-events.ts` | Event bậc thang | `ProductPricesReplaced` |
| `backend/src/catalog/domain/product-group-events.ts` | Event gói | `ProductGroupCreated`, `ProductGroupUpdated`, `ProductGroupDeactivated`, `ProductGroupReactivated`, `ProductGroupItemsReplaced` |
| `backend/src/catalog/dto/create-product-request.dto.ts`, `backend/src/catalog/dto/update-product-request.dto.ts` | Body sản phẩm | `CreateProductRequestDto`, `UpdateProductRequestDto` |
| `backend/src/catalog/dto/product-response.dto.ts` | Response sản phẩm (`costPrice`, `prices` tuỳ chọn) | `ProductResponseDto` |
| `backend/src/catalog/dto/product-price.dto.ts`, `backend/src/catalog/dto/replace-product-prices-request.dto.ts`, `backend/src/catalog/dto/product-price-response.dto.ts` | Body/response bậc thang | `ProductPriceDto`, `ReplaceProductPricesRequestDto`, `ProductPriceResponseDto` |
| `backend/src/catalog/dto/create-product-group-request.dto.ts`, `backend/src/catalog/dto/update-product-group-request.dto.ts`, `backend/src/catalog/dto/replace-product-group-items-request.dto.ts` | Body gói | `CreateProductGroupRequestDto`, `UpdateProductGroupRequestDto`, `ReplaceProductGroupItemsRequestDto` |
| `backend/src/catalog/dto/product-group-response.dto.ts`, `backend/src/catalog/dto/product-group-detail-response.dto.ts` | Response gói | `ProductGroupResponseDto`, `ProductGroupDetailResponseDto`, `ProductGroupItemResponseDto` |
| `backend/src/catalog/dto/is-optional-not-null.decorator.ts` | Cho vắng mặt nhưng chặn `null` trên cột NOT NULL | `IsOptionalNotNull` |
| `backend/prisma/migrations/20260713000000_add_products/migration.sql` | Bảng `products`, unique `sku` | — |
| `backend/prisma/migrations/20260713010000_add_feature_flags_and_product_prices/migration.sql` (shared với `system-settings`) | Bảng `product_prices` (+ `feature_flags`), unique `(product_id, min_qty)` | — |
| `backend/prisma/migrations/20260713030000_add_product_groups/migration.sql` | Bảng `product_groups`, `product_group_items` | — |
| `web/src/design-system/session/catalog-port.ts` | Port đọc danh mục cho picker báo giá (không có `costPrice`) | `CatalogPort` (`listProducts`, `listGroups`, `getGroup`), `CatalogProduct`, `CatalogGroupDetail` |
| `web/src/design-system/session/fake-catalog-port.ts` | Fake port + dữ liệu demo | `FakeCatalogPort`, `DEMO_CATALOG_PRODUCTS`, `DEMO_CATALOG_GROUPS` |
| `mobile/lib/design_system/session/catalog_port.dart` | Port đọc danh mục mobile | `CatalogPort` |
| `mobile/lib/design_system/session/fake_catalog_port.dart` | Fake port mobile | `FakeCatalogPort` |

## Dữ liệu

- Bảng ghi/đọc: `products`, `product_prices`, `product_groups`, `product_group_items`.
- Bảng đọc gián tiếp: `feature_flags` (qua `FeatureFlagsService`), `account_permissions` (qua `AccountPermissionsService`).
- Ghi từ flow khác: `products.cost_price` do phiếu nhập kho (`inventory`) cập nhật theo giá vốn bình quân;
  `products.tracks_stock` quyết định dòng nào vào phiếu xuất.
- Sự kiện phát: `ProductCreated`, `ProductUpdated`, `ProductDeactivated`, `ProductPricesReplaced`,
  `ProductGroupCreated`, `ProductGroupUpdated`, `ProductGroupDeactivated`, `ProductGroupReactivated`,
  `ProductGroupItemsReplaced` — publish qua `EventBus` sau commit, `AuditSubscriber` ghi `audit_logs`.
- Gọi ngoài: không có.

## Flow liên quan

- system-settings: cờ `catalog.tiered_pricing` (`FeatureFlagsService`, `FLAG.catalogTieredPricing`) gate bậc thang giá.
- orders: dòng báo giá pick sản phẩm/gói qua `CatalogPort`; `resolveUnitPrice` điền giá và snapshot giá khi chốt; `priceEditable` cho phép sửa giá tại chỗ.
- inventory: `tracksStock`, `isActive`, `costPrice` của sản phẩm; phiếu nhập là nơi duy nhất gõ giá vốn ngoài `PATCH /products/:id`.
- accounts-permissions: key `catalog.view`, `catalog.manage`, `costs.view`; `AccountPermissionsService` resolve quyền tươi.
- auth-session: JWT, `PermissionsGuard`, `@RequirePermissions`.
- domain-events-audit: `EventBus`, `AuditSubscriber`.
- backend-platform: `PrismaService`, `AppException` / error envelope, `ValidationPipe`.

## Mở rộng: port thật

| Đường dẫn | Vai trò |
|-----------|---------|
| `mobile/lib/api/http_catalog_port.dart` | `CatalogPort` thật qua client sinh tự động (mobile) |
| `web/src/api/http-catalog-port.ts` | `HttpCatalogPort` (web) |

## Tests

Backend, hermetic (`npm test`):

- `backend/test/price-resolution.spec.ts`: `resolveUnitPrice` thuần — biên `<=`, cờ tắt bỏ qua bậc thang, độc lập thứ tự mảng, trùng `minQty` ⇒ giá thấp.
- `backend/test/products.service.spec.ts`: gate ghi `costPrice` (403 trước DB), che đọc (loại key), soft-delete, event đúng payload sau commit, `sku` trùng ⇒ 409, không chạm bảng đơn.
- `backend/test/product-prices.service.spec.ts`: cờ tắt ⇒ 409 trước DB, trùng `minQty` ⇒ 400, `PUT []` ⇒ `deleteMany` chạy và `createMany` không được gọi.
- `backend/test/product-groups.service.spec.ts`: assert payload truyền vào Prisma (`data`/`where`/`select`), không đếm số lần gọi; projection không `costPrice`; replace rỗng.
- `backend/test/products.e2e.spec.ts`: 403 trên cả 5 route khi thiếu quyền; có `catalog.manage` không `costs.view` ⇒ body không chứa `costPrice`.
- `backend/test/product-prices.e2e.spec.ts`: tách quyền `catalog.manage` / `system.feature_flags` (gồm cả route `/feature-flags`); cờ tắt ⇒ `GET /products` và `GET /products/:id` không có key `prices`, vẫn đọc được bậc thang ngủ đông, `PUT` bị 409; validation `minQty = 1`, giá thập phân/âm, trùng `minQty`; audit `ProductPricesReplaced`.
- `backend/test/product-groups.e2e.spec.ts`: 403 trên cả 7 route; `costPrice` không có trong `GET /product-groups` và `GET /product-groups/:id`; `:id/reactivate`, `:id/items` không bị `:id` nuốt.

Backend, lane DB (`*.db.integration.spec.ts`, tự skip khi không có `DATABASE_URL`; chạy `npm run test:db`):

- `backend/test/product-prices.db.integration.spec.ts`: mỗi lần thay xoá sạch bậc cũ (kể cả thay bằng rỗng); một lệnh thay khác đang dở dang ⇒ vẫn là thay, không gộp (khoá `FOR UPDATE` trên `products`).
- `backend/test/product-groups.db.integration.spec.ts`: unique `(product_group_id, product_id)`, CASCADE/RESTRICT, atomic-replace thật kể cả danh sách rỗng, lệnh thay đang dở dang không bị gộp, payload thật không mang giá vốn, tên trùng ⇒ 409.

Flow này không có source-guard, test web, design-system hay flutter riêng; `CatalogPort` được dùng (và test) qua màn báo giá của flow `orders`.
