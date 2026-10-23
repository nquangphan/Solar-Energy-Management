import {
  ROLE_PRESETS,
  ROLE_PRESET_KEYS,
  ROLE_PRESET_LABELS,
  matchingPreset,
  type RolePreset,
} from '../src/accounts/domain/role-presets';
import {
  PERM,
  PERMISSION_KEYS,
  isPermissionKey,
  type PermissionKey,
} from '../src/accounts/domain/permission-registry';

/**
 * Unit role-preset (AC-3): CHỈ `SUPER_ADMIN` chứa `audit.read` **và**
 * `system.feature_flags` — hai key chỉ-SUPER_ADMIN; mọi preset khác KHÔNG. Mọi key trong
 * mọi preset ∈ registry (không literal lạ). Hằng số code — hermetic.
 */
describe('role-presets (AC-3)', () => {
  const presetNames = Object.keys(ROLE_PRESETS) as RolePreset[];

  it('SUPER_ADMIN chứa cả `audit.read` và `permissions.manage`', () => {
    expect(ROLE_PRESETS.SUPER_ADMIN).toContain(PERM.auditRead);
    expect(ROLE_PRESETS.SUPER_ADMIN).toContain(PERM.permissionsManage);
  });

  it('CHỈ SUPER_ADMIN có `audit.read` — không preset nào khác', () => {
    for (const name of presetNames) {
      if (name === 'SUPER_ADMIN') continue;
      expect(ROLE_PRESETS[name]).not.toContain(PERM.auditRead);
    }
  });

  it('đúng MỘT preset chứa `audit.read` (bất biến "một nguồn Super Admin")', () => {
    const withAudit = presetNames.filter((name) =>
      ROLE_PRESETS[name].includes(PERM.auditRead),
    );
    expect(withAudit).toEqual(['SUPER_ADMIN']);
  });

  it('mọi key trong mọi preset ∈ registry', () => {
    for (const name of presetNames) {
      for (const key of ROLE_PRESETS[name]) {
        expect(isPermissionKey(key)).toBe(true);
      }
    }
  });

  it('không preset nào lặp key (mỗi quyền tối đa một lần)', () => {
    for (const name of presetNames) {
      const keys = ROLE_PRESETS[name];
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('permissions.manage chỉ ở ADMIN + SUPER_ADMIN (theo ma trận FR-18)', () => {
    const withManage = presetNames.filter((name) =>
      ROLE_PRESETS[name].includes(PERM.permissionsManage),
    );
    expect(new Set(withManage)).toEqual(new Set(['ADMIN', 'SUPER_ADMIN']));
  });

  it('CHỈ SUPER_ADMIN có `system.feature_flags` — không preset nào khác', () => {
    for (const name of presetNames) {
      if (name === 'SUPER_ADMIN') continue;
      expect(ROLE_PRESETS[name]).not.toContain(PERM.systemFeatureFlags);
    }
  });

  it('đúng MỘT preset chứa `system.feature_flags` (bất biến "chỉ người vận hành app")', () => {
    const withFlags = presetNames.filter((name) =>
      ROLE_PRESETS[name].includes(PERM.systemFeatureFlags),
    );
    expect(withFlags).toEqual(['SUPER_ADMIN']);
  });

  it('ADMIN KHÔNG có `system.feature_flags` (không append vào ADMIN_PRESET)', () => {
    expect(ROLE_PRESETS.ADMIN).not.toContain(PERM.systemFeatureFlags);
  });

  it('costs.view ở ADMIN + KE_TOAN + QUAN_LY (+ SUPER_ADMIN thừa hưởng)', () => {
    const withCosts = presetNames.filter((name) =>
      ROLE_PRESETS[name].includes(PERM.costsView),
    );
    expect(new Set(withCosts)).toEqual(
      new Set(['ADMIN', 'KE_TOAN', 'QUAN_LY', 'SUPER_ADMIN']),
    );
  });

  it('settings.manage CHỈ ở ADMIN (+ SUPER_ADMIN thừa hưởng) — không QUAN_LY/KE_TOAN', () => {
    const withSettings = presetNames.filter((name) =>
      ROLE_PRESETS[name].includes(PERM.settingsManage),
    );
    expect(new Set(withSettings)).toEqual(new Set(['ADMIN', 'SUPER_ADMIN']));
  });

  it('THO_KS/THI_CONG/KHO_GIAO KHÔNG có `costs.view` (giá vốn là dữ liệu nhạy cảm)', () => {
    for (const name of ['THO_KS', 'THI_CONG', 'KHO_GIAO'] as const) {
      expect(ROLE_PRESETS[name]).not.toContain(PERM.costsView);
    }
  });

  it('SUPER_ADMIN thừa hưởng TRỌN bộ quyền ADMIN, cộng đúng hai key riêng', () => {
    // Bất biến spread: SUPER_ADMIN = [...ADMIN_PRESET, auditRead, systemFeatureFlags].
    // Thay spread bằng danh sách viết tay mà rơi mất một quyền Admin sẽ đỏ ở đây.
    for (const key of ROLE_PRESETS.ADMIN) {
      expect(ROLE_PRESETS.SUPER_ADMIN).toContain(key);
    }
    expect(ROLE_PRESETS.SUPER_ADMIN.length).toBe(ROLE_PRESETS.ADMIN.length + 2);
  });

  it('ADMIN = mọi key registry TRỪ audit.read, system.feature_flags, orders.view_own', () => {
    const chiSuperAdminHoacViewOwn: readonly string[] = [
      PERM.auditRead,
      PERM.systemFeatureFlags,
      PERM.ordersViewOwn,
    ];
    expect(new Set(ROLE_PRESETS.ADMIN)).toEqual(
      new Set(
        PERMISSION_KEYS.filter(
          (key) => !chiSuperAdminHoacViewOwn.includes(key),
        ),
      ),
    );
  });

  it('mỗi preset có ĐÚNG MỘT scope xem đơn (view_all XOR view_own)', () => {
    for (const name of presetNames) {
      const preset = ROLE_PRESETS[name];
      const xemTatCa = preset.includes(PERM.ordersViewAll);
      const xemCuaMinh = preset.includes(PERM.ordersViewOwn);
      expect(xemTatCa).not.toBe(xemCuaMinh);
    }
  });

  /**
   * Bản sao ĐỘC LẬP của ma trận FR-18 §4.6 + PRD §5 — viết tay, KHÔNG derive từ
   * `ROLE_PRESETS`. Các test trên chỉ khoá từng key được nêu tên; 15 key còn lại vẫn có
   * thể lặng lẽ rơi vào (hoặc rơi khỏi) một preset mà cả suite vẫn xanh. Ví dụ thật:
   * cấp `dashboard.finance_view` + `discounts.approve` cho `THI_CONG` — leo thang quyền
   * tài chính cho role thợ — không test nào bắt được. Bảng vàng này bắt.
   *
   * Đổi preset = phải sửa bảng này. Đó là CHỦ Ý: mọi thay đổi ma trận quyền phải là một
   * quyết định tường minh, review được, không phải hệ quả phụ của một dòng thêm vội.
   */
  const MA_TRAN_QUYEN: Record<RolePreset, readonly PermissionKey[]> = {
    SUPER_ADMIN: [
      PERM.quotesCreateEdit,
      PERM.ordersConfirm,
      PERM.discountsApply,
      PERM.discountsApprove,
      PERM.constructionTransition,
      PERM.deliveryConfirm,
      PERM.paymentsRecord,
      PERM.catalogView,
      PERM.catalogManage,
      PERM.contractsGenerate,
      PERM.ordersViewAll,
      PERM.dashboardFinanceView,
      PERM.customersManage,
      PERM.inventoryManage,
      PERM.invoicesManage,
      PERM.permissionsManage,
      PERM.settingsManage,
      PERM.costsView,
      PERM.auditRead,
      PERM.systemFeatureFlags,
    ],
    ADMIN: [
      PERM.quotesCreateEdit,
      PERM.ordersConfirm,
      PERM.discountsApply,
      PERM.discountsApprove,
      PERM.constructionTransition,
      PERM.deliveryConfirm,
      PERM.paymentsRecord,
      PERM.catalogView,
      PERM.catalogManage,
      PERM.contractsGenerate,
      PERM.ordersViewAll,
      PERM.dashboardFinanceView,
      PERM.customersManage,
      PERM.inventoryManage,
      PERM.invoicesManage,
      PERM.permissionsManage,
      PERM.settingsManage,
      PERM.costsView,
    ],
    QUAN_LY: [
      PERM.quotesCreateEdit,
      PERM.ordersConfirm,
      PERM.discountsApply,
      PERM.discountsApprove,
      PERM.constructionTransition,
      PERM.deliveryConfirm,
      PERM.paymentsRecord,
      PERM.catalogView,
      PERM.catalogManage,
      PERM.contractsGenerate,
      PERM.ordersViewAll,
      PERM.dashboardFinanceView,
      PERM.customersManage,
      PERM.inventoryManage,
      PERM.invoicesManage,
      PERM.costsView,
    ],
    KE_TOAN: [
      PERM.paymentsRecord,
      PERM.catalogView,
      PERM.catalogManage,
      PERM.contractsGenerate,
      PERM.ordersViewAll,
      PERM.dashboardFinanceView,
      PERM.customersManage,
      PERM.invoicesManage,
      PERM.costsView,
    ],
    THO_KS: [
      PERM.quotesCreateEdit,
      PERM.ordersConfirm,
      PERM.discountsApply,
      PERM.contractsGenerate,
      PERM.customersManage,
      PERM.catalogView,
      PERM.ordersViewOwn,
    ],
    THI_CONG: [PERM.constructionTransition, PERM.ordersViewOwn],
    KHO_GIAO: [PERM.deliveryConfirm, PERM.inventoryManage, PERM.ordersViewOwn],
  };

  it('mỗi preset khớp CHÍNH XÁC ma trận quyền — không thừa, không thiếu MỘT key nào', () => {
    for (const name of presetNames) {
      expect(new Set(ROLE_PRESETS[name])).toEqual(new Set(MA_TRAN_QUYEN[name]));
    }
  });

  describe('matchingPreset', () => {
    it('each preset set matches its own preset', () => {
      for (const name of presetNames) {
        expect(matchingPreset(new Set(ROLE_PRESETS[name]))).toBe(name);
      }
    });

    it('a preset set with one key removed or added ⇒ null (custom)', () => {
      for (const name of presetNames) {
        const keys = ROLE_PRESETS[name];
        expect(matchingPreset(new Set(keys.slice(1)))).toBeNull();
        const extra = PERMISSION_KEYS.find((key) => !keys.includes(key));
        if (extra) {
          expect(matchingPreset(new Set([...keys, extra]))).toBeNull();
        }
      }
    });

    it('no two presets share the same set (at most one can match)', () => {
      const signatures = presetNames.map((name) =>
        [...ROLE_PRESETS[name]].sort().join(','),
      );
      expect(new Set(signatures).size).toBe(presetNames.length);
    });

    it('empty set ⇒ null', () => {
      expect(matchingPreset(new Set())).toBeNull();
    });
  });

  it('ROLE_PRESET_KEYS covers every preset exactly once, Super Admin last', () => {
    expect([...ROLE_PRESET_KEYS].sort()).toEqual([...presetNames].sort());
    expect(new Set(ROLE_PRESET_KEYS).size).toBe(ROLE_PRESET_KEYS.length);
    expect(ROLE_PRESET_KEYS[ROLE_PRESET_KEYS.length - 1]).toBe('SUPER_ADMIN');
  });

  it('ROLE_PRESET_LABELS has a non-empty label for every preset', () => {
    for (const name of presetNames) {
      expect(ROLE_PRESET_LABELS[name].trim().length).toBeGreaterThan(0);
    }
  });
});
