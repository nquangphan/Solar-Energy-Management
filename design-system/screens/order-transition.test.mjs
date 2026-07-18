// Source-guard + parity for the Chuyển trạng thái screen (Story 5.5 — AC-1,
// AC-2, AC-10, AC-11).
//
// THIS FILE IS THE STORY'S REAL WEB TEST. The web app still has no tsc/bundler/
// JSDOM (TD-1), so OrderStatusChangeScreen.tsx gets NO typecheck and NO runtime
// test here. (The mobile twin DOES have real widget tests:
// mobile/test/screens/orders/order_status_change_screen_test.dart — that is the
// lane where behaviour is actually proven.)
//
// A text-guard reads these files AS STRINGS. It cannot see whether the screen
// renders; `backend/test/web-source-parses.spec.ts` is the lane that proves the
// .tsx even parses. Both are needed: 5.4 shipped a web screen that could not
// parse while all four text lanes stayed green.
//
// The load-bearing rules here:
//  · NEITHER screen may derive the step list itself (AD-2/AD-4) — the branches
//    need DIFFERENT permission keys, so a client-side any-of would be a third
//    copy of the rule and it would drift.
//  · NEITHER screen may touch the network or R2 (AD-3). The shipped ImageUpload
//    is guarded against that in behavior-components.test.mjs, but that guard
//    watches the COMPONENT, not this screen — so the ban is re-stated here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_SCREEN = 'web/src/screens/orders/OrderStatusChangeScreen.tsx';
const MOBILE_SCREEN = 'mobile/lib/screens/orders/order_status_change_screen.dart';
const WEB_CSS = 'web/src/screens/orders/order-status-change.css';
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
const css = read(WEB_CSS);

const webCode = stripTsx(web);
const mobileCode = stripDart(mobile);

/** Both screens, comment-stripped — the surface every "must not appear" rule scans. */
const allCode = [
  ['web:transition', webCode],
  ['mobile:transition', mobileCode],
];

