import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Một món trên checklist — PROJECTION HẸP của `Product`, KHÔNG phải cả bản ghi.
 *
 * 🔴 KHÔNG CÓ `costPrice`, và đó là ràng buộc AN NINH, không phải sở thích. Giá vốn bị gác sau
 * quyền `costs.view` và bị `stripCostPrice()` lọc khỏi mọi payload của `/products`. Endpoint gói
 * là một CỬA MỚI vào cùng dữ liệu đó: một `include: { product: true }` hồn nhiên trong service sẽ
 * trả nguyên bản ghi `Product` — kèm giá vốn — cho bất kỳ ai có `catalog.manage`, đi vòng qua
 * toàn bộ hàng rào ấy. Vì vậy service `select` tường minh từng cột, và danh sách cột nằm ngay
 * đây.
 *
 * Gói KHÔNG cần giá vốn cho việc gì cả ⇒ không lấy về thì không phải lọc. (Nếu sau này cần lãi
 * gộp theo gói, đó là một story riêng và phải đi qua `costs.view` tử tế.)
 *
 * `isActive` của sản phẩm CÓ mặt: một sản phẩm có thể bị tắt SAU khi đã nằm trong gói, nên picker
 * buộc phải biết làm mờ / bỏ tick món đó. Trả cờ ra để nó tự xử.
 */
export class ProductGroupItemResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 'Tấm pin JA Solar 580W' })
  name!: string;

  @ApiProperty({ example: 'JAS-580-M10' })
  sku!: string;

  @ApiProperty({ example: 'tấm' })
  unit!: string;

  @ApiProperty({ description: 'Giá bán — số nguyên ĐỒNG.', example: 2_450_000 })
  price!: number;

  @ApiProperty({
    description:
      'false = sản phẩm đã ẩn khỏi danh mục. Món vẫn nằm trong gói (nó bị tắt SAU khi được thêm) — picker phải làm mờ / bỏ tick.',
  })
  isActive!: boolean;

  @ApiProperty({ description: 'Thứ tự hiện trên checklist (server gán).' })
  displayOrder!: number;
}

/**
 * Response của `GET /product-groups/:id` — gói KÈM checklist. Đây là endpoint mà picker báo giá
 * sẽ gọi.
 *
 * KHÔNG có `total`/`subtotal`: gói không có giá trọn gói, và tiền do backend tính ở đường báo giá
 * (client CẤM làm số học tiền — AD-16). Số lượng cũng không có ở đây: người dùng tự gõ lúc tick.
 */
export class ProductGroupDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Gói Hybrid 8kW' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'false = gói đã rút khỏi picker (soft-delete).' })
  isActive!: boolean;

  @ApiProperty({
    type: [ProductGroupItemResponseDto],
    description:
      'Các món trong gói, sắp theo displayOrder tăng dần. Rỗng = gói chưa có món nào (hợp lệ).',
  })
  items!: ProductGroupItemResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
