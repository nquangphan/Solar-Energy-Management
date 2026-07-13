import { ApiProperty } from '@nestjs/swagger';

/**
 * Một mức giá trong payload trả về. Chỉ để OpenAPI có schema thật (AD-12) — service trả object
 * thường, KHÔNG instantiate class này.
 *
 * KHÔNG có field giá vốn: giá vốn là MỘT con số duy nhất trên `Product` (gate bởi `costs.view`),
 * bậc thang không nhân nó lên (AD-20).
 */
export class ProductPriceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: 'Mua TỪ số lượng này trở lên thì ăn mức giá này.',
  })
  minQty!: number;

  @ApiProperty({ description: 'Đơn giá ở mức này — số nguyên ĐỒNG.' })
  price!: number;
}
