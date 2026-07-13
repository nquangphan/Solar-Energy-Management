import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsObject, ValidateNested } from 'class-validator';
import { ProductPriceDto } from './product-price.dto';

/**
 * Body của `PUT /products/:productId/prices` — THAY THẾ NGUYÊN KHỐI bậc thang.
 *
 * KHÔNG `@ArrayNotEmpty()`: mảng rỗng là HỢP LỆ và có nghĩa rõ ràng — "xoá hết bậc thang,
 * quay về một giá duy nhất". Cấm mảng rỗng sẽ khiến người dùng không có cách nào gỡ bậc thang
 * ra khỏi một sản phẩm.
 *
 * `@Type(() => ProductPriceDto)` là BẮT BUỘC để `@ValidateNested` chạy — thiếu nó,
 * class-validator nhận object thường và mọi ràng buộc bên trong (`@Min(2)`, `@IsInt()`) im
 * lặng không chạy.
 *
 * `@IsObject({ each: true })` cũng BẮT BUỘC: `@ValidateNested` KHÔNG loại một phần tử bản thân
 * nó lại là MẢNG. `{"prices":[[{"minQty":5,"price":1}]]}` lọt qua pipe, `tier.minQty`/`tier.price`
 * thành `undefined`, và `undefined` đi thẳng xuống cột NOT NULL ⇒ 500 thay vì 400. Đây đúng là
 * họ lỗi của review 3.1 (`@IsOptional()` tha `null`), chỉ đổi hình dạng: `null` đã bị chặn,
 * mảng lồng thì chưa.
 */
export class ReplaceProductPricesRequestDto {
  @ApiProperty({
    type: [ProductPriceDto],
    description:
      'Bậc thang MỚI, thay thế toàn bộ bậc thang cũ. Mảng rỗng = xoá hết, quay về một giá.',
  })
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ProductPriceDto)
  prices!: ProductPriceDto[];
}
