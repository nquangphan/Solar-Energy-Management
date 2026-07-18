// Source-guard + parity for the Chi tiết đơn screen (Story 5.4 — AC-1, AC-2,
// AC-3, AC-7, AC-12, AC-13).
//
// THIS FILE IS THE STORY'S REAL WEB TEST. The web app still has no tsc/bundler/
// JSDOM (TD-1), so OrderDetailScreen.tsx gets NO typecheck and NO runtime test.
// (The mobile twin DOES have real widget tests:
// mobile/test/screens/orders/order_detail_screen_test.dart.)
//
// The load-bearing rule here is AC-7: THE STEP SEQUENCE IS NOT DERIVED ON THE
// CLIENT. Both screens must render whatever `getLifecycle()` returned — a screen
// that recomputed steps from the scope flags would be a second copy of the
// transition table, and it would drift the first time Epic 6 changes the real
// one (AD-2/AD-11).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_DETAIL = 'web/src/screens/orders/OrderDetailScreen.tsx';
const MOBILE_DETAIL = 'mobile/lib/screens/orders/order_detail_screen.dart';
const WEB_CSS = 'web/src/screens/orders/order-detail.css';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const web = read(WEB_DETAIL);
const mobile = read(MOBILE_DETAIL);
const css = read(WEB_CSS);

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const webCode = stripTsx(web);
const mobileCode = stripDart(mobile);

/** Both screens, comment-stripped — the surface every "must not appear" rule scans. */
const allCode = [
  ['web:detail', webCode],
  ['mobile:detail', mobileCode],
];

