// Drift-guard for the hand-authored web SHELL CSS (Story 1.9, Task 7).
//
// Same anti-drift contract as components.test.mjs, applied to the shell layer:
// reads web/src/design-system/shell/shell.css as text and asserts the selectors
// exist, the core declarations match the mockup verbatim (all-screens.html
// lines 232-315), the radius vars were remapped (--r* -> --radius*), the "Viền
// nét" flat rule holds (0 shadow/gradient — web shell has NO FAB exception), and
// the 900px breakpoint reshapes the shell. Any drift breaks this test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root
const CSS_PATH = resolve(repoRoot, 'web/src/design-system/shell/shell.css');
const css = readFileSync(CSS_PATH, 'utf8');

// (a) Every shell selector must be present (AC-1/2/3/5).
test('all shell selectors exist (AC-1/2/3/5)', () => {
  const required = [
    '.topbar', '.topbar-back', '.topbar-title', '.topbar-eyebrow', '.topbar-action',
    '.web', '.web-chrome', '.web-dots', '.web-url', '.web-app',
    '.sidebar', '.brand2', '.navlink', '.navlink.active', '.navsec',
    '.main', '.toolbar', '.search', '.seg', '.seg a.active',
    '.tabs', '.tabs a.active',
    '@media(max-width:900px)',
  ];
  for (const sel of required) {
    assert.ok(css.includes(sel), `shell.css missing selector: ${sel}`);
  }
});

// (b) Core declarations, verbatim from the mockup (AC-1/2/3/5).
test('core declarations match the mockup verbatim (AC-1/2/3/5)', () => {
  // Sidebar: fixed 186px, surface-2 fill, 1.5px line right border.
  assert.ok(css.includes('width:186px;flex:0 0 186px'), '.sidebar must be width:186px;flex:0 0 186px');
  assert.ok(css.includes('background:var(--surface-2)'), '.sidebar must fill var(--surface-2)');
  assert.ok(css.includes('border-right:1.5px solid var(--line)'), '.sidebar must have 1.5px line right border');
  // Active navlink: white surface + teal border + teal-700 text.
  assert.ok(css.includes('background:#fff'), '.navlink.active must have background:#fff');
  assert.ok(css.includes('border:1.5px solid var(--teal)'), '.navlink.active must have 1.5px teal border');
  assert.ok(css.includes('color:var(--teal-700)'), '.navlink.active must have color:var(--teal-700)');
  // Web frame: 1.5px ink border.
  assert.ok(css.includes('border:1.5px solid var(--ink)'), '.web must have 1.5px ink border');
  // URL pill: 999px literal (NOT --radius-full — keep mockup verbatim).
  assert.ok(css.includes('border-radius:999px'), '.web-url must have border-radius:999px');
  // Seg active: teal fill, white text.
  assert.ok(css.includes('background:var(--teal);color:#fff'), '.seg a.active must be teal bg + #fff text');
  // Tabs active: teal underline.
  assert.ok(css.includes('border-bottom-color:var(--teal)'), '.tabs a.active must underline teal');
  // Topbar: 1.5px ink border-bottom.
  assert.ok(css.includes('border-bottom:1.5px solid var(--ink)'), '.topbar must have 1.5px ink border-bottom');
});

// (c) Radius remap — --r* rewritten to --radius* (the #1 drift point).
test('radius vars remapped --r* -> --radius* (AC-5d)', () => {
  assert.ok(css.includes('var(--radius-lg)'), '.web must use var(--radius-lg)');
  assert.ok(css.includes('var(--radius-sm)'), '.navlink must use var(--radius-sm)');
  assert.ok(css.includes('var(--radius)'), '.seg must use var(--radius)');
  // The un-remapped mockup vars must NOT survive anywhere.
  assert.ok(!/var\(--r[-)]/.test(css), 'shell.css still contains an un-remapped var(--r) / var(--r-sm) / var(--r-lg)');
});

