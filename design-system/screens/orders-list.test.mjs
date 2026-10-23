// Source-guard + parity for the Đơn hàng list screen (Story 5.3 — AC-1, AC-2,
// AC-3, AC-9, AC-10).
//
// THIS FILE IS THE STORY'S REAL WEB TEST. The web app still has no tsc/bundler/
// JSDOM (TD-1), so OrdersListScreen.tsx gets NO typecheck and NO runtime test.
// What stands between a wrong `.tsx` and "done" is this guard and a human review
// — nothing else. It is written to be strict on purpose. (The mobile twin DOES
// have a real widget test: mobile/test/screens/orders/order_list_screen_test.dart.)
//
// Seven groups: (a) both platforms exist · (b) composed from the design-system ·
// (c) transport only through the injected port · (d) the nav gate (web) and the
// locked tab contract (mobile) · (e) byte-identical Vietnamese labels ·
// (f) Viền nét · (g) the NEGATIVE asserts: no scope toggle, no permission
// literal, no money math, a read-only chip.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readMobileScreen } from '../lib/read-mobile-screen.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_LIST = 'web/src/screens/orders/OrdersListScreen.tsx';
const MOBILE_LIST = 'mobile/lib/screens/orders/order_list_screen.dart';
const WEB_CSS = 'web/src/screens/orders/orders-list.css';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const web = read(WEB_LIST);
const mobile = readMobileScreen(repoRoot, MOBILE_LIST);
const css = read(WEB_CSS);

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

/** Both screens, comment-stripped — the surface every "must not appear" rule scans. */
const allCode = [
  ['web:list', stripTsx(web)],
  ['mobile:list', stripDart(mobile)],
];

