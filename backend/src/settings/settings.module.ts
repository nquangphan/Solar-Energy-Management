import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Cấu hình hệ thống trên DB (AD-14, FR-3).
 *
 * `exports: [SettingsService]` — `OrdersModule` cần nó để resolve thuế suất VAT cho
 * `preview-total` (controller inject, service orders giữ đúng 2 dep).
 *
 * KHÔNG import `PrismaModule`/`EventsModule` (cả hai `@Global`), KHÔNG re-register guard
 * (`APP_GUARD` đã có ở `AuthModule`).
 */
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
