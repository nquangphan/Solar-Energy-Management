import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { AuthService } from './auth.service';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from './current-account.decorator';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';

/**
 * `POST /auth/change-password` — tự đổi mật khẩu của CHÍNH MÌNH.
 *
 * Vì sao là controller RIÊNG chứ không phải một method của `AuthController`: class đó mang
 * `@Public()` **cấp class**, nên mọi method trong nó đều bỏ qua guard toàn cục. Đặt route
 * cần xác thực vào đó là mở nó cho người chưa đăng nhập. Tách file là cách an toàn nhất —
 * KHÔNG nới guard, KHÔNG thêm `@Public()` cấp method.
 *
 * KHÔNG `@RequirePermissions`: đây là self-service, mọi phiên hợp lệ đổi được mật khẩu của
 * chính nó (giống `/me`). `JwtAuthGuard` toàn cục xác thực + gắn `request.account`; danh
 * tính lấy từ token qua `@CurrentAccount()`, KHÔNG từ body (AD-4).
 *
 * Controller KHÔNG dựng envelope lỗi: `AuthService` ném `AppException`, filter trung tâm
 * dựng envelope (AD-5).
 */
@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class ChangePasswordController {
  constructor(private readonly auth: AuthService) {}

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Mật khẩu đã đổi; mọi phiên (kể cả phiên hiện tại) đã bị thu hồi.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Mật khẩu mới không đạt chính sách hoặc trùng mật khẩu hiện tại (VALIDATION_ERROR).',
  })
  @ApiUnauthorizedResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu access token, hoặc mật khẩu hiện tại không đúng (UNAUTHENTICATED).',
  })
  async changePassword(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: ChangePasswordRequestDto,
  ): Promise<void> {
    await this.auth.changePassword(
      account.id,
      body.currentPassword,
      body.newPassword,
    );
  }
}
