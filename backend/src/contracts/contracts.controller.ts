import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
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
import { ContractsService } from './contracts.service';
import { ContractResponseDto } from './dto/contract-response.dto';
import { ContractsOverviewResponseDto } from './dto/contracts-overview-response.dto';

/**
 * Contracts of an order (FR-13), served as a sub-resource of the order:
 * `/orders/{id}/contracts`. The controller prefix is `orders` on purpose — the spine binds which
 * module OWNS the entity (`contracts/`), not the route prefix; the paths are distinct from every
 * `OrdersController` route, so the controllers do not collide.
 *
 * VAT rate, tiered-pricing flag and the caller's permissions are resolved FRESH per request and
 * passed down (same pattern as `PaymentSchedulesController`).
 */
@ApiTags('contracts')
@ApiBearerAuth()
@Controller('orders')
export class ContractsController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly settings: SettingsService,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  @Get(':id/contracts')
  @RequirePermissions(PERM.contractsGenerate)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: ContractsOverviewResponseDto,
    description:
      'Trường động sẽ đưa vào hợp đồng, server có sinh được không (generatable/blockedReason — cùng luật với POST), và các hợp đồng đã sinh (mới nhất trước).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'id không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu contracts.generate, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  async overview(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContractsOverviewResponseDto> {
    return this.contracts.overview(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      await this.settings.vatRatePercent(),
      await this.featureFlags.isEnabled(FLAG.catalogTieredPricing),
    );
  }

  // 201: every generation is a NEW resource (new number, new file) — unlike the quote export,
  // which overwrites the order's one file and answers 200.
  @Post(':id/contracts')
  @RequirePermissions(PERM.contractsGenerate)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiCreatedResponse({
    type: ContractResponseDto,
    description:
      'Hợp đồng mới (số mới, file mới ở R2 — AD-3). Body rỗng. Loại theo cờ phạm vi của đơn; pháp nhân công ty chưa cấu hình in "Chưa cấu hình", không chặn. Sinh lại = bản mới, bản cũ giữ nguyên.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'id không phải UUID, hoặc đơn chưa có dòng vật tư (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu contracts.generate, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'Đơn chưa chốt hoặc đã huỷ, đơn chưa có lịch thanh toán, hoặc tổng các đợt lệch tổng đơn (CONFLICT).',
  })
  async generate(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContractResponseDto> {
    return this.contracts.generate(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      await this.settings.vatRatePercent(),
      await this.featureFlags.isEnabled(FLAG.catalogTieredPricing),
    );
  }

  // Download proxy (AD-3): bytes streamed from R2 after JWT + permission guard + scope — no
  // presigned public URL, no public bucket.
  @Get(':id/contracts/:contractId/pdf')
  @RequirePermissions(PERM.contractsGenerate)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
    description: 'Bytes PDF của một hợp đồng đã sinh.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'id hoặc contractId không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu contracts.generate, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có đơn với id này, đơn ngoài phạm vi, hoặc hợp đồng không thuộc đơn này (NOT_FOUND).',
  })
  async downloadPdf(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
  ): Promise<StreamableFile> {
    const file = await this.contracts.getPdf(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      contractId,
    );
    return new StreamableFile(file.body, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }
}
