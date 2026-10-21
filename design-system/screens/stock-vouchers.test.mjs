// Source-guard + parity for the PHIẾU KHO screens (Story 6.3).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/stock-vouchers-screen.test.tsx and
// mobile/test/screens/inventory/stock_vouchers_screen_test.dart are the lanes
// that prove the behaviour.
//
// The load-bearing rule: THE CLIENT COMPUTES NOTHING (AD-2). The voucher's
// money (quantity × cost), the weighted-average cost, the total quantity and the
// "not enough stock" refusal are the backend's. A screen that multiplies a
// quantity by a cost, or compares a quantity against what is on hand, is a
// second implementation of a rule that already has an owner.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_SCREEN = 'web/src/screens/inventory/StockVouchersScreen.tsx';
const WEB_CSS = 'web/src/screens/inventory/stock-vouchers.css';
const MOBILE_SCREEN = 'mobile/lib/screens/inventory/stock_vouchers_screen.dart';
const WEB_PORT = 'web/src/design-system/session/stock-vouchers-port.ts';
const MOBILE_PORT = 'mobile/lib/design_system/session/stock_vouchers_port.dart';
const WEB_FAKE = 'web/src/design-system/session/fake-stock-vouchers-port.ts';
const MOBILE_FAKE = 'mobile/lib/design_system/session/fake_stock_vouchers_port.dart';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// SAME strippers as inventory.test.mjs.
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const webCode = stripTsx(read(WEB_SCREEN));
const mobileCode = stripDart(read(MOBILE_SCREEN));
const webPortCode = stripTsx(read(WEB_PORT));
const mobilePortCode = stripDart(read(MOBILE_PORT));
const webFakeCode = stripTsx(read(WEB_FAKE));
const mobileFakeCode = stripDart(read(MOBILE_FAKE));
const css = read(WEB_CSS);

const screens = [
  ['web:screen', webCode],
  ['mobile:screen', mobileCode],
];
/** Every file a "must not compute" rule scans, comment-stripped. */
const allCode = [
  ...screens,
  ['web:port', webPortCode],
  ['mobile:port', mobilePortCode],
  ['web:fake', webFakeCode],
  ['mobile:fake', mobileFakeCode],
];

const MONEY = '(?:qty|unitCost|costPrice)';
const CMP = '(?:<=|>=|<|>)';

/** The computations only the backend may do — each pattern with why. */
const BANNED = [
  [new RegExp(`\\b\\w*${MONEY}\\w*\\s*[*/]`), 'multiply/divide a quantity or a cost (no line total, no average)'],
  [new RegExp(`[*/]\\s*[\\w.]*${MONEY}`), 'multiply/divide by a quantity or a cost'],
  [new RegExp(`\\bqty\\w*\\s*${CMP}`), 'compare a quantity (the stock-out refusal is the backend\'s)'],
  [new RegExp(`${CMP}=?\\s*[\\w.]*\\bonHand\\b`), 'compare against onHand'],
  [new RegExp(`\\bonHand\\s*${CMP}`), 'compare onHand'],
];

