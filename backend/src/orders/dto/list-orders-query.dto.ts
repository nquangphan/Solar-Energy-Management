import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ORDER_STATUS_KEYS } from '../domain/order-status';

/**
 * Query của `GET /orders` — lọc trạng thái + follow-up + phân trang.
 *
 * KHÔNG có tham số phạm vi (`scope`/`mine`/`ownerId`): "xem tất cả đơn" vs "đơn của mình" là
 * QUYỀN, không phải input của client (AD-4, FR-18). Nhận tham số đó từ client = lỗ hổng IDOR —
 * bất kỳ ai cũng đọc được đơn người khác bằng cách đổi một chữ trên URL.
 *
 * `@Type(() => Number)` trên `page`/`pageSize` là BẮT BUỘC: query string luôn tới dưới dạng
 * chuỗi, thiếu bước ép kiểu thì hoặc `@IsInt()` từ chối oan giá trị hợp lệ, hoặc một CHUỖI lọt
 * xuống `skip`/`take` của Prisma. `@Max(100)` cũng bắt buộc — không trần thì một request kéo
 * trọn bảng đơn về.
 */
export class ListOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái đơn. Bỏ trống ⇒ lấy mọi trạng thái.',
    enum: ORDER_STATUS_KEYS,
    example: ORDER_STATUS_KEYS[0],
  })
  @IsOptional()
  @IsIn(ORDER_STATUS_KEYS)
  status?: string;

  @ApiPropertyOptional({
    description:
      "Chỉ lấy đơn CHƯA CHỐT để follow-up (trạng thái 'baogia', FR-10). Không dùng chung với `status`.",
    example: true,
  })
  @IsOptional()
  // Query string đưa `?followUp=true` tới dưới dạng CHUỖI 'true'. Ép đúng hai chuỗi hợp lệ,
  // giá trị khác để nguyên cho `@IsBoolean()` từ chối — `Boolean(value)` sẽ biến 'false'
  // thành true, tức bật bộ lọc mà người dùng vừa tắt.
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as unknown;
  })
  @IsBoolean()
  followUp?: boolean;

  @ApiPropertyOptional({
    description: 'Trang, bắt đầu từ 1.',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Số bản ghi mỗi trang — tối đa 100.',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
