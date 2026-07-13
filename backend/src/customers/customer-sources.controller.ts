import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERM } from '../accounts/domain/permission-registry';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { CustomerSourcesService } from './customer-sources.service';
import { CustomerSourceResponseDto } from './dto/customer-source-response.dto';

/**
 * Danh mục Nguồn khách — CHỈ ĐỌC. Tồn tại ở story này vì `Customer.sourceId` là FK bắt buộc:
 * form tạo khách phải có danh sách mà chọn. CRUD (POST/PATCH/DELETE) + màn cấu hình + gate
 * `settings.manage` thuộc **Story 3.5** — đừng thêm vào đây.
 *
 * Gate bằng `customers.manage` (KHÔNG `settings.manage`): người đang TẠO KHÁCH cần đọc danh
 * sách này, và họ chưa chắc có quyền cấu hình hệ thống.
 */
@ApiTags('customers')
@ApiBearerAuth()
@Controller('customer-sources')
export class CustomerSourcesController {
  constructor(private readonly customerSources: CustomerSourcesService) {}

  @Get()
  @RequirePermissions(PERM.customersManage)
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description:
      'true = trả cả nguồn đã ngừng dùng. Mặc định chỉ nguồn còn hiệu lực (dropdown khách mới).',
  })
  @ApiOkResponse({ type: [CustomerSourceResponseDto] })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu customers.manage (FORBIDDEN).',
  })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<CustomerSourceResponseDto[]> {
    return (await this.customerSources.findAll(
      includeInactive === 'true',
    )) as CustomerSourceResponseDto[];
  }
}
