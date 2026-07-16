import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { FLAG } from '../feature-flags/domain/feature-flag-registry';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AddLineItemRequestDto } from './dto/add-line-item-request.dto';
import { CreateOrderRequestDto } from './dto/create-order-request.dto';
import { OrderLineItemResponseDto } from './dto/order-line-item-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { UpdateLineItemRequestDto } from './dto/update-line-item-request.dto';
import { OrdersService } from './orders.service';

/**
 * Tạo Đơn + giỏ hàng dòng báo giá (Story 4.1, FR-1). MỌI handler khai
 * `@RequirePermissions(PERM.quotesCreateEdit)` — key ĐÃ TỒN TẠI trong registry 21 key, KHÔNG
 * key mới. `GET /orders/:id` cũng gate `quotes.create_edit` ở story này (luồng người dựng
 * đơn); scope xem theo `orders.view_all`/`orders.view_own` là Story 5.3 — guard hiện AND-only,
 * không diễn đạt OR được.
 *
 * Cờ giá phân tầng resolve TƯƠI mỗi request rồi truyền boolean xuống service (khuôn
 * `ProductsController.tieredPricingEnabled` — service giữ đúng 2 dependency, CẤM hardcode cờ).
 *
 * Controller KHÔNG dựng envelope lỗi: service ném `AppException`, `AllExceptionsFilter` dựng
 * (AD-5).
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private async tieredPricingEnabled(): Promise<boolean> {
    return await this.featureFlags.isEnabled(FLAG.catalogTieredPricing);
  }

  @Post()
  @RequirePermissions(PERM.quotesCreateEdit)
  @ApiCreatedResponse({
    type: OrderResponseDto,
    description:
      "Đơn mới ở trạng thái 'baogia' + version 1 rỗng; `sourceId`/`custType` snapshot từ Customer lúc tạo (FR-35); `ownerAccountId` = người gọi.",
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'SĐT không hợp lệ (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'SĐT chưa có khách hàng (NOT_FOUND) — tạo khách trước.',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CreateOrderRequestDto,
  ): Promise<OrderResponseDto> {
    return (await this.orders.create(account.id, body)) as OrderResponseDto;
  }

  @Get(':id')
  @RequirePermissions(PERM.quotesCreateEdit)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      'Đơn + dòng của bản hiệu lực (qua currentVersionId, AD-6); mỗi dòng kèm `amount` server tính. Tổng đơn KHÔNG có ở đây (Story 4.2).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này (NOT_FOUND).',
  })
  async findOne(@Param('id') id: string): Promise<OrderResponseDto> {
    return (await this.orders.get(
      id,
      await this.tieredPricingEnabled(),
    )) as OrderResponseDto;
  }

  @Post(':id/line-items')
  @RequirePermissions(PERM.quotesCreateEdit)
  @ApiCreatedResponse({
    type: OrderLineItemResponseDto,
    description:
      'Dòng mới ở cuối giỏ. Dòng catalog: backend auto-điền đơn giá theo danh mục hiện tại; dòng tự do: nhập tay, priceEditable = true.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Body không hợp lệ; sản phẩm không tồn tại; hoặc gửi `unitPrice` cho sản phẩm không cho sửa giá (VALIDATION_ERROR — kèm fieldErrors).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      "Đơn không còn ở trạng thái 'baogia' — sửa sau chốt là Story 4.6 (CONFLICT).",
  })
  async addLine(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: AddLineItemRequestDto,
  ): Promise<OrderLineItemResponseDto> {
    return (await this.orders.addLine(
      account.id,
      id,
      body,
      await this.tieredPricingEnabled(),
    )) as OrderLineItemResponseDto;
  }

  @Patch(':id/line-items/:lineId')
  @RequirePermissions(PERM.quotesCreateEdit)
  @ApiOkResponse({
    type: OrderLineItemResponseDto,
    description: 'Dòng sau khi sửa — `unitPrice`/`amount` là giá hiệu lực.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Body không hợp lệ, hoặc sửa `unitPrice` trên dòng priceEditable = false (VALIDATION_ERROR — kèm fieldErrors).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có đơn, hoặc dòng không thuộc bản hiệu lực của đơn này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description: "Đơn không còn ở trạng thái 'baogia' (CONFLICT).",
  })
  async updateLine(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateLineItemRequestDto,
  ): Promise<OrderLineItemResponseDto> {
    return (await this.orders.updateLine(
      account.id,
      id,
      lineId,
      body,
      await this.tieredPricingEnabled(),
    )) as OrderLineItemResponseDto;
  }

  @Delete(':id/line-items/:lineId')
  @RequirePermissions(PERM.quotesCreateEdit)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Dòng đã bị xoá khỏi bản hiệu lực.' })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có đơn, hoặc dòng không thuộc bản hiệu lực của đơn này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description: "Đơn không còn ở trạng thái 'baogia' (CONFLICT).",
  })
  async removeLine(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ): Promise<void> {
    await this.orders.removeLine(account.id, id, lineId);
  }
}
