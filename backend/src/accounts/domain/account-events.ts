import type { DomainEvent } from '../../events/domain-event';
import type { RolePreset } from './role-presets';

/**
 * Domain events of the account admin flows: permission changes (8.2) and account
 * create/update (8.3). Mirrors `auth/domain/password-events.ts`.
 *
 * PURE DOMAIN: no Nest/Prisma import. The services publish through the `EventBus` port AFTER
 * the transaction commits; `AuditSubscriber` writes the `AuditLog` — the producer never calls
 * a consumer directly (AD-18).
 *
 * SECURITY INVARIANT: `AuditLog` is a permanent, immutable record and `before`/`after` land in
 * it verbatim ⇒ payloads carry NO secret — never the raw password, never `passwordHash`, never
 * a token. Display name, phone, email and the active flag are contact data the admin already
 * sees in `GET /accounts` (same precedent as `CustomerSnapshot`).
 */

/** An account at one point in time — plain domain type, never a Prisma type. */
export interface AccountSnapshot {
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string;
  readonly isActive: boolean;
}

/** A new account, with the permission set its preset loaded. */
export class AccountCreated implements DomainEvent {
  readonly type = 'AccountCreated';

  readonly target: { readonly type: string; readonly id: string };
  readonly after: AccountSnapshot & {
    readonly permissions: readonly string[];
    readonly preset: RolePreset;
  };

  constructor(
    readonly actorAccountId: string,
    accountId: string,
    snapshot: AccountSnapshot,
    permissions: readonly string[],
    preset: RolePreset,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Account', id: accountId };
    this.after = {
      ...pickSnapshot(snapshot),
      permissions: [...permissions].sort(),
      preset,
    };
  }
}

/** An account's profile or active flag was saved (one event per save, even a no-op one). */
export class AccountUpdated implements DomainEvent {
  readonly type = 'AccountUpdated';

  readonly target: { readonly type: string; readonly id: string };
  readonly before: AccountSnapshot;
  readonly after: AccountSnapshot;

  constructor(
    readonly actorAccountId: string,
    accountId: string,
    before: AccountSnapshot,
    after: AccountSnapshot,
    readonly occurredAt: Date,
  ) {
    this.target = { type: 'Account', id: accountId };
    this.before = pickSnapshot(before);
    this.after = pickSnapshot(after);
  }
}

/**
 * Copies exactly the snapshot keys: a caller passing a whole account row (with `passwordHash`)
 * must not leak it into the audit log.
 */
function pickSnapshot(source: AccountSnapshot): AccountSnapshot {
  return {
    displayName: source.displayName,
    phone: source.phone,
    email: source.email,
    isActive: source.isActive,
  };
}

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
