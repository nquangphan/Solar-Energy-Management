import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUS_KEYS } from '../domain/order-status';

/**
 * Một nấc của stepper vòng đời.
 *
 * KHÔNG có nhãn tiếng Việt: nhãn đã sống ở `STATUS_LABELS` (web) / `kStatusLabels` (mobile) và
 * bị parity-guard canh byte-for-byte. Một bảng nhãn thứ ba ở backend là ba nguồn phải đồng bộ
 * bằng tay — nhãn vốn là chuyện hiển thị.
 */
export class OrderLifecycleStepDto {
  @ApiProperty({ enum: ORDER_STATUS_KEYS, example: ORDER_STATUS_KEYS[0] })
  status!: string;

  @ApiProperty({
    enum: ['done', 'current', 'upcoming'],
    description: 'Đơn đã qua bước này / đang đứng ở đây / sắp tới.',
  })
  trangThai!: 'done' | 'current' | 'upcoming';
}

/**
 * Response của `GET /orders/:id/vong-doi` — chuỗi bước ĐÃ GATE theo cờ phạm vi của đơn.
 *
 * Bước bị cờ chặn KHÔNG có trong mảng này (UX-DR-11: ẩn hẳn, không vẽ mờ) — client không lọc
 * gì thêm, và KHÔNG được tự suy bước từ cờ (AD-2: chuỗi bước là business logic của backend).
 */
export class OrderLifecycleResponseDto {
  @ApiProperty({ type: [OrderLifecycleStepDto] })
  buoc!: OrderLifecycleStepDto[];
}
