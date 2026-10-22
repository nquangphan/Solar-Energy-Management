import { Body, Controller, Get, Param, Put } from '@nestjs/common';
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
import { PaymentScheduleResponseDto } from './dto/payment-schedule-response.dto';
import { ReplacePaymentScheduleRequestDto } from './dto/replace-payment-schedule-request.dto';
import { PaymentSchedulesService } from './payment-schedules.service';
import { UUID_PARAM } from '../common/validation/uuid-param';

/**
 * Payment schedule of an order (FR-11), served as a sub-resource of the order:
 * `/orders/{id}/payment-schedule`. The controller prefix is `orders` on purpose — the spine binds
 * which module OWNS the entity (`payments/`), not the route prefix; the path is distinct from
 * every `OrdersController` route, so the two controllers do not collide.
 *
 * VAT rate, tiered-pricing flag and the caller's permissions are resolved FRESH per request and
 * passed down (same pattern as `OrdersController`).
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('orders')
export class PaymentSchedulesController {
  constructor(
    private readonly schedules: PaymentSchedulesService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly settings: SettingsService,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  @Get(':id/payment-schedule')
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: PaymentScheduleResponseDto,
    description:
      'Lịch thanh toán của đơn (mọi trạng thái). Chưa cấu hình ⇒ configured=false, installments rỗng. Độ lệch tính lại với tổng đơn sau VAT HIỆN TẠI.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'id không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  async get(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', UUID_PARAM) id: string,
  ): Promise<PaymentScheduleResponseDto> {
    return (await this.schedules.get(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      await this.settings.vatRatePercent(),
      await this.featureFlags.isEnabled(FLAG.catalogTieredPricing),
    )) as PaymentScheduleResponseDto;
  }

  @Put(':id/payment-schedule')
  @RequirePermissions(PERM.paymentsRecord)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: PaymentScheduleResponseDto,
    description:
      'Lịch đã lưu (thay toàn bộ các đợt). Tổng các đợt lệch tổng đơn sau VAT vẫn lưu được — totalMatches=false là cảnh báo, không chặn. Gửi lại y hệt ⇒ không ghi gì.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'VALIDATION_ERROR + fieldErrors `installments.{i}.(percent|amount|conditionNote)`: đợt đầu bằng 0 (firstInstallmentZero), đợt tính ra 0 đồng (resolvedZero), đợt vượt 2.000.000.000 đồng (amountTooLarge), không đúng một trong percent/amount (exactlyOneOf), 0 hoặc quá 12 đợt.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu payments.record, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'Đơn chưa chốt hoặc đã đóng, đơn vừa đổi trong lúc lưu, hoặc đơn đã có khoản thu — lịch không sửa được nữa (CONFLICT).',
  })
  async replace(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', UUID_PARAM) id: string,
    @Body() body: ReplacePaymentScheduleRequestDto,
  ): Promise<PaymentScheduleResponseDto> {
    return (await this.schedules.replace(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      body.installments,
      await this.settings.vatRatePercent(),
      await this.featureFlags.isEnabled(FLAG.catalogTieredPricing),
    )) as PaymentScheduleResponseDto;
  }
}
