import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
} from '../domain/dashboard-period';

/** Query of `GET /dashboard/summary`: which period ending today (Vietnam time) to summarise. */
export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_PERIODS,
    default: 'month',
    description:
      'Kỳ tính tới hôm nay (giờ Việt Nam): day = hôm nay, week = thứ Hai → hôm nay, month = ngày 1 → hôm nay. Bỏ trống ⇒ month.',
  })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  period?: DashboardPeriod;
}
