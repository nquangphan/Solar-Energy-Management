import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moneyArithmeticBans } from './money-arithmetic.mjs';

const BANS = moneyArithmeticBans('(?:amount|orderTotal|paidTotal|total)');
const flagged = (code) => BANS.some(([p]) => p.test(code));

test('flags arithmetic when a cast, null-aware access or default sits between the figure and the operator', () => {
  for (const sample of [
    'final left = orderTotal.toInt() - x;',
    'final left = y - (s?.paidTotal ?? 0);',
    'final left = (s?.paidTotal ?? 0) - y;',
    'final left = s!.orderTotal! - y;',
    'final left = o.orderTotal!.toInt() - y;',
    'final left = s?.orderTotal?.toInt() - y;',
    'final left = y - s!.paidTotal!.toInt();',
    'final left = y - o?.orderTotal;',
    'final left = (orderTotal) - y;',
    'final left = lines[0].amount * 2;',
    'final left = y - lines[i]!.paidAmount;',
    'const left = overview.orderTotal / 3;',
    'const left = y + ((s?.orderTotal ?? 0));',
  ]) {
    assert.ok(flagged(sample), `must flag: ${sample}`);
  }
});

test('reading or rendering a figure is not arithmetic', () => {
  for (const sample of [
    'MoneyText(o.orderTotal.toInt())',
    '<Money value={overview.orderTotal} />',
    '<dl className="iv-rows iv-totals">',
    'final paid = s?.paidTotal ?? 0;',
    'onTap: (amount) => record(amount),',
    'if (o.orderTotal != null) {}',
  ]) {
    assert.ok(!flagged(sample), `must not flag: ${sample}`);
  }
});
