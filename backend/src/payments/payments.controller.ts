import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
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
import { RecordPaymentRequestDto } from './dto/record-payment-request.dto';
import { RecordPaymentResponseDto } from './dto/record-payment-response.dto';
import { PaymentsService } from './payments.service';
import { UUID_PARAM } from '../common/validation/uuid-param';

/**
 * Payments of an order (FR-12), served as a sub-resource of the order: `/orders/{id}/payments`.
 * The controller prefix is `orders` on purpose (same reason as `PaymentSchedulesController`):
 * the spine binds which module OWNS the entity (`payments/`), not the route prefix, and the
 * path is distinct from every `OrdersController` route.
 *
 * VAT rate, tiered-pricing flag and the caller's permissions are resolved FRESH per request and
 * passed down; the same permissions gate the automatic transition the payment may trigger.
 */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('orders')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly settings: SettingsService,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  @Post(':id/payments')
  @HttpCode(200)
  @RequirePermissions(PERM.paymentsRecord)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: RecordPaymentResponseDto,
    description:
      'Đã ghi nhận (lần đầu) hoặc gửi lại cùng khoá + cùng nội dung (không ghi thêm) — cùng mã 200, cùng thân. Chuyển trạng thái tự động bị từ chối ⇒ tiền VẪN được ghi, autoTransition.outcome = skipped.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'VALIDATION_ERROR + fieldErrors: `amount` vượt phần còn lại của đợt (exceedsRemaining), `paidOn` sau hôm nay giờ Việt Nam (futureDate), hoặc sai kiểu/khoảng (amount, paidOn, method, note, idempotencyKey, installmentId); id không phải UUID.',
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
      'CONFLICT: đơn chưa chốt hoặc đã huỷ; đơn vừa thay đổi; đơn chưa có lịch thanh toán; đợt không thuộc lịch hiện tại (lịch vừa thay đổi); khoá ghi nhận đã dùng cho một khoản khác.',
  })
  async record(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', UUID_PARAM) id: string,
    @Body() body: RecordPaymentRequestDto,
  ): Promise<RecordPaymentResponseDto> {
    return (await this.payments.record(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      body,
      await this.settings.vatRatePercent(),
      await this.featureFlags.isEnabled(FLAG.catalogTieredPricing),
    )) as RecordPaymentResponseDto;
  }
}
