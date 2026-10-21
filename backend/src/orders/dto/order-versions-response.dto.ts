import { ApiProperty } from '@nestjs/swagger';
import type { OrderVersionRow } from '../orders.service';
import {
  OrderVersionItemDto,
  toOrderVersionItemDto,
} from './order-version-item.dto';

/**
 * Response của `GET /orders/:id/versions` — MỌI bản của đơn theo `versionNo` tăng dần.
 *
 * Không phân trang: số bản của một đơn là hữu hạn nhỏ (mỗi lần mở-lại đẻ một bản), và lịch sử
 * đọc theo thứ tự thời gian thì cắt trang là cắt mạch chuyện.
 */
export class OrderVersionsResponseDto {
  @ApiProperty({ type: [OrderVersionItemDto] })
  items!: OrderVersionItemDto[];
}

export function toOrderVersionsResponseDto(
  rows: readonly OrderVersionRow[],
): OrderVersionsResponseDto {
  return { items: rows.map(toOrderVersionItemDto) };
}
