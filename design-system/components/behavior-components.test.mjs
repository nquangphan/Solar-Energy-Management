// QA source-guard for the hand-authored behavior/interaction React components
// (Story 1.6).
//
// The component CSS is covered by components.test.mjs (drift-guard on the
// stylesheet). This file guards the TSX/TS SOURCE instead — the behavior
// contracts and, most importantly, the two hard invariants the CSS can't see:
//   (a) CartLineRow does NO client-side money math — it displays the backend
//       `amount` prop via <Money> (AD-10/16). This is the single most important guard:
//       it catches any attempt to compute qty × unitPrice / sum a total.
//   (b) ImageUpload does NOT upload — no fetch/R2/signed URL; it only emits the
//       chosen File[] via onAdd (AD-3).
// Plus: Dialog/Sheet close semantics (Esc + onClose + return null + role),
// ConfirmDialog reusing Dialog, share.ts's navigator.share + download fallback,
// ErrorState reusing Banner, EmptyState not hard-coding screen copy, and barrel
// completeness (9 components + shareFiles, without regressing Story 1.3/1.4/1.5).
//
// There is no JSX build/typecheck in the repo (web has no bundler/tsc — see
// Story 1.5/1.6 Dev Notes), so these read each source file as text and assert
// the invariants statically. Runtime interaction tests (real Esc/click/share)
// are deferred until the web-app shell brings a test DOM.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertScanned } from '../lib/assert-scanned.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root
const COMPONENTS_DIR = resolve(repoRoot, 'web/src/design-system/components');

const read = (name) => readFileSync(resolve(COMPONENTS_DIR, name), 'utf8');

// Strip // line comments and /* */ block comments so negative scans inspect real
// code only — the components' own docstrings mention the forbidden things (money
// math, fetch/R2/upload) precisely to explain why they are absent, which must
// not trip a guard.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// Additionally strip string/template literals for the money-math scan: an
// aria-label or other Vietnamese string must never be mistaken for arithmetic
// (precedent: Story 1.4/1.5 false-positive lesson).
const stripCommentsAndStrings = (src) =>
  stripComments(src)
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');

const cartLineRow = read('CartLineRow.tsx');
const dialog = read('Dialog.tsx');
const confirmDialog = read('ConfirmDialog.tsx');
const sheet = read('Sheet.tsx');
const skeleton = read('Skeleton.tsx');
const emptyState = read('EmptyState.tsx');
const errorState = read('ErrorState.tsx');
const shareButton = read('ShareButton.tsx');
const imageUpload = read('ImageUpload.tsx');
const attachmentGallery = read('AttachmentGallery.tsx');
const attachmentGalleryDart = readFileSync(
  resolve(repoRoot, 'mobile/lib/design_system/components/attachment_gallery.dart'),
  'utf8',
);
const share = read('share.ts');
const barrel = read('index.ts');

// ---------------------------------------------------------------------------
// CartLineRow (AC-1) — NO client money math (AD-10/16). Most important guard.
// ---------------------------------------------------------------------------

// (1) The row must never multiply qty × unitPrice or otherwise compute a total:
// `amount` is a backend number, displayed via formatVnd (<Money>). Scan the
// comment/string-free source for any money arithmetic.
test('CartLineRow does NO client money math — amount is displayed from prop via <Money> (AD-10/16)', () => {
  const code = stripCommentsAndStrings(cartLineRow);
  // Any multiplication between two expressions is money math here regardless of
  // the variable names — a rename (`quantity * price`) must not slip through.
  // Drop import/export lines first so `import * as X` isn't read as a `*`.
  const codeNoImports = code.replace(/^\s*(?:import|export)\b.*$/gm, '');
  const anyMultiply = /[A-Za-z_$)\]]\s*\*\s*[A-Za-z_$(]/;
  assert.ok(
    !anyMultiply.test(codeNoImports),
    'CartLineRow must not multiply anything (qty × price / any total) — amount comes from the backend',
  );
  // Summing is backend/preview-total. Locale formatting is banned: money
  // formatting goes through formatVnd (<Money>) only.
  assert.ok(
    !/\breduce\s*\(|\.sum\b|toFixed|toLocaleString|\bIntl\b|NumberFormat/.test(codeNoImports),
    'CartLineRow must not sum money or format it itself — formatting goes through formatVnd (<Money>) only',
  );
  // It DOES display the backend amount straight from the prop, via <Money>.
  assert.ok(/<Money value=\{amount\} \/>/.test(cartLineRow), 'CartLineRow must display <Money value={amount} /> straight from the prop');
});

