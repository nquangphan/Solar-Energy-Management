import type { DomainEvent } from '../../events/domain-event';

/**
 * Domain event của Đơn hàng (mirror `customers/domain/customer-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `OrdersService` publish qua `EventBus` port SAU khi
 * `$transaction` commit; `AuditSubscriber` ghi `AuditLog` — producer KHÔNG gọi thẳng consumer
 * nào (AD-18). FR-20 đòi audit MỌI mutation ⇒ thêm/sửa/xoá DÒNG cũng có event riêng, không
 * chỉ `OrderCreated`.
 *
 * `target.id` là id của **Order** kể cả với event dòng — nhật ký của một đơn tra được trọn vẹn
 * theo một target duy nhất; dòng nào bị đụng nằm trong snapshot before/after.
 */

/** Ảnh chụp một Đơn tại một thời điểm — kiểu domain thuần, KHÔNG dùng type của Prisma. */
export interface OrderSnapshot {
  readonly id: string;
  readonly status: string;
  readonly customerSdt: string;
  readonly currentVersionId: string | null;
  readonly ownerAccountId: string;
  readonly assigneeAccountId: string | null;
  readonly sourceId: string;
  readonly custType: string;
  readonly scopeThietBi: boolean;
  readonly scopeThiCong: boolean;
  readonly scopeVanChuyen: boolean;
  readonly vatMode: string | null;
  readonly kWp: number | null;
  readonly validityNote: string | null;
}

/** Ảnh chụp một Dòng báo giá — đủ mọi field nghiệp vụ (audit ghi sự thật đầy đủ). */
export interface OrderLineSnapshot {
  readonly id: string;
  readonly orderVersionId: string;
  readonly productId: string | null;
  readonly name: string;
  readonly unit: string;
  readonly qty: number;
  readonly unitPrice: number;
  readonly priceEditable: boolean;
  readonly isFlexible: boolean;
  readonly note: string | null;
  readonly warrantyMonths: number | null;
  readonly displayOrder: number;
}

/** Đơn mới được tạo (kèm version 1 rỗng) — không có trạng thái "trước". */
export class OrderCreated implements DomainEvent {
  readonly type = 'OrderCreated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: OrderSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: after.id };
  }
}

/** Một dòng được THÊM vào bản hiệu lực của đơn. */
export class OrderLineAdded implements DomainEvent {
  readonly type = 'OrderLineAdded';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    readonly after: OrderLineSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
  }
}

/** Một dòng bị SỬA — mang cả trước và sau. */
export class OrderLineUpdated implements DomainEvent {
  readonly type = 'OrderLineUpdated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    readonly before: OrderLineSnapshot,
    readonly after: OrderLineSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
  }
}

/** Cờ phạm vi của Đơn bị ĐỔI (toggle Thi công/Vận chuyển, Story 4.3) — mang cả trước và sau. */
export class OrderScopeChanged implements DomainEvent {
  readonly type = 'OrderScopeChanged';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: OrderSnapshot,
    readonly after: OrderSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: after.id };
  }
}

/**
 * Metadata của Đơn bị ĐỔI (tick VAT / công suất kWp / hạn hiệu lực, Story 4.4) — mang cả
 * trước và sau. Tách khỏi `OrderScopeChanged` theo ngữ nghĩa NHÓM field: một PATCH đụng cả
 * cờ phạm vi lẫn metadata publish HAI event, mỗi event đúng nhóm của nó.
 */
export class OrderMetaChanged implements DomainEvent {
  readonly type = 'OrderMetaChanged';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: OrderSnapshot,
    readonly after: OrderSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: after.id };
  }
}

/** Một dòng bị XOÁ — chỉ có trạng thái "trước". */
export class OrderLineRemoved implements DomainEvent {
  readonly type = 'OrderLineRemoved';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    readonly before: OrderLineSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
  }
}
