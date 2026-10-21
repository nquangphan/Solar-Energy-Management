import { ApiProperty } from '@nestjs/swagger';
import type { InvoiceDetailView } from '../invoice-document.service';
import { InvoiceLineDto } from './invoice-line.dto';
import { InvoicePdfResponseDto } from './invoice-pdf-response.dto';
import { InvoiceResponseDto } from './invoice-response.dto';
import { InvoiceSellerDto } from './invoice-seller.dto';

/**
 * One invoice in full, read from the snapshot stored at issue time — never from the live order,
 * customer or settings. Only for OpenAPI — the service returns plain objects.
 */
export class InvoiceDetailResponseDto extends InvoiceResponseDto {
  @ApiProperty({ description: 'Đơn mà hoá đơn gắn vào.' })
  orderId!: string;

  @ApiProperty({
    description:
      'Số báo giá của đơn ("Gắn đơn") — cùng số in trên báo giá và hợp đồng.',
    example: 'BG-3F2A9B1C',
  })
  quoteNo!: string;

  @ApiProperty({
    description: 'SĐT khách (E.164) chụp lúc lập.',
    example: '+84901234567',
  })
  customerPhone!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Địa chỉ khách chụp lúc lập; null khi không có.',
  })
  customerAddress!: string | null;

  @ApiProperty({ type: InvoiceSellerDto })
  seller!: InvoiceSellerDto;

  @ApiProperty({
    type: [InvoiceLineDto],
    description: 'Các dòng của hoá đơn theo thứ tự hiển thị.',
  })
  lines!: InvoiceLineDto[];

  @ApiProperty({
    type: InvoicePdfResponseDto,
    nullable: true,
    description: 'File PDF đã xuất; null khi chưa xuất.',
  })
  pdf!: InvoicePdfResponseDto | null;
}

/**
 * Maps the detail view (snapshot column names) to the contract. There is no serializer in the
 * app, so the returned object IS the JSON body — top-level fields are listed (no spread).
 */
export function toInvoiceDetailResponseDto(
  view: InvoiceDetailView,
): InvoiceDetailResponseDto {
  return {
    id: view.id,
    invoiceNo: view.invoiceNo,
    versionNo: view.versionNo,
    issuedAt: view.issuedAt,
    customerName: view.customerName,
    customerTaxCode: view.customerTaxCode,
    vatRate: view.vatRate,
    applyVat: view.applyVat,
    subtotal: view.subtotal,
    discountAmount: view.discountAmount,
    vatAmount: view.vatAmount,
    total: view.total,
    lineCount: view.lineCount,
    orderId: view.orderId,
    quoteNo: view.quoteNo,
    customerPhone: view.customerSdt,
    customerAddress: view.customerAddress,
    seller: view.seller,
    lines: view.lines,
    pdf: view.pdf,
  };
}
