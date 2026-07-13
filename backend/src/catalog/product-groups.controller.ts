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
  Put,
  Query,
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
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERM } from '../accounts/domain/permission-registry';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { CreateProductGroupRequestDto } from './dto/create-product-group-request.dto';
import { ProductGroupDetailResponseDto } from './dto/product-group-detail-response.dto';
import { ProductGroupResponseDto } from './dto/product-group-response.dto';
import { ReplaceProductGroupItemsRequestDto } from './dto/replace-product-group-items-request.dto';
import { UpdateProductGroupRequestDto } from './dto/update-product-group-request.dto';
import { ProductGroupsService } from './product-groups.service';

/**
 * Gói vật tư — CRUD danh mục gói + thay checklist (FR-14).
 *
 * MỌI handler gate `catalog.manage` ("Sửa danh mục & giá") — khớp nguyên văn "người có quyền sửa
 * danh mục" của yêu cầu. `settings.manage` là SAI ở đây: nó dành cho cấu hình doanh nghiệp
 * đặt-một-lần (nguồn khách, VAT), còn gói vật tư là dữ liệu vận hành sửa hằng tuần.
 *
 * 🔴 HỆ QUẢ ĐÃ BIẾT, để lại cho story dựng giỏ hàng: preset Thợ khảo sát — CHÍNH LÀ người dựng
 * báo giá — KHÔNG có `catalog.manage`, và `@RequirePermissions` là AND thuần (không có OR). Nên
 * khi picker gói ra đời, nó sẽ 403 cho đúng người dùng nó phục vụ. Lỗ này ĐÃ tồn tại và rộng hơn
 * gói: `GET /products` cũng gate bằng `catalog.manage`. Vá nửa vời (nới riêng đường gói) để lại
 * giỏ hàng vẫn chết vì không đọc nổi danh mục sản phẩm ⇒ phải vá cả hai cùng lúc, ở story có
 * picker thật.
 *
 * Controller KHÔNG dựng envelope lỗi: service ném `AppException`, `AllExceptionsFilter` dựng
 * envelope (AD-5).
 */
@ApiTags('catalog')
@ApiBearerAuth()
@Controller('product-groups')
export class ProductGroupsController {
  constructor(private readonly productGroups: ProductGroupsService) {}

