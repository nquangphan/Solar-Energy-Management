import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { LOAI_PHIEU, type LoaiPhieu } from '../domain/gia-von';

/** Query của `GET /stock-vouchers` — lọc theo loại; vắng ⇒ mọi loại. */
export class StockVoucherListQueryDto {
  @ApiPropertyOptional({ enum: LOAI_PHIEU })
  @IsOptional()
  @IsIn(LOAI_PHIEU)
  type?: LoaiPhieu;
}
