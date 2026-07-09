/**
 * `DomainEvent` — hợp đồng base cho MỌI domain event của hệ thống (AD-18).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma/Infra. Mọi hành động nghiệp vụ có hệ quả
 * (E4+) khai một concrete event `extends`/conform interface này rồi publish qua
 * `EventBus` port — producer KHÔNG gọi FCM/notification/audit trực tiếp.
 *
 * Mang đủ 5 chiều audit (AD-8) để `AuditSubscriber` ghi `AuditLog` bất biến:
 * ai (actor) / gì (type) / đối tượng (target) / khi nào (occurredAt) / trước→sau (before/after).
 *
 * Story 2.7 CHỈ khai base contract này; concrete event (OrderConfirmed,
 * DiscountResolved, PaymentRecorded, StatusChanged, StockOutBlocked…) do story sở hữu
 * ở E4–E7 khai riêng khi có producer thật (YAGNI — không khai trước event chưa dùng).
 */
export interface DomainEvent {
  /** "gì" — tên loại event (vd 'OrderConfirmed'); concrete event do story sở hữu đặt. */
  readonly type: string;
  /** "khi nào" — thời điểm nghiệp vụ xảy ra. */
  readonly occurredAt: Date;
  /** "ai" — account gây ra (undefined = system/auto-transition). */
  readonly actorAccountId?: string;
  /** "đối tượng" — thực thể bị tác động (vd { type: 'Order', id }). */
  readonly target?: { readonly type: string; readonly id: string };
  /** "trước" — trạng thái trước (optional). */
  readonly before?: unknown;
  /** "sau" — trạng thái sau (optional). */
  readonly after?: unknown;
}
