import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsOptionalNotNull } from '../../catalog/dto/is-optional-not-null.decorator';

/**
 * Body của `POST /orders/:id/line-items` — MỘT DTO cho HAI dạng dòng (UX-DR-24):
 *
 *  - **Dòng catalog** (`productId` có mặt): backend copy `name`/`unit`/`priceEditable`/
 *    `warrantyMonths` từ Product và auto-điền `unitPrice` qua `resolveUnitPrice()` (FR-5/FR-14);
 *    `unitPrice` trong body CHỈ được nhận khi `Product.priceEditable = true` — luật đó cần bản
 *    ghi Product nên sống ở service (400), không ở đây.
 *  - **Dòng tự do** (`productId` vắng mặt): `name`/`unit`/`unitPrice` bắt buộc,
 *    `priceEditable = true` do server gán.
 *
 * `@ValidateIf` bật/tắt validator theo dạng dòng — validator chỉ chạy khi field THUỘC dạng đó
 * (hoặc client chủ động gửi, với `unitPrice` của dòng catalog).
 *
 * `name` dòng tự do: TRIM trước `@IsNotEmpty` — chuỗi toàn whitespace phải bị chặn (TD-21).
 */
export class AddLineItemRequestDto {
  @ApiPropertyOptional({
    description:
      'Id sản phẩm danh mục. Vắng mặt = dòng tự do. Id không tồn tại ⇒ 400 kèm fieldErrors.',
  })
  @IsOptionalNotNull()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @ApiProperty({ description: 'Số lượng — nguyên, tối thiểu 1.', example: 8 })
  @IsInt()
  @Min(1)
  qty!: number;

  @ApiPropertyOptional({
    description:
      'Đơn giá — số nguyên ĐỒNG. BẮT BUỘC với dòng tự do. Với dòng catalog: CHỈ được gửi khi Product.priceEditable = true (ngược lại 400) — mặc định backend auto-điền theo danh mục hiện tại.',
    example: 2_450_000,
  })
  @ValidateIf(
    (o: AddLineItemRequestDto) =>
      o.productId === undefined || o.unitPrice !== undefined,
  )
  @IsInt()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({
    description:
      'Tên dòng (nhiều dòng được) — BẮT BUỘC với dòng tự do; dòng catalog bỏ qua (copy từ Product).',
    example: 'Combo phụ kiện lắp đặt\n(dây DC + jack MC4)',
  })
  @ValidateIf((o: AddLineItemRequestDto) => o.productId === undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Đơn vị tính — BẮT BUỘC với dòng tự do; dòng catalog bỏ qua (copy từ Product).',
    example: 'bộ',
  })
  @ValidateIf((o: AddLineItemRequestDto) => o.productId === undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Diễn giải cho dòng — nullable.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional({
    description:
      'Cờ "linh động/dự kiến" — CHỈ hiển thị, không đổi hành vi giá.',
    default: false,
  })
  @IsOptionalNotNull()
  @IsBoolean()
  isFlexible?: boolean;
}
