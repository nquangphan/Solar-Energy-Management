import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { CUST_TYPE, CUST_TYPES } from '../domain/customer-type';

/**
 * Query của `GET /customers` — tìm kiếm + lọc + phân trang.
 *
 * `@Type(() => Number)` là BẮT BUỘC cho `page`/`pageSize`: query string luôn tới dưới dạng chuỗi,
 * và thiếu bước ép kiểu thì `@IsInt()` từ chối oan mọi giá trị hợp lệ (hoặc tệ hơn — một chuỗi
 * lọt xuống `skip`/`take` của Prisma).
 *
 * `pageSize` có TRẦN TRÊN (bài học "thiếu trần" của 3.2): không có `@Max`, một `pageSize=99999999`
 * kéo trọn danh bạ khách về trong một request.
 */
export class ListCustomersQueryDto {
  @ApiPropertyOptional({
    description:
      'Tìm theo TÊN hoặc SĐT. SĐT gõ ở dạng người dùng quen (`0903`) — backend tự dựng chuỗi tra tương ứng với PK E.164.',
    example: '0903',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo loại khách. Bỏ trống ⇒ lấy cả hai loại.',
    enum: CUST_TYPES,
    example: CUST_TYPE.caNhan,
  })
  @IsOptional()
  @IsIn(CUST_TYPES)
  custType?: string;

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
