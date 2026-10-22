// Source-guard + parity for the Đăng nhập screen (Story 1.11 — AC-1/2/3).
//
// The login screen is the FIRST consumer of the design-system: it must be
// composed from shipped components (never re-drawn), carry NO auth nav (UX-DR-15),
// and stay in parity web↔mobile down to byte-identical Vietnamese labels
// (UX-DR-27). Web has no React runtime/tsc in the repo (like Stories 1.3–1.10),
// so the .tsx is guarded as text — same convention as shell-web.test.mjs. Mobile
// correctness is additionally covered by a Flutter widget test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../lib/strip-comments.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_TSX = resolve(repoRoot, 'web/src/screens/auth/LoginScreen.tsx');
const WEB_CSS = resolve(repoRoot, 'web/src/screens/auth/login.css');
const MOBILE_DART = resolve(repoRoot, 'mobile/lib/screens/auth/login_screen.dart');

const web = readFileSync(WEB_TSX, 'utf8');
const css = readFileSync(WEB_CSS, 'utf8');
const mobile = readFileSync(MOBILE_DART, 'utf8');

// (a) COMPOSE from design-system (AC-1): the screen imports the shipped
// components and uses the canonical size/variant strings — never bare
// <input>/<button> (gotcha #1).
test('web LoginScreen composes from design-system components (AC-1)', () => {
  for (const name of ['Field', 'Button', 'Card', 'Banner']) {
    assert.match(
      web,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `LoginScreen.tsx must import ${name} from design-system/components`,
    );
  }
  assert.match(
    web,
    /import \{ Icon \} from '\.\.\/\.\.\/design-system\/icons\/Icon'/,
    'LoginScreen.tsx must import Icon from design-system/icons/Icon',
  );
  // Canonical Field size + Button variant/size (UX-DR-9 field-lg + primary wide).
  assert.ok(web.includes('size="lg"'), 'LoginScreen.tsx must use Field size="lg" (field-lg)');
  assert.ok(web.includes('variant="primary"'), 'LoginScreen.tsx must use Button variant="primary"');
  assert.ok(web.includes('size="wide"'), 'LoginScreen.tsx must use Button size="wide"');
  // The password field masks input (AC-2).
  assert.ok(web.includes('type="password"'), 'LoginScreen.tsx password field must be type="password"');
  // Error region uses Banner danger, not a hand-rolled div (gotcha #8).
  assert.ok(web.includes('tone="danger"'), 'LoginScreen.tsx must show errors via <Banner tone="danger">');
});

// (a.2) VALIDATE (AC-2): sign-in is by phone since 10.9 and the client never judges
// a number's format (AD-9) — only emptiness is checked locally, so the old email
// regex and its message must be gone.
test('web LoginScreen validates emptiness only — no email format check (AC-2, AD-9)', () => {
  assert.ok(
    web.includes('Nhập đủ số điện thoại và mật khẩu.'),
    'LoginScreen.tsx must show the empty-field message',
  );
  // Positive anchor on mobile too, so the absence checks below can't pass on an empty read.
  assert.ok(
    mobile.includes('Nhập đủ số điện thoại và mật khẩu.'),
    'login_screen.dart must show the empty-field message',
  );
  for (const [name, src] of [['web', web], ['mobile', mobile]]) {
    assert.ok(!src.includes('Tài khoản phải là email hợp lệ.'), `${name} login must not keep the email-format message`);
    assert.ok(!src.includes('@[^@'), `${name} login must not keep an email regex`);
  }
});

// (a.3) The phone field: tel input + tel autocomplete on web, phone keyboard on mobile;
// no email input left anywhere on the screen.
test('the sign-in identifier is a phone field on both platforms (10.9)', () => {
  assert.ok(web.includes('type="tel"'), 'LoginScreen.tsx phone field must be type="tel"');
  assert.ok(web.includes('autoComplete="tel"'), 'LoginScreen.tsx phone field must set autoComplete="tel"');
  assert.ok(!web.includes('type="email"'), 'LoginScreen.tsx must not keep an email input');
  assert.ok(mobile.includes('TextInputType.phone'), 'login_screen.dart phone field must use TextInputType.phone');
  assert.ok(!mobile.includes('TextInputType.emailAddress'), 'login_screen.dart must not keep the email keyboard');
});

test('mobile login_screen composes from design-system widgets (AC-1)', () => {
  assert.match(
    mobile,
    /import '\.\.\/\.\.\/design_system\/components\/components\.dart'/,
    'login_screen.dart must import the components barrel',
  );
  assert.ok(mobile.includes('AppFieldSize.large'), 'login_screen.dart must use AppFieldSize.large');
  assert.ok(mobile.includes('AppButtonVariant.primary'), 'login_screen.dart must use AppButtonVariant.primary');
  assert.ok(mobile.includes('wide: true'), 'login_screen.dart must use AppButton wide:true');
  assert.ok(mobile.includes('AppBannerTone.danger'), 'login_screen.dart must show errors via AppBanner danger');
  // Password masking parity with web type="password" (gotcha #4).
  assert.ok(mobile.includes('obscureText: true'), 'login_screen.dart password field must set obscureText:true');
});

