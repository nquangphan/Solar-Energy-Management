// Source-guard + parity for the SINH HỢP ĐỒNG screens (Story 7.3).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/contracts-screen.test.tsx and
// mobile/test/screens/contracts/contracts_screen_test.dart are the lanes that
// prove the behaviour.
//
// The load-bearing rules:
//  - THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16): the contract type, the total,
//    the schedule label, whether the order can get a contract and which company
//    fields are unset are the backend's.
//  - The contract type is DERIVED by the server from the order's scope flags, so
//    neither screen offers a selector for it.
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
  webScreen: 'web/src/screens/contracts/ContractsScreen.tsx',
  mobileScreen: 'mobile/lib/screens/contracts/contracts_screen.dart',
  webPort: 'web/src/design-system/session/contracts-port.ts',
  mobilePort: 'mobile/lib/design_system/session/contracts_port.dart',
  webFake: 'web/src/design-system/session/fake-contracts-port.ts',
  mobileFake: 'mobile/lib/design_system/session/fake_contracts_port.dart',
};

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// SAME strippers as payment-schedule.test.mjs. Labels are checked on RAW text
// would also work, but they live in code, not comments, so stripped is stricter.
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const webCode = stripTsx(read(FILES.webScreen));
const mobileCode = stripDart(readMobileScreen(repoRoot, FILES.mobileScreen));

const screens = [
  ['web:screen', webCode],
  ['mobile:screen', mobileCode],
];
const allCode = [
  ...screens,
  ['web:port', stripTsx(read(FILES.webPort))],
  ['mobile:port', stripDart(read(FILES.mobilePort))],
  ['web:fake', stripTsx(read(FILES.webFake))],
  ['mobile:fake', stripDart(read(FILES.mobileFake))],
];

/** Labels both platforms must render verbatim (story 7.3 "Nhãn hiển thị chung"). */
const SHARED_LABELS = [
  'Sinh hợp đồng',
  'HỢP ĐỒNG',
  'Trường động đưa vào HĐ',
  'Loại HĐ',
  'HĐ Thi công',
  'HĐ Mua bán',
  'Hai bên',
  'Vật tư',
  'dòng · snapshot đơn',
  'Tổng tiền',
  'Lịch TT',
  'Số BG',
  'Điều khoản là template tĩnh; sinh HĐ ghi Audit log.',
  'Thông tin pháp nhân chưa cấu hình: ',
  'Hợp đồng vẫn xuất được — các ô này in “Chưa cấu hình”.',
  'Xuất PDF hợp đồng',
  'Hợp đồng đã sinh',
  'Bản ',
  'Tải PDF',
  'Chưa sinh hợp đồng nào.',
  'Thử lại',
  'Không tải được thông tin hợp đồng.',
  'Không xuất được hợp đồng. Vui lòng thử lại.',
  ' · B: Phương Nam',
];

const MONEY = '(?:amount|orderTotal|total)';

/** The computations only the backend may do — each pattern with why. */
const BANNED = [
  ...moneyArithmeticBans(MONEY),
  [/\.reduce\(|\.fold</, 'summing figures (the backend sends totals)'],
  [/Math\.(?:floor|round|ceil)/, 'rounding money'],
];

test('every contracts file exists (port + fake + screen on both platforms)', () => {
  for (const rel of Object.values(FILES)) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

test('guard is not blind: every scanned file has real code', () => {
  assertCodeNotBlind(allCode, 500, 'contracts sources');
});

test('both platforms render the same Vietnamese labels', () => {
  for (const label of SHARED_LABELS) {
    for (const [name, code] of screens) {
      assert.ok(code.includes(label), `${name} must render "${label}"`);
    }
  }
});

test('the screens talk only to their port (no fetch/http, no DB, no other session)', () => {
  assert.match(webCode, /port\.getOverview\(/);
  assert.match(webCode, /port\.generateContract\(/);
  assert.match(webCode, /port\.downloadContractPdf\(/);
  assert.match(mobileCode, /\b_port\.getOverview\(_orderId\)/);
  assert.match(mobileCode, /\b_port\.generateContract\(_orderId\)/);
  assert.match(mobileCode, /\b_port\.downloadContractPdf\(_orderId, contractId\)/);
  for (const [name, code] of screens) {
    assert.ok(!/\bfetch\(|axios|package:http\/|HttpClient/.test(code), `${name} must not call HTTP directly`);
  }
});

test('the total renders only through the money component', () => {
  assert.match(webCode, /<Money value=\{overview\.orderTotal\}\s*\/>/);
  assert.match(mobileCode, /MoneyText\(o\.orderTotal\.toInt\(\)\)/);
  for (const [name, code] of screens) {
    assert.ok(!/\$\{[^}]*orderTotal[^}]*\}/.test(code), `${name} must not interpolate orderTotal as text`);
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
    'final x = installments.fold<int>(0, (s, i) => s + i.amount);',
    'const s = list.reduce((a, b) => a + b.amount, 0);',
    'Math.round(total / 3)',
    'final x = o.orderTotal.toInt() - paid;',
    'final x = y - (o?.orderTotal ?? 0);',
  ]) {
    assert.ok(BANNED.some(([p]) => p.test(sample)), `a banned pattern must match: ${sample}`);
  }
});

test('the contract type is shown read-only — no selector offers a choice the server already made', () => {
  for (const [name, code] of screens) {
    assert.ok(!/\bSeg\b|<Seg|AppSeg|SegmentedButton|<select|DropdownButton|AppDropdown/.test(code), `${name} must not offer a type selector`);
    assert.ok(!/generateContract\([^)]*,/.test(code), `${name} must not send a type to generateContract`);
  }
});

test('a blocked order hides the button; missing company fields only warn', () => {
  assert.match(webCode, /\{overview\.generatable && \(/);
  assert.match(webCode, /\{!overview\.generatable && \(/);
  assert.match(mobileCode, /if \(!o\.generatable\)/);
  assert.match(mobileCode, /if \(o\.generatable\)/);
  for (const [name, code] of screens) {
    assert.ok(!/missingPartyFields[^;\n]*disabled|disabled[^;\n]*missingPartyFields/.test(code), `${name}: missing company fields must not disable the button`);
    assert.ok(!/ConfirmDialog|AppConfirmDialog\(/.test(code), `${name}: generating is not a money action — no confirm dialog`);
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

test('the money guard watches orderTotal but not the contract counters (AC-14)', () => {
  const fields = moneyFields();
  assert.ok(fields.length > 10, 'the money field list must not be empty');
  assert.ok(fields.includes('orderTotal'), 'orderTotal is money');
  for (const notMoney of ['pdfSize', 'versionNo', 'lineCount', 'seq']) {
    assert.ok(!fields.includes(notMoney), `${notMoney} is not money`);
  }
});