// (a) BOTH PLATFORMS SHIP THE SCREEN (parity coverage, AC-9).
test('the order list screen exists on BOTH platforms (AC-9)', () => {
  for (const rel of [WEB_LIST, MOBILE_LIST, WEB_CSS]) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

// (b) COMPOSE FROM THE DESIGN-SYSTEM (AD-13). No new components, no bare elements.
test('web list composes from shipped design-system components (AD-13)', () => {
  for (const name of ['Table', 'EmptyState', 'ErrorState', 'Skeleton', 'StatusChip']) {
    assert.match(
      web,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `OrdersListScreen.tsx must import ${name} from design-system/components`,
    );
  }
  assert.match(web, /<Seg\b/, 'the list filter must use the shipped <Seg>');
  assert.match(web, /<Toolbar>/, 'the list must use the shipped <Toolbar>');
  assert.match(web, /<WebShell/, 'an office screen must render inside <WebShell>');

  // `<Skeleton>` takes NO `lines` prop (Skeleton.tsx) — stacking is how a
  // multi-row placeholder is built. A `lines={n}` here would be silently ignored,
  // exactly the class of error web has no typecheck to catch.
  assert.ok(!/\<Skeleton[^>]*\blines\b/.test(web), 'Skeleton has no `lines` prop — stack multiple <Skeleton>');
});

test('mobile list composes from shipped widgets', () => {
  for (const name of ['AppEmptyState', 'AppErrorState', 'AppSkeleton', 'AppStatusChip', 'AppButton']) {
    assert.ok(mobile.includes(name), `order_list_screen.dart must use ${name}`);
  }
  assert.ok(mobile.includes('AppMobileShell'), 'an office screen must render inside AppMobileShell');
  assert.ok(mobile.includes('AppBottomNav'), 'an office screen must render the bottom-nav');
  // AppMobileShell already wraps the body in a SingleChildScrollView, so the
  // rows sit in unbounded height: the inner list must NOT scroll or expand on
  // its own, or it throws instead of rendering. (`Expanded` inside a Row is
  // fine and common — the constraint is about the vertical axis.)
  const dart = stripDart(mobile);
  assert.match(dart, /shrinkWrap:\s*true/, 'the mobile row list must set shrinkWrap: true');
  assert.match(
    dart,
    /NeverScrollableScrollPhysics/,
    'the mobile row list must not scroll independently — the shell owns scrolling',
  );
});

// (c) TRANSPORT ONLY THROUGH THE INJECTED PORT (AD-1/AD-2).
test('the list talks to the network only through the injected OrdersPort (AD-1/AD-2)', () => {
  for (const [name, code] of allCode) {
    const banned = name.startsWith('web:')
      ? ['fetch(', 'axios', 'XMLHttpRequest']
      : ['package:http', 'package:dio', 'HttpClient'];
    for (const token of banned) {
      assert.ok(!code.includes(token), `${name} must not use ${token} — inject an OrdersPort`);
    }
    assert.match(code, /OrdersPort/, `${name} must take an OrdersPort`);
  }
});

// (c.2) THE RACE TICKET. Filter changes fire overlapping requests, and the answers
// do not necessarily return in order. Without the ticket an older reply repaints
// the table with rows the user already moved past — wrong, and silent.
test('both screens guard against out-of-order responses (stale-response ticket)', () => {
  assert.match(stripTsx(web), /latest\.current/, 'web list must carry the race ticket');
  assert.match(stripDart(mobile), /ticket != _latest/, 'mobile list must carry the race ticket');
  // Both the answer and the failure must check: one shared line would let either branch emit after close.
  assert.ok(
    (stripDart(mobile).match(/if \(isClosed \|\| ticket != _latest\) return;/g) ?? []).length >= 2,
    'mobile list must not emit after close, on the answer AND on the failure',
  );
});

// (c.3) PAGINATION runs through the BACKEND (AD-1) and resets on a filter change.
test('the list paginates through the backend, never in memory', () => {
  for (const [name, src] of [['web', web], ['mobile', mobile]]) {
    assert.ok(src.includes('Trang '), `${name} list must render the "Trang X/Y" page indicator`);
    assert.ok(src.includes('Trước') && src.includes('Sau'), `${name} list must render the Trước/Sau controls`);
  }
  assert.match(stripTsx(web), /port\.list\(\{[\s\S]*?\bpage\b[\s\S]*?\}\)/, 'web list must send `page` to port.list');
  assert.match(stripDart(mobile), /port\.list\([\s\S]*?page:\s*_page/, 'mobile list must send `page:` to port.list');
  assert.match(stripTsx(web), /setPage\(1\)/, 'web list must reset to page 1 on a filter change');
  assert.match(stripDart(mobile), /^\s*_page = 1;/m, 'mobile list must reset to page 1 on a filter change');
});

// (d) THE NAV GATE IS WEB-ONLY, and that asymmetry is a DECISION, not an oversight.
test('the Đơn hàng sidebar link is hidden when the account holds NEITHER view key (AC-10, web)', () => {
  // The gate is DATA ON THE LINK, applied by the one filter every screen already
  // runs. A per-screen wrapper would gate only the screens that remembered to
  // call it, leaving the item visible on every other screen — which is exactly
  // where an account without the permission is standing.
  const sidebar = read('web/src/design-system/shell/Sidebar.tsx');
  assert.match(
    sidebar,
    /key:\s*'orders',[\s\S]{0,200}?requiresAny:\s*\[PERM\.ordersViewAll,\s*PERM\.ordersViewOwn\]/,
    'the Đơn hàng link must declare requiresAny: [ordersViewAll, ordersViewOwn]',
  );

  const perms = read('web/src/design-system/gating/permissions.ts');
  // filterNav must HONOUR that gate — a declared `requiresAny` that nothing reads
  // is a hidden item that never hides.
  assert.match(
    perms,
    /link\.requiresAny\s*==\s*null\s*\|\|\s*link\.requiresAny\.some\(/,
    'filterNav must drop a link whose requiresAny matches none of the account keys',
  );
  // Every web screen builds its sidebar through filterNav — no screen may hand
  // SIDEBAR_NAV to <Sidebar> raw, which would bypass the gate entirely.
  for (const screen of [
    'web/src/screens/orders/OrdersListScreen.tsx',
    'web/src/screens/orders/CreateQuoteScreen.tsx',
    'web/src/screens/orders/DiscountApprovalScreen.tsx',
    'web/src/screens/customers/CustomerListScreen.tsx',
    'web/src/screens/customers/CustomerDetailScreen.tsx',
    'web/src/screens/customers/CustomerPickScreen.tsx',
    'web/src/screens/settings/CustomerSourceConfigScreen.tsx',
    'web/src/screens/account/ProfileScreen.tsx',
  ]) {
    const code = stripTsx(read(screen));
    assert.ok(
      !/sections=\{SIDEBAR_NAV\}/.test(code),
      `${screen} must filter SIDEBAR_NAV by perms, never pass it raw`,
    );
    assert.match(code, /filterNav\(SIDEBAR_NAV, perms\)/, `${screen} must gate its sidebar with filterNav`);
  }
  // `orderScope` must be able to SAY "neither key" — collapsing that into 'mine'
  // would claim every signed-in account may see some orders, and the nav item
  // could never be hidden at all.
  assert.match(perms, /'all' \| 'mine' \| 'none'/, "orderScope must return 'all' | 'mine' | 'none'");
  const usePerms = read('web/src/design-system/session/use-permissions.ts');
  assert.match(
    usePerms,
    /orderScope: 'all' \| 'mine' \| 'none'/,
    'UsePermissions.orderScope must widen with the helper — web has no tsc to catch the drift',
  );
});

test("mobile must NOT filter the locked 5-tab bottom nav (UX-DR-15)", () => {
  const nav = read('mobile/lib/design_system/shell/app_bottom_nav.dart');
  // The tab list is an INTERNAL constant with no constructor to pass tabs. A
  // screen "fixing" AC-10 on mobile by editing it would break a locked UX
  // contract; the correct behaviour there is the backend 403 → error state.
  assert.match(nav, /const List<_Tab> _tabs = \[/, 'the mobile tab list must stay an internal constant');
  assert.ok(
    !/orderScope|PermissionKey/.test(stripDart(nav)),
    'the bottom nav must not become permission-filtered (UX-DR-15)',
  );
});

test('both orderScope helpers stay in parity across web and mobile', () => {
  const appPerms = read('mobile/lib/design_system/gating/app_permissions.dart');
  for (const value of ["'all'", "'mine'", "'none'"]) {
    assert.ok(appPerms.includes(value), `mobile orderScope must return ${value} like web`);
  }
});

// (e) PARITY (UX-DR-27): byte-identical Vietnamese labels across web ↔ mobile. The
// frame and the navigation differ; the words the user reads do not.
test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27, AC-9)', () => {
  const labels = [
    // nav / topbar
    'ĐƠN HÀNG',
    'Đơn hàng',
    // filters + actions
    'Tất cả',
    'Follow-up',
    '+ Tạo đơn',
    'Xem',
    // the four screen states (AC-3)
    'Đang tải danh sách đơn…',
    'Không tải được danh sách đơn.',
    'Thử lại',
    'Chưa có đơn nào',
    'Bấm ➕Tạo để bắt đầu.',
    'Không có đơn phù hợp',
    'Thử đổi bộ lọc.',
    // pagination
    'Trước',
    'Sau',
  ];
  for (const label of labels) {
    assert.ok(web.includes(label), `the web order list is missing the label "${label}"`);
    assert.ok(mobile.includes(label), `the mobile order list is missing the label "${label}"`);
  }
});

// (e.2) THE TWO EMPTY STATES ARE TWO DIFFERENT TRUTHS. "Filtered to nothing" is not
// "you have never created an order" — collapsing them tells a user with an active
// filter that their book is empty (UX-DR-19).
test('the filtered-empty state is distinct from the empty-book state (AC-3)', () => {
  for (const [name, src] of [['web', web], ['mobile', mobile]]) {
    assert.ok(src.includes('Chưa có đơn nào'), `${name} must have the empty-book state`);
    assert.ok(src.includes('Không có đơn phù hợp'), `${name} must have a SEPARATE filtered-empty state`);
  }
});

// (f) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens (UX-DR-4).
test('no ad-hoc elevation effects, radius via tokens (Viền nét, UX-DR-4)', () => {
  for (const pattern of [/box-shadow/i, /gradient/i, /drop-shadow/i, /filter:/i]) {
    assert.ok(!pattern.test(css), `orders-list.css must contain 0 ${pattern.source}`);
  }
  assert.ok(!/\b9{3,4}px\b/.test(css), 'orders-list.css must not hardcode a pill radius (use var(--radius-full))');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `orders-list.css radius must come from a token: ${decl}`);
  }
  assert.ok(!/BoxShadow/.test(mobile), 'the mobile list must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(stripDart(mobile)), 'the mobile list must contain 0 elevation');
});

// (g.1) 🔴 NEGATIVE ASSERT — NO SCOPE TOGGLE. "Xem tất cả đơn" vs "chỉ đơn của
// mình" is a PERMISSION, not a filter (EXPERIENCE.md L82, FR-18). A toggle would
// promise the user a choice the backend will not honour, and a scope PARAMETER
// would be an IDOR hole.
test('neither screen offers a scope toggle or sends a scope parameter (FR-18, AD-4)', () => {
  const forbiddenCopy = ['Của tôi', 'Tất cả đơn', 'Đơn của tôi'];
  for (const [name, code] of allCode) {
    for (const phrase of forbiddenCopy) {
      assert.ok(!code.includes(phrase), `${name} must not offer a scope toggle labelled "${phrase}"`);
    }
    for (const param of ['scope:', 'mine:', 'ownerAccountId:', 'assigneeAccountId:']) {
      assert.ok(!code.includes(param), `${name} must not send "${param}" — scope is server-side (AD-4)`);
    }
  }
});

// (g.2) 🔴 NEGATIVE ASSERT — NO PERMISSION LITERAL IN A SCREEN (AD-17). The registry
// is the single source; a hand-typed 'orders.view_all' silently stops matching the
// day the registry changes.
test('no screen hardcodes a permission literal (AD-17)', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/;
  for (const [name, code] of allCode) {
    // Import specifiers are dropped first: a same-directory Dart import is quoted
    // `word.word` and is shaped exactly like a registry key, but it is a FILE PATH.
    const body = code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '');
    assert.ok(!registryLike.test(body), `${name} must not hardcode a permission literal`);
  }
});

