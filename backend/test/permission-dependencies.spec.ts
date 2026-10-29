import {
  PERMISSION_REQUIRES,
  PERMISSION_REQUIRES_ANY,
  dependencyMessage,
  missingDependencies,
} from '../src/accounts/domain/permission-dependencies';
import {
  PERM,
  PERMISSIONS,
  isPermissionKey,
  type PermissionKey,
} from '../src/accounts/domain/permission-registry';
import {
  ROLE_PRESETS,
  type RolePreset,
} from '../src/accounts/domain/role-presets';

/**
 * Pure-domain unit for the permission dependency tables: the combinations that 403 mid-flow
 * are reported, consistent sets report nothing, and no shipped preset violates the tables.
 */
describe('permission dependencies (pure domain)', () => {
  const VIEW_SCOPES = [PERM.ordersViewAll, PERM.ordersViewOwn];
  const labelOf = (key: PermissionKey): string =>
    PERMISSIONS.find((entry) => entry.key === key)!.label;

  it('settings.manage without customers.manage reports customers.manage', () => {
    expect(missingDependencies([PERM.settingsManage])).toEqual([
      {
        key: PERM.settingsManage,
        missing: [PERM.customersManage],
        missingAnyOf: [],
      },
    ]);
  });

  it('quotes.create_edit without customers.manage reports customers.manage', () => {
    expect(
      missingDependencies([
        PERM.quotesCreateEdit,
        PERM.catalogView,
        PERM.ordersViewOwn,
      ]),
    ).toEqual([
      {
        key: PERM.quotesCreateEdit,
        missing: [PERM.customersManage],
        missingAnyOf: [],
      },
    ]);
  });

  it('quotes.create_edit without catalog.view reports catalog.view', () => {
    expect(
      missingDependencies([
        PERM.quotesCreateEdit,
        PERM.customersManage,
        PERM.ordersViewAll,
      ]),
    ).toEqual([
      {
        key: PERM.quotesCreateEdit,
        missing: [PERM.catalogView],
        missingAnyOf: [],
      },
    ]);
  });

  it('several gaps are sorted by key, then by missing key', () => {
    expect(
      missingDependencies([
        PERM.settingsManage,
        PERM.quotesCreateEdit,
        PERM.ordersViewOwn,
      ]),
    ).toEqual([
      {
        key: PERM.quotesCreateEdit,
        missing: [PERM.catalogView, PERM.customersManage],
        missingAnyOf: [],
      },
      {
        key: PERM.settingsManage,
        missing: [PERM.customersManage],
        missingAnyOf: [],
      },
    ]);
  });

  describe('"at least one of" — each order action needs a view scope', () => {
    const ANY_KEYS = [
      PERM.quotesCreateEdit,
      PERM.ordersConfirm,
      PERM.discountsApply,
      PERM.constructionTransition,
      PERM.deliveryConfirm,
      PERM.paymentsRecord,
      PERM.contractsGenerate,
      PERM.invoicesManage,
    ];
    /** Everything an ANY key may also require through the AND table, so only OR is tested. */
    const AND_DEPS = [PERM.customersManage, PERM.catalogView];

    it('the OR table holds exactly the verified order actions (inventory.manage is not one)', () => {
      expect(Object.keys(PERMISSION_REQUIRES_ANY).sort()).toEqual(
        [...ANY_KEYS].sort(),
      );
      expect(PERMISSION_REQUIRES_ANY[PERM.inventoryManage]).toBeUndefined();
    });

    it.each(ANY_KEYS)(
      '%s without any view scope ⇒ missingAnyOf is the whole group, in table order',
      (key) => {
        expect(missingDependencies([key, ...AND_DEPS])).toEqual([
          { key, missing: [], missingAnyOf: VIEW_SCOPES },
        ]);
      },
    );

    it.each(ANY_KEYS)('%s with only orders.view_own ⇒ no gap', (key) => {
      expect(
        missingDependencies([key, ...AND_DEPS, PERM.ordersViewOwn]),
      ).toEqual([]);
    });

    it.each(ANY_KEYS)('%s with only orders.view_all ⇒ no gap', (key) => {
      expect(
        missingDependencies([key, ...AND_DEPS, PERM.ordersViewAll]),
      ).toEqual([]);
    });
  });

  it('discounts.approve with only orders.view_own ⇒ missing orders.view_all', () => {
    expect(
      missingDependencies([PERM.discountsApprove, PERM.ordersViewOwn]),
    ).toEqual([
      {
        key: PERM.discountsApprove,
        missing: [PERM.ordersViewAll],
        missingAnyOf: [],
      },
    ]);
    expect(
      missingDependencies([PERM.discountsApprove, PERM.ordersViewAll]),
    ).toEqual([]);
  });

  it('catalog.manage without catalog.view ⇒ gap; with it ⇒ none', () => {
    expect(missingDependencies([PERM.catalogManage])).toEqual([
      {
        key: PERM.catalogManage,
        missing: [PERM.catalogView],
        missingAnyOf: [],
      },
    ]);
    expect(missingDependencies([PERM.catalogManage, PERM.catalogView])).toEqual(
      [],
    );
  });

  it('every dependency satisfied ⇒ empty', () => {
    expect(
      missingDependencies([
        PERM.settingsManage,
        PERM.quotesCreateEdit,
        PERM.customersManage,
        PERM.catalogView,
        PERM.ordersViewOwn,
      ]),
    ).toEqual([]);
    expect(missingDependencies([])).toEqual([]);
  });

  describe('dependencyMessage', () => {
    const messages = (keys: PermissionKey[]): string[] =>
      missingDependencies(keys).map((gap) => dependencyMessage(gap, labelOf));

    it('AND part only — the existing sentence is unchanged', () => {
      expect(messages([PERM.settingsManage])).toEqual([
        '«Cấu hình hệ thống» cần thêm «Quản lý khách hàng».',
      ]);
    });

    it('OR part only', () => {
      expect(messages([PERM.ordersConfirm])).toEqual([
        '«Chốt đơn» cần thêm một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».',
      ]);
    });

    it('AND then OR in one sentence', () => {
      expect(messages([PERM.quotesCreateEdit, PERM.catalogView])).toEqual([
        '«Tạo/sửa báo giá» cần thêm «Quản lý khách hàng», một trong «Xem tất cả đơn», «Chỉ xem đơn của mình».',
      ]);
    });

    it('a new AND entry', () => {
      expect(messages([PERM.discountsApprove, PERM.ordersViewOwn])).toEqual([
        '«Duyệt chiết khấu» cần thêm «Xem tất cả đơn».',
      ]);
    });
  });

  it('every ROLE_PRESETS entry satisfies both tables', () => {
    for (const name of Object.keys(ROLE_PRESETS) as RolePreset[]) {
      expect({ name, gaps: missingDependencies(ROLE_PRESETS[name]) }).toEqual({
        name,
        gaps: [],
      });
    }
  });

  it.each([
    ['PERMISSION_REQUIRES', PERMISSION_REQUIRES],
    ['PERMISSION_REQUIRES_ANY', PERMISSION_REQUIRES_ANY],
  ])(
    '%s: every key (keys and values) is in the registry, none depends on itself',
    (_name, table) => {
      const entries = Object.entries(table);
      expect(entries.length).toBeGreaterThan(0);
      for (const [key, required] of entries) {
        expect(isPermissionKey(key)).toBe(true);
        const list = required as readonly PermissionKey[];
        expect(list.length).toBeGreaterThan(0);
        expect(list).not.toContain(key);
        for (const r of list) {
          expect(isPermissionKey(r)).toBe(true);
        }
      }
    },
  );
});
