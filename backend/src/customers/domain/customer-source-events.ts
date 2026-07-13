import type { DomainEvent } from '../../events/domain-event';

/**
 * Domain event của danh mục Nguồn khách (mirror `customer-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `CustomerSourcesService` publish qua `EventBus` port
 * SAU khi write commit; `AuditSubscriber` ghi `AuditLog` — producer KHÔNG gọi thẳng consumer
 * nào (AD-18).
 *
 * BỐN event, không phải một. FR-20 đòi audit "mọi hành động thay đổi dữ liệu (tạo/sửa/xoá)" —
 * đổi tên được nêu riêng vì nó là ca NGUY HIỂM NHẤT (đổi nghĩa dữ liệu cũ mà không đổi dữ liệu),
 * không phải vì nó là ca duy nhất. Không có `CustomerSourceCreated` thì câu hỏi "ai thêm nguồn
 * này?" không có chỗ nào trả lời; không có `CustomerSourceDeactivated` thì "ai tắt nguồn Đại lý
 * tháng trước?" cũng vậy.
 */

/** Ảnh chụp một nguồn khách tại một thời điểm — kiểu domain thuần, KHÔNG dùng type của Prisma. */
export interface CustomerSourceSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly sortOrder: number;
  readonly isOther: boolean;
}

/** Nguồn khách mới được thêm — không có trạng thái "trước". */
export class CustomerSourceCreated implements DomainEvent {
  readonly type = 'CustomerSourceCreated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly after: CustomerSourceSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'CustomerSource', id: after.id };
  }
}

/**
 * Nội dung nguồn khách được sửa (tên / mô tả / thứ tự).
 *
 * `before` là thứ làm event này có giá trị: đổi tên "Đại lý" thành "Cộng tác viên" KHÔNG đổi một
 * dòng dữ liệu khách nào, nhưng đổi Ý NGHĨA của mọi khách đang trỏ vào nó. Không chụp tên cũ thì
 * nhật ký chỉ nói "có người sửa gì đó", và câu hỏi thật ("trước đó nó tên gì?") mất câu trả lời.
 */
export class CustomerSourceUpdated implements DomainEvent {
  readonly type = 'CustomerSourceUpdated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: CustomerSourceSnapshot,
    readonly after: CustomerSourceSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'CustomerSource', id: after.id };
  }
}

/** Nguồn khách bị tắt (`active: false`) — KHÔNG phải xoá cứng: khách cũ vẫn trỏ vào nó. */
export class CustomerSourceDeactivated implements DomainEvent {
  readonly type = 'CustomerSourceDeactivated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: CustomerSourceSnapshot,
    readonly after: CustomerSourceSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'CustomerSource', id: after.id };
  }
}

/** Nguồn khách được bật lại (`active: true`). */
export class CustomerSourceReactivated implements DomainEvent {
  readonly type = 'CustomerSourceReactivated';

  readonly target: { readonly type: string; readonly id: string };

  constructor(
    readonly actorAccountId: string,
    readonly before: CustomerSourceSnapshot,
    readonly after: CustomerSourceSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'CustomerSource', id: after.id };
  }
}
