// Source-guard + parity for the three Khách hàng screens (Story 3.4 — AC-2, AC-7, AC-10).
//
// THIS FILE IS THE STORY'S REAL TEST. The web app still has no tsc/bundler/JSDOM
// (TD-1), so the six screen files get NO typecheck and NO runtime test. What
// stands between a wrong `.tsx` and "done" is this guard and a human review —
// nothing else. It is written to be strict on purpose.
//
// Eight groups: (a) both platforms exist · (b) composed from the design-system ·
// (c) transport only through the injected port · (d) office screen ⇒ shell ·
// (e) byte-identical Vietnamese labels · (f) Viền nét · (g) no permission literal ·
// (h) the two NEGATIVE asserts: no order data (AC-7), no client-side phone logic (AC-2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertScanned, assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_FILES = {
  pick: 'web/src/screens/customers/CustomerPickScreen.tsx',
  list: 'web/src/screens/customers/CustomerListScreen.tsx',
  detail: 'web/src/screens/customers/CustomerDetailScreen.tsx',
};
const MOBILE_FILES = {
  pick: 'mobile/lib/screens/customers/customer_pick_screen.dart',
  list: 'mobile/lib/screens/customers/customer_list_screen.dart',
  detail: 'mobile/lib/screens/customers/customer_detail_screen.dart',
};
const WEB_CSS = resolve(repoRoot, 'web/src/screens/customers/customers.css');

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const web = Object.fromEntries(Object.entries(WEB_FILES).map(([k, v]) => [k, read(v)]));
const mobile = Object.fromEntries(Object.entries(MOBILE_FILES).map(([k, v]) => [k, read(v)]));
const css = readFileSync(WEB_CSS, 'utf8');

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/^\s*\/\/\/.*$/gm, '');

/** All six screens, comment-stripped — the surface every "must not appear" rule scans. */
const allCode = [
  ...Object.entries(web).map(([k, src]) => [`web:${k}`, stripTsx(src)]),
  ...Object.entries(mobile).map(([k, src]) => [`mobile:${k}`, stripDart(src)]),
];

/** All six screens as raw text — what the label-parity rules scan (labels live in strings). */
const webAll = Object.values(web).join('\n');
const mobileAll = Object.values(mobile).join('\n');

