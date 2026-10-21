import { ApiProperty } from '@nestjs/swagger';
import { InvoiceResponseDto } from './invoice-response.dto';

/**
 * What the "Hoá đơn bán hàng" screen shows before creating: the source the invoice will copy,
 * whether the server would create it, and the invoices already created. Every value is
 * computed by the server; clients only display it.
 */
export class InvoicesOverviewResponseDto {
  @ApiProperty({
    description:
      'true ⇒ POST sẽ tạo hoá đơn mới; false ⇒ blockedReason nói vì sao, hoặc bản hiện hành đã có hoá đơn (currentInvoiceId).',
  })
  creatable!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Lý do không tạo được (tiếng Việt, cùng message POST trả); null khi tạo được hoặc khi lý do duy nhất là bản hiện hành đã có hoá đơn.',
  })
  blockedReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Hoá đơn của bản đơn hiện hành, nếu đã lập.',
  })
  currentInvoiceId!: string | null;

  @ApiProperty({
    description: 'Số thứ tự bản đơn hiện hành (0 khi chưa có bản).',
    example: 1,
  })
  versionNo!: number;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'MST khách hiện tại; null khi khách không có MST.',
    example: '0316552018',
  })
  customerTaxCode!: string | null;

  @ApiProperty({ description: 'Số dòng vật tư của bản hiện hành.', example: 4 })
  lineCount!: number;

  @ApiProperty({
    description: 'Tổng đơn sau VAT sẽ ghi vào hoá đơn — số nguyên đồng.',
    example: 83_010_960,
  })
  orderTotal!: number;

  @ApiProperty({
    type: [InvoiceResponseDto],
    description: 'Hoá đơn đã tạo của đơn, mới nhất trước.',
  })
  invoices!: InvoiceResponseDto[];
}
