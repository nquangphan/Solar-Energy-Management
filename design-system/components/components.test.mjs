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

// (3) Viền nét — flat blueprint, no ad-hoc elevation (AC-4/5, UX-DR-4/11).
// gradient/background-image are banned outright. box-shadow is allowed ONLY as
// the stepper `current` ring: 0 0 0 3px var(--teal-050) — a finite double border
// (0 blur/offset), sanctioned by DESIGN.md line 217. Any box-shadow with a blur
// or offset (a real drop-shadow) still fails.
test('no gradient/background-image + only the sanctioned stepper ring box-shadow (AC-4/5)', () => {
  const bannedFill = /gradient|background-image/i;
  assert.ok(!bannedFill.test(css), 'components.css must contain 0 gradient/background-image (Viền nét)');

  const SANCTIONED_RING = '0 0 0 3px var(--teal-050)';
  const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim());
  for (const shadow of shadows) {
    assert.equal(
      shadow,
      SANCTIONED_RING,
      `only box-shadow allowed is the stepper current ring '${SANCTIONED_RING}' (finite double border, DESIGN.md 217); found '${shadow}'`,
    );
  }
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
// The 10 canonical status colors + chip/ktype/scope-flag rules are hand-authored
// verbatim from the mockup (lines 90-109). These assertions fail if a chip rule
// is dropped, a canonical hex is drifted/invented, or the pill radius remap is
// forgotten. (AC-4 flatness + cross-file token integrity are already covered by
// tests 3 and 8 above, which scan the whole file including the chip block.)

// (9) Every chip selector + the 2 flag variants must be present. Missing one of
// the 10 states = fail (AC-1/2).
test('all chip selectors and variants exist (AC-1/2)', () => {
  const required = [
    '.chip', '.chip .dot',
    '.chip--baogia', '.chip--choduyet', '.chip--dachot', '.chip--dacoc',
    '.chip--thicong', '.chip--nghiemthu', '.chip--danggiao', '.chip--dagiao',
    '.chip--hoanthanh', '.chip--huy',
    '.ktype', '.scope-flag', '.scope-flag.on', '.scope-flag.off',
  ];
  for (const sel of required) {
    assert.ok(css.includes(sel), `components.css missing chip selector: ${sel}`);
  }
});

// (10) Each of the 10 states carries its exact canonical bg/fg/border triplet
// (AC-2). Drift-guard against changing or inventing a status color.
test('10 status chips keep their verbatim hex triplets (AC-2)', () => {
  const triplets = [
    ['baogia', '#EAF3F1', '#3A5450', '#CFE5E0'],
    ['choduyet', '#FBF0DA', '#8A5C08', '#EFD9A8'],
    ['dachot', '#DCF3EF', '#0B7264', '#B7E5DD'],
    ['dacoc', '#E7F5D9', '#4B7A15', '#CDE9AC'],
    ['thicong', '#FCEAD4', '#985B08', '#F2D3A6'],
    ['nghiemthu', '#E4EEFA', '#345C9C', '#C4D8F0'],
    ['danggiao', '#DEF1F6', '#0C6B84', '#B7E0EB'],
    ['dagiao', '#DDF3EA', '#0F7657', '#B7E5D4'],
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

// (10b) No two states may share a triplet. Test (10) pins each state to its own
// canonical colours, but nothing stopped the canonical set itself from carrying
// a duplicate — the exact failure mode behind "đừng copy dòng danggiao rồi xoá
// ng": two states rendering identically, indistinguishable to the user.
//
// This asserts EXACT duplication only, not a perceptual-distance floor. The
// teal-green band is genuinely crowded (dagiao's background sits 4/255 from
// hoanthanh's), and that crowding is a ratified UX trade-off, not a defect — the
// chips stay distinguishable by their always-present text label (WCAG 1.4.1).
test('no two status chips share the same colours (AC-2)', () => {
  const rules = [
    ...css.matchAll(
      /\.chip--(\w+)\s*\{background:(#[0-9A-Fa-f]{6});color:(#[0-9A-Fa-f]{6});border-color:(#[0-9A-Fa-f]{6})\}/g,
    ),
  ];
  // Derive the denominator from the file, not from a literal: a chip rule the
  // regex cannot parse is a chip rule this duplicate check never sees, and a
  // hardcoded count alone would still read 10 while an 11th slipped past.
  const declared = css.match(/\.chip--[\w-]+/g) ?? [];
  assert.equal(
    rules.length,
    declared.length,
    'every declared .chip--* rule must be parseable by the triplet regex',
  );
  assert.equal(rules.length, 10, 'must find all 10 .chip--* rules in components.css');

  const seen = new Map();
  for (const [, key, bg, fg, border] of rules) {
    const triplet = `${bg}/${fg}/${border}`.toUpperCase();
    assert.ok(
      !seen.has(triplet),
      `.chip--${key} reuses the colours of .chip--${seen.get(triplet)} (${triplet}) — two states must never render identically`,
    );
    seen.set(triplet, key);
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

// ---------- Data / feedback layer drift-guard (Story 1.5) ----------
// Banner/Table/Stepper/KPI are hand-authored verbatim from the mockup (lines
// 111-149). These assertions fail if a selector is dropped, a core declaration
// or canonical hex drifts, or the radius remap is forgotten. (Flatness + the
// sanctioned ring are covered by test 3; cross-file token integrity by test 8 —
// both scan the whole file, including this block.)

// (14) Every Banner/Table/Stepper/KPI selector + variant must be present.
test('all data/feedback selectors and variants exist (AC-1/2/3/4)', () => {
  const required = [
    '.banner', '.banner b', '.banner--info', '.banner--danger',
    '.table', '.table th', '.table td', '.table .num', '.table .strong', '.table tr.zebra',
    '.stepper', '.step', '.step .node', '.step .bul', '.step .st-label', '.step .bar',
    '.step.done', '.step.current', '.step.gate',
    '.kpis', '.kpi', '.kpi .k-l', '.kpi .k-v', '.kpi .k-d', '.kpi.accent',
    '.chart', '.chart .bar', '.chart .bar b', '.chart .bar span',
  ];
  for (const sel of required) {
    assert.ok(css.includes(sel), `components.css missing selector: ${sel}`);
  }
});

// (15) Table core declarations, verbatim from the mockup (AC-1).
test('Table core declarations match the mockup verbatim (AC-1)', () => {
  assert.ok(css.includes('.table{width:100%;border-collapse:collapse;font-size:12.5px}'), '.table base verbatim');
  assert.ok(css.includes('background:var(--surface-2)'), '.table th must be on surface-2');
  assert.ok(css.includes('text-transform:uppercase'), '.table th must be micro-uppercase');
  assert.ok(css.includes('border-bottom:1.5px solid var(--line)'), '.table th must have 1.5px bottom border');
  assert.ok(css.includes('.table td{padding:9px 12px;border-bottom:1px solid var(--line);color:var(--ink-2);vertical-align:middle}'), '.table td verbatim');
  assert.ok(css.includes('.table tr:last-child td{border-bottom:0}'), '.table last row must drop its border');
  assert.ok(css.includes('.table .num{text-align:right}'), '.table .num must right-align');
  assert.ok(css.includes('.table .strong{color:var(--ink);font-weight:800}'), '.table .strong must be ink + 800');
  assert.ok(css.includes('.table tr.zebra td{background:#F7FBFA}'), '.table zebra must be #F7FBFA (canonical literal)');
});

// (16) Stepper core declarations, incl. the sanctioned ring + dashed gate (AC-2/5).
test('Stepper core declarations match the mockup verbatim (AC-2/5)', () => {
  assert.ok(css.includes('.step .bul{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--line);background:#fff;'), '.step .bul 26px circle verbatim');
  assert.ok(css.includes('.step .bar{width:26px;height:1.5px;background:var(--line);margin-top:-18px}'), '.step .bar verbatim');
  assert.ok(css.includes('.step.done .bul{border-color:var(--teal);background:var(--teal);color:#fff}'), '.step.done must be teal solid + white');
  assert.ok(/\.step\.current \.bul\{[^}]*box-shadow:0 0 0 3px var\(--teal-050\)\}/.test(css), '.step.current must carry the sanctioned teal-050 ring');
  assert.ok(css.includes('.step.gate .bul{border-style:dashed;color:#c3d3ce}'), '.step.gate must be dashed border');
  assert.ok(css.includes('.step .st-label{font-size:9.5px'), '.st-label must be micro 9.5px');
});

// (17) KPI core declarations, verbatim from the mockup (AC-3).
test('KPI core declarations match the mockup verbatim (AC-3)', () => {
  assert.ok(css.includes('.kpi{border:1.5px solid var(--line);border-radius:var(--radius-lg);padding:12px 14px}'), '.kpi base verbatim');
  assert.ok(css.includes('.kpi .k-v{font-size:23px;font-weight:900;letter-spacing:-.02em;margin-top:5px}'), '.k-v must be display 23px/900');
  assert.ok(css.includes('.kpi .k-d{font-size:11px;font-weight:700;color:var(--ok);margin-top:2px}'), '.k-d must always be ok-green');
  assert.ok(css.includes('.kpi.accent{border-color:var(--teal);background:var(--teal-050)}'), '.kpi.accent must be teal border + teal-050 bg');
});

// (18) Banner core declarations + the 3 tones, verbatim from the mockup (AC-4).
test('Banner core declarations match the mockup verbatim (AC-4)', () => {
  assert.ok(css.includes('border:1.5px solid var(--warn)') && css.includes('background:#FBF0DA;color:#8A5C08'), '.banner warn base verbatim');
  assert.ok(css.includes('border-radius:var(--radius)'), '.banner must use var(--radius)');
  assert.ok(css.includes('.banner b{font-weight:800}'), '.banner b must be weight 800');
  assert.ok(css.includes('.banner--info{border-color:var(--info);background:#DEF1F6;color:#0C6B84}'), '.banner--info verbatim');
  assert.ok(css.includes('.banner--danger{border-color:var(--danger);background:#FAE6E6;color:#B22C2C}'), '.banner--danger verbatim');
});

// (19) Radius remap: .kpi uses var(--radius-lg); the whole file keeps no raw
// var(--r*) (test 4's regex already covers --r/--r-sm/--r-lg — re-assert here
// so a forgotten Story-1.5 remap is pinned to this block).
test('data/feedback radius vars are remapped, no raw var(--r*)', () => {
  assert.ok(css.includes('.kpi{border:1.5px solid var(--line);border-radius:var(--radius-lg)'), '.kpi must use var(--radius-lg), not var(--r-lg)');
  assert.ok(!/var\(--r(-sm|-lg)?\)/.test(css), 'components.css must keep no raw var(--r)/var(--r-sm)/var(--r-lg)');
});

// (20) Icon context-sizing: <Icon> renders a plain `.icn`, so the mockup sizes it
// in context (mockup lines 326-328). Without these rules the Stepper tick and
// Banner icon fall back to the 18px .icn default — a drift from the mockup. Same
// pattern as the shipped `.btn .icn` (Story 1.3).
test('icon context sizing matches the mockup (banner 16px, stepper/table num 14px)', () => {
  assert.ok(css.includes('.banner .icn{width:16px;height:16px;margin-top:1px}'), '.banner .icn must be 16px (mockup)');
  assert.ok(css.includes('.table .num .icn{width:14px;height:14px}'), '.table .num .icn must be 14px (mockup)');
  assert.ok(css.includes('.step .bul .icn{width:14px;height:14px}'), '.step .bul .icn must be 14px (mockup)');
});

// ---------- Behavior / interaction layer drift-guard (Story 1.6) ----------
// The overlay backdrop (.scrim), Dialog (.modal*), Sheet (.sheet*), upload
// thumbnails (.thumb*), and the list-state skeleton (.skel) are hand-authored
// verbatim from the mockup (lines 164-182) except the radius remap. These
// assertions fail if a selector is dropped, a core declaration drifts, or the
// radius remap is forgotten. (Flatness — 0 drop-shadow — is covered by test 3;
// cross-file token integrity by test 8 — both scan the whole file, incl. this
// block, so a drop-shadow on the modal or an undefined token would already fail
// there.)

// (21) Every overlay/sheet/thumb/scrim/skel selector must be present.
test('all behavior-layer selectors exist (AC-2/3/5)', () => {
  const required = [
    '.scrim', '.scrim--sheet',
    '.modal', '.modal-head', '.modal-head .mt', '.modal-body', '.modal-foot',
    '.sheet', '.sheet-grab',
    '.thumbs', '.thumb', '.thumb.add',
    '.skel',
  ];
  for (const sel of required) {
    assert.ok(css.includes(sel), `components.css missing selector: ${sel}`);
  }
});

// (22) Dialog/Sheet core declarations, verbatim from the mockup (AC-3). Modal +
// sheet float via a 1.5px ink border; head/foot split by 1.5px line borders.
test('Dialog/Sheet core declarations match the mockup verbatim (AC-3)', () => {
  assert.ok(css.includes('.modal{width:340px;background:#fff;border:1.5px solid var(--ink);border-radius:var(--radius-lg);overflow:hidden}'), '.modal base verbatim');
  assert.ok(css.includes('.modal-head{padding:13px 16px;border-bottom:1.5px solid var(--line)'), '.modal-head must have 1.5px line bottom border');
  assert.ok(css.includes('.modal-head .mt{font-size:14px;font-weight:800}'), '.modal-head .mt verbatim');
  assert.ok(css.includes('.modal-body{padding:16px}'), '.modal-body verbatim');
  assert.ok(css.includes('.modal-foot{padding:12px 16px;border-top:1.5px solid var(--line);display:flex;gap:8px}'), '.modal-foot verbatim');
  assert.ok(css.includes('.sheet{width:300px;background:#fff;border:1.5px solid var(--ink);border-radius:18px 18px 0 0;overflow:hidden}'), '.sheet base verbatim (18px top corners kept)');
  assert.ok(css.includes('.sheet-grab{width:38px;height:4px;background:var(--line);border-radius:var(--radius-full);margin:9px auto 4px}'), '.sheet-grab verbatim');
});

// (23) Backdrop .scrim (new, production): fixed viewport cover that dims with
// --ink@.32 — the "float via border on a dimmed backdrop, no drop-shadow" rule.
test('.scrim is a fixed ink@.32 backdrop (AC-3, Viền nét)', () => {
  assert.ok(css.includes('.scrim{position:fixed;inset:0'), '.scrim must be position:fixed;inset:0 (full viewport)');
  assert.ok(css.includes('background:rgba(12,31,28,.32)'), '.scrim must dim with --ink (#0C1F1C) at .32 alpha');
  assert.ok(css.includes('.scrim.scrim--sheet{align-items:flex-end'), '.scrim--sheet must bottom-anchor the sheet');
});

// (24) Upload thumbnails + skeleton verbatim (AC-5/2), incl. the dashed teal add
// tile and the token-based skel helper.
test('thumbnails + skeleton match the mockup verbatim (AC-5/2)', () => {
  assert.ok(css.includes('.thumbs{display:flex;gap:8px;flex-wrap:wrap}'), '.thumbs verbatim');
  assert.ok(css.includes('.thumb{width:74px;height:74px;border:1.5px solid var(--line);border-radius:var(--radius);background:var(--surface-2);'), '.thumb 74px square verbatim');
  assert.ok(css.includes('.thumb.add{border-style:dashed;border-color:var(--teal);color:var(--teal-700);font-weight:800}'), '.thumb.add must be the dashed teal tile');
  assert.ok(css.includes('.skel{background:var(--surface-2);border-radius:6px}'), '.skel must be surface-2 + 6px radius');
});

// (25) Radius remap for the behavior layer: .modal → var(--radius-lg), .thumb →
// var(--radius), .sheet-grab → var(--radius-full). test 4's regex already bans
// any raw var(--r*) across the file — re-assert the mapped values are present so
// a forgotten Story-1.6 remap is pinned to this block.
test('behavior-layer radius vars are remapped (no raw var(--r*))', () => {
  assert.ok(css.includes('.modal{width:340px;background:#fff;border:1.5px solid var(--ink);border-radius:var(--radius-lg)'), '.modal must use var(--radius-lg), not var(--r-lg)');
  assert.ok(css.includes('.thumb{width:74px;height:74px;border:1.5px solid var(--line);border-radius:var(--radius);'), '.thumb must use var(--radius), not var(--r)');
  assert.ok(css.includes('.sheet-grab{width:38px;height:4px;background:var(--line);border-radius:var(--radius-full)'), '.sheet-grab must use var(--radius-full), not 99px');
  assert.ok(!/var\(--r(-sm|-lg)?\)/.test(css), 'components.css must keep no raw var(--r)/var(--r-sm)/var(--r-lg)');
});