// (d) Viền nét — web shell is 100% flat: 0 shadow/gradient/filter (no FAB).
test('flat: 0 shadow/gradient/filter — no exceptions (AC-5c)', () => {
  assert.ok(!/box-shadow/i.test(css), 'shell.css must contain 0 box-shadow (web shell has no FAB exception)');
  assert.ok(!/drop-shadow/i.test(css), 'shell.css must contain 0 drop-shadow');
  assert.ok(!/gradient/i.test(css), 'shell.css must contain 0 gradient');
  assert.ok(!/filter\s*:/i.test(css), 'shell.css must contain 0 filter:');
});

// (b2) Canonical literals + shell-context icon sizes (AC-1/2/3/5).
// The mockup enumerates many exact values the "selectors exist" check does not
// pin; drift on any of these silently breaks the shell's look.
test('canonical literals & shell icon sizes are verbatim (AC-1/2/3/5)', () => {
  // Shell-context icon sizes (mockup 320-322): a size-less <Icon> in a slot
  // still lands at the canonical px.
  assert.ok(css.includes('.topbar-back .icn{width:18px;height:18px}'), 'topbar-back icon must be 18px');
  assert.ok(css.includes('.topbar-action .icn{width:15px;height:15px}'), 'topbar-action icon must be 15px');
  assert.ok(css.includes('.si .icn{width:16px;height:16px}'), 'search icon must be 16px');
  assert.ok(css.includes('.logo .icn{width:18px;height:18px}'), 'brand logo icon must be 18px');
  // Resting navlink icon: 16px + the canonical #8fa39e; active tints it teal.
  assert.ok(css.includes('.sidebar .navlink .icn{width:16px;height:16px;color:#8fa39e}'),
    'navlink icon must be 16px #8fa39e');
  assert.ok(css.includes('.sidebar .navlink.active .icn{color:var(--teal)}'),
    'active navlink must tint its icon teal');
  // Web frame sizing + app min-height.
  assert.ok(css.includes('flex:1 1 760px'), '.web must be flex:1 1 760px');
  assert.ok(css.includes('min-height:520px'), '.web-app must be min-height:520px');
  // Search: .field reserves 32px, the .si icon uses the muted #9fb2ad literal.
  assert.ok(css.includes('.search .field{padding-left:32px}'), '.search .field must reserve 32px on the left');
  assert.ok(css.includes('color:#9fb2ad'), '.si must use the #9fb2ad search-icon literal');
  // navsec micro-uppercase grey literal.
  assert.ok(css.includes('color:#a9bab5'), '.navsec must use the #a9bab5 literal');
  // Seg dividers: right border per item, reset on the last.
  assert.ok(css.includes('.seg a:last-child{border-right:0}'), '.seg last item must drop its right border');
  // Main content padding.
  assert.ok(css.includes('padding:18px 20px'), '.main must be padding:18px 20px');
  // Brand logo mark: 26×26, teal border, 7px radius (literal, not a token).
  assert.ok(css.includes('width:26px;height:26px;border:1.5px solid var(--teal);border-radius:7px'),
    '.brand2 .logo must be 26×26 with a 1.5px teal 7px-radius border');
});

// (e) Responsive breakpoint reshapes the shell (AC-4).
test('900px breakpoint stacks the shell (AC-4)', () => {
  const media = css.slice(css.indexOf('@media(max-width:900px)'));
  assert.ok(media.includes('.web-app{flex-direction:column}'), 'media: .web-app must become flex-direction:column');
  assert.ok(media.includes('width:auto'), 'media: .sidebar must become width:auto');
  assert.ok(media.includes('border-bottom:1.5px solid var(--line)'), 'media: .sidebar must gain a bottom border');
  assert.ok(media.includes('grid-template-columns:repeat(2,1fr)'), 'media: .kpis must drop to 2 columns');
});
