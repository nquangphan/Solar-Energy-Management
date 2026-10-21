import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { StockItemsController } from './stock-items.controller';
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
 * `exports: [StockVouchersService]` — ONE reason: an order-bound stock issue runs inside the
 * `OrdersService` transaction (stock + order-line cost + order status must be atomic), so
 * `orders/` calls this module's `issueForOrderInTx` primitive. The reverse is forbidden:
 * `inventory/` NEVER imports `OrdersModule` (dependency cycle).
 */
@Module({
  imports: [AccountsModule],
  controllers: [StockItemsController, StockVouchersController],
  providers: [StockItemsService, StockVouchersService],
  exports: [StockVouchersService],
})
export class InventoryModule {}
