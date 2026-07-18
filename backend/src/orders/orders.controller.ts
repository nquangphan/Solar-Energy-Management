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
  Query,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { type TransitionEvent } from './domain/allowed-transition';
import {
  KICH_THUOC_TOI_DA_BYTE,
  SO_ANH_TOI_DA,
} from './domain/attachment-limits';
import { vatApplies } from './domain/vat-mode';
import { AddLineItemRequestDto } from './dto/add-line-item-request.dto';
import { ApplyDiscountRequestDto } from './dto/apply-discount-request.dto';
import { CreateOrderRequestDto } from './dto/create-order-request.dto';
import { DiscountPendingItemDto } from './dto/discount-pending-item.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderLifecycleResponseDto } from './dto/order-lifecycle-response.dto';
import { OrderListResponseDto } from './dto/order-list-response.dto';
import { OrderLineItemResponseDto } from './dto/order-line-item-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderVersionsResponseDto } from './dto/order-versions-response.dto';
import { PreviewTotalRequestDto } from './dto/preview-total-request.dto';
import { PreviewTotalResponseDto } from './dto/preview-total-response.dto';
import { QuoteExportResponseDto } from './dto/quote-export-response.dto';
import { ResolveDiscountRequestDto } from './dto/resolve-discount-request.dto';
import { StatusChangeRequestDto } from './dto/status-change-request.dto';
import { StatusChangeResponseDto } from './dto/status-change-response.dto';
import { UpdateLineItemRequestDto } from './dto/update-line-item-request.dto';
import { UpdateOrderRequestDto } from './dto/update-order-request.dto';
import { OrdersService } from './orders.service';
import { QuoteExportService } from './quote-export.service';

/**
 * Tạo Đơn + giỏ hàng dòng báo giá (Story 4.1, FR-1). MỌI handler khai
 * `@RequirePermissions(PERM.quotesCreateEdit)` — key ĐÃ TỒN TẠI trong registry 21 key, KHÔNG
 * key mới. NGOẠI LỆ là bốn đường ĐỌC đơn (`GET /orders`, `GET /orders/:id`, `/:id/vong-doi`,
 * `/:id/phien-ban`): gate `@RequireAnyPermissions(ordersViewAll, ordersViewOwn)` — OR, vì
 * preset cấp `view_all` KHÔNG kèm `view_own`, và vì KE_TOAN/THI_CONG/KHO_GIAO xem được đơn mà
 * KHÔNG có `quotes.create_edit` (bắt họ có nó nghĩa là danh sách dẫn tới một cánh cửa khoá).
 * Phạm vi dữ liệu do service thu hẹp — đọc-theo-id đi qua ĐÚNG MỘT đường `findScopedOrThrow`.
 * Mọi đường GHI vẫn giữ `quotes.create_edit` / quyền riêng của chúng.
 *
 * Cờ giá phân tầng resolve TƯƠI mỗi request rồi truyền boolean xuống service (khuôn
 * `ProductsController.tieredPricingEnabled` — service giữ đúng 2 dependency, CẤM hardcode cờ).
 *
 * Controller KHÔNG dựng envelope lỗi: service ném `AppException`, `AllExceptionsFilter` dựng
 * (AD-5).
 */
/**
 * TRẦN CỨNG chặn lạm dụng ở transport — CỐ Ý cao hơn giới hạn hợp đồng trong
 * `attachment-limits.ts` (10 ảnh × 10 MB). Lý do ở docstring của `chuyenTrangThai()`.
 */
const TRAN_CUNG_SO_ANH = SO_ANH_TOI_DA * 2;
const TRAN_CUNG_KICH_THUOC_BYTE = KICH_THUOC_TOI_DA_BYTE * 2;

/**
 * Một file nhận từ multer — khai TỐI THIỂU bốn trường thực sự dùng, thay vì kéo
 * `@types/multer` vào chỉ để mượn `Express.Multer.File`. Shape này khớp cả runtime multer
 * lẫn `AnhTaiLen` của domain (structural typing), nên service nhận thẳng không cần map.
 */
