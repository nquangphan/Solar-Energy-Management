import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsOptionalNotNull } from './is-optional-not-null.decorator';

/**
 * Body của `PATCH /product-groups/:id` — sửa NỘI DUNG, không đổi trạng thái.
 *
 * KHÔNG dùng `PartialType(CreateProductGroupRequestDto)`: nó sinh `@IsOptional()` cho MỌI field,
 * kể cả cột NOT NULL — và `@IsOptional()` tha luôn `null`, nên `{"name": null}` lọt qua pipe rồi
 * vỡ ở tầng DB thành 500 (bài học HIGH review 3.1). Khai tay để mỗi field lấy đúng decorator của
 * cột nó:
 *  - `name` là cột NOT NULL ⇒ `@IsOptionalNotNull()` (vắng thì thôi, `null` là 400).
 *  - `description` là cột NULLABLE ⇒ `@IsOptional()`, vì `null` ở đây là giá trị NGHIỆP VỤ hợp
 *    lệ: đó là cách XOÁ mô tả.
 *
 * KHÔNG có `isActive` (tắt/bật đi route riêng) và KHÔNG có `items` (thay nguyên khối qua
 * `PUT :id/items`).
 */
export class UpdateProductGroupRequestDto {
  @ApiPropertyOptional({
    description: 'Tên gói mới — vẫn phải DUY NHẤT (trùng gói khác ⇒ 409).',
    example: 'Gói Hybrid 10kW',
  })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    // `type: String` là BẮT BUỘC, không phải trang trí: kiểu khai báo là `string | null`, và
    // metadata phản chiếu của một union rơi về `Object` ⇒ Swagger sinh `"type": "object"`, trong
    // khi `example` lại là chuỗi. Client sinh từ spec sẽ gõ field này thành Object/Map thay vì
    // String? và không gửi nổi mô tả qua client đó.
    type: String,
    description: 'Mô tả gói. Gửi `null` để XOÁ mô tả (cột nullable).',
    example: 'Trọn bộ hybrid 10kW cho nhà phố.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