// (a) BOTH PLATFORMS SHIP ALL THREE SCREENS (parity coverage, AC-10).
test('all three customer screens exist on BOTH platforms (AC-10)', () => {
  for (const rel of [...Object.values(WEB_FILES), ...Object.values(MOBILE_FILES)]) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

// (b) COMPOSE FROM THE DESIGN-SYSTEM (AD-13). No new components, no bare elements.
test('web screens compose from shipped design-system components (AC-9)', () => {
  for (const name of ['Button', 'Card', 'Frame', 'Field', 'CustomerTypeChip', 'Banner']) {
    assert.match(
      web.pick,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `CustomerPickScreen.tsx must import ${name} from design-system/components`,
    );
  }
  for (const name of ['Table', 'EmptyState', 'ErrorState', 'Skeleton', 'CustomerTypeChip']) {
    assert.match(
      web.list,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `CustomerListScreen.tsx must import ${name} from design-system/components`,
    );
  }
  assert.match(web.list, /<SearchField/, 'the list toolbar must use the shipped <SearchField>');
  assert.match(web.list, /<Seg\b/, 'the list filter must use the shipped <Seg>');
  assert.match(web.list, /<Toolbar>/, 'the list must use the shipped <Toolbar>');

  // Bare form controls mean an unstyled, ungoverned surface — that is what the
  // component library exists to prevent.
  for (const [name, code] of allCode.filter(([n]) => n.startsWith('web:'))) {
    assert.ok(!/<input\b/.test(code), `${name} must not render a bare <input> — use <Field>/<SearchField>`);
    assert.ok(!/<button\b/.test(code), `${name} must not render a bare <button> — use <Button>`);
  }
});

test('mobile screens compose from shipped design-system widgets (AC-9)', () => {
  for (const [key, src] of Object.entries(mobile)) {
    assert.match(
      src,
      /import '\.\.\/\.\.\/design_system\/components\/components\.dart'/,
      `${key} screen must import the components barrel`,
    );
  }
  assert.ok(mobile.pick.includes('AppCardVariant.teal'), 'the match card must use AppCardVariant.teal');
  assert.ok(mobile.pick.includes('AppCustomerTypeChip'), 'the match card must show the customer-type chip');
  assert.ok(mobile.pick.includes('AppBannerTone.danger'), 'backend errors must render via AppBanner danger');
  assert.ok(mobile.pick.includes('AppFieldSize.large'), 'fields must use AppFieldSize.large');
  assert.ok(mobile.list.includes('AppEmptyState'), 'the list empty state must use AppEmptyState');
  assert.ok(mobile.list.includes('AppErrorState'), 'the list error state must use AppErrorState');
  assert.ok(mobile.list.includes('AppSkeleton'), 'the list loading state must use AppSkeleton');
  assert.ok(mobile.detail.includes('AppFrame'), 'the detail facts must sit in an AppFrame');
});

// (c) TRANSPORT ONLY THROUGH THE INJECTED PORT (AD-1/AD-2). A screen that opens its
// own socket is a screen that owns business logic — and the next person will put a
// rule in it.
test('no screen talks to the network directly — transport is the injected CustomersPort (AC-9)', () => {
  for (const [name, code] of allCode) {
    const banned = name.startsWith('web:')
      ? ['fetch(', 'axios', 'XMLHttpRequest']
      : ['package:http', 'package:dio', 'HttpClient'];
    for (const token of banned) {
      assert.ok(!code.includes(token), `${name} must not use ${token} — inject a CustomersPort`);
    }
    assert.match(code, /CustomersPort/, `${name} must take a CustomersPort`);
  }
});

// (d) OFFICE SCREENS ⇒ THEY LIVE IN THE SHELL, and the web nav is permission-filtered.
test('web customer screens render INSIDE the shell with a permission-filtered Sidebar (AC-10)', () => {
  for (const [key, src] of Object.entries(web)) {
    assert.match(src, /<WebShell/, `${key} screen must render inside <WebShell>`);
    assert.match(
      src,
      /<Sidebar\s+sections=\{filterNav\(SIDEBAR_NAV, perms\)\}/,
      `${key} screen must render a <Sidebar> filtered by the session perms`,
    );
    assert.match(src, /activeKey="customers"/, `${key} screen must mark the customers nav item active`);
    assert.match(src, /usePermissions\(\)/, `${key} screen must read the session via usePermissions()`);
  }
});

test('mobile customer screens render INSIDE the shell with the locked bottom-nav (AC-10)', () => {
  for (const [key, src] of Object.entries(mobile)) {
    assert.ok(src.includes('AppMobileShell'), `${key} screen must render inside AppMobileShell`);
    assert.ok(src.includes('AppBottomNav'), `${key} screen must render the bottom-nav (office screen)`);
  }
});

// (d.2) THE NAV ITEM IS GATED. A surface the account has no permission for must
// DISAPPEAR (UX-DR-22). Hiding it is UX only — the backend enforces every request
// regardless (AD-4) — but an ungated nav item is a link straight into a 403.
test('the Khách hàng sidebar link is gated by customers.manage (AC-8)', () => {
  const sidebar = read('web/src/design-system/shell/Sidebar.tsx');
  assert.match(
    sidebar,
    /\{\s*key:\s*'customers'[^}]*requires:\s*PERM\.customersManage[^}]*\}/,
    "SIDEBAR_NAV's `customers` link must declare requires: PERM.customersManage",
  );
  const perms = read('web/src/design-system/gating/permissions.ts');
  assert.match(perms, /customersManage:\s*'customers\.manage'/, 'PERM must declare customersManage');
});

