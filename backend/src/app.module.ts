import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';

/**
 * Root module.
 *
 * `CommonModule` = tầng API dùng chung (exception filter + ValidationPipe global qua DI).
 * Hạ tầng: `PrismaModule` (DB access duy nhất, AD-1) + `HealthModule` (wiring).
 * `AuthModule` = module DOMAIN đầu tiên (Story 2.3 — đăng nhập JWT); nó tự import
 * `AccountsModule` (danh tính) — chỉ nối đúng cái auth cần, chống scope-creep. Module
 * domain khác (orders/…) tự đăng ký khi story sở hữu tạo chúng.
 */
@Module({
  imports: [CommonModule, PrismaModule, HealthModule, AuthModule],
})
export class AppModule {}
