import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { AuthService } from './auth.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LogoutRequestDto } from './dto/logout-request.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';

/**
 * Endpoint xác thực. `/auth/login|refresh|logout` là **ngoại lệ hạ-tầng-xác-thực có
 * chủ ý** (như `/health`) — không áp quy ước "danh từ số nhiều" cho verb auth.
 *
 * Controller KHÔNG dựng envelope lỗi: `AuthService` ném `AppException`, filter trung
 * tâm (2.2) dựng envelope + traceId (AD-5).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokensDto, description: 'Đăng nhập thành công.' })
  @ApiUnauthorizedResponse({
    type: ErrorEnvelopeDto,
    description: 'Sai thông tin đăng nhập (UNAUTHENTICATED, message generic).',
  })
  login(@Body() body: LoginRequestDto): Promise<AuthTokensDto> {
    return this.auth.login(body.email, body.password);
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
}
