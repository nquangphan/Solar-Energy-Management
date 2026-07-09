import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChangePasswordController } from './change-password.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordService } from './password.service';
import { AUTH_CONFIG, loadAuthConfig } from './auth.config';
import { MeController } from './me.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * Module domain ĐẦU TIÊN được nối vào backend (2.1/2.2 chỉ có hạ tầng). Import
 * `AccountsModule` (đọc danh tính + `AccountPermissionsService`) + `JwtModule` (ký/verify
 * access JWT). `PrismaService` (Session repo) inject từ `PrismaModule` `@Global`.
 *
 * `JwtModule.register` đọc `JWT_ACCESS_SECRET` từ env lúc bootstrap; `main.ts` fail-fast
 * nếu thiếu/quá ngắn (KHÔNG ký JWT bằng secret rỗng). Sinh OpenAPI/introspect KHÔNG ký
 * token nên chạy được cả khi secret vắng.
 *
 * Story 2.5 — **guard toàn cục fail-closed**: đăng ký `JwtAuthGuard` + `PermissionsGuard`
 * qua `APP_GUARD` áp cho TOÀN app (mọi request mặc định cần access JWT). Thứ tự khai =
 * thứ tự chạy ⇒ **Jwt TRƯỚC Permissions** (Permissions đọc `request.account` do Jwt gắn).
 * Route công khai opt-out bằng `@Public()` (`/health`, `/auth/*`). Export guard/decorator
 * KHÔNG cần vì đã toàn cục; module domain sau chỉ cần `@RequirePermissions`.
 *
 * Story 2.8 — `PasswordResetService` + `ChangePasswordController`. `EventBus` inject được
 * mà KHÔNG import gì (EventsModule `@Global`); tuyệt đối KHÔNG import `AuditModule`/
 * `NotificationsModule` ở đây — producer chỉ biết cái port (AD-18).
 */
@Module({
  imports: [
    AccountsModule,
    JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }),
  ],
  controllers: [AuthController, ChangePasswordController, MeController],
  providers: [
    AuthService,
    PasswordResetService,
    PasswordService,
    { provide: AUTH_CONFIG, useFactory: loadAuthConfig },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
