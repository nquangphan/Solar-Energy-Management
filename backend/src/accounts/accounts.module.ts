import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';

/**
 * AccountsModule — export `AccountsService` cho `AuthModule` import. `PrismaService`
 * được inject từ `PrismaModule` (`@Global`), không cần import lại. Story 2.4 sẽ mở
 * rộng module này với registry quyền + `AccountPermission`.
 */
@Module({
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
