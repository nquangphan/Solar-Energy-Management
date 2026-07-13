import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Cờ tính năng nghiệp vụ trên DB (AD-14, FR-15).
 *
 * `exports: [FeatureFlagsService]` — `CatalogModule` cần nó để: (a) chặn ghi bậc thang khi cờ
 * TẮT, (b) quyết định có đính `prices` vào payload sản phẩm không.
 *
 * KHÔNG import `PrismaModule`/`EventsModule` (cả hai `@Global`), KHÔNG re-register guard
 * (`APP_GUARD` đã có ở `AuthModule`).
 */
@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
