import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CatalogModule } from './catalog/catalog.module';

/**
 * Root module.
 *
 * `CommonModule` = tầng API dùng chung (exception filter + ValidationPipe global qua DI).
 * Hạ tầng: `PrismaModule` (DB access duy nhất, AD-1) + `HealthModule` (wiring).
 * `AuthModule` = module DOMAIN đầu tiên (Story 2.3 — đăng nhập JWT); nó tự import
 * `AccountsModule` (danh tính) — chỉ nối đúng cái auth cần, chống scope-creep. Module
 * domain khác (orders/…) tự đăng ký khi story sở hữu tạo chúng.
 *
 * Story 2.7 — hạ tầng event (AD-18): `EventsModule` (`EventBus` port DUY NHẤT, @Global)
 * + hai consumer subscriber tự đăng ký `onModuleInit` — `AuditModule` (ghi `AuditLog`
 * append-only, AD-8) và `NotificationsModule` (`NotificationDispatcher` no-op/log; Epic 9
 * thay bằng FCM không mở lại code). Producer (E4+) publish qua port, KHÔNG gọi
 * audit/notification trực tiếp (source-guard `no-direct-side-effect-outside-eventbus`).
 *
 * Story 3.1 — `CatalogModule`: danh mục vật tư & giá (FR-14), module domain đầu tiên có
 * route nghiệp vụ thật. Nó tự import `AccountsModule` (resolve `costs.view` để che giá vốn).
 */
@Module({
  imports: [
    CommonModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    EventsModule,
    AuditModule,
    NotificationsModule,
    CatalogModule,
  ],
})
export class AppModule {}