// (a) BOTH PLATFORMS SHIP THE SCREEN (parity coverage).
test('the order detail screen exists on BOTH platforms', () => {
  for (const rel of [WEB_DETAIL, MOBILE_DETAIL, WEB_CSS]) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

// (b) COMPOSE FROM THE DESIGN-SYSTEM (AD-13). No new components, no bare elements.
test('web detail composes from shipped design-system components (AD-13)', () => {
  for (const name of ['EmptyState', 'ErrorState', 'Frame', 'ScopeFlag', 'Skeleton', 'StatusChip', 'Stepper', 'Table']) {
    assert.match(
      webCode,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `OrderDetailScreen.tsx must import ${name} from design-system/components`,
    );
  }
  assert.match(webCode, /<Stepper\b/, 'the lifecycle must render through the shipped <Stepper>');
  assert.match(webCode, /<Tabs\b/, 'the two panes must use the shipped <Tabs>');
  assert.match(webCode, /<WebShell/, 'an office screen must render inside <WebShell>');

  // `<Skeleton>` takes NO `lines` prop (Skeleton.tsx) — stacking is how a
  // multi-row placeholder is built. A `lines={n}` would be silently ignored,
  // exactly the class of error web has no typecheck to catch.
  assert.ok(!/<Skeleton[^>]*\blines\b/.test(webCode), 'Skeleton has no `lines` prop — stack multiple <Skeleton>');

  // The frame label floats ON the border; without `onBg` on a --bg surface it is
  // masked with white and the border shows through it.
  assert.match(webCode, /<Frame[^>]*onBg/, '<Frame> on the --bg surface must set onBg');
});

test('mobile detail composes from shipped widgets', () => {
  for (const name of ['AppEmptyState', 'AppErrorState', 'AppSkeleton', 'AppStatusChip', 'AppStepper', 'AppFrame', 'AppTabs', 'AppScopeFlag']) {
    assert.ok(mobile.includes(name), `order_detail_screen.dart must use ${name}`);
  }
  assert.ok(mobile.includes('AppMobileShell'), 'an office screen must render inside AppMobileShell');
  assert.ok(mobile.includes('AppBottomNav'), 'an office screen must render the bottom-nav');

  // AppMobileShell already wraps the body in a SingleChildScrollView, so the
  // rows sit in unbounded height: an inner list must NOT scroll or expand on its
  // own, or it throws instead of rendering. (`Expanded` inside a Row is fine and
  // common — the constraint is about the vertical axis.)
  assert.match(mobileCode, /shrinkWrap:\s*true/, 'lists inside the shell must set shrinkWrap: true');
  assert.match(
    mobileCode,
    /NeverScrollableScrollPhysics/,
    'lists inside the shell must not scroll independently — the shell owns vertical scrolling',
  );

  // …but the STEPPER must scroll on its OWN axis: AppStepper is a Row that does
  // not wrap (64px/node + 26px/bar ⇒ 604px for seven steps) and would overflow
  // every phone. Different axis, so nesting is legal.
  assert.match(
    mobileCode,
    /scrollDirection:\s*Axis\.horizontal/,
    'the stepper must be wrapped in a horizontal scroller or it overflows a phone width',
  );
});

// (b.2) AppTabs must be a DESIGN-SYSTEM widget, not drawn inside the screen.
test('mobile tabs ship in the design-system, not ad hoc in the screen (AD-13)', () => {
  // Comments are stripped FIRST: this file explains in prose why it does not
  // wrap Material's TabBar, and a guard that reads its own rationale as a
  // violation is a guard nobody can satisfy.
  const tabs = stripDart(read('mobile/lib/design_system/shell/app_tabs.dart'));
  assert.match(tabs, /class AppTabs\b/, 'AppTabs must live in the design-system shell');
  assert.match(tabs, /class AppTabItem\b/, 'AppTabs must mirror the web TabItem shape');
  // Material's TabBar brings ripple + elevation defaults that Viền nét forbids.
  assert.ok(!/TabBar|DefaultTabController/.test(tabs), 'AppTabs must not wrap Material TabBar');
  assert.match(
    read('mobile/lib/design_system/shell/shell.dart'),
    /export 'app_tabs\.dart';/,
    'AppTabs must be exported from the shell barrel',
  );
});

// (c) TRANSPORT ONLY THROUGH THE INJECTED PORT (AD-1/AD-2).
test('neither screen talks to the network directly (AD-1/AD-2)', () => {
  for (const [name, code] of allCode) {
    for (const forbidden of ['fetch(', 'axios', 'XMLHttpRequest', 'HttpClient', 'package:http']) {
      assert.ok(!code.includes(forbidden), `${name} must not use ${forbidden} — transport goes through the port`);
    }
  }
  assert.match(webCode, /port\.get\(/, 'the web detail must read the order through the port');
  assert.match(webCode, /port\.getLifecycle\(/, 'the web detail must read the lifecycle through the port');
  assert.match(webCode, /port\.listVersions\(/, 'the web detail must read the history through the port');
  for (const call of ['port.get(', 'port.getLifecycle(', 'port.listVersions(']) {
    assert.ok(mobileCode.includes(call), `the mobile detail must call ${call}`);
  }
});

// (c.2) THREE REQUESTS, ONE TICKET. Three separate tickets would let a slow reply
// for a previous order repaint one panel of the current one.
test('both screens guard against out-of-order replies with a single batch ticket', () => {
  assert.match(webCode, /Promise\.all\(/, 'the web detail must load its three requests as one batch');
  assert.match(webCode, /ticket !== latest\.current/, 'the web detail must drop stale replies');
  assert.ok(mobileCode.includes('Future.wait('), 'the mobile detail must load its three requests as one batch');
  assert.ok(
    mobileCode.includes('ticket != _latest'),
    'the mobile detail must drop stale replies',
  );
  assert.ok(mobileCode.includes('!mounted'), 'the mobile detail must not setState after dispose');
});

// (d) 🔴 THE LOAD-BEARING RULE (AC-7): NO TRANSITION LOGIC ON THE CLIENT.
test('neither screen derives the step sequence from scope flags (AC-7, AD-2/AD-11)', () => {
  // The screen may not consult a scope flag to decide WHICH STEPS EXIST — the
  // backend already dropped the inapplicable ones. Mentioning a flag at all in
  // step-building code is the shape this rule exists to catch.
  const flagNames = ['scopeThiCong', 'scopeVanChuyen', 'scopeThietBi'];
  for (const [name, code] of allCode) {
    // The status KEYS of the branch steps must not be typed into a screen: the
    // only place a screen names a status is the chip narrowing helper.
    for (const key of ['thicong', 'nghiemthu', 'danggiao', 'dagiao', 'dacoc', 'hoanthanh']) {
      assert.ok(
        !new RegExp(`['"]${key}['"]`).test(code),
        `${name} must not name the status "${key}" — the step list comes from the backend`,
      );
    }
  }
  // Flags may be DISPLAYED (the scope row) but never used to build steps: no
  // conditional list-building around them.
  for (const [name, code] of allCode) {
    for (const flag of flagNames) {
      assert.ok(
        !new RegExp(`${flag}\\s*(?:\\?|&&)[^\\n]*(?:steps|buoc|Step)`, 'i').test(code),
        `${name} must not build steps conditionally on ${flag}`,
      );
    }
  }
});

// (d.2) `gate` (dashed) has NO valid case on this screen: a step blocked by a
// scope flag is ABSENT, not dimmed (UX-DR-11). Rendering it dashed would claim
// the step exists for this order and is merely locked.
test('no step renders in the `gate` state (UX-DR-11)', () => {
  assert.ok(!/'gate'/.test(webCode), "the web detail must not use the 'gate' step state");
  assert.ok(!/AppStepState\.gate/.test(mobileCode), 'the mobile detail must not use AppStepState.gate');
});

// (e) PARITY (UX-DR-27): byte-identical Vietnamese labels across web ↔ mobile.
// The mockup shortens the mobile labels ("Lịch sử", "Vòng đời"); the platforms
// differ in frame and navigation, NOT in the words the user reads.
test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27, AC-12)', () => {
  const labels = [
    // topbar
    'ĐƠN HÀNG',
    'Chi tiết đơn',
    // frame + tab labels — the FULL forms on both platforms
    'Vòng đời đơn',
    'Thông tin',
    'Lịch sử update',
    // facts
    'Mã đơn',
    'SĐT khách',
    'Trạng thái',
    'Công suất',
    'Người phụ trách',
    // the scope row — all three flags render on BOTH platforms, the off ones
    // struck through. A platform that only draws the flags that are ON cannot
    // say "Thi công is off"; it just looks like it forgot one.
    'Phạm vi',
    'Thiết bị',
    'Thi công',
    'Vận chuyển',
    // the four screen states (AC-13)
    'Đang tải chi tiết đơn…',
    'Không tải được chi tiết đơn.',
    'Không tìm thấy đơn này.',
    'Thử lại',
    'Chưa có bản update nào',
    'Đơn vẫn ở bản gốc.',
    // history rows
    'Bản hiệu lực',
    'Bản gốc',
  ];
  for (const label of labels) {
    assert.ok(web.includes(label), `the web order detail is missing the label "${label}"`);
    assert.ok(mobile.includes(label), `the mobile order detail is missing the label "${label}"`);
  }
});

// (e.2) 404 IS NOT A NETWORK ERROR (AC-13). "This order does not exist, or is not
// yours" is an ANSWER — retrying asks the same question again. The two states must
// be distinct, and told apart by the envelope CODE, never by matching prose.
test('the not-found state is distinct from the load-error state (AC-13, UX-DR-19)', () => {
  for (const [name, src] of [['web', web], ['mobile', mobile]]) {
    assert.ok(src.includes('Không tải được chi tiết đơn.'), `${name} must have a load-error state`);
    assert.ok(src.includes('Không tìm thấy đơn này.'), `${name} must have a SEPARATE not-found state`);
  }
  assert.match(webCode, /code === 'NOT_FOUND'/, 'the web detail must branch on the envelope code');
  assert.ok(
    mobileCode.includes("code == 'NOT_FOUND'"),
    'the mobile detail must branch on the envelope code',
  );
});

// (e.3) EXACTLY TWO TABS. Thanh toán + Hợp đồng/Hoá đơn are Epic 7 and Ảnh is
// Story 5.6 — an empty tab promises the user something nobody built.
test('exactly the two owned tabs render — no placeholder tabs for future stories', () => {
  // Stripped code, not raw text: both screens explain in a comment WHICH tabs
  // they deliberately do not render, and that explanation is worth keeping.
  for (const [name, src] of allCode) {
    for (const notYet of ['Thanh toán', 'Ảnh đính kèm', 'Hợp đồng', 'Hoá đơn', 'HĐ & HĐơn']) {
      assert.ok(!src.includes(notYet), `${name} must not render a "${notYet}" tab — that story owns it`);
    }
  }
});

// (e.4) NO BUTTON OWNED BY A STORY THAT HAS NOT SHIPPED. "Huỷ đơn" (5.7) and
// "Share báo giá" still lead to screens that do not exist.
//
// "Chuyển trạng thái" LEFT this list in Story 5.5: that story shipped the screen
// the button opens, so it now owns the button too. The rule did not weaken — it
// still says "no button to nowhere"; one destination stopped being nowhere.
test('the detail screen renders no button owned by a future story', () => {
  for (const [name, src] of allCode) {
    for (const label of ['Huỷ đơn', 'Share báo giá']) {
      assert.ok(!src.includes(label), `${name} must not render "${label}" — a later story owns that button`);
    }
  }
});

// (f) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens (UX-DR-4).
test('no ad-hoc elevation effects, radius via tokens (Viền nét, UX-DR-4)', () => {
  for (const pattern of [/box-shadow/i, /gradient/i, /drop-shadow/i, /filter:/i]) {
    assert.ok(!pattern.test(css), `order-detail.css must contain 0 ${pattern.source}`);
  }
  assert.ok(!/\b9{3,4}px\b/.test(css), 'order-detail.css must not hardcode a pill radius (use var(--radius-full))');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `order-detail.css radius must come from a token: ${decl}`);
  }
  assert.ok(!/BoxShadow/.test(mobile), 'the mobile detail must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(mobileCode), 'the mobile detail must contain 0 elevation');
});

// (g.1) 🔴 NEGATIVE ASSERT — NO PERMISSION LITERAL IN A SCREEN (AD-17).
test('no screen hardcodes a permission literal (AD-17)', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/;
  for (const [name, code] of allCode) {
    // Import specifiers are dropped first: a same-directory Dart import is quoted
    // `word.word` and is shaped exactly like a registry key, but it is a FILE PATH.
    const body = code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '');
    assert.ok(!registryLike.test(body), `${name} must not hardcode a permission literal`);
  }
});

