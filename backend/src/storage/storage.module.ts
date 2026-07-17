import { Module } from '@nestjs/common';
import { StoragePort } from './storage.port';
import { R2StorageAdapter } from './r2-storage.adapter';

/**
 * StorageModule — provide implementation R2 qua class token `StoragePort` và export port
 * (mirror `EventsModule`, nhưng KHÔNG @Global: chỉ module nào cần binary storage mới
 * import — hiện tại là `OrdersModule` (xuất báo giá FR-21); attachments (5.5/5.6),
 * hợp đồng (7.3), hoá đơn (7.5) tái dùng sau.
 */
@Module({
  providers: [{ provide: StoragePort, useClass: R2StorageAdapter }],
  exports: [StoragePort],
})
export class StorageModule {}
