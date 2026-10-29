// Source-guard + parity for the gross profit report screens.
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/profit-report-screen.test.tsx and the mobile widget/bloc
// tests under mobile/test/screens/reports/ are the lanes that prove the behaviour.
//
// The load-bearing rules:
//  - The mandatory scope label and the not-issued note are shown word for word on
//    BOTH platforms, each as a string literal of its own (a longer sentence that
//    merely contains them does not count).
//  - THE CLIENT COMPUTES NOTHING (AD-2): revenue, cost, gross profit and margin
//    arrive computed; no arithmetic on them, no summing, no locale formatting.
//  - Web and mobile offer the same four groupings, and those are exactly the
//    backend's `PROFIT_GROUP_BY`.
//  - The gate is the route's (costs.view, AD-4): the screens hold no permission rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCodeNotBlind, assertScanned } from '../lib/assert-scanned.mjs';
import { moneyArithmeticBans } from '../lib/money-arithmetic.mjs';
import { readMobileScreen } from '../lib/read-mobile-screen.mjs';
import { moneyFields } from '../money/money-fields.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const FILES = {
  webScreen: 'web/src/screens/reports/ProfitReportScreen.tsx',
  mobileScreen: 'mobile/lib/screens/reports/profit_report_screen.dart',
  mobileCubit: 'mobile/lib/screens/reports/profit_report_cubit.dart',
  mobileState: 'mobile/lib/screens/reports/profit_report_state.dart',
  webPort: 'web/src/design-system/session/profit-report-port.ts',
  mobilePort: 'mobile/lib/design_system/session/profit_report_port.dart',
  webFake: 'web/src/design-system/session/fake-profit-report-port.ts',
  mobileFake: 'mobile/lib/design_system/session/fake_profit_report_port.dart',
  backendDomain: 'backend/src/dashboard/domain/profit-report.ts',
};

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// Comments only: labels are STRINGS, so string literals must stay.
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripDart = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// The mobile screen is read with its own cubit + state (logic moved there under BLoC).
const webCode = stripTsx(read(FILES.webScreen));
const mobileCode = stripDart(readMobileScreen(repoRoot, FILES.mobileScreen));
const screens = [
  ['web:ProfitReportScreen', webCode],
  ['mobile:profit_report screen+cubit+state', mobileCode],
];

const SCOPE_LABEL = 'Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung.';
const NOT_ISSUED_NOTE = 'Đơn chưa xuất kho không có trong báo cáo.';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `text` appears as a WHOLE string literal: a quote right before and right after it. */
function hasStandaloneLiteral(code, text) {
  return new RegExp(`(['"\`])${escapeRe(text)}\\1`).test(code);
}

/** The `key: '…'` values inside the literal opened by `opener` (up to its closing `];`). */
function optionKeys(code, opener) {
  const start = code.indexOf(opener);
  if (start < 0) return [];
  const body = code.slice(start, code.indexOf('];', start));
  return [...body.matchAll(/\bkey:\s*'(\w+)'/g)].map((m) => m[1]);
}

const WEB_GROUP_KEYS = optionKeys(webCode, 'export const PROFIT_GROUP_OPTIONS');
const MOBILE_GROUP_KEYS = optionKeys(mobileCode, 'const List<AppTabItem> kProfitGroupTabs');
const BACKEND_GROUP_KEYS = [
  ...(/PROFIT_GROUP_BY = \[([\s\S]*?)\] as const/.exec(read(FILES.backendDomain))?.[1] ?? '').matchAll(/'(\w+)'/g),
].map((m) => m[1]);

const MONEY = '(?:revenue|cost|grossProfit|marginPct)';

