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
import { CustomerSourcesService } from './customer-sources.service';
import { CreateCustomerSourceRequestDto } from './dto/create-customer-source-request.dto';
import { CustomerSourceResponseDto } from './dto/customer-source-response.dto';
import { UpdateCustomerSourceRequestDto } from './dto/update-customer-source-request.dto';

/**
 * Danh mục Nguồn khách — ĐỌC (Story 3.3) + CẤU HÌNH (Story 3.5).
 *
 * HAI GATE KHÁC NHAU trên cùng một controller, và đó là chủ đích:
 *
 *  - GHI (`POST`/`PATCH`/`DELETE`/`reactivate`) ⇒ `settings.manage`. Sửa danh mục là việc cấu
 *    hình hệ thống, chỉ Admin.
 *  - ĐỌC (`GET`) ⇒ **`customers.manage`**, KHÔNG phải `settings.manage`. Người đang TẠO KHÁCH
 *    cần đọc danh sách này để chọn nguồn, và preset `THO_KS`/`QUAN_LY`/`KE_TOAN` có
 *    `customers.manage` nhưng KHÔNG có `settings.manage`. Đổi gate của `GET` ⇒ sale không tạo
 *    được khách nữa. Đây không phải sơ suất — đừng "dọn dẹp" cho hai gate giống nhau.
 *
 * KHÔNG có route xoá cứng. `DELETE :id` = TẮT (soft-delete): khách cũ vẫn trỏ vào nguồn, và FK
 * `ON DELETE RESTRICT` sẽ chặn xoá thật — nhưng lý do thật là lịch sử "khách này từ đâu tới"
 * không được phép bốc hơi. `POST :id/reactivate` là đường bật lại (action nghiệp vụ =
 * sub-resource POST, theo convention của spine).
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

  @Post()
  @RequirePermissions(PERM.settingsManage)
  @ApiCreatedResponse({
    type: CustomerSourceResponseDto,
    description:
      'Nguồn mới — luôn `active: true` và `isOther: false` (cờ "Khác" chỉ do seed đặt).',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu/sai `name`, `sortOrder` âm… (VALIDATION_ERROR).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description: 'Tên nguồn đã có trong danh mục (CONFLICT).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu settings.manage (FORBIDDEN).',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CreateCustomerSourceRequestDto,
  ): Promise<CustomerSourceResponseDto> {
    return (await this.customerSources.create(
      account.id,
      body,
    )) as CustomerSourceResponseDto;
  }

  @Patch(':id')
  @RequirePermissions(PERM.settingsManage)
  @ApiParam({ name: 'id', description: 'Id nguồn khách.' })
  @ApiOkResponse({
    type: CustomerSourceResponseDto,
    description:
      'Nguồn sau khi sửa. Dòng mang cờ "Khác" ĐỔI TÊN ĐƯỢC — luật nghiệp vụ đọc cờ, không đọc tên.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      '`name`/`sortOrder` là `null` hoặc sai kiểu (VALIDATION_ERROR).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có nguồn nào mang id đó (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description: 'Tên mới trùng một nguồn khác (CONFLICT).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu settings.manage (FORBIDDEN).',
  })
  async update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
    @Body() body: UpdateCustomerSourceRequestDto,
  ): Promise<CustomerSourceResponseDto> {
    return (await this.customerSources.update(
      account.id,
      id,
      body,
    )) as CustomerSourceResponseDto;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERM.settingsManage)
  @ApiParam({ name: 'id', description: 'Id nguồn khách.' })
  @ApiNoContentResponse({
    description:
      'Nguồn đã TẮT (`active: false`) — KHÔNG xoá cứng: khách cũ vẫn giữ nguồn này.',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có nguồn nào mang id đó (NOT_FOUND).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description:
      'Dòng mang cờ "Khác" KHÔNG tắt được — luật bắt buộc ghi rõ nguồn phụ thuộc vào nó (CONFLICT).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu settings.manage (FORBIDDEN).',
  })
  async deactivate(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<void> {
    await this.customerSources.deactivate(account.id, id);
  }

  @Post(':id/reactivate')
  // 200, KHÔNG 201: bật lại một nguồn ĐANG CÓ không tạo ra tài nguyên nào. `@Post` mặc định 201
  // ("đã tạo") — để nguyên là nói dối về việc vừa xảy ra, và không có `Location` nào để trỏ tới.
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERM.settingsManage)
  @ApiParam({ name: 'id', description: 'Id nguồn khách.' })
  @ApiOkResponse({
    type: CustomerSourceResponseDto,
    description: 'Nguồn đã bật lại (`active: true`).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có nguồn nào mang id đó (NOT_FOUND).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu settings.manage (FORBIDDEN).',
  })
  async reactivate(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('id') id: string,
  ): Promise<CustomerSourceResponseDto> {
    return (await this.customerSources.reactivate(
      account.id,
      id,
    )) as CustomerSourceResponseDto;
  }
}