// (b) AUTH = NO NAV (UX-DR-15). Web uses WebShell with sidebar={null} and never
// imports Sidebar; mobile wraps AppPhoneFrame directly and never pulls in the
// mobile shell / topbar / bottom-nav.
test('web auth screen renders no nav — sidebar={null}, no Sidebar (UX-DR-15)', () => {
  assert.ok(web.includes('sidebar={null}'), 'LoginScreen.tsx must pass sidebar={null} to WebShell');
  assert.ok(!/\bSidebar\b/.test(web.replace(/sidebar=\{null\}/g, '')), 'LoginScreen.tsx must not import or render <Sidebar>');
});

test('mobile auth screen renders no nav — no AppMobileShell/Topbar/BottomNav (UX-DR-15)', () => {
  assert.ok(mobile.includes('AppPhoneFrame'), 'login_screen.dart must wrap content in AppPhoneFrame');
  const stripDart = stripComments;
  const code = stripDart(mobile);
  for (const banned of ['app_mobile_shell', 'AppMobileShell', 'AppBottomNav', 'AppTopbar']) {
    assert.ok(!code.includes(banned), `login_screen.dart must not use ${banned} (auth = no nav)`);
  }
});

// (c) PARITY (UX-DR-27): both files exist and carry byte-identical Vietnamese
// labels. Diacritics/casing drift is the classic failure (gotcha #7).
test('both platform screens exist (parity coverage, AC-3)', () => {
  assert.ok(existsSync(WEB_TSX), 'web/src/screens/auth/LoginScreen.tsx must exist');
  assert.ok(existsSync(MOBILE_DART), 'mobile/lib/screens/auth/login_screen.dart must exist');
});

test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27)', () => {
  const labels = [
    'Đăng nhập',
    'Số điện thoại',
    'Mật khẩu',
    'Quên mật khẩu',
    'Phương Nam Solar',
    'Nhập số điện thoại',
    'Nhập mật khẩu',
    // Validation copy is user-facing too — it must not drift between platforms.
    'Nhập đủ số điện thoại và mật khẩu.',
  ];
  for (const label of labels) {
    assert.ok(web.includes(label), `LoginScreen.tsx missing label "${label}"`);
    assert.ok(mobile.includes(label), `login_screen.dart missing label "${label}"`);
  }
});

// (c.2) Field label/placeholder parity as EXACT attribute literals: a bare `includes` is
// fooled when one string is a prefix of another (placeholder vs. its validation copy).
test('field labels and placeholders match as exact literals on both platforms', () => {
  const fields = [
    ['label', 'Số điện thoại'],
    ['placeholder', 'Nhập số điện thoại'],
    ['label', 'Mật khẩu'],
    ['placeholder', 'Nhập mật khẩu'],
  ];
  for (const [attr, value] of fields) {
    assert.ok(web.includes(`${attr}="${value}"`), `LoginScreen.tsx must carry ${attr}="${value}"`);
    assert.ok(mobile.includes(`${attr}: '${value}'`), `login_screen.dart must carry ${attr}: '${value}'`);
  }
});

// (d) "Quên mật khẩu" link present on both (link only — s-forgot is Story 2.8).
test('forgot-password link present on both platforms (AC-1)', () => {
  assert.ok(web.includes('Quên mật khẩu'), 'LoginScreen.tsx must include a "Quên mật khẩu" link');
  assert.ok(mobile.includes('Quên mật khẩu'), 'login_screen.dart must include a "Quên mật khẩu" link');
});

// (e) VIỀN NÉT — no ad-hoc elevation/shadow/gradient anywhere (AD-13, UX-DR-4).
test('no ad-hoc shadow/gradient/elevation (Viền nét, UX-DR-4)', () => {
  assert.ok(!/box-shadow/i.test(css), 'login.css must contain 0 box-shadow');
  assert.ok(!/gradient/i.test(css), 'login.css must contain 0 gradient');
  assert.ok(!/drop-shadow/i.test(css), 'login.css must contain 0 drop-shadow');
  assert.ok(!/BoxShadow/.test(mobile), 'login_screen.dart must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(mobile), 'login_screen.dart must contain 0 elevation');
});

// Anti-empty (E-7): the "must not contain" checks above scan these sources; if a stripper/reader
// ever returned (near-)empty text they would all pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ['mobile', stripComments(mobile)]], 800, 'login');
});
