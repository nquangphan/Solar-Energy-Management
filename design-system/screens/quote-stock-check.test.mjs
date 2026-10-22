// Source-guard + parity for the QUOTE early stock warning: the quote screen's
// per-line hint and warn banner, and the CartLineRow `stockHint` twins, on both
// platforms.
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/quote-stock-check.test.tsx and
// mobile/test/screens/orders/quote_stock_check_test.dart prove the behaviour.
//
// The load-bearing rule: THE CLIENT DECIDES NOTHING (AD-2). Enough/short,
// available and the shortfall are the backend's (`GET /orders/:id/stock-check`);
// the screen picks its sentence from `status` and prints the figures. A screen
// that compares a quantity with what is available is a second stock rule — and
// the one that would tell a seller "in stock" when the backend says otherwise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STOCK_PAIR } from '../lib/stock-figures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// SAME strippers as stock-issue.test.mjs: comments go, string literals STAY — the
// label checks below read the user-facing strings themselves.
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const WEB_SCREEN = stripTsx(read('web/src/screens/orders/CreateQuoteScreen.tsx'));
const MOBILE_SCREEN = stripDart(read('mobile/lib/screens/orders/create_quote_screen.dart'));
const WEB_ROW = stripTsx(read('web/src/design-system/components/CartLineRow.tsx'));
const MOBILE_ROW = stripDart(read('mobile/lib/design_system/components/cart_line_row.dart'));

const screens = [
  ['web:CreateQuoteScreen', WEB_SCREEN],
  ['mobile:create_quote_screen', MOBILE_SCREEN],
];
const allCode = [...screens, ['web:CartLineRow', WEB_ROW], ['mobile:cart_line_row', MOBILE_ROW]];

/** Hard-coded colours: every colour is a token (AD-13). */
const HEX = [
  [/#[0-9a-fA-F]{3,8}\b/, 'hard-code a hex colour'],
  [/Color\(0x/, 'build a Color(0x…) literal'],
];

test('anti-blind guard: every scanned file still has code after stripping', () => {
  // Measured on the current tree: the smallest is the web CartLineRow (~5 KB
  // stripped). 2000 chars is well under every real file.
  assertCodeNotBlind(allCode, 2000, 'quote stock-check guard');
});

test('no quote screen or cart row compares or combines two stock figures', () => {
  for (const [name, code] of allCode) {
    assert.ok(!STOCK_PAIR.test(code), `${name} must not compare/combine stock figures — the backend owns it (AD-2)`);
  }
});

test('the stock-pair ban catches a real violation (guard is not toothless)', () => {
  for (const sample of [
    'const short = line.qty > s.available;',
    'final int can = s.qty - s.available;',
    "label: `Cần nhập ${s.qty - s.onHand + s.reserved}`",
    'if (s.onHand < s.reserved) {}',
    'const short = (line.qty) > (s.available);',
  ]) {
    assert.ok(STOCK_PAIR.test(sample), `the ban missed: ${sample}`);
  }
  // Picking a sentence from the backend's status, or printing a figure, is allowed.
  for (const ok of ["s.status === 'short'", '`Kho còn ${s.available}`', '`Cần nhập ${s.shortfall}`']) {
    assert.ok(!STOCK_PAIR.test(ok), `the ban fired on an allowed read: ${ok}`);
  }
});

test('no hard-coded colour in the quote screens (tokens only)', () => {
  for (const [name, code] of screens) {
    for (const [pattern, what] of HEX) {
      assert.ok(!pattern.test(code), `${name} must not ${what}`);
    }
  }
  // The hint tone itself is a token on both twins.
  assert.ok(/AppTokens\.danger : AppTokens\.ok/.test(MOBILE_ROW), 'mobile hint tone must be AppTokens danger/ok');
  assert.ok(/stock-hint--short/.test(WEB_ROW), 'web hint tone must be a CSS class (token-backed rule)');
  assert.ok(HEX[0][0].test("color: '#FF0000'"));
  assert.ok(HEX[1][0].test('const Color(0xFF00FF00)'));
});

test('both screens read the backend warning and pick the wording from `status`', () => {
  assert.ok(/ordersPort\.getStockCheck\(/.test(WEB_SCREEN), 'web quote screen must read getStockCheck');
  assert.ok(/ordersPort\.getStockCheck\(/.test(MOBILE_SCREEN), 'mobile quote screen must read getStockCheck');
  assert.ok(/s\.status === 'short'/.test(WEB_SCREEN), "web must branch on status === 'short'");
  assert.ok(/s\.status\.json == kStockCheckShort/.test(MOBILE_SCREEN), 'mobile must branch on kStockCheckShort');
  // The hint is display-only: it is never part of the Chốt button's condition.
  for (const [name, code] of screens) {
    const before = code.split('Chốt báo giá').slice(0, -1);
    assert.ok(before.length >= 2, `${name}: expected the Chốt button(s) + dialog — the probe went blind`);
    for (const chunk of before) {
      assert.ok(!/stock/i.test(chunk.slice(-400)), `${name}: the Chốt button must not depend on stock`);
    }
  }
});

test('every label is present on BOTH platforms, byte-for-byte (UX-DR-27)', () => {
  const LABELS = [
    'Kho còn ',
    'Cần nhập ',
    ' — Còn ',
    ' · Đã hứa ',
    ' · Cần nhập ',
    '. Vẫn chốt đơn được; chặn nằm ở khâu xuất kho.',
  ];
  for (const label of LABELS) {
    assert.ok(WEB_SCREEN.includes(label), `web quote screen must render "${label}"`);
    assert.ok(MOBILE_SCREEN.includes(label), `mobile quote screen must render "${label}"`);
  }
});
