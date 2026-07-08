// Source-guard for the accessibility floor (Story 1.10, Task 7 — AC-2/3). Reads
// the a11y layer as TEXT (web has no runtime build) and asserts: the ≥44px web
// touch-target floor is applied to every interactive control, the ≥48dp mobile
// floor exists as a token and is consumed by AppButton, and every icon-only
// <button> on web carries an aria-label (a screen-reader name). dp≠px, so the
// two floor numbers differ ON PURPOSE (Material 48 vs WCAG/Apple 44).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root

const a11yCss = readFileSync(resolve(repoRoot, 'web/src/design-system/a11y/a11y.css'), 'utf8');
const appTokens = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/tokens/app_tokens.dart'), 'utf8');
const appButton = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/components/button.dart'), 'utf8');
const appTopbar = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/shell/app_topbar.dart'), 'utf8');

// Web: 44px floor applied to the canonical interactive controls. The set covers
// growable controls (.btn/.seg a/.tabs a/.modal-head button/.navlink) AND the
// small icon-only controls whose hit area is grown via ::after (.topbar-back,
// .topbar-action).
test('web a11y.css floors every interactive control at 44px', () => {
  assert.ok(a11yCss.includes('min-height:44px'), 'a11y.css must set min-height:44px');
  assert.ok(a11yCss.includes('min-width:44px'), 'a11y.css must set min-width:44px (icon-only hit area)');
  for (const sel of ['.btn', '.navlink', '.topbar-back', '.topbar-action', '.seg a', '.tabs a', '.modal-head button']) {
    assert.ok(a11yCss.includes(sel), `a11y.css must floor ${sel}`);
  }
});

// Web: the floor layer must NOT restyle colour/border/visual size — it only
// grows touch targets. (Guards against turning a11y.css into a second theme.)
test('web a11y.css changes touch targets only — no colour/border restyle', () => {
  assert.ok(!/\bcolor\s*:/.test(a11yCss), 'a11y.css must not set color');
  assert.ok(!/\bborder\s*:/.test(a11yCss), 'a11y.css must not set border');
  assert.ok(!/\bbackground\s*:/.test(a11yCss), 'a11y.css must not set background');
});

// Mobile: 48dp floor as a token, consumed by AppButton via a ConstrainedBox.
test('mobile floor is a 48dp token consumed by AppButton', () => {
  assert.ok(appTokens.includes('tapTargetMin = 48.0'), 'AppTokens.tapTargetMin must be 48.0 (dp)');
  assert.ok(appButton.includes('ConstrainedBox'), 'AppButton must use a ConstrainedBox for the floor');
  assert.match(appButton, /minHeight:\s*AppTokens\.tapTargetMin/, 'AppButton must floor minHeight at tapTargetMin');
  // The icon-only topbar back expands its hit area to the floor too.
  assert.ok(appTopbar.includes('AppTokens.tapTargetMin'), 'app_topbar back must expand hit area to tapTargetMin');
});

// Web: every icon-only <button> (a <button> whose only child is an <Icon>) needs
// an accessible name. These are the known icon-only controls across the shipped
// components/shell; each file must carry an aria-label.
test('every icon-only web control carries an aria-label', () => {
  const iconOnly = {
    'shell/Topbar.tsx': 'Quay lại',
    'components/Dialog.tsx': 'aria-label',
    'components/Sheet.tsx': 'Đóng',
    'components/CartLineRow.tsx': 'Xoá dòng',
    'components/ImageUpload.tsx': 'Xoá ảnh',
  };
  for (const [file, needle] of Object.entries(iconOnly)) {
    const src = readFileSync(resolve(repoRoot, 'web/src/design-system', file), 'utf8');
    assert.ok(src.includes('aria-label'), `${file} icon-only control must have an aria-label`);
    assert.ok(src.includes(needle), `${file} must label its icon-only control ("${needle}")`);
  }
  // The ImageUpload add-tile file input is icon-only too (Story 1.10 gap fix).
  const upload = readFileSync(resolve(repoRoot, 'web/src/design-system/components/ImageUpload.tsx'), 'utf8');
  assert.ok(upload.includes('aria-label="Thêm ảnh"'), 'ImageUpload add-tile input must have aria-label');
});

// Mobile parity for the same a11y rule: icon-only Flutter controls carry a
// Semantics label + button role (the screen-reader equivalent of aria-label).
// image_upload.dart has two icon-only controls — the add-tile (ic-plus) and the
// per-thumb remove (ic-close) — added in Story 1.10 Task 6.
test('every icon-only mobile control carries a Semantics(button, label)', () => {
  const upload = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/components/image_upload.dart'), 'utf8');
  assert.match(upload, /Semantics\(\s*button:\s*true,\s*label:\s*'Thêm ảnh'/, 'add-tile must be a labelled Semantics button');
  assert.match(upload, /Semantics\(\s*button:\s*true,\s*label:\s*'Xoá ảnh'/, 'remove control must be a labelled Semantics button');
});

// Money / VAT must never be clipped at large text sizes (UX-DR-26): the money
// utility `.mono` and the table number cell `.table .num` must NOT carry
// overflow:hidden or text-overflow:ellipsis — a long "1.234.567.890 đ" has to
// render in full. .mono stays tabular-nums + right-aligned so columns line up.
test('money cells (.mono / .table .num) are never truncated at large sizes', () => {
  const tokensCss = readFileSync(resolve(repoRoot, 'web/src/design-system/tokens/tokens.css'), 'utf8');
  const componentsCss = readFileSync(resolve(repoRoot, 'web/src/design-system/components/components.css'), 'utf8');
  // .mono rule block (tokens.css).
  const monoBlock = tokensCss.match(/\.mono\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.ok(monoBlock.length > 0, '.mono rule must exist in tokens.css');
  assert.ok(/tabular-nums/.test(monoBlock), '.mono must keep tabular-nums');
  assert.ok(!/text-overflow|ellipsis|overflow\s*:\s*hidden/.test(monoBlock), '.mono must not clip money');
  // .table .num rule block (components.css).
  const numBlock = componentsCss.match(/\.table \.num\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(numBlock.length > 0, '.table .num rule must exist in components.css');
  assert.ok(!/text-overflow|ellipsis|overflow\s*:\s*hidden/.test(numBlock), '.table .num must not clip money');
});
