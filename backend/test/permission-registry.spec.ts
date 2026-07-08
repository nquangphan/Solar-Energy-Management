import {
  PERM,
  PERMISSIONS,
  PERMISSION_KEYS,
  isPermissionKey,
} from '../src/accounts/domain/permission-registry';

/**
 * Unit registry quyền (AC-1/AC-2): key DUY NHẤT (không trùng), đủ 4 key FE-stub Story
 * 1.10 khớp **byte-for-byte**, naming `domain.action` snake_case, `orders.view_all` +
 * `orders.view_own` là HAI entry tường minh (AC-2). Đây là bằng chứng "done" hermetic —
 * không cần Postgres.
 */
describe('permission-registry (AC-1, AC-2)', () => {
  it('mọi key DUY NHẤT (Set.size === length)', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
  });

  it('mọi key trong PERMISSIONS khớp danh sách PERMISSION_KEYS', () => {
    expect(PERMISSIONS.map((entry) => entry.key)).toEqual([...PERMISSION_KEYS]);
  });

  it('chứa đủ 4 key FE-stub 1.10 khớp byte-for-byte (chống drift — action item Epic 1)', () => {
    // Literal FE stub: web/src/design-system/gating/permissions.ts +
    // mobile/lib/design_system/gating/app_permissions.dart.
    expect(PERM.ordersViewAll).toBe('orders.view_all');
    expect(PERM.auditRead).toBe('audit.read');
    expect(PERM.permissionsManage).toBe('permissions.manage');
    // Entry tường minh #2 (AC-2) — registry phải khai dù FE suy scope từ view_all.
    expect(PERM.ordersViewOwn).toBe('orders.view_own');
    for (const key of [
      PERM.ordersViewAll,
      PERM.ordersViewOwn,
      PERM.auditRead,
      PERM.permissionsManage,
    ]) {
      expect(PERMISSION_KEYS).toContain(key);
    }
  });

  it('view_all và view_own là HAI entry tường minh riêng biệt (AC-2)', () => {
    expect(PERM.ordersViewAll).not.toBe(PERM.ordersViewOwn);
    expect(PERMISSION_KEYS).toContain(PERM.ordersViewAll);
    expect(PERMISSION_KEYS).toContain(PERM.ordersViewOwn);
  });

  it('mọi key theo pattern `domain.action` snake_case', () => {
    const PATTERN = /^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/;
    for (const key of PERMISSION_KEYS) {
      expect(key).toMatch(PATTERN);
    }
  });

  it('mọi entry có label + group không rỗng (cho artifact + màn Phân quyền E8)', () => {
    for (const entry of PERMISSIONS) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.group.length).toBeGreaterThan(0);
    }
  });

  it('isPermissionKey: nhận key hợp lệ, từ chối key lạ', () => {
    expect(isPermissionKey('orders.view_all')).toBe(true);
    expect(isPermissionKey('audit.read')).toBe(true);
    expect(isPermissionKey('orders.delete_all')).toBe(false);
    expect(isPermissionKey('')).toBe(false);
    expect(isPermissionKey('/auth/login')).toBe(false);
  });

  it('khai đúng 17 key chính tắc từ ma trận PRD FR-18', () => {
    expect(PERMISSION_KEYS.length).toBe(17);
  });
});
