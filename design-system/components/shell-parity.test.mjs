// Cross-platform parity guard for the app-shell layer (Story 1.8 + 1.9). The
// single source of truth is the mockup `all-screens.html` <style> block: the
// canonical shell constants must appear there AND in every platform that ships
// the surface. A value drifted on one side fails here.
//
// Surface ownership:
//   - shared (mockup ↔ Flutter ↔ web):  .topbar  (screen top bar)
//   - mobile-only (mockup ↔ Flutter):    .botnav / .phone / FAB
//   - web-only    (mockup ↔ web):        .web-chrome / .sidebar / .seg / .tabs
// The mobile shell landed in 1.8; the web shell landed in 1.9, so the shared
// topbar is now checked Flutter ↔ web ↔ mockup, and the "web frame" role is
// asserted on both platforms (different shape — browser chrome vs phone frame —
// but the same job: the outer surface, UX-DR-27).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> root

const mockup = readFileSync(
  resolve(
    repoRoot,
    '_bmad-output/planning-artifacts/ux-designs',
    'ux-Solar-Energy-Management-2026-07-06/mockups/all-screens.html',
  ),
  'utf8',
);

const shellDir = resolve(repoRoot, 'mobile/lib/design_system/shell');
const topbar = readFileSync(resolve(shellDir, 'app_topbar.dart'), 'utf8');
const botnav = readFileSync(resolve(shellDir, 'app_bottom_nav.dart'), 'utf8');
const phone = readFileSync(resolve(shellDir, 'app_phone_frame.dart'), 'utf8');

// Web shell (Story 1.9): the canonical CSS layer + the Topbar React component.
const webShellDir = resolve(repoRoot, 'web/src/design-system/shell');
const webShellCss = readFileSync(resolve(webShellDir, 'shell.css'), 'utf8');
const webTopbar = readFileSync(resolve(webShellDir, 'Topbar.tsx'), 'utf8');

