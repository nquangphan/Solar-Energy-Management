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
import { AccountPermissionsService } from '../accounts/account-permissions.service';
import { PERM } from '../accounts/domain/permission-registry';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { FLAG } from '../feature-flags/domain/feature-flag-registry';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { SettingsService } from '../settings/settings.service';
import { vatApplies } from './domain/vat-mode';
import { AddLineItemRequestDto } from './dto/add-line-item-request.dto';
import { ApplyDiscountRequestDto } from './dto/apply-discount-request.dto';
import { CreateOrderRequestDto } from './dto/create-order-request.dto';
import { DiscountPendingItemDto } from './dto/discount-pending-item.dto';
import { OrderLineItemResponseDto } from './dto/order-line-item-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { PreviewTotalRequestDto } from './dto/preview-total-request.dto';
import { PreviewTotalResponseDto } from './dto/preview-total-response.dto';
import { ResolveDiscountRequestDto } from './dto/resolve-discount-request.dto';
import { UpdateLineItemRequestDto } from './dto/update-line-item-request.dto';
import { UpdateOrderRequestDto } from './dto/update-order-request.dto';
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
    private readonly settings: SettingsService,
    private readonly accountPermissions: AccountPermissionsService,
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

  // Route TĨNH khai TRƯỚC các route `:id` — kỷ luật từ 3.4 (dù POST hiện không collision).
  @Post('preview-total')
  @RequirePermissions(PERM.quotesCreateEdit)
  // Compute thuần, không tạo resource — 201 mặc định của @Post là sai ngữ nghĩa.
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: PreviewTotalResponseDto,
    description:
      'Tổng trước VAT / Tiền VAT / Tổng sau VAT — integer đồng, tính bằng hàm pricing duy nhất (AD-16); kèm `vatRate`/`applyVat` đã áp để client hiển thị nhãn thuế suất; client CHỈ hiển thị.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Dòng không hợp lệ (unitPrice < 0, qty < 1, thiếu lines, quá 500 dòng) hoặc vatMode ngoài registry — VALIDATION_ERROR kèm fieldErrors.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  async previewTotal(
    @Body() body: PreviewTotalRequestDto,
  ): Promise<PreviewTotalResponseDto> {
    // Rate resolve TƯƠI từ config hệ thống MỘT lần mỗi request (pattern tieredPricingEnabled)
    // — service giữ đúng 2 dep, client không bao giờ gửi rate.
    const vatRate = await this.settings.vatRatePercent();
    return {
      ...this.orders.previewTotal(body, vatRate),
      vatRate,
      applyVat: vatApplies(body.vatMode ?? null),
    } as PreviewTotalResponseDto;
  }

  // Route TĨNH khai TRƯỚC `:id` (kỷ luật 3.4 — GET này CÓ collision thật với `GET /orders/:id`).
  @Get('cho-duyet-chiet-khau')
  @RequirePermissions(PERM.discountsApprove)
  @ApiOkResponse({
    type: [DiscountPendingItemDto],
    description:
      'Danh sách đơn chờ duyệt chiết khấu — subtotal/afterDiscount backend tính (AD-16); `estimatedMarginPct` per-line CHỈ có giá trị khi caller có THÊM costs.view (FR-37), thiếu ⇒ null toàn bộ.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu discounts.approve — discounts.apply KHÔNG thay thế được (FORBIDDEN).',
  })
  async listPendingDiscounts(
    @CurrentAccount() account: AuthenticatedAccount,
  ): Promise<DiscountPendingItemDto[]> {
    // `costs.view` resolve TƯƠI từ DB mỗi request (khuôn `ProductsController.canViewCosts`)
    // — KHÔNG suy từ JWT; margin lộ ngược costPrice nên đi theo fence FR-37.
    const permissions = await this.accountPermissions.listForAccount(
      account.id,
    );
    return (await this.orders.listPendingDiscounts(
      permissions.has(PERM.costsView),
      await this.tieredPricingEnabled(),
    )) as DiscountPendingItemDto[];
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

  @Patch(':id')
  @RequirePermissions(PERM.quotesCreateEdit)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      'Đơn sau khi PATCH: cờ phạm vi Thi công/Vận chuyển (4.3) và/hoặc metadata vatMode/kWp/validityNote (4.4) — partial. `scopeThietBi` luôn true — không nhận qua body (FR-2).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Cờ không phải boolean/null; vatMode ngoài registry; kWp ≤ 0 hoặc quá 2 chữ số lẻ; validityNote quá 200 ký tự (VALIDATION_ERROR — kèm fieldErrors).',
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
      "Đơn không còn ở trạng thái 'baogia' — cờ gate máy trạng thái, không đổi giữa vòng đời (CONFLICT).",
  })
  async update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: UpdateOrderRequestDto,
  ): Promise<OrderResponseDto> {
    return (await this.orders.update(
      account.id,
      id,
      body,
      await this.tieredPricingEnabled(),
    )) as OrderResponseDto;
  }

  // Action nghiệp vụ là sub-resource POST (`/orders/{id}/chot` — spine Consistency
  // Conventions verbatim). Body rỗng, không DTO request; response giữ nguyên OrderResponseDto
  // — chotAt/snapshot chi tiết để màn 5.4/4.7 tự mở khi cần.
  @Post(':id/chot')
  @RequirePermissions(PERM.ordersConfirm)
  // Transition trên resource có sẵn, không tạo resource mới — 201 mặc định của @Post sai
  // ngữ nghĩa (khuôn preview-total).
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      "Đơn sau khi Chốt: status 'dachot', giá dòng đã đóng băng bằng snapshot (FR-5, AD-6) — unitPrice trong line view tự động = snapshot. Retry trên đơn đã chốt: 200 view hiện tại, không ghi lại, không audit thêm (idempotent, NFR-1).",
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Báo giá chưa có dòng nào — không có gì để đóng băng (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu orders.confirm — quotes.create_edit KHÔNG thay thế được (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      "Đơn ở trạng thái khác 'baogia'/'dachot' — không chốt được từ đó (CONFLICT).",
  })
  async confirm(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    // vatRate resolve TƯƠI từ config MỘT lần mỗi request rồi truyền xuống (pattern 4.4) —
    // service giữ đúng 2 dep, client không bao giờ gửi rate.
    return (await this.orders.confirm(
      account.id,
      id,
      await this.settings.vatRatePercent(),
      await this.tieredPricingEnabled(),
    )) as OrderResponseDto;
  }

  // Mở lại đơn đã chốt để sửa (Story 4.6, FR-6) — action nghiệp vụ là sub-resource POST
  // (khuôn `:id/chot`). Body rỗng, không DTO request; response giữ nguyên OrderResponseDto.
  // Quyền = quotes.create_edit (mở lại chỉ có MỘT tác dụng là cho phép sửa — mọi endpoint sửa
  // đều gate key này; re-chốt vẫn cần orders.confirm).
  @Post(':id/mo-lai')
  @RequirePermissions(PERM.quotesCreateEdit)
  // Transition trên resource có sẵn, không tạo resource mới theo nghĩa REST — 201 mặc định
  // của @Post sai ngữ nghĩa (khuôn :id/chot).
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      "Đơn sau khi Mở lại: status 'baogia', version MỚI (versionNo + 1) với dòng copy từ bản đã chốt — snapshot null nên giá dòng catalog live-resolve lại theo danh mục hiện tại (FR-5); bản cũ + snapshot cũ giữ nguyên trong lịch sử (AD-6). Retry trên đơn đang 'baogia': 200 view hiện tại, không version mới, không audit thêm (idempotent, NFR-1).",
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu quotes.create_edit — orders.confirm KHÔNG thay thế được (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      "Đơn ở trạng thái khác 'dachot'/'baogia' — không mở lại được từ đó (CONFLICT).",
  })
  async revise(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    // KHÔNG resolve vatRate — mở lại không ghi thuế; re-chốt qua :id/chot mới đóng băng lại.
    return (await this.orders.revise(
      account.id,
      id,
      await this.tieredPricingEnabled(),
    )) as OrderResponseDto;
  }

  // Áp chiết khấu + gửi duyệt (Story 4.7, FR-18) — action nghiệp vụ là sub-resource POST
  // (khuôn `:id/chot`). Trong 'choduyet' mọi mutation dòng/meta/scope bị assertMutable chặn.
  @Post(':id/ap-chiet-khau')
  @RequirePermissions(PERM.discountsApply)
  // Transition trên resource có sẵn — 201 mặc định của @Post sai ngữ nghĩa (khuôn :id/chot).
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      "Đơn sau khi áp: status 'choduyet' + `discount.status: 'cho_duyet'` — nội dung đơn đóng băng suốt kỳ duyệt; người có discounts.approve quyết qua /duyet-chiet-khau.",
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'amount < 1, vượt subtotal hiện hành, hoặc báo giá chưa có dòng nào (VALIDATION_ERROR — kèm fieldErrors).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu discounts.apply — quotes.create_edit KHÔNG thay thế được (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      "Đơn ở trạng thái khác 'baogia' — kể cả retry khi đã 'choduyet' (áp KHÔNG idempotent: body mang amount) (CONFLICT).",
  })
  async applyDiscount(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: ApplyDiscountRequestDto,
  ): Promise<OrderResponseDto> {
    return (await this.orders.applyDiscount(
      account.id,
      id,
      body.amount,
      body.note ?? null,
      await this.tieredPricingEnabled(),
    )) as OrderResponseDto;
  }

  // Duyệt / từ chối chiết khấu (Story 4.7, FR-18) — sub-resource POST (khuôn `:id/chot`).
  @Post(':id/duyet-chiet-khau')
  @RequirePermissions(PERM.discountsApprove)
  // Transition trên resource có sẵn — 201 mặc định của @Post sai ngữ nghĩa (khuôn :id/chot).
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      "Đơn sau khi quyết: đồng ý ⇒ vẫn 'choduyet' + `discount.status: 'dong_y'` (Chốt là hành động riêng qua /chot); từ chối ⇒ về 'baogia' + `discount.status: 'tu_choi'` kèm resolveNote. Retry CÙNG decision: 200 view hiện tại, không audit thêm (idempotent, NFR-1).",
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu `reason` khi từ chối (VALIDATION_ERROR — kèm fieldErrors).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu discounts.approve — discounts.apply KHÔNG thay thế được (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có approval chờ duyệt, hoặc decision NGƯỢC với approval đã resolve (CONFLICT).',
  })
  async resolveDiscount(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: ResolveDiscountRequestDto,
  ): Promise<OrderResponseDto> {
    return (await this.orders.resolveDiscount(
      account.id,
      id,
      body.approve,
      body.reason ?? null,
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
