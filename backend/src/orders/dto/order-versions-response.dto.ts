import { ApiProperty } from '@nestjs/swagger';
import { OrderVersionItemDto } from './order-version-item.dto';

/**
 * Response của `GET /orders/:id/phien-ban` — MỌI bản của đơn theo `versionNo` tăng dần.
 *
 * Không phân trang: số bản của một đơn là hữu hạn nhỏ (mỗi lần mở-lại đẻ một bản), và lịch sử
 * đọc theo thứ tự thời gian thì cắt trang là cắt mạch chuyện.
 */
export class OrderVersionsResponseDto {
  @ApiProperty({ type: [OrderVersionItemDto] })
  items!: OrderVersionItemDto[];
}
