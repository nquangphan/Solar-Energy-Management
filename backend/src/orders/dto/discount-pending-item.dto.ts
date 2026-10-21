import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Một item của `GET /orders/pending-discount-approvals` (Story 4.7, FR-18/FR-37) — mọi con số do
 * backend tính bằng hàm pricing duy nhất (AD-16), client CHỈ hiển thị.
 *
 * FENCE `costs.view` (FR-37): `estimatedMarginPct` CHỈ có giá trị khi actor có THÊM
 * `costs.view` (margin lộ ngược ra costPrice) — thiếu quyền ⇒ null trên MỌI dòng, response
 * không chứa costPrice dưới bất kỳ dạng nào.
 */
export class DiscountPendingLineDto {
  @ApiProperty({ description: 'Tên dòng báo giá.' })
  name!: string;

  @ApiProperty({ description: 'Số lượng.' })
  qty!: number;

  @ApiProperty({ description: 'Đơn giá HIỆU LỰC hiện tại — integer đồng.' })
  unitPrice!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Biên ƯỚC TÍNH (%) theo Product.costPrice HIỆN HÀNH — integer half-up; null khi dòng tự do, unitPrice = 0, hoặc actor thiếu costs.view (FR-37).',
  })
  estimatedMarginPct!: number | null;
}

export class DiscountPendingItemDto {
  @ApiProperty({ description: 'Id đơn hàng chờ duyệt chiết khấu.' })
  orderId!: string;

  @ApiProperty({ description: 'SĐT khách (E.164).' })
  customerSdt!: string;

  @ApiProperty({ description: 'Mức chiết khấu đề xuất — integer đồng.' })
  amount!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Lý do đề xuất — nullable.',
  })
  requestNote!: string | null;

  @ApiProperty({ description: 'Id người đề xuất.' })
  requestedByAccountId!: string;

  @ApiProperty({ description: 'Tên hiển thị người đề xuất.' })
  requestedByDisplayName!: string;

  @ApiProperty({ description: 'Thời điểm gửi duyệt.' })
  requestedAt!: Date;

  @ApiProperty({
    description: 'Giá gốc (tổng tiền hàng trước chiết khấu) — backend tính.',
  })
  subtotal!: number;

  @ApiProperty({
    description: 'Sau chiết khấu (subtotal − amount) — backend tính.',
  })
  afterDiscount!: number;

  @ApiProperty({
    type: [DiscountPendingLineDto],
    description: 'Dòng của bản hiệu lực kèm biên ước tính per-line.',
  })
  lines!: DiscountPendingLineDto[];
}
