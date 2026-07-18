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

/**
 * Đơn được CHỐT (Story 4.5, FR-5) — status baogia → dachot, giá dòng + vatRate/vatMode đã
 * đóng băng bằng snapshot. Mang cả trước và sau; before/after tự nói baogia→dachot. CHỈ publish
 * ở nhánh chốt THẬT — retry idempotent im lặng, không event thứ hai (NFR-1).
 */
export class OrderConfirmed implements DomainEvent {
  readonly type = 'OrderConfirmed';

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
 * Đơn đã chốt được MỞ LẠI để sửa (Story 4.6, FR-6) — status dachot → baogia, version MỚI
 * được tạo và `currentVersionId` repoint sang nó; bản cũ + snapshot cũ giữ nguyên trong lịch
 * sử (AD-6). before/after tự nói version cũ→mới + ai/khi nào (audit FR-6). CHỈ publish ở
 * nhánh mở-lại THẬT — retry idempotent im lặng, không event thứ hai (NFR-1).
 */
export class OrderRevised implements DomainEvent {
  readonly type = 'OrderRevised';

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
 * Chiết khấu được ÁP và gửi duyệt (Story 4.7, FR-18) — status baogia → choduyet. `amount`/
 * `note` nằm trên event cho Epic 9 (push tới người duyệt); `OrderSnapshot` KHÔNG mở rộng —
 * status đổi tự kể chuyện, chi tiết nằm ở row `DiscountApproval`. CHỈ publish ở nhánh áp
 * THẬT sau commit (AD-18) — retry trên đơn đã `choduyet` là 409, không event.
 */
export class DiscountRequested implements DomainEvent {
  readonly type = 'DiscountRequested';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: OrderSnapshot,
    readonly after: OrderSnapshot,
    readonly amount: number,
    readonly note: string | null,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: after.id };
  }
}

/**
 * Chiết khấu được DUYỆT hoặc TỪ CHỐI (Story 4.7, FR-18). `approved` + `reason` cho Epic 9;
 * đồng ý: đơn Ở NGUYÊN `choduyet` (before/after cùng status — Chốt là hành động riêng);
 * từ chối: choduyet → baogia. CHỈ publish ở nhánh resolve THẬT sau commit — retry cùng
 * decision là idempotent-return, không event thứ hai (NFR-1).
 */
export class DiscountResolved implements DomainEvent {
  readonly type = 'DiscountResolved';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: OrderSnapshot,
    readonly after: OrderSnapshot,
    readonly approved: boolean,
    readonly reason: string | null,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: after.id };
  }
}

/**
 * Báo giá được XUẤT ra file PDF + ảnh (Story 4.8, FR-21). KHÔNG mang before/after snapshot:
 * export không đổi `Order.status` — không phải transition, không đụng AD-11; audit chỉ cần
 * "ai xuất gì lúc nào" (`fileName` + bản hiệu lực lúc xuất). Share phía client là hành động
 * OS, không backend call — không audit share.
 */
export class QuoteExported implements DomainEvent {
  readonly type = 'QuoteExported';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    orderId: string,
    readonly orderVersionId: string,
    readonly fileName: string,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Order', id: orderId };
  }
}

/**
 * `Order.status` ĐỔI — vết from→to chính tắc mà AD-11 đòi, phát ra từ CHÍNH nơi duy nhất ghi
 * status. before/after tự kể chuyện from→to; `AuditSubscriber` ghi `AuditLog` (producer
 * KHÔNG gọi audit trực tiếp — AD-18).
 *
 * Event này publish THÊM, KHÔNG thay thế các event nghiệp vụ (`OrderConfirmed`,
 * `OrderRevised`, `DiscountRequested`, `DiscountResolved`): chúng mang payload nghiệp vụ
 * (`amount`, `note`, `approved`, `reason`) mà đường thông báo cần và đã có test khẳng định.
 * Hệ quả tường minh: một lần chốt sinh HAI dòng audit — chấp nhận, vì `StatusChanged` là vết
 * duy nhất mà mọi transition tương lai (auto-transition, chuyển bước thủ công) sẽ có.
 *
 * `actorAccountId` OPTIONAL: `undefined` = transition do hệ thống tự chạy theo sự kiện
 * (thanh toán/tồn kho), không có con người nào bấm nút.
 */
export class StatusChanged implements DomainEvent {
  readonly type = 'StatusChanged';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string | undefined,
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
