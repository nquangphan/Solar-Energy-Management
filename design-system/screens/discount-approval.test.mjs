// Source-guard + parity for the Duyệt chiết khấu screen (Story 4.7 — AC #6/#7).
//
// THIS FILE IS THE WEB HALF'S REAL TEST (khuôn orders.test.mjs). The web app
// still has no tsc/bundler/JSDOM (TD-1, decision C-4: accepted through Epic 4),
// so DiscountApprovalScreen.tsx gets NO typecheck and NO runtime test — what
// stands between a wrong `.tsx` and "done" is this guard and a human review.
// The mobile half additionally has native widget tests
// (discount_approval_screen_test.dart).
//
// Groups: (a) both platforms exist · (b) composed from the design-system ·
// (c) transport only through the injected OrdersPort · (d) shell hosting ·
// (e) byte-identical Vietnamese labels · (f) Viền nét · (g) no permission
// literal · (h) no client money/margin math · (k) a failure never wipes state ·
// (o) the chip is the canonical choduyet key · (p) reject-without-reason is
// blocked client-side.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_SCREEN = 'web/src/screens/orders/DiscountApprovalScreen.tsx';
const MOBILE_SCREEN = 'mobile/lib/screens/orders/discount_approval_screen.dart';
const WEB_CSS = resolve(repoRoot, 'web/src/screens/orders/discount-approval.css');

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const web = read(WEB_SCREEN);
const mobile = read(MOBILE_SCREEN);
const css = readFileSync(WEB_CSS, 'utf8');

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const allCode = [
  ['web:discount-approval', stripTsx(web)],
  ['mobile:discount-approval', stripDart(mobile)],
];

// (a) BOTH PLATFORMS SHIP THE SCREEN (UX-DR-27).
test('the discount-approval screen exists on BOTH platforms', () => {
  for (const rel of [WEB_SCREEN, MOBILE_SCREEN]) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

// (b) COMPOSE FROM THE DESIGN-SYSTEM (AD-13). No bare form controls.
test('web discount-approval screen composes from shipped design-system components', () => {
  for (const name of ['Banner', 'Button', 'ConfirmDialog', 'EmptyState', 'ErrorState', 'Field', 'Frame', 'Skeleton', 'StatusChip', 'Table']) {
    assert.match(
      web,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `DiscountApprovalScreen.tsx must import ${name} from design-system/components`,
    );
  }
  const code = stripTsx(web);
  assert.ok(!/<input\b/.test(code), 'web must not render a bare <input> — use <Field>');
  assert.ok(!/<button\b/.test(code), 'web must not render a bare <button> — use <Button>');
  assert.ok(!/<select\b/.test(code), 'web must not render a bare <select>');
});

test('mobile discount-approval screen composes from shipped design-system widgets', () => {
  assert.match(mobile, /import '\.\.\/\.\.\/design_system\/components\/components\.dart'/, 'must import the components barrel');
  for (const name of ['AppBanner', 'AppButton', 'AppConfirmDialog', 'AppEmptyState', 'AppErrorState', 'AppField', 'AppFrame', 'AppSkeleton', 'AppStatusChip', 'AppTable']) {
    assert.ok(mobile.includes(name), `discount_approval_screen.dart must use ${name}`);
  }
});

// (c) TRANSPORT ONLY THROUGH THE INJECTED PORT (AD-1/AD-2) — and the screen
// actually reaches the two 4.7 methods this screen owns (listPendingDiscounts
// to fill the list, resolveDiscount to decide).
test('transport is the injected OrdersPort — list + resolve are reachable', () => {
  for (const [name, code] of allCode) {
    const banned = name.startsWith('mobile:')
      ? ['package:http', 'package:dio', 'HttpClient']
      : ['fetch(', 'axios', 'XMLHttpRequest'];
    for (const token of banned) {
      assert.ok(!code.includes(token), `${name} must not use ${token} — inject a port`);
    }
    assert.match(code, /OrdersPort/, `${name} must take an OrdersPort`);
    for (const call of ['listPendingDiscounts', 'resolveDiscount']) {
      assert.match(code, new RegExp(`ordersPort[\\s\\S]{0,60}?\\.${call}\\(`), `${name} must call ordersPort.${call}()`);
    }
  }
});

// (d) SHELL HOSTING — web in the WebShell on the orders nav item; mobile in the
// phone frame on the Đơn hàng tab (index 1 of the locked nav).
test('web discount-approval screen renders INSIDE the shell with a permission-filtered Sidebar', () => {
  assert.match(web, /<WebShell/, 'must render inside <WebShell>');
  assert.match(web, /<Sidebar\s+sections=\{filterNav\(SIDEBAR_NAV, perms\)\}/, 'must render a <Sidebar> filtered by the session perms');
  assert.match(web, /activeKey="orders"/, 'must mark the orders nav item active');
  assert.match(web, /usePermissions\(\)/, 'must read the session via usePermissions()');
});

test('mobile discount-approval screen renders INSIDE the shell on the Đơn hàng tab', () => {
  assert.ok(mobile.includes('AppPhoneFrame'), 'must render inside AppPhoneFrame');
  assert.ok(mobile.includes('AppMobileShell'), 'must render inside AppMobileShell');
  assert.match(mobile, /AppBottomNav\(activeIndex: kOrdersTabIndex\)/, 'must mark the Đơn hàng tab active');
  assert.match(mobile, /const int kOrdersTabIndex = 1;/, 'the Đơn hàng tab is index 1 (locked nav, UX-DR-15)');
});

// (e) PARITY (UX-DR-27): byte-identical Vietnamese labels across web ↔ mobile.
test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27)', () => {
  const labels = [
    'ĐƠN HÀNG',
    'Duyệt chiết khấu',
    'Chờ duyệt chiết khấu',
    // the detail panel — three BACKEND numbers + the per-line margin column
    'Giá gốc',
    'Chiết khấu',
    'Sau chiết khấu',
    'Biên ước tính',
    'Ước tính theo giá vốn hiện tại — chưa xuất kho.',
    'Lý do đề xuất',
    // the decision area
    'Lý do duyệt / từ chối (bắt buộc khi từ chối)',
    'Đồng ý chiết khấu',
    'Từ chối',
    'Lý do là bắt buộc khi từ chối chiết khấu.',
    // the FULL consequence sentences of the two confirm dialogs (UX-DR-20)
    'Đồng ý chiết khấu cho phép chốt đơn với giá đã giảm; thao tác được ghi Audit log.',
    'Từ chối sẽ trả đơn về Báo giá; lý do từ chối được ghi Audit log.',
    // list states
    'Không có chiết khấu nào đang chờ duyệt.',
    'Không tải được danh sách chờ duyệt.',
    // margin null fallback
    '—',
  ];
  for (const label of labels) {
    assert.ok(web.includes(label), `web discount-approval screen is missing the label "${label}"`);
    assert.ok(mobile.includes(label), `mobile discount-approval screen is missing the label "${label}"`);
  }
});

