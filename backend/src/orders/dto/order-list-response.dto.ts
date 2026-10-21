import { ApiProperty } from '@nestjs/swagger';
import type { OrderListRow } from '../orders.service';
import { OrderListItemDto, toOrderListItemDto } from './order-list-item.dto';

/**
 * Response của `GET /orders` — ENVELOPE phân trang, không phải mảng trần.
 *
 * `total` là TỔNG số đơn khớp bộ lọc VÀ đã thu hẹp theo quyền của người gọi, không phải độ dài
 * trang hiện tại: đếm nhầm thành `items.length` sẽ vẽ ra một sổ đơn chỉ có đúng một trang và
 * những đơn còn lại biến mất khỏi giao diện. `items` và `total` đọc trên CÙNG một ảnh chụp
 * (`$transaction`) để hai con số không lệch nhau.
 */
export class OrderListResponseDto {
  @ApiProperty({ type: [OrderListItemDto] })
  items!: OrderListItemDto[];

  @ApiProperty({
    description:
      'Tổng số đơn khớp bộ lọc và trong phạm vi quyền (KHÔNG phải số dòng của trang này).',
    example: 57,
  })
  total!: number;

  @ApiProperty({ description: 'Trang hiện tại (bắt đầu từ 1).', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Số bản ghi mỗi trang.', example: 20 })
  pageSize!: number;
}

export function toOrderListResponseDto(view: {
  items: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
}): OrderListResponseDto {
  return {
    items: view.items.map(toOrderListItemDto),
    total: view.total,
    page: view.page,
    pageSize: view.pageSize,
  };
}
