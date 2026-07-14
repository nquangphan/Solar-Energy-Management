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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
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
import { CreateProductRequestDto } from './dto/create-product-request.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductRequestDto } from './dto/update-product-request.dto';
import { ProductsService } from './products.service';

/**
 * CRUD danh mục vật tư (FR-14). READ (`GET`) khai `@RequirePermissions(PERM.catalogView)`;
 * WRITE (`POST`/`PATCH`/`DELETE`) khai `@RequirePermissions(PERM.catalogManage)`. Tách đọc/ghi
 * để người dựng báo giá (`THO_KS`, có `catalog.view` không có `catalog.manage`) đọc được danh mục
 * mà không sửa được — KHÔNG `@Public()`, KHÔNG `@AuthenticatedOnly()`: đây là dữ liệu nghiệp vụ,
 * và một route quên guard là đường để mọi người đã đăng nhập đọc giá vốn (chính là lỗ hổng mà
 * source-guard `no-handler-without-require-permissions` của Story 2.10 tồn tại để chặn).
 *
 * `canViewCosts` resolve TƯƠI từ DB mỗi request qua `AccountPermissionsService`
 * (AD-8) — KHÔNG suy từ JWT claim (2.3 cố ý không nhét quyền vào token: quyền đổi runtime,
 * token thì stale) và KHÔNG đọc từ `request` thô (`PermissionsGuard` không gắn effective
 * set vào request; `@CurrentAccount()` chỉ mang `{ id, email, displayName }`).
 *
 * Controller KHÔNG dựng envelope lỗi: service ném `AppException`, `AllExceptionsFilter`
 * dựng envelope (AD-5).
 */
@ApiTags('catalog')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly accountPermissions: AccountPermissionsService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private async canViewCosts(accountId: string): Promise<boolean> {
    const permissions = await this.accountPermissions.listForAccount(accountId);
    return permissions.has(PERM.costsView);
  }

  /**
   * Cờ giá phân tầng, resolve TƯƠI mỗi request từ DB (AD-14) — CÙNG MỘT KHUÔN với
   * `canViewCosts`: controller resolve, service nhận `boolean`. `ProductsService` KHÔNG inject
   * `FeatureFlagsService` (giữ nó thuần prisma+eventbus).
   *
   * Cờ TẮT ⇒ service không `include` bậc thang ⇒ payload không có key `prices` (AD-4: server
   * enforce, không phải "để FE tự ẩn").
   */
  private async tieredPricingEnabled(): Promise<boolean> {
    return await this.featureFlags.isEnabled(FLAG.catalogTieredPricing);
  }

  @Post()
  @RequirePermissions(PERM.catalogManage)
  @ApiCreatedResponse({
    type: ProductResponseDto,
    description:
      'Sản phẩm đã tạo. `costPrice` chỉ có mặt nếu caller có costs.view.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'Body không hợp lệ (VALIDATION_ERROR) — kèm `fieldErrors`.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu catalog.manage; hoặc body có `costPrice` mà thiếu costs.view (FORBIDDEN).',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CreateProductRequestDto,
  ): Promise<ProductResponseDto> {
    const canViewCosts = await this.canViewCosts(account.id);
    return (await this.products.create(
      account.id,
      body,
      canViewCosts,
    )) as ProductResponseDto;
  }

  @Get()
  @RequirePermissions(PERM.catalogView)
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description:
      'true = trả cả sản phẩm đã ẩn (soft-delete). Mặc định chỉ sản phẩm còn hiệu lực.',
  })
  @ApiOkResponse({ type: [ProductResponseDto] })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu catalog.manage (FORBIDDEN).',
  })
  async findAll(
    @CurrentAccount() account: AuthenticatedAccount,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ProductResponseDto[]> {
    // Hai truy vấn ĐỘC LẬP (quyền của account, cờ hệ thống) ⇒ chạy song song. Nối tiếp chúng
    // cộng trọn một round-trip DB vào đường đọc danh mục nóng nhất mà không đổi lấy được gì.
    const [canViewCosts, tieredPricingEnabled] = await Promise.all([
      this.canViewCosts(account.id),
      this.tieredPricingEnabled(),
    ]);
    return (await this.products.findAll(
      includeInactive === 'true',
      canViewCosts,
      tieredPricingEnabled,
    )) as ProductResponseDto[];
  }

  @Get(':id')
  @RequirePermissions(PERM.catalogView)
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu catalog.view (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có sản phẩm với id này (NOT_FOUND).',
  })
  async findOne(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<ProductResponseDto> {
    const [canViewCosts, tieredPricingEnabled] = await Promise.all([
      this.canViewCosts(account.id),
      this.tieredPricingEnabled(),
    ]);
    return (await this.products.findOne(
      id,
      canViewCosts,
      tieredPricingEnabled,
    )) as ProductResponseDto;
  }

  @Patch(':id')
  @RequirePermissions(PERM.catalogManage)
  @ApiOkResponse({
    type: ProductResponseDto,
    description:
      'Sản phẩm sau khi sửa. Sửa giá KHÔNG hồi tố đơn đã chốt (đơn giữ giá snapshot riêng).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'Body không hợp lệ (VALIDATION_ERROR) — kèm `fieldErrors`.',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description:
      'Thiếu catalog.manage; hoặc body có `costPrice` mà thiếu costs.view (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có sản phẩm với id này (NOT_FOUND).',
  })
  async update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: UpdateProductRequestDto,
  ): Promise<ProductResponseDto> {
    const canViewCosts = await this.canViewCosts(account.id);
    return (await this.products.update(
      account.id,
      id,
      body,
      canViewCosts,
    )) as ProductResponseDto;
  }

  /** Xoá = ẩn khỏi danh mục (`isActive = false`) — xem `ProductsService.deactivate`. */
  @Delete(':id')
  @RequirePermissions(PERM.catalogManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Sản phẩm đã bị ẩn khỏi danh mục (soft-delete, không xoá bản ghi).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu catalog.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có sản phẩm với id này (NOT_FOUND).',
  })
  async remove(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<void> {
    await this.products.deactivate(account.id, id);
  }
}
