import { ApiProperty } from '@nestjs/swagger';

/**
 * One created invoice — a snapshot of one order version. Lines are stored for the PDF (7.5) but
 * not returned here. Only for OpenAPI — the service returns plain objects.
 */
export class InvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: 'Số hoá đơn nội bộ — `HD-{năm}-{số thứ tự ≥ 4 chữ số}`.',
    example: 'HD-2026-0731',
  })
  invoiceNo!: string;

  @ApiProperty({
    description: 'Số thứ tự bản đơn (version) được chụp lại.',
    example: 1,
  })
  versionNo!: number;

  @ApiProperty({ description: 'Ngày lập (ISO-8601 UTC).' })
  issuedAt!: Date;

  @ApiProperty({ description: 'Tên khách chụp lúc lập.' })
  customerName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'MST khách chụp lúc lập; null khi khách không có MST.',
    example: '0316552018',
  })
  customerTaxCode!: string | null;

  @ApiProperty({ description: 'Thuế suất VAT (%) chụp lúc lập.', example: 8 })
  vatRate!: number;

  @ApiProperty({ description: 'Có áp VAT hay không, chụp lúc lập.' })
  applyVat!: boolean;

  @ApiProperty({
    description: 'Tổng trước chiết khấu và VAT — số nguyên đồng.',
    example: 76_862_000,
  })
  subtotal!: number;

  @ApiProperty({
    description: 'Chiết khấu đã duyệt — số nguyên đồng (0 khi không có).',
    example: 0,
  })
  discountAmount!: number;

  @ApiProperty({
    description: 'Tiền VAT — số nguyên đồng (0 khi không áp VAT).',
    example: 6_148_960,
  })
  vatAmount!: number;

  @ApiProperty({
    description: 'Tổng thanh toán sau VAT — số nguyên đồng.',
    example: 83_010_960,
  })
  total!: number;

  @ApiProperty({ description: 'Số dòng vật tư trên hoá đơn.', example: 4 })
  lineCount!: number;
}
