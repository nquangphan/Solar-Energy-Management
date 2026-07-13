import type { DomainEvent } from '../../events/domain-event';

/**
 * Domain event của luồng phân quyền (mirror `auth/domain/password-events.ts`).
 *
 * DOMAIN THUẦN: KHÔNG import Nest/Prisma. `AccountPermissionsService` publish qua
 * `EventBus` port SAU khi transaction commit; `AuditSubscriber` ghi `AuditLog` —
 * producer KHÔNG gọi thẳng consumer nào (AD-18).
 *
 * BẤT BIẾN BẢO MẬT: `AuditLog` là bản ghi bất biến vĩnh viễn, `before`/`after` được ghi
 * thẳng vào đó ⇒ payload CHỈ mang id + danh sách permission key. TUYỆT ĐỐI không
 * `passwordHash`, không email, không bí mật nào khác.
 */

/** Bộ quyền của một account đã bị thay thế (cấp thêm / thu bớt / thu sạch). */
export class AccountPermissionsChanged implements DomainEvent {
  readonly type = 'AccountPermissionsChanged';

  readonly target: { readonly type: string; readonly id: string };
  /** Bộ key trước khi ghi — sorted để payload audit tất định. */
  readonly before: { readonly permissions: readonly string[] };
  /** Bộ key sau khi ghi — sorted. */
  readonly after: { readonly permissions: readonly string[] };

  constructor(
    readonly actorAccountId: string,
    targetAccountId: string,
    beforePermissions: readonly string[],
    afterPermissions: readonly string[],
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Account', id: targetAccountId };
    this.before = { permissions: [...beforePermissions].sort() };
    this.after = { permissions: [...afterPermissions].sort() };
  }
}
