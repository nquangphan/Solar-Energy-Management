import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, IsUUID } from 'class-validator';

/**
 * Trần số món trong một gói. Một checklist vật tư thực tế là vài chục dòng; 200 đã rộng rãi.
 *
 * Có trần vì `productIds` đi thẳng vào một `IN (…)` và một `createMany` trong transaction — không
 * trần thì kích cỡ payload tối đa do cấu hình body-parser quyết định một cách TÌNH CỜ, và một ngày
 * ai đó nới giới hạn body lên là lỗi chuyển từ 400 thành lỗi tầng driver.
 */
const MAX_ITEMS_PER_GROUP = 200;

/**
 * Body của `PUT /product-groups/:id/items` — THAY THẾ NGUYÊN KHỐI danh sách món.
 *
 * THỨ TỰ MẢNG LÀ THỨ TỰ HIỆN: server gán `displayOrder = index`. Client KHÔNG gửi số thứ tự —
 * nhờ vậy không có cột `Int` nào client ghi được, nên cũng không cần trần `@Max` ở đây (khác
 * `ProductPrice`, nơi client tự gõ `minQty`).
 *
 * KHÔNG `@ArrayNotEmpty()`: mảng rỗng là HỢP LỆ và có nghĩa rõ ràng — "gói này chưa có món nào"
 * (trạng thái của mọi gói vừa tạo) hoặc "gỡ sạch checklist". Cấm mảng rỗng sẽ khiến người dùng
 * không có cách nào làm rỗng một gói.
 *
 * `@IsUUID('4', { each: true })` chặn phần tử không phải uuid ngay ở pipe; id không TỒN TẠI thì
 * service chặn (400 + `fieldErrors`), và id TRÙNG NHAU trong cùng payload cũng vậy — cả hai đều
 * phải bị bắt TRƯỚC khi vào `$transaction`.
 */
export class ReplaceProductGroupItemsRequestDto {
  @ApiProperty({
    type: [String],
    maxItems: MAX_ITEMS_PER_GROUP,
    description:
      'Danh sách sản phẩm con MỚI, thay thế toàn bộ danh sách cũ. THỨ TỰ MẢNG là thứ tự hiện trên checklist. Mảng rỗng = gói không có món nào (hợp lệ).',
    example: [
      '3b1f0c9a-5d2e-4a7b-8c6d-9e0f1a2b3c4d',
      '7e6d5c4b-3a2f-4b1e-9d8c-0a1b2c3d4e5f',
    ],
  })
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS_PER_GROUP)
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  productIds!: string[];
}
