import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QTY_TOI_DA } from './create-stock-voucher-request.dto';

export class ReturnVoucherLineRequestDto {
  @ApiProperty({ description: 'Sản phẩm trên phiếu xuất gốc (UUID).' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({
    description: `Số lượng đếm được khi nhận lại — nguyên dương, tối đa ${QTY_TOI_DA}, không vượt số đã xuất. Sản phẩm không gửi = nhận lại 0.`,
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(QTY_TOI_DA)
  qty!: number;
}

/**
 * Body of `POST /stock-vouchers/:id/return`. Carries NO `unitCost`: the server takes the origin
 * stock-out line's cost; a client-sent `unitCost` is stripped by the global `whitelist`.
 */
export class CreateReturnVoucherRequestDto {
  @ApiPropertyOptional({
    description: 'Ghi chú (vd tình trạng hàng nhận lại). Tối đa 500 ký tự.',
    example: '2 tấm nứt kính',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    type: [ReturnVoucherLineRequestDto],
    description:
      'Từ 1 đến 100 dòng; không lặp sản phẩm (DUPLICATE_PRODUCT), chỉ sản phẩm có trên phiếu gốc.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReturnVoucherLineRequestDto)
  lines!: ReturnVoucherLineRequestDto[];
}
