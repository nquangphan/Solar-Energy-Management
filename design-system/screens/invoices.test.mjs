// Source-guard + parity for the HOÁ ĐƠN BÁN HÀNG screens (Story 7.4).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/invoices-screen.test.tsx and
// mobile/test/screens/invoices/invoices_screen_test.dart are the lanes that
// prove the behaviour.
//
// The load-bearing rules:
//  - THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16): the total, whether the
//    order can be invoiced and which invoice belongs to the current version are
//    the backend's.
//  - Creating an invoice is an irreversible money document, so both platforms
//    go through a confirm dialog before calling the port.
//  - Viewing / exporting the invoice is Story 7.5: no "Xuất PDF" / "Xem lại" yet.
//  - Both platforms show the SAME Vietnamese labels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { moneyFields } from '../money/money-fields.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const FILES = {
  webScreen: 'web/src/screens/invoices/InvoicesScreen.tsx',
  mobileScreen: 'mobile/lib/screens/invoices/invoices_screen.dart',
  webPort: 'web/src/design-system/session/invoices-port.ts',
  mobilePort: 'mobile/lib/design_system/session/invoices_port.dart',
  webFake: 'web/src/design-system/session/fake-invoices-port.ts',
  mobileFake: 'mobile/lib/design_system/session/fake_invoices_port.dart',
};

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

// Labels are matched on the RAW files: a stripper that eats string literals would
// make every label check vacuous.
const webRaw = read(FILES.webScreen);
const mobileRaw = read(FILES.mobileScreen);
const webCode = stripTsx(webRaw);
const mobileCode = stripDart(mobileRaw);

const screens = [
  ['web:screen', webCode],
  ['mobile:screen', mobileCode],
];
const rawScreens = [
  ['web:screen', webRaw],
  ['mobile:screen', mobileRaw],
];
const allCode = [
  ...screens,
  ['web:port', stripTsx(read(FILES.webPort))],
  ['mobile:port', stripDart(read(FILES.mobilePort))],
  ['web:fake', stripTsx(read(FILES.webFake))],
  ['mobile:fake', stripDart(read(FILES.mobileFake))],
];

/** Labels both platforms must render verbatim (story 7.4 "Nhãn hiển thị chung"). */
const SHARED_LABELS = [
  'Hoá đơn bán hàng',
  'HOÁ ĐƠN',
  'Tạo hoá đơn từ đơn',
  'Nguồn',
  'Bản ',
  ' (snapshot)',
  'Khách hàng',
  'MST khách',
  'Không có MST',
  'Tổng tiền',
  'Số HĐ nội bộ',
  'Tự cấp khi tạo',
  'Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).',
  'Bản đơn hiện hành đã có hoá đơn ',
  'Tạo hoá đơn',
  'Tạo hoá đơn?',
  'Hoá đơn chụp lại bản ',
  ' của đơn và không sửa được sau khi tạo.',
  'Huỷ',
  'Hoá đơn đã tạo',
  'Chưa tạo hoá đơn nào.',
  'Không tạo được hoá đơn. Vui lòng thử lại.',
  'Thử lại',
];

const MONEY = '(?:amount|orderTotal|total|subtotal|vatAmount|discountAmount)';

