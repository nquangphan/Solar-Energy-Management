// Source-guard + parity for the LỊCH THANH TOÁN screens (Story 7.1).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/payment-schedule-screen.test.tsx and
// mobile/test/screens/payments/payment_schedule_screen_test.dart are the lanes
// that prove the behaviour.
//
// The load-bearing rules:
//  - THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16): installment amounts, the
//    schedule total, the difference and whether it matches are the backend's.
//    No screen, port or fake adds, subtracts, multiplies or divides them.
//  - Both platforms show the SAME Vietnamese labels.
//  - Recording payments is the next story: no "Ghi nhận" on this screen.

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
];

const MONEY = '(?:amount|orderTotal|scheduledTotal|difference)';

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

test('no "Ghi nhận" (payment recording belongs to the next story)', () => {
  for (const [name, code] of screens) {
    assert.ok(!code.includes('Ghi nhận'), `${name} must not offer "Ghi nhận"`);
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
  const samples = [
    'const sum = installments.reduce((s, i) => s + i.amount, 0);',
    'const diff = orderTotal - scheduledTotal;',
    'final x = (orderTotal * percent / 100).floor();',
    'Math.floor(orderTotal * 20 / 100)',
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
