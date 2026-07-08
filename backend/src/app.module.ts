import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

/**
 * Root module của skeleton.
 *
 * CHỈ import hạ tầng: `PrismaModule` (DB access duy nhất, AD-1) + `HealthModule`
 * (endpoint chứng minh wiring). KHÔNG import module domain (accounts/orders/…) —
 * chúng thuộc story sở hữu và sẽ tự đăng ký khi được tạo (chống scope-creep).
 */
@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
