import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response của mọi endpoint `/products`. Chỉ để OpenAPI có schema thật (AD-12) — service
 * trả object thường, KHÔNG instantiate class này.
 *
 * `costPrice` khai `@ApiPropertyOptional` vì nó **vắng mặt hoàn toàn** khi caller không có
 * `costs.view` (`stripCostPrice`). "Optional" ở đây nghĩa là *tuỳ quyền người gọi*, không
 * phải *tuỳ dữ liệu*: DB luôn có giá vốn.
 */
export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  unit!: string;

  @ApiProperty({ description: 'Giá bán — số nguyên ĐỒNG.' })
  price!: number;

  @ApiPropertyOptional({
    description:
      'Giá vốn — số nguyên ĐỒNG. CHỈ có mặt khi caller mang quyền costs.view; thiếu quyền ⇒ field bị loại khỏi payload (không phải 0, không phải null).',
  })
  costPrice?: number;

  @ApiProperty()
  tracksStock!: boolean;

  @ApiProperty()
  priceEditable!: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Bảo hành mặc định (tháng). `null` = không bảo hành (hợp lệ).',
  })
  warrantyMonths!: number | null;

  @ApiProperty({ description: 'false = đã ẩn khỏi danh mục (soft-delete).' })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
