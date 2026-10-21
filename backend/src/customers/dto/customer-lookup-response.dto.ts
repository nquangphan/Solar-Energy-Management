import { ApiProperty } from '@nestjs/swagger';
import type { Customer } from '@prisma/client';
import {
  CustomerResponseDto,
  toCustomerResponseDto,
} from './customer-response.dto';

/**
 * Response của `GET /customers/lookup?phone=<thô>` (AD-9, FR-29).
 *
 * "Không tìm thấy" ⇒ `200 { found: false, customer: null }`, KHÔNG phải 404: một phép TRA có hai
 * kết quả bình thường, và "chưa có khách này" chính là NỬA KIA của tính năng — nó là thứ mở ra
 * nút "Tạo khách hàng mới" ngay tại màn. Dùng 404 làm luồng điều khiển buộc FE bắt exception cho
 * một đường đi THÀNH CÔNG, và error envelope (AD-5) sẽ sinh `traceId` cho thứ không phải lỗi.
 *
 * `phone` LUÔN được trả về ở dạng đã chuẩn hoá E.164 — kể cả khi `found: false`. Đó là chuỗi mà
 * form tạo khách gửi lại ở bước sau, nên client không bao giờ phải tự dựng nó (AD-9).
 */
export class CustomerLookupResponseDto {
  @ApiProperty({
    description: 'Có khách hàng nào mang SĐT này chưa.',
    example: true,
  })
  found!: boolean;

  @ApiProperty({
    description:
      'SĐT đã chuẩn hoá E.164 — trả về kể cả khi `found: false` (form tạo khách dùng lại chuỗi này).',
    example: '+84912345678',
  })
  phone!: string;

  // BẮT BUỘC + nullable, không phải "optional": key `customer` LUÔN có mặt trong response — nó
  // mang `null` khi không tìm thấy. Khai optional là nói với FE rằng key có thể VẮNG, và FE sẽ
  // phải phân biệt "vắng" với "null" cho một khác biệt không tồn tại.
  @ApiProperty({
    type: CustomerResponseDto,
    nullable: true,
    description: 'Khách hàng tìm được; `null` khi `found: false`.',
  })
  customer!: CustomerResponseDto | null;
}

/** Maps the lookup result of the service (database column names) to the contract. */
export function toCustomerLookupResponseDto(view: {
  found: boolean;
  sdt: string;
  customer: Customer | null;
}): CustomerLookupResponseDto {
  return {
    found: view.found,
    phone: view.sdt,
    customer:
      view.customer === null ? null : toCustomerResponseDto(view.customer),
  };
}
