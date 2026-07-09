// Source-guard + parity for the Hồ sơ screen (Story 2.8 — AC-2/AC-3).
//
// Mirrors screens/login.test.mjs. Unlike the auth screens, Hồ sơ is an OFFICE
// screen: it renders INSIDE the app shell (web Sidebar / mobile bottom-nav). It is
// composed from shipped components, reaches the backend only through the injected
// PasswordPort, reads identity from the session provider (never a second `/me`
// fetch), and keeps byte-identical Vietnamese labels web↔mobile (UX-DR-27).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_TSX = resolve(repoRoot, 'web/src/screens/account/ProfileScreen.tsx');
const WEB_CSS = resolve(repoRoot, 'web/src/screens/account/profile.css');
const MOBILE_DART = resolve(repoRoot, 'mobile/lib/screens/account/profile_screen.dart');

const web = readFileSync(WEB_TSX, 'utf8');
const css = readFileSync(WEB_CSS, 'utf8');
const mobile = readFileSync(MOBILE_DART, 'utf8');

const stripDart = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('both platform screens exist (parity coverage, AC-3)', () => {
  assert.ok(existsSync(WEB_TSX), 'web/src/screens/account/ProfileScreen.tsx must exist');
  assert.ok(existsSync(MOBILE_DART), 'mobile/lib/screens/account/profile_screen.dart must exist');
});

// (a) COMPOSE from the design-system (AD-13). The mockup's `notecard`/`kv` are
// composed from Banner/Card + tokens — NOT added as new components.
test('web ProfileScreen composes from design-system components (AC-3)', () => {
  for (const name of ['Banner', 'Button', 'Card', 'Field', 'Frame']) {
    assert.match(
      web,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `ProfileScreen.tsx must import ${name} from design-system/components`,
    );
  }
  assert.ok(web.includes('size="lg"'), 'fields must use Field size="lg"');
  assert.ok(web.includes('variant="primary"'), 'submit must use Button variant="primary"');
  assert.ok(web.includes('variant="ghost"'), 'cancel must use Button variant="ghost"');
  assert.ok(web.includes('variant="teal"'), 'identity block must use Card variant="teal"');
  assert.ok(web.includes('type="password"'), 'all three password fields must be type="password"');
  assert.ok(web.includes('tone="danger"'), 'errors must render via <Banner tone="danger">');
  assert.ok(web.includes('tone="info"'), 'the policy/audit notice must render via <Banner tone="info">');
  assert.match(web, /label="Đổi mật khẩu"/, 'the change block must be a <Frame label="Đổi mật khẩu">');
  const code = stripTsx(web);
  assert.ok(!/<input\b/.test(code), 'must not render a bare <input> — use <Field>');
  assert.ok(!/<button\b/.test(code), 'must not render a bare <button> — use <Button>');
});

