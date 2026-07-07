// Parity + Viền-nét guards for the shared token layer (Story 1.1, Task 7).
//
// Core acceptance criterion: the SAME hex/number must appear on web AND mobile
// AND in design-tokens.json — no single-character drift. These tests fail if
// someone edits a value on one platform but forgets the other (AC-1..3), and if
// any decorative depth token is introduced (AC-4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTokens, buildOutputs, OUT_PATHS } from './build-tokens.mjs';

const t = loadTokens();
const fresh = buildOutputs(t);
const committed = {
  ts: readFileSync(OUT_PATHS.webTs, 'utf8'),
  css: readFileSync(OUT_PATHS.webCss, 'utf8'),
  dart: readFileSync(OUT_PATHS.mobileDart, 'utf8'),
};

// (1) Committed outputs must equal a fresh generation from the source of truth.
// This is the drift guard: any hand-edit to one platform breaks it.
test('web + mobile outputs are regenerated identically from the source of truth', () => {
  assert.equal(committed.ts, fresh.ts, 'web/tokens.ts is stale — run `npm run build` in design-system/');
  assert.equal(committed.css, fresh.css, 'web/tokens.css is stale — run `npm run build`');
  assert.equal(committed.dart, fresh.dart, 'mobile/app_tokens.dart is stale — run `npm run build`');
});

// (2) Every color hex is byte-identical across json == web(ts) == web(css) == mobile(dart).
test('color hex is identical across json, web, and mobile', () => {
  for (const [name, hex] of Object.entries(t.color)) {
    const HEX = hex.toUpperCase();
    assert.ok(committed.ts.includes(`'${name}': '${hex}'`), `tokens.ts missing color ${name}=${hex}`);
    assert.ok(committed.css.includes(`--${name}: ${hex};`), `tokens.css missing --${name}: ${hex}`);
    assert.ok(
      committed.dart.includes(`Color(0xFF${HEX.slice(1)})`),
      `app_tokens.dart missing color ${name}=${hex}`,
    );
  }
});

// (3) The 14 canonical color groups (17 concrete values) are all present.
test('all 14 canonical color groups are present (AC-1)', () => {
  const expected = [
    'teal', 'teal-700', 'teal-050',
    'lime', 'lime-600', 'lime-050',
    'ink', 'ink-2', 'muted', 'line',
    'bg', 'surface', 'surface-2',
    'ok', 'warn', 'danger', 'info',
  ];
  assert.deepEqual(Object.keys(t.color).sort(), [...expected].sort());
});

// (4) Spacing + radius numbers are identical across json, web, and mobile.
test('spacing and radius numbers are identical across platforms (AC-2)', () => {
  const scale = Object.values(t.spacing.scale);
  assert.deepEqual(scale, [4, 6, 8, 12, 16, 22, 26]);
  for (const v of scale) {
    assert.ok(committed.css.includes(`--space-${v}: ${v}px;`), `tokens.css missing --space-${v}`);
    assert.ok(committed.dart.includes(`space${v} = ${v}.0;`), `app_tokens.dart missing space${v}`);
  }
  assert.equal(t.radius.sm, 8);
  assert.equal(t.radius.DEFAULT, 10);
  assert.equal(t.radius.lg, 12);
  assert.equal(t.radius.full, 9999);
  assert.ok(committed.css.includes('--radius-full: 9999px;'));
  assert.ok(committed.dart.includes('radiusFull = 9999.0;'));
});

// (5) Typography roles carry the exact sizes/weights (AC-3).
test('typography roles match the canonical scale (AC-3)', () => {
  const r = t.typography.roles;
  assert.equal(r.display.fontSize, 23);
  assert.equal(r.display.fontWeight, 900);
  assert.equal(r.title.fontSize, 15);
  assert.equal(r.body.fontSize, 13.5);
  assert.equal(r.body.lineHeight, 1.42);
  assert.equal(r.micro.fontSize, 10);
  assert.equal(r.micro.textTransform, 'uppercase');
  // native system stack, no external webfont
  assert.ok(t.typography.fontFamily.startsWith('-apple-system'));
  assert.ok(!/http|googleapis|@font-face/i.test(committed.css), 'no external webfont allowed');
  // .mono utility for money/quantities
  assert.ok(committed.css.includes('font-variant-numeric: tabular-nums'));
});

