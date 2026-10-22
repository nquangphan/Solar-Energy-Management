// Source-guard + parity for the TỒN KHO screens (Story 6.2).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/screens-render.test.tsx and
// mobile/test/screens/inventory/inventory_screen_test.dart are the lanes that
// prove the behaviour.
//
// The load-bearing rule: THE CLIENT COMPUTES NO STOCK NUMBER (AD-2). Khả dụng,
// Cần nhập, the status and the purchase list come from the backend's single
// `tinhTonKho`. A screen that subtracts `onHand − reserved`, compares Khả dụng
// against zero, or filters the negative rows itself is a second implementation
// of the number a sale promises from.
//
// ⚠️ WHAT THIS GUARD DELIBERATELY DOES NOT BAN: the literals 'du', 'het', 'am'.
// The screens MUST name them to map `tinhTrang` onto a label and a colour — a
// `switch (item.tinhTrang)` is correct architecture, not a violation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_SCREEN = 'web/src/screens/inventory/InventoryScreen.tsx';
const WEB_CSS = 'web/src/screens/inventory/inventory.css';
const MOBILE_SCREEN = 'mobile/lib/screens/inventory/inventory_screen.dart';
const WEB_PORT = 'web/src/design-system/session/inventory-port.ts';
const MOBILE_PORT = 'mobile/lib/design_system/session/inventory_port.dart';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// SAME strippers as warranty-lookup.test.mjs.
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
const css = read(WEB_CSS);

/** Every file a "must not compute" rule scans, comment-stripped. */
const allCode = [
  ['web:screen', webCode],
  ['mobile:screen', mobileCode],
  ['web:port', webPortCode],
  ['mobile:port', mobilePortCode],
];

// Any stock number compared against a constant or another stock number is the
// status re-derived client-side — `canNhap > 0` is `tinhTrang === 'am'` in
// disguise, and no behaviour test can tell the two apart.
// Contract names (web, Story 10.5) and the mobile twin's names (until 10.8).
const STOCK_NUM = '(?:available|toPurchase|khaDung|canNhap|onHand|reserved)';
const CMP = '(?:<=|>=|<|>|===?|!==?)';

