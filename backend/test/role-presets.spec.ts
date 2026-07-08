import {
  ROLE_PRESETS,
  type RolePreset,
} from '../src/accounts/domain/role-presets';
import {
  PERM,
  isPermissionKey,
} from '../src/accounts/domain/permission-registry';

/**
 * Unit role-preset (AC-3): CHỈ `SUPER_ADMIN` chứa `audit.read`; mọi preset khác KHÔNG.
 * Mọi key trong mọi preset ∈ registry (không literal lạ). Hằng số code — hermetic.
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
});
