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

// ---------- Chip layer drift-guard (Story 1.4) ----------
// The 9 canonical status colors + chip/ktype/scope-flag rules are hand-authored
// verbatim from the mockup (lines 90-109). These assertions fail if a chip rule
// is dropped, a canonical hex is drifted/invented, or the pill radius remap is
// forgotten. (AC-4 flatness + cross-file token integrity are already covered by
// tests 3 and 8 above, which scan the whole file including the chip block.)

// (9) Every chip selector + the 2 flag variants must be present. Missing one of
// the 9 states = fail (AC-1/2).
test('all chip selectors and variants exist (AC-1/2)', () => {
  const required = [
    '.chip', '.chip .dot',
    '.chip--baogia', '.chip--choduyet', '.chip--dachot', '.chip--dacoc',
    '.chip--thicong', '.chip--nghiemthu', '.chip--danggiao', '.chip--hoanthanh',
    '.chip--huy',
    '.ktype', '.scope-flag', '.scope-flag.on', '.scope-flag.off',
  ];
  for (const sel of required) {
    assert.ok(css.includes(sel), `components.css missing chip selector: ${sel}`);
  }
});

// (10) Each of the 9 states carries its exact canonical bg/fg/border triplet
// (AC-2). Drift-guard against changing or inventing a status color.
test('9 status chips keep their verbatim hex triplets (AC-2)', () => {
  const triplets = [
    ['baogia', '#EAF3F1', '#3A5450', '#CFE5E0'],
    ['choduyet', '#FBF0DA', '#8A5C08', '#EFD9A8'],
    ['dachot', '#DCF3EF', '#0B7264', '#B7E5DD'],
    ['dacoc', '#E7F5D9', '#4B7A15', '#CDE9AC'],
    ['thicong', '#FCEAD4', '#985B08', '#F2D3A6'],
    ['nghiemthu', '#E4EEFA', '#345C9C', '#C4D8F0'],
    ['danggiao', '#DEF1F6', '#0C6B84', '#B7E0EB'],
    ['hoanthanh', '#DEF3E6', '#137A4C', '#B7E5CA'],
    ['huy', '#FAE6E6', '#B22C2C', '#F0C7C7'],
  ];
  for (const [key, bg, fg, border] of triplets) {
    // Bind the triplet to ITS selector's rule (…{background;color;border-color}) so a
    // full color SWAP between two states — where both triplets still exist elsewhere in
    // the file — is caught, not only an invented hex. The trailing } also rejects extra
    // declarations sneaking onto the rule.
    const rule = new RegExp(`\\.chip--${key}\\s*\\{background:${bg};color:${fg};border-color:${border}\\}`);
    assert.ok(
      rule.test(css),
      `.chip--${key} must be {background:${bg};color:${fg};border-color:${border}} on its own rule (canonical, AC-2)`,
    );
  }
});

// (11) Chip core spec: 11px/700 pill, transparent 1.5px border (so .chip--*
// sets border-color), and the 6px currentColor dot (AC-1).
test('chip core declarations match the mockup verbatim (AC-1)', () => {
  assert.ok(css.includes('font-size:11px'), '.chip must be font-size:11px');
  assert.ok(css.includes('font-weight:700'), '.chip must be font-weight:700');
  assert.ok(css.includes('border:1.5px solid transparent'), '.chip must have a transparent 1.5px border');
  assert.ok(css.includes('.chip .dot{width:6px;height:6px'), '.chip .dot must be 6px');
  assert.ok(css.includes('background:currentColor'), '.chip .dot must use currentColor');
});

// (12) ktype/scope-flag reference the correct tokens + the off flag's
// strike-through spec (AC-1).
test('ktype/scope-flag keep their verbatim declarations (AC-1)', () => {
  assert.ok(css.includes('.ktype{font-size:10.5px;font-weight:800;color:var(--ink);border:1.5px solid var(--lime)'), '.ktype must be lime-bordered ink pill');
  assert.ok(css.includes('.scope-flag.on{border:1.5px solid var(--teal);color:var(--teal-700)}'), '.scope-flag.on must be teal border + teal-700 text');
  assert.ok(css.includes('.scope-flag.off{border:1.5px solid var(--line);color:#9fb2ad;text-decoration:line-through}'), '.scope-flag.off must be line border + muted strike-through');
});

// (13) Pill radius remap: the chip block consumes var(--radius-full); the raw
// mockup literals 999px/9999px must NOT survive (parallel to the --r* guard,
// test 4). The .dot{border-radius:50%} circle is unaffected.
test('chip pill radius is remapped to var(--radius-full), no raw 999/9999px', () => {
  assert.ok(css.includes('var(--radius-full)'), 'chip/ktype/scope-flag must use var(--radius-full)');
  assert.ok(!/border-radius:9{3,4}px/.test(css), 'components.css must not keep literal 999px/9999px — remap to var(--radius-full)');
});
