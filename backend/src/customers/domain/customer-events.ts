import type { DomainEvent } from '../../events/domain-event';

/**
 * Domain event của Khách hàng (mirror `catalog/domain/product-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `CustomersService` publish qua `EventBus` port SAU
 * khi write commit; `AuditSubscriber` ghi `AuditLog` — producer KHÔNG gọi thẳng consumer nào
 * (AD-18).
 *
 * `target.id` là **SĐT đã chuẩn hoá** — đúng khoá chính của bản ghi, nên nhật ký tra ngược
 * được. KHÔNG dùng SĐT thô người dùng gõ: hai dạng thô của cùng một số sẽ thành hai `target.id`
 * khác nhau và audit trail vỡ làm đôi.
 */

/** Ảnh chụp một khách hàng tại một thời điểm — kiểu domain thuần, KHÔNG dùng type của Prisma. */
export interface CustomerSnapshot {
  readonly sdt: string;
  readonly custType: string;
  readonly name: string;
  readonly cccd: string | null;
  readonly taxCode: string | null;
  readonly address: string | null;
  readonly bankAccount: string | null;
  readonly sourceId: string;
  readonly sourceNote: string | null;
}

/** Khách hàng mới được tạo — không có trạng thái "trước". */
export class CustomerCreated implements DomainEvent {
  readonly type = 'CustomerCreated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: CustomerSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Customer', id: after.sdt };
  }
}

/** Khách hàng được sửa — mang cả trước và sau (SĐT bất biến nên `before.sdt === after.sdt`). */
export class CustomerUpdated implements DomainEvent {
  readonly type = 'CustomerUpdated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: CustomerSnapshot,
    readonly after: CustomerSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Customer', id: after.sdt };
  }
}
