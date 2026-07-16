import { ApiProperty } from '@nestjs/swagger';

/**
 * Response của `POST /orders/preview-total` — 3 số integer ĐỒNG do backend tính bằng hàm
 * pricing duy nhất `computeOrderTotals()` (AD-16): client CHỈ HIỂN THỊ, cấm làm số học
 * tiền. Non-nullable cả 3 — không dính bẫy nullable-union codegen.
 */
export class PreviewTotalResponseDto {
  @ApiProperty({ type: Number, description: 'Tổng trước VAT — integer đồng.' })
  subtotal!: number;

  @ApiProperty({
    type: Number,
    description: 'Tiền VAT — integer đồng, round-half-up một điểm.',
  })
  vatAmount!: number;

  @ApiProperty({ type: Number, description: 'Tổng sau VAT — integer đồng.' })
  total!: number;
}
