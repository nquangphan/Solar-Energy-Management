// Source-guard + parity for the Quên mật khẩu screen (Story 2.8 — AC-3).
//
// Mirrors screens/login.test.mjs. The screen must be composed from shipped
// components (never re-drawn), carry NO auth nav (UX-DR-15), reach the backend
// ONLY through the injected PasswordPort (no fetch/dio — the port is the seam),
// and stay in parity web↔mobile down to byte-identical Vietnamese labels
// (UX-DR-27). Web has no React runtime/tsc in the repo, so the .tsx is guarded as
// text; mobile correctness is additionally covered by a Flutter widget test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_TSX = resolve(repoRoot, 'web/src/screens/auth/ForgotPasswordScreen.tsx');
const WEB_CSS = resolve(repoRoot, 'web/src/screens/auth/forgot-password.css');
const MOBILE_DART = resolve(repoRoot, 'mobile/lib/screens/auth/forgot_password_screen.dart');

const web = readFileSync(WEB_TSX, 'utf8');
const css = readFileSync(WEB_CSS, 'utf8');
const mobile = readFileSync(MOBILE_DART, 'utf8');

const stripDart = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('both platform screens exist (parity coverage, AC-3)', () => {
  assert.ok(existsSync(WEB_TSX), 'web/src/screens/auth/ForgotPasswordScreen.tsx must exist');
  assert.ok(existsSync(MOBILE_DART), 'mobile/lib/screens/auth/forgot_password_screen.dart must exist');
});

// (a) COMPOSE from the design-system (AD-13): shipped components + canonical
// size/variant/tone strings — never bare <input>/<button>.
test('web ForgotPasswordScreen composes from design-system components (AC-3)', () => {
  for (const name of ['Banner', 'Button', 'Card', 'Field', 'Stepper']) {
    assert.match(
      web,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `ForgotPasswordScreen.tsx must import ${name} from design-system/components`,
    );
  }
  assert.ok(web.includes('size="lg"'), 'fields must use Field size="lg"');
  assert.ok(web.includes('variant="primary"'), 'submit must use Button variant="primary"');
  assert.ok(web.includes('size="wide"'), 'submit must use Button size="wide"');
  assert.ok(web.includes('type="password"'), 'password fields must be type="password"');
  assert.ok(web.includes('tone="danger"'), 'errors must render via <Banner tone="danger">');
  assert.ok(web.includes('tone="info"'), 'the code-sent notice must render via <Banner tone="info">');
  assert.ok(web.includes('role="alert"'), 'the error Banner must be role="alert" (a11y, UX-DR-26)');
  // No hand-rolled inputs/buttons (the whole point of AD-13).
  const code = stripTsx(web);
  assert.ok(!/<input\b/.test(code), 'must not render a bare <input> — use <Field>');
  assert.ok(!/<button\b/.test(code), 'must not render a bare <button> — use <Button>');
});

test('mobile forgot_password_screen composes from design-system widgets (AC-3)', () => {
  assert.match(
    mobile,
    /import '\.\.\/\.\.\/design_system\/components\/components\.dart'/,
    'forgot_password_screen.dart must import the components barrel',
  );
  assert.ok(mobile.includes('AppFieldSize.large'), 'must use AppFieldSize.large');
  assert.ok(mobile.includes('AppButtonVariant.primary'), 'must use AppButtonVariant.primary');
  assert.ok(mobile.includes('wide: true'), 'submit must use AppButton wide:true');
  assert.ok(mobile.includes('obscureText: true'), 'password fields must set obscureText:true');
  assert.ok(mobile.includes('AppBannerTone.danger'), 'errors must render via AppBanner danger');
  assert.ok(mobile.includes('AppBannerTone.info'), 'the code-sent notice must use AppBanner info');
  assert.ok(mobile.includes('AppStepper'), 'must render the shipped AppStepper');
});

