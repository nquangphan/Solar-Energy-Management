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
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
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
    // Huỷ đơn (Story 5.7) — button, dialog title, consequence sentence, the
    // reason field's caption, and the facts row that shows it afterwards.
    'Huỷ đơn',
    'Lý do huỷ',
    'Xác nhận huỷ',
    'Đóng',
    'Đơn sẽ đóng lại và không tiếp tục được. Thao tác này không hoàn tác được.',
    'Không huỷ được đơn.',
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

// (e.3) EXACTLY THREE TABS. Hợp đồng/Hoá đơn are Epic 7 — an empty tab promises
// the user something nobody built. Ảnh LEFT the forbidden list in Story 5.6: that
// story shipped the panel the tab opens, so the tab is now real.
// "Thanh toán" left the RAW-TEXT list in Story 7.1: the payment schedule shipped
// as its own screen reached by an action button — but a Thanh toán TAB is still
// forbidden (the full tab needs payment recording too), so the tab list itself
// is checked for it. The rule did not weaken — the set of shipped surfaces grew.
// "Hợp đồng" left the RAW-TEXT list the same way in Story 7.3: contracts shipped as
// their own screen reached by an action button; a Hợp đồng TAB is still forbidden.
// "Hoá đơn" left it the same way in Story 7.4: invoices shipped as their own screen
// reached by an action button; a Hoá đơn TAB is still forbidden.
test('exactly the three owned tabs render — no placeholder tabs for future stories', () => {
  // Stripped code, not raw text: both screens explain in a comment WHICH tabs
  // they deliberately do not render, and that explanation is worth keeping.
  const tabLists = [
    ['web:detail', webCode, /const TABS = \[([\s\S]*?)\];/],
    ['mobile:detail', mobileCode, /_kTabs = <AppTabItem>\[([\s\S]*?)\];/],
  ];
  for (const [name, src, re] of tabLists) {
    const m = re.exec(src);
    assert.ok(m !== null && m[1].includes('Ảnh'), `${name}: the tab list must be found (guard not blind)`);
    assert.ok(!m[1].includes('Thanh toán'), `${name} must not render a "Thanh toán" tab — payment recording owns it`);
    assert.ok(!m[1].includes('Hợp đồng'), `${name} must not render a "Hợp đồng" tab — contracts are a screen behind a button`);
    assert.ok(!m[1].includes('Hoá đơn'), `${name} must not render a "Hoá đơn" tab — invoices are a screen behind a button`);
    assert.equal((m[1].match(/label:/g) ?? []).length, 3, `${name} must render exactly three tabs`);
  }
  for (const [name, src] of allCode) {
    for (const notYet of ['HĐ & HĐơn']) {
      assert.ok(!src.includes(notYet), `${name} must not render a "${notYet}" tab — that story owns it`);
    }
    // Positive assertion: the Ảnh tab must ACTUALLY be there on both platforms.
    // Without it, deleting the tab would silently pass this test.
    assert.ok(
      /label:\s*'Ảnh'|label:\s*"Ảnh"/.test(src),
      `${name} must render the Ảnh tab (Story 5.6)`,
    );
  }
});

// (e.4) NO BUTTON OWNED BY A STORY THAT HAS NOT SHIPPED. "Share báo giá" still
// leads to a screen that does not exist.
//
// "Chuyển trạng thái" LEFT this list in Story 5.5 and "Huỷ đơn" in Story 5.7:
// each story shipped the destination its button opens, so it now owns the
// button too. The rule did not weaken — it still says "no button to nowhere";
// two destinations stopped being nowhere.
test('the detail screen renders no button owned by a future story', () => {
  for (const [name, src] of allCode) {
    for (const label of ['Share báo giá']) {
      assert.ok(!src.includes(label), `${name} must not render "${label}" — a later story owns that button`);
    }
  }
});

