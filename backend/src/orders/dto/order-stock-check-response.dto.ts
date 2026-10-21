import { ApiProperty } from '@nestjs/swagger';

/**
 * Response of `GET /orders/:id/stock-check` — only so OpenAPI has a real schema (AD-12); the
 * service returns plain objects. Early stock warning of the quote screen: every figure and the
 * `status` are computed by the BACKEND — the client picks its wording from `status` and never
 * compares or subtracts stock figures itself. A warning only: confirming is never blocked.
 *
 * No money and no cost.
 */
export class OrderStockCheckLineDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'Product name.' })
  name!: string;

  @ApiProperty({ description: 'Unit of measure.', example: 'tấm' })
  unit!: string;

  @ApiProperty({
    description:
      'Quantity the order needs — sum of the current-version lines of this product.',
    example: 16,
  })
  qty!: number;

  @ApiProperty({
    description: 'Real on-hand now. No stock record ⇒ 0.',
    example: 40,
  })
  onHand!: number;

  @ApiProperty({
    description:
      'Promised to OTHER orders (ledger sum) — what this order itself holds is excluded.',
    example: 0,
  })
  reserved!: number;

  @ApiProperty({
    description: '`onHand − reserved` — may be negative.',
    example: 40,
  })
  available!: number;

  @ApiProperty({
    description: 'Units of `qty` beyond `available` (≥ 0) — what to bring in.',
    example: 0,
  })
  shortfall!: number;

  @ApiProperty({
    enum: ['enough', 'short'],
    description: '`short` ⇔ `shortfall > 0`.',
  })
  status!: 'enough' | 'short';
}

export class OrderStockCheckDto {
  @ApiProperty({
    type: [OrderStockCheckLineDto],
    description:
      'One entry per stock-tracked product of the current version (same-product lines merged), ordered by name then productId. Free-text lines and products that do not track stock are absent. Empty once the stock of the current version has been issued.',
  })
  lines!: OrderStockCheckLineDto[];
}