// (b) TRANSPORT ONLY THROUGH THE PORT. A screen that reaches for fetch/dio owns a
// transport it must not own — there is no app-runtime, no token store, no envelope
// parser here. The port is the seam (mirror MePort, Story 2.6).
test('neither screen talks to the network directly — transport is the injected port', () => {
  const webCode = stripTsx(web);
  for (const banned of ['fetch(', 'axios', 'XMLHttpRequest']) {
    assert.ok(!webCode.includes(banned), `ForgotPasswordScreen.tsx must not use ${banned} — inject a PasswordPort`);
  }
  assert.match(web, /PasswordPort/, 'ForgotPasswordScreen.tsx must take a PasswordPort');

  const mobileCode = stripDart(mobile);
  for (const banned of ["package:http", "package:dio", 'HttpClient']) {
    assert.ok(!mobileCode.includes(banned), `forgot_password_screen.dart must not use ${banned} — inject a PasswordPort`);
  }
  assert.match(mobile, /PasswordPort/, 'forgot_password_screen.dart must take a PasswordPort');
});

// (b.2) THE CODE NEVER COMES BACK FROM THE PORT. If a screen ever reads a code out
// of a response, the backend leaked it and the whole reset flow is broken.
test('the screens never read a verification code out of a response', () => {
  assert.ok(!/requestResetCode\([^)]*\)[^;]*\.code\b/.test(web), 'web must not read a code from the port response');
  assert.ok(!/requestResetCode\([^)]*\)[^;]*\.code\b/.test(mobile), 'mobile must not read a code from the port response');
});

// (c) AUTH = NO NAV (UX-DR-15). Web: WebShell sidebar={null}, never a <Sidebar>.
// Mobile: AppPhoneFrame + a back Topbar, never the bottom-nav / mobile shell.
test('web auth screen renders no nav — sidebar={null}, no Sidebar (UX-DR-15)', () => {
  assert.ok(web.includes('sidebar={null}'), 'must pass sidebar={null} to WebShell');
  assert.ok(!/\bSidebar\b/.test(web.replace(/sidebar=\{null\}/g, '')), 'must not import or render <Sidebar>');
});

test('mobile auth screen renders no bottom-nav (UX-DR-15)', () => {
  assert.ok(mobile.includes('AppPhoneFrame'), 'must wrap content in AppPhoneFrame');
  const code = stripDart(mobile);
  for (const banned of ['app_mobile_shell', 'AppMobileShell', 'AppBottomNav']) {
    assert.ok(!code.includes(banned), `forgot_password_screen.dart must not use ${banned} (auth = no nav)`);
  }
  // A back-topbar IS allowed here (unlike Đăng nhập): it returns to login.
  assert.ok(code.includes('AppTopbar'), 'must render an AppTopbar with a back affordance to login');
});

// (d) COUNTDOWN CLEANUP. A surviving interval/Timer fires setState on a dead widget
// (and `flutter test` fails on a pending timer).
test('the resend countdown is torn down on unmount', () => {
  assert.ok(web.includes('clearInterval'), 'web countdown must clearInterval in the effect cleanup');
  assert.ok(mobile.includes('_timer?.cancel()'), 'mobile countdown must cancel its Timer');
  assert.match(mobile, /void dispose\(\)/, 'mobile screen must override dispose()');
});

// (e) PARITY (UX-DR-27): byte-identical Vietnamese labels. Diacritics/casing drift is
// the classic failure — including the validation copy the user actually reads.
test('Vietnamese labels are byte-identical on web and mobile (UX-DR-27)', () => {
  const labels = [
    'Quên mật khẩu',
    'Gửi mã',
    'Mã & mật khẩu mới',
    'Email đã đăng ký',
    'Nhập email đã đăng ký',
    'Mã xác thực',
    'Mật khẩu mới',
    'Nhập mật khẩu mới',
    'Xác nhận mật khẩu mới',
    'Nhập lại mật khẩu mới',
    'Đặt lại mật khẩu',
    'Quay lại đăng nhập',
    'Đã gửi mã 6 số đến ',
    '. Mã có hiệu lực 5 phút.',
    'Gửi lại mã sau ',
    // Validation + failure copy is user-facing too.
    'Nhập email đã đăng ký.',
    'Email không hợp lệ.',
    'Mã xác thực gồm đúng 6 chữ số.',
    'Mật khẩu tối thiểu 8 ký tự, có chữ và số.',
    'Xác nhận mật khẩu không khớp.',
    'Không gửi được mã. Thử lại sau.',
    'Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.',
  ];
  for (const label of labels) {
    assert.ok(web.includes(label), `ForgotPasswordScreen.tsx missing label "${label}"`);
    assert.ok(mobile.includes(label), `forgot_password_screen.dart missing label "${label}"`);
  }
});

