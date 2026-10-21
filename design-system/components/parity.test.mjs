// Cross-platform parity guard for the component layer (Story 1.7, Task 7 —
// AC-3, UX-DR-27 "same screen on web + mobile"). This is the test-level
// embodiment of "one design system, two platforms": the canonical status/banner
// hex must appear BYTE-FOR-BYTE in the web CSS AND the Flutter widgets, and
// every web component must have a matching Dart widget file. A colour changed on
// one side without the other — or a widget shipped on one platform only — fails
// here. Mirrors tokens/parity.test.mjs and icons/parity.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind, assertScanned } from '../lib/assert-scanned.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../lib/strip-comments.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> root

const webCss = readFileSync(
  resolve(repoRoot, 'web/src/design-system/components/components.css'),
  'utf8',
);
const mobileDir = resolve(repoRoot, 'mobile/lib/design_system/components');
const statusDart = readFileSync(resolve(mobileDir, 'status_chip.dart'), 'utf8');
const bannerDart = readFileSync(resolve(mobileDir, 'banner.dart'), 'utf8');
const chipDart = readFileSync(resolve(mobileDir, 'chip.dart'), 'utf8');
const statusChipTsx = readFileSync(
  resolve(repoRoot, 'web/src/design-system/components/StatusChip.tsx'),
  'utf8',
);

// Strip Dart comments so source-guards inspect real code only — the widgets'
// own docstrings describe the forbidden constructs while explaining that they
// are forbidden, which must not trip the guard. `//` runs to end-of-line, which
// also covers `///` docstrings. Safe here because no guarded file contains `//`
// inside a string literal (a `://` URL would be truncated, not just uncommented).
//
// Line comments are stripped FIRST: a `/*` sitting inside a `//` comment is not
// a real block-comment opener, but a block-first pass would treat it as one and
// swallow every line up to the next `*/` — silently deleting real code from the
// scanned string, which is where banned tokens would then hide.
const stripDart = stripComments;

