// Source-guard + parity for the Tạo báo giá screen (Story 4.1 — AC-2..AC-5).
//
// THIS FILE IS THE WEB HALF'S REAL TEST. The web app still has no tsc/bundler/
// JSDOM (TD-1, decision C-4: accepted through Epic 4), so CreateQuoteScreen.tsx
// gets NO typecheck and NO runtime test — what stands between a wrong `.tsx`
// and "done" is this guard and a human review. The mobile half additionally has
// native widget tests (create_quote_screen_test.dart).
//
// Groups: (a) both platforms exist · (b) composed from the design-system ·
// (c) transport only through injected ports · (d) shell hosting ·
// (e) byte-identical Vietnamese labels · (f) Viền nét · (g) no permission
// literal · plus the story's own NEGATIVE asserts: (h) no client money math,
// (i) no group provenance persisted, (j) reuse of the Story 3.4 pick flow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_SCREEN = 'web/src/screens/orders/CreateQuoteScreen.tsx';
const MOBILE_SCREEN = 'mobile/lib/screens/orders/create_quote_screen.dart';
const WEB_CSS = resolve(repoRoot, 'web/src/screens/orders/orders.css');

const PORT_FILES = [
  'web/src/design-system/session/orders-port.ts',
  'web/src/design-system/session/fake-orders-port.ts',
  'web/src/design-system/session/catalog-port.ts',
  'web/src/design-system/session/fake-catalog-port.ts',
  'mobile/lib/design_system/session/orders_port.dart',
  'mobile/lib/design_system/session/fake_orders_port.dart',
  'mobile/lib/design_system/session/catalog_port.dart',
  'mobile/lib/design_system/session/fake_catalog_port.dart',
];

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const web = read(WEB_SCREEN);
const mobile = read(MOBILE_SCREEN);
const css = readFileSync(WEB_CSS, 'utf8');

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const allCode = [
  ['web:quote', stripTsx(web)],
  ['mobile:quote', stripDart(mobile)],
];