// (e.2) ONE failure message for every reset branch — the backend refuses to say which
// branch failed (anti-enumeration); the UI must not invent a distinction either.
test('one generic failure message for every reset branch (anti-enumeration)', () => {
  const webMatches = web.match(/Không thể đặt lại mật khẩu\./g) ?? [];
  const mobileMatches = mobile.match(/Không thể đặt lại mật khẩu\./g) ?? [];
  assert.equal(webMatches.length, 1, 'web must carry exactly ONE reset-failure message');
  assert.equal(mobileMatches.length, 1, 'mobile must carry exactly ONE reset-failure message');
  // ...and it must not name a specific cause.
  for (const [name, src] of [['web', web], ['mobile', mobile]]) {
    assert.ok(!/mã đã hết hạn|mã đã dùng|email không tồn tại|tài khoản không tồn tại/i.test(src), `${name} must not reveal WHICH branch failed`);
  }
});

// (f) VIỀN NÉT — no ad-hoc elevation/shadow/gradient anywhere (AD-13, UX-DR-4), and
// no raw radius literals (radius comes from tokens).
test('no ad-hoc shadow/gradient/elevation, radius via tokens (Viền nét, UX-DR-4)', () => {
  assert.ok(!/box-shadow/i.test(css), 'forgot-password.css must contain 0 box-shadow');
  assert.ok(!/gradient/i.test(css), 'forgot-password.css must contain 0 gradient');
  assert.ok(!/drop-shadow/i.test(css), 'forgot-password.css must contain 0 drop-shadow');
  assert.ok(!/filter:/i.test(css), 'forgot-password.css must contain 0 filter:');
  assert.ok(!/\b9{3,4}px\b/.test(css), 'forgot-password.css must not hardcode a pill radius (use var(--radius-full))');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `forgot-password.css radius must come from a token: ${decl}`);
  }
  assert.ok(!/BoxShadow/.test(mobile), 'forgot_password_screen.dart must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(mobile), 'forgot_password_screen.dart must contain 0 elevation');
});

// (g) The login screen now EMITS the intent rather than faking a link (Story 2.8).
test('login screen hands off to the forgot screen via a callback, not an <a href="#">', () => {
  const loginWeb = readFileSync(resolve(repoRoot, 'web/src/screens/auth/LoginScreen.tsx'), 'utf8');
  const loginMobile = readFileSync(resolve(repoRoot, 'mobile/lib/screens/auth/login_screen.dart'), 'utf8');
  assert.match(loginWeb, /onForgotPassword/, 'LoginScreen.tsx must accept an onForgotPassword callback');
  assert.match(loginMobile, /widget\.onForgotPassword/, 'login_screen.dart must wire onTap to onForgotPassword');
  // Scan CODE only: a comment may quote the old `<a href="#">` / empty `onTap: () {}`
  // to explain why they are gone. What must not survive is the real thing.
  assert.ok(!/<a\s[^>]*href="#"/.test(stripTsx(loginWeb)), 'LoginScreen.tsx must not keep the dead <a href="#"> link');
  assert.ok(!/onTap:\s*\(\)\s*\{\s*\}/.test(stripDart(loginMobile)), 'login_screen.dart must not keep the empty onTap stub');
});
