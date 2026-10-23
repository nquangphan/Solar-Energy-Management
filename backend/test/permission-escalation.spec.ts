import {
  grantableBy,
  keysActorCannotGrant,
  keysBlockingActorFromTarget,
} from '../src/accounts/domain/permission-escalation';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import {
  PERM,
  type PermissionKey,
} from '../src/accounts/domain/permission-registry';

/**
 * Unit domain thuần cho hai luật không-leo-thang (không Nest, không Prisma).
 *
 * Bất biến quan trọng nhất được khẳng định ở đây: `ADMIN` KHÔNG thể sửa/thu quyền
 * account `SUPER_ADMIN` — đọc từ `ROLE_PRESETS` thật, KHÔNG hardcode key, để test tự
 * đỏ nếu ma trận preset đổi theo hướng xoá lằn ranh đó.
 */
describe('luật không-leo-thang quyền (domain thuần)', () => {
  const set = (keys: readonly PermissionKey[]) => new Set<PermissionKey>(keys);

  describe('luật #1 — không cấp quyền mình không có', () => {
    it('bộ key yêu cầu ⊆ quyền actor → rỗng (hợp lệ)', () => {
      const actor = set([PERM.ordersViewAll, PERM.paymentsRecord]);
      expect(keysActorCannotGrant(actor, [PERM.ordersViewAll])).toEqual([]);
      expect(keysActorCannotGrant(actor, [])).toEqual([]);
    });

    it('key nằm ngoài quyền actor → trả đúng key đó', () => {
      const actor = set([PERM.ordersViewAll]);
      expect(
        keysActorCannotGrant(actor, [PERM.ordersViewAll, PERM.costsView]),
      ).toEqual([PERM.costsView]);
    });

    it('kết quả sorted + dedup (thông điệp lỗi tất định)', () => {
      const actor = set([]);
      const requested = [PERM.costsView, PERM.auditRead, PERM.costsView];
      const missing = keysActorCannotGrant(actor, requested);

      expect(missing).toEqual([...missing].sort());
      expect(new Set(missing).size).toBe(missing.length);
      expect(missing).toEqual([PERM.auditRead, PERM.costsView].sort());
    });
  });

  describe('luật #2 — không sửa account mang quyền mình không có', () => {
    it('quyền target ⊆ quyền actor → rỗng (actor được sửa target)', () => {
      const actor = set([PERM.ordersViewAll, PERM.auditRead]);
      const target = set([PERM.ordersViewAll]);
      expect(keysBlockingActorFromTarget(actor, target)).toEqual([]);
    });

    it('target mang key actor không có → trả key chặn', () => {
      const actor = set([PERM.ordersViewAll]);
      const target = set([PERM.ordersViewAll, PERM.auditRead]);
      expect(keysBlockingActorFromTarget(actor, target)).toEqual([
        PERM.auditRead,
      ]);
    });

    it('kết quả sorted', () => {
      const actor = set([]);
      const target = set([PERM.systemFeatureFlags, PERM.auditRead]);
      const blocking = keysBlockingActorFromTarget(actor, target);

      expect(blocking).toEqual([...blocking].sort());
    });
  });

  describe('bất biến: ADMIN KHÔNG thu được quyền của SUPER_ADMIN', () => {
    it('luật #2 chặn ADMIN sửa account SUPER_ADMIN', () => {
      const actor = set(ROLE_PRESETS.ADMIN);
      const target = set(ROLE_PRESETS.SUPER_ADMIN);

      const blocking = keysBlockingActorFromTarget(actor, target);

      // Không rỗng ⇒ mọi thao tác sửa/thu quyền của ADMIN lên SUPER_ADMIN bị từ chối.
      // "Xoá Super Admin" (gửi keys = []) cũng đi qua luật #2 nên bất khả.
      expect(blocking.length).toBeGreaterThan(0);
      expect(blocking).toContain(PERM.auditRead);
      expect(blocking).toContain(PERM.systemFeatureFlags);
    });

    it('SUPER_ADMIN sửa được account ADMIN (chiều ngược lại vẫn thông)', () => {
      const actor = set(ROLE_PRESETS.SUPER_ADMIN);
      const target = set(ROLE_PRESETS.ADMIN);

      expect(keysBlockingActorFromTarget(actor, target)).toEqual([]);
      expect(keysActorCannotGrant(actor, [...ROLE_PRESETS.ADMIN])).toEqual([]);
    });
  });
});

describe('orders.view_all covers orders.view_own for escalation', () => {
  const set = (keys: readonly PermissionKey[]) => new Set<PermissionKey>(keys);

  it('ADMIN can grant every field-worker preset in full', () => {
    for (const preset of ['THO_KS', 'THI_CONG', 'KHO_GIAO'] as const) {
      expect(
        keysActorCannotGrant(set(ROLE_PRESETS.ADMIN), ROLE_PRESETS[preset]),
      ).toEqual([]);
    }
  });

  it('ADMIN can edit an account holding orders.view_own', () => {
    expect(
      keysBlockingActorFromTarget(
        set(ROLE_PRESETS.ADMIN),
        set(ROLE_PRESETS.THO_KS),
      ),
    ).toEqual([]);
  });

  it('without orders.view_all, orders.view_own is still not grantable', () => {
    expect(
      keysActorCannotGrant(set([PERM.permissionsManage]), [PERM.ordersViewOwn]),
    ).toEqual([PERM.ordersViewOwn]);
  });

  it('the implication is one-way: view_own does not cover view_all', () => {
    expect(grantableBy(set([PERM.ordersViewOwn])).has(PERM.ordersViewAll)).toBe(
      false,
    );
  });

  it('ADMIN still cannot grant or edit Super Admin keys', () => {
    expect(
      keysBlockingActorFromTarget(
        set(ROLE_PRESETS.ADMIN),
        set(ROLE_PRESETS.SUPER_ADMIN),
      ),
    ).toEqual([PERM.auditRead, PERM.systemFeatureFlags].sort());
  });
});
