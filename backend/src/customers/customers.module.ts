import { Module } from '@nestjs/common';
import { CustomerSourcesController } from './customer-sources.controller';
import { CustomerSourcesService } from './customer-sources.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

/**
 * Khách hàng (FR-29) — module domain thứ hai của Epic 3, theo CÙNG khuôn `catalog/`.
 *
 * `imports` RỖNG có chủ đích:
 *  - `PrismaModule` + `EventsModule` đều `@Global` ⇒ chỉ inject, không import.
 *  - KHÔNG import `AccountsModule`: khác `catalog/`, controller ở đây không cần resolve thêm
 *    quyền nào tại chỗ (không có giá vốn để che — không có `canViewCosts` để copy sang). Quyền
 *    `customers.manage` do `PermissionsGuard` toàn cục lo (`APP_GUARD` ở `AuthModule`).
 *  - KHÔNG re-register guard.
 *
 * `CustomerSource` (bảng + seed + endpoint ĐỌC) nằm ở đây vì `Customer.sourceId` là FK bắt buộc:
 * không có danh mục nguồn thì không tạo nổi một khách nào. CRUD nguồn khách = **Story 3.5**, và
 * story đó KHÔNG được tạo lại bảng/migration này.
 */
@Module({
  controllers: [CustomersController, CustomerSourcesController],
  providers: [CustomersService, CustomerSourcesService],
})
export class CustomersModule {}