// (f) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens (UX-DR-4).
test('no ad-hoc shadow/gradient/elevation, radius via tokens (Viền nét, UX-DR-4)', () => {
  assert.ok(!/box-shadow/i.test(css), 'discount-approval.css must contain 0 box-shadow');
  assert.ok(!/gradient/i.test(css), 'discount-approval.css must contain 0 gradient');
  assert.ok(!/drop-shadow/i.test(css), 'discount-approval.css must contain 0 drop-shadow');
  assert.ok(!/filter:/i.test(css), 'discount-approval.css must contain 0 filter:');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `discount-approval.css radius must come from a token: ${decl}`);
  }
  assert.ok(!/BoxShadow/.test(mobile), 'mobile discount-approval screen must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(mobile), 'mobile discount-approval screen must contain 0 elevation');
});

// (g) NO PERMISSION LITERAL IN A SCREEN (AD-17). `discounts.approve` (and the
// costs.view fence) is enforced by the BACKEND guard; the screen carries no
// permission strings at all.
test('no discount-approval screen hardcodes a permission literal (AD-17)', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/;
  for (const [name, code] of allCode) {
    const body = code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '');
    assert.ok(!registryLike.test(body), `${name} must not hardcode a permission literal`);
  }
});

// (h) 🔴 NEGATIVE ASSERT — NO CLIENT MONEY/MARGIN MATH (AD-10/16, FR-37).
// subtotal/afterDiscount/estimatedMarginPct are BACKEND numbers the port
// carries in. A `* 100` or a `/ unitPrice` in this screen would be the client
// re-deriving the margin — which also re-derives the costPrice the costs.view
// fence exists to hide.
test('no screen computes money or margin — every number is the port response rendered as-is', () => {
  const moneyMath =
    /(?:unitPrice|amount|price|qty|subtotal|margin)\s*[*+\-/]\s*[\w.$_]*(?:qty|unitPrice|amount|price|subtotal|margin|100)/i;
  for (const [name, code] of allCode) {
    assert.ok(!moneyMath.test(code), `${name} must not compute money/margin — render the port's numbers as-is (AD-16)`);
    assert.ok(!/\breduce\(/.test(code), `${name} must not sum lines — subtotal/afterDiscount come from the port`);
    assert.ok(!/\*\s*100\b/.test(code), `${name} must not contain the percent multiplier — the margin is backend-rounded (FR-37)`);
    assert.ok(!/\/\s*unitPrice/.test(code), `${name} must not divide by unitPrice — the margin is a port number`);
    assert.ok(!/costPrice/.test(code), `${name} must never see a costPrice — the fence is server-side (FR-37)`);
  }
  assert.ok(!/Math\.floor\(/.test(stripTsx(web)), 'web must not round money — the backend already did');
  assert.ok(!/~\/\s*100/.test(stripDart(mobile)), 'mobile must not integer-divide money — the backend already did');
  // The "—" fallback for a null margin must stay present on both platforms.
  assert.ok(web.includes('—'), 'web must keep the "—" fallback for a null margin');
  assert.ok(mobile.includes('—'), 'mobile must keep the "—" fallback for a null margin');
});

// (k) A FAILURE NEVER WIPES STATE (bất biến k). The resolve error path sets a
// banner — it never clears the list or the selection.
test('the error path keeps the list and the selection: banner + no state reset', () => {
  const webCode = stripTsx(web);
  const mobileCode = stripDart(mobile);
  // The web catch block records the message only.
  const webResolve = /async function handleResolve[\s\S]*?\n  \}/.exec(webCode)?.[0];
  assert.ok(webResolve, 'web must define handleResolve');
  assert.ok(!/catch[\s\S]*?(?:setItems\(\[\]\)|setSelected\(null\))/.test(webResolve), 'web: a failed resolve must not clear the list or the selection');
  // The mobile catch block records the message only.
  const mobileResolve = /Future<void> _resolve\(bool approve\)[\s\S]*?\n  \}/.exec(mobileCode)?.[0];
  assert.ok(mobileResolve, 'mobile must define _resolve');
  assert.ok(!/catch[\s\S]*?(?:_items = |_selected = null)/.test(mobileResolve), 'mobile: a failed resolve must not clear the list or the selection');
  // The load-failure state offers a retry.
  assert.match(web, /<ErrorState[\s\S]{0,120}?onRetry=/, 'web must render ErrorState with a retry');
  assert.match(mobile, /AppErrorState\([\s\S]{0,120}?onRetry: _load/, 'mobile must render AppErrorState with a retry');
});

// (o) 🔴 THE STATUS CHIP IS THE CANONICAL choduyet KEY — label "Chờ duyệt" comes
// from the design-system map (Epic 1); an ad-hoc label override ("Chờ duyệt CK")
// would fork the canonical vocabulary (UX-DR-23 note in the story).
test('the status chip uses the canonical choduyet key with NO ad-hoc label', () => {
  assert.match(web, /<StatusChip status=\{ORDER_STATUS_CHODUYET\} \/>/, 'web must render <StatusChip status={ORDER_STATUS_CHODUYET}> — constant from the port, no label prop');
  assert.match(mobile, /AppStatusChip\(\s*status: StatusKey\.choduyet\)/, 'mobile must render AppStatusChip(status: StatusKey.choduyet) — no label argument');
  for (const [name, code] of allCode) {
    assert.ok(!/Chờ duyệt CK/.test(code), `${name} must not override the chip label — "Chờ duyệt" is canonical`);
    assert.ok(!code.includes("'choduyet'"), `${name} must not carry the status literal — use the port constant / the chip enum key`);
  }
});

// (p) 🔴 REJECT WITHOUT A REASON IS BLOCKED CLIENT-SIDE — the field error shows
// and the port is NOT called (the dialog never even opens).
test('rejecting without a reason is blocked before the dialog — no port call', () => {
  const webReject = /function handleRejectClick[\s\S]*?\n  \}/.exec(stripTsx(web))?.[0];
  assert.ok(webReject, 'web must define handleRejectClick');
  assert.match(webReject, /reason\.trim\(\) === ''/, 'web must check the empty reason before opening the dialog');
  assert.ok(!/resolveDiscount/.test(webReject), 'web handleRejectClick must not call the port — it only opens the dialog');
  const mobileReject = /Future<void> _openRejectDialog[\s\S]*?\n  \}/.exec(stripDart(mobile))?.[0];
  assert.ok(mobileReject, 'mobile must define _openRejectDialog');
  assert.match(mobileReject, /_reasonCtl\.text\.trim\(\)\.isEmpty/, 'mobile must check the empty reason before opening the dialog');
  assert.ok(!/resolveDiscount/.test(mobileReject), 'mobile _openRejectDialog must not call the port — it only opens the dialog');
});

// Anti-empty (E-7): the "must not contain" checks above scan these sources; if a stripper/reader
// ever returned (near-)empty text they would all pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ...allCode], 600, 'discount-approval');
});