// (2) Edits emit immediately via callbacks; the row has a delete affordance.
test('CartLineRow emits qty/unitPrice/delete via callbacks (AC-1)', () => {
  for (const cb of ['onQtyChange', 'onUnitPriceChange', 'onDelete']) {
    assert.ok(cartLineRow.includes(cb), `CartLineRow must accept/emit ${cb}`);
  }
  // Renders a <tr> to sit inside <Table><tbody>.
  assert.ok(/<tr\b/.test(cartLineRow), 'CartLineRow must render a <tr>');
});

// ---------------------------------------------------------------------------
// Dialog / Sheet (AC-3) — controlled close semantics + overlap ≤ 1 level.
// ---------------------------------------------------------------------------

// (3) Dialog: Esc closes, onClose is the close path, `!open` returns null
// (self-hiding = overlap ≤ 1 level), role="dialog".
test('Dialog closes on Esc + backdrop, returns null when closed, role=dialog (AC-3, UX-DR-26)', () => {
  const code = stripComments(dialog);
  assert.ok(/'Escape'/.test(code), "Dialog must handle e.key === 'Escape'");
  // Close path: Esc invokes onClose (through the latest-ref) and the backdrop/
  // close button call onClose directly.
  assert.ok(/onClose(Ref\.current)?\(\)/.test(code), 'Dialog must invoke onClose on Esc');
  assert.ok(/onClick=\{onClose\}/.test(code), 'Dialog must wire onClose to the backdrop/close button');
  assert.ok(/!open\s*\)\s*return null|return null/.test(code), 'Dialog must return null when !open');
  assert.ok(/role="dialog"/.test(dialog), 'Dialog must set role="dialog"');
  assert.ok(/aria-modal="true"/.test(dialog), 'Dialog must set aria-modal="true"');
});

// (4) Sheet: same close semantics + the bottom-anchored scrim--sheet backdrop.
test('Sheet mirrors Dialog close semantics + uses scrim--sheet (AC-3)', () => {
  const code = stripComments(sheet);
  assert.ok(/'Escape'/.test(code), "Sheet must handle e.key === 'Escape'");
  assert.ok(/onClose(Ref\.current)?\(\)/.test(code), 'Sheet must invoke onClose on Esc');
  assert.ok(/onClick=\{onClose\}/.test(code), 'Sheet must wire onClose to the backdrop/close button');
  assert.ok(/return null/.test(code), 'Sheet must return null when !open');
  assert.ok(/scrim--sheet/.test(sheet), 'Sheet must render on the scrim--sheet backdrop');
  assert.ok(/role="dialog"/.test(sheet), 'Sheet must set role="dialog"');
});

// (5) ConfirmDialog reuses Dialog — it does not redraw a modal itself.
test('ConfirmDialog wraps Dialog, does not redraw a modal (AC-3)', () => {
  assert.ok(/import\s*\{[^}]*\bDialog\b[^}]*\}\s*from\s*'\.\/Dialog'/.test(confirmDialog), 'ConfirmDialog must import ./Dialog');
  assert.ok(/<Dialog\b/.test(confirmDialog), 'ConfirmDialog must render <Dialog>');
  const code = stripComments(confirmDialog);
  assert.ok(!/className="scrim"|className="modal"/.test(code), 'ConfirmDialog must not hand-draw .scrim/.modal — Dialog owns that');
});

// ---------------------------------------------------------------------------
// ImageUpload (AC-5) — NO upload (AD-3).
// ---------------------------------------------------------------------------

