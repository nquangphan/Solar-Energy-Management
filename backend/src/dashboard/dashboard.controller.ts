import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountPermissionsService } from '../accounts/account-permissions.service';
import { PERM } from '../accounts/domain/permission-registry';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequireAnyPermissions } from '../auth/require-any-permission.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';

/**
 * Operations dashboard (FR-19). Open to anyone who can see at least one of its blocks; each
 * block is then gated on its own permission in the service. Permissions are resolved FRESH from
 * the DB per request, never read from the JWT.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  @Get('summary')
  @RequireAnyPermissions(
    PERM.ordersViewAll,
    PERM.ordersViewOwn,
    PERM.dashboardFinanceView,
  )
  @ApiOkResponse({
    type: DashboardSummaryResponseDto,
    description:
      'Doanh thu của kỳ (null khi thiếu dashboard.finance_view), số đơn tạo trong kỳ và số đơn theo trạng thái (null khi thiếu quyền xem đơn).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'period không thuộc day/week/month (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu cả orders.view_all, orders.view_own lẫn dashboard.finance_view (FORBIDDEN).',
  })
  async summary(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummaryResponseDto> {
    return (await this.dashboard.summary(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      query.period ?? 'month',
      new Date(),
    )) as DashboardSummaryResponseDto;
  }
}
