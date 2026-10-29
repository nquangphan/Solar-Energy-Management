import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { OrdersModule } from '../orders/orders.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ProfitReportController } from './profit-report.controller';
import { ProfitReportService } from './profit-report.service';

/**
 * Operations dashboard (FR-19) and gross profit report (FR-37), read-only: no event, no audit.
 *
 * `imports`:
 *  - `OrdersModule` — the order scope clause (`OrdersService.scopeWhere`), so counts follow the
 *    same visibility as `GET /orders`. `orders/` never imports this module back.
 *  - `AccountsModule` — the caller's permissions, resolved fresh per request.
 *
 * The profit report reads Prisma directly and needs neither: it is company-wide and gated on
 * `costs.view` alone.
 */
@Module({
  imports: [OrdersModule, AccountsModule],
  controllers: [DashboardController, ProfitReportController],
  providers: [DashboardService, ProfitReportService],
})
export class DashboardModule {}
