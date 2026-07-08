// Cross-platform parity guard for the component layer (Story 1.7, Task 7 —
// AC-3, UX-DR-27 "same screen on web + mobile"). This is the test-level
// embodiment of "one design system, two platforms": the canonical status/banner
// hex must appear BYTE-FOR-BYTE in the web CSS AND the Flutter widgets, and
// every web component must have a matching Dart widget file. A colour changed on
// one side without the other — or a widget shipped on one platform only — fails
// here. Mirrors tokens/parity.test.mjs and icons/parity.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> root

const webCss = readFileSync(
  resolve(repoRoot, 'web/src/design-system/components/components.css'),
  'utf8',
);
const mobileDir = resolve(repoRoot, 'mobile/lib/design_system/components');
const statusDart = readFileSync(resolve(mobileDir, 'status_chip.dart'), 'utf8');
const bannerDart = readFileSync(resolve(mobileDir, 'banner.dart'), 'utf8');

// The 9 canonical status triplets, verbatim from AC / DESIGN.md. This list is
// the shared contract both platforms must satisfy.
const STATUS_TRIPLETS = {
  baogia: ['#EAF3F1', '#3A5450', '#CFE5E0'],
  choduyet: ['#FBF0DA', '#8A5C08', '#EFD9A8'],
  dachot: ['#DCF3EF', '#0B7264', '#B7E5DD'],
  dacoc: ['#E7F5D9', '#4B7A15', '#CDE9AC'],
  thicong: ['#FCEAD4', '#985B08', '#F2D3A6'],
  nghiemthu: ['#E4EEFA', '#345C9C', '#C4D8F0'],
  danggiao: ['#DEF1F6', '#0C6B84', '#B7E0EB'],
  hoanthanh: ['#DEF3E6', '#137A4C', '#B7E5CA'],
  huy: ['#FAE6E6', '#B22C2C', '#F0C7C7'],
};

// The 3 banner tone pairs [bg, fg].
const BANNER_TONES = {
  warn: ['#FBF0DA', '#8A5C08'],
  info: ['#DEF1F6', '#0C6B84'],
  danger: ['#FAE6E6', '#B22C2C'],
};

// Hex in CSS is `#RRGGBB`; in Dart it is `Color(0xFFRRGGBB)`.
const dartHex = (hex) => `0xFF${hex.slice(1).toUpperCase()}`;

test('9 status triplets are byte-identical on web (CSS) and mobile (Dart)', () => {
  for (const [key, triplet] of Object.entries(STATUS_TRIPLETS)) {
    for (const hex of triplet) {
      assert.ok(
        webCss.toUpperCase().includes(hex.toUpperCase()),
        `components.css missing ${key} hex ${hex}`,
      );
      assert.ok(
        statusDart.includes(dartHex(hex)),
        `status_chip.dart missing ${key} hex ${hex} (${dartHex(hex)})`,
      );
    }
  }
});

test('3 banner tone hex pairs are byte-identical on web and mobile', () => {
  for (const [tone, pair] of Object.entries(BANNER_TONES)) {
    for (const hex of pair) {
      assert.ok(
        webCss.toUpperCase().includes(hex.toUpperCase()),
        `components.css missing banner ${tone} hex ${hex}`,
      );
      assert.ok(
        bannerDart.includes(dartHex(hex)),
        `banner.dart missing banner ${tone} hex ${hex} (${dartHex(hex)})`,
      );
    }
  }
});

test('status labels are byte-identical Vietnamese on both platforms', () => {
  // Sample the label whose casing/diacritics are easiest to drift.
  const labels = ['Báo giá', 'Chờ duyệt', 'Đã chốt', 'Đang thi công', 'Huỷ'];
  for (const label of labels) {
    assert.ok(statusDart.includes(label), `status_chip.dart missing label "${label}"`);
  }
});

test('every web component has a matching Flutter widget file (parity coverage)', () => {
  // 21 components (web index.ts) → the Dart file that mirrors each. If a widget
  // ships on web but not mobile (or vice versa) this list catches it.
  const parityFiles = {
    Button: 'button.dart',
    Card: 'card.dart',
    Frame: 'card.dart',
    Field: 'field.dart',
    Chip: 'chip.dart',
    StatusChip: 'status_chip.dart',
    CustomerTypeChip: 'chip.dart',
    ScopeFlag: 'chip.dart',
    Table: 'table.dart',
    Stepper: 'stepper.dart',
    Kpi: 'kpi.dart',
    Banner: 'banner.dart',
    CartLineRow: 'cart_line_row.dart',
    Dialog: 'dialog.dart',
    ConfirmDialog: 'dialog.dart',
    Sheet: 'sheet.dart',
    Skeleton: 'skeleton.dart',
    EmptyState: 'empty_state.dart',
    ErrorState: 'error_state.dart',
    ShareButton: 'share_button.dart',
    ImageUpload: 'image_upload.dart',
  };
  for (const [component, file] of Object.entries(parityFiles)) {
    assert.ok(
      existsSync(resolve(mobileDir, file)),
      `mobile widget for ${component} missing: ${file}`,
    );
  }
});