// (a) BOTH PLATFORMS SHIP THE SCREEN (parity coverage).
test('the status-change screen exists on BOTH platforms', () => {
  for (const rel of [WEB_SCREEN, MOBILE_SCREEN, WEB_CSS]) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

// (b) COMPOSE FROM THE DESIGN-SYSTEM (AD-13). Above all: do NOT redraw the
// picker. Story 5.4's review caught exactly this shape of mistake with ScopeFlag.
test('web composes from shipped design-system components (AD-13)', () => {
  for (const name of ['Button', 'ErrorState', 'Frame', 'ImageUpload', 'Skeleton', 'StatusChip']) {
    assert.match(webCode, new RegExp(`<${name}[\\s/>]`), `web must render <${name}>`);
  }
});

test('mobile composes from shipped design-system widgets (AD-13)', () => {
  for (const name of ['AppButton', 'AppErrorState', 'AppFrame', 'AppImageUpload', 'AppSkeleton', 'AppStatusChip']) {
    assert.match(mobileCode, new RegExp(`${name}\\(`), `mobile must build ${name}(...)`);
  }
});

test('neither screen redraws the image picker it was given', () => {
  // A hand-rolled <input type="file"> / ImagePicker() in a SCREEN means the
  // shipped component was bypassed — the exact 5.4 finding, one story later.
  assert.ok(!/type=['"]file['"]/.test(webCode), 'web must use <ImageUpload>, not a raw file input');
  assert.ok(!/ImagePicker\(\)/.test(mobileCode), 'mobile must use AppImageUpload, not ImagePicker() directly');
});

// (c) LABELS ARE BYTE-IDENTICAL ACROSS PLATFORMS (UX-DR-27, AC-10).
const LABELS = [
  'Chuyển trạng thái',
  'Bước kế tiếp',
  'Ảnh bằng chứng (không bắt buộc)',
  'Xác nhận chuyển',
  'Huỷ',
  'Không có bước nào để chuyển.',
  'Không chuyển được trạng thái.',
  'Thử lại',
];

test('every label is present on BOTH platforms, byte-for-byte (UX-DR-27)', () => {
  for (const label of LABELS) {
    assert.ok(web.includes(label), `web must render "${label}"`);
    assert.ok(mobile.includes(label), `mobile must render "${label}"`);
  }
});

test('the loading caption matches on both platforms', () => {
  const caption = 'Đang tải bước kế tiếp…';
  assert.ok(web.includes(caption), 'web must show the loading caption');
  assert.ok(mobile.includes(caption), 'mobile must show the loading caption');
  // A real ellipsis character, not three dots — the same rule the other screens
  // follow, and the difference is invisible in review but not to a byte compare.
  assert.ok(!web.includes('bước kế tiếp...'), 'web must use the … character');
  assert.ok(!mobile.includes('bước kế tiếp...'), 'mobile must use the … character');
});

test('the picker labels are REUSED from the design-system, not restated', () => {
  // 'Thêm ảnh' / 'Xoá ảnh' / 'Chụp ảnh' / 'Chọn từ thư viện' live inside the
  // shipped components. A screen that spells them again owns a second copy that
  // will drift from the one users actually see.
  for (const [name, src] of allCode) {
    for (const label of ['Thêm ảnh', 'Xoá ảnh', 'Chụp ảnh', 'Chọn từ thư viện']) {
      assert.ok(!src.includes(label), `${name} must not restate "${label}" — the component owns it`);
    }
  }
});

// (d) NO BUSINESS LOGIC ON THE CLIENT (AD-2/AD-4/AD-17).
test('neither screen contains a permission literal (AD-17)', () => {
  // Permission keys live in permission-registry.ts and nowhere else. A screen
  // that spells 'construction.transition' is deciding a permission question the
  // backend already answered in `buocKeTiep`.
  //
  // Import paths are stripped first: `'discount_approval_screen.dart'` matches
  // the same shape as a permission key and would make this guard cry wolf on
  // every Dart screen — a guard that cries wolf gets its regex loosened, and a
  // loosened regex is how the real thing slips through.
  const dropImports = (s) => s.replace(/^\s*import .*$/gm, '');
  for (const [name, src] of allCode) {
    const hits = dropImports(src).match(/['"][a-z_]+\.[a-z_]+['"]/g) ?? [];
    assert.deepEqual(hits, [], `${name} must not contain a permission literal, found: ${hits.join(', ')}`);
  }
});

test('neither screen contains a status-key literal', () => {
  // Status keys are the backend's vocabulary. A screen comparing against
  // 'thicong' is branching on the lifecycle — a second copy of the table.
  for (const [name, src] of allCode) {
    for (const key of ['thicong', 'nghiemthu', 'danggiao', 'dagiao', 'dacoc', 'hoanthanh']) {
      assert.ok(!src.includes(`'${key}'`), `${name} must not hardcode the status key '${key}'`);
    }
  }
});

test('neither screen contains a transition-event literal', () => {
  // The events come from `buocKeTiep[].event` and go straight back to the port.
  // A screen that names one is choosing a destination, which belongs to the
  // backend's transition table (AD-11).
  for (const [name, src] of allCode) {
    for (const event of ['bat_dau_thi_cong', 'xong_thi_cong', 'bat_dau_giao', 'xong_giao', 'hoan_thanh', 'chot', 'du_coc']) {
      assert.ok(!src.includes(`'${event}'`), `${name} must not hardcode the event '${event}'`);
    }
  }
});

test('neither screen derives the step list from scope flags (AD-2)', () => {
  for (const [name, src] of allCode) {
    for (const flag of ['scopeThiCong', 'scopeVanChuyen', 'scopeThietBi']) {
      assert.ok(!src.includes(flag), `${name} must not read ${flag} — the backend already gated buocKeTiep`);
    }
  }
});

// (e) THE SCREEN NEVER TOUCHES THE NETWORK OR R2 (AD-3).
//
// behavior-components.test.mjs enforces this for the ImageUpload COMPONENT. It
// does not watch screens, so the ban is restated here for the one screen that
// handles image bytes.
test('neither screen touches the network, R2, or a signed URL (AD-3)', () => {
  for (const [name, src] of allCode) {
    for (const banned of ['fetch(', 'XMLHttpRequest', 'axios', 'R2', 'signedUrl', 'presigned', 'HttpClient', 'http.post', 'S3']) {
      assert.ok(!src.includes(banned), `${name} must not reference ${banned} — the port owns transport (AD-3)`);
    }
  }
});

test('neither screen builds an object key', () => {
  // `attachments/{orderId}/{id}.{ext}` is the backend's shape. A client that
  // spells it has an opinion about storage layout it can only get wrong.
  for (const [name, src] of allCode) {
    assert.ok(!src.includes('attachments/'), `${name} must not build an R2 object key`);
  }
});

// (f) THE BUTTON IS HIDDEN, NOT GREYED, WHEN THERE IS NO STEP (UX-DR-22, AC-11).
test('both detail screens gate the button on a NON-EMPTY buocKeTiep', () => {
  const webDetail = stripTsx(read('web/src/screens/orders/OrderDetailScreen.tsx'));
  const mobileDetail = stripDart(read('mobile/lib/screens/orders/order_detail_screen.dart'));
  assert.match(webDetail, /buocKeTiep\.length > 0/, 'web detail must render the button only when a step exists');
  assert.match(mobileDetail, /_buocKeTiep\.isNotEmpty/, 'mobile detail must render the button only when a step exists');
  // ABSENT, not disabled: a greyed control invites a click that can never work.
  assert.ok(!/disabled=\{[^}]*buocKeTiep/.test(webDetail), 'web must HIDE the button, not disable it');
});

test('both status-change screens render the empty answer, not an error', () => {
  // "No step available" is an ANSWER; a retry button on an answer just asks the
  // same question again (UX-DR-19).
  assert.match(webCode, /steps\.length === 0/, 'web must branch on an empty step list');
  assert.match(mobileCode, /_steps\.isEmpty/, 'mobile must branch on an empty step list');
});

// (g) PORT PARITY (AD-12) — both ports declare the same new surface.
test('both ports declare chuyenTrangThai and the 5.5 types (parity)', () => {
  const webPort = stripTsx(read(WEB_PORT));
  const dartPort = stripDart(read(MOBILE_PORT));

  assert.match(webPort, /chuyenTrangThai\(\s*orderId: string,\s*event: string,\s*anh: File\[\],\s*\): Promise<StatusChangeResult>/, 'web port must declare chuyenTrangThai');
  assert.match(dartPort, /Future<StatusChangeResult> chuyenTrangThai\(/, 'mobile port must declare chuyenTrangThai');

  for (const type of ['OrderNextStep', 'OrderLifecycle', 'StatusChangeResult']) {
    assert.ok(webPort.includes(`interface ${type}`), `web port must declare ${type}`);
    assert.ok(dartPort.includes(`class ${type}`), `mobile port must declare ${type}`);
  }
});

test('the OrderNextStep contract carries EXACTLY the backend fields (AD-12)', () => {
  const webPort = stripTsx(read(WEB_PORT));
  const dartPort = stripDart(read(MOBILE_PORT));
  const FIELDS = ['event', 'to', 'requires'];

  const webBody = webPort.match(/interface OrderNextStep \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const webFields = [...webBody.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
  assert.deepEqual(webFields.sort(), [...FIELDS].sort(), 'the web type must carry EXACTLY the backend fields');

  const dartBody = dartPort.match(/class OrderNextStep \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const dartFields = [...dartBody.matchAll(/^\s*final \w+\??\s+(\w+);/gm)].map((m) => m[1]);
  assert.deepEqual(dartFields.sort(), [...FIELDS].sort(), 'the mobile type must carry EXACTLY the backend fields');
});

// (h) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens (UX-DR-4).
test('no ad-hoc elevation effects, radius via tokens (Viền nét, UX-DR-4)', () => {
  for (const pattern of [/box-shadow/i, /gradient/i, /drop-shadow/i, /filter:/i]) {
    assert.ok(!pattern.test(css), `order-status-change.css must contain 0 ${pattern.source}`);
  }
  assert.ok(!/\b9{3,4}px\b/.test(css), 'order-status-change.css must not hardcode a pill radius (use var(--radius-full))');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `radius must come from a token: ${decl}`);
  }
  for (const decl of css.match(/color:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--/, `colour must come from a token: ${decl}`);
  }
});
