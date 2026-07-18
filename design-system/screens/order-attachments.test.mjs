// Source-guard + parity for the Ảnh tab of Chi tiết đơn (Story 5.6).
//
// THIS FILE IS THE STORY'S REAL WEB TEST for the screen layer. The web app still
// has no tsc/bundler/JSDOM (TD-1), so OrderDetailScreen.tsx gets NO typecheck and
// NO runtime test here. (The mobile twin DOES have real widget tests:
// mobile/test/screens/orders/order_detail_attachments_test.dart — that is the
// lane where behaviour is actually proven, and it already caught two defects a
// text-guard cannot see.)
//
// A text-guard reads these files AS STRINGS. It cannot see whether the screen
// renders; `backend/test/web-source-parses.spec.ts` is the lane that proves the
// .tsx even parses. Both are needed: 5.4 shipped a web screen that could not
// parse while all four text lanes stayed green.
//
// SCOPE: this file watches the SCREENS. "The gallery component never touches the
// network" (AC-16) is a COMPONENT rule and lives with its component twin in
// design-system/components/behavior-components.test.mjs — mixing the two layers
// is how a guard ends up asserting nothing about either.
//
// The load-bearing rules here:
//  · NEITHER screen may rebuild the `coTheXoa` rule (AD-2/AD-4). The backend
//    computes it per photo; a client-side copy is a second rule and it drifts.
//  · NEITHER screen may carry a permission literal (AD-17).
//  · The Vietnamese copy is byte-identical across platforms (UX-DR-27).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_SCREEN = 'web/src/screens/orders/OrderDetailScreen.tsx';
const MOBILE_SCREEN = 'mobile/lib/screens/orders/order_detail_screen.dart';
const WEB_PORT = 'web/src/design-system/session/orders-port.ts';
const MOBILE_PORT = 'mobile/lib/design_system/session/orders_port.dart';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const web = read(WEB_SCREEN);
const mobile = read(MOBILE_SCREEN);
const webCode = stripTsx(web);
const mobileCode = stripDart(mobile);

const allCode = [
  ['web:detail', webCode],
  ['mobile:detail', mobileCode],
];

