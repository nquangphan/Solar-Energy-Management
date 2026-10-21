import { ApiProperty } from '@nestjs/swagger';

/** Metadata MỘT file đã xuất — bytes KHÔNG nằm trong response này (tải qua 2 route proxy). */
export class QuoteExportFileDto {
  @ApiProperty({
    type: String,
    description: 'Tên file gợi ý khi tải/share (vd `bao-gia-1a2b3c4d.png`).',
  })
  fileName!: string;

  @ApiProperty({ type: Number, description: 'Kích thước file — byte.' })
  size!: number;
}

/**
 * Response của `POST /orders/{id}/export-quote` — metadata bộ file MỚI NHẤT của Đơn
 * (AD-3: DB/response chỉ metadata, bytes sống ở R2 và tải qua
 * `GET /orders/{id}/quote/image|pdf`).
 */
export class QuoteExportResponseDto {
  @ApiProperty({ type: String, description: 'Id Đơn.' })
  orderId!: string;

  @ApiProperty({
    type: String,
    description: 'Bản hiệu lực lúc xuất — hồ sơ "xuất từ bản nào".',
  })
  orderVersionId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Thời điểm xuất (ISO-8601 UTC).',
  })
  exportedAt!: Date;

  @ApiProperty({ type: QuoteExportFileDto, description: 'File ảnh PNG.' })
  image!: QuoteExportFileDto;

  @ApiProperty({ type: QuoteExportFileDto, description: 'File PDF.' })
  pdf!: QuoteExportFileDto;
}