/** Summing lines is the backend's `tongSoLuong` — the screens only show it. */
const SUM_IN_SCREEN = /\.reduce\(|\.fold</;

test('no screen, port or fake multiplies money or compares a quantity with stock', () => {
  for (const [name, code] of allCode) {
    for (const [pattern, what] of BANNED) {
      assert.ok(!pattern.test(code), `${name} must not ${what} — the backend owns it (AD-2)`);
    }
  }
  for (const [name, code] of screens) {
    assert.ok(!SUM_IN_SCREEN.test(code), `${name} must not sum lines — tongSoLuong arrives computed`);
  }
});

test('the ban patterns catch a real violation (guard is not toothless)', () => {
  const samples = [
    'const tien = line.qty * line.unitCost;',
    'const tien = unitCost * 2;',
    'const tb = tong / d.qty;',
    'if (qty > item.onHand) {}',
    'if (d.qty >= 1) {}',
    'if (item.onHand < 3) {}',
    'disabled={x > sp.onHand}',
  ];
  for (const sample of samples) {
    assert.ok(
      BANNED.some(([pattern]) => pattern.test(sample)),
      `no ban pattern caught: ${sample}`,
    );
  }
  assert.ok(SUM_IN_SCREEN.test('lines.reduce((a, l) => a + l.qty, 0)'));
  assert.ok(SUM_IN_SCREEN.test('lines.fold<int>(0, (a, l) => a + l.qty)'));
});

test('ports and fakes never carry the product cost price', () => {
  for (const [name, code] of allCode.slice(2)) {
    assert.ok(!/costPrice/.test(code), `${name} must not carry costPrice — it is read in the catalogue, gated on costs.view`);
  }
});

// The +N / −N sign comes from the type as TEXT; the cost column only when the field is there.
test('both screens glue the sign from the type and render cost only when present', () => {
  for (const [name, code] of screens) {
    assert.ok(code.includes("'+'") && code.includes("'−'"), `${name} must glue +/− from the type`);
    assert.ok(/unitCost\s*!==?\s*(?:undefined|null)/.test(code), `${name} must branch on unitCost presence`);
  }
});

test('both screens speak the same sentences (UX-DR-27)', () => {
  const words = [
    'Phiếu kho',
    'Tạo phiếu',
    'Chi tiết phiếu',
    'Nhập kho',
    'Xuất kho · không gắn đơn',
    'Người tạo',
    'Ghi chú',
    'Giá vốn / đv',
    'Giá vốn / đv *',
    'Tồn đầu kỳ',
    'Lưu phiếu',
    'Tạo phiếu kho',
    'Tìm sản phẩm để thêm dòng',
    'Chưa có phiếu kho nào. Bấm Tạo phiếu để bắt đầu.',
    'Không tải được phiếu kho.',
    'Không tải được chi tiết phiếu.',
    'Giá vốn ở đây không được bỏ trống. Hệ thống lấy nó tính bình quân gia quyền rồi cập nhật giá vốn hiện hành của sản phẩm — một chỗ gõ, không ai phải nhớ sửa hai nơi.',
    'Phiếu xuất không gắn đơn (hàng hỏng, mẫu, điều chỉnh). Không sửa/xoá sau khi lưu.',
  ];
  for (const w of words) {
    assert.ok(webCode.includes(w), `web screen missing "${w}"`);
    assert.ok(mobileCode.includes(w), `mobile screen missing "${w}"`);
  }
});

// Return vouchers (stock counted back from a cancelled order's stock-out): same UX copy on both.
test('both screens carry the return voucher copy verbatim', () => {
  const words = [
    'Nhập trả',
    'Tạo phiếu nhập trả',
    'Xác nhận nhập trả',
    'Phiếu xuất gốc',
    'Gắn đơn',
    'Đã xuất',
    'Nhận lại',
    'Nhập trả · từ đơn huỷ',
    'Nhập số nhận lại (0 nếu không nhận lại).',
    'Đơn đã huỷ sau khi xuất kho. Tồn kho không tự cộng lại — hàng chỉ về kho khi có người đếm và xác nhận phiếu này.',
    'Nhận lại ít hơn đã xuất là chuyện bình thường (hàng đã cắt, đã lắp, hỏng). Nhập đúng số đếm được — không ép cho khớp.',
    'Xác nhận → cộng tồn thật đúng số đếm được, Audit ghi người nhận. Không sửa/xoá sau khi lưu.',
  ];
  for (const w of words) {
    assert.ok(webCode.includes(w), `web screen missing "${w}"`);
    assert.ok(mobileCode.includes(w), `mobile screen missing "${w}"`);
  }
});

// COMPOSED FROM THE SHIPPED DESIGN SYSTEM (AD-13).
test('both screens compose shipped components instead of inventing widgets', () => {
  for (const name of ['Table', 'Frame', 'Sheet', 'EmptyState', 'ErrorState', 'Skeleton']) {
    assert.ok(webCode.includes(`<${name}`), `the web screen must compose <${name}>`);
  }
  for (const name of ['AppFrame', 'AppCard', 'AppSheet', 'AppChip', 'AppEmptyState', 'AppErrorState', 'AppSkeleton']) {
    assert.ok(mobileCode.includes(name), `the mobile screen must compose ${name}`);
  }
  assert.ok(webCode.includes('activeKey="inventory"'), 'web screen must mark the Kho nav item active');
  assert.ok(mobileCode.includes('kInventoryTabIndex'), 'mobile screen must mark the Kho tab active');
});

test('colours come from tokens, never from a literal', () => {
  for (const token of ['var(--ok)', 'var(--warn)']) {
    assert.ok(webCode.includes(token), `web screen must take a colour from ${token}`);
  }
  for (const token of ['AppTokens.ok', 'AppTokens.warn']) {
    assert.ok(mobileCode.includes(token), `mobile screen must take a colour from ${token}`);
  }
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(webCode), 'web screen must not hard-code a hex colour');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'stock-vouchers.css must not invent a colour');
  assert.ok(!/Color\(0x/.test(mobileCode), 'mobile screen must not hard-code a colour literal');
});

// Anti-empty: every "must not contain" check above scans these sources.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ...allCode], 300, 'stock-vouchers');
});
