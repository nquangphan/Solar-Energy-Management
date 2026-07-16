import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * Đơn hàng (Epic 4, AD-6) — nền móng dữ liệu Order/OrderVersion/OrderLineItem + giỏ hàng
 * dòng báo giá (Story 4.1).
 *
 * `imports`:
 *  - `FeatureFlagsModule` — controller resolve cờ giá phân tầng tươi mỗi request rồi truyền
 *    boolean xuống service (khuôn `catalog.module.ts`; module này KHÔNG `@Global`).
 *
 * KHÔNG import `PrismaModule`/`EventsModule` (cả hai `@Global`), KHÔNG import `AccountsModule`
 * (không có quyền phụ nào cần resolve tại chỗ — giá vốn không đi qua đường báo giá), KHÔNG
 * re-register guard (`APP_GUARD` đã có ở `AuthModule`).
 */
@Module({
  imports: [FeatureFlagsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
