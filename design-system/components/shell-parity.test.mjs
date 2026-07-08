// Mockup-anchored parity guard for the app-shell layer (Story 1.8, Task 6 —
// AC-5). The single source of truth is the mockup `all-screens.html` <style>
// block (`.topbar`/`.botnav`/`.phone`, lines 232-266): the canonical shell
// constants must appear there AND in the Flutter shell widgets. A value drifted
// on one side fails here.
//
// The web shell (Story 1.9 — React AppTopbar/AppBottomNav/WebFrame) does not
// exist yet, so this guards Flutter-against-mockup only. When 1.9 lands, extend
// with the React side to make it a true cross-platform parity check.

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
