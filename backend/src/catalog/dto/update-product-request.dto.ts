import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { IsOptionalNotNull } from './is-optional-not-null.decorator';

/**
 * Body của `PATCH /products/:id` — partial update: mọi field optional, chỉ field CÓ MẶT
 * mới được ghi. Sửa giá bán bất kỳ lúc nào là hợp lệ (FR-14) và KHÔNG hồi tố đơn đã chốt:
 * đơn đóng băng giá riêng (AD-6/AD-20), service này chỉ chạm bảng `products`.
 *
 * KHÔNG dùng `PartialType(CreateProductRequestDto)`: nó gắn `@IsOptional()` lên MỌI field,
 * mà `@IsOptional()` tắt validator cho cả `null` — `{"price": null}` sẽ lọt xuống Prisma
 * trên cột NOT NULL và vỡ thành 500. Khai tay từng field với `@IsOptionalNotNull()` để
 * `undefined` được tha (PATCH bỏ qua field) còn `null` bị chặn ở 400 kèm `fieldErrors`.
 * `warrantyMonths` là ngoại lệ DUY NHẤT — `null` ở đó là "không bảo hành", giá trị hợp lệ.
 *
 * Ghi `costPrice` vẫn đòi `costs.view`; gate đó nằm ở `ProductsService`, KHÔNG ở DTO (DTO
 * không biết quyền của caller).
 */
export class UpdateProductRequestDto {
  @ApiPropertyOptional({
    description: 'Tên vật tư.',
    example: 'Tấm pin JA Solar 580W',
  })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'Mã vật tư — duy nhất.',
    example: 'JAS-580-M10',
  })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @ApiPropertyOptional({ description: 'Đơn vị tính.', example: 'tấm' })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Giá bán — số nguyên ĐỒNG (không thập phân).',
    example: 2_450_000,
  })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description:
      'Giá vốn — số nguyên ĐỒNG. Ghi được CHỈ khi có quyền costs.view; thiếu quyền mà gửi field này ⇒ 403.',
    example: 1_950_000,
  })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    description:
      'Có theo dõi tồn kho không (pin/inverter = true; công lắp, phí vận chuyển = false).',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  tracksStock?: boolean;

  @ApiPropertyOptional({
    description:
      'Cho phép sửa giá tại chỗ lúc lập báo giá (phí lắp đặt = true; tấm pin = false).',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  priceEditable?: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Bảo hành mặc định, tính bằng THÁNG. `null` = không bảo hành (công lắp, phí lắp đặt) — giá trị hợp lệ, KHÔNG phải thiếu dữ liệu.',
    example: 144,
  })
  // `@IsOptional()` (không phải `@IsOptionalNotNull()`): đây là cột nullable, và PATCH cần
  // đường đặt LẠI bảo hành về null.
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number | null;
}
