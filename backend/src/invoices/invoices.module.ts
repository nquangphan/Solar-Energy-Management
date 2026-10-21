import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/**
 * Invoices (FR-27): an internal sales invoice stored as a snapshot of a confirmed order version.
 * No PDF and no R2 here — viewing and exporting is Story 7.5.
 *
 * `imports`:
 *  - `OrdersModule` — scoped order read (`getScoped`). `orders/` NEVER imports this module back.
 *  - `SettingsModule` — the company legal entity copied as the seller, and the VAT rate resolved
 *    fresh per request in the controller.
 *  - `FeatureFlagsModule` — tiered-pricing flag resolved fresh per request.
 *  - `AccountsModule` — the caller's permissions, resolved fresh per request, for the scope.
 *
 * Not `PrismaModule`/`EventsModule` (both `@Global`).
 */
@Module({
  imports: [OrdersModule, SettingsModule, FeatureFlagsModule, AccountsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