// (e.5) THE CANCEL BUTTON EXISTS, AND IS GATED ON ITS OWN FLAG (Story 5.7).
//
// 🔴 THE ASSERTION THAT MATTERS IS THE NEGATIVE ONE. `huy` is NOT part of the
// manual lane, so `buocKeTiep` is EMPTY at 'baogia' — the status orders are
// cancelled from most often. Nesting the cancel button inside the existing
// `buocKeTiep.length > 0` wrapper renders it as NOTHING exactly there, and every
// other guard in this file would still pass.
test('the cancel button is gated on coTheHuy, NOT nested in a buocKeTiep condition (Story 5.7)', () => {
  assert.ok(webCode.includes('Huỷ đơn'), 'the web detail must render the "Huỷ đơn" button');
  assert.ok(mobileCode.includes('Huỷ đơn'), 'the mobile detail must render the "Huỷ đơn" button');

  // Backend-computed flag, read straight off the lifecycle response (AD-2).
  assert.match(webCode, /coTheHuy/, 'the web detail must gate the cancel button on coTheHuy');
  assert.match(mobileCode, /_coTheHuy/, 'the mobile detail must gate the cancel button on _coTheHuy');

  // The condition IMMEDIATELY guarding the button is the cancel flag alone.
  const webNut = webCode.slice(0, webCode.indexOf('Huỷ đơn'));
  const mobNut = mobileCode.slice(0, mobileCode.indexOf('Huỷ đơn'));
  assert.match(
    webNut.slice(-400),
    /coTheHuy\s*&&/,
    'the web cancel button must sit directly under a `coTheHuy &&` condition',
  );
  assert.match(
    mobNut.slice(-400),
    /if\s*\(_coTheHuy\)/,
    'the mobile cancel button must sit directly under `if (_coTheHuy)`',
  );

  // 🔴 AND SO MUST THE CONTAINER AROUND IT. Checking only the inner condition is
  // not enough: re-wrapping the whole action block in the old
  // `buocKeTiep.length > 0 &&` leaves the inner `coTheHuy &&` untouched and
  // still hides the button at 'baogia'. So assert the OUTER condition mentions
  // the cancel flag, and that the old sole-wrapper shape is gone.
  const webContainer = webCode.slice(0, webCode.indexOf('className="od-actions"'));
  assert.match(
    webContainer.slice(-300),
    /\|\|\s*coTheHuy/,
    'the .od-actions container must also open on coTheHuy — otherwise the button vanishes at baogia',
  );
  assert.ok(
    !/\{buocKeTiep\.length > 0 && onChangeStatus && \(\s*<div className="od-actions"/.test(webCode),
    'the web action container must not be gated on buocKeTiep alone (Story 5.7)',
  );
  assert.ok(
    !/if \(_buocKeTiep\.isNotEmpty && widget\.onChangeStatus != null\) \.\.\.<Widget>\[/.test(mobileCode),
    'the mobile action block must not be gated on _buocKeTiep alone (Story 5.7)',
  );
  assert.match(
    mobileCode,
    /\|\|\s*_coTheHuy\s*(?:\)\s*\.\.\.<Widget>\[|\|\|)/,
    'the mobile action block must also open on _coTheHuy',
  );
});

// (e.6) THE "Thanh toán" BUTTON (Story 7.1) renders ONLY when the caller passes
// the callback — same rule as "Chuyển trạng thái": no button to nowhere.
test('the "Thanh toán" button is gated on the onOpenPaymentSchedule callback', () => {
  const webBtn = webCode.slice(0, webCode.indexOf('>Thanh toán<'));
  assert.ok(webCode.includes('>Thanh toán<'), 'the web detail must render the "Thanh toán" button');
  assert.match(webBtn.slice(-200), /onOpenPaymentSchedule\s*&&/, 'web: directly under `onOpenPaymentSchedule &&`');
  const mobBtn = mobileCode.slice(0, mobileCode.indexOf("'Thanh toán'"));
  assert.ok(mobileCode.includes("'Thanh toán'"), 'the mobile detail must render the "Thanh toán" button');
  assert.match(
    mobBtn.slice(-250),
    /if\s*\(widget\.onOpenPaymentSchedule != null\)/,
    'mobile: directly under `if (widget.onOpenPaymentSchedule != null)`',
  );
});

// (e.7) THE "Hợp đồng" BUTTON (Story 7.3) renders ONLY when the caller passes the
// callback (the caller passes it only with contracts.generate) — no button to nowhere.
test('the "Hợp đồng" button is gated on the onOpenContracts callback', () => {
  assert.ok(webCode.includes('>Hợp đồng<'), 'the web detail must render the "Hợp đồng" button');
  const webBtn = webCode.slice(0, webCode.indexOf('>Hợp đồng<'));
  assert.match(webBtn.slice(-200), /onOpenContracts\s*&&/, 'web: directly under `onOpenContracts &&`');
  assert.ok(mobileCode.includes("'Hợp đồng'"), 'the mobile detail must render the "Hợp đồng" button');
  const mobBtn = mobileCode.slice(0, mobileCode.indexOf("'Hợp đồng'"));
  assert.match(
    mobBtn.slice(-250),
    /if\s*\(widget\.onOpenContracts != null\)/,
    'mobile: directly under `if (widget.onOpenContracts != null)`',
  );
  // The action container itself must open on the callback, or the button is unreachable
  // whenever no other action applies.
  assert.match(webCode, /\|\|\s*onOpenContracts\s*(?:\|\|\s*\w+\s*)*\)\s*&&\s*\(/, 'web: .od-actions opens on onOpenContracts');
  assert.match(
    mobileCode,
    /widget\.onOpenContracts != null(?:\s*\|\|\s*widget\.\w+ != null)*\)\s*\.\.\.<Widget>\[/,
    'mobile: the action block opens on onOpenContracts',
  );
});

// (e.8) THE "Hoá đơn" BUTTON (Story 7.4) renders ONLY when the caller passes the
// callback (the caller passes it only with invoices.manage) — no button to nowhere.
test('the "Hoá đơn" button is gated on the onOpenInvoices callback', () => {
  assert.ok(webCode.includes('>Hoá đơn<'), 'the web detail must render the "Hoá đơn" button');
  const webBtn = webCode.slice(0, webCode.indexOf('>Hoá đơn<'));
  assert.match(webBtn.slice(-200), /onOpenInvoices\s*&&/, 'web: directly under `onOpenInvoices &&`');
  assert.ok(mobileCode.includes("'Hoá đơn'"), 'the mobile detail must render the "Hoá đơn" button');
  const mobBtn = mobileCode.slice(0, mobileCode.indexOf("'Hoá đơn'"));
  assert.match(
    mobBtn.slice(-250),
    /if\s*\(widget\.onOpenInvoices != null\)/,
    'mobile: directly under `if (widget.onOpenInvoices != null)`',
  );
  // The action container itself must open on the callback, or the button is unreachable
  // whenever no other action applies.
  assert.match(webCode, /\|\|\s*onOpenInvoices\s*(?:\|\|\s*\w+\s*)*\)\s*&&\s*\(/, 'web: .od-actions opens on onOpenInvoices');
  assert.match(
    mobileCode,
    /widget\.onOpenInvoices != null(?:\s*\|\|\s*widget\.\w+ != null)*\)\s*\.\.\.<Widget>\[/,
    'mobile: the action block opens on onOpenInvoices',
  );
  // The button follows "Hợp đồng" on both platforms (existing order kept).
  assert.ok(webCode.indexOf('>Hợp đồng<') < webCode.indexOf('>Hoá đơn<'), 'web: "Hoá đơn" comes after "Hợp đồng"');
  assert.ok(mobileCode.indexOf("'Hợp đồng'") < mobileCode.indexOf("'Hoá đơn'"), 'mobile: "Hoá đơn" comes after "Hợp đồng"');
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

// Anti-empty (E-7): the "must not contain" checks above scan these sources; if a stripper/reader
// ever returned (near-)empty text they would all pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ...allCode], 1500, 'order-detail');
});
