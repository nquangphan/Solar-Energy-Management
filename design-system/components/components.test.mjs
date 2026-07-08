// Drift-guard for the hand-authored web component CSS (Story 1.3, Task 4).
//
// Unlike tokens/icons, the 1.3 components are web-only and hand-authored (no
// SSOT/generator — see Dev Notes). The anti-drift contract is this test: it
// reads components.css as text and asserts the selectors/variants exist, the
// core declarations match the mockup verbatim (mockups/all-screens.html
// lines 61-88), the "Viền nét" flat rule holds (0 shadow/gradient), and the
// radius vars were remapped (--r* -> --radius*). Any edit that drifts a
// component away from the mockup, adds ad-hoc elevation, or forgets the
// radius remap breaks this test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root
const CSS_PATH = resolve(repoRoot, 'web/src/design-system/components/components.css');
const TOKENS_PATH = resolve(repoRoot, 'web/src/design-system/tokens/tokens.css');
const css = readFileSync(CSS_PATH, 'utf8');
const tokensCss = readFileSync(TOKENS_PATH, 'utf8');

// (1) Every selector + variant must be present. Missing one variant = fail
// (AC-1 Button, AC-2 Card/Frame, AC-3 Field).
test('all component selectors and variants exist (AC-1/2/3)', () => {
  const required = [
    '.btn', '.btn--primary', '.btn--accent', '.btn--ghost', '.btn--danger',
    '.btn--sm', '.btn--wide',
    '.card', '.card--ink', '.card--teal',
    '.frame', '.frame-label',
    '.field', '.field-lg', '.flabel',
  ];
  for (const sel of required) {
    assert.ok(css.includes(sel), `components.css missing selector: ${sel}`);
  }
});

// (2) Core declarations, verbatim from the mockup (AC-1/2/3).
test('core declarations match the mockup verbatim (AC-1/2/3)', () => {
  // Button base: teal 1.5px border, white surface bg, teal-700 text.
  assert.ok(css.includes('border:1.5px solid var(--teal)'), '.btn must have border:1.5px solid var(--teal)');
  assert.ok(css.includes('background:var(--surface)'), '.btn must have background:var(--surface)');
  assert.ok(css.includes('color:var(--teal-700)'), '.btn must have color:var(--teal-700)');
  // Accent variant references lime tokens.
  assert.ok(css.includes('var(--lime-050)'), '.btn--accent must ref --lime-050');
  assert.ok(css.includes('var(--lime)'), '.btn--accent must ref --lime border');
  // Card: line 1.5px border + radius-lg.
  assert.ok(css.includes('border:1.5px solid var(--line)'), '.card must have border:1.5px solid var(--line)');
  assert.ok(css.includes('border-radius:var(--radius-lg)'), '.card must have border-radius:var(--radius-lg)');
  // Frame: ink 1.5px border.
  assert.ok(css.includes('border:1.5px solid var(--ink)'), '.frame must have border:1.5px solid var(--ink)');
  // Field focus: teal border, no glow (outline:none).
  assert.ok(css.includes('border-color:var(--teal)'), '.field:focus must set border-color:var(--teal)');
  assert.ok(css.includes('outline:none'), '.field:focus must set outline:none');
});

// (3) Viền nét — flat blueprint, no ad-hoc elevation (AC-4).
test('no shadow/gradient/background-image — flat "Viền nét" (AC-4)', () => {
  const banned = /box-shadow|shadow|gradient|background-image/i;
  assert.ok(!banned.test(css), 'components.css must contain 0 shadow/gradient/background-image (Viền nét)');
});

// (4) Radius vars must be remapped to the shipped token layer (--radius*),
// never the mockup's --r/--r-sm/--r-lg (undefined in tokens.css -> broken).
test('radius vars are remapped to --radius* (no raw --r*)', () => {
  const rawRadiusVar = /var\(--r(-sm|-lg)?\)/;
  assert.ok(!rawRadiusVar.test(css), 'components.css must not reference var(--r)/var(--r-sm)/var(--r-lg) — remap to --radius*');
  assert.ok(css.includes('var(--radius)'), '.btn/.field must use var(--radius)');
  assert.ok(css.includes('var(--radius-sm)'), '.btn--sm must use var(--radius-sm)');
});

// (5) Every Button variant/size carries its verbatim declaration, not just the
// selector (AC-1). A selector present but with a drifted value must fail.
test('Button variants keep their verbatim declarations (AC-1)', () => {
  assert.ok(css.includes('font-weight:800'), '.btn text must be weight 800 (teal-700 800)');
  assert.ok(css.includes('background:var(--teal);color:#fff'), '.btn--primary must be teal bg + #fff text (verbatim mockup)');
  assert.ok(css.includes('color:var(--lime-600)'), '.btn--accent text must be --lime-600');
  assert.ok(css.includes('.btn--ghost{border-color:var(--line);color:var(--ink-2)}'), '.btn--ghost must use line border + ink-2 text');
  assert.ok(css.includes('.btn--danger{border-color:var(--danger);color:var(--danger)}'), '.btn--danger must use --danger border + text');
  assert.ok(css.includes('.btn--wide{width:100%}'), '.btn--wide must be width:100%');
  // Icon-in-button contract wiring to the Icon system (Story 1.2).
  assert.ok(css.includes('.btn .icn{width:15px;height:15px}'), '.btn .icn must force the icon to 15px');
});

// (6) Card/Frame accent-border variants + the frame-label "floating on the
// border" motif carry their verbatim values (AC-2).
test('Card/Frame variants keep their verbatim declarations (AC-2)', () => {
  assert.ok(css.includes('.card--ink{border-color:var(--ink)}'), '.card--ink must set border-color:var(--ink)');
  assert.ok(css.includes('.card--teal{border-color:var(--teal)}'), '.card--teal must set border-color:var(--teal)');
  // Label floats on the border (technical-drawing motif): absolute + top:-8px.
  assert.ok(css.includes('position:absolute;top:-8px'), '.frame-label must float on the border (position:absolute;top:-8px)');
  assert.ok(css.includes('.frame.on-bg > .frame-label{background:var(--bg)}'), '.frame.on-bg label must mask with --bg');
});

// (7) Field placeholder constant, the .field-lg login size, the .field.focus
// alt selector, and the .flabel micro-uppercase-muted spec (AC-3).
test('Field/label keep their verbatim declarations (AC-3)', () => {
  assert.ok(css.includes('.field::placeholder{color:#9fb2ad}'), '.field placeholder must be #9fb2ad (verbatim component constant)');
  assert.ok(css.includes('.field-lg{padding:13px 14px;font-size:15px}'), '.field-lg must keep the login-form size');
  assert.ok(css.includes('.field:focus,.field.focus'), 'focus rule must cover both :focus and the .focus alt class');
  // .flabel is the only rule using --muted, so this ties to the label spec.
  assert.ok(css.includes('text-transform:uppercase') && css.includes('color:var(--muted)'), '.flabel must be micro-uppercase + muted');
});

// (8) Cross-file integrity: every token var referenced by components.css must
// be DEFINED in the shipped tokens.css. This is the generalized guard behind
// the --r* gotcha — a typo (var(--teel)) or a not-yet-shipped token would
// silently break styling while the suite stayed green. Mirrors the tokens/icon
// parity tests (read two files, assert they agree).
test('every var() referenced in components.css is defined in tokens.css', () => {
  const defined = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const referenced = new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  const missing = [...referenced].filter((name) => !defined.has(name));
  assert.deepEqual(missing, [], `components.css references undefined token(s): ${missing.join(', ')}`);
});
