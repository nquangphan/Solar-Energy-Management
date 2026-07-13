import {
  Body,
  Controller,
  Get,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PERM } from '../accounts/domain/permission-registry';
import {
  CurrentAccount,
  type AuthenticatedAccount,
} from '../auth/current-account.decorator';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ErrorEnvelopeDto } from '../common/errors/dto/error-envelope.dto';
import { CustomersService } from './customers.service';
import { CreateCustomerRequestDto } from './dto/create-customer-request.dto';
import { CustomerListResponseDto } from './dto/customer-list-response.dto';
import { CustomerLookupResponseDto } from './dto/customer-lookup-response.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { LookupCustomerQueryDto } from './dto/lookup-customer-query.dto';
import { UpdateCustomerRequestDto } from './dto/update-customer-request.dto';

/**
 * CRUD Khách hàng (FR-29). MỌI handler khai `@RequirePermissions(PERM.customersManage)` —
 * KHÔNG `@Public()`: đây là dữ liệu khách hàng (SĐT, CCCD, MST, tài khoản ngân hàng), và một
 * route quên guard là đường để mọi người đã đăng nhập đọc trọn danh bạ khách.
 *
 * `:sdt` nhận SĐT ở dạng THÔ hay E.164 đều được — service chạy CÙNG bộ chuẩn hoá với lúc ghi
 * (AD-9), nên `GET /customers/0912345678` và `GET /customers/+84912345678` trỏ về cùng một khách.
 *
 * KHÔNG có `DELETE`: xoá khách chưa nằm trong phạm vi story này (Epic 4 sẽ FK vào bảng này, nên
 * "xoá" sẽ phải là một quyết định có chủ đích, không phải một route thêm cho đủ bộ CRUD).
 */
@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @RequirePermissions(PERM.customersManage)
  @ApiCreatedResponse({
    type: CustomerResponseDto,
    description: 'Khách hàng đã tạo. `sdt` trả về là chuỗi ĐÃ chuẩn hoá E.164.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'SĐT không hợp lệ, thiếu/sai `sourceId`, thiếu `sourceNote` khi nguồn là "Khác", hoặc field lạc loại khách (VALIDATION_ERROR).',
  })
  @ApiConflictResponse({
    type: ErrorEnvelopeDto,
    description: 'SĐT đã thuộc về một khách hàng khác (CONFLICT).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu customers.manage (FORBIDDEN).',
  })
  async create(
    @CurrentAccount() account: AuthenticatedAccount,
    @Body() body: CreateCustomerRequestDto,
  ): Promise<CustomerResponseDto> {
    return (await this.customers.create(
      account.id,
      body,
    )) as CustomerResponseDto;
  }

  @Get()
  @RequirePermissions(PERM.customersManage)
  @ApiOkResponse({ type: CustomerListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      '`custType` không hợp lệ, `page` < 1, hoặc `pageSize` ngoài 1..100 (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu customers.manage (FORBIDDEN).',
  })
  async list(
    @Query() query: ListCustomersQueryDto,
  ): Promise<CustomerListResponseDto> {
    return (await this.customers.list(query)) as CustomerListResponseDto;
  }

  /**
   * PHẢI khai TRƯỚC `@Get(':sdt')`. Nest so route THEO THỨ TỰ KHAI: đặt sau, `:sdt` nuốt luôn
   * chuỗi `"lookup"` và endpoint này trả 404 "không tìm thấy khách hàng `lookup`" — một lỗi trông
   * như lỗi dữ liệu nhưng thật ra là lỗi thứ tự. Có e2e khẳng định đúng chuyện này.
   */
  @Get('lookup')
  @RequirePermissions(PERM.customersManage)
  @ApiOkResponse({
    type: CustomerLookupResponseDto,
    description:
      'Luôn 200 — kể cả khi không có khách nào mang SĐT này (`found: false`). Xem DTO.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'SĐT không hợp lệ (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu customers.manage (FORBIDDEN).',
  })
  async lookup(
    @Query() query: LookupCustomerQueryDto,
  ): Promise<CustomerLookupResponseDto> {
    return (await this.customers.lookup(
      query.sdt,
    )) as CustomerLookupResponseDto;
  }

  @Get(':sdt')
  @RequirePermissions(PERM.customersManage)
  @ApiParam({
    name: 'sdt',
    description:
      'SĐT — thô hay E.164 đều được; backend chuẩn hoá trước khi tra (AD-9).',
    example: '0912345678',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description: 'SĐT không hợp lệ (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu customers.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có khách hàng với SĐT này (NOT_FOUND).',
  })
  async findOne(@Param('sdt') sdt: string): Promise<CustomerResponseDto> {
    return (await this.customers.findOne(sdt)) as CustomerResponseDto;
  }

  @Patch(':sdt')
  @RequirePermissions(PERM.customersManage)
  @ApiParam({ name: 'sdt', example: '0912345678' })
  @ApiOkResponse({
    type: CustomerResponseDto,
    description: 'Khách hàng sau khi sửa. `sdt` KHÔNG sửa được qua đây.',
  })
  @ApiBadRequestResponse({
    type: ErrorEnvelopeDto,
    description:
      'Body chứa `sdt` (bất biến), field lạc loại khách, `sourceId` không tồn tại, hoặc thiếu `sourceNote` khi nguồn mới là "Khác" (VALIDATION_ERROR).',
  })
  @ApiForbiddenResponse({
    type: ErrorEnvelopeDto,
    description: 'Thiếu customers.manage (FORBIDDEN).',
  })
  @ApiNotFoundResponse({
    type: ErrorEnvelopeDto,
    description: 'Không có khách hàng với SĐT này (NOT_FOUND).',
  })
  async update(
    @CurrentAccount() account: AuthenticatedAccount,
    @Param('sdt') sdt: string,
    @Body() body: UpdateCustomerRequestDto,
  ): Promise<CustomerResponseDto> {
    return (await this.customers.update(
      account.id,
      sdt,
      body,
    )) as CustomerResponseDto;
  }
}
