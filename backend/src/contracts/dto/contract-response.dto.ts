import { ApiProperty } from '@nestjs/swagger';
import { CONTRACT_TYPES, type ContractType } from '../domain/contract-type';

/**
 * One generated contract. Bytes live in R2 (AD-3) and download through
 * `GET /orders/{id}/contracts/{contractId}/pdf`. Only for OpenAPI — the service returns plain
 * objects.
 */
export class ContractResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description:
      'Số hợp đồng in trong PDF — `HĐTC-{n}/{năm}` hoặc `HĐMB-{n}/{năm}`.',
    example: 'HĐTC-2048/2026',
  })
  contractNo!: string;

  @ApiProperty({
    enum: CONTRACT_TYPES,
    description:
      'construction = HĐ Thi công (đơn có cờ Thi công); sale = HĐ Mua bán (chỉ Thiết bị).',
  })
  contractType!: ContractType;

  @ApiProperty({
    description: 'Số thứ tự bản đơn (version) đã in.',
    example: 1,
  })
  versionNo!: number;

  @ApiProperty({
    description: 'Tên file không đuôi (ASCII); route tải thêm `.pdf`.',
    example: 'hop-dong-thi-cong-2048',
  })
  fileName!: string;

  @ApiProperty({ description: 'Kích thước file PDF (byte).', example: 48213 })
  pdfSize!: number;

  @ApiProperty({ description: 'Thời điểm sinh (ISO-8601 UTC).' })
  createdAt!: Date;
}
