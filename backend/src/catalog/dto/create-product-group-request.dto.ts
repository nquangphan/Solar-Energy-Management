import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body của `POST /product-groups`. `@ApiProperty` để OpenAPI có schema thật; class-validator để
 * `ValidationPipe` toàn cục (`whitelist: true`) tự trả `400 VALIDATION_ERROR` + `fieldErrors` —
 * DTO KHÔNG tự dựng envelope lỗi (AD-5).
 *
 * KHÔNG có `isActive`: gói mới LUÔN bật (service ghi cứng). Tắt/bật đi route riêng.
 * KHÔNG có `items`: danh sách món thay nguyên khối qua `PUT :id/items` — gói mới ra đời RỖNG, và
 * đó là trạng thái hợp lệ.
 */
export class CreateProductGroupRequestDto {
  @ApiProperty({
    description: 'Tên gói — duy nhất trong danh mục (trùng ⇒ 409).',
    example: 'Gói Hybrid 8kW',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Mô tả cho người dựng báo giá.',
    example: 'Trọn bộ hybrid 8kW cho nhà phố, gồm pin + inverter + phụ kiện.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
