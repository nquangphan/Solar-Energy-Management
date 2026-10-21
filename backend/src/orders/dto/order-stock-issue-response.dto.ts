import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockVoucherDetailDto } from '../../inventory/dto/stock-voucher-response.dto';

/**
 * Responses of `/orders/:id/stock-issue` — only so OpenAPI has a real schema (AD-12); the
 * service returns plain objects. Every flag (`issued`, `canIssue`) and the line order are
 * computed by the BACKEND — the client only renders them and NEVER compares `qty` with
 * `onHand`.
 *
 * The preview carries NO `Product.costPrice` and no money. The issued voucher's line cost
 * (`voucher.lines[].unitCost`) is present only when the caller holds `costs.view`.
 */
export class OrderStockIssueLineDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ description: 'Product name.' })
  name!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ description: 'Unit of measure.', example: 'tấm' })
  unit!: string;

  @ApiProperty({
    description:
      'Quantity the order needs — sum of the current-version lines of this product.',
    example: 16,
  })
  qty!: number;

  @ApiProperty({
    description:
      'Real on-hand right now (unlocked read — for counting against only). No stock record ⇒ 0.',
    example: 40,
  })
  onHand!: number;
}

export class OrderStockIssueViewDto {
  @ApiProperty({
    description:
      'The order already has its stock-out (one order, one voucher).',
  })
  issued!: boolean;

  @ApiPropertyOptional({
    type: StockVoucherDetailDto,
    description:
      'The order stock-out — present ONLY when `issued`; not issued ⇒ the field is absent.',
  })
  voucher?: StockVoucherDetailDto;

  @ApiProperty({
    description:
      'Backend-computed: not issued ∧ status allows a standalone issue (confirmed / deposit paid / in delivery / installing / acceptance) ∧ has stock-tracked lines ∧ caller holds inventory.manage.',
  })
  canIssue!: boolean;

  @ApiProperty({
    type: [OrderStockIssueLineDto],
    description:
      'Lines that will be on the voucher, in canonical order (`fieldErrors` index `lines.{i}.qty` follows it). Empty once issued.',
  })
  lines!: OrderStockIssueLineDto[];

  @ApiProperty({
    type: [String],
    description:
      'Names of lines that are not stock-tracked (installation, fees, free-text…) — not on the voucher. Empty once issued.',
  })
  untrackedItems!: string[];
}

export class OrderStockIssueResultDto {
  @ApiProperty({
    type: StockVoucherDetailDto,
    description:
      'The order stock-out — just created (201) or already existing (200). `lines[].unitCost` only with costs.view.',
  })
  voucher!: StockVoucherDetailDto;
}