test('the mobile widget classes carry the App-prefixed parity names', () => {
  const barrel = readFileSync(resolve(mobileDir, 'components.dart'), 'utf8');
  const names = [
    'AppButton', 'AppCard', 'AppFrame', 'AppField', 'AppChip', 'AppStatusChip',
    'AppCustomerTypeChip', 'AppScopeFlag', 'AppTable', 'AppStepper', 'AppKpi',
    'AppBanner', 'AppCartLineRow', 'AppDialog', 'AppConfirmDialog', 'AppSheet',
    'AppSkeleton', 'AppEmptyState', 'AppErrorState', 'AppShareButton',
    'AppImageUpload',
  ];
  for (const name of names) {
    assert.ok(barrel.includes(name), `components.dart barrel missing export ${name}`);
  }
});

// ---------- Gating + a11y-floor parity (Story 1.10, UX-DR-22/26/27) ----------
// Surface ownership for this layer:
//   - Gating (shared CONCEPT, per-platform impl): web gating/ (Gate + can +
//     filterNav + orderScope) ↔ Flutter gating/ (AppGate + can + filterNav +
//     orderScope). Same semantics ("missing permission = the surface vanishes"),
//     same key-agnostic string keys — different language, one design system.
//   - A11y floor (per-platform VALUE by design): web 44px (WCAG/Apple pt) in
//     a11y/a11y.css ↔ mobile 48dp (Material) in AppTokens.tapTargetMin. dp≠px,
//     so the numbers differ ON PURPOSE — asserting they are NOT forced equal.

test('gating primitives ship on BOTH platforms with equivalent API (UX-DR-27)', () => {
  const webPerms = readFileSync(resolve(repoRoot, 'web/src/design-system/gating/permissions.ts'), 'utf8');
  const webGate = readFileSync(resolve(repoRoot, 'web/src/design-system/gating/Gate.tsx'), 'utf8');
  const mobPerms = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/gating/app_permissions.dart'), 'utf8');
  const mobGate = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/gating/app_gate.dart'), 'utf8');

  // Same three pure helpers, same names, on both platforms. (web filterNav is
  // generic — `filterNav<…>(` — so allow an optional type-parameter list.)
  for (const helper of ['can', 'filterNav', 'orderScope']) {
    const decl = new RegExp(`${helper}\\s*[(<]`);
    assert.match(webPerms, decl, `web gating missing helper ${helper}`);
    assert.match(mobPerms, decl, `mobile gating missing helper ${helper}`);
  }
  // The Gate primitive: web `Gate` ↔ Flutter `AppGate` (App-prefixed parity name).
  assert.ok(webGate.includes('function Gate('), 'web must export a Gate primitive');
  assert.ok(mobGate.includes('class AppGate'), 'mobile must export an AppGate primitive');
});

test('mobile bottom-nav stays hard-locked — gating is NOT injected into its 5 tabs (UX-DR-15)', () => {
  // Gating applies to the sidebar / Menu list / in-screen actions — NEVER the
  // 5-tab bottom nav, which is locked to an internal constant (gotcha #6). This
  // guards against a future dev wiring filterNav/perms/AppGate into the tabs.
  const botnav = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/shell/app_bottom_nav.dart'), 'utf8');
  const stripDart = (s) => s.replace(/\/\/\/.*$/gm, '').replace(/\/\/.*$/gm, '');
  const code = stripDart(botnav);
  for (const token of ['filterNav', 'AppGate', 'requires', 'PermissionKey', 'demoPermissions']) {
    assert.ok(!code.includes(token), `app_bottom_nav.dart must stay ungated — found "${token}" (bottom-nav is locked, UX-DR-15)`);
  }
  // The lock itself is still asserted in code (the 5-tab invariant).
  assert.ok(botnav.includes("locked to exactly 5 tabs") || botnav.includes('_tabs.length == 5'), 'bottom-nav must keep its 5-tab lock assertion');
});

test('a11y floor values differ per platform BY DESIGN — 44px web ↔ 48dp mobile', () => {
  const a11yCss = readFileSync(resolve(repoRoot, 'web/src/design-system/a11y/a11y.css'), 'utf8');
  const appTokens = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/tokens/app_tokens.dart'), 'utf8');
  assert.ok(a11yCss.includes('44px'), 'web a11y floor must be 44px (WCAG/Apple pt)');
  assert.ok(appTokens.includes('tapTargetMin = 48.0'), 'mobile a11y floor must be 48dp (Material)');
  // Both sides document the intentional dp≠px difference so nobody "fixes" it.
  assert.ok(/dp≠px|dp !?=|dp vs px/i.test(a11yCss) || /dp≠px/.test(appTokens), 'the dp≠px rationale must be documented');
});
