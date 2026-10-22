import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LogoutRequestDto } from './dto/logout-request.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';

/**
 * Endpoint xác thực. `/auth/login|refresh|logout` là **ngoại lệ hạ-tầng-xác-thực có
 * chủ ý** (như `/health`) — không áp quy ước "danh từ số nhiều" cho verb auth.
 *
 * Controller KHÔNG dựng envelope lỗi: `AuthService` ném `AppException`, filter trung
 * tâm (2.2) dựng envelope + traceId (AD-5).
 *
 * `@Public()` (cấp class) opt-out guard toàn cục fail-closed (2.5) cho MỌI route ở đây:
 * đăng nhập/refresh/logout và quên/đặt lại mật khẩu đều KHÔNG thể đòi access token TRƯỚC
 * khi có token. Quên `@Public` ⇒ e2e `auth.e2e.spec.ts` fail 401 (lưới an toàn — sửa bằng
 * `@Public`, KHÔNG nới guard).
 *
 * Vì class này công khai TOÀN BỘ, `POST /auth/change-password` (cần phiên hợp lệ) nằm ở
 * `ChangePasswordController` riêng — thêm nó vào đây sẽ vô tình mở nó cho mọi người.
 */
@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokensDto, description: 'Đăng nhập thành công.' })
  @ApiUnauthorizedResponse({
    type: ErrorEnvelopeDto,
    description: 'Sai thông tin đăng nhập (UNAUTHENTICATED, message generic).',
  })
  login(@Body() body: LoginRequestDto): Promise<AuthTokensDto> {
    return this.auth.login(body.phone, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: AuthTokensDto,
    description: 'Cấp access token mới (rotate).',
  })
  @ApiUnauthorizedResponse({
    type: ErrorEnvelopeDto,
    description: 'Refresh token sai/hết hạn/đã thu hồi (UNAUTHENTICATED).',
  })
  refresh(@Body() body: RefreshRequestDto): Promise<AuthTokensDto> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Thu hồi phiên (idempotent, trung tính).',
  })
  async logout(@Body() body: LogoutRequestDto): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: ForgotPasswordResponseDto,
    description:
      'Luôn 200 với cùng một body, dù SĐT tồn tại hay không (chống dò SĐT hợp lệ).',
  })
  forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.passwordReset.requestCode(body.phone);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Mật khẩu đã đổi, mã đã tiêu thụ, mọi phiên đã bị thu hồi.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorEnvelopeDto,
    description:
      'Mã sai/hết hạn/đã dùng/vượt số lần thử, hoặc SĐT lạ (UNAUTHENTICATED, một message duy nhất).',
  })
  async resetPassword(@Body() body: ResetPasswordRequestDto): Promise<void> {
    await this.passwordReset.reset(body.phone, body.code, body.newPassword);
  }
}
