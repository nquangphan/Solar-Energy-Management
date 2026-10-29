import {
  AUDIT_VALUE_MAX_LENGTH,
  auditChanges,
} from '../src/audit/domain/audit-changes';

/** The flat before → after diff the audit screen displays. */
describe('auditChanges', () => {
  it('keeps only changed keys, after-key order first, then keys only in before', () => {
    expect(
      auditChanges(
        { status: 'baogia', kWp: 5, gone: 'x', same: true },
        { kWp: 6, same: true, status: 'dachot', added: null },
        true,
      ),
    ).toEqual([
      { field: 'kWp', before: '5', after: '6', isMoney: false },
      { field: 'status', before: 'baogia', after: 'dachot', isMoney: false },
      { field: 'added', before: null, after: null, isMoney: false },
      { field: 'gone', before: 'x', after: null, isMoney: false },
    ]);
  });

  it('a create event (no before) lists every key of after', () => {
    expect(
      auditChanges(undefined, { name: 'Tấm pin', price: 1500000 }, true),
    ).toEqual([
      { field: 'name', before: null, after: 'Tấm pin', isMoney: false },
      { field: 'price', before: null, after: '1500000', isMoney: true },
    ]);
  });

  it('a delete-like event (after null) lists every key of before', () => {
    expect(auditChanges({ id: 'a1' }, null, true)).toEqual([
      { field: 'id', before: 'a1', after: null, isMoney: false },
    ]);
  });

  it('no payload at all, or an empty one ⇒ no rows', () => {
    expect(auditChanges(undefined, undefined, true)).toEqual([]);
    expect(auditChanges(null, undefined, true)).toEqual([]);
    expect(auditChanges(undefined, {}, true)).toEqual([]);
    expect(auditChanges([], null, true)).toEqual([]);
  });

  it('a bare scalar is one row with an empty field name', () => {
    expect(auditChanges(undefined, 'on', true)).toEqual([
      { field: '', before: null, after: 'on', isMoney: false },
    ]);
    expect(auditChanges(false, true, true)).toEqual([
      { field: '', before: 'false', after: 'true', isMoney: false },
    ]);
    expect(auditChanges(7, 7, true)).toEqual([]);
  });

  it('nested objects and arrays become one row per changed leaf path', () => {
    expect(
      auditChanges(
        { lines: [{ qty: 1, name: 'A' }], meta: { a: 1 } },
        { lines: [{ qty: 2, name: 'A' }], meta: { a: 1 } },
        true,
      ),
    ).toEqual([
      { field: 'lines[0].qty', before: '1', after: '2', isMoney: false },
    ]);
    expect(auditChanges(['a'], ['a', 'b'], true)).toEqual([
      { field: '[1]', before: null, after: 'b', isMoney: false },
    ]);
  });

  it('flags money on the last key of a path, nested in lists included', () => {
    const rows = auditChanges(
      { amount: 1, orderPaid: 2, qty: 4 },
      {
        amount: 10,
        orderPaid: 20,
        qty: 40,
        lines: [{ unitCost: 1500000, giaVonSau: 1400000, onHandSau: 3 }],
      },
      true,
    );
    expect(rows.map((r) => [r.field, r.isMoney])).toEqual([
      ['amount', true],
      ['orderPaid', true],
      ['qty', false],
      ['lines[0].unitCost', true],
      ['lines[0].giaVonSau', true],
      ['lines[0].onHandSau', false],
    ]);
    // A price ladder is a bare array of tiers.
    expect(
      auditChanges(
        [{ minQty: 10, price: 900000 }],
        [{ minQty: 10, price: 850000 }],
        true,
      ),
    ).toEqual([
      { field: '[0].price', before: '900000', after: '850000', isMoney: true },
    ]);
  });

  it('without costs.view, cost leaves are dropped at any depth; other money stays', () => {
    expect(
      auditChanges(
        { price: 2000000, costPrice: 1500000, name: 'A' },
        {
          price: 2100000,
          costPrice: 1600000,
          name: 'B',
          lines: [{ qty: 1, unitCost: 1500000, giaVonTruoc: 1, giaVonSau: 2 }],
        },
        false,
      ),
    ).toEqual([
      { field: 'price', before: '2000000', after: '2100000', isMoney: true },
      { field: 'name', before: 'A', after: 'B', isMoney: false },
      { field: 'lines[0].qty', before: null, after: '1', isMoney: false },
    ]);
    // A change of the cost price alone shows nothing to such a reader.
    expect(auditChanges({ costPrice: 1 }, { costPrice: 2 }, false)).toEqual([]);
    expect(auditChanges({ costPrice: 1 }, { costPrice: 2 }, true)).toEqual([
      { field: 'costPrice', before: '1', after: '2', isMoney: true },
    ]);
  });

  it('cuts long values at the maximum length with an ellipsis', () => {
    const long = 'x'.repeat(AUDIT_VALUE_MAX_LENGTH + 20);
    const [row] = auditChanges({ note: 'a' }, { note: long }, true);
    expect(row.after).toBe(`${'x'.repeat(AUDIT_VALUE_MAX_LENGTH)}…`);
    const exact = 'y'.repeat(AUDIT_VALUE_MAX_LENGTH);
    expect(auditChanges({ note: 'a' }, { note: exact }, true)[0].after).toBe(
      exact,
    );
  });
});
