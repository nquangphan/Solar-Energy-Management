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

  it('khai đúng 20 key chính tắc (17 ma trận FR-18 §4.6 + 3 key PRD §5)', () => {
    expect(PERMISSION_KEYS.length).toBe(20);
  });

  it('3 key PRD §5 khớp byte-for-byte (chống typo literal)', () => {
    expect(PERM.settingsManage).toBe('settings.manage');
    expect(PERM.systemFeatureFlags).toBe('system.feature_flags');
    expect(PERM.costsView).toBe('costs.view');
  });

  it('3 key mới append CUỐI, 17 key cũ giữ nguyên thứ tự (artifact deterministic)', () => {
    expect(PERMISSION_KEYS.slice(-3)).toEqual([
      PERM.settingsManage,
      PERM.systemFeatureFlags,
      PERM.costsView,
    ]);
    // Khoá TRỌN thứ tự 17 key cũ, không chỉ hai đầu mút: thứ tự registry QUYẾT ĐỊNH thứ
    // tự artifact (FE gen key từ đó) → đảo bất kỳ vị trí nào ở giữa cũng phải đỏ.
    expect(PERMISSION_KEYS.slice(0, 17)).toEqual([
      PERM.ordersViewAll,
      PERM.ordersViewOwn,
      PERM.auditRead,
      PERM.permissionsManage,
      PERM.quotesCreateEdit,
      PERM.ordersConfirm,
      PERM.discountsApply,
      PERM.discountsApprove,
      PERM.constructionTransition,
      PERM.deliveryConfirm,
      PERM.paymentsRecord,
      PERM.catalogManage,
      PERM.contractsGenerate,
      PERM.dashboardFinanceView,
      PERM.customersManage,
      PERM.inventoryManage,
      PERM.invoicesManage,
    ]);
  });

  it('3 entry mới có label + group đúng (hợp đồng artifact cho FE — Story 2.6)', () => {
    const byKey = new Map(PERMISSIONS.map((entry) => [entry.key, entry]));
    expect(byKey.get(PERM.settingsManage)).toEqual({
      key: 'settings.manage',
      label: 'Cấu hình hệ thống',
      group: 'settings',
    });
    expect(byKey.get(PERM.systemFeatureFlags)).toEqual({
      key: 'system.feature_flags',
      label: 'Cờ tính năng (vận hành app)',
      group: 'system',
    });
    expect(byKey.get(PERM.costsView)).toEqual({
      key: 'costs.view',
      label: 'Xem giá vốn & lợi nhuận',
      group: 'costs',
    });
  });

  it('group suy từ domain prefix của key (ngoại lệ DUY NHẤT: permissions.manage → accounts)', () => {
    for (const entry of PERMISSIONS) {
      if (entry.key === PERM.permissionsManage) {
        expect(entry.group).toBe('accounts');
        continue;
      }
      expect(entry.group).toBe(entry.key.split('.')[0]);
    }
  });
});
