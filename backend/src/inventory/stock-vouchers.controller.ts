import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { anGiaVonDongPhieu } from './domain/stock-voucher-visibility';
import { CreateReturnVoucherRequestDto } from './dto/create-return-voucher-request.dto';
import { CreateStockVoucherRequestDto } from './dto/create-stock-voucher-request.dto';
import { StockVoucherListQueryDto } from './dto/stock-voucher-list-query.dto';
import {
  StockVoucherDetailDto,
  StockVoucherListResponseDto,
  toStockVoucherDetailDto,
  toStockVoucherListResponseDto,
} from './dto/stock-voucher-response.dto';
import { StockVouchersService } from './stock-vouchers.service';

/**
 * Phiếu kho nhập/xuất (FR-25). Mọi route gate `inventory.manage` (AND một key).
 *
 * GHI giá vốn KHÔNG đòi `costs.view` — CÓ CHỦ ĐÍCH, khác `ProductsService` (sửa `costPrice` ở
 * danh mục cần `costs.view`): phiếu nhập là "một chỗ gõ" giá vốn duy nhất (FR-37), và thủ kho
 * (`inventory.manage`, không `costs.view`) là người cầm hoá đơn nhập. ĐỌC thì bị lọc: thiếu
 * `costs.view` ⇒ `unitCost` vắng mặt hẳn ở mọi response, kể cả response của chính lệnh tạo.
 *
 * `canViewCosts` resolve TƯƠI mỗi request qua `AccountPermissionsService` (khuôn
 * `ProductsController`). Controller không dựng envelope (AD-5).
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('stock-vouchers')
export class StockVouchersController {
  constructor(
    private readonly stockVouchers: StockVouchersService,
    private readonly accountPermissions: AccountPermissionsService,
  ) {}

  private async canViewCosts(accountId: string): Promise<boolean> {
    const permissions = await this.accountPermissions.listForAccount(accountId);
    return permissions.has(PERM.costsView);
  }

  @Post()
  @RequirePermissions(PERM.inventoryManage)
  @ApiCreatedResponse({
    type: StockVoucherDetailDto,
    description:
      'Phiếu đã lưu và có hiệu lực. `lines[].unitCost` chỉ có mặt nếu caller có costs.view.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Body không hợp lệ (VALIDATION_ERROR): thiếu `unitCost` khi nhập, có `unitCost` khi xuất, lặp sản phẩm (DUPLICATE_PRODUCT)…',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu inventory.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Có sản phẩm không tồn tại (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'CONFLICT: xuất quá tồn (`fieldErrors[].code = INSUFFICIENT_STOCK`) hoặc nhập sản phẩm không theo dõi tồn/đã ngừng bán (`PRODUCT_NOT_STOCKABLE`). Không dòng nào được ghi.',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CreateStockVoucherRequestDto,
  ): Promise<StockVoucherDetailDto> {
    const phieu = await this.stockVouchers.taoPhieu(body, account.id);
    return toStockVoucherDetailDto(
      anGiaVonDongPhieu(phieu, await this.canViewCosts(account.id)),
    );
  }

  @Post(':id/return')
  @RequirePermissions(PERM.inventoryManage)
  @ApiCreatedResponse({
    type: StockVoucherDetailDto,
    description:
      'Phiếu nhập trả đã lưu: cộng `onHand` đúng số đếm được, giá vốn dòng = giá vốn dòng phiếu xuất gốc. `lines[].unitCost` chỉ có mặt nếu caller có costs.view.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'VALIDATION_ERROR: body sai (lines rỗng, qty không nguyên dương…), lặp sản phẩm (`fieldErrors[].code = DUPLICATE_PRODUCT`), sản phẩm không có trên phiếu gốc (`NOT_ON_ORIGIN_VOUCHER`), nhận lại quá số đã xuất (`RETURN_EXCEEDS_ISSUED`). Không dòng nào được ghi.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu inventory.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có phiếu gốc này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'CONFLICT: phiếu gốc không phải phiếu xuất gắn đơn, đơn chưa huỷ, hoặc phiếu xuất đã có phiếu nhập trả.',
  })
  async createReturn(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateReturnVoucherRequestDto,
  ): Promise<StockVoucherDetailDto> {
    const phieu = await this.stockVouchers.createReturnVoucher(
      id,
      body,
      account.id,
    );
    return toStockVoucherDetailDto(
      anGiaVonDongPhieu(phieu, await this.canViewCosts(account.id)),
    );
  }

  @Get()
  @RequirePermissions(PERM.inventoryManage)
  @ApiOkResponse({ type: StockVoucherListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      '`type` không phải nhap|xuat hoặc `isReturn` không phải true|false (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu inventory.manage (FORBIDDEN).',
  })
  async list(
    @Query() query: StockVoucherListQueryDto,
  ): Promise<StockVoucherListResponseDto> {
    return toStockVoucherListResponseDto(
      await this.stockVouchers.lietKePhieu(query),
    );
  }

  @Get(':id')
  @RequirePermissions(PERM.inventoryManage)
  @ApiOkResponse({
    type: StockVoucherDetailDto,
    description: '`lines[].unitCost` chỉ có mặt nếu caller có costs.view.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: '`id` không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu inventory.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có phiếu này (NOT_FOUND).',
  })
  async findOne(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StockVoucherDetailDto> {
    const [phieu, canViewCosts] = await Promise.all([
      this.stockVouchers.chiTietPhieu(id),
      this.canViewCosts(account.id),
    ]);
    return toStockVoucherDetailDto(anGiaVonDongPhieu(phieu, canViewCosts));
  }
}