// (6) The picker only emits File[] via onAdd; it must not reach the network,
// R2, signed URLs, or an upload() call.
test('ImageUpload does NOT upload — no fetch/R2/signed/upload() (AD-3)', () => {
  const code = stripComments(imageUpload);
  assert.ok(!/fetch\s*\(/.test(code), 'ImageUpload must not fetch()');
  assert.ok(!/\bR2\b/.test(code), 'ImageUpload must not reference R2');
  assert.ok(!/signed/i.test(code), 'ImageUpload must not build a signed URL');
  assert.ok(!/\bupload\s*\(/.test(code), 'ImageUpload must not call upload()');
  // Any other network egress is also forbidden — a non-fetch primitive would
  // exfiltrate the picked file just as well (mirrors the shell network ban).
  assert.ok(
    !/XMLHttpRequest|\bsendBeacon\b|\bWebSocket\b|\baxios\b|\bimport\s*\(/.test(code),
    'ImageUpload must not use XHR/sendBeacon/WebSocket/axios/dynamic import — no network egress (AD-3)',
  );
  // It DOES pick files and emit them.
  assert.ok(/type="file"/.test(imageUpload), 'ImageUpload must use <input type="file">');
  assert.ok(/accept/.test(imageUpload), 'ImageUpload must forward an accept filter');
  assert.ok(/onAdd\b/.test(imageUpload), 'ImageUpload must emit chosen files via onAdd');
});

// ---------------------------------------------------------------------------
// AttachmentGallery (Story 5.6) — renders SERVER photos, still NO network.
// ---------------------------------------------------------------------------

// The read-side twin of ImageUpload: it shows photos that already live on the
// server, which makes "just fetch them here" the obvious wrong turn. The screen
// pulls bytes through the authenticated proxy port and hands them down; the
// component stays a pure renderer on BOTH platforms (AD-3).
test('AttachmentGallery does NOT touch the network on either platform (AD-3)', () => {
  const web = stripComments(attachmentGallery);
  assert.ok(!/fetch\s*\(/.test(web), 'AttachmentGallery.tsx must not fetch()');
  assert.ok(!/\bR2\b/.test(web), 'AttachmentGallery.tsx must not reference R2');
  assert.ok(!/\bhttp/i.test(web), 'AttachmentGallery.tsx must not name an http endpoint');
  assert.ok(!/signed/i.test(web), 'AttachmentGallery.tsx must not build a signed URL');
  assert.ok(
    !/XMLHttpRequest|\bsendBeacon\b|\bWebSocket\b|\baxios\b|\bimport\s*\(/.test(web),
    'AttachmentGallery.tsx must not use XHR/sendBeacon/WebSocket/axios/dynamic import',
  );

  // Dart comments use the same // and /* */ forms, so the same stripper applies.
  const mobile = stripComments(attachmentGalleryDart);
  assert.ok(!/\bhttp/i.test(mobile), 'attachment_gallery.dart must not name an http endpoint');
  assert.ok(!/\bR2\b/.test(mobile), 'attachment_gallery.dart must not reference R2');
  assert.ok(!/signed/i.test(mobile), 'attachment_gallery.dart must not build a signed URL');
  assert.ok(
    !/Image\.network|NetworkImage|HttpClient|\bDio\b/.test(mobile),
    'attachment_gallery.dart must not load images over the network — the screen injects bytes',
  );

  // It DOES render bytes the caller already holds, and reports delete intent.
  assert.ok(/previewSrc/.test(attachmentGallery), 'web gallery must render caller-supplied previewSrc');
  assert.ok(/Image\.memory/.test(attachmentGalleryDart), 'mobile gallery must render caller-supplied bytes');
  assert.ok(/onDelete/.test(attachmentGallery) && /onDelete/.test(attachmentGalleryDart), 'both galleries must emit delete intent via onDelete');
});

// The web half of the design system has no bundler and no DOM lane (TD-1), so a
// className that matches no rule is invisible: the component renders, every text
// guard passes, and the browser lays it out with UA defaults. That is exactly how
// the gallery first shipped — <figure> keeping its 1em/40px UA margin and three
// caption spans running together on one line. Mobile has no equivalent hole: an
// undefined Dart symbol simply will not compile.
test('every class the gallery names is actually defined in components.css', () => {
  const css = readFileSync(
    resolve(repoRoot, 'web/src/design-system/components/components.css'),
    'utf8',
  );
  // `.micro` and `.muted` are named by components across the whole web design
  // system and are defined by NO stylesheet in this repo — a pre-existing gap
  // that is not this component's to close. Skipping them keeps the guard honest
  // instead of green-by-exception.
  const preExistingUndefined = new Set(['micro', 'muted']);
  const used = new Set();
  for (const m of attachmentGallery.matchAll(/className="([^"]+)"/g)) {
    for (const cls of m[1].split(/\s+/)) {
      if (cls && !preExistingUndefined.has(cls)) used.add(cls);
    }
  }
  assert.ok(used.size > 0, 'gallery must carry class names at all');
  for (const cls of used) {
    assert.ok(
      new RegExp(`\\.${cls}[\\s,{:.]`).test(css),
      `.${cls} is used by AttachmentGallery.tsx but defined in no stylesheet`,
    );
  }
});

// ---------------------------------------------------------------------------
// share.ts (AC-4) — native share with a download fallback.
// ---------------------------------------------------------------------------

// (7) shareFiles prefers navigator.share and falls back to a download.
test('shareFiles uses navigator.share with a download fallback (AC-4, UX-DR-21)', () => {
  assert.ok(/navigator\.share/.test(share), 'share.ts must call navigator.share');
  assert.ok(/navigator\.canShare/.test(share), 'share.ts must guard with navigator.canShare');
  assert.ok(/createObjectURL/.test(share) && /download/.test(share), 'share.ts must have a download fallback (createObjectURL + a.download)');
  // No upload — it shares/downloads a File the caller already holds.
  assert.ok(!/fetch\s*\(/.test(stripComments(share)), 'share.ts must not fetch/upload');
});

// ---------------------------------------------------------------------------
// EmptyState / ErrorState (AC-2) — reuse Banner; screens own the copy.
// ---------------------------------------------------------------------------

// (8) ErrorState reuses the shipped Banner and offers a retry.
test('ErrorState reuses Banner + offers retry (AC-2)', () => {
  assert.ok(/import\s*\{[^}]*\bBanner\b[^}]*\}\s*from\s*'\.\/Banner'/.test(errorState), 'ErrorState must import ./Banner');
  assert.ok(/<Banner\b[^>]*tone="danger"/.test(errorState), 'ErrorState must render a danger Banner');
  assert.ok(/retryLabel|Thử lại/.test(errorState), 'ErrorState must expose a retry label');
  assert.ok(/onRetry\b/.test(errorState), 'ErrorState must accept onRetry');
});

// (9) EmptyState receives copy via props — no screen-specific Vietnamese strings
// baked in (so one component serves empty-list AND phone-search-empty).
test('EmptyState takes title/message/action via props, no hard-coded screen copy (AC-2, UX-DR-19)', () => {
  assert.ok(/title/.test(emptyState) && /message/.test(emptyState) && /action/.test(emptyState), 'EmptyState must accept title/message/action props');
  const code = stripComments(emptyState);
  assert.ok(!/Chưa có|SĐT|đơn nào/.test(code), 'EmptyState must not hard-code screen-specific copy — screens pass it in');
});

// ---------------------------------------------------------------------------
// Skeleton (AC-2) — token-based .skel bar.
// ---------------------------------------------------------------------------

// (10) Skeleton renders the .skel helper and is aria-hidden (decorative).
test('Skeleton renders the .skel bar, aria-hidden (AC-2)', () => {
  assert.ok(/'skel'/.test(skeleton), 'Skeleton must use the .skel class');
  assert.ok(/aria-hidden="true"/.test(skeleton), 'Skeleton must be aria-hidden (decorative)');
});

// ---------------------------------------------------------------------------
// ShareButton (AC-4) — thin trigger over shareFiles, no app grid.
// ---------------------------------------------------------------------------

// (11) ShareButton calls shareFiles and does not draw a share-app grid (that is
// mobile/Flutter, Story 1.7).
test('ShareButton triggers shareFiles, no app grid (AC-4)', () => {
  assert.ok(/shareFiles\s*\(/.test(shareButton), 'ShareButton must call shareFiles()');
  const code = stripComments(shareButton);
  assert.ok(!/share-grid|share-app/.test(code), 'ShareButton must not draw a native share-app grid (Story 1.7)');
});

// ---------------------------------------------------------------------------
// Barrel (index.ts) — full behavior layer + no regression of prior stories.
// ---------------------------------------------------------------------------

// (12) All 9 Story 1.6 components + shareFiles are exported, and the Story
// 1.3/1.4/1.5 exports still stand.
test('index.ts exports the behavior layer + keeps Story 1.3/1.4/1.5 (Story 1.6)', () => {
  const required = [
    'CartLineRow', 'CartLineRowProps',
    'Dialog', 'DialogProps',
    'ConfirmDialog', 'ConfirmDialogProps',
    'Sheet', 'SheetProps',
    'Skeleton', 'SkeletonProps',
    'EmptyState', 'EmptyStateProps',
    'ErrorState', 'ErrorStateProps',
    'ShareButton', 'ShareButtonProps',
    'ImageUpload', 'ImageUploadProps',
    'shareFiles',
  ];
  for (const name of required) {
    assert.ok(barrel.includes(name), `index.ts must export ${name}`);
  }
  // No regression: earlier layers stay exported.
  for (const name of ['Button', 'StatusChip', 'Table', 'Stepper', 'Kpi', 'Banner']) {
    assert.ok(barrel.includes(name), `index.ts must still export ${name} (no regression)`);
  }
});

// ===========================================================================
// QA gap-coverage (bmad-qa-generate-e2e-tests) — behavior contracts the ACs
// and the story's mandatory gotchas specify but the guards above did not yet
// cover. Same static source-guard technique; runtime DOM tests stay deferred.
// ===========================================================================

// (13) Overlay collects INTENT only — it never mutates Order.status or reaches
// the network. This is the AD-11 invariant, the overlay counterpart to the AD-3
// no-upload guard on ImageUpload, and was previously unguarded.
test('Dialog/ConfirmDialog collect intent only — no status mutation, no network (AD-11)', () => {
  for (const [name, src] of [['Dialog', dialog], ['ConfirmDialog', confirmDialog]]) {
    const code = stripComments(src);
    assert.ok(!/fetch\s*\(/.test(code), `${name} must not fetch() — feature screens call the backend`);
    assert.ok(!/applyTransition/.test(code), `${name} must not run applyTransition — status transitions are backend (AD-11)`);
    assert.ok(!/\baxios\b/.test(code), `${name} must not use axios — it only emits intent`);
    assert.ok(!/\.status\s*=/.test(code), `${name} must not assign a status — it only emits intent (AD-11)`);
  }
});

// (14) Backdrop click closes; clicking inside the modal/sheet does NOT (the
// stopPropagation gotcha). Guards the "click backdrop đóng, click trong .modal
// phải stopPropagation" contract for both overlays.
test('Dialog/Sheet close on backdrop click, stop propagation inside (AC-3 gotcha)', () => {
  assert.ok(/<div className="scrim"[^>]*onClick=\{onClose\}/.test(dialog), 'Dialog backdrop (.scrim) must close on click');
  assert.ok(/<div className="scrim scrim--sheet"[^>]*onClick=\{onClose\}/.test(sheet), 'Sheet backdrop (.scrim--sheet) must close on click');
  for (const [name, src] of [['Dialog', dialog], ['Sheet', sheet]]) {
    assert.ok(/stopPropagation\(\)/.test(src), `${name} must stopPropagation on inner click so inside clicks don't close`);
  }
});

// (15) A11y (UX-DR-26): the Esc keydown listener is cleaned up (no leak / no
// handler firing after close) and focus moves to the overlay when it opens.
test('Dialog/Sheet clean up the Esc listener and focus the overlay on open (UX-DR-26)', () => {
  for (const [name, src] of [['Dialog', dialog], ['Sheet', sheet]]) {
    assert.ok(/removeEventListener\(\s*'keydown'/.test(src), `${name} must remove its keydown listener on cleanup`);
    assert.ok(/\.focus\(\)/.test(src), `${name} must focus the overlay when it opens`);
    assert.ok(/tabIndex=\{-1\}/.test(src), `${name} must make the overlay focusable (tabIndex={-1})`);
  }
});

// (16) CartLineRow edits emit IMMEDIATELY via the onChange handlers (no save
// button, AC-1): the numeric .field inputs wire straight to the callbacks.
test('CartLineRow inputs emit immediately via onChange — no save step (AC-1)', () => {
  assert.ok(/onChange=\{[^}]*onQtyChange/.test(cartLineRow), 'qty input onChange must emit onQtyChange immediately');
  assert.ok(/onChange=\{[^}]*onUnitPriceChange/.test(cartLineRow), 'unitPrice input onChange must emit onUnitPriceChange immediately');
  assert.ok(/inputMode="numeric"/.test(cartLineRow), 'editable qty/unitPrice must be numeric .field inputs');
  const code = stripCommentsAndStrings(cartLineRow);
  assert.ok(!/onSave|handleSave|onSubmit/.test(code), 'CartLineRow must not introduce a save/submit step — edits are instant');
});

// (17) Web deletes via a button; swipe-to-delete is a mobile/Flutter concern
// (Story 1.7) and must not appear here.
test('CartLineRow deletes via a labeled button, no swipe (AC-1, Story 1.7 boundary)', () => {
  assert.ok(/<button[^>]*aria-label="Xoá dòng"[^>]*onClick=\{onDelete\}/.test(cartLineRow), 'delete must be a labeled <button> wired to onDelete');
  const code = stripComments(cartLineRow);
  assert.ok(!/onTouch\w+|swipe|Swipe|pan\w*Gesture/.test(code), 'CartLineRow must not implement swipe-to-delete (that is Flutter/Story 1.7)');
});

// (18) ImageUpload resets the file input value after each add (so re-picking the
// same file still fires onChange) and hides the add tile once max is reached.
test('ImageUpload resets input value after add and hides add tile at max (AC-5 gotcha)', () => {
  const code = stripComments(imageUpload);
  assert.ok(/\.value\s*=\s*''/.test(code), 'ImageUpload must reset input.value after add so the same file re-fires onChange');
  assert.ok(/images\.length\s*>=\s*max/.test(code), 'ImageUpload must compute the full state from max');
  assert.ok(/!full/.test(code), 'ImageUpload must hide the add tile when full (!full gate)');
});

// (19) share.ts swallows AbortError (the user dismissing the OS share sheet is
// not an error) so ShareButton callers never see a throw on cancel.
test('shareFiles swallows AbortError on user cancel (AC-4 gotcha)', () => {
  const code = stripComments(share);
  assert.ok(/AbortError/.test(code), 'share.ts must special-case AbortError (user cancelled the share sheet)');
  assert.ok(/catch\s*\(/.test(code), 'share.ts must catch the share rejection to handle AbortError');
});

// (20) Every non-submit button must set type="button". These primitives compose
// into feature forms (order/attachment/"Chốt đơn"); a native <button> with no
// type defaults to type="submit" and would submit the enclosing form on a
// Xoá/Đóng/Share/retry click. Assert no raw <button …> opening tag omits a type,
// and the composed <Button> intent triggers carry type="button".
test('non-submit buttons set type="button" so they never submit a parent form', () => {
  // Raw <button> elements: each opening tag (up to its closing `>`) must declare a type.
  const rawButtons = [];
  for (const [name, src] of [
    ['CartLineRow', cartLineRow],
    ['Dialog', dialog],
    ['Sheet', sheet],
    ['ImageUpload', imageUpload],
  ]) {
    for (const tag of src.match(/<button\b[^>]*>/g) ?? []) {
      assert.ok(/type=/.test(tag), `${name}: raw <button> must set a type (defaults to submit otherwise): ${tag}`);
      rawButtons.push(tag);
    }
  }
  // Anti-empty (E-7): measured 5 raw <button> tags across these four files; floor 3 goes red if the
  // tag regex stops matching (the loop above would then check nothing and stay green).
  assertScanned(rawButtons, 3, 'raw <button> tags in CartLineRow/Dialog/Sheet/ImageUpload');
  // Composed <Button> triggers that only emit intent must be type="button".
  for (const [name, src] of [
    ['ConfirmDialog', confirmDialog],
    ['ErrorState', errorState],
    ['ShareButton', shareButton],
  ]) {
    assert.ok(/type="button"/.test(src), `${name}: intent <Button> must set type="button"`);
  }
});
