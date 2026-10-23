import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { OrdersModule } from '../orders/orders.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Operations dashboard (FR-19), read-only: no event, no audit.
 *
 * `imports`:
 *  - `OrdersModule` — the order scope clause (`OrdersService.scopeWhere`), so counts follow the
 *    same visibility as `GET /orders`. `orders/` never imports this module back.
 *  - `AccountsModule` — the caller's permissions, resolved fresh per request.
 */
@Module({
  imports: [OrdersModule, AccountsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
