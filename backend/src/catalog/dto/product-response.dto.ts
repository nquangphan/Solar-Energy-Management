import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductPriceResponseDto } from './product-price-response.dto';

/**
 * Response của mọi endpoint `/products`. Chỉ để OpenAPI có schema thật (AD-12) — service
 * trả object thường, KHÔNG instantiate class này.
 *
 * `costPrice` khai `@ApiPropertyOptional` vì nó **vắng mặt hoàn toàn** khi caller không có
 * `costs.view` (`stripCostPrice`). "Optional" ở đây nghĩa là *tuỳ quyền người gọi*, không
 * phải *tuỳ dữ liệu*: DB luôn có giá vốn.
 *
 * `prices` cũng **vắng mặt hoàn toàn** khi cờ `catalog.tiered_pricing` TẮT — cùng khuôn: loại
 * hẳn key, KHÔNG trả `[]`. `[]` là một lời nói dối: nó nghĩa là "có bậc thang, đang rỗng",
 * còn cờ TẮT nghĩa là "bậc thang không tồn tại trong thế giới này" (dòng cũ có thể vẫn ngủ
 * đông trong DB).
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

  @ApiPropertyOptional({
    type: [ProductPriceResponseDto],
    description:
      'Bậc thang giá theo số lượng, sắp xếp minQty tăng dần. CHỈ có mặt khi cờ catalog.tiered_pricing BẬT; cờ TẮT ⇒ field bị loại khỏi payload (không phải mảng rỗng). Rỗng = cờ bật nhưng sản phẩm chưa cấu hình mức nào.',
  })
  prices?: ProductPriceResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
