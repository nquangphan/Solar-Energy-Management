import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
 * Body của `POST /customer-sources`.
 *
 * KHÔNG có `isOther` ở đây, và đó là quyết định trung tâm của story: cờ "Khác" CHỈ do seed đặt.
 * Bất biến "đúng một dòng `isOther`" không có index DB nào đứng sau — nó đứng được vì KHÔNG CÓ
 * ĐƯỜNG NÀO qua API để tạo dòng thứ hai. Thêm field này vào DTO là mở đúng cái cửa mà thiết kế
 * chọn cách khoá luôn thay vì đi canh.
 *
 * KHÔNG có `active`: nguồn mới luôn `active: true`; tắt/bật đi route riêng (`DELETE` /
 * `:id/reactivate`) để một hành động = một route = một event audit đọc được.
 *
 * `sortOrder` VẮNG ⇒ backend tự tính `max + 1` (cột NOT NULL, không có default ở DB — truyền
 * `undefined` thẳng xuống Prisma là 500). Có mặt thì phải là số nguyên ≥ 0, và `null` bị chặn ở
 * 400 (`@IsOptionalNotNull` — bài học HIGH review 3.1: `@IsOptional()` tha cả `null`).
 */
export class CreateCustomerSourceRequestDto {
  @ApiProperty({
    description: 'Tên nguồn — DUY NHẤT trong danh mục (trùng ⇒ 409).',
    example: 'TikTok',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Một câu để sale phân biệt lúc nhập ("Fanpage" và "Facebook" nghe giống nhau).',
    example: 'Khách nhắn tin từ video TikTok của công ty.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description:
      'Thứ tự hiện trên form tạo khách. Vắng ⇒ backend xếp xuống cuối (max + 1).',
    example: 5,
    minimum: 0,
    maximum: SORT_ORDER_MAX,
  })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(SORT_ORDER_MAX)
  sortOrder?: number;
}
