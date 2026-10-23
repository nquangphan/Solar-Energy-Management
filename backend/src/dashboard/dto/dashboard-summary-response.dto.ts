import { ApiProperty } from '@nestjs/swagger';
import { DASHBOARD_PERIODS } from '../domain/dashboard-period';
import { DashboardStatusCountDto } from './dashboard-status-count.dto';

/**
 * Operations dashboard for one period. Every block is computed by the server and is `null` when
 * the caller lacks the permission behind it — the number is never sent, not merely hidden.
 */
export class DashboardSummaryResponseDto {
  @ApiProperty({ enum: DASHBOARD_PERIODS, example: 'month' })
  period!: string;

  @ApiProperty({
    description: 'Ngày đầu kỳ (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.',
    example: '2026-10-01',
  })
  from!: string;

  @ApiProperty({
    description:
      'Ngày cuối kỳ = hôm nay (giờ Việt Nam), YYYY-MM-DD, tính cả ngày này.',
    example: '2026-10-23',
  })
  to!: string;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Tổng tiền đã thu trong kỳ (theo ngày thu) của toàn công ty — số nguyên đồng. null khi thiếu quyền dashboard.finance_view.',
    example: 1_240_000_000,
  })
  revenue!: number | null;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    description:
      'Số đơn tạo trong kỳ, trong phạm vi xem đơn của người gọi. null khi thiếu cả orders.view_all lẫn orders.view_own.',
    example: 37,
  })
  newOrderCount!: number | null;

  @ApiProperty({
    type: [DashboardStatusCountDto],
    nullable: true,
    description:
      'Số đơn hiện tại theo từng trạng thái (không lọc theo kỳ), đủ mọi trạng thái theo thứ tự quy trình, trong phạm vi xem đơn của người gọi. null khi thiếu cả orders.view_all lẫn orders.view_own.',
  })
  ordersByStatus!: DashboardStatusCountDto[] | null;
}
