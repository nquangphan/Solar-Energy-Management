import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response của `GET /product-groups` (danh sách) và của mọi endpoint GHI gói. Chỉ để OpenAPI có
 * schema thật (AD-12) — service trả object thường, KHÔNG instantiate class này.
 *
 * KHÔNG kèm `items`: danh sách gọn, dùng cho màn chọn gói. Món nằm ở `ProductGroupDetailResponseDto`
 * (`GET /product-groups/:id`).
 */
export class ProductGroupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Gói Hybrid 8kW' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'false = gói đã rút khỏi picker (soft-delete).' })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
