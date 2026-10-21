import { ApiProperty } from '@nestjs/swagger';
import type { Customer } from '@prisma/client';
import {
  CustomerResponseDto,
  toCustomerResponseDto,
} from './customer-response.dto';

/**
 * Response của `GET /customers` — ENVELOPE phân trang, không phải mảng trần.
 *
 * `total` là TỔNG số khách khớp bộ lọc trên TOÀN BẢNG, không phải độ dài trang hiện tại: màn danh
 * sách cần nó để biết còn bao nhiêu trang. Đếm nhầm thành `items.length` sẽ vẽ ra một danh bạ chỉ
 * có đúng một trang, và những khách còn lại biến mất khỏi giao diện.
 */
export class CustomerListResponseDto {
  @ApiProperty({ type: [CustomerResponseDto] })
  items!: CustomerResponseDto[];

  @ApiProperty({
    description:
      'Tổng số khách khớp bộ lọc (TOÀN BẢNG, không phải số dòng của trang này).',
    example: 57,
  })
  total!: number;

  @ApiProperty({ description: 'Trang hiện tại (bắt đầu từ 1).', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Số bản ghi mỗi trang.', example: 20 })
  pageSize!: number;
}

/** Maps the paginated service result (Prisma rows) to the contract. */
export function toCustomerListResponseDto(view: {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}): CustomerListResponseDto {
  return {
    items: view.items.map(toCustomerResponseDto),
    total: view.total,
    page: view.page,
    pageSize: view.pageSize,
  };
}
