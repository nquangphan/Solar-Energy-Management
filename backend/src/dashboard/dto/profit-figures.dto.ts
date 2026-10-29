import { ApiProperty } from '@nestjs/swagger';

/** Revenue, cost, gross profit and margin of a set of issued orders — all computed server-side. */
export class ProfitFiguresDto {
  @ApiProperty({
    type: 'integer',
    description:
      'Doanh thu = Σ(giá bán chốt × số lượng) − chiết khấu đã duyệt, trước VAT — số nguyên đồng.',
    example: 345_000_000,
  })
  revenue!: number;

  @ApiProperty({
    type: 'integer',
    description:
      'Giá vốn = Σ(giá vốn đóng băng lúc xuất kho × số lượng) — số nguyên đồng.',
    example: 262_000_000,
  })
  cost!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Lợi nhuận gộp = doanh thu − giá vốn — số nguyên đồng.',
    example: 83_000_000,
  })
  grossProfit!: number;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Biên lợi nhuận gộp, phần trăm nguyên làm tròn nửa lên (có thể âm); null khi doanh thu ≤ 0.',
    example: 24,
  })
  marginPct!: number | null;

  @ApiProperty({
    type: 'integer',
    description: 'Số đơn đã xuất kho được tính.',
    example: 12,
  })
  orderCount!: number;
}
