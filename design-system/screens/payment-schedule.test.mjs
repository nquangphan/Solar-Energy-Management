// Source-guard + parity for the LỊCH THANH TOÁN screens (Stories 7.1–7.2).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/payment-schedule-screen.test.tsx and
// mobile/test/screens/payments/payment_schedule_screen_test.dart are the lanes
// that prove the behaviour.
//
// The load-bearing rules:
//  - THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16): installment amounts, the
//    schedule total, the difference, whether it matches, what is paid and what
//    is left are the backend's. No screen, port or fake adds, subtracts,
//    multiplies or divides them.
//  - Both platforms show the SAME Vietnamese labels.
//  - "Ghi nhận" (record a payment) is offered only behind the backend's
//    `recordable` AND payments.record, and only on an installment not yet paid.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// SAME strippers as stock-vouchers.test.mjs.
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const webCode = stripTsx(read('web/src/screens/payments/PaymentScheduleScreen.tsx'));
const mobileCode = stripDart(read('mobile/lib/screens/payments/payment_schedule_screen.dart'));

const screens = [
  ['web:screen', webCode],
  ['mobile:screen', mobileCode],
];
const allCode = [
  ...screens,
  ['web:port', stripTsx(read('web/src/design-system/session/payments-port.ts'))],
  ['mobile:port', stripDart(read('mobile/lib/design_system/session/payments_port.dart'))],
  ['web:fake', stripTsx(read('web/src/design-system/session/fake-payments-port.ts'))],
  ['mobile:fake', stripDart(read('mobile/lib/design_system/session/fake_payments_port.dart'))],
];

/** Labels both platforms must render verbatim. */
const SHARED_LABELS = [
  'Lịch thanh toán',
  'Các đợt thanh toán',
  'Điều kiện',
  'Tỉ lệ',
  'Số tiền',
  ' · Cọc',
  ' · Tất toán',
  'Tổng lịch',
  'Tổng đơn (sau VAT)',
  'Tổng các đợt lệch tổng đơn sau VAT',
  'Đơn chưa có lịch thanh toán.',
  'Cấu hình lịch',
  'Sửa lịch',
  'Lưu lịch',
  'Đang lưu…',
  'Huỷ',
  'Thêm đợt',
  'Xoá đợt',
  'Tải lại',
  '20/70/10',
  '100%',
  'Tuỳ chỉnh',
  'Tỉ lệ (%)',
  'Số tiền (đồng)',
  'Cọc khi ký hợp đồng',
  'Khi thi công',
  'Khi nghiệm thu, bàn giao',
  'Thanh toán toàn bộ',
  'Không tải được lịch thanh toán.',
  'Không lưu được lịch thanh toán. Vui lòng thử lại.',
  // payment recording (Story 7.2)
  'Tiến độ công nợ',
  'Đã thu',
  'Còn lại',
  'Tiến độ',
  '% / 100%',
  'Tổng đơn',
  'Trạng thái',
  'Thu một phần',
  'Chưa thu',
  'Thu ',
  'Chuyển khoản',
  'Tiền mặt',
  'Ghi nhận',
  'Ghi nhận thanh toán · Đợt ',
  'Ghi nhận đợt ',
  ' cho Đợt ',
  'Khi đủ đợt cọc, đơn sẽ tự chuyển sang Đã cọc.',
  'Số tiền thu',
  'Ngày thu',
  'Phương thức',
  'Ghi chú',
  'Đang ghi nhận…',
  'Đơn đã chuyển sang ',
  'Đã ghi nhận tiền. Trạng thái đơn chưa đổi: ',
  'Không ghi nhận được thanh toán. Vui lòng thử lại.',
];

// `amount` (case-insensitive, inside a word) also covers paidAmount / remainingAmount.
const MONEY = '(?:amount|orderTotal|scheduledTotal|difference|paidTotal|remainingTotal)';

/** The computations only the backend may do — each pattern with why. */
const BANNED = [
  [new RegExp(`\\b\\w*${MONEY}\\w*\\s*[-+*/]\\s*[\\w(]`, 'i'), 'arithmetic on a money figure'],
  [new RegExp(`[-+*/]\\s*[\\w.]*\\b${MONEY}\\b`), 'arithmetic onto a money figure'],
  [/\.reduce\(|\.fold</, 'summing installments (scheduledTotal is the backend’s)'],
  [/Math\.(?:floor|round|ceil)/, 'rounding money'],
];

test('guard is not blind: every scanned file has real code', () => {
  assertCodeNotBlind(allCode, 500, 'payment-schedule sources');
});

test('both platforms render the same Vietnamese labels', () => {
  for (const label of SHARED_LABELS) {
    for (const [name, code] of screens) {
      assert.ok(code.includes(label), `${name} must render "${label}"`);
    }
  }
});

test('"Ghi nhận" is gated on the backend `recordable` AND payments.record, on unpaid installments only', () => {
  assert.match(
    webCode,
    /schedule\.recordable\s*&&\s*can\(perms,\s*PERMISSION_KEYS\.paymentsRecord\)/,
  );
  assert.match(webCode, /canRecord\s*&&\s*i\.status\s*!==\s*'paid'/);
  assert.match(
    mobileCode,
    /_schedule\?\.recordable \?\? false\)\s*&&\s*can\(widget\.perms,\s*AppPermissionKeys\.paymentsRecord\)/,
  );
  assert.match(mobileCode, /_canRecord\s*&&\s*i\.status\.json\s*!=\s*'paid'/);
});

test('recording goes through a confirm dialog on both platforms', () => {
  assert.match(webCode, /<ConfirmDialog\b/);
  assert.match(mobileCode, /AppConfirmDialog\(/);
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
  const samples = [
    'const sum = installments.reduce((s, i) => s + i.amount, 0);',
    'const diff = orderTotal - scheduledTotal;',
    'final x = (orderTotal * percent / 100).floor();',
    'Math.floor(orderTotal * 20 / 100)',
    'const left = orderTotal - paidTotal;',
    'final left = installment.amount - installment.paidAmount;',
  ];
  for (const sample of samples) {
    assert.ok(
      BANNED.some(([p]) => p.test(sample)),
      `a banned pattern must match: ${sample}`,
    );
  }
});

test('the edit button is gated on the backend `editable` AND payments.record on both platforms', () => {
  assert.match(webCode, /schedule\.editable\s*&&\s*can\(perms,\s*PERMISSION_KEYS\.paymentsRecord\)/);
  assert.match(mobileCode, /\.editable/);
  assert.match(mobileCode, /AppPermissionKeys\.paymentsRecord/);
  assert.ok(!/\bAppPerm\./.test(mobileCode), 'mobile must use AppPermissionKeys, not AppPerm');
});
