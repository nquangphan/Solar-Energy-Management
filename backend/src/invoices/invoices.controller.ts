import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { InvoiceDetailResponseDto } from './dto/invoice-detail-response.dto';
import { InvoicePdfResponseDto } from './dto/invoice-pdf-response.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { InvoicesOverviewResponseDto } from './dto/invoices-overview-response.dto';
import { InvoiceDocumentService } from './invoice-document.service';
import { InvoicesService } from './invoices.service';

/**
 * Invoices of an order (FR-27), served as a sub-resource of the order: `/orders/{id}/invoices`.
 * The controller prefix is `orders` on purpose — the spine binds which module OWNS the entity
 * (`invoices/`), not the route prefix; the paths are distinct from every `OrdersController`
 * route, so the controllers do not collide.
 *
 * VAT rate, tiered-pricing flag and the caller's permissions are resolved FRESH per request and
 * passed down (same pattern as `ContractsController`). Viewing and exporting one invoice
 * (`/orders/{id}/invoices/{invoiceId}[/pdf]`) reads only the stored snapshot, so it needs no VAT
 * rate and no pricing flag.
 */
@ApiTags('invoices')
@ApiBearerAuth()
@Controller('orders')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly documents: InvoiceDocumentService,
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

  @Get(':id/invoices/:invoiceId')
  @RequirePermissions(PERM.invoicesManage)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: InvoiceDetailResponseDto,
    description:
      'Toàn bộ nội dung một hoá đơn (số, ngày, người bán, khách, dòng, VAT, tổng, gắn đơn) đọc từ bản chụp lúc lập — không đọc lại đơn, khách hay cài đặt. Xem được bất kể trạng thái đơn hiện tại. pdf = null khi chưa xuất.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'id hoặc invoiceId không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND, cùng message đơn không tồn tại); hoặc hoá đơn không tồn tại / không thuộc đơn này — "Không tìm thấy hoá đơn." (NOT_FOUND).',
  })
  async detail(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<InvoiceDetailResponseDto> {
    return this.documents.detail(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      invoiceId,
    );
  }

  // 200 for both the first export and every later one: the PDF is rendered once and stored, so
  // a repeat returns the same file with the same body.
  @Post(':id/invoices/:invoiceId/pdf')
  @HttpCode(200)
  @RequirePermissions(PERM.invoicesManage)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: InvoicePdfResponseDto,
    description:
      'Lần đầu: dựng PDF từ bản chụp hoá đơn và lưu ở R2 (AD-3). Các lần sau: trả lại đúng file đã lưu, không dựng lại, không ghi thêm — cùng mã 200, cùng thân. Body rỗng. Xuất được bất kể trạng thái đơn hiện tại. Tải bytes qua GET cùng đường dẫn.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'id hoặc invoiceId không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND, cùng message đơn không tồn tại); hoặc hoá đơn không tồn tại / không thuộc đơn này — "Không tìm thấy hoá đơn." (NOT_FOUND).',
  })
  async exportPdf(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<InvoicePdfResponseDto> {
    return this.documents.exportPdf(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      invoiceId,
    );
  }

  // Download proxy (AD-3): bytes streamed from R2 after JWT + permission guard + scope — no
  // presigned public URL, no public bucket.
  @Get(':id/invoices/:invoiceId/pdf')
  @RequirePermissions(PERM.invoicesManage)
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
    description: 'Bytes PDF đã xuất của một hoá đơn.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'id hoặc invoiceId không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu invoices.manage, hoặc thiếu cả orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND, cùng message đơn không tồn tại); hoá đơn không tồn tại / không thuộc đơn này — "Không tìm thấy hoá đơn."; hoặc hoá đơn chưa xuất PDF — "Hoá đơn này chưa xuất PDF." (NOT_FOUND).',
  })
  async downloadPdf(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<StreamableFile> {
    const file = await this.documents.getPdf(
      account.id,
      await this.accountPermissions.listForAccount(account.id),
      id,
      invoiceId,
    );
    return new StreamableFile(file.body, {
      type: 'application/pdf',
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }
}
