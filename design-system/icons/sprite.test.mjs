// Runtime guards for the generated web sprite module (Story 1.2).
//
// parity.test.mjs regex-parses the committed FILE STRINGS; this suite imports
// the actual generated web module and exercises the public runtime API that
// consumers import — ICON_NAMES / ICON_SIZES and the single-mount ICON_SPRITE.
// Node 24 strips the TS types on import, so no build step or web tooling is
// needed. Nothing else asserts these runtime values.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_NAMES, ICON_SIZES, ICON_SPRITE } from '../../web/src/design-system/icons/sprite.ts';

// The canonical 46-name set, verbatim from the mockup (UX-DR-18).
const CANONICAL = [
  'ic-home', 'ic-orders', 'ic-invoice', 'ic-inventory', 'ic-warehouse', 'ic-menu',
  'ic-customer', 'ic-users', 'ic-user', 'ic-product', 'ic-catalog', 'ic-payment',
  'ic-contract', 'ic-audit', 'ic-permissions', 'ic-status', 'ic-plus', 'ic-minus',
  'ic-check', 'ic-close', 'ic-edit', 'ic-trash', 'ic-copy', 'ic-send', 'ic-share',
  'ic-download', 'ic-external', 'ic-refresh', 'ic-search', 'ic-filter', 'ic-sort',
  'ic-more', 'ic-bell', 'ic-mail', 'ic-phone', 'ic-camera', 'ic-image', 'ic-file',
  'ic-clock', 'ic-info', 'ic-alert', 'ic-ban', 'ic-chevron-left', 'ic-chevron-right',
  'ic-chevron-down', 'ic-sun',
];

// (1) The runtime name union consumers import is exactly the 46 canonical names.
test('ICON_NAMES exports exactly the 46 canonical names (AC-3)', () => {
  assert.equal(ICON_NAMES.length, 46, 'ICON_NAMES must expose 46 icons');
  assert.deepEqual([...ICON_NAMES].sort(), [...CANONICAL].sort(), 'ICON_NAMES drifted from canonical');
  // Decision (open question #2): only ic-ban is canonical — no ic-warning alias.
  assert.ok(!ICON_NAMES.includes('ic-warning'), 'ic-warning must not be exposed; use ic-ban (mockup wins)');
});

// (2) The runtime size scale consumers import matches the six canonical sizes.
test('ICON_SIZES exports the six canonical sizes, default first (AC-2)', () => {
  assert.deepEqual([...ICON_SIZES], [18, 22, 16, 15, 14, 13], 'ICON_SIZES scale drifted');
  assert.equal(ICON_SIZES[0], 18, 'default size 18 must lead the scale');
});

// (3) ICON_SPRITE is ONE self-contained mount point — mounted once at DOM top.
test('ICON_SPRITE is a single self-contained mount point (AC-1)', () => {
  assert.equal((ICON_SPRITE.match(/<svg /g) || []).length, 1, 'sprite must be a single <svg> wrapper (mount once)');
  assert.equal((ICON_SPRITE.match(/<defs>/g) || []).length, 1, 'sprite must wrap exactly one <defs>');
  assert.ok(
    ICON_SPRITE.startsWith('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'),
    'sprite must open with the hidden absolute-positioned mount wrapper',
  );
  assert.ok(ICON_SPRITE.endsWith('</defs></svg>'), 'sprite must close its defs and svg wrapper');
});

// (4) Every canonical name is referenceable via <use href="#ic-*"> at runtime.
test('every canonical name has a <symbol id> reachable by <use href> (AC-1)', () => {
  const symbolIds = [...ICON_SPRITE.matchAll(/<symbol id="(ic-[a-z-]+)"/g)].map((m) => m[1]);
  assert.equal(symbolIds.length, 46, 'sprite must define 46 symbols');
  for (const name of ICON_NAMES) {
    assert.ok(ICON_SPRITE.includes(`<symbol id="${name}"`), `<use href="#${name}"> has no matching symbol`);
  }
});

// (5) Uniform viewBox and 0 external references on the runtime sprite (AC-1).
test('all symbols share viewBox 0 0 24 24 with 0 external references (AC-1)', () => {
  assert.equal((ICON_SPRITE.match(/viewBox="0 0 24 24"/g) || []).length, 46, 'every symbol must use viewBox 0 0 24 24');
  const banned = /https?:|xlink:href|<image\b|url\(/i;
  assert.ok(!banned.test(ICON_SPRITE), 'runtime sprite must contain 0 external references');
});
