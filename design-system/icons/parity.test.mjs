// Parity + self-contained guards for the shared icon sprite (Story 1.2, Task 4).
//
// Core acceptance criterion: the SAME 46 icons must exist on web AND mobile AND
// in icons.json — no icon added/renamed on one platform while the other is
// forgotten (AC-3). Every symbol must be stroke-only currentColor with 0
// external references (AC-1). These tests are the anti-drift contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadIcons, buildOutputs, OUT_PATHS } from './build-icons.mjs';

const t = loadIcons();
const fresh = buildOutputs(t);
const committed = {
  sprite: readFileSync(OUT_PATHS.webSprite, 'utf8'),
  css: readFileSync(OUT_PATHS.webCss, 'utf8'),
  component: readFileSync(OUT_PATHS.webComponent, 'utf8'),
  dart: readFileSync(OUT_PATHS.mobileDart, 'utf8'),
};

// The canonical 46-name set, verbatim from the mockup (Dev Notes / UX-DR-18).
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

// Names as they reach each committed output.
const jsonNames = Object.keys(t.icons);
const spriteSymbolNames = [...committed.sprite.matchAll(/<symbol id="(ic-[a-z-]+)"/g)].map((m) => m[1]);
const dartRegistryNames = [...committed.dart.matchAll(/^\s+'(ic-[a-z-]+)':/gm)].map((m) => m[1]);

// (1) Committed outputs must equal a fresh generation from the source of truth.
// This is the drift guard: any hand-edit to one platform breaks it.
test('web + mobile outputs are regenerated identically from the source of truth', () => {
  assert.equal(committed.sprite, fresh.sprite, 'web/sprite.ts is stale — run `npm run build:icons`');
  assert.equal(committed.css, fresh.css, 'web/icons.css is stale — run `npm run build:icons`');
  assert.equal(committed.component, fresh.component, 'web/Icon.tsx is stale — run `npm run build:icons`');
  assert.equal(committed.dart, fresh.dart, 'mobile/app_icons.dart is stale — run `npm run build:icons`');
});

// (2) Exactly the 46 canonical names, same set on every platform (AC-3 core).
test('the name set is exactly the 46 canonical icons on json == web == mobile (AC-3)', () => {
  assert.equal(jsonNames.length, 46, 'icons.json must define exactly 46 icons');
  assert.deepEqual([...jsonNames].sort(), [...CANONICAL].sort(), 'icons.json name set drifted from canonical');
  assert.deepEqual([...spriteSymbolNames].sort(), [...CANONICAL].sort(), 'web sprite name set drifted');
  assert.deepEqual([...dartRegistryNames].sort(), [...CANONICAL].sort(), 'mobile registry name set drifted');
  // No name added on one platform but missing on another.
  assert.deepEqual(spriteSymbolNames, dartRegistryNames, 'web and mobile icon order/set diverged');
});

// (3) Intentional duplicate paths from the mockup are preserved, not "fixed".
test('intentional duplicate icons keep identical bodies (mockup wins)', () => {
  assert.equal(t.icons['ic-product'], t.icons['ic-inventory'], 'ic-product must equal ic-inventory');
  assert.equal(t.icons['ic-contract'], t.icons['ic-file'], 'ic-contract must equal ic-file');
  assert.equal(t.icons['ic-users'], t.icons['ic-customer'], 'ic-users must equal ic-customer');
});

// (4) Every symbol is stroke-only currentColor, stroke-width 2, fill none (AC-1).
test('every symbol uses stroke=currentColor, stroke-width=2, fill=none (AC-1)', () => {
  const symbolTags = [...committed.sprite.matchAll(/<symbol [^>]*>/g)].map((m) => m[0]);
  assert.equal(symbolTags.length, 46);
  for (const tag of symbolTags) {
    assert.ok(tag.includes('fill="none"'), `symbol missing fill="none": ${tag}`);
    assert.ok(tag.includes('stroke="currentColor"'), `symbol missing stroke="currentColor": ${tag}`);
    assert.ok(tag.includes('stroke-width="2"'), `symbol missing stroke-width="2": ${tag}`);
  }
  // Mobile SVG strings carry the same contract.
  const dartSvgOpen = [...committed.dart.matchAll(/<svg [^>]*>/g)].map((m) => m[0]);
  assert.equal(dartSvgOpen.length, 46);
  for (const tag of dartSvgOpen) {
    assert.ok(
      tag.includes('fill="none"') && tag.includes('stroke="currentColor"') && tag.includes('stroke-width="2"'),
      `mobile svg missing stroke contract: ${tag}`,
    );
  }
});

// (5) 0 external references: no network URL, no external xlink, no raster/emoji (AC-1, AC-3).
test('sprite + registry contain 0 external references and no raster (AC-1, AC-3)', () => {
  const banned = /https?:|xlink:href|<image\b|url\(/i;
  assert.ok(!banned.test(committed.sprite), 'web sprite must have 0 external references');
  assert.ok(!banned.test(committed.dart), 'mobile registry must have 0 external references');
  // No emoji / non-ASCII glyphs smuggled into the icon data.
  for (const body of Object.values(t.icons)) {
    assert.ok(/^[\x00-\x7F]*$/.test(body), 'icon body must be plain ASCII SVG markup (no emoji/raster)');
  }
});

// (6) All six canonical sizes are expressible on both platforms (AC-2).
test('the six canonical sizes 18/22/16/15/14/13 reach web CSS and mobile (AC-2)', () => {
  assert.deepEqual(t.sizes.variants, [18, 22, 16, 15, 14, 13]);
  assert.equal(t.sizes.default, 18);
  // Base .icn is 18; the mockup line is preserved verbatim.
  assert.ok(committed.css.includes('svg.icn{width:18px;height:18px;'), 'base .icn (18px) line drifted from mockup');
  // Size utilities must out-specify the base `svg.icn` rule, else the size is
  // inert (svg.icn (0,1,1) would beat a bare .icn-* (0,1,0)). Require the
  // qualified `svg.icn.icn-*` form so the selected size actually applies.
  assert.ok(committed.css.includes('svg.icn.icn-xs{width:13px;height:13px}'), '.icn-xs (13px) must be specificity-qualified');
  for (const n of [22, 16, 15, 14]) {
    assert.ok(committed.css.includes(`svg.icn.icn-${n}{width:${n}px;height:${n}px}`), `size utility .icn-${n} must be specificity-qualified`);
  }
  // Mobile exposes the same size scale.
  assert.ok(committed.dart.includes('sizes = [18.0, 22.0, 16.0, 15.0, 14.0, 13.0]'), 'mobile size scale drifted');
});

// (7) currentColor inheritance is wired, not hard-coded, on both platforms (AC-2).
test('icons inherit context colour via currentColor, never hard-coded (AC-2)', () => {
  // Web base rule sets stroke:currentColor; no literal hex on icon rules.
  assert.ok(committed.css.includes('stroke:currentColor'), '.icn must inherit colour via currentColor');
  assert.ok(!/#[0-9a-fA-F]{3,6}/.test(committed.css), 'icons.css must not hard-code any icon colour');
  // Mobile resolves colour from context (DefaultTextStyle / IconTheme) with a filter.
  assert.ok(committed.dart.includes('DefaultTextStyle.of(context)'), 'AppIcon must fall back to context text colour');
  assert.ok(committed.dart.includes('ColorFilter.mode'), 'AppIcon must apply the resolved colour as currentColor');
});
