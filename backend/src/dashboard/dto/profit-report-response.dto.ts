import { ApiProperty } from '@nestjs/swagger';
import { PROFIT_GROUP_BY, type ProfitGroupBy } from '../domain/profit-report';
import { ProfitFiguresDto } from './profit-figures.dto';
import { ProfitReportRowDto } from './profit-report-row.dto';

/**
 * Gross profit on materials (FR-37) of the orders issued in the period, company-wide. Only orders
 * with a stock-issue voucher that are not cancelled count. `rows` adds up to `totals`.
 */
export class ProfitReportResponseDto {
  @ApiProperty({
    enum: PROFIT_GROUP_BY,
    enumName: 'ProfitGroupBy',
    example: 'order',
  })
  groupBy!: ProfitGroupBy;

  @ApiProperty({
    description: 'Ngày đầu kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.',
    example: '2026-10-01',
  })
  from!: string;

  @ApiProperty({
    description: 'Ngày cuối kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.',
    example: '2026-10-30',
  })
  to!: string;

  @ApiProperty({ type: ProfitFiguresDto })
  totals!: ProfitFiguresDto;

  @ApiProperty({ type: [ProfitReportRowDto] })
  rows!: ProfitReportRowDto[];
}
