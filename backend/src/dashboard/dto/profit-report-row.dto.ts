import { ApiProperty } from '@nestjs/swagger';
import { ProfitFiguresDto } from './profit-figures.dto';

/** One row of the profit report: one order, month, assignee or customer source. */
export class ProfitReportRowDto extends ProfitFiguresDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Khoá nhóm: mã đơn | YYYY-MM | mã account người phụ trách (null = đơn chưa giao) | mã nguồn khách.',
    example: '0b7f1f6e-1d7a-4c1e-9a4a-6a5e2f0c1b33',
  })
  key!: string | null;

  @ApiProperty({
    description:
      'Nhãn hàng do server dựng: số báo giá BG-XXXXXXXX | MM/YYYY | tên người phụ trách hoặc "Chưa giao người phụ trách" | tên nguồn khách.',
    example: 'BG-0B7F1F6E',
  })
  label!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Tên khách — chỉ khi nhóm theo đơn, cách nhóm khác null.',
    example: 'Nguyễn Văn A',
  })
  customerName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Tên người phụ trách — chỉ khi nhóm theo đơn; null khi đơn chưa giao hoặc cách nhóm khác.',
    example: 'Trần Thị B',
  })
  assigneeDisplayName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Tên nguồn khách — chỉ khi nhóm theo đơn, cách nhóm khác null.',
    example: 'Facebook',
  })
  sourceName!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Thời điểm xuất kho (ISO-8601 UTC) — chỉ khi nhóm theo đơn, cách nhóm khác null.',
  })
  issuedAt!: Date | null;
}
