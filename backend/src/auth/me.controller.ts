import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountPermissionsService } from '../accounts/account-permissions.service';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from './current-account.decorator';
import { MeResponseDto } from './dto/me-response.dto';

/**
 * `GET /me` — trả danh tính tối thiểu + **bộ quyền hiệu lực** của phiên đang đăng nhập.
 * Contract chính tắc để FE (Story 2.6) dựng `PermissionSet` — nguồn quyền DUY NHẤT là
 * server (AD-4/AD-12), KHÔNG đọc quyền từ JWT claim (2.3 cố ý không nhét permission vào
 * token; quyền đổi runtime, token không stale).
 *
 * `/me` là **danh từ số ít có chủ ý** — ngoại lệ hạ-tầng như `/health`, `/auth/*` (spine
 * "Consistency Conventions: `/me` trả permission set"); KHÔNG vi phạm quy ước route danh
 * từ số nhiều.
 *
 * Endpoint CHỈ cần xác thực (KHÔNG `@RequirePermissions`): mọi phiên hợp lệ đọc được
 * quyền CỦA CHÍNH MÌNH. `JwtAuthGuard` toàn cục đã xác thực + gắn `request.account`.
 */
@ApiTags('auth')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly accountPermissions: AccountPermissionsService) {}

  @Get('me')
  @ApiOkResponse({
    type: MeResponseDto,
    description:
      'Danh tính + bộ quyền hiệu lực (sorted) của phiên đang đăng nhập.',
  })
  async me(
    @CurrentAccount() account: AuthenticatedAccount,
  ): Promise<MeResponseDto> {
    const permissions = await this.accountPermissions.listForAccount(
      account.id,
    );
    // Sort cho tất định → test/FE so khớp ổn định; FE dựng `ReadonlySet` từ mảng.
    return { ...account, permissions: [...permissions].sort() };
  }
}
