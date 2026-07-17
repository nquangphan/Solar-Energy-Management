import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { QuoteExportService } from './quote-export.service';
import { PuppeteerQuoteRenderer } from './quote/puppeteer-quote-renderer';
import { QuoteRendererPort } from './quote/quote-renderer.port';

/**
 * Đơn hàng (Epic 4, AD-6) — nền móng dữ liệu Order/OrderVersion/OrderLineItem + giỏ hàng
 * dòng báo giá (Story 4.1).
 *
 * `imports`:
 *  - `FeatureFlagsModule` — controller resolve cờ giá phân tầng tươi mỗi request rồi truyền
 *    boolean xuống service (khuôn `catalog.module.ts`; module này KHÔNG `@Global`).
 *  - `SettingsModule` — controller resolve thuế suất VAT tươi mỗi request cho `preview-total`
 *    rồi truyền số xuống service (cùng khuôn — service giữ đúng 2 dep).
 *  - `AccountsModule` — controller resolve `costs.view` tươi mỗi request cho danh sách chờ
 *    duyệt chiết khấu (Story 4.7, FR-37: biên ước tính lộ ngược costPrice nên đi theo fence).
 *  - `StorageModule` — xuất báo giá đẩy file PDF/ảnh lên R2 qua `StoragePort` (Story 4.8,
 *    AD-3); `QuoteRendererPort` bind Puppeteer adapter tại đây (browser lazy — boot/test
 *    hermetic không đụng Chromium).
 *
 * KHÔNG import `PrismaModule`/`EventsModule` (cả hai `@Global`), KHÔNG re-register guard
 * (`APP_GUARD` đã có ở `AuthModule`).
 */
@Module({
  imports: [FeatureFlagsModule, SettingsModule, AccountsModule, StorageModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    QuoteExportService,
    { provide: QuoteRendererPort, useClass: PuppeteerQuoteRenderer },
  ],
})
export class OrdersModule {}
