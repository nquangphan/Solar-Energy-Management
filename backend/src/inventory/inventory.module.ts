import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { StockItemsController } from './stock-items.controller';
import { OrderCancelledStockSubscriber } from './order-cancelled-stock.subscriber';
import { StockItemsService } from './stock-items.service';
import { StockVouchersController } from './stock-vouchers.controller';
import { StockVouchersService } from './stock-vouchers.service';

/**
 * Tồn kho (FR-25, AD-19): đường ĐỌC tồn (`stock-items`) + phiếu kho nhập/xuất
 * (`stock-vouchers`).
 *
 * `imports`: `AccountsModule` — `AccountPermissionsService` để controller phiếu kho resolve
 * `costs.view` tươi mỗi request (che giá vốn dòng phiếu). `PrismaModule` + `EventsModule` đều
 * `@Global`; quyền route do `PermissionsGuard` toàn cục lo.
 *
 * `exports` — TWO reasons, both from `orders/`:
 *  - `StockVouchersService`: an order-bound stock issue runs inside the `OrdersService`
 *    transaction (stock + order-line cost + order status must be atomic), so `orders/` calls
 *    this module's `issueForOrderInTx` primitive; confirming an order reserves stock in the
 *    same tx as the price snapshot through `reserveForOrderInTx`.
 *  - `StockItemsService`: the quote screen's early stock warning is read per ORDER (scope and
 *    order lines belong to `orders/`), while the stock figures are computed here
 *    (`checkOrderLines`).
 * The reverse is forbidden: `inventory/` NEVER imports `OrdersModule` (dependency cycle).
 *
 * `OrderCancelledStockSubscriber` releases a cancelled order's hold by subscribing to
 * `OrderCancelled` on the bus — the event is the only seam, so the cancel path never touches
 * stock and `inventory/` reads only the pure `orders/domain/order-status` constant.
 */
@Module({
  imports: [AccountsModule],
  controllers: [StockItemsController, StockVouchersController],
  providers: [
    StockItemsService,
    StockVouchersService,
    OrderCancelledStockSubscriber,
  ],
  exports: [StockVouchersService, StockItemsService],
})
export class InventoryModule {}