/** The computations only the backend may do — each pattern with why. */
const BANNED = [
  [/onHand\s*-\s*[\w.]*reserved|reserved\s*-\s*[\w.]*onHand/, 'subtract onHand/reserved'],
  [new RegExp(`${STOCK_NUM}\\s*${CMP}\\s*-?\\d`), 'compare a stock number against a constant'],
  [new RegExp(`-?\\d\\s*${CMP}\\s*[\\w.]*${STOCK_NUM}`), 'compare a constant against a stock number'],
  [new RegExp(`${STOCK_NUM}\\s*${CMP}\\s*[\\w.]*${STOCK_NUM}`), 'compare two stock numbers'],
  [/Math\.(?:max|min|abs)\(|\.abs\(\)/, 'clamp/abs a stock number'],
  [/\.filter\(|\.where\(/, 'filter rows (the purchase list arrives built)'],
];

// (a) THE CLIENT COMPUTES NO STOCK NUMBER (AD-2).
test('no screen or port derives availability, the shortfall or the purchase list', () => {
  for (const [name, code] of allCode) {
    for (const [pattern, what] of BANNED) {
      assert.ok(!pattern.test(code), `${name} must not ${what} — the backend's tinhTonKho owns it (AD-2)`);
    }
  }
});

test('the ban patterns catch a real violation (guard is not toothless)', () => {
  const samples = [
    'const k = item.onHand - item.reserved;',
    'if (item.khaDung < 0) {}',
    'if (0 > item.khaDung) {}',
    'item.canNhap > 0 ? a : b',
    'if (item.available < 0) {}',
    'item.toPurchase > 0 ? a : b',
    'if (item.onHand <= 0) {}',
    'item.reserved > item.onHand',
    'Math.max(0, x)',
    'items.filter((i) => i.canNhap)',
    'items.where((i) => true)',
  ];
  for (const sample of samples) {
    assert.ok(
      BANNED.some(([pattern]) => pattern.test(sample)),
      `no ban pattern caught: ${sample}`,
    );
  }
});

// (b) THE STATUS IS READ, NOT DERIVED.
test('both screens branch on the stock status, naming all three statuses', () => {
  for (const [name, code, field] of [['web', webCode, 'stockStatus'], ['mobile', mobileCode, 'stockStatus']]) {
    assert.ok(code.includes(field), `${name} screen must branch on ${field}`);
    for (const status of ["'du'", "'het'", "'am'"]) {
      assert.ok(code.includes(status), `${name} screen missing the ${status} branch`);
    }
  }
});

// (c) A NEGATIVE NUMBER IS NEVER SHOWN BARE — and both twins say the same words.
test('both screens speak the same sentences (UX-DR-27)', () => {
  const words = [
    'Cần nhập',
    'Đã hứa',
    'Khả dụng',
    'Đủ',
    'Hết khả dụng',
    'Âm',
    'Tồn kho',
    'KHO · 1 KHO',
    'Danh sách cần mua · gộp mọi khả dụng âm',
    'Chưa có sản phẩm nào theo dõi tồn kho.',
    'Không tải được tồn kho.',
  ];
  for (const w of words) {
    assert.ok(webCode.includes(w), `web screen missing "${w}"`);
    assert.ok(mobileCode.includes(w), `mobile screen missing "${w}"`);
  }
});

// (d) COMPOSED FROM THE SHIPPED DESIGN SYSTEM (AD-13).
test('both screens compose shipped components instead of inventing widgets', () => {
  for (const name of ['Table', 'Frame', 'EmptyState', 'ErrorState', 'Skeleton']) {
    assert.ok(webCode.includes(`<${name}`), `the web screen must compose <${name}>`);
  }
  for (const name of ['AppCard', 'AppTable', 'AppChip', 'AppEmptyState', 'AppErrorState', 'AppSkeleton']) {
    assert.ok(mobileCode.includes(name), `the mobile screen must compose ${name}`);
  }
  assert.ok(webCode.includes('activeKey="inventory"'), 'web screen must mark the Kho nav item active');
  assert.ok(mobileCode.includes('kInventoryTabIndex'), 'mobile screen must mark the Kho tab active');
  assert.ok(/className="num mono/.test(webCode), 'web number cells must be right-aligned .num .mono');
});

// (e) NO AD-HOC PALETTE.
test('colours come from tokens, never from a literal', () => {
  for (const token of ['var(--ok)', 'var(--warn)', 'var(--danger)']) {
    assert.ok(webCode.includes(token), `web screen must take a colour from ${token}`);
  }
  for (const token of ['AppTokens.ok', 'AppTokens.warn', 'AppTokens.danger']) {
    assert.ok(mobileCode.includes(token), `mobile screen must take a colour from ${token}`);
  }
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(webCode), 'web screen must not hard-code a hex colour');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'inventory.css must not invent a colour');
  assert.ok(!/Color\(0x/.test(mobileCode), 'mobile screen must not hard-code a colour literal');
});

// (f) READ-ONLY: stock vouchers are later stories.
test('neither port offers a stock write path', () => {
  for (const [name, code] of [['web', webPortCode], ['mobile', mobilePortCode]]) {
    for (const verb of ['create', 'update', 'save', 'delete', 'post']) {
      assert.ok(
        !new RegExp(`\\b${verb}\\w*\\s*\\(`, 'i').test(code),
        `${name} InventoryPort must expose no ${verb}* method`,
      );
    }
    assert.ok(code.includes('listStock'), `${name} InventoryPort must expose listStock()`);
  }
});

// Anti-empty: every "must not contain" check above scans these sources.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ...allCode], 300, 'inventory');
});
