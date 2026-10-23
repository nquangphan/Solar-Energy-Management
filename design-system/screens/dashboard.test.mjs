// Source-guard + parity for the Trang chủ dashboard screens (Story 8.1).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/dashboard-screen.test.tsx and
// mobile/test/screens/dashboard/dashboard_screen_test.dart are the lanes that
// prove the behaviour.
//
// The load-bearing rules:
//  - THE CLIENT COMPUTES NOTHING (AD-2): revenue, counts and the period days
//    arrive computed. No arithmetic on the money figure, and it is displayed only
//    through Money / formatVnd. The chart scales COUNTS, never money.
//  - The backend decides whether money shows (AD-4): the screens branch on
//    `revenue` being null and hold no finance permission rule of their own.
//  - Both platforms show the SAME Vietnamese labels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { moneyArithmeticBans } from '../lib/money-arithmetic.mjs';
import { readMobileScreen } from '../lib/read-mobile-screen.mjs';
import { moneyFields } from '../money/money-fields.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const FILES = {
  webScreen: 'web/src/screens/dashboard/DashboardScreen.tsx',
  mobileScreen: 'mobile/lib/screens/dashboard/dashboard_screen.dart',
  mobileCubit: 'mobile/lib/screens/dashboard/dashboard_cubit.dart',
  mobileState: 'mobile/lib/screens/dashboard/dashboard_state.dart',
  webPort: 'web/src/design-system/session/dashboard-port.ts',
  mobilePort: 'mobile/lib/design_system/session/dashboard_port.dart',
  webFake: 'web/src/design-system/session/fake-dashboard-port.ts',
  mobileFake: 'mobile/lib/design_system/session/fake_dashboard_port.dart',
};

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

// The mobile screen is read with its own cubit + state (logic moved there under BLoC).
const webCode = stripTsx(read(FILES.webScreen));
const mobileCode = stripDart(readMobileScreen(repoRoot, FILES.mobileScreen));
const screens = [
  ['web:screen', webCode],
  ['mobile:screen+cubit+state', mobileCode],
];

/** Labels both platforms must render verbatim. */
const SHARED_LABELS = [
  'TRANG CHỦ',
  'Tổng quan vận hành',
  'Ngày',
  'Tuần',
  'Tháng này',
  'hôm nay',
  'tuần này',
  'tháng này',
  'Doanh thu ',
  'Đơn mới ',
  'Đơn theo trạng thái',
  'Không tải được số liệu.',
  'Không có số liệu cho tài khoản này',
];

const MONEY = '(?:revenue)';

/** The computations only the backend may do — each pattern with why. */
const BANNED = [
  ...moneyArithmeticBans(MONEY),
  // Dart integer division `~/` is not in the shared operator set.
  [/revenue[^;\n]*~\/|~\/[^;\n]*revenue/, 'integer division on the money figure'],
  [/\.reduce\s*\(|\.fold\s*[<(]|\.sum\b/, 'summing figures (the backend sends totals)'],
  [/String\([^)]*revenue|revenue\W*\.toString\(|\$\{[^}]*revenue/, 'printing the money figure raw'],
  [/toLocaleString|NumberFormat|Intl\./, 'locale formatting instead of formatVnd'],
  [/dashboardFinanceView|finance_view/, 'a finance permission rule in the client (the backend sends revenue: null)'],
];

test('every dashboard file exists (port + fake + screen on both platforms, cubit + state on mobile)', () => {
  for (const rel of Object.values(FILES)) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

test('guard is not blind: every scanned file has real code', () => {
  assertCodeNotBlind(
    [
      ...screens,
      ['web:port', stripTsx(read(FILES.webPort))],
      ['mobile:port', stripDart(read(FILES.mobilePort))],
      ['web:fake', stripTsx(read(FILES.webFake))],
      ['mobile:fake', stripDart(read(FILES.mobileFake))],
    ],
    300,
    'dashboard sources',
  );
  // The mobile read really includes the cubit (a guard reading only the screen file
  // would go blind to arithmetic moved into the cubit).
  assert.match(mobileCode, /class DashboardCubit\b/);
  assert.match(mobileCode, /final class DashboardState\b/);
});

test('revenue is a money field of the contract (the money-render guard watches it)', () => {
  assert.ok(moneyFields().includes('revenue'), 'revenue must be documented as "số nguyên đồng" in the DTO');
  assert.ok(!moneyFields().includes('count'), 'count must not be read as money');
  assert.ok(!moneyFields().includes('newOrderCount'), 'newOrderCount must not be read as money');
});

test('both platforms render the same Vietnamese labels', () => {
  for (const label of SHARED_LABELS) {
    for (const [name, code] of screens) {
      assert.ok(code.includes(label), `${name} must render "${label}"`);
    }
  }
});

test('money is displayed only through Money / formatVnd, and only when the backend sent it', () => {
  assert.match(webCode, /summary\.revenue !== null && \(/);
  assert.match(webCode, /<Money value=\{summary\.revenue\} \/>/);
  assert.match(mobileCode, /if \(summary\.revenue != null\)/);
  assert.match(mobileCode, /formatVnd\(summary\.revenue!\)/);
});

test('the chart scales counts: each column value is the status count', () => {
  assert.match(webCode, /value: s\.count,/);
  assert.match(mobileCode, /value: s\.count,/);
});

test('the screens never compute, print raw or gate money themselves', () => {
  for (const [name, code] of screens) {
    for (const [pattern, why] of BANNED) {
      assert.ok(!pattern.test(code), `${name}: ${why} (${pattern})`);
    }
  }
});

test('sanity: the bans catch the shapes they are meant to catch', () => {
  const caught = (sample) => BANNED.some(([pattern]) => pattern.test(sample));
  for (const sample of [
    'const half = revenue * 2;',
    'final int x = summary.revenue! + other;',
    'final int k = (s?.revenue ?? 0) ~/ 1000 + 1;',
    'total - summary.revenue',
    '{String(summary.revenue)}',
    "Text('${summary.revenue}')",
    'summary.revenue!.toString()',
    'can(perms, PERM.dashboardFinanceView)',
    'final int n = (s.ordersByStatus ?? const []).fold(0, (int a, x) => a + x.count);',
    'final int n = s.ordersByStatus!.map((x) => x.count).sum;',
    'const n = items.reduce((a, b) => a + b.count, 0);',
  ]) {
    assert.ok(caught(sample), `a ban must catch: ${sample}`);
  }
  for (const sample of ['<Money value={summary.revenue} />', 'formatVnd(summary.revenue!)', 'summary.revenue !== null']) {
    assert.ok(!caught(sample), `the sanctioned shape must pass: ${sample}`);
  }
});

test('the web screen talks only to its port; on mobile only the cubit does', () => {
  assert.match(webCode, /port\.getSummary\(period\)/);
  assert.match(stripDart(read(FILES.mobileCubit)), /_port\.getSummary\(period\)/);
  assert.ok(!/getSummary\(/.test(stripDart(read(FILES.mobileScreen))), 'the mobile screen must not call the port');
  for (const [name, code] of screens) {
    assert.ok(!/\bfetch\(|axios|package:http\/|HttpClient/.test(code), `${name} must not call HTTP directly`);
  }
});