// (a) BOTH PLATFORMS SHIP THE SCREEN (UX-DR-27) — plus the four new port twins.
test('the quote screen and its ports exist on BOTH platforms', () => {
  for (const rel of [WEB_SCREEN, MOBILE_SCREEN, ...PORT_FILES]) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

// (b) COMPOSE FROM THE DESIGN-SYSTEM (AD-13). No bare form controls; the cart
// row and the checklist control are the shipped components — including the two
// pieces this story ADDED to the library (Checkbox, CartLineRow.priceEditable).
test('web quote screen composes from shipped design-system components', () => {
  for (const name of ['Button', 'Card', 'CartLineRow', 'Checkbox', 'EmptyState', 'ErrorState', 'Field', 'Frame', 'ScopeFlag', 'Sheet', 'Table']) {
    assert.match(
      web,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `CreateQuoteScreen.tsx must import ${name} from design-system/components`,
    );
  }
  const code = stripTsx(web);
  assert.ok(!/<input\b/.test(code), 'web:quote must not render a bare <input> — use <Field>');
  assert.ok(!/<textarea\b/.test(code), 'web:quote must not render a bare <textarea> — use <Field multiline>');
  assert.ok(!/<button\b/.test(code), 'web:quote must not render a bare <button> — use <Button>');
  assert.ok(!/<select\b/.test(code), 'web:quote must not render a bare <select>');
  // The price input is gated SEPARATELY from qty (Task 7's new prop).
  assert.match(web, /priceEditable=\{editable && line\.priceEditable\}/, 'the cart row must gate the price input on line.priceEditable');
});

test('mobile quote screen composes from shipped design-system widgets', () => {
  assert.match(mobile, /import '\.\.\/\.\.\/design_system\/components\/components\.dart'/, 'must import the components barrel');
  for (const name of ['AppCartLineRow', 'AppCheckbox', 'AppScopeFlag', 'AppSheet', 'AppEmptyState', 'AppErrorState', 'AppFrame', 'AppCard', 'AppButton', 'AppField']) {
    assert.ok(mobile.includes(name), `create_quote_screen.dart must use ${name}`);
  }
  // Swipe-to-delete needs the stable line id, and the price gate is per line.
  assert.match(mobile, /id: line\.id/, 'AppCartLineRow must receive the stable line id (Dismissible key)');
  assert.match(mobile, /priceEditable: editable && line\.priceEditable/, 'the cart row must gate the price input on line.priceEditable');
});

// (c) TRANSPORT ONLY THROUGH THE INJECTED PORTS (AD-1/AD-2) — screens AND the
// port layer itself (ports are contracts + fakes until app-runtime).
test('no screen or port talks to the network directly — transport is the injected OrdersPort/CatalogPort', () => {
  const surfaces = [
    ...allCode,
    ...PORT_FILES.map((rel) => [rel, rel.endsWith('.dart') ? stripDart(read(rel)) : stripTsx(read(rel))]),
  ];
  for (const [name, code] of surfaces) {
    const banned = name.includes('.dart') || name.startsWith('mobile:')
      ? ['package:http', 'package:dio', 'HttpClient']
      : ['fetch(', 'axios', 'XMLHttpRequest'];
    for (const token of banned) {
      assert.ok(!code.includes(token), `${name} must not use ${token} — inject a port`);
    }
  }
  for (const [name, code] of allCode) {
    assert.match(code, /OrdersPort/, `${name} must take an OrdersPort`);
    assert.match(code, /CatalogPort/, `${name} must take a CatalogPort`);
    assert.match(code, /CustomersPort/, `${name} must take a CustomersPort (the pick step)`);
  }
});

// (c.2) THE SCREEN ACTUALLY CALLS THE PORTS — a screen with baked-in data is not
// a screen. Every quote mutation and both picker reads must be reachable.
test('each platform reaches the backend through every port method the cart needs', () => {
  // `[\s\S]{0,30}?` tolerates the line break dart format puts between the port
  // and the method (`widget.ordersPort\n    .create(`).
  for (const [name, code] of allCode) {
    // `applyDiscount` là method DUY NHẤT của 4.7 mà màn cart gọi —
    // resolveDiscount/listPendingDiscounts thuộc màn duyệt (discount-approval.test.mjs).
    for (const call of ['create', 'get', 'addLine', 'updateLine', 'removeLine', 'previewTotal', 'updateScopeFlags', 'updateOrderMeta', 'confirmOrder', 'reviseOrder', 'applyDiscount', 'exportQuote']) {
      assert.match(code, new RegExp(`ordersPort[\\s\\S]{0,60}?\\.${call}\\(`), `${name} must call ordersPort.${call}()`);
    }
    for (const call of ['listProducts', 'listGroups', 'getGroup']) {
      assert.match(code, new RegExp(`catalogPort[\\s\\S]{0,60}?\\.${call}\\(`), `${name} must call catalogPort.${call}()`);
    }
  }
});

// (d) SHELL HOSTING. Step 2 lives in the shell; step 1 IS the reused pick screen
// (which self-hosts its own shell — no shell-in-shell).
test('web quote screen renders INSIDE the shell with a permission-filtered Sidebar', () => {
  assert.match(web, /<WebShell/, 'must render inside <WebShell>');
  assert.match(web, /<Sidebar\s+sections=\{filterNav\(SIDEBAR_NAV, perms\)\}/, 'must render a <Sidebar> filtered by the session perms');
  assert.match(web, /activeKey="orders"/, 'must mark the orders nav item active');
  assert.match(web, /usePermissions\(\)/, 'must read the session via usePermissions()');
});

test('mobile quote screen renders INSIDE the shell on the Tạo tab', () => {
  assert.ok(mobile.includes('AppPhoneFrame'), 'must render inside AppPhoneFrame');
  assert.ok(mobile.includes('AppMobileShell'), 'must render inside AppMobileShell');
  assert.match(mobile, /AppBottomNav\(activeIndex: kCreateTabIndex\)/, 'must mark the Tạo tab active');
  assert.match(mobile, /const int kCreateTabIndex = 2;/, 'the Tạo tab is index 2 (locked nav, UX-DR-15)');
});

// (e) PARITY (UX-DR-27): byte-identical Vietnamese labels across web ↔ mobile.
test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27)', () => {
  const labels = [
    'ĐƠN HÀNG',
    'Tạo báo giá',
    'Khách hàng',
    'Giỏ hàng',
    'Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu.',
    // the three ways into the cart
    'Chọn từ danh mục',
    'Chọn gói vật tư',
    'Dòng tự do',
    'Tìm theo tên hoặc SKU',
    'Mở checklist',
    'Thêm dòng',
    // the free-line form
    'Tên dòng',
    'Đơn vị',
    'Số lượng',
    'Đơn giá',
    'Diễn giải',
    // display-only flexibility flag (AC-2)
    'Linh động/dự kiến',
    // scope flags row (Story 4.3, FR-2) — chip labels + the row caption
    'Phạm vi',
    'Thiết bị',
    'Thi công',
    'Vận chuyển',
    // order metadata (Story 4.4, FR-3/FR-4) — VAT tick + the two commit-on-blur inputs
    'Tính VAT',
    'Công suất (kWp)',
    'Hiệu lực báo giá',
    // the totals area — values come from preview-total; '—' is the fallback
    'Tổng trước VAT',
    'Tiền VAT',
    'Tổng sau VAT',
    '—',
    // Chốt (Story 4.5) — the button + the FULL consequence sentence of the
    // confirm dialog (UX-DR-19: the dialog states what freezing means).
    'Chốt báo giá',
    'Chốt sẽ đóng băng giá của mọi dòng theo danh mục hiện tại — sửa giá sau này cần tạo bản mới.',
    // Mở lại (Story 4.6) — the button + the FULL consequence sentence of the
    // confirm dialog (UX-DR-20: the dialog states what reopening means).
    'Mở lại để sửa',
    'Mở lại sẽ tạo bản cập nhật mới — giá các dòng tính lại theo danh mục hiện tại cho tới khi chốt lại; bản đã chốt vẫn nằm trong lịch sử.',
    // Áp chiết khấu (Story 4.7) — the button/dialog title, the two fields, the
    // send button, the FULL consequence sentence, the three state banners
    // (rejected = prefix, the resolveNote is appended at runtime) and the
    // totals row label.
    'Áp chiết khấu',
    'Mức chiết khấu (đ)',
    'Lý do đề xuất',
    'Gửi duyệt',
    'Gửi duyệt sẽ chuyển đơn sang Chờ duyệt chiết khấu — đơn khoá sửa cho tới khi được duyệt hoặc bị từ chối.',
    'Chờ duyệt chiết khấu — chiết khấu đang chờ người có quyền duyệt.',
    'Chiết khấu đã được duyệt — có thể chốt đơn.',
    'Chiết khấu bị từ chối — ',
    'Chiết khấu',
    // Chia sẻ báo giá (Story 4.8, FR-21) — native share đi thẳng, KHÔNG dialog
    // (UX-DR-20); nút hiện mọi trạng thái khi giỏ có dòng.
    'Chia sẻ báo giá',
  ];
  for (const label of labels) {
    assert.ok(web.includes(label), `web quote screen is missing the label "${label}"`);
    assert.ok(mobile.includes(label), `mobile quote screen is missing the label "${label}"`);
  }
  // Tải PDF là nút WEB-ONLY (Story 4.8): desktop không share file được thì tải
  // PDF về; mobile KHÔNG có nút này — share sheet OS có sẵn Lưu ảnh/Drive.
  assert.ok(web.includes('Tải PDF'), 'web quote screen is missing the web-only "Tải PDF" button');
  assert.ok(!mobile.includes('Tải PDF'), 'mobile must NOT have a "Tải PDF" button — the OS share sheet already offers save/Drive');
});