// Interpolating a label straight into a RegExp makes any future label carrying
// `(`, `+`, `?` or `.` a syntax error rather than a clean failure.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The 10 canonical status triplets, verbatim from AC / DESIGN.md. This list is
// the shared contract both platforms must satisfy.
const STATUS_TRIPLETS = {
  baogia: ['#EAF3F1', '#3A5450', '#CFE5E0'],
  choduyet: ['#FBF0DA', '#8A5C08', '#EFD9A8'],
  dachot: ['#DCF3EF', '#0B7264', '#B7E5DD'],
  dacoc: ['#E7F5D9', '#4B7A15', '#CDE9AC'],
  thicong: ['#FCEAD4', '#985B08', '#F2D3A6'],
  nghiemthu: ['#E4EEFA', '#345C9C', '#C4D8F0'],
  danggiao: ['#DEF1F6', '#0C6B84', '#B7E0EB'],
  dagiao: ['#DDF3EA', '#0F7657', '#B7E5D4'],
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

test('10 status triplets are byte-identical on web (CSS) and mobile (Dart)', () => {
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

// Presence alone (above) cannot see a SWAP: if two states trade colour entries,
// every hex still appears somewhere in the file and `includes` stays green. The
// web side is already swap-proof — components.test.mjs binds each triplet to ITS
// OWN `.chip--key` rule. This is the mobile mirror of that binding: each hex
// triplet must sit on ITS OWN `StatusKey.<key>` entry. `\s*` absorbs the
// dart-format 80-col line wrap between the key and StatusChipColors(...).
test('each status triplet is bound to ITS OWN StatusKey entry in Dart (no swap)', () => {
  for (const [key, [bg, fg, border]] of Object.entries(STATUS_TRIPLETS)) {
    const entry = new RegExp(
      `StatusKey\\.${key}:\\s*StatusChipColors\\(\\s*` +
        `Color\\(${dartHex(bg)}\\),\\s*` +
        `Color\\(${dartHex(fg)}\\),\\s*` +
        `Color\\(${dartHex(border)}\\),?\\s*\\)`,
    );
    assert.match(
      statusDart,
      entry,
      `kStatusColors[StatusKey.${key}] must be exactly ` +
        `StatusChipColors(${dartHex(bg)}, ${dartHex(fg)}, ${dartHex(border)}) — ` +
        `a colour swapped onto another state is still a drift (UX-DR-27)`,
    );
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

// Every label, bound to its key — not a sample, and not a third hardcoded copy.
// The web STATUS_LABELS is the source of truth; mobile must mirror it exactly.
//
// A bare `statusDart.includes(label)` cannot catch the `dagiao`/`danggiao`
// twin-name bug ("Đã giao" vs "Đang giao" differ by one `g`): mislabel one state
// with the other's text and both strings still appear in the file. The Flutter
// render test cannot catch it either — it asserts find.text(kStatusLabels[s]!),
// reading the label from the very map under test. So the key↔label binding is
// asserted here, and only here.
const WEB_STATUS_LABELS = (() => {
  const block = statusChipTsx.match(/export const STATUS_LABELS[^{]*\{([\s\S]*?)\};/);
  assert.ok(block, 'StatusChip.tsx must declare and export STATUS_LABELS');
  return [...block[1].matchAll(/(\w+)\s*:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
})();

test('every status label is byte-identical Vietnamese on both platforms', () => {
  // Guard the parse itself: an empty/short match would make the loop below pass
  // vacuously, which is exactly the silent-green failure this file exists to stop.
  assert.equal(
    WEB_STATUS_LABELS.length,
    Object.keys(STATUS_TRIPLETS).length,
    'parsed web STATUS_LABELS must cover all 10 canonical states',
  );
  for (const [key, label] of WEB_STATUS_LABELS) {
    assert.ok(
      Object.hasOwn(STATUS_TRIPLETS, key),
      `web declares status "${key}" with no canonical triplet — states drifted`,
    );
    const entry = new RegExp(`StatusKey\\.${key}\\b:\\s*'${escapeRe(label)}'`);
    assert.match(
      statusDart,
      entry,
      `kStatusLabels[StatusKey.${key}] must be '${label}' verbatim, as on web`,
    );
  }
});

// AC-5 / UX-DR-23 parity: the web chips are guarded read-only by
// chip-components.test.mjs (no onClick/<button>/role/tabindex). Nothing guarded
// the Flutter side, so a tap handler could be added to the chip widgets on
// mobile only and every suite would stay green. A chip displays status; it never
// changes it (status moves only through applyTransition, AD-11).
// Patterns, not a widget blacklist. An enumerated list of names only blocks the
// handlers someone thought to enumerate: `Listener(onPointerDown: …)`,
// `onLongPress`, `Dismissible` and `Draggable` all sail past a 7-item blacklist
// while turning the chip into a status-mutating control with every suite green.
// The web guard (chip-components.test.mjs test (1)) already matches ANY `on[A-Z]`
// handler; this is the Dart mirror of that pattern, so both platforms are held to
// the same rule rather than to two lists that drift apart.
test('mobile chip widgets stay read-only — never a control (AC-5, UX-DR-23)', () => {
  const banned = [
    /\bon[A-Z]\w*\s*:/, // ANY handler argument: onTap, onPressed, onPointerDown, onLongPress, …
    /\b(?:GestureDetector|InkWell|Listener|Dismissible|Draggable|InkResponse)\b/,
    /\b\w*Button\s*\(/, // IconButton, TextButton, ElevatedButton, any *Button constructor
    /\bSemantics\([^)]*button:\s*true/, // a chip must never announce itself as a button
  ];
  for (const [name, src] of [['status_chip.dart', statusDart], ['chip.dart', chipDart]]) {
    const code = stripDart(src);
    for (const pattern of banned) {
      assert.ok(
        !pattern.test(code),
        `${name} must not match ${pattern} — a chip is read-only, never a control (UX-DR-23)`,
      );
    }
  }
});

test('every web component has a matching Flutter widget file (parity coverage)', () => {
  // 23 components (web index.ts) → the Dart file that mirrors each. If a widget
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
    Money: 'money_text.dart',
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
    AttachmentGallery: 'attachment_gallery.dart',
    Checkbox: 'checkbox.dart',
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
    'AppImageUpload', 'AppAttachmentGallery', 'AppCheckbox',
  ];
  for (const name of names) {
    assert.ok(barrel.includes(name), `components.dart barrel missing export ${name}`);
  }
});

// Money display ships on both platforms under the names screens import: web
// <Money> + formatVnd ↔ Flutter MoneyText + formatVnd (same formatter name, so a
// reader can grep one name across both clients).
test('money display is exported on both platforms (Money/MoneyText + formatVnd)', () => {
  const webBarrel = readFileSync(resolve(repoRoot, 'web/src/design-system/components/index.ts'), 'utf8');
  const dartBarrel = readFileSync(resolve(mobileDir, 'components.dart'), 'utf8');
  assert.match(webBarrel, /export \{ Money \} from '\.\/Money'/, 'web barrel must export Money');
  assert.match(webBarrel, /export \{ formatVnd \} from '\.\/format-vnd'/, 'web barrel must export formatVnd');
  assert.match(dartBarrel, /export 'money_text\.dart' show MoneyText, formatVnd;/, 'components.dart must export MoneyText + formatVnd');
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

// Anti-empty (E-7): the negative scans in this file read these stripped sources; if a stripper/reader
// ever returned (near-)empty text they would pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('mobile read-only / bottom-nav scans are not blind — stripped code keeps real content', () => {
  const botnavSrc = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/shell/app_bottom_nav.dart'), 'utf8');
  assertCodeNotBlind(
    [['status_chip.dart', stripDart(statusDart)], ['chip.dart', stripDart(chipDart)], ['app_bottom_nav.dart', stripDart(botnavSrc)]], 1000,
    'parity',
  );
});
