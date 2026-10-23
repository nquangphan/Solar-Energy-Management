import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUS_KEYS } from '../../orders/domain/order-status';

/** Number of orders currently in one status. */
export class DashboardStatusCountDto {
  @ApiProperty({ enum: ORDER_STATUS_KEYS, example: ORDER_STATUS_KEYS[0] })
  status!: string;

  @ApiProperty({
    type: 'integer',
    description: 'Số đơn đang ở trạng thái này.',
    example: 12,
  })
  count!: number;
}
