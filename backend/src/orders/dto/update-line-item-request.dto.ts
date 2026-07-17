import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsOptionalNotNull } from '../../catalog/dto/is-optional-not-null.decorator';

/**
 * Body của `PATCH /orders/:id/line-items/:lineId` — partial VIẾT TAY, CẤM `PartialType`
 * (nó auto-gắn `@IsOptional` không gỡ được — `{"qty": null}` sẽ lọt xuống cột NOT NULL).
 *
 * Sửa được: `qty`/`note`/`isFlexible` với MỌI dòng; `unitPrice` CHỈ khi dòng có
 * `priceEditable = true` — luật đó cần bản ghi dòng nên sống ở service (400 + fieldErrors).
 * `warrantyMonths`: dòng catalog thường + dòng tự do ghi được (kể cả `null` = bỏ bảo hành);
 * dòng catalog `priceEditable = true` (công lắp/phí lắp đặt) bị BỎ QUA im lặng ở service —
 * giữ `null`, KHÔNG 400 (quyết định khách: không viết validation chặn).
 * `name`/`unit`/`productId` KHÔNG sửa được qua đây: đổi món = xoá dòng + thêm dòng mới.
 */
export class UpdateLineItemRequestDto {
  @ApiPropertyOptional({ description: 'Số lượng — nguyên, tối thiểu 1.' })
  @IsOptionalNotNull()
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({
    description:
      'Đơn giá — số nguyên ĐỒNG. CHỈ dòng priceEditable = true (ngược lại 400).',
  })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Diễn giải — gửi `null` để xoá.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiPropertyOptional({
    description: 'Cờ "linh động/dự kiến" — chỉ hiển thị.',
  })
  @IsOptionalNotNull()
  @IsBoolean()
  isFlexible?: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Bảo hành (tháng) — nguyên ≥ 1; gửi `null` để bỏ bảo hành (giá trị nghiệp vụ hợp lệ). ' +
      'Dòng catalog priceEditable = true (công lắp/phí lắp đặt): field bị bỏ qua im lặng, luôn giữ null.',
  })
  // KHÔNG dùng `IsOptionalNotNull`: null là GIÁ TRỊ hợp lệ ("bỏ bảo hành"), không phải lỗi.
  @IsOptional()
  @ValidateIf((o: UpdateLineItemRequestDto) => o.warrantyMonths !== null)
  @IsInt()
  @Min(1)
  warrantyMonths?: number | null;
}