// (e.2) PARITY — Story 4.9 warranty column labels. The column header lives on
// the web screen (`<th>`); the mobile screen renders rows without a header row,
// so the two runtime labels ("+ Thêm bảo hành", "Không có") are asserted where
// they actually live: byte-identical in the two CartLineRow component twins.
test('warranty labels byte-identical across CartLineRow twins (Story 4.9, FR-36)', () => {
  // Strip comments FIRST — the labels appear in doc comments too, so a raw
  // includes() would false-green if the real render string were changed while a
  // comment kept the token (the "guard scans comments" trap).
  const webRow = stripTsx(read('web/src/design-system/components/CartLineRow.tsx'));
  const mobileRow = stripDart(read('mobile/lib/design_system/components/cart_line_row.dart'));
  for (const label of ['+ Thêm bảo hành', 'Không có']) {
    assert.ok(webRow.includes(label), `web CartLineRow render is missing "${label}"`);
    assert.ok(mobileRow.includes(label), `mobile CartLineRow render is missing "${label}"`);
  }
  // The 'Bảo hành' column header is web-only (mobile has no header row); the a11y
  // label 'Bảo hành (tháng)' carries the meaning on both component twins.
  assert.ok(stripTsx(web).includes('Bảo hành'), 'web quote screen is missing the "Bảo hành" column header');
  for (const [name, code] of [['web', webRow], ['mobile', mobileRow]]) {
    assert.ok(code.includes('Bảo hành (tháng)'), `${name} CartLineRow render is missing the a11y label "Bảo hành (tháng)"`);
  }
});

