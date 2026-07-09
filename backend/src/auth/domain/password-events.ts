import type { DomainEvent } from '../../events/domain-event';

/**
 * Ba concrete domain event của luồng mật khẩu — PRODUCER ĐẦU TIÊN của AD-18.
 *
 * Story 2.7 chỉ khai base contract `DomainEvent` và hẹn "concrete event do story sở hữu
 * khai khi có producer thật". Đây chính là chỗ đó.
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `AuthService`/`PasswordResetService` publish
 * qua `EventBus` port; `AuditSubscriber` ghi `AuditLog`, `NotificationDispatcher` là seam
 * gửi mã (Epic 9) — producer KHÔNG gọi thẳng consumer nào.
 *
 * BẤT BIẾN BẢO MẬT: `AuditLog` là bản ghi bất biến vĩnh viễn (append-only, AD-8) và
 * `before`/`after` của event được ghi thẳng vào đó. Vì vậy payload CHỈ ghi *sự kiện đã
 * xảy ra* (ai / gì / đối tượng / khi nào) — TUYỆT ĐỐI không mật khẩu thô, `passwordHash`,
 * hay mã xác thực. `before` bỏ hẳn (không có "trạng thái trước" nào an toàn để ghi);
 * `after` chỉ mang dấu thời gian. Guard: `test/password-events.spec.ts`.
 */

/** Phần chung 4/5 chiều audit: actor = chính chủ tài khoản, target = tài khoản đó. */
abstract class AccountPasswordEvent implements DomainEvent {
  abstract readonly type: string;

  readonly target: { readonly type: string; readonly id: string };
  /** Chỉ dấu thời gian — xem bất biến bảo mật ở đầu file. */
  readonly after: { readonly changedAt: string };

  constructor(
    readonly actorAccountId: string,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Account', id: actorAccountId };
    this.after = { changedAt: occurredAt.toISOString() };
  }
}

/**
 * Người dùng yêu cầu mã đặt lại mật khẩu. **Đây là seam gửi mã** (AD-18): producer chỉ
 * publish; kênh gửi thật (email/SMS) lắp vào consumer sau, KHÔNG mở lại code story này.
 */
export class PasswordResetRequested extends AccountPasswordEvent {
  readonly type = 'PasswordResetRequested';
}

/** Mã hợp lệ đã được tiêu thụ, mật khẩu mới đã ghi, mọi phiên đã bị thu hồi. */
export class PasswordResetCompleted extends AccountPasswordEvent {
  readonly type = 'PasswordResetCompleted';
}

/** Người dùng đang đăng nhập tự đổi mật khẩu (đã verify mật khẩu hiện tại). */
export class PasswordChanged extends AccountPasswordEvent {
  readonly type = 'PasswordChanged';
}
