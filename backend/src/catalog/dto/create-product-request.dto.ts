import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
 * Body của `POST /products`. `@ApiProperty` để OpenAPI có schema thật; class-validator để
 * `ValidationPipe` toàn cục (`common.module.ts`, `whitelist: true`) tự trả `400
 * VALIDATION_ERROR` + `fieldErrors` — DTO KHÔNG tự dựng envelope lỗi (AD-5).
 *
 * TIỀN LÀ INT ĐỒNG (AD-10/AD-16): `price`/`costPrice` là `@IsInt() @Min(0)` — `@IsNumber()`
 * sẽ nhận `1500.75` và mở cửa cho lỗi dấu phẩy động vào tận DB.
 */
export class CreateProductRequestDto {
  @ApiProperty({ description: 'Tên vật tư.', example: 'Tấm pin JA Solar 580W' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Mã vật tư — duy nhất.', example: 'JAS-580-M10' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ description: 'Đơn vị tính.', example: 'tấm' })
  @IsString()
  @IsNotEmpty()
  unit!: string;

  @ApiProperty({
    description: 'Giá bán — số nguyên ĐỒNG (không thập phân).',
    example: 2_450_000,
  })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    description:
      'Giá vốn — số nguyên ĐỒNG. Ghi được CHỈ khi có quyền costs.view; thiếu quyền mà gửi field này ⇒ 403. Bỏ trống ⇒ 0 (từ Story 6.3 hệ thống tự cập nhật bằng bình quân gia quyền khi nhập kho).',
    example: 1_950_000,
  })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    description:
      'Có theo dõi tồn kho không (pin/inverter = true; công lắp, phí vận chuyển = false).',
    default: true,
  })
  @IsOptionalNotNull()
  @IsBoolean()
  tracksStock?: boolean;

  @ApiPropertyOptional({
    description:
      'Cho phép sửa giá tại chỗ lúc lập báo giá (phí lắp đặt = true; tấm pin = false).',
    default: false,
  })
  @IsOptionalNotNull()
  @IsBoolean()
  priceEditable?: boolean;

  @ApiPropertyOptional({
    description:
      'Bảo hành mặc định, tính bằng THÁNG. Bỏ trống/null = không bảo hành (công lắp, phí lắp đặt) — đây là giá trị hợp lệ, KHÔNG phải thiếu dữ liệu.',
    example: 144,
  })
  // `number | null`, KHÔNG chỉ `number?`: `null` là giá trị NGHIỆP VỤ hợp lệ ("không bảo
  // hành"), và PATCH cần đường đặt LẠI về null. `@IsOptional()` của class-validator bỏ qua
  // cả `undefined` lẫn `null` ⇒ null đi lọt mà không cần validator riêng (đúng AC: KHÔNG
  // viết validation chặn null).
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number | null;
}