interface FileDaTaiLen {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly settings: SettingsService,
    private readonly accountPermissions: AccountPermissionsService,
    private readonly quoteExport: QuoteExportService,
  ) {}

  private async tieredPricingEnabled(): Promise<boolean> {
    return await this.featureFlags.isEnabled(FLAG.catalogTieredPricing);
  }

  /**
   * Bộ quyền của người gọi, resolve TƯƠI từ DB mỗi request (khuôn `listPendingDiscounts` —
   * KHÔNG suy từ JWT). Engine transition đánh giá guard theo bộ này (AD-11): guard HTTP
   * `@RequirePermissions` chặn ở cửa, engine chặn ở nơi thực sự ghi — hai tầng, vì các
   * đường transition tương lai (auto-transition, chuyển bước thủ công) không đi qua đúng
   * một endpoint một quyền như bốn đường hiện tại.
   */
  private async quyenCuaNguoiGoi(
    accountId: string,
  ): Promise<ReadonlySet<string>> {
    return await this.accountPermissions.listForAccount(accountId);
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

  /**
   * Route TĨNH `@Get()` root — khai TRƯỚC `@Get(':id')` theo kỷ luật thứ tự route của file này.
   *
   * Cửa vào là OR (`view_all` HOẶC `view_own`) chứ không AND: `role-presets.ts` cấp
   * `orders.view_all` KHÔNG kèm `orders.view_own`, nên đặt `view_own` làm sàn AND sẽ khoá
   * chính admin ra ngoài. Guard chỉ mở CỬA; phạm vi DỮ LIỆU do service thu hẹp theo cùng bộ
   * quyền (AD-4 — backend enforce, không tin tham số phạm vi từ client).
   */
  @Get()
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: OrderListResponseDto,
    description:
      'Danh sách đơn ĐÃ thu hẹp theo quyền người gọi: orders.view_all thấy toàn bộ, chỉ orders.view_own thấy đơn mình owner HOẶC assignee. `total` đếm toàn bộ tập đã lọc + đã scope, đọc cùng ảnh chụp với `items`.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      '`status` ngoài 10 khoá, `page` < 1, `pageSize` ngoài 1..100, hoặc gửi đồng thời `followUp` và `status` (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  async list(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query() query: ListOrdersQueryDto,
  ): Promise<OrderListResponseDto> {
    return (await this.orders.list(
      account.id,
      await this.quyenCuaNguoiGoi(account.id),
      query,
    )) as OrderListResponseDto;
  }

  @Get(':id')
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: OrderResponseDto,
    description:
      'Đơn + dòng của bản hiệu lực (qua currentVersionId, AD-6); mỗi dòng kèm `amount` server tính. Tổng đơn KHÔNG có ở đây (Story 4.2).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Không có đơn với id này, HOẶC đơn ngoài phạm vi người gọi (NOT_FOUND — hai ca không phân biệt được từ ngoài).',
  })
  async findOne(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    return (await this.orders.getScoped(
      account.id,
      await this.quyenCuaNguoiGoi(account.id),
      id,
      await this.tieredPricingEnabled(),
    )) as OrderResponseDto;
  }

  @Get(':id/vong-doi')
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: OrderLifecycleResponseDto,
    description:
      'Chuỗi bước vòng đời ĐÃ GATE theo cờ phạm vi của đơn (FR-7). Bước bị cờ chặn không có trong mảng — client vẽ nguyên mảng, không lọc, không tự suy từ cờ (AD-2).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  async lifecycle(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<OrderLifecycleResponseDto> {
    const vongDoi = await this.orders.lifecycle(
      account.id,
      await this.quyenCuaNguoiGoi(account.id),
      id,
    );
    return {
      buoc: [...vongDoi.buoc],
      buocKeTiep: [...vongDoi.buocKeTiep],
    };
  }

  @Get(':id/phien-ban')
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiOkResponse({
    type: OrderVersionsResponseDto,
    description:
      'MỌI bản update của đơn theo versionNo tăng dần (FR-6); `laBanHienLuc` phân giải qua currentVersionId (AD-6). KHÔNG có tiền/giá (AD-10).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  async listVersions(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<OrderVersionsResponseDto> {
    return {
      items: [
        ...(await this.orders.listVersions(
          account.id,
          await this.quyenCuaNguoiGoi(account.id),
          id,
        )),
      ],
    } as OrderVersionsResponseDto;
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
      await this.quyenCuaNguoiGoi(account.id),
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
      await this.quyenCuaNguoiGoi(account.id),
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
      await this.quyenCuaNguoiGoi(account.id),
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
      await this.quyenCuaNguoiGoi(account.id),
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

  // Xuất báo giá PDF + ảnh (Story 4.8, FR-21) — action nghiệp vụ là sub-resource POST
  // (khuôn `:id/chot`). Body rỗng; response CHỈ metadata — bytes tải qua 2 route proxy dưới.
  @Post(':id/xuat-bao-gia')
  @RequirePermissions(PERM.quotesCreateEdit)
  // Render + đè bộ file mới nhất của đơn, không tạo resource định danh mới — 201 mặc định
  // của @Post sai ngữ nghĩa (khuôn :id/chot).
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: QuoteExportResponseDto,
    description:
      'Metadata bộ file MỚI NHẤT của Đơn (AD-3 — bytes ở R2, tải qua GET /orders/{id}/bao-gia/anh|pdf). Xuất lần n đè bộ file cũ — MỘT bộ file mỗi Đơn, phản ánh nội dung hiện tại.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Báo giá chưa có dòng nào — không có gì để xuất (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này (NOT_FOUND).',
  })
  async exportQuote(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<QuoteExportResponseDto> {
    // vatRate + cờ tier resolve TƯƠI mỗi request rồi truyền xuống (khuôn :id/chot) —
    // dùng khi đơn CHƯA chốt (chưa có snapshot thuế trên version).
    return (await this.quoteExport.exportQuote(
      account.id,
      id,
      await this.settings.vatRatePercent(),
      await this.tieredPricingEnabled(),
    )) as QuoteExportResponseDto;
  }

  // 2 route proxy tải file đã xuất (AD-3): backend stream bytes từ R2 sau JWT + permission
  // guard — KHÔNG presigned URL công khai, không public bucket. Sub-resource của `:id` —
  // không collision static-route.
  @Get(':id/bao-gia/anh')
  @RequirePermissions(PERM.quotesCreateEdit)
  @ApiProduces('image/png')
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
    description: 'Bytes ảnh PNG báo giá mới nhất của Đơn.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Đơn này chưa xuất báo giá lần nào (NOT_FOUND).',
  })
  async downloadQuoteImage(@Param('id') id: string): Promise<StreamableFile> {
    const file = await this.quoteExport.getExportFile(id, 'anh');
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }

  @Get(':id/bao-gia/pdf')
  @RequirePermissions(PERM.quotesCreateEdit)
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
    description: 'Bytes PDF báo giá mới nhất của Đơn.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quotes.create_edit (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Đơn này chưa xuất báo giá lần nào (NOT_FOUND).',
  })
  async downloadQuotePdf(@Param('id') id: string): Promise<StreamableFile> {
    const file = await this.quoteExport.getExportFile(id, 'pdf');
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }

  /**
   * Chuyển trạng thái THỦ CÔNG + đính kèm ảnh bằng chứng (Story 5.5, FR-9/FR-23).
   *
   * `@HttpCode(OK)` — kỷ luật của file: action nghiệp vụ trên resource CÓ SẴN không trả 201
   * (không có resource nào được tạo ở cấp URL này).
   *
   * GATE CỬA đúng BA key mà `SU_KIEN_THU_CONG` thực sự cần. KHÔNG liệt `quotes.create_edit`
   * / `orders.confirm`: đó là key của `chot`/`mo_lai`/`huy` — chính những sự kiện endpoint
   * này TỪ CHỐI. Mở cửa cho chúng là mời đúng ca hỏng dữ liệu mà whitelist vừa chặn.
   * Gate thật vẫn là engine dưới row lock (hai tầng).
   *
   * GIỚI HẠN CHẶN DoS ở interceptor đặt CAO HƠN giới hạn hợp đồng (10 ảnh × 10 MB, ở
   * `attachment-limits.ts`) một cách CÓ CHỦ ĐÍCH: multer ném `MulterError` TRƯỚC khi handler
   * chạy, và lỗi đó lọt tới `AllExceptionsFilter` như lỗi không lường trước ⇒ 500 generic,
   * mất envelope `VALIDATION_ERROR` + `fieldErrors` mà AC-9 đòi. Đặt cao hơn ⇒ mọi vi phạm
   * của người dùng THẬT đi tới domain và nhận 400 đúng shape; chỉ request lạm dụng thật sự
   * mới chạm trần cứng này.
   *
   * KHÔNG khai `storage` ⇒ multer dùng memory storage mặc định (bytes đi thẳng lên R2, không
   * chạm đĩa máy chủ).
   */
  @Post(':id/chuyen-trang-thai')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions(
    PERM.constructionTransition,
    PERM.deliveryConfirm,
    PERM.paymentsRecord,
  )
  @UseInterceptors(
    FilesInterceptor('anh', TRAN_CUNG_SO_ANH, {
      limits: { fileSize: TRAN_CUNG_KICH_THUOC_BYTE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    type: StatusChangeResponseDto,
    description:
      'Đơn đã chuyển; ảnh (nếu có) đã ghi vào đúng bước qua bốn toạ độ (đơn, từ→đến, thời điểm).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Ảnh sai định dạng/quá lớn/quá nhiều (VALIDATION_ERROR) — transition KHÔNG chạy.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền cho bước đã chọn (FORBIDDEN) — Order.status không đổi.',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'Bước ngoài lane thủ công, ngoài phạm vi đơn, hoặc không đi được từ trạng thái hiện tại — kể cả ca bấm hai lần (CONFLICT).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có đơn với id này hoặc ngoài phạm vi (NOT_FOUND).',
  })
  async chuyenTrangThai(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() dto: StatusChangeRequestDto,
    @UploadedFiles() anh?: FileDaTaiLen[],
  ): Promise<StatusChangeResponseDto> {
    const ketQua = await this.orders.chuyenTrangThaiThuCong({
      callerAccountId: account.id,
      quyen: await this.quyenCuaNguoiGoi(account.id),
      orderId: id,
      event: dto.event as TransitionEvent,
      anh: anh ?? [],
    });
    return {
      status: ketQua.status,
      occurredAt: ketQua.occurredAt.toISOString(),
      soAnhDaLuu: ketQua.soAnhDaLuu,
    };
  }

  /**
   * Proxy đọc bytes MỘT ảnh đính kèm (AD-3: bucket không public, byte nào cũng đi qua
   * backend sau JWT + permission).
   *
   * Gate đọc giống bốn đường đọc đơn (`view_all` OR `view_own`) — ảnh của đơn là dữ liệu của
   * đơn. ⚠️ Service `findScopedOrThrow` TRƯỚC khi chạm R2: khác `:id/bao-gia/anh` phía trên,
   * vốn gọi `getExportFile(id, …)` không nhận caller và KHÔNG scope (nợ ghi nhận từ 5.4).
   */
  @Get(':id/anh/:attachmentId')
  @RequireAnyPermissions(PERM.ordersViewAll, PERM.ordersViewOwn)
  @ApiProduces('image/jpeg', 'image/png', 'image/webp', 'image/heic')
  @ApiOkResponse({
    schema: { type: 'string', format: 'binary' },
    description: 'Bytes của ảnh đính kèm.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu CẢ orders.view_all lẫn orders.view_own (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description:
      'Đơn ngoài phạm vi/không tồn tại, hoặc ảnh không thuộc đơn này (NOT_FOUND) — cùng một thông điệp, không xác nhận ảnh có thật.',
  })
  async downloadAttachment(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<StreamableFile> {
    const file = await this.orders.anhDinhKem(
      account.id,
      await this.quyenCuaNguoiGoi(account.id),
      id,
      attachmentId,
    );
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }
}
