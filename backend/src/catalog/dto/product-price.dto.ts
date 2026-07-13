import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Trần của cột `INTEGER` (INT4) trên Postgres. Cả `min_qty` lẫn `price` đều là INTEGER, nên một
 * giá trị vượt trần KHÔNG phải "số to" — nó là một request chắc chắn nổ ở tầng DB (Postgres
 * `22003`) thành 500. Chặn ở DTO để nó thành 400 kèm `fieldErrors`: gõ thừa một số 0 khi nhập
 * giá là chuyện thường ngày, không phải tấn công.
 */
const INT4_MAX = 2_147_483_647;

/**
 * Một mức trong bậc thang giá.
 *
 * `@Min(2)` là BẤT BIẾN NGHIỆP VỤ, không phải một ràng buộc tuỳ tiện: giá gốc `Product.price`
 * CHÍNH LÀ mức `minQty = 1` ngầm định. Cho phép một dòng `minQty = 1` ở đây ⇒ hai nguồn chân
 * lý cho giá gốc, và bất biến "cờ TẮT ⇒ mỗi sản phẩm một giá duy nhất" vỡ ngay.
 *
 * Tiền là `@IsInt()`, CẤM `@IsNumber()` (AD-10): `@IsNumber()` cho `2450000.5` lọt qua rồi
 * vỡ ở cột INTEGER.
 *
 * Cả hai field đều BẮT BUỘC ⇒ validator trần, KHÔNG `@IsOptional()` (lỗi HIGH review 3.1:
 * `@IsOptional()` tha luôn `null`).
 */
export class ProductPriceDto {
  @ApiProperty({
    minimum: 2,
    maximum: INT4_MAX,
    description:
      'Mua TỪ số lượng này trở lên thì ăn mức giá này. Tối thiểu 2 — mức 1 chính là giá gốc của sản phẩm.',
  })
  @IsInt()
  @Min(2)
  @Max(INT4_MAX)
  minQty!: number;

  @ApiProperty({
    maximum: INT4_MAX,
    description: 'Đơn giá ở mức này — số nguyên ĐỒNG.',
  })
  @IsInt()
  @Min(0)
  @Max(INT4_MAX)
  price!: number;
}
