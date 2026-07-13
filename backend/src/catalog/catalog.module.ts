import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ProductGroupsController } from './product-groups.controller';
import { ProductGroupsService } from './product-groups.service';
import { ProductPricesController } from './product-prices.controller';
import { ProductPricesService } from './product-prices.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Danh mục vật tư & giá (FR-14/FR-15) — module domain đầu tiên của Epic 3.
 *
 * Tên thư mục là `catalog/` (ranh giới domain) còn route là `/products` (tài nguyên REST,
 * danh từ số nhiều theo CONVENTIONS) — KHÔNG mâu thuẫn: `ProductPrice` và `ProductGroup` (gói
 * vật tư) ở CÙNG module này, mỗi cái một cặp controller+service.
 *
 * `imports`:
 *  - `AccountsModule` — `AccountPermissionsService` để controller resolve `costs.view` tươi mỗi
 *    request (AD-8).
 *  - `FeatureFlagsModule` — `FeatureFlagsService` để gate giá phân tầng (FR-15): chặn ghi bậc
 *    thang khi cờ TẮT, và quyết định có đính `prices` vào payload sản phẩm không.
 *
 * KHÔNG import `PrismaModule`/`EventsModule` (cả hai `@Global`), KHÔNG re-register guard
 * (`APP_GUARD` đã có ở `AuthModule`).
 */
@Module({
  imports: [AccountsModule, FeatureFlagsModule],
  controllers: [
    ProductsController,
    ProductPricesController,
    ProductGroupsController,
  ],
  providers: [ProductsService, ProductPricesService, ProductGroupsService],
})
export class CatalogModule {}
