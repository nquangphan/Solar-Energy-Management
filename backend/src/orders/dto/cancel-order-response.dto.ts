import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUS_KEYS } from '../domain/order-status';

/**
 * Response của `POST /orders/:id/huy` (Story 5.7).
 *
 * KHÔNG trả lại lý do vừa gửi: client đã có nó trong tay, và `GET /orders/:id` mới là đường
 * đọc chính tắc của `cancelReason`.
 */
export class CancelOrderResponseDto {
  @ApiProperty({
    enum: ORDER_STATUS_KEYS,
    description: "Trạng thái đơn SAU khi huỷ — luôn 'huy'.",
    example: 'huy',
  })
  status!: string;

  @ApiProperty({
    description:
      'Thời điểm huỷ (ISO-8601 UTC). CÙNG một giá trị với cột `cancelledAt` và với `occurredAt` của hàng audit.',
  })
  occurredAt!: string;
}
