import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';
import {
  PROFIT_GROUP_BY,
  PROFIT_PERIODS,
  type ProfitGroupBy,
  type ProfitPeriod,
} from '../domain/profit-report';

const DATE_FORMAT_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD và là ngày có thật.';

/**
 * Query of `GET /reports/profit`: how to group and which period of issue dates (Vietnam days,
 * both ends inclusive). `from`/`to` belong to the custom period only — the service rejects them
 * with a preset period rather than silently ignoring them.
 */
export class ProfitReportQueryDto {
  @ApiPropertyOptional({
    enum: PROFIT_GROUP_BY,
    enumName: 'ProfitGroupBy',
    default: 'order',
    description:
      'Cách nhóm: order = mỗi đơn một hàng, month = theo tháng xuất kho, assignee = theo người phụ trách, source = theo nguồn khách. Bỏ trống ⇒ order.',
  })
  @IsOptional()
  @IsIn(PROFIT_GROUP_BY)
  groupBy?: ProfitGroupBy;

  @ApiPropertyOptional({
    enum: PROFIT_PERIODS,
    enumName: 'ProfitPeriod',
    default: 'month',
    description:
      'Kỳ theo ngày xuất kho (giờ Việt Nam): month = ngày 1 → hôm nay, year = 01/01 → hôm nay, custom = from → to. Bỏ trống ⇒ month.',
  })
  @IsOptional()
  @IsIn(PROFIT_PERIODS)
  period?: ProfitPeriod;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'Từ ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). Bắt buộc khi period=custom, cấm gửi với kỳ khác.',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: DATE_FORMAT_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_FORMAT_MESSAGE })
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'Đến ngày YYYY-MM-DD (giờ Việt Nam, tính cả ngày này). Bắt buộc khi period=custom, cấm gửi với kỳ khác.',
    example: '2026-07-31',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: DATE_FORMAT_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_FORMAT_MESSAGE })
  to?: string;
}
