import {
  PERMISSION_REQUIRES,
  missingDependencies,
} from '../src/accounts/domain/permission-dependencies';
import {
  PERM,
  isPermissionKey,
  type PermissionKey,
} from '../src/accounts/domain/permission-registry';
import {
  ROLE_PRESETS,
  type RolePreset,
} from '../src/accounts/domain/role-presets';

/**
 * Pure-domain unit for the permission dependency table: the two combinations that 403 mid-flow
 * are reported, consistent sets report nothing, and no shipped preset violates the table.
 */
describe('permission dependencies (pure domain)', () => {
  it('settings.manage without customers.manage reports customers.manage', () => {
    expect(missingDependencies([PERM.settingsManage])).toEqual([
      { key: PERM.settingsManage, missing: [PERM.customersManage] },
    ]);
  });

  it('quotes.create_edit without customers.manage reports customers.manage', () => {
    expect(
      missingDependencies([PERM.quotesCreateEdit, PERM.catalogView]),
    ).toEqual([
      { key: PERM.quotesCreateEdit, missing: [PERM.customersManage] },
    ]);
  });

  it('quotes.create_edit without catalog.view reports catalog.view', () => {
    expect(
      missingDependencies([PERM.quotesCreateEdit, PERM.customersManage]),
    ).toEqual([{ key: PERM.quotesCreateEdit, missing: [PERM.catalogView] }]);
  });

  it('several gaps are sorted by key, then by missing key', () => {
    expect(
      missingDependencies([PERM.settingsManage, PERM.quotesCreateEdit]),
    ).toEqual([
      {
        key: PERM.quotesCreateEdit,
        missing: [PERM.catalogView, PERM.customersManage],
      },
      { key: PERM.settingsManage, missing: [PERM.customersManage] },
    ]);
  });

  it('every dependency satisfied ⇒ empty', () => {
    expect(
      missingDependencies([
        PERM.settingsManage,
        PERM.quotesCreateEdit,
        PERM.customersManage,
        PERM.catalogView,
      ]),
    ).toEqual([]);
    expect(missingDependencies([])).toEqual([]);
  });

  it('every ROLE_PRESETS entry satisfies the table', () => {
    for (const name of Object.keys(ROLE_PRESETS) as RolePreset[]) {
      expect({ name, gaps: missingDependencies(ROLE_PRESETS[name]) }).toEqual({
        name,
        gaps: [],
      });
    }
  });

  it('every key of the table (keys and values) is in the registry', () => {
    const entries = Object.entries(PERMISSION_REQUIRES);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, required] of entries) {
      expect(isPermissionKey(key)).toBe(true);
      expect((required as readonly PermissionKey[]).length).toBeGreaterThan(0);
      for (const r of required as readonly PermissionKey[]) {
        expect(isPermissionKey(r)).toBe(true);
      }
    }
  });
});
