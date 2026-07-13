import type { DomainEvent } from '../../events/domain-event';
import type { PriceTier } from './price-resolution';

/**
 * Domain event của bậc thang giá (mirror `product-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `ProductPricesService` publish qua `EventBus` port
 * SAU khi write commit; `AuditSubscriber` ghi `AuditLog` (AD-18).
 *
 * `before`/`after` là CẢ BẬC THANG (mảng), không phải một dòng: thao tác nghiệp vụ là "đổi
 * bậc thang giá của sản phẩm này", không phải "sửa một dòng giá". Ghi audit theo từng dòng sẽ
 * khiến người đọc nhật ký phải tự ghép lại các mảnh để hiểu chuyện gì đã xảy ra.
 */
export class ProductPricesReplaced implements DomainEvent {
  readonly type = 'ProductPricesReplaced';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    productId: string,
    readonly before: readonly PriceTier[],
    readonly after: readonly PriceTier[],
    readonly occurredAt: Date,
  ) {
    // Đối tượng bị tác động là SẢN PHẨM (bậc thang không có danh tính nghiệp vụ riêng) —
    // nhờ vậy audit của một sản phẩm gom được cả "sửa giá gốc" lẫn "đổi bậc thang".
    this.target = { type: 'Product', id: productId };
  }
}
