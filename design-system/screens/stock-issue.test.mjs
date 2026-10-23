// Source-guard + parity for the ORDER STOCK-OUT blocks: the "Đã giao"
// step's preview, the order detail "Phiếu xuất" frame + sheet, and the shared
// preview block, on both platforms.
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/order-stock-issue.test.tsx and
// mobile/test/screens/orders/order_stock_issue_test.dart prove the behaviour.
//
// The load-bearing rule: THE CLIENT DECIDES NOTHING (AD-2). Whether the stock is
// enough is the backend's 409, placed under the row it names. A screen that
// compares "Đơn cần" with "Tồn thật", or multiplies a quantity by a cost, is a
// second implementation of a rule that already has an owner — and the one that
// would let the warehouse believe a stock-out passed when the server refused it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { STOCK_PAIR } from '../lib/stock-figures.mjs';
import { readMobileScreen } from '../lib/read-mobile-screen.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// SAME strippers as stock-vouchers.test.mjs.
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
// Import/export directives are paths, not code: `models/qty_change_dto.dart` would read as
// "divide by qty" once the mobile port imports its generated types (Story 10.8).
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/^(?:import|export) '[^'\n]*';$/gm, '');

const WEB = [
  'web/src/screens/orders/stock-issue-preview.tsx',
  'web/src/screens/orders/OrderStatusChangeScreen.tsx',
  'web/src/screens/orders/OrderDetailScreen.tsx',
];
const MOBILE = [
  'mobile/lib/screens/orders/stock_issue_preview.dart',
  'mobile/lib/screens/orders/order_status_change_screen.dart',
  'mobile/lib/screens/orders/order_detail_screen.dart',
];
const PORTS = [
  ['web:port', stripTsx(read('web/src/design-system/session/orders-port.ts'))],
  ['mobile:port', stripDart(read('mobile/lib/design_system/session/orders_port.dart'))],
  ['web:fake', stripTsx(read('web/src/design-system/session/fake-orders-port.ts'))],
  ['mobile:fake', stripDart(read('mobile/lib/design_system/session/fake_orders_port.dart'))],
];

const screens = [
  ...WEB.map((rel) => [rel, stripTsx(read(rel))]),
  // A screen is read with its own cubit/state; the stateless preview widget alone.
  ...MOBILE.map((rel) => [rel, stripDart(rel.endsWith('_screen.dart') ? readMobileScreen(repoRoot, rel) : read(rel))]),
];
const allCode = [...screens, ...PORTS];
/**
 * The arithmetic/compare ban covers screens + ports. The orders FAKES are left
 * out on purpose: they stand in for the pricing backend and compute line
 * amounts (documented in their headers); their stock-out "not enough" branch is
 * a fixed order id, which the costPrice/label checks still see.
 */
const decisionCode = [...screens, ...PORTS.slice(0, 2)];

const MONEY = '(?:qty|unitCost|onHand)';
const CMP = '(?:<=|>=|<|>)';

/** The decisions only the backend may make — each pattern with why. */
const BANNED = [
  [new RegExp(`\\b\\w*${MONEY}\\w*\\s*[*/]`), 'multiply/divide a quantity, cost or stock'],
  [new RegExp(`[*/]\\s*[\\w.\\[\\]]*${MONEY}`), 'multiply/divide by a quantity, cost or stock'],
  [new RegExp(`\\bqty\\w*\\s*${CMP}`), 'compare a quantity (not-enough-stock is the backend\'s 409)'],
  [new RegExp(`${CMP}=?\\s*[\\w.\\[\\]]*\\bonHand\\b`), 'compare against onHand'],
  [new RegExp(`\\bonHand\\s*${CMP}`), 'compare onHand'],
  [new RegExp(`\\b\\w*(?:qty|onHand)\\w*\\s*-(?![->])`), 'subtract from a quantity or stock (a shortage is the backend\'s 409)'],
  [new RegExp(`-\\s*[\\w.\\[\\]]*\\b(?:qty|onHand)\\b`), 'subtract a quantity or stock'],
  // The preview warning is read, never re-derived: `shortfall`/`blocked` come from
  // the backend; comparing or combining two stock figures is the rule itself.
  [STOCK_PAIR, 'compare or combine two stock figures (shortfall/blocked are the backend\'s)'],
];