// (e) PARITY (UX-DR-27): byte-identical Vietnamese labels across web ↔ mobile. The
// frame and the navigation differ; the words the user reads do not.
test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27)', () => {
  const labels = [
    // nav / topbar
    'KHÁCH HÀNG',
    'Khách hàng',
    'KHÁCH · CÁ NHÂN',
    'KHÁCH · THƯƠNG MẠI',
    // list
    'Tìm theo SĐT hoặc tên khách…',
    'Tất cả',
    'Cá nhân',
    'Thương mại',
    '+ Thêm khách',
    'Tên khách',
    'SĐT',
    'Loại khách',
    'Xem',
    // list states
    'Đang tải danh sách khách hàng…',
    'Chưa có khách hàng nào',
    'Thêm khách đầu tiên để bắt đầu tạo báo giá.',
    'Không tải được danh sách khách hàng.',
    'Thử lại',
    // pagination + search-empty (C-9)
    'Trước',
    'Sau',
    'Không có khách phù hợp',
    'Thử đổi từ khoá hoặc bỏ bớt bộ lọc.',
    // lookup
    'Tra cứu theo số điện thoại',
    'Khách cũ — trùng khớp',
    'Dùng khách này',
    'Không phải khách này? Tạo khách hàng mới →',
    // the empty result — the half of the feature that opens "create" (UX-DR-19)
    'SĐT chưa có trong hệ thống.',
    'Tạo khách hàng mới',
    // create form
    'Họ tên',
    'Tên đơn vị',
    'CCCD',
    'MST',
    'Địa chỉ',
    'Tài khoản NH',
    'Nguồn khách',
    '— Chọn nguồn —',
    'Ghi rõ nguồn',
    'Lưu khách hàng',
    'Huỷ',
    // detail
    'Thông tin khách',
    'Sửa',
    'SĐT (khoá chính)',
  ];
  for (const label of labels) {
    assert.ok(webAll.includes(label), `web customer screens are missing the label "${label}"`);
    assert.ok(mobileAll.includes(label), `mobile customer screens are missing the label "${label}"`);
  }
});

// (e.2) THE EMPTY RESULT IS NOT A DEAD END. EXPERIENCE.md forbids "Không tìm thấy
// kết quả" by name: a lookup that finds nothing must offer the way forward, because
// creating the customer right there IS the feature.
test('the empty phone lookup offers the way forward, and never says "Không tìm thấy kết quả"', () => {
  for (const [name, src] of [['web', web.pick], ['mobile', mobile.pick]]) {
    assert.ok(src.includes('SĐT chưa có trong hệ thống.'), `${name} pick screen must state the exact empty copy`);
    assert.ok(src.includes('Tạo khách hàng mới'), `${name} pick screen must offer inline creation`);
    assert.ok(
      !src.includes('Không tìm thấy kết quả'),
      `${name} pick screen must not use the forbidden dead-end copy (EXPERIENCE.md §Voice and Tone)`,
    );
  }
});

// (e.3) PAGINATION (C-9): the list pages through the BACKEND result set. It sends a
// page number to the port (never slices in memory), shows a byte-identical
// "Trang X/Y" indicator with Trước/Sau controls, and resets to page 1 on any new
// search or filter — page 3 of a stale query is meaningless. The search-empty state
// is separate from "no customers yet" (asserted in the byte-identical label list above).
test('the list screen paginates through the backend, never in memory (C-9)', () => {
  for (const [name, src] of [['web', web.list], ['mobile', mobile.list]]) {
    assert.ok(src.includes('Trang '), `${name} list must render the "Trang X/Y" page indicator`);
    assert.ok(src.includes('Trước') && src.includes('Sau'), `${name} list must render the Trước/Sau controls`);
  }
  // The page number is sent to the backend — the client does not paginate in memory (AD-1).
  assert.match(stripTsx(web.list), /port\.list\(\{[\s\S]*?\bpage\b[\s\S]*?\}\)/, 'web list must send `page` to port.list');
  assert.match(stripDart(mobile.list), /port\.list\([\s\S]*?page:\s*_page/, 'mobile list must send `page:` to port.list');
  // A new search or filter must return to page 1.
  assert.match(stripTsx(web.list), /setPage\(1\)/, 'web list must reset to page 1 on a new search/filter');
  assert.match(stripDart(mobile.list), /_page = 1/, 'mobile list must reset to page 1 on a new search/filter');
});

// (f) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens (UX-DR-4).
test('no ad-hoc shadow/gradient/elevation, radius via tokens (Viền nét, UX-DR-4)', () => {
  assert.ok(!/box-shadow/i.test(css), 'customers.css must contain 0 box-shadow');
  assert.ok(!/gradient/i.test(css), 'customers.css must contain 0 gradient');
  assert.ok(!/drop-shadow/i.test(css), 'customers.css must contain 0 drop-shadow');
  assert.ok(!/filter:/i.test(css), 'customers.css must contain 0 filter:');
  assert.ok(!/\b9{3,4}px\b/.test(css), 'customers.css must not hardcode a pill radius (use var(--radius-full))');
  for (const decl of assertScanned(css.match(/border-radius:[^;]+;/g) ?? [], 1, 'customers border-radius declarations')) {
    assert.match(decl, /var\(--radius/, `customers.css radius must come from a token: ${decl}`);
  }
  for (const [name, src] of Object.entries(mobile)) {
    assert.ok(!/BoxShadow/.test(src), `${name} screen must contain 0 BoxShadow`);
    assert.ok(!/elevation/i.test(src), `${name} screen must contain 0 elevation`);
  }
});

// (g) NO PERMISSION LITERAL IN A SCREEN (AD-17). The registry is the single source;
// a hand-typed 'customers.manage' is a string that silently stops matching the day
// the registry changes.
test('no customer screen hardcodes a permission literal (AD-17)', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/;
  for (const [name, code] of allCode) {
    // Import specifiers are dropped first: a same-directory Dart import
    // (`import 'customer_pick_screen.dart';`) is quoted `word.word` and is
    // shaped exactly like a registry key, but it is a FILE PATH. Scanning it
    // would fail every mobile screen for a rule it does not break.
    const body = code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '');
    assert.ok(!registryLike.test(body), `${name} must not hardcode a permission literal`);
  }
});

