import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsOptionalNotNull } from '../../catalog/dto/is-optional-not-null.decorator';
import { SORT_ORDER_MAX } from './customer-source-limits';

/**
 * Body của `PATCH /customer-sources/:id` — sửa NỘI DUNG, không đổi trạng thái.
 *
 * KHÔNG dùng `PartialType(CreateCustomerSourceRequestDto)`: nó sinh ra `@IsOptional()` cho MỌI
 * field, kể cả cột NOT NULL — và `@IsOptional()` tha luôn `null`, nên `{"name": null}` lọt qua
 * pipe rồi vỡ ở tầng DB thành 500 (bài học HIGH review 3.1). Khai tay để mỗi field lấy đúng
 * decorator của cột nó:
 *  - `name`/`sortOrder` là cột NOT NULL ⇒ `@IsOptionalNotNull()` (vắng thì thôi, `null` là 400).
 *  - `description` là cột NULLABLE ⇒ `@IsOptional()`, vì `null` ở đây là giá trị NGHIỆP VỤ hợp
 *    lệ: đó là cách XOÁ mô tả.
 *
 * KHÔNG có `active` (tắt/bật đi route riêng) và KHÔNG có `isOther` (cờ chỉ do seed đặt).
 *
 * Dòng `isOther` VẪN SỬA TÊN ĐƯỢC qua đây — có chủ đích. Backend nhận ra "Khác" bằng CỜ chứ
 * không bằng so chuỗi tên, nên đổi nhãn hiển thị của nó KHÔNG làm sập luật "chọn Khác ⇒ bắt buộc
 * `sourceNote`" của Story 3.3.
 */
export class UpdateCustomerSourceRequestDto {
  @ApiPropertyOptional({
    description: 'Tên nguồn mới — vẫn phải DUY NHẤT (trùng dòng khác ⇒ 409).',
    example: 'Cộng tác viên',
  })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Mô tả cho người nhập. Gửi `null` để XOÁ mô tả (cột nullable).',
    example: 'Khách do cộng tác viên giới thiệu về.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Thứ tự hiện trên form tạo khách.',
    example: 4,
    minimum: 0,
    maximum: SORT_ORDER_MAX,
  })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(SORT_ORDER_MAX)
  sortOrder?: number;
}
