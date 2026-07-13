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
import { PERM } from '../accounts/domain/permission-registry';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { ProductPriceResponseDto } from './dto/product-price-response.dto';
import { ReplaceProductPricesRequestDto } from './dto/replace-product-prices-request.dto';
import { ProductPricesService } from './product-prices.service';

/**
 * Bậc thang giá của một sản phẩm (FR-15). Gate bởi `catalog.manage` — CẤU HÌNH GIÁ là sửa danh
 * mục. Đây là quyền KHÁC với `system.feature_flags` (bấm cờ): người bán được phép cấu hình mức
 * giá khi cờ đã bật, nhưng không được tự bật cờ.
 *
 * Param là `:productId` (KHÔNG `:id`) — tránh lẫn với `ProductsController`.
 *
 * Controller KHÔNG dựng envelope lỗi: service ném `AppException`, `AllExceptionsFilter` dựng
 * envelope (AD-5).
 */
@ApiTags('catalog')
@ApiBearerAuth()
@Controller('products/:productId/prices')
export class ProductPricesController {
  constructor(private readonly productPrices: ProductPricesService) {}

  @Get()
  @RequirePermissions(PERM.catalogManage)
  @ApiOkResponse({
    type: [ProductPriceResponseDto],
    description: 'Bậc thang hiện tại, sắp xếp minQty tăng dần.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu catalog.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có sản phẩm với id này (NOT_FOUND).',
  })
  async findByProduct(
    @Param('productId') productId: string,
  ): Promise<ProductPriceResponseDto[]> {
    return await this.productPrices.findByProduct(productId);
  }

  @Put()
  @RequirePermissions(PERM.catalogManage)
  @ApiOkResponse({
    type: [ProductPriceResponseDto],
    description:
      'Bậc thang SAU khi thay thế. Mảng rỗng = đã xoá hết, sản phẩm quay về một giá.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'minQty < 2, tiền không phải số nguyên, hoặc trùng minQty trong payload (VALIDATION_ERROR) — kèm `fieldErrors`.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu catalog.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có sản phẩm với id này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'Cờ catalog.tiered_pricing đang TẮT (CONFLICT) — bật cờ trước khi cấu hình bậc thang.',
  })
  async replace(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('productId') productId: string,
    @Body() body: ReplaceProductPricesRequestDto,
  ): Promise<ProductPriceResponseDto[]> {
    return await this.productPrices.replace(account.id, productId, body.prices);
  }
}