// (h.1) 🔴 NEGATIVE ASSERT — NO ORDER DATA ANYWHERE (AC-7). `Order` does not exist
// until Story 4.1. The mockup draws a "Số đơn" column, an order history and a
// "+ Tạo đơn mới" button; all three would render numbers no table can back.
// Rendering "0 đơn" is the UI telling the user something it cannot know.
test('no screen renders order data — Order does not exist until Story 4.1 (AC-7)', () => {
  const forbidden = ['Số đơn', 'Lịch sử đơn', 'Tạo đơn mới', 'Xem tất cả'];
  for (const [name, code] of allCode) {
    for (const phrase of forbidden) {
      assert.ok(!code.includes(phrase), `${name} must not contain "${phrase}" — no order data exists in Epic 3 (AC-7)`);
    }
    assert.ok(!/orderCount|\borders\//.test(code), `${name} must not read order data or import from orders/`);
  }
});

// (h.2) 🔴 NEGATIVE ASSERT — THE CLIENT NEVER TOUCHES A PHONE NUMBER (AC-2, AD-9).
// One normaliser exists, and it lives in the backend domain. A regex here — even a
// "harmless" one that only decides whether to enable a button — is a SECOND opinion
// about what a valid phone is, and the day the two disagree is the day one human
// becomes two customer records.
test('no screen normalises, validates or reformats a phone number (AC-2, AD-9)', () => {
  for (const [name, code] of allCode) {
    assert.ok(!/RegExp\(/.test(code), `${name} must not build a RegExp — phone rules live on the backend (AD-9)`);
    assert.ok(!/\.replace\(/.test(code), `${name} must not .replace() — it must send the phone string RAW`);
    assert.ok(!/\+84/.test(code), `${name} must not know about the +84 country code — the backend owns E.164`);
    assert.ok(!/\/\^.*\$\//.test(code), `${name} must not contain a regex literal (phone validation is server-side)`);
    // A length/prefix check IS a validation rule. The client may not decide whether a
    // number is "long enough" — that judgement belongs to libphonenumber, on the server.
    assert.ok(
      !/(sdt|phone)[\w.]*\.length\s*[<>=]/i.test(code),
      `${name} must not length-check a phone number — the backend decides validity (AD-9)`,
    );
  }
});

// ---------------------------------------------------------------------------
// The fact list is where AC-6 lives, and nothing above this line reads it.
// ---------------------------------------------------------------------------

/** The `dl.kv` fact list of ONE customer, on each platform — the surface AC-6 governs. */
const webFacts = web.pick.slice(
  web.pick.indexOf('export function CustomerFacts'),
  web.pick.indexOf('export function orDash'),
);
const mobileFacts = mobile.pick.slice(
  mobile.pick.indexOf('class CustomerFacts'),
  mobile.pick.indexOf('class _MicroLabel'),
);
const count = (haystack, needle) => haystack.split(needle).length - 1;

// (i) 🔴 NEGATIVE ASSERT — EACH TYPE SEES ONLY ITS OWN FIELDS (AC-6). A Cá nhân has
// no MST and no bank account; a Thương mại has no CCCD — the backend rejects those
// combinations outright (400, "field lạc loại khách"). Rendering the other type's
// row, even blank, tells the user a field exists for them when it cannot.
//
// Each label must appear EXACTLY ONCE and INSIDE the type branch: an extra
// unconditional copy would render for both types while the guarded one still exists,
// which is precisely the shape a careless edit leaves behind.
test('the fact list renders only the fields the customer type actually has (AC-6)', () => {
  for (const [name, facts] of [['web', webFacts], ['mobile', mobileFacts]]) {
    assert.ok(facts.length > 0, `${name} fact list not found — did CustomerFacts get renamed?`);
    for (const label of ['MST', 'CCCD', 'Tài khoản NH']) {
      assert.equal(
        count(facts, `'${label}'`) + count(facts, `>${label}<`),
        1,
        `${name} fact list must mention "${label}" exactly once — an unconditional second copy renders it for BOTH types (AC-6)`,
      );
    }
  }

  // The discriminator itself: MST and CCCD sit on OPPOSITE branches of the same test.
  assert.match(
    webFacts,
    /commercial \?[\s\S]*?<dt>MST<\/dt>[\s\S]*?\) : \([\s\S]*?<dt>CCCD<\/dt>/,
    'web: MST and CCCD must be the two branches of the custType test — never both rendered (AC-6)',
  );
  assert.match(
    webFacts,
    /\{commercial && \([\s\S]*?<dt>Tài khoản NH<\/dt>/,
    'web: the bank account row must be gated on the commercial branch — a Cá nhân has none (AC-6)',
  );
  assert.match(
    mobileFacts,
    /if \(commercial\)[\s\S]{0,120}'MST'[\s\S]{0,60}else[\s\S]{0,120}'CCCD'/,
    'mobile: MST and CCCD must be the two branches of the custType test — never both rendered (AC-6)',
  );
  assert.match(
    mobileFacts,
    /if \(commercial\)\s*_kv\('Tài khoản NH'/,
    'mobile: the bank account row must be gated on the commercial branch — a Cá nhân has none (AC-6)',
  );
});

// (j) 🔴 NEGATIVE ASSERT — "GHI RÕ NGUỒN" IS DECIDED BY THE FLAG, NOT BY THE NAME
// (AC-4/AC-6). Story 3.5 lets an admin rename a source. A screen that asks
// `name === 'Khác'` stops asking the right question the moment someone edits that
// label — and the required note silently stops being required.
//
// The literal is matched WITH ITS QUOTES on purpose: bare `Khác` is a substring of
// `Khách`, and every screen says `Khách hàng`.
test('the "Ghi rõ nguồn" row keys off the isOther FLAG, never off the source name (AC-4)', () => {
  for (const [name, code] of allCode) {
    assert.ok(
      !/['"]Khác['"]/.test(code),
      `${name} must not compare a source to the literal 'Khác' — read the isOther flag the backend sends`,
    );
  }
  for (const [name, facts] of [['web', webFacts], ['mobile', mobileFacts]]) {
    assert.match(facts, /isOther/, `${name} fact list must decide "Ghi rõ nguồn" from the isOther flag`);
  }
  assert.match(web.pick, /isOther/, 'the web create form must show "Ghi rõ nguồn" from the isOther flag');
  assert.match(mobile.pick, /isOther/, 'the mobile create form must show "Ghi rõ nguồn" from the isOther flag');
});

// (k) AN EMPTY NULLABLE FIELD SHOWS `—`, NOT `null` AND NOT A MISSING ROW (AC-6).
// The row staying is the information: "this customer has no address" is a fact the
// user needs. Dropping `orDash` on one field is how a raw `null` reaches the screen.
test('every nullable fact renders through the em-dash fallback (AC-6)', () => {
  // The web reads the generated contract names (Story 10.4); the mobile twin keeps its
  // older client names until its own wiring story (10.7). This one-way table is the ONLY
  // place the two may differ — delete it when mobile renames. Every entry must be used.
  const WEB_TO_MOBILE_FIELD = { nationalId: 'cccd' };
  const mapped = new Set();
  for (const [name, facts] of [['web', webFacts], ['mobile', mobileFacts]]) {
    for (const contractField of ['taxCode', 'nationalId', 'address', 'bankAccount', 'sourceNote']) {
      const field =
        name === 'mobile' && Object.hasOwn(WEB_TO_MOBILE_FIELD, contractField)
          ? (mapped.add(contractField), WEB_TO_MOBILE_FIELD[contractField])
          : contractField;
      assert.match(
        facts,
        new RegExp(`orDash\\(\\s*customer\\.${field}`),
        `${name}: customer.${field} is nullable — it must render through orDash() or a raw null reaches the user (AC-6)`,
      );
    }
    assert.match(facts, /orDash\(\s*source\??\.?\??\.name/, `${name}: the source name is nullable on screen too`);
  }
  assert.deepEqual([...mapped], Object.keys(WEB_TO_MOBILE_FIELD), 'every WEB_TO_MOBILE_FIELD entry must be used');
});

// (l) THE SCREENS ACTUALLY CALL THE PORT. Every rule above is satisfied by a screen
// that imports CustomersPort and then renders a hardcoded array — which is exactly
// what a "3 states, not 3 hardcoded variants" AC (AC-5) forbids. Name the calls.
test('each screen reaches the backend through the port method it needs (AC-5, AC-9)', () => {
  const required = {
    'web:pick': [/port\.lookup\(/, /port\.create\(/, /port\.listSources\(/],
    'web:list': [/port\.list\(/],
    'web:detail': [/port\.get\(/, /port\.listSources\(/],
    'mobile:pick': [/port\.lookup\(/, /port\.create\(/, /port\.listSources\(/],
    'mobile:list': [/port\.list\(/],
    'mobile:detail': [/port\.get\(/, /port\.listSources\(/],
  };
  for (const [name, code] of allCode) {
    for (const call of required[name]) {
      assert.match(code, call, `${name} must call ${call.source} — a screen with baked-in data is not a screen (AC-5)`);
    }
  }
});

// (m) THE PHONE LOOKUP FIRES ON AN EXPLICIT ACTION, NOT PER KEYSTROKE (story decision
// #4). The client may not judge whether a half-typed number is "long enough" (AD-9),
// so a per-key lookup sends `0`, `09`, `090`… — a 400 per character.
test('the phone lookup fires on submit, never on every keystroke (AD-9)', () => {
  assert.ok(
    !/onChange[^\n]{0,120}lookup/i.test(stripTsx(web.pick)),
    'web: lookup must not fire from the field onChange — bind it to the form submit',
  );
  assert.ok(
    !/onChanged[^\n]{0,120}lookup/i.test(stripDart(mobile.pick)),
    'mobile: lookup must not fire from onChanged — bind it to the Tra cứu button',
  );
  assert.match(web.pick, /onSubmit=\{handleLookup\}/, 'web: the lookup must be a form submit (button / Enter)');
  assert.match(mobile.pick, /onPressed: _lookup/, 'mobile: the lookup must be the Tra cứu button');
});

// (n) THE EPIC-4 SEAM. `onSelect(customer)` is the whole API this story leaves behind:
// Story 4.1 passes the real callback. A screen that navigates instead has hardcoded a
// destination that does not exist yet (AC-4, AC-7).
test('the pick screen hands the chosen customer back via onSelect — it does not navigate (AC-4)', () => {
  assert.match(web.pick, /onSelect\?\.\(created\)/, 'web: a freshly created customer must come back through onSelect');
  assert.match(web.pick, /onClick=\{\(\) => onSelect\?\.\(/, 'web: "Dùng khách này" must call onSelect');
  assert.match(mobile.pick, /widget\.onSelect\?\.call\(created\)/, 'mobile: a freshly created customer must come back through onSelect');
  assert.match(mobile.pick, /onPressed: \(\) => widget\.onSelect\?\.call\(customer\)/, 'mobile: "Dùng khách này" must call onSelect');
});

// Anti-empty (E-7): the "must not contain" checks above scan these sources; if a stripper/reader
// ever returned (near-)empty text they would all pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ...allCode], 1000, 'customers');
});
