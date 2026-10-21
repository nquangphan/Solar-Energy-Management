import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { LOAI_PHIEU, type LoaiPhieu } from '../domain/gia-von';

/** Query của `GET /stock-vouchers` — lọc theo loại; vắng ⇒ mọi loại. */
export class StockVoucherListQueryDto {
  @ApiPropertyOptional({ enum: LOAI_PHIEU })
  @IsOptional()
  @IsIn(LOAI_PHIEU)
  type?: LoaiPhieu;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'true ⇒ chỉ phiếu nhập trả; false ⇒ không có phiếu nhập trả; vắng ⇒ mọi phiếu.',
  })
  @IsOptional()
  // `@Type(() => Boolean)` would turn the string 'false' into true.
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : (value as unknown),
  )
  @IsBoolean()
  isReturn?: boolean;
}