// (a) BYTE-FOR-BYTE COPY PARITY (UX-DR-27). Every label of this surface, in both
// screens, spelled identically. Two platforms drifting one accent apart is the
// whole reason this table is pinned rather than eyeballed.
test('the Ảnh-tab copy is byte-identical across web and mobile (UX-DR-27)', () => {
  const NHAN = [
    'Ảnh',
    'Thêm ảnh bổ sung',
    'Chưa có ảnh nào.',
    'Không tải được ảnh của đơn.',
    'Thử lại',
    'Xoá ảnh',
    'Ảnh sẽ bị xoá vĩnh viễn và không khôi phục được.',
  ];
  for (const [name, src] of allCode) {
    for (const nhan of NHAN) {
      assert.ok(src.includes(nhan), `${name} is missing the label "${nhan}"`);
    }
  }
  // The step badge is built from a template, so it is matched as a shape rather
  // than a literal — but the prefix and the arrow must match on both sides.
  for (const [name, src] of allCode) {
    assert.ok(
      /Bước: \$\{|Bước: \$/.test(src),
      `${name} must build the step badge as "Bước: {từ} → {đến}"`,
    );
    assert.ok(src.includes('→'), `${name} must use the → arrow in the step badge`);
  }

  // "Bổ sung" is the gallery COMPONENT's fallback badge, not screen copy — it is
  // pinned where it actually lives, on both platforms.
  const galleries = [
    ['web:gallery', read('web/src/design-system/components/AttachmentGallery.tsx')],
    ['mobile:gallery', read('mobile/lib/design_system/components/attachment_gallery.dart')],
  ];
  for (const [name, src] of galleries) {
    assert.ok(src.includes("'Bổ sung'"), `${name} is missing the "Bổ sung" badge`);
  }
});

// (b) THE FOUR STATES OF THE TAB (UX-DR-19). Loading is a skeleton, not a
// spinner; error offers a retry; empty says one short Vietnamese sentence.
test('the Ảnh tab has all four states', () => {
  assert.ok(/Skeleton/.test(webCode), 'web must render a skeleton while photos load');
  assert.ok(/AppSkeleton/.test(mobileCode), 'mobile must render a skeleton while photos load');
  assert.ok(/ErrorState/.test(webCode), 'web must render the shipped error state');
  assert.ok(/AppErrorState/.test(mobileCode), 'mobile must render the shipped error state');
  for (const [name, src] of allCode) {
    assert.ok(src.includes('Chưa có ảnh nào.'), `${name} must render the empty copy`);
    assert.ok(/AttachmentGallery/.test(src), `${name} must render the shipped gallery`);
  }
});

// (c) NO PERMISSION LITERAL IN A SCREEN (AD-17). Keys live in the registry; the
// screens read backend-computed flags instead.
test('neither screen carries a permission literal (AD-17)', () => {
  for (const [name, src] of allCode) {
    // Dotted lowercase strings that are NOT permission keys are real: a Dart
    // import path ('discount_approval_screen.dart') matches the naive shape and
    // would fail this guard for nothing. File extensions are excluded by name
    // rather than by loosening the pattern — the ban itself stays exact.
    const hits = (src.match(/['"][a-z_]+\.[a-z_]+['"]/g) ?? []).filter(
      (hit) => !/\.(dart|tsx?|css|json|mjs|png|svg)['"]$/.test(hit),
    );
    assert.deepEqual(
      hits,
      [],
      `${name} must not contain a permission-shaped literal: ${hits.join(', ')}`,
    );
  }
});

// (d) THE DELETE RULE IS NOT REBUILT ON THE CLIENT (AD-2/AD-4).
//
// This is the load-bearing guard of the story. `coTheXoa` is computed in exactly
// ONE place — the backend — because the rule ("uploader OR order-edit
// permission") has no second enforcement layer on the client. A screen that
// re-derives it would look right and drift the first time the rule changes.
test('neither screen rebuilds the coTheXoa rule — it only renders the flag', () => {
  for (const [name, src] of allCode) {
    assert.ok(
      !src.includes('quotes.create_edit'),
      `${name} must not name the order-edit permission — the backend owns the delete rule`,
    );
    assert.ok(
      !/quotesCreateEdit/.test(src),
      `${name} must not reference quotesCreateEdit — the backend owns the delete rule`,
    );
    // Comparing an uploader against the current account IS the rule, rebuilt.
    assert.ok(
      !/nguoiTaiLen\s*===|nguoiTaiLen\s*==|uploadedBy\w*\s*===|uploadedBy\w*\s*==/.test(src),
      `${name} must not compare the uploader against the current account`,
    );
    // It DOES render the backend's answer.
    assert.ok(
      /coTheXoa/.test(src),
      `${name} must pass the backend-computed coTheXoa through to the gallery`,
    );
  }
});

// (e) DELETE GOES THROUGH A DIALOG THAT STATES THE CONSEQUENCE (UX-DR-20), and
// the two overlay flows stay separate — the picker opens its own sheet, so a
// delete dialog opened on top of it would stack overlays two deep.
test('delete is confirmed by the shipped ConfirmDialog, never straight off the tap', () => {
  assert.ok(/ConfirmDialog/.test(webCode), 'web must use the shipped ConfirmDialog');
  assert.ok(/AppConfirmDialog/.test(mobileCode), 'mobile must use the shipped AppConfirmDialog');
  for (const [name, src] of allCode) {
    assert.ok(
      src.includes('Ảnh sẽ bị xoá vĩnh viễn và không khôi phục được.'),
      `${name} must state the consequence inside the dialog`,
    );
  }
  // Long-press is reserved for system text selection — it must never be a
  // destructive affordance.
  assert.ok(!/onLongPress/.test(mobileCode), 'mobile must not hang delete off a long-press');
});

// (f) BOTH PORTS EXPOSE THE SAME FOUR METHODS (AD-12). The FE mirrors the
// backend contract; a method present on one platform only is a surface that
// silently does not exist for half the users.
test('both order ports expose the four Story 5.6 methods', () => {
  const ports = [
    ['web:port', read(WEB_PORT)],
    ['mobile:port', read(MOBILE_PORT)],
  ];
  for (const [name, src] of ports) {
    for (const method of ['listAnh', 'themAnh', 'xoaAnh', 'anhBytes']) {
      assert.ok(src.includes(method), `${name} must declare ${method}()`);
    }
    assert.ok(src.includes('AttachmentItem'), `${name} must declare the AttachmentItem type`);
    // The R2 object key never leaves the backend (AD-3).
    assert.ok(
      !/objectKey/.test(src),
      `${name} must not carry objectKey — the R2 key does not leave the backend`,
    );
  }
});