// (f) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens (UX-DR-4).
test('no ad-hoc shadow/gradient/elevation, radius via tokens (Viền nét, UX-DR-4)', () => {
  assert.ok(!/box-shadow/i.test(css), 'orders.css must contain 0 box-shadow');
  assert.ok(!/gradient/i.test(css), 'orders.css must contain 0 gradient');
  assert.ok(!/drop-shadow/i.test(css), 'orders.css must contain 0 drop-shadow');
  assert.ok(!/filter:/i.test(css), 'orders.css must contain 0 filter:');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `orders.css radius must come from a token: ${decl}`);
  }
  assert.ok(!/BoxShadow/.test(mobile), 'mobile quote screen must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(mobile), 'mobile quote screen must contain 0 elevation');
});

// (g) NO PERMISSION LITERAL IN A SCREEN (AD-17). `quotes.create_edit` is enforced
// by the BACKEND guard; the screen carries no permission strings at all.
test('no quote screen hardcodes a permission literal (AD-17)', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/;
  for (const [name, code] of allCode) {
    const body = code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '');
    assert.ok(!registryLike.test(body), `${name} must not hardcode a permission literal`);
  }
});

// (h) 🔴 NEGATIVE ASSERT — NO CLIENT MONEY MATH (AD-10/16). `unitPrice`, `amount`
// and every total are BACKEND numbers. A `unitPrice * qty` in a screen is the
// exact bug the architecture forbids: two sources of truth for one sum. (The
// fake ports simulate the backend and are excluded on purpose — they ARE the
// demo server.)
test('no screen multiplies or adds money — amount/totals come from the backend', () => {
  // `[\w.$_]*` on BOTH sides of the operator: the operands are usually property
  // accesses (`line.unitPrice * line.qty`) — a bare-identifier pattern let that
  // exact mutant pass green (caught by the mutation spot-check).
  const moneyMath =
    /(?:unitPrice|amount|price|qty)\s*[*+\-]\s*[\w.$_]*(?:qty|unitPrice|amount|price)/i;
  for (const [name, code] of allCode) {
    assert.ok(!moneyMath.test(code), `${name} must not compute money — render the backend's amount as-is (AD-16)`);
    assert.ok(!/\breduce\(/.test(code), `${name} must not sum lines — totals come ONLY from preview-total`);
  }
  // "—" is the initial/failed-preview state of the totals area — it must stay
  // present in the source of both platforms (fallback khi chưa có/lỗi preview).
  assert.ok(web.includes('—'), 'web totals must keep the "—" fallback (no preview yet / preview failed)');
  assert.ok(mobile.includes('—'), 'mobile totals must keep the "—" fallback (no preview yet / preview failed)');
});

// (h.2) 🔴 TOTALS COME ONLY FROM preview-total (Story 4.2, AD-16). Both screens
// call previewTotal(); NEITHER contains VAT math — the 8%/half-up formula lives
// in the backend and its fake stand-in ONLY. A `* 8` or a floor-divide on money
// inside a screen is a SECOND computer of money — the exact forbidden bug.
test('totals are wired through previewTotal — and no screen computes VAT', () => {
  for (const [name, code] of allCode) {
    assert.match(code, /previewTotal\(/, `${name} must call previewTotal() to fill the totals area`);
    assert.ok(!/\*\s*8\b/.test(code), `${name} must not contain the VAT multiplier — the formula lives in the backend/fake only`);
    assert.ok(!/0\.08/.test(code), `${name} must not contain a float VAT rate — money math is backend-only (AD-16)`);
  }
  // Rounding operators on the money path: floor for TS, integer-divide for Dart.
  assert.ok(!/Math\.floor\(/.test(stripTsx(web)), 'web:quote must not round money — the backend already did');
  assert.ok(!/~\/\s*100/.test(stripDart(mobile)), 'mobile:quote must not integer-divide money — the backend already did');
});

// (h.3) 🔴 THE WEB HALF HAS NO RUNTIME LANE (TD-1/C-4): the mobile widget tests
// pin the Dart fake's numbers, but NOTHING executes the web screen or web fake.
// Text is the only defense, so pin the two things a runtime test would catch:
// the web render wires all THREE distinct totals fields (a copy-pasted
// `totals.subtotal` in every row passes every other assert), and the web fake
// carries the EXACT half-up formula so it cannot drift from the Dart twin the
// widget tests DO execute.
test('web wires all three totals fields; both fakes carry the one half-up VAT formula', () => {
  for (const field of ['totals.subtotal', 'totals.vatAmount', 'totals.total']) {
    assert.ok(web.includes(field), `web:quote must render ${field} — three distinct backend numbers, not one copied thrice`);
  }
  const webFake = read('web/src/design-system/session/fake-orders-port.ts');
  const dartFake = read('mobile/lib/design_system/session/fake_orders_port.dart');
  // Story 4.4: the multiplier is the fake's `vatRate` const (pinned to the backend
  // default 8) and the tick echo gates it — same shape on both twins.
  // Story 4.7: the base is `vatBase = subtotal - discountAmount` — the discount
  // subtracts BEFORE VAT; a fake computing VAT on the raw subtotal has drifted
  // from computeOrderTotals().
  assert.ok(
    webFake.includes('Math.floor((vatBase * vatRate + 50) / 100)'),
    'web fake must compute VAT with the backend formula floor((vatBase*vatRate+50)/100) — half-up, on vatBase',
  );
  assert.ok(
    webFake.includes('const vatBase = subtotal - discountAmount;'),
    'web fake must subtract the discount into vatBase before VAT (Story 4.7)',
  );
  assert.ok(
    webFake.includes('const vatRate = 8;'),
    'web fake must pin vatRate to the backend default 8',
  );
  assert.ok(
    dartFake.includes('(vatBase * vatRate + 50) ~/ 100'),
    'dart fake must compute VAT with the backend formula (vatBase*vatRate+50)~/100 — half-up, on vatBase',
  );
  assert.ok(
    dartFake.includes('final int vatBase = subtotal - discountAmount;'),
    'dart fake must subtract the discount into vatBase before VAT (Story 4.7)',
  );
  assert.ok(
    dartFake.includes('const int vatRate = 8;'),
    'dart fake must pin vatRate to the backend default 8',
  );
});

// (i) 🔴 NEGATIVE ASSERT — A GROUP LEAVES NO TRACE ON THE ORDER (§2, Story 3.6
// handover). Each ticked item becomes an ORDINARY line pointing at the real
// Product; no group name/id is persisted, sent, or rendered as provenance.
test('no group provenance is persisted or sent — items become ordinary lines', () => {
  for (const [name, code] of [...allCode, ...PORT_FILES.map((rel) => [rel, read(rel)])]) {
    assert.ok(!/groupName/.test(code), `${name} must not carry a groupName — groups are input tools, not order data`);
    assert.ok(!/productGroupId/.test(code), `${name} must not persist a group id on a line`);
  }
  // The tick path calls addLine with the PRODUCT id.
  assert.match(stripTsx(web), /addCatalogLine\(item\.productId|addCatalogLine\(productId/, 'web tick must add by productId');
  assert.match(stripDart(mobile), /_tickGroupItem\(item\.productId/, 'mobile tick must add by productId');
  // Deactivated products render as DISABLED checklist items (Story 3.6 payload).
  assert.match(web, /disabled=\{!item\.isActive\}/, 'web checklist must disable inactive items');
  assert.match(mobile, /disabled: !item\.isActive/, 'mobile checklist must disable inactive items');
});

// (j) THE PICK FLOW IS REUSED, NOT REBUILT (AC-3). Step 1 renders the Story 3.4
// screen as the WHOLE view (it hosts its own shell) and the order is created
// from its onSelect callback — the exact seam that story left behind.
test('step 1 reuses CustomerPickScreen via onSelect — no second lookup UI', () => {
  assert.match(web, /import \{ CustomerPickScreen[^}]*\} from '\.\.\/customers\/CustomerPickScreen'/, 'web must import the Story 3.4 pick screen');
  assert.match(web, /<CustomerPickScreen\s+port=\{customersPort\}/, 'web must render the pick screen with the injected port');
  assert.match(stripTsx(web), /ordersPort\.create\(\{ customerSdt: picked\.sdt \}\)/, 'web onSelect must create the order from the picked customer');
  assert.match(mobile, /import '\.\.\/customers\/customer_pick_screen\.dart'/, 'mobile must import the Story 3.4 pick screen');
  assert.match(mobile, /CustomerPickScreen\(\s*port: widget\.customersPort/, 'mobile must render the pick screen with the injected port');
  assert.match(stripDart(mobile), /CreateOrderInput\(customerSdt: picked\.sdt\)/, 'mobile onSelect must create the order from the picked customer');
});

// (l) 🔴 SCOPE FLAGS (Story 4.3). The chip stays a STATIC display primitive: the
// screen may not bolt a handler onto it (toggling goes through the separate
// Checkbox controls), `scopeThietBi` gets NO toggle control (always on — every
// order carries equipment, EXPERIENCE §Máy trạng thái), and the toggle branch
// must NOT re-preview totals — flags carry no money (AD-16 stays intact).
test('scope chips render read-only, Thiết bị has no toggle, and toggling never re-previews totals', () => {
  const webCode = stripTsx(web);
  const mobileCode = stripDart(mobile);

  // The display chip carries NO handler prop/callback in either screen.
  assert.ok(!/<ScopeFlag[^>]*\son[A-Z]/.test(webCode), 'web: <ScopeFlag> must stay a static display — no on* handler prop');
  assert.ok(!/AppScopeFlag\([^)]*\bon(?:Tap|Changed|Pressed)/.test(mobileCode), 'mobile: AppScopeFlag must stay a static display — no callback argument');

  // Exactly TWO toggle controls — Thi công + Vận chuyển. A checkbox for
  // Thiết bị would be a control for an immutable flag (and the DTO the
  // backend exposes has no field for it).
  const webToggles = webCode.match(/<Checkbox\s[^>]*label="(?:Thi công|Vận chuyển|Thiết bị)"/g) ?? [];
  assert.deepEqual(
    webToggles.map((m) => /label="([^"]+)"/.exec(m)[1]).sort(),
    ['Thi công', 'Vận chuyển'],
    'web must render exactly the two mutable-flag toggles (no Thiết bị control)',
  );
  const mobileToggles = mobileCode.match(/AppCheckbox\(\s*label: '(?:Thi công|Vận chuyển|Thiết bị)'/g) ?? [];
  assert.deepEqual(
    mobileToggles.map((m) => /label: '([^']+)'/.exec(m)[1]).sort(),
    ['Thi công', 'Vận chuyển'],
    'mobile must render exactly the two mutable-flag toggles (no Thiết bị control)',
  );

  // The toggle handler body: PATCH via the port, replace the order — and NO
  // totals re-preview (flags do not touch money).
  const webToggleBody = /async function handleScopeToggle[\s\S]*?\n  \}/.exec(webCode)?.[0];
  assert.ok(webToggleBody, 'web must define handleScopeToggle');
  assert.ok(!/previewTotal|refreshTotals/.test(webToggleBody), 'web handleScopeToggle must not re-preview totals — flags carry no money');
  const mobileToggleBody = /Future<void> _toggleScope[\s\S]*?\n  \}/.exec(mobileCode)?.[0];
  assert.ok(mobileToggleBody, 'mobile must define _toggleScope');
  assert.ok(!/previewTotal|_refreshTotals/.test(mobileToggleBody), 'mobile _toggleScope must not re-preview totals — flags carry no money');
});

// (m) 🔴 ORDER METADATA (Story 4.4). Three rules a wrong .tsx would break silently:
//  · The VAT % label is a BACKEND value (totals.vatRate) — a static "8%" string is
//    a second opinion that goes stale the day the admin changes the config.
//  · The meta handler MUST re-preview totals (opposite of the 4.3 scope rule):
//    the VAT tick changes money, so the three numbers must refresh with the new echo.
//  · The preview echo carries the order's vatMode out — otherwise unticking VAT
//    changes nothing the backend can see.
test('VAT % is a backend value, the meta path re-previews totals, the echo carries vatMode', () => {
  const webCode = stripTsx(web);
  const mobileCode = stripDart(mobile);

  // No static "8%" anywhere in a screen — the label renders totals.vatRate.
  assert.ok(!/['"`]8%['"`]/.test(webCode), 'web must not hardcode "8%" — render totals.vatRate');
  assert.ok(!/'8%'/.test(mobileCode), 'mobile must not hardcode "8%" — render _totals.vatRate');
  assert.ok(web.includes('totals.vatRate'), 'web must render the applied rate from totals.vatRate');
  assert.ok(mobile.includes('_totals!.vatRate'), 'mobile must render the applied rate from _totals.vatRate');

  // The meta handler re-previews (VAT changes money) — unlike the scope handler.
  const webMetaBody = /async function handleMetaUpdate[\s\S]*?\n  \}/.exec(webCode)?.[0];
  assert.ok(webMetaBody, 'web must define handleMetaUpdate');
  assert.match(webMetaBody, /refreshTotals\(/, 'web handleMetaUpdate must re-preview totals — the VAT tick changes money');
  const mobileMetaBody = /Future<void> _updateMeta[\s\S]*?\n  \}/.exec(mobileCode)?.[0];
  assert.ok(mobileMetaBody, 'mobile must define _updateMeta');
  assert.match(mobileMetaBody, /_refreshTotals\(/, 'mobile _updateMeta must re-preview totals — the VAT tick changes money');

  // The preview echo carries the order's vatMode (like unitPrice — echo, never invent).
  assert.match(webCode, /previewTotal\(\{[\s\S]{0,400}?vatMode: fetched\.vatMode/, 'web refreshTotals must echo the order vatMode');
  assert.match(mobileCode, /PreviewTotalInput\([\s\S]{0,400}?vatMode: fetched\.vatMode/, 'mobile _refreshTotals must echo the order vatMode');

  // kWp is an INPUT CONVERSION ("8,82" → 8.82), not money math — both platforms
  // must normalise the decimal comma before parsing.
  assert.match(webCode, /replace\(',', '\.'\)/, "web must normalise the decimal comma in the kWp box");
  assert.match(mobileCode, /replaceAll\(',', '\.'\)/, "mobile must normalise the decimal comma in the kWp box");
});

// (n) 🔴 CHỐT (Story 4.5). The confirmed status only ever ARRIVES on the Order
// the port returns — a screen writing the confirmed status literal into its own
// state would fake a confirmation the backend may have refused (the atomic gate
// is server-side). The fakes are excluded: they ARE the demo backend and write
// the status as the server would.
test('no screen self-assigns the confirmed status — it only renders the Order the port returns', () => {
  for (const [name, code] of allCode) {
    assert.ok(
      !code.includes("'dachot'"),
      `${name} must not carry the confirmed-status literal — status comes only from the Order the port returns`,
    );
    // Story 4.7: the awaiting-approval status gets the SAME rule — compare via
    // the port constant (ORDER_STATUS_CHODUYET / kOrderStatusChoduyet), never
    // the raw literal.
    assert.ok(
      !code.includes("'choduyet'"),
      `${name} must not carry the awaiting-approval status literal — import the port constant`,
    );
  }
});

// (k) A FAILURE NEVER WIPES THE CART (EXPERIENCE Flow 1). The error path sets a
// message and offers retry — it never resets the order state.
test('the error path keeps entered lines: error state + retry, no order reset', () => {
  assert.match(web, /<ErrorState message=\{error\} onRetry=/, 'web must render ErrorState with a retry');
  assert.match(mobile, /AppErrorState\(message: _error!, onRetry: _refresh\)/, 'mobile must render AppErrorState with a retry');
  // The catch blocks only record the message — they must not null the order out.
  assert.ok(!/catch[^}]*setOrder\(null\)/.test(stripTsx(web)), 'web: a failed call must not reset the order');
  assert.ok(!/catch[^}]*_order = null/.test(stripDart(mobile)), 'mobile: a failed call must not reset the order');
  // Step 1 has NO ErrorState yet — a failed create must surface a banner right
  // on the pick view, or the tap fails in total silence (review fix H1).
  assert.match(
    stripTsx(web),
    /\{error !== null && <Banner tone="danger">\{error\}<\/Banner>\}[\s\S]*?<CustomerPickScreen/,
    'web step 1 must render the create-failure message above the pick screen',
  );
  assert.match(
    stripDart(mobile),
    /AppBanner\(tone: AppBannerTone\.danger, message: _error!\)/,
    'mobile step 1 must render the create-failure message above the pick screen',
  );
});