// (g.2) 🔴 NEGATIVE ASSERT — NO MONEY ARITHMETIC (AD-10/AD-16). This screen SHOWS
// money (line amounts), so the rule is sharper than on the list: every number is
// one the backend computed, and the screen may not add any of them up.
test('the detail screen does no money arithmetic (AD-10/AD-16)', () => {
  for (const [name, code] of allCode) {
    for (const pattern of [
      /\.reduce\(/,
      /amount\s*[+*]/,
      /[+*]\s*(?:line|dong)\.amount/i,
      /unitPrice\s*\*/,
      /\bsum\b\s*[+=]/i,
    ]) {
      assert.ok(!pattern.test(code), `${name} must not compute money (${pattern.source}) — the backend owns totals`);
    }
    // A "Tổng đơn" on this screen would have to be computed here: the order
    // response deliberately carries no total (it comes from preview-total).
    assert.ok(!code.includes('Tổng đơn'), `${name} must not render an order total — that is preview-total (AD-16)`);
    assert.ok(!code.includes('costPrice'), `${name} must not touch cost data (costs.view fence)`);
  }
});

// (g.3) 🔴 NEGATIVE ASSERT — THE STATUS CHIP IS READ-ONLY (UX-DR-23). Changing a
// status goes through a transition screen (5.5), never a tap on the chip.
test('the status chip stays read-only — no tap handler (UX-DR-23)', () => {
  assert.ok(!/<StatusChip[^>]*onClick/.test(webCode), 'the web detail must not attach onClick to StatusChip');
  assert.ok(!/<StatusChip[^>]*role=/.test(webCode), 'the web detail must not give StatusChip a role');
  assert.ok(!/<StatusChip[^>]*tabIndex/.test(webCode), 'the web detail must not make StatusChip focusable');
  assert.ok(
    !/AppStatusChip\([^)]*onTap/.test(mobileCode),
    'the mobile detail must not attach onTap to AppStatusChip',
  );
});

// (g.4) 🔴 NEGATIVE ASSERT — THE BACK BUTTON IS ICON-ONLY (UX-DR-26). It needs an
// accessible name; the shipped Topbar/AppTopbar already carry one, so the screen
// must use them rather than hand-rolling a second back control.
test('back navigation goes through the shipped topbar, which names it for a screen reader', () => {
  assert.match(webCode, /<Topbar[^>]*onBack/s, 'the web detail must pass onBack to the shipped Topbar');
  assert.ok(mobileCode.includes('onBack:'), 'the mobile detail must pass onBack to the shipped AppTopbar');
  assert.ok(
    !/aria-label="Quay lại"/.test(webCode),
    'the web detail must not hand-roll a second back button — Topbar already labels one',
  );
});

// (h) 🔴 THE AC-9 CONTRACT IS THE SAME ON ALL THREE SIDES (AD-12).
//
// Backend DTO → OpenAPI → both client ports. Nothing checks that chain today:
// orders.test.mjs only asserts the port FILES exist, openapi-drift.spec.ts only
// compares the backend against its own regen, and neither client has a typecheck
// that would notice a missing field (web has no tsc at all, TD-1).
//
// So a version field added on one side and forgotten on the other renders as a
// silent blank in the history tab — a lie in the audit trail, not a crash. Pin
// the field list from AC-9 in the one place all three files can be read.
const VERSION_ITEM_FIELDS = [
  'id',
  'versionNo',
  'laBanHienLuc',
  'createdAt',
  'chotAt',
  'createdByAccountId',
  'createdByDisplayName',
  'soDong',
  'thayDoi',
];

const BACKEND_DTO = 'backend/src/orders/dto/order-version-item.dto.ts';
const WEB_PORT = 'web/src/design-system/session/orders-port.ts';
const MOBILE_PORT = 'mobile/lib/design_system/session/orders_port.dart';

/** The declaration body of a type, by name — comment-stripped so prose cannot fake a PASS. */
function typeBody(code, opener) {
  const start = code.indexOf(opener);
  assert.notEqual(start, -1, `expected to find ${opener}`);
  // ⚠️ `\{[^}]*\}` stops at the first `}` INSIDE a nested generic/record type
  // (`{ ten: string }[]`), truncating the body and passing on fields it never read.
  const rest = code.slice(start);
  const end = rest.indexOf('\n}');
  assert.notEqual(end, -1, `expected a closing brace for ${opener}`);
  return rest.slice(0, end);
}

test('the version-history contract carries the same fields on backend, web and mobile (AC-9, AD-12)', () => {
  const dto = typeBody(stripTsx(read(BACKEND_DTO)), 'export class OrderVersionItemDto {');
  const webType = typeBody(stripTsx(read(WEB_PORT)), 'export interface OrderVersionItem {');
  const dartType = typeBody(stripDart(read(MOBILE_PORT)), 'class OrderVersionItem {');

  for (const field of VERSION_ITEM_FIELDS) {
    assert.match(dto, new RegExp(`\\b${field}!`), `${BACKEND_DTO} must declare ${field}`);
    assert.match(webType, new RegExp(`\\b${field}:`), `${WEB_PORT} must mirror ${field}`);
    assert.match(dartType, new RegExp(`\\b${field}\\b`), `${MOBILE_PORT} must mirror ${field}`);
  }

  // No side may carry a field the other two do not — an invented client field is
  // a field nothing ever fills.
  const webFields = [...webType.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
  const dartFields = [...dartType.matchAll(/^\s{2}final [\w<>?]+ (\w+);/gm)].map((m) => m[1]);
  assert.deepEqual(webFields.sort(), [...VERSION_ITEM_FIELDS].sort(), 'the web type must carry EXACTLY the AC-9 fields');
  assert.deepEqual(dartFields.sort(), [...VERSION_ITEM_FIELDS].sort(), 'the mobile type must carry EXACTLY the AC-9 fields');
});

// (h.2) Both ports must OFFER both reads. A screen can only be built on a method
// that exists; a port half-mirrored means the mobile twin quietly ships without
// the history tab and no test on either side notices.
test('both ports declare getLifecycle and listVersions (parity)', () => {
  const webPort = stripTsx(read(WEB_PORT));
  const dartPort = stripDart(read(MOBILE_PORT));
  // Story 5.5 widened `getLifecycle`'s return from a bare step list to
  // `OrderLifecycle { buoc, buocKeTiep }` on BOTH platforms — one read answers
  // both "what does the stepper draw" and "what can this caller do next".
  assert.match(webPort, /getLifecycle\(orderId: string\): Promise<OrderLifecycle>/, 'web port must declare getLifecycle');
  assert.match(webPort, /listVersions\(orderId: string\): Promise<OrderVersionItem\[\]>/, 'web port must declare listVersions');
  assert.match(dartPort, /Future<OrderLifecycle> getLifecycle\(/, 'mobile port must declare getLifecycle');
  assert.match(dartPort, /Future<List<OrderVersionItem>> listVersions\(/, 'mobile port must declare listVersions');
});
