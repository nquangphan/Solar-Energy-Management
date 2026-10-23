import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountPermissionsService } from './account-permissions.service';
import { AccountsController } from './accounts.controller';

/**
 * AccountsModule — export `AccountsService` cho `AuthModule` import. `PrismaService`
 * được inject từ `PrismaModule` (`@Global`), không cần import lại. Story 2.4 mở rộng:
 * `AccountPermissionsService` (đọc/ghi quyền per-account) — export để `auth/` (Story 2.5
 * `/me` + guard) import được.
 */
@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountPermissionsService],
  exports: [AccountsService, AccountPermissionsService],
})
export class AccountsModule {}
