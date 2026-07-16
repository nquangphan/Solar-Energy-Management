import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsOptionalNotNull } from '../../catalog/dto/is-optional-not-null.decorator';
import { VAT_MODES } from '../domain/vat-mode';

/**
 * Body của `POST /orders/preview-total` — STATELESS (AD-16): client gửi CHÍNH các dòng
 * đang hiển thị (unitPrice là giá backend đã trả qua `GET /orders/:id`, client chỉ echo
 * lại — không có phép tính nào ở client), KHÔNG gửi orderId, KHÔNG gửi vatRate/applyVat
 * (backend resolve — Story 4.4 mở rộng chỗ resolve, có thể thêm field additive).
 *
 * Nested-array validation cần ĐỦ BỘ `@IsArray` + `@ValidateNested({each})` +
 * `@Type(() => ...)` — thiếu `@Type` là class-transformer không instantiate phần tử và
 * validator im lặng cho qua (ValidationPipe đã `transform: true`).
 */
export class PreviewTotalLineDto {
  @ApiProperty({
    description: 'Đơn giá — số nguyên ĐỒNG, echo từ số backend đã trả.',
    example: 2_450_000,
  })
  @IsInt()
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ description: 'Số lượng — nguyên, tối thiểu 1.', example: 8 })
  @IsInt()
  @Min(1)
  qty!: number;
}

export class PreviewTotalRequestDto {
  @ApiProperty({
    type: [PreviewTotalLineDto],
    description:
      'Các dòng giỏ hàng đang hiển thị. Mảng RỖNG hợp lệ (giỏ vừa xoá sạch ⇒ tổng 0). Tối đa 500 dòng.',
  })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PreviewTotalLineDto)
  lines!: PreviewTotalLineDto[];

  @ApiPropertyOptional({
    enum: [...VAT_MODES],
    description:
      "Tick áp VAT — client ECHO từ `Order.vatMode` (như đã echo unitPrice), KHÔNG BAO GIỜ gửi rate. Vắng field = đơn cũ vatMode null ⇒ tính như có VAT.",
  })
  @IsOptionalNotNull()
  @IsIn(VAT_MODES)
  vatMode?: string;
}