test('mobile profile_screen composes from design-system widgets (AC-3)', () => {
  assert.match(
    mobile,
    /import '\.\.\/\.\.\/design_system\/components\/components\.dart'/,
    'profile_screen.dart must import the components barrel',
  );
  assert.ok(mobile.includes('AppFieldSize.large'), 'must use AppFieldSize.large');
  assert.ok(mobile.includes('AppButtonVariant.primary'), 'must use AppButtonVariant.primary');
  assert.ok(mobile.includes('AppButtonVariant.ghost'), 'cancel must use AppButtonVariant.ghost');
  assert.ok(mobile.includes('AppCardVariant.teal'), 'identity block must use AppCardVariant.teal');
  assert.ok(mobile.includes('AppBannerTone.danger'), 'errors must render via AppBanner danger');
  assert.ok(mobile.includes('AppBannerTone.info'), 'the policy/audit notice must use AppBanner info');
  assert.match(mobile, /AppFrame\(\s*label: 'Đổi mật khẩu'/, "the change block must be an AppFrame(label: 'Đổi mật khẩu')");
  // All three password fields mask their input (parity with web type="password").
  assert.equal((mobile.match(/obscureText: true/g) ?? []).length, 3, 'all three password fields must set obscureText:true');
});

// (b) TRANSPORT ONLY THROUGH THE PORT (mirror MePort, Story 2.6).
test('neither screen talks to the network directly — transport is the injected port', () => {
  const webCode = stripTsx(web);
  for (const banned of ['fetch(', 'axios', 'XMLHttpRequest']) {
    assert.ok(!webCode.includes(banned), `ProfileScreen.tsx must not use ${banned} — inject a PasswordPort`);
  }
  assert.match(web, /PasswordPort/, 'ProfileScreen.tsx must take a PasswordPort');

  const mobileCode = stripDart(mobile);
  for (const banned of ['package:http', 'package:dio', 'HttpClient']) {
    assert.ok(!mobileCode.includes(banned), `profile_screen.dart must not use ${banned} — inject a PasswordPort`);
  }
  assert.match(mobile, /PasswordPort/, 'profile_screen.dart must take a PasswordPort');
});

// (c) OFFICE SCREEN = SHELL (the inverse of the auth screens' UX-DR-15 rule).
test('web profile renders INSIDE the shell with a permission-filtered Sidebar', () => {
  assert.match(web, /<Sidebar\s+sections=\{filterNav\(SIDEBAR_NAV, perms\)\}/, 'must render a <Sidebar> filtered by the session perms');
  assert.ok(!web.includes('sidebar={null}'), 'the profile screen is NOT an auth screen — it keeps its nav');
});

test('mobile profile renders INSIDE the shell with the locked bottom-nav', () => {
  assert.ok(mobile.includes('AppMobileShell'), 'must render inside AppMobileShell');
  assert.ok(mobile.includes('AppBottomNav'), 'must render the bottom-nav (office screen)');
  assert.match(mobile, /activeIndex: _menuTabIndex/, 'the Menu tab must be the active one');
  assert.match(mobile, /_menuTabIndex = 4/, 'Menu is index 4 of the locked 5 tabs');
});

// (d) IDENTITY COMES FROM THE SESSION PROVIDER. It already fetched /me — a second
// call is waste, and a hand-rolled one would drift from the contract.
test('identity is read from the session provider, not re-fetched', () => {
  assert.match(web, /usePermissions\(\)/, 'ProfileScreen.tsx must read usePermissions()');
  assert.match(web, /\bme\?\.displayName\b/, 'ProfileScreen.tsx must render me.displayName');
  assert.match(web, /\bme\?\.email\b/, 'ProfileScreen.tsx must render me.email');
  assert.match(mobile, /PermissionsScope\.of\(context\)/, 'profile_screen.dart must read from PermissionsScope.of(context)');
  assert.match(mobile, /\.me\b/, 'profile_screen.dart must read .me from the session scope (no re-fetch)');
  for (const [name, src] of [['web', web], ['mobile', mobile]]) {
    assert.ok(!/fetchMe\(/.test(src), `${name} profile screen must not call fetchMe() again`);
  }
});

// (d.2) ONLY REAL /me FIELDS RENDER. Vai trò / SĐT / Đăng nhập gần nhất do not exist
// as stored data (Role is a creation-time preset, not truth — AD-8). Rendering them
// would be a lie the UI cannot back up.
test('no field is rendered that /me does not actually return', () => {
  for (const [name, src] of [['web', stripTsx(web)], ['mobile', stripDart(mobile)]]) {
    for (const absent of ['Vai trò', 'SĐT', 'Đăng nhập gần nhất', 'Tài khoản']) {
      assert.ok(!src.includes(absent), `${name} profile must not render "${absent}" — that data does not exist (Epic 8)`);
    }
  }
});

// (e) PARITY (UX-DR-27): byte-identical Vietnamese labels, including validation copy.
test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27)', () => {
  const labels = [
    'TÀI KHOẢN',
    'Hồ sơ',
    'Tên hiển thị',
    'Email',
    'Trạng thái',
    'Đang hoạt động',
    'Đổi mật khẩu',
    'Mật khẩu hiện tại',
    'Nhập mật khẩu hiện tại',
    'Mật khẩu mới',
    'Nhập mật khẩu mới',
    'Xác nhận mật khẩu mới',
    'Nhập lại mật khẩu mới',
    'Tối thiểu 8 ký tự, có chữ và số. Đổi mật khẩu sẽ ghi vào Audit log.',
    'Huỷ',
    'Cập nhật mật khẩu',
    'Đã đổi mật khẩu. Bạn cần đăng nhập lại.',
    'Nhập mật khẩu hiện tại.',
    'Mật khẩu tối thiểu 8 ký tự, có chữ và số.',
    'Xác nhận mật khẩu không khớp.',
    'Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại.',
  ];
  for (const label of labels) {
    assert.ok(web.includes(label), `ProfileScreen.tsx missing label "${label}"`);
    assert.ok(mobile.includes(label), `profile_screen.dart missing label "${label}"`);
  }
});

// (e.2) The screen must TELL the user the change is audited and that it ends every
// session — both are true (AD-8 audit via event; all sessions revoked server-side).
test('the screen states that changing the password is audited and ends sessions', () => {
  for (const [name, src] of [['web', web], ['mobile', mobile]]) {
    assert.ok(src.includes('Đổi mật khẩu sẽ ghi vào Audit log.'), `${name} must state the change is audited`);
    assert.ok(src.includes('Bạn cần đăng nhập lại.'), `${name} must state that every session is revoked`);
  }
});

// (f) VIỀN NÉT — no ad-hoc elevation/shadow/gradient, radius via tokens.
test('no ad-hoc shadow/gradient/elevation, radius via tokens (Viền nét, UX-DR-4)', () => {
  assert.ok(!/box-shadow/i.test(css), 'profile.css must contain 0 box-shadow');
  assert.ok(!/gradient/i.test(css), 'profile.css must contain 0 gradient');
  assert.ok(!/drop-shadow/i.test(css), 'profile.css must contain 0 drop-shadow');
  assert.ok(!/filter:/i.test(css), 'profile.css must contain 0 filter:');
  assert.ok(!/\b9{3,4}px\b/.test(css), 'profile.css must not hardcode a pill radius (use var(--radius-full))');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `profile.css radius must come from a token: ${decl}`);
  }
  assert.ok(!/BoxShadow/.test(mobile), 'profile_screen.dart must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(mobile), 'profile_screen.dart must contain 0 elevation');
});

// (g) No permission literal leaks into the screen — keys are registry-derived (AD-17).
test('the profile screen hardcodes no permission literal (AD-17)', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/;
  assert.ok(!registryLike.test(stripTsx(web)), 'ProfileScreen.tsx must not hardcode a permission literal');
  assert.ok(!registryLike.test(stripDart(mobile)), 'profile_screen.dart must not hardcode a permission literal');
});
