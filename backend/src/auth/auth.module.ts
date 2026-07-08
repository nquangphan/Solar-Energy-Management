import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { AUTH_CONFIG, loadAuthConfig } from './auth.config';

/**
 * Module domain ĐẦU TIÊN được nối vào backend (2.1/2.2 chỉ có hạ tầng). Import
 * `AccountsModule` (đọc danh tính) + `JwtModule` (ký access JWT). `PrismaService`
 * (Session repo) inject từ `PrismaModule` `@Global`.
 *
 * `JwtModule.register` đọc `JWT_ACCESS_SECRET` từ env lúc bootstrap; `main.ts` fail-fast
 * nếu thiếu/quá ngắn (KHÔNG ký JWT bằng secret rỗng). Sinh OpenAPI/introspect KHÔNG ký
 * token nên chạy được cả khi secret vắng.
 */
@Module({
  imports: [
    AccountsModule,
    JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    { provide: AUTH_CONFIG, useFactory: loadAuthConfig },
  ],
})
export class AuthModule {}
