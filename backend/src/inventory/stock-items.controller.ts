import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERM } from '../accounts/domain/permission-registry';
import { RequireAnyPermissions } from '../auth/require-any-permission.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { StockListQueryDto } from './dto/stock-list-query.dto';
import { StockListResponseDto } from './dto/stock-list-response.dto';
import { StockItemsService } from './stock-items.service';

/**
 * Tồn kho hiện tại theo sản phẩm (FR-25) — đường ĐỌC.
 *
 * Gate là OR: thủ kho (`inventory.manage`) cần số để cấp hàng, sale (`quotes.create_edit`) cần
 * con số Khả dụng để hứa với khách. Payload không có giá vốn nên không dính `costs.view`.
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('stock-items')
export class StockItemsController {
  constructor(private readonly stockItems: StockItemsService) {}

  @Get()
  @RequireAnyPermissions(PERM.inventoryManage, PERM.quotesCreateEdit)
  @ApiOkResponse({
    type: StockListResponseDto,
    description:
      'Tồn thật / Đã hứa / Khả dụng theo sản phẩm + danh sách cần mua — mọi con số do backend tính.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: '`productIds` có phần tử không phải UUID (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu CẢ inventory.manage lẫn quotes.create_edit (FORBIDDEN).',
  })
  async lietKe(
    @Query() query: StockListQueryDto,
  ): Promise<StockListResponseDto> {
    return (await this.stockItems.lietKeTonKho(query)) as StockListResponseDto;
  }
}