  @Get()
  @RequirePermissions(PERM.catalogManage)
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description:
      'true = trả cả gói đã rút khỏi picker. Mặc định chỉ gói còn hiệu lực.',
  })
  @ApiOkResponse({
    type: [ProductGroupResponseDto],
    description:
      'Danh sách GỌN — không kèm món. Món ở GET /product-groups/:id.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền sửa danh mục (FORBIDDEN).',
  })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ProductGroupResponseDto[]> {
    return (await this.productGroups.findAll(
      includeInactive === 'true',
    )) as ProductGroupResponseDto[];
  }

  @Post()
  @RequirePermissions(PERM.catalogManage)
  @ApiCreatedResponse({
    type: ProductGroupResponseDto,
    description: 'Gói mới — luôn `isActive: true`, và RỖNG (chưa có món nào).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu/sai `name` (VALIDATION_ERROR) — kèm `fieldErrors`.',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description: 'Tên gói đã có trong danh mục (CONFLICT).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền sửa danh mục (FORBIDDEN).',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CreateProductGroupRequestDto,
  ): Promise<ProductGroupResponseDto> {
    return (await this.productGroups.create(
      account.id,
      body,
    )) as ProductGroupResponseDto;
  }

  /**
   * Bật lại một gói đã tắt.
   *
   * 🔴 Khai TRƯỚC các route `:id` trần — Nest so route theo thứ tự khai, nên `@Patch(':id')` đứng
   * trên sẽ nuốt luôn `:id/reactivate`.
   */
  @Post(':id/reactivate')
  // 200, KHÔNG 201: bật lại một gói ĐANG CÓ không tạo ra tài nguyên nào. `@Post` mặc định 201
  // ("đã tạo") — để nguyên là nói dối về việc vừa xảy ra, và không có `Location` nào để trỏ tới.
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERM.catalogManage)
  @ApiParam({ name: 'id', description: 'Id gói vật tư.' })
  @ApiOkResponse({
    type: ProductGroupResponseDto,
    description: 'Gói đã bật lại (`isActive: true`). Món con còn nguyên.',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có gói nào mang id đó (NOT_FOUND).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền sửa danh mục (FORBIDDEN).',
  })
  async reactivate(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<ProductGroupResponseDto> {
    return (await this.productGroups.reactivate(
      account.id,
      id,
    )) as ProductGroupResponseDto;
  }

  /**
   * THAY nguyên khối danh sách món — thứ tự mảng LÀ thứ tự hiện trên checklist.
   *
   * 🔴 Khai TRƯỚC `@Get(':id')`/`@Patch(':id')` vì cùng lý do với `:id/reactivate`.
   */
  @Put(':id/items')
  @RequirePermissions(PERM.catalogManage)
  @ApiParam({ name: 'id', description: 'Id gói vật tư.' })
  @ApiOkResponse({
    type: ProductGroupDetailResponseDto,
    description:
      'Gói kèm checklist MỚI. Danh sách cũ đã bị thay sạch (nguyên tử).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Sản phẩm lặp trong payload, hoặc `productId` không tồn tại (VALIDATION_ERROR) — kèm `fieldErrors`. KHÔNG có gì được ghi.',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có gói nào mang id đó (NOT_FOUND).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền sửa danh mục (FORBIDDEN).',
  })
  async replaceItems(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: ReplaceProductGroupItemsRequestDto,
  ): Promise<ProductGroupDetailResponseDto> {
    return (await this.productGroups.replaceItems(
      account.id,
      id,
      body.productIds,
    )) as unknown as ProductGroupDetailResponseDto;
  }

  /** Gói KÈM checklist — endpoint mà picker báo giá sẽ gọi. KHÔNG bao giờ mang giá vốn. */
  @Get(':id')
  @RequirePermissions(PERM.catalogManage)
  @ApiParam({ name: 'id', description: 'Id gói vật tư.' })
  @ApiOkResponse({
    type: ProductGroupDetailResponseDto,
    description:
      'Gói kèm các món, sắp theo displayOrder tăng dần. Món là PROJECTION HẸP của sản phẩm — không có giá vốn.',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có gói nào mang id đó (NOT_FOUND).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền sửa danh mục (FORBIDDEN).',
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<ProductGroupDetailResponseDto> {
    return (await this.productGroups.findOne(
      id,
    )) as unknown as ProductGroupDetailResponseDto;
  }

  @Patch(':id')
  @RequirePermissions(PERM.catalogManage)
  @ApiParam({ name: 'id', description: 'Id gói vật tư.' })
  @ApiOkResponse({
    type: ProductGroupResponseDto,
    description:
      'Gói sau khi sửa. Không cột nào đổi giá trị ⇒ KHÔNG ghi DB và KHÔNG ghi nhật ký.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: '`name` là `null` hoặc rỗng (VALIDATION_ERROR).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có gói nào mang id đó (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description: 'Tên mới trùng một gói khác (CONFLICT).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền sửa danh mục (FORBIDDEN).',
  })
  async update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: UpdateProductGroupRequestDto,
  ): Promise<ProductGroupResponseDto> {
    return (await this.productGroups.update(
      account.id,
      id,
      body,
    )) as ProductGroupResponseDto;
  }

  /** Xoá = rút gói khỏi picker (`isActive = false`), KHÔNG xoá bản ghi. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERM.catalogManage)
  @ApiParam({ name: 'id', description: 'Id gói vật tư.' })
  @ApiNoContentResponse({
    description:
      'Gói đã rút khỏi picker (`isActive: false`, soft-delete). Món con còn nguyên, bật lại là dùng được.',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có gói nào mang id đó (NOT_FOUND).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu quyền sửa danh mục (FORBIDDEN).',
  })
  async remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<void> {
    await this.productGroups.deactivate(account.id, id);
  }
}
