import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUS_KEYS } from '../domain/order-status';

/**
 * Response của `POST /orders/:id/chuyen-trang-thai` (Story 5.5).
 *
 * KHÔNG trả metadata từng ảnh: danh sách/gallery ảnh là FR-24 → Story 5.6. Ở đây chỉ cần
 * khẳng định đơn đã tới đâu và bao nhiêu ảnh đã ghi cho bước vừa rồi.
 */
export class StatusChangeResponseDto {
  @ApiProperty({
    enum: ORDER_STATUS_KEYS,
    description: 'Trạng thái đơn SAU khi chuyển — đích đến do bảng transition quyết.',
  })
  status!: string;

  @ApiProperty({
    description:
      'Thời điểm của bước (ISO-8601 UTC). CÙNG một giá trị với `occurredAt` của hàng audit và của mọi ảnh trong lượt — đây là khoá nối ảnh vào bước (FR-23).',
  })
  occurredAt!: string;

  @ApiProperty({
    description: 'Số ảnh bằng chứng đã ghi cho bước này (0 là hợp lệ — upload luôn optional).',
    example: 0,
  })
  soAnhDaLuu!: number;
}
