import {
  AccountCreated,
  AccountUpdated,
  type AccountSnapshot,
} from '../src/accounts/domain/account-events';
import type { DomainEvent } from '../src/events/domain-event';

/**
 * `AuditLog` is permanent, and `AuditSubscriber` writes `before`/`after` verbatim — so no
 * account event may carry a password, a hash or a token, even when the caller hands the
 * constructor a whole account row.
 */
describe('account domain events (payload security, AD-18)', () => {
  const ACTOR = 'actor-1';
  const TARGET = 'target-1';
  const OCCURRED_AT = new Date('2026-10-23T03:00:00.000Z');
  const PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA';

  /** A full row, as a careless caller might pass it: the extra keys must not survive. */
  const row = (displayName: string, isActive: boolean) =>
    ({
      id: TARGET,
      displayName,
      phone: '+84912345678',
      email: 'tho@local.test',
      isActive,
      passwordHash: PASSWORD_HASH,
      password: 'Secret123',
      refreshToken: 'tok',
    }) as AccountSnapshot;

  const created = new AccountCreated(
    ACTOR,
    TARGET,
    row('Thợ A', true),
    ['orders.view_own', 'catalog.view'],
    'THO_KS',
    OCCURRED_AT,
  );
  const updated = new AccountUpdated(
    ACTOR,
    TARGET,
    row('Thợ A', true),
    row('Thợ B', false),
    OCCURRED_AT,
  );

  const keysDeep = (value: unknown): string[] =>
    value === null || typeof value !== 'object'
      ? []
      : Object.entries(value).flatMap(([key, inner]) => [
          key,
          ...keysDeep(inner),
        ]);

  it.each<[string, DomainEvent]>([
    ['AccountCreated', created],
    ['AccountUpdated', updated],
  ])('%s carries no key that looks like a secret', (name, event) => {
    expect(event.type).toBe(name);
    expect(event.actorAccountId).toBe(ACTOR);
    expect(event.target).toEqual({ type: 'Account', id: TARGET });
    expect(event.occurredAt).toBe(OCCURRED_AT);
    const keys = keysDeep(JSON.parse(JSON.stringify(event)));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => /password|hash|token/i.test(key))).toEqual([]);
    expect(JSON.stringify(event)).not.toContain(PASSWORD_HASH);
  });

  it('AccountCreated: snapshot + sorted permissions + preset, no before', () => {
    expect((created as DomainEvent).before).toBeUndefined();
    expect(created.after).toEqual({
      displayName: 'Thợ A',
      phone: '+84912345678',
      email: 'tho@local.test',
      isActive: true,
      permissions: ['catalog.view', 'orders.view_own'],
      preset: 'THO_KS',
    });
  });

  it('AccountUpdated: before and after are exactly the snapshot keys', () => {
    expect(updated.before).toEqual({
      displayName: 'Thợ A',
      phone: '+84912345678',
      email: 'tho@local.test',
      isActive: true,
    });
    expect(updated.after).toEqual({
      displayName: 'Thợ B',
      phone: '+84912345678',
      email: 'tho@local.test',
      isActive: false,
    });
  });
});
