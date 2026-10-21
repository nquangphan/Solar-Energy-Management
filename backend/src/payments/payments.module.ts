import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentSchedulesController } from './payment-schedules.controller';
import { PaymentSchedulesService } from './payment-schedules.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * Payments (Epic 7): payment schedule + installments (FR-11), and payment recording with the
 * automatic status transition it triggers (FR-12) — the transition runs through
 * `OrdersService.autoTransitionInTx` inside this module's transaction.
 *
 * `imports`:
 *  - `OrdersModule` — scoped order read + after-VAT total (`OrdersService.getScopedTotal`) and
 *    the in-tx transition door (`OrdersService.autoTransitionInTx`).
 *    `orders/` NEVER imports this module back.
 *  - `SettingsModule` / `FeatureFlagsModule` — VAT rate and tiered-pricing flag resolved fresh
 *    per request in the controller.
 *  - `AccountsModule` — the caller's permissions, resolved fresh per request, for the scope.
 *
 * Not `PrismaModule`/`EventsModule` (both `@Global`).
 */
@Module({
  imports: [OrdersModule, SettingsModule, FeatureFlagsModule, AccountsModule],
  controllers: [PaymentSchedulesController, PaymentsController],
  providers: [PaymentSchedulesService, PaymentsService],
})
export class PaymentsModule {}
