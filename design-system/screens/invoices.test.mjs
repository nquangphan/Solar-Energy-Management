// Source-guard + parity for the HOÁ ĐƠN BÁN HÀNG screens (Story 7.4) and the
// Xem hoá đơn screens (Story 7.5).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/invoices-screen.test.tsx and
// mobile/test/screens/invoices/invoices_screen_test.dart (+ the
// invoice-detail twins) are the lanes that prove the behaviour.
//
// The load-bearing rules:
//  - THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16): the total, whether the
//    order can be invoiced and which invoice belongs to the current version are
//    the backend's.
//  - Creating an invoice is an irreversible money document, so both platforms
//    go through a confirm dialog before calling the port.
//  - "Xuất PDF" lives ONLY on the detail screens and goes export → download →
//    share through the port, without a confirm (the backend renders once and
//    returns the same file afterwards). The list opens a detail with "Xem".
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
  webDetail: 'web/src/screens/invoices/InvoiceDetailScreen.tsx',
  mobileDetail: 'mobile/lib/screens/invoices/invoice_detail_screen.dart',
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
const webDetailRaw = read(FILES.webDetail);
const mobileDetailRaw = read(FILES.mobileDetail);
const webDetailCode = stripTsx(webDetailRaw);
const mobileDetailCode = stripDart(mobileDetailRaw);
const details = [
  ['web:detail', webDetailCode],
  ['mobile:detail', mobileDetailCode],
];