/** The computations only the backend may do — each pattern with why. */
const BANNED = [
  [new RegExp(`\\b\\w*${MONEY}\\w*\\s*[-+*/]\\s*[\\w(]`, 'i'), 'arithmetic on a money figure'],
  [new RegExp(`[-+*/]\\s*[\\w.]*\\b${MONEY}\\b`), 'arithmetic onto a money figure'],
  [/\.reduce\(|\.fold</, 'summing figures (the backend sends totals)'],
  [/Math\.(?:floor|round|ceil)/, 'rounding money'],
];

test('every invoices file exists (port + fake + screen on both platforms)', () => {
  for (const rel of Object.values(FILES)) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

test('guard is not blind: every scanned file has real code', () => {
  assertCodeNotBlind(allCode, 500, 'invoices sources');
  assertCodeNotBlind(rawScreens, 2000, 'invoices screens (raw)');
});

test('both platforms render the same Vietnamese labels', () => {
  // Comment-stripped code (string literals kept): a label left only in a header comment
  // must not pass.
  for (const label of SHARED_LABELS) {
    for (const [name, code] of screens) {
      assert.ok(code.includes(label), `${name} must render "${label}"`);
    }
  }
});

test('the spelling is "Hoá" (project spelling), never "Hóa"', () => {
  for (const [name, code] of [...rawScreens, ['web:fake', read(FILES.webFake)], ['mobile:fake', read(FILES.mobileFake)]]) {
    assert.ok(!/Hóa|hóa/.test(code), `${name} must spell "Hoá", not "Hóa"`);
  }
});

test('the screens talk only to their port (no fetch/http, no DB, no other session)', () => {
  assert.match(webCode, /port\.getOverview\(/);
  assert.match(webCode, /port\.createInvoice\(/);
  assert.match(mobileCode, /widget\.port\.getOverview\(/);
  assert.match(mobileCode, /widget\.port\.createInvoice\(/);
  for (const [name, code] of screens) {
    assert.ok(!/\bfetch\(|axios|package:http\/|HttpClient/.test(code), `${name} must not call HTTP directly`);
    assert.ok(!/createInvoice\([^)]*,/.test(code), `${name} must send only the order id`);
  }
});

test('totals render only through the money component', () => {
  assert.match(webCode, /<Money value=\{overview\.orderTotal\}\s*\/>/);
  assert.match(webCode, /<Money value=\{\w+\.total\}\s*\/>/);
  assert.match(mobileCode, /MoneyText\(\s*\w+\.orderTotal/);
  assert.match(mobileCode, /MoneyText\(\s*\w+\.total/);
  for (const [name, code] of screens) {
    assert.ok(!/\$\{[^}]*(?:orderTotal|\.total)[^}]*\}/.test(code), `${name} must not interpolate a total as text`);
    assert.ok(!/toLocaleString|Intl\.|NumberFormat/.test(code), `${name} must not format money itself`);
  }
});

test('no screen, port or fake computes money', () => {
  for (const [name, code] of allCode) {
    for (const [pattern, what] of BANNED) {
      const m = pattern.exec(code);
      assert.equal(m, null, `${name}: ${what} — found "${m?.[0]}"`);
    }
  }
});

test('the banned patterns do catch what they claim (sanity)', () => {
  for (const sample of [
    'const t = orderTotal * 1.08;',
    'final v = subtotal + vatAmount;',
    'const s = list.reduce((a, b) => a + b.total, 0);',
    'Math.round(total / 3)',
  ]) {
    assert.ok(BANNED.some(([p]) => p.test(sample)), `a banned pattern must match: ${sample}`);
  }
});

test('creating goes through a confirm dialog on both platforms', () => {
  assert.match(webCode, /<ConfirmDialog\b/, 'web must confirm before creating');
  assert.match(mobileCode, /AppConfirmDialog\(/, 'mobile must confirm before creating');
  // The page button only OPENS the dialog; the port call runs from the dialog's confirm.
  assert.match(
    webCode,
    /onClick=\{\(\) => setConfirming\(true\)\}\s*>\s*Tạo hoá đơn\s*<\/Button>/,
    'web: the "Tạo hoá đơn" button must only open the dialog',
  );
  assert.match(webCode, /onConfirm=\{\(\) => void create\(\)\}/, 'web: the dialog confirm must create');
  assert.match(
    mobileCode,
    /label:\s*'Tạo hoá đơn',\s*variant:\s*AppButtonVariant\.primary,\s*onPressed:\s*_busy \? null : \(\) => _confirmCreate\(o\)/,
    'mobile: the "Tạo hoá đơn" button must only open the dialog',
  );
  assert.match(mobileCode, /onConfirm:\s*_create\b/, 'mobile: the dialog confirm must create');
  for (const [name, code] of screens) {
    assert.equal(
      (code.match(/\.createInvoice\(/g) ?? []).length,
      1,
      `${name} must call createInvoice in exactly one place (the confirmed create)`,
    );
  }
});

test('blocked or already invoiced hides the button; the gate is the server flag', () => {
  for (const [name, code] of screens) {
    assert.match(code, /creatable/, `${name} must gate on the server's creatable flag`);
    assert.match(code, /blockedReason/, `${name} must show the server's blockedReason`);
    assert.match(code, /currentInvoiceId/, `${name} must show the current version's invoice`);
    assert.ok(!/disabled:\s*!\s*\w*\.?creatable|disabled=\{!\w*\.?creatable/.test(code), `${name}: a blocked order HIDES the button, it does not gray it out`);
  }
});

test('viewing and exporting belong to Story 7.5 — no "Xuất PDF" / "Xem lại" yet', () => {
  for (const [name, code] of rawScreens) {
    for (const later of ['Xuất PDF', 'Xem lại']) {
      assert.ok(!code.includes(later), `${name} must not render "${later}" — Story 7.5 owns it`);
    }
  }
});

test('no screen hardcodes a permission literal, mobile uses AppPermissionKeys', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/;
  for (const [name, code] of allCode) {
    const body = code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '');
    assert.ok(!registryLike.test(body), `${name} must not hardcode a permission literal`);
  }
  assert.ok(!/\bAppPerm\./.test(mobileCode), 'mobile must use AppPermissionKeys, not AppPerm');
});

test('the money guard watches the invoice totals but not its counters (AC-10)', () => {
  const fields = moneyFields();
  assert.ok(fields.length > 10, 'the money field list must not be empty');
  for (const money of ['orderTotal', 'subtotal', 'discountAmount', 'vatAmount', 'total']) {
    assert.ok(fields.includes(money), `${money} is money`);
  }
  for (const notMoney of ['vatRate', 'versionNo', 'lineCount', 'seq']) {
    assert.ok(!fields.includes(notMoney), `${notMoney} is not money`);
  }
});
