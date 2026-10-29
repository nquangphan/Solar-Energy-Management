import { ApiProperty } from '@nestjs/swagger';
import { AuditLogEntryDto } from './audit-log-entry.dto';

/** Response of `GET /audit-logs` — a paging envelope; `items` and `total` share one snapshot. */
export class AuditLogListResponseDto {
  @ApiProperty({ type: [AuditLogEntryDto] })
  items!: AuditLogEntryDto[];

  @ApiProperty({
    description:
      'Tổng số bản ghi khớp bộ lọc (KHÔNG phải số dòng của trang này).',
    example: 57,
  })
  total!: number;

  @ApiProperty({ description: 'Trang hiện tại (bắt đầu từ 1).', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Số bản ghi mỗi trang.', example: 20 })
  pageSize!: number;
}