const screens = [
  ['web:screen', webCode],
  ['mobile:screen', mobileCode],
];
const rawScreens = [
  ['web:screen', webRaw],
  ['mobile:screen', mobileRaw],
];
const rawDetails = [
  ['web:detail', webDetailRaw],
  ['mobile:detail', mobileDetailRaw],
];
const allCode = [
  ...screens,
  ...details,
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

/** Labels both detail screens must render verbatim (story 7.5 "Nhãn hiển thị chung"). */
const DETAIL_LABELS = [
  'Hoá đơn bán hàng',
  'HOÁ ĐƠN',
  'Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).',
  'HOÁ ĐƠN BÁN HÀNG',
  'Số HĐ',
  'Ngày lập',
  'Gắn đơn',
  ' · Bản ',
  'Người bán',
  'Tên công ty',
  'MST',
  'Địa chỉ',
  'Điện thoại',
  'Tài khoản ngân hàng',
  'Chưa cấu hình',
  'Khách hàng',
  'MST khách',
  'Không có MST',
  'Tổng trước VAT',
  'Chiết khấu',
  'VAT ',
  'Không áp VAT',
  'Tổng thanh toán',
  'Chưa xuất PDF',
  'Đã xuất PDF · ',
  'Xuất PDF',
  'Không xuất được PDF hoá đơn. Vui lòng thử lại.',
  'Không tải được hoá đơn.',
  'Thử lại',
];

/**
 * Line-table headers: web only. Mobile follows the mockup's two columns
 * (`name ×qty` | amount) so a long name wraps on a 320 px phone; it has no header.
 */
const WEB_DETAIL_ONLY_LABELS = ['Hạng mục', 'SL', 'Đơn giá', 'Thành tiền'];

const MONEY =
  '(?:amount|orderTotal|total|subtotal|vatAmount|discountAmount|unitPrice)';

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

test('every detail file has real code (not blind)', () => {
  assertCodeNotBlind(details, 2000, 'invoice detail screens');
  assertCodeNotBlind(rawDetails, 3000, 'invoice detail screens (raw)');
});

test('both detail screens render the same Vietnamese labels', () => {
  // A label that sits inside a longer label ("MST" in "MST khách", "HOÁ ĐƠN" in "HOÁ ĐƠN BÁN
  // HÀNG") would be found inside the longer one even when deleted, so it must stand alone as a
  // whole string literal or JSX text.
  const nested = DETAIL_LABELS.filter((label) =>
    DETAIL_LABELS.some((other) => other !== label && other.includes(label)),
  );
  assert.deepEqual(nested.sort(), ['HOÁ ĐƠN', 'MST'], 'the nested-label set must not go blind');
  for (const label of DETAIL_LABELS) {
    for (const [name, code] of details) {
      assert.ok(code.includes(label), `${name} must render "${label}"`);
      if (nested.includes(label)) {
        assert.ok(
          new RegExp(`["'>]${label}["'<]`).test(code),
          `${name} must render "${label}" on its own, not only inside a longer label`,
        );
      }
    }
  }
  for (const label of WEB_DETAIL_ONLY_LABELS) {
    assert.ok(webDetailCode.includes(`>${label}<`), `web:detail must render the "${label}" header`);
  }
  for (const [name, code] of rawDetails) {
    assert.ok(!/Hóa|hóa/.test(code), `${name} must spell "Hoá", not "Hóa"`);
  }
});

test('"Xuất PDF" lives only on the detail screens; the list opens them with "Xem"', () => {
  for (const [name, code] of rawScreens) {
    assert.ok(!code.includes('Xuất PDF'), `${name} must not render "Xuất PDF" — the detail screen owns it`);
    assert.ok(!code.includes('Xem lại'), `${name} must not render "Xem lại" (not a mockup label)`);
  }
  for (const [name, code] of rawDetails) {
    assert.ok(!code.includes('Xem lại'), `${name} must not render "Xem lại"`);
  }
  // The list's "Xem" is gated on the caller's callback.
  assert.match(webCode, /\{onOpenInvoice !== undefined && \(/);
  assert.match(webCode, /onClick=\{\(\) => onOpenInvoice\(inv\.id\)\}\s*>\s*Xem\s*</);
  assert.match(mobileCode, /if \(widget\.onOpenInvoice != null\)/);
  assert.match(mobileCode, /label:\s*'Xem'/);
});

test('"Xuất PDF" goes export → download → share through the port, once, without a confirm', () => {
  const flows = [
    ['web:detail', webDetailCode, /port\.exportInvoicePdf\(orderId, invoiceId\);\s*const pdf = await port\.downloadInvoicePdf\(orderId, invoiceId\);\s*await shareFiles\(/],
    [
      'mobile:detail',
      mobileDetailCode,
      /widget\.port\.exportInvoicePdf\(widget\.orderId, widget\.invoiceId\);\s*final InvoicePdfFile file =\s*await widget\.port\s*\.downloadInvoicePdf\(widget\.orderId, widget\.invoiceId\);\s*final AppShareFn share = widget\.shareImpl \?\? platformShareXFiles;/,
    ],
  ];
  for (const [name, code, flow] of flows) {
    assert.match(code, flow, `${name}: export, then download, then share`);
    assert.equal((code.match(/\.exportInvoicePdf\(/g) ?? []).length, 1, `${name} must export in exactly one place`);
    assert.ok(!/ConfirmDialog/.test(code), `${name}: exporting is not confirmed (it is idempotent)`);
    assert.ok(!/\bfetch\(|axios|package:http\/|HttpClient/.test(code), `${name} must not call HTTP directly`);
    assert.match(code, /\.getInvoice\(/, `${name} must load through the port`);
  }
  // In flight ⇒ the button cannot be pressed again.
  assert.match(webDetailCode, /if \(inFlight\.current\) return;/);
  assert.match(webDetailCode, /disabled=\{busy\}\s*onClick=\{\(\) => void exportPdf\(\)\}/);
  assert.match(mobileDetailCode, /if \(_busy\) return;/);
  assert.match(mobileDetailCode, /onPressed: _busy \? null : _exportPdf/);
});

test('detail amounts render only through the money component', () => {
  for (const field of ['subtotal', 'discountAmount', 'vatAmount', 'total']) {
    assert.match(webDetailCode, new RegExp(`<Money value=\\{invoice\\.${field}\\}\\s*/>`), `web:detail ${field}`);
    assert.match(mobileDetailCode, new RegExp(`MoneyText\\(i\\.${field}\\)`), `mobile:detail ${field}`);
  }
  assert.match(webDetailCode, /<Money value=\{line\.unitPrice\}\s*\/>/);
  assert.match(webDetailCode, /<Money value=\{line\.amount\}\s*\/>/);
  assert.match(mobileDetailCode, /MoneyText\(line\.amount\)/);
  for (const [name, code] of details) {
    assert.ok(
      !new RegExp(`\\$\\{[^}]*${MONEY}[^}]*\\}`, 'i').test(code),
      `${name} must not interpolate an amount as text`,
    );
    assert.ok(!/toLocaleString|Intl\.|NumberFormat/.test(code), `${name} must not format money itself`);
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
  for (const money of ['unitPrice', 'amount']) {
    assert.ok(fields.includes(money), `${money} is money`);
  }
  for (const notMoney of ['vatRate', 'versionNo', 'lineCount', 'seq', 'qty', 'displayOrder', 'pdfSize']) {
    assert.ok(!fields.includes(notMoney), `${notMoney} is not money`);
  }
});
