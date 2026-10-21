import { Module } from '@nestjs/common';
import { StockItemsController } from './stock-items.controller';
import { StockItemsService } from './stock-items.service';

/**
 * Tồn kho (FR-25, AD-19). `imports` RỖNG có chủ đích: `PrismaModule` + `EventsModule` đều
 * `@Global`, và quyền đọc do `PermissionsGuard` toàn cục lo.
 */
@Module({
  controllers: [StockItemsController],
  providers: [StockItemsService],
})
export class InventoryModule {}
