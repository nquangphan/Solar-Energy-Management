import type { DomainEvent } from '../../events/domain-event';

/**
 * Domain event của danh mục vật tư (mirror `accounts/domain/account-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `ProductsService` publish qua `EventBus` port
 * SAU khi write commit; `AuditSubscriber` ghi `AuditLog` — producer KHÔNG gọi thẳng
 * consumer nào (AD-18).
 *
 * `before`/`after` mang snapshot ĐẦY ĐỦ, kể cả `costPrice`: audit ghi SỰ THẬT, không lọc
 * theo quyền của người xem. Việc che giá vốn là chuyện của tầng response
 * (`stripCostPrice`), KHÔNG phải của nhật ký. Snapshot chỉ chứa dữ liệu danh mục —
 * không secret nào ở đây (khác `Account`, nên không có luật "chỉ id" như 2.4).
 */

/** Ảnh chụp một sản phẩm tại một thời điểm — kiểu domain thuần, KHÔNG dùng type của Prisma. */
export interface ProductSnapshot {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly unit: string;
  readonly price: number;
  readonly costPrice: number;
  readonly tracksStock: boolean;
  readonly priceEditable: boolean;
  readonly warrantyMonths: number | null;
  readonly isActive: boolean;
}

/** Sản phẩm mới được tạo — không có trạng thái "trước". */
export class ProductCreated implements DomainEvent {
  readonly type = 'ProductCreated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: ProductSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Product', id: after.id };
  }
}

/** Sản phẩm được sửa (gồm cả sửa giá bán/giá vốn) — mang cả trước và sau. */
export class ProductUpdated implements DomainEvent {
  readonly type = 'ProductUpdated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: ProductSnapshot,
    readonly after: ProductSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Product', id: after.id };
  }
}

/**
 * Sản phẩm bị ẩn khỏi danh mục (`isActive = false`). Tên event nói SOFT-delete, không
 * phải `ProductDeleted` — dòng đơn/tồn kho lịch sử vẫn trỏ vào bản ghi này.
 */
export class ProductDeactivated implements DomainEvent {
  readonly type = 'ProductDeactivated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: ProductSnapshot,
    readonly after: ProductSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Product', id: after.id };
  }
}
