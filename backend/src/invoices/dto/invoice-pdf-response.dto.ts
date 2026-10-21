import { ApiProperty } from '@nestjs/swagger';

/** The stored PDF of an invoice — rendered once, returned unchanged by every later export. */
export class InvoicePdfResponseDto {
  @ApiProperty({
    description: 'Tên file tải về (ASCII, có đuôi .pdf).',
    example: 'hoa-don-HD-2026-0731.pdf',
  })
  fileName!: string;

  @ApiProperty({ description: 'Kích thước file — byte.', example: 48_213 })
  pdfSize!: number;

  @ApiProperty({ description: 'Lúc xuất PDF lần đầu (ISO-8601 UTC).' })
  exportedAt!: Date;
}
