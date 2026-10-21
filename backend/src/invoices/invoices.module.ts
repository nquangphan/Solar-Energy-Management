import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { InvoiceDocumentService } from './invoice-document.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

/**
 * Invoices (FR-27, FR-28): an internal sales invoice stored as a snapshot of a confirmed order
 * version (`InvoicesService`), viewed and exported as a PDF from that snapshot
 * (`InvoiceDocumentService`).
 *
 * `imports`:
 *  - `OrdersModule` — scoped order read (`getScoped`/`assertScoped`) and the SHARED
 *    `QuoteRendererPort` binding (one Chromium for the whole app — this module binds no renderer).
 *    `orders/` NEVER imports this module back.
 *  - `StorageModule` — the invoice PDF bytes go to R2 through `StoragePort` (AD-3).
 *  - `SettingsModule` — the company legal entity copied as the seller, and the VAT rate resolved
 *    fresh per request in the controller.
 *  - `FeatureFlagsModule` — tiered-pricing flag resolved fresh per request.
 *  - `AccountsModule` — the caller's permissions, resolved fresh per request, for the scope.
 *
 * Not `PrismaModule`/`EventsModule` (both `@Global`).
 */
@Module({
  imports: [
    OrdersModule,
    StorageModule,
    SettingsModule,
    FeatureFlagsModule,
    AccountsModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceDocumentService],
})
export class InvoicesModule {}
