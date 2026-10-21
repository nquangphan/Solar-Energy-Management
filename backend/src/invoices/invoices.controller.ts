import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { FLAG } from '../feature-flags/domain/feature-flag-registry';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { SettingsService } from '../settings/settings.service';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { InvoicesOverviewResponseDto } from './dto/invoices-overview-response.dto';
import { InvoicesService } from './invoices.service';

/**
 * Invoices of an order (FR-27), served as a sub-resource of the order: `/orders/{id}/invoices`.
 * The controller prefix is `orders` on purpose — the spine binds which module OWNS the entity
 * (`invoices/`), not the route prefix; the paths are distinct from every `OrdersController`
 * route, so the controllers do not collide.
 *
 * VAT rate, tiered-pricing flag and the caller's permissions are resolved FRESH per request and
 * passed down (same pattern as `ContractsController`).
 */
@ApiTags('invoices')
@ApiBearerAuth()
@Controller('orders')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly settings: SettingsService,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  @Get(':id/invoices')
  @RequirePermissions(PERM.invoicesManage)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: InvoicesOverviewResponseDto,
    description:
      'Nguồn hoá đơn sẽ chụp lại (bản đơn, khách, MST, tổng), server có tạo được không (creatable/blockedReason — cùng luật với POST), và các hoá đơn đã tạo (mới nhất trước).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'id không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  async overview(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoicesOverviewResponseDto> {
    return this.invoices.overview(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      await this.settings.vatRatePercent(),
      await this.featureFlags.isEnabled(FLAG.catalogTieredPricing),
    );
  }

  // 200 for both the first creation and a replay: the key is the current order version, so a
  // retry returns the same invoice with the same body.
  @Post(':id/invoices')
  @HttpCode(200)
  @RequirePermissions(PERM.invoicesManage)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: InvoiceResponseDto,
    description:
      'Đã tạo hoá đơn cho bản đơn hiện hành (lần đầu) hoặc bản đó đã có hoá đơn (gửi lại — trả đúng hoá đơn đã lập, không ghi thêm) — cùng mã 200, cùng thân. Body rỗng. Hoá đơn chụp lại khách, dòng, VAT, tổng và pháp nhân công ty lúc lập; không đổi theo đơn về sau.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'id không phải UUID, hoặc đơn chưa có dòng vật tư (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'Đơn chưa chốt hoặc đã huỷ, hoặc đơn vừa thay đổi bản trong lúc tạo (CONFLICT).',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoices.create(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      await this.settings.vatRatePercent(),
      await this.featureFlags.isEnabled(FLAG.catalogTieredPricing),
    );
  }
}