// (6) Viền nét: NO decorative depth tokens anywhere (AC-4).
test('no shadow or gradient tokens exist (AC-4, Viền nét)', () => {
  const banned = /shadow|gradient|box-shadow|elevation:\s*\d/i;
  assert.ok(!banned.test(JSON.stringify(t)), 'source of truth must not contain decorative depth tokens');
  assert.ok(!banned.test(committed.ts), 'tokens.ts must not contain decorative depth tokens');
  assert.ok(!banned.test(committed.css), 'tokens.css must not contain decorative depth tokens');
  assert.ok(!banned.test(committed.dart), 'app_tokens.dart must not contain decorative depth tokens');
  // Hierarchy is expressed by border width + surface steps instead.
  assert.equal(t.border.width, 1.5);
  assert.deepEqual(t.border.surfaceSteps, ['bg', 'surface', 'surface-2']);
});

// (7) Spacing aliases carry their exact values across json, web, and mobile (AC-2).
// The regeneration guard (1) catches web/mobile drift, but nothing pinned the
// alias VALUES — a change to page-x in the source would regenerate cleanly and
// pass. These are the page/gutter/scroll rhythm; they must not silently move.
test('spacing aliases (gutter/page-x/pscroll) are identical across platforms (AC-2)', () => {
  assert.deepEqual(t.spacing.alias, { gutter: 12, 'page-x': 22, pscroll: 12 });
  for (const [k, v] of Object.entries(t.spacing.alias)) {
    assert.ok(committed.css.includes(`--${k}: ${v}px;`), `tokens.css missing --${k}: ${v}px`);
  }
  assert.ok(committed.dart.includes('gutter = 12.0;'), 'app_tokens.dart missing gutter alias');
  assert.ok(committed.dart.includes('pageX = 22.0;'), 'app_tokens.dart missing page-x alias');
  assert.ok(committed.dart.includes('pscroll = 12.0;'), 'app_tokens.dart missing pscroll alias');
});

// (8) The `meta` role plus every role's letter-spacing reach the outputs (AC-3).
// meta is the 5th canonical role; letter-spacing is part of the visual contract
// (Display -.02em, Title -.01em, Micro .1em) and must not drift.
test('all five typography roles incl. meta + letter-spacing reach the outputs (AC-3)', () => {
  const r = t.typography.roles;
  assert.equal(r.meta.fontSize, 12.5);
  assert.equal(r.meta.fontWeight, 600);
  assert.ok(committed.css.includes('--text-meta-fontsize: 12.5px;'), 'tokens.css missing meta role');
  assert.ok(committed.dart.includes('metaFontSize = 12.5;'), 'app_tokens.dart missing meta role');
  assert.ok(committed.css.includes('--text-display-letterspacing: -.02em;'), 'display letter-spacing drifted');
  assert.ok(committed.css.includes('--text-title-letterspacing: -.01em;'), 'title letter-spacing drifted');
  assert.ok(committed.css.includes('--text-micro-letterspacing: .1em;'), 'micro letter-spacing drifted');
});

// (9) .mono is right-aligned tabular figures for money/quantities/order codes (AC-3).
test('.mono utility right-aligns tabular figures (AC-3)', () => {
  assert.ok(committed.css.includes('text-align: right;'), '.mono must right-align money/quantities');
});

// (10) statusChip is a reserved-but-empty extension point (scope guard).
// Story 1.1 must NOT implement status-chip sets — those land in Story 1.4 (UX-DR-8)
// inside this same layer. The extension point must exist and stay empty here.
test('statusChip.sets is present and empty — reserved for Story 1.4, not implemented in 1.1', () => {
  assert.ok(t.statusChip && typeof t.statusChip.sets === 'object', 'statusChip.sets extension point must exist');
  assert.equal(
    Object.keys(t.statusChip.sets).length,
    0,
    'Story 1.1 must not implement status-chip sets (belongs to Story 1.4)',
  );
});
