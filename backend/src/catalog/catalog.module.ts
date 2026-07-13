import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Danh mục vật tư & giá (FR-14/FR-15) — module domain đầu tiên của Epic 3.
 *
 * Tên thư mục là `catalog/` (ranh giới domain) còn route là `/products` (tài nguyên REST,
 * danh từ số nhiều theo CONVENTIONS) — KHÔNG mâu thuẫn: `ProductPrice` (Story 3.2) và
 * `ProductGroup` (Story 3.6) sẽ về CÙNG module này.
 *
 * `imports: [AccountsModule]` CHỈ để dùng `AccountPermissionsService` — controller cần
 * resolve `costs.view` tươi mỗi request (AD-8). KHÔNG import `PrismaModule`/`EventsModule`
 * (cả hai `@Global`), KHÔNG re-register guard (`APP_GUARD` đã có ở `AuthModule`).
 */
@Module({
  imports: [AccountsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class CatalogModule {}