/** The computations only the backend may do — each pattern with why. */
const BANNED = [
  ...moneyArithmeticBans(MONEY),
  [/\*\s*100\b|\b100\s*\*/, 'a percentage computed in the client'],
  // Dart integer division `~/` is not in the shared operator set.
  [new RegExp(`${MONEY}[^;\\n]*~\\/|~\\/[^;\\n]*${MONEY}`, 'i'), 'integer division on a money figure'],
  [/\.reduce\s*\(|\.fold\s*[<(]|\.sum\b/, 'summing figures (the backend sends totals)'],
  [/toLocaleString|NumberFormat|Intl\.|\bDateFormat\s*\(/, 'locale formatting instead of formatVnd / ngayNgan'],
  [/costsView|costs\.view/, 'a permission rule in the screen (the route gates on costs.view)'],
  [/Excel|so tháng trước/, 'a control or delta cut from the story'],
];

test('every profit report file exists (port + fake + screen on both platforms, cubit + state on mobile)', () => {
  for (const rel of Object.values(FILES)) assert.ok(existsSync(resolve(repoRoot, rel)), `missing: ${rel}`);
});

test('guard is not blind: the screens have real code and every list is parsed', () => {
  assertCodeNotBlind(screens, 2000, 'profit report screens');
  assertCodeNotBlind(
    [
      ['web:port', stripTsx(read(FILES.webPort))],
      ['mobile:port', stripDart(read(FILES.mobilePort))],
      ['web:fake', stripTsx(read(FILES.webFake))],
      ['mobile:fake', stripDart(read(FILES.mobileFake))],
    ],
    300,
    'profit report port + fake',
  );
  assert.match(mobileCode, /class ProfitReportCubit\b/, 'the mobile text must include the cubit');
  assert.match(mobileCode, /final class ProfitReportState\b/, 'the mobile text must include the state');
  assertScanned(WEB_GROUP_KEYS, 4, 'web PROFIT_GROUP_OPTIONS keys');
  assertScanned(MOBILE_GROUP_KEYS, 4, 'mobile kProfitGroupTabs keys');
  assertScanned(BACKEND_GROUP_KEYS, 4, 'backend PROFIT_GROUP_BY');
});

test('the matchers catch what they must and spare the rest', () => {
  assert.ok(hasStandaloneLiteral(`const a = '${SCOPE_LABEL}';`, SCOPE_LABEL));
  assert.ok(hasStandaloneLiteral(`message: "${SCOPE_LABEL}"`, SCOPE_LABEL));
  assert.ok(!hasStandaloneLiteral(`'Lưu ý: ${SCOPE_LABEL} Thêm.'`, SCOPE_LABEL), 'nested in a longer literal');
  assert.ok(!hasStandaloneLiteral(`'${SCOPE_LABEL} Dòng tự do lãi 0.'`, SCOPE_LABEL), 'prefix of a longer literal');
  assert.deepEqual(optionKeys("export const X = [\n  { key: 'order', label: 'A' },\n  { key: 'month' },\n];", 'export const X'), [
    'order',
    'month',
  ]);
  const banned = (code) => BANNED.some(([re]) => re.test(code));
  for (const bad of [
    'row.revenue - row.cost',
    'totals.grossProfit / totals.revenue',
    '(r.grossProfit * 100)',
    'rows.reduce((t, r) => t + r.revenue, 0)',
    'rows.fold<int>(0, (t, r) => t)',
    'r.revenue.toLocaleString()',
    'NumberFormat.currency()',
    "can(perms, PERM.costsView)",
    'Xuất Excel',
    '+2,3% so tháng trước',
    'grossProfit ~/ revenue',
  ]) {
    assert.ok(banned(bad), bad);
  }
  for (const ok of [
    '<Money value={row.revenue} />',
    "formatVnd(row.grossProfit)",
    "marginPct === null ? '—' : `${marginPct}%`",
    "'${row.orderCount} đơn · DT ${formatVnd(row.revenue)}'",
  ]) {
    assert.ok(!banned(ok), ok);
  }
});

test('the mandatory label and the not-issued note are standalone literals rendered on both platforms', () => {
  for (const [name, code] of screens) {
    assert.ok(hasStandaloneLiteral(code, SCOPE_LABEL), `${name} must carry the scope label as its own literal`);
    assert.ok(hasStandaloneLiteral(code, NOT_ISSUED_NOTE), `${name} must carry the not-issued note as its own literal`);
  }
  assert.match(webCode, /<Banner tone="info"[^>]*>\s*\{PROFIT_SCOPE_LABEL\}\s*<\/Banner>/);
  assert.match(webCode, /<p className="pr-note">\{PROFIT_NOT_ISSUED_NOTE\}<\/p>/);
  assert.match(mobileCode, /AppBanner\(\s*tone: AppBannerTone\.info,[\s\S]{0,60}message: kProfitScopeLabel,/);
  assert.match(mobileCode, /child: Text\(kProfitNotIssuedNote,/);
});

test('web and mobile offer the same four groupings, exactly the backend PROFIT_GROUP_BY', () => {
  assert.deepEqual(MOBILE_GROUP_KEYS, WEB_GROUP_KEYS);
  assert.deepEqual(WEB_GROUP_KEYS, BACKEND_GROUP_KEYS);
});

test('revenue, cost and grossProfit are money fields of the contract; marginPct and orderCount are not', () => {
  const money = moneyFields();
  for (const field of ['revenue', 'cost', 'grossProfit']) assert.ok(money.includes(field), `${field} must be money`);
  for (const field of ['marginPct', 'orderCount']) assert.ok(!money.includes(field), `${field} must not be money`);
});

test('the screens never compute, sum, locale-format or gate the figures themselves', () => {
  for (const [name, code] of screens) {
    for (const [pattern, why] of BANNED) {
      assert.ok(!pattern.test(code), `${name}: ${why} (${pattern})`);
    }
  }
});

test('money is displayed through Money / formatVnd', () => {
  for (const field of ['revenue', 'cost', 'grossProfit']) {
    assert.match(webCode, new RegExp(`<Money value=\\{report\\.totals\\.${field}\\} />`), `web KPI ${field}`);
    assert.match(webCode, new RegExp(`<Money value=\\{row\\.${field}\\} />`), `web row ${field}`);
    assert.match(mobileCode, new RegExp(`formatVnd\\(totals\\.${field}\\)`), `mobile KPI ${field}`);
  }
  assert.match(mobileCode, /formatVnd\(row\.grossProfit\)/);
  assert.match(mobileCode, /formatVnd\(row\.revenue\)/);
});