// --- Topbar (.topbar, CSS 233-244) -----------------------------------------
test('topbar: 1.5px ink border-bottom + 10/13 padding, mockup ↔ Flutter', () => {
  assert.ok(
    mockup.includes('border-bottom:1.5px solid var(--ink)'),
    'mockup .topbar lost its 1.5px ink border-bottom',
  );
  // Flutter: border(bottom: BorderSide(color: AppTokens.ink, width: borderWidth))
  assert.match(topbar, /bottom:\s*BorderSide\(color:\s*AppTokens\.ink/);
  assert.match(topbar, /horizontal:\s*13\.0,\s*vertical:\s*10\.0/);
  // back button 28×28, radiusSm(8)
  assert.ok(mockup.includes('width:28px;height:28px'));
  assert.match(topbar, /width:\s*28\.0/);
});

// --- Bottom-nav (.botnav, CSS 247-258) -------------------------------------
const LOCKED_TABS = ['Trang chủ', 'Đơn hàng', 'Tạo', 'Kho', 'Menu'];

test('botnav: 1.5px ink border-top, mockup ↔ Flutter', () => {
  assert.ok(
    mockup.includes('border-top:1.5px solid var(--ink)'),
    'mockup .botnav lost its 1.5px ink border-top',
  );
  assert.match(botnav, /top:\s*BorderSide\(color:\s*AppTokens\.ink/);
});

test('botnav: locked to the 5 canonical tabs in order', () => {
  let cursor = 0;
  for (const label of LOCKED_TABS) {
    const at = botnav.indexOf(label, cursor);
    assert.ok(at >= 0, `app_bottom_nav.dart missing locked tab "${label}"`);
    cursor = at + label.length;
  }
  // exactly 5, enforced by the runtime assert
  assert.match(botnav, /_tabs\.length\s*==\s*5/);
});

test('botnav FAB: 46px, -22 raise, 3px band, teal-700 ring — mockup ↔ Flutter', () => {
  assert.ok(mockup.includes('width:46px;height:46px'));
  assert.ok(mockup.includes('margin-top:-22px'));
  assert.ok(mockup.includes('border:3px solid #fff'));
  assert.ok(mockup.includes('box-shadow:0 0 0 1.5px var(--teal-700)'));
  // Flutter FAB: 46 core, -22 translate, 3px band, teal700 ring
  assert.match(botnav, /width:\s*46\.0,\s*height:\s*46\.0/);
  assert.match(botnav, /Offset\(0\.0,\s*-22\.0\)/);
  assert.match(botnav, /padding:\s*const EdgeInsets\.all\(3\.0\)/);
  assert.match(botnav, /color:\s*AppTokens\.teal700/);
});

// --- Phone frame (.phone, CSS 261-266) -------------------------------------
test('phone: 330 body / radius 40 / glass 700 / radius 32 — mockup ↔ Flutter', () => {
  assert.ok(mockup.includes('width:330px'));
  assert.ok(mockup.includes('border-radius:40px'));
  assert.ok(mockup.includes('height:700px'));
  assert.ok(mockup.includes('border-radius:32px'));
  assert.match(phone, /width:\s*330\.0/);
  assert.match(phone, /BorderRadius\.circular\(40\.0\)/);
  assert.match(phone, /height:\s*700\.0/);
  assert.match(phone, /BorderRadius\.circular\(32\.0\)/);
});

test('phone notch: 116×22, dark body #0C1512 — mockup ↔ Flutter', () => {
  assert.ok(mockup.includes('width:116px;height:22px'));
  assert.ok(mockup.includes('#0C1512'));
  assert.match(phone, /width:\s*116\.0,\s*height:\s*22\.0/);
  // dark body literal read verbatim (no case change — Story 1.7 lesson)
  assert.ok(phone.includes('0xFF0C1512'), 'phone body literal drifted');
});

// === Web shell (Story 1.9) ================================================

// --- SHARED topbar: mockup ↔ Flutter ↔ web (the one cross-platform surface) --
test('topbar: 1.5px ink border-bottom, mockup ↔ Flutter ↔ web', () => {
  const decl = 'border-bottom:1.5px solid var(--ink)';
  assert.ok(mockup.includes(decl), 'mockup .topbar lost its 1.5px ink border-bottom');
  assert.ok(webShellCss.includes(decl), 'web .topbar lost its 1.5px ink border-bottom');
  // Flutter: border(bottom: BorderSide(color: AppTokens.ink, width: borderWidth))
  assert.match(topbar, /bottom:\s*BorderSide\(color:\s*AppTokens\.ink/);
});

test('topbar back: 28×28, mockup ↔ Flutter ↔ web', () => {
  assert.ok(mockup.includes('width:28px;height:28px'), 'mockup .topbar-back drifted from 28×28');
  assert.ok(webShellCss.includes('width:28px;height:28px'), 'web .topbar-back drifted from 28×28');
  assert.match(topbar, /width:\s*28\.0/);
});

test('topbar eyebrow: micro-uppercase ls .1em + verbatim (no toUpperCase), Flutter ↔ web', () => {
  // ls .1em on both platforms (Flutter encodes it as 0.1 * 10.0).
  assert.ok(webShellCss.includes('letter-spacing:.1em'), 'web .topbar-eyebrow lost letter-spacing:.1em');
  assert.ok(webShellCss.includes('text-transform:uppercase'), 'web .topbar-eyebrow lost text-transform:uppercase');
  assert.match(topbar, /letterSpacing:\s*0\.1\s*\*\s*10\.0/);
  // Eyebrow shown verbatim — neither platform force-uppercases in CODE (the
  // caller passes it already uppercased, keeping the string byte-identical).
  // Strip comments first: both files DOCUMENT this rule with the word
  // `.toUpperCase()`, which must not be mistaken for an actual call.
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/toUpperCase/.test(stripComments(webTopbar)), 'web Topbar must not call toUpperCase (eyebrow verbatim)');
  assert.ok(!/toUpperCase/.test(stripComments(topbar)), 'Flutter topbar must not call toUpperCase (eyebrow verbatim)');
});

// --- WEB-FRAME role parity: web browser chrome ↔ mobile phone frame ----------
// Different shape (a 1.5px ink browser card vs a dark 40-radius phone body) but
// the same job: the outermost surface that hosts the shell (UX-DR-27).
test('web frame: 1.5px ink border + radius-lg (web) — the web-only outer surface', () => {
  assert.ok(webShellCss.includes('border:1.5px solid var(--ink)'), '.web must keep its 1.5px ink border');
  assert.ok(webShellCss.includes('border-radius:var(--radius-lg)'), '.web must use --radius-lg (remapped)');
  // and its mobile counterpart still carries the phone-frame role
  assert.match(phone, /BorderRadius\.circular\(40\.0\)/);
});

// --- WEB-ONLY surfaces (no mobile counterpart): sidebar / seg / tabs / chrome -
test('web-only surfaces present in web shell + mockup, absent from mobile shell', () => {
  for (const decl of ['width:186px;flex:0 0 186px', '.web-chrome', '.seg a.active', '.tabs a.active']) {
    assert.ok(webShellCss.includes(decl), `web shell missing web-only surface: ${decl}`);
  }
  // mockup owns the canonical sidebar too
  assert.ok(mockup.includes('width:186px;flex:0 0 186px'), 'mockup lost the 186px sidebar');
  // these are web-only: they must NOT appear in the mobile shell widgets
  const mobile = topbar + botnav + phone;
  assert.ok(!/sidebar|web-chrome/i.test(mobile), 'mobile shell must not contain web-only sidebar/web-chrome');
});
