import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Query của `GET /stock-items` — tìm theo tên/SKU + lọc theo danh sách sản phẩm.
 *
 * `productIds` tới dưới dạng chuỗi CSV (`?productIds=a,b`), hoặc lặp tham số
 * (`?productIds=a&productIds=b,c` ⇒ Express trả mảng) — gộp + tách ở đây rồi validate từng
 * phần tử là UUID: một id rác lọt xuống `id: { in }` của Prisma không lỗi, nó chỉ âm thầm trả
 * thiếu dòng, và màn báo giá sẽ hiểu là "sản phẩm này không có tồn".
 */
export class StockListQueryDto {
  @ApiPropertyOptional({
    description:
      'Tìm theo TÊN hoặc SKU (chứa chuỗi, không phân biệt hoa thường).',
    example: 'inverter',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description:
      'Chỉ lấy các sản phẩm này — danh sách UUID ngăn cách bằng dấu phẩy.',
    type: String,
    example:
      '3f1c9d2e-8b7a-4c6d-9e5f-1a2b3c4d5e6f,7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' || Array.isArray(value)
      ? [value]
          .flat()
          .flatMap((v) => (typeof v === 'string' ? v.split(',') : [v]))
          .map((id) => (typeof id === 'string' ? id.trim() : (id as unknown)))
          .filter((id) => id !== '')
      : (value as unknown),
  )
  @IsUUID('4', { each: true })
  productIds?: string[];
}