/** Hard-coded colours: every colour is a token (AD-13). */
const HEX = [
  [/#[0-9a-fA-F]{3,8}\b/, 'hard-code a hex colour'],
  [/Color\(0x/, 'build a Color(0x…) literal'],
];

test('chống guard rỗng: every scanned file still has code after stripping', () => {
  // Measured on the current tree: the smallest file is the web preview block
  // (~2 KB stripped). 800 chars is well under every real file.
  assertCodeNotBlind(allCode, 800, 'stock-issue guard');
});

test('no block, screen or port compares stock or multiplies money', () => {
  for (const [name, code] of decisionCode) {
    for (const [pattern, what] of BANNED) {
      assert.ok(!pattern.test(code), `${name} must not ${what} — the backend owns it (AD-2)`);
    }
  }
});

test('the ban patterns catch a real violation (guard is not toothless)', () => {
  const samples = [
    'if (d.qty > d.onHand) {}',
    'final int tien = l.qty * l.unitCost;',
    'const thieu = onHand < 2;',
    'disabled={x >= view.lines[0].onHand}',
    'const tb = tong / d.qty;',
    'const thieu = line.qty - line.onHand; if (thieu) {}',
    'final int con = tong - l.onHand;',
    'const blocked = line.shortfall > line.available;',
    'final bool thieu = l.reserved + l.qty > l.onHand;',
  ];
  for (const sample of samples) {
    assert.ok(BANNED.some(([pattern]) => pattern.test(sample)), `no ban pattern caught: ${sample}`);
  }
  assert.ok(!BANNED.some(([pattern]) => pattern.test("{d.qty}</td><td>{d.onHand}")), 'rendering a number is not a violation');
  // Dropping directives removes the path only, never the code after it.
  const stripped = stripDart("import '../models/qty_change_dto.dart';\nfinal int t = l.qty * 2;\n");
  assert.ok(!stripped.includes('qty_change_dto'), 'the import path is dropped');
  assert.ok(BANNED.some(([pattern]) => pattern.test(stripped)), 'code after a dropped import is still scanned');
  // Reading the backend's figure to pick a sentence is allowed.
  assert.ok(!BANNED.some(([pattern]) => pattern.test('line.shortfall > 0 ? a : b')), 'reading shortfall is not a violation');
});

test('ports, fakes and screens never carry the product cost price', () => {
  for (const [name, code] of allCode) {
    assert.ok(!/costPrice/.test(code), `${name} must not carry costPrice — the voucher line's unitCost is the only cost, gated on costs.view`);
  }
  assert.ok(/costPrice/.test('const x = p.costPrice;'), 'the costPrice probe must fire on a real reference');
});

test('no hard-coded colour in the stock-out blocks (tokens only)', () => {
  for (const [name, code] of screens) {
    for (const [pattern, what] of HEX) {
      assert.ok(!pattern.test(code), `${name} must not ${what}`);
    }
  }
  assert.ok(HEX[0][0].test("color: '#FF0000'"));
  assert.ok(HEX[1][0].test('const Color(0xFF00FF00)'));
});

test('no screen carries the raw "Đã giao" event literal — it comes from the port', () => {
  for (const [name, code] of screens) {
    assert.ok(!code.includes("'xong_giao'"), `${name} must import the event constant, not the literal`);
  }
  assert.ok(screens[1][1].includes('EVENT_DELIVERED'), 'web status-change screen must branch on EVENT_DELIVERED');
  assert.ok(screens[4][1].includes('kEventDelivered'), 'mobile status-change screen must branch on kEventDelivered');
});

test('every label is present on BOTH platforms, byte-for-byte (UX-DR-27)', () => {
  const web = screens.slice(0, WEB.length).map(([, c]) => c).join('\n');
  const mobile = screens.slice(WEB.length).map(([, c]) => c).join('\n');
  const LABELS = [
    'lần duy nhất',
    'đơn này trừ tồn kho.',
    'Một Đơn — một phiếu xuất.',
    'Đếm hàng thực tế trước khi xác nhận.',
    'Đơn cần',
    'Tồn thật',
    'Không theo kho — không có trong phiếu xuất',
    'Xác nhận xuất kho & chuyển Đã giao',
    'Đã xuất kho · ',
    'Phiếu xuất kho',
    'Xuất kho',
    'Xác nhận xuất kho',
    'Chưa xuất kho.',
    'CHẶN xuất kho — ',
    ' không đủ tồn thật (cần ',
    'Đơn này đã được chốt dù thiếu hàng; chặn chỉ nằm ở đây. Nhập hàng trước khi xuất.',
    'Thiếu ',
    'Xuất kho (bị chặn)',
  ];
  for (const label of LABELS) {
    assert.ok(web.includes(label), `web must render "${label}"`);
    assert.ok(mobile.includes(label), `mobile must render "${label}"`);
  }
  // A label that is a prefix of a longer one ("Phiếu xuất" ⊂ "Phiếu xuất kho")
  // is matched as the frame's exact label, or a removed frame would stay green.
  assert.ok(web.includes('label="Phiếu xuất"'), 'web order detail must keep the "Phiếu xuất" frame');
  assert.ok(mobile.includes("label: 'Phiếu xuất'"), 'mobile order detail must keep the "Phiếu xuất" frame');
});

test('the confirm buttons lock on the backend\'s `blocked`, on both platforms', () => {
  const [webStatus, webDetail] = [screens[1][1], screens[2][1]];
  const [mobStatus, mobDetail] = [screens[WEB.length + 1][1], screens[WEB.length + 2][1]];
  assert.ok(/stockIssue\.blocked/.test(webStatus), 'web status change must lock on stockIssue.blocked');
  assert.ok(/disabled=\{issuing \|\| stockIssue\.blocked\}/.test(webDetail), 'web detail sheet must lock on stockIssue.blocked');
  assert.ok(/_stockIssue!\.blocked/.test(mobStatus), 'mobile status change must lock on blocked');
  assert.ok(/_sending \|\| _view\.blocked \? null/.test(mobDetail), 'mobile detail sheet must lock on blocked');
});

test('the row error is placed from the backend\'s `lines.{i}.qty`, on both platforms', () => {
  const webPreview = screens[0][1];
  const mobilePreview = screens[WEB.length][1];
  assert.ok(webPreview.includes('lines\\.(\\d+)\\.qty'), 'web must map fieldErrors lines.{i}.qty to row i');
  assert.ok(mobilePreview.includes('lines\\.(\\d+)\\.qty'), 'mobile must map fieldErrors lines.{i}.qty to row i');
});

test('the Phiếu kho screens tell an order-bound stock-out from a free one, with the same words', () => {
  const web = stripTsx(read('web/src/screens/inventory/StockVouchersScreen.tsx'));
  const mobile = stripDart(readMobileScreen(repoRoot, 'mobile/lib/screens/inventory/stock_vouchers_screen.dart'));
  for (const label of ['Xuất kho · gắn đơn', 'Gắn đơn', 'Người xác nhận', 'Một Đơn — một phiếu xuất.']) {
    assert.ok(web.includes(label), `web Phiếu kho must render "${label}"`);
    assert.ok(mobile.includes(label), `mobile Phiếu kho must render "${label}"`);
  }
  assert.ok(/orderId\s*!==\s*undefined/.test(web), 'web must branch on orderId presence');
  assert.ok(/orderId\s*!=\s*null/.test(mobile), 'mobile must branch on orderId presence');
});