// (g.3) 🔴 NEGATIVE ASSERT — NO MONEY ON THE LIST (AD-10/AD-16). A list total needs
// the version + pricing join; a wrong number on a row is a money regression. The
// client computes no money, ever.
test('the list renders no money and does no arithmetic on money (AD-10/AD-16)', () => {
  const forbiddenCopy = ['Tổng tiền', 'Thành tiền', 'Giá vốn', 'costPrice'];
  for (const [name, code] of allCode) {
    for (const phrase of forbiddenCopy) {
      assert.ok(!code.includes(phrase), `${name} must not render "${phrase}" — no money on the list`);
    }
  }
});

// (g.4) 🔴 NEGATIVE ASSERT — THE STATUS CHIP IS READ-ONLY (UX-DR-23). Changing a
// status goes through a transition, never a tap on the chip.
test('the status chip stays read-only — no tap handler (UX-DR-23)', () => {
  assert.ok(
    !/<StatusChip[^>]*onClick/.test(stripTsx(web)),
    'the web list must not attach onClick to StatusChip',
  );
  assert.ok(
    !/AppStatusChip\([^)]*onTap/.test(stripDart(mobile)),
    'the mobile list must not attach onTap to AppStatusChip',
  );
});

// Anti-empty (E-7): the "must not contain" checks above scan these sources; if a stripper/reader
// ever returned (near-)empty text they would all pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ...allCode], 600, 'orders-list');
});
