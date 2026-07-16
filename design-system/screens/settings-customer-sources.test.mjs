// Source-guard for the Cấu hình nguồn khách screen (Story 3.5 — AC-7, AC-8, AC-9, AC-10).
//
// THIS FILE IS THE STORY'S REAL TEST FOR THE WEB HALF. The web app still has no
// tsc/bundler/JSDOM (TD-1), so this screen gets NO typecheck and NO runtime test.
// What stands between a wrong `.tsx` and "done" is this guard and a human review —
// nothing else. It is written to be strict on purpose.
//
// The screen is WEB-ONLY by name (DESIGN.md): the one business screen with no mobile
// twin. That is why there is no parity half here, and it is not an oversight.
//
// Nine groups: (a) the screen exists · (b) composed from the design-system barrel ·
// (c) port-only transport · (d) shell + permission-filtered sidebar · (e) the copy is
// byte-identical to the story's SSOT table · (f) Viền nét · (g) no permission literal ·
// (h) the two NEGATIVE asserts: no VAT tab, no switch-off path on the flagged row ·
// (i) switching off goes through ConfirmDialog.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const SCREEN = 'web/src/screens/settings/CustomerSourceConfigScreen.tsx';
const CSS = 'web/src/screens/settings/settings.css';
const PORT = 'web/src/design-system/session/customer-sources-port.ts';
const FAKE_PORT = 'web/src/design-system/session/fake-customer-sources-port.ts';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const src = read(SCREEN);
const css = read(CSS);

/** Comment-stripped screen — the surface every "must not appear" rule scans. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// (a) THE SCREEN AND ITS PORT SHIP.
test('the config screen, its CSS and its port all exist (AC-7, AC-9)', () => {
  for (const rel of [SCREEN, CSS, PORT, FAKE_PORT]) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

// (b) COMPOSE FROM THE DESIGN-SYSTEM (AD-13). No new components, no bare elements.
test('the screen composes from shipped design-system components (AC-7)', () => {
  for (const name of [
    'Banner',
    'Button',
    'ConfirmDialog',
    'Dialog',
    'EmptyState',
    'ErrorState',
    'Field',
    'Frame',
    'Skeleton',
    'Table',
  ]) {
    assert.match(
      src,
      new RegExp(`import[^;]*\\b${name}\\b[^;]*from '\\.\\./\\.\\./design-system/components'`),
      `CustomerSourceConfigScreen.tsx must import ${name} from design-system/components`,
    );
  }
  // Bare form controls mean an unstyled, ungoverned surface — that is what the
  // component library exists to prevent.
  assert.ok(!/<input\b/.test(code), 'the screen must not render a bare <input> — use <Field>');
  assert.ok(!/<button\b/.test(code), 'the screen must not render a bare <button> — use <Button>');
  assert.ok(!/<select\b/.test(code), 'the screen needs no <select>: isOther is not settable and active goes through Tắt/Bật lại');
  // A hand-rolled modal would duplicate the focus trap / Esc handling that Dialog
  // already ships — and would drift from it.
  assert.ok(!/className="scrim"/.test(code), 'the screen must not hand-build a modal — use <Dialog>/<ConfirmDialog>');
});

// (c) TRANSPORT ONLY THROUGH THE INJECTED PORT (AD-1/AD-2).
test('the screen never talks to the network directly — transport is the injected port (AC-9)', () => {
  for (const token of ['fetch(', 'axios', 'XMLHttpRequest']) {
    assert.ok(!code.includes(token), `the screen must not use ${token} — inject a CustomerSourcesPort`);
  }
  assert.match(code, /CustomerSourcesPort/, 'the screen must take a CustomerSourcesPort');
});

// (c.2) IT ACTUALLY CALLS THE PORT. Every other rule here is satisfied by a screen
// that imports the port and then renders a hardcoded array — which is precisely what
// a "3 real states, not 3 hand-built variants" AC forbids. Name the calls.
test('the screen reaches the backend through all five port methods (AC-1..AC-4, AC-7)', () => {
  for (const call of [
    /port\.list\(true\)/, // the config screen must see switched-off rows — it is where they come back
    /port\.create\(/,
    /port\.update\(/,
    /port\.deactivate\(/,
    /port\.reactivate\(/,
  ]) {
    assert.match(code, call, `the screen must call ${call.source} — a screen with baked-in data is not a screen`);
  }
});

// (c.3) THE CLIENT DECIDES NO BUSINESS RULE (AD-1). `sortOrder` when the box is left
// empty is computed by the SERVER (max + 1). A client that counts the rows and sends
// its own number is a second authority on ordering — and it is wrong the moment two
// admins add a source at once.
test('the screen does not compute sortOrder itself — an empty box OMITS the field (AD-1)', () => {
  assert.match(
    code,
    /sortOrder\s*=\s*form\.sortOrder\.trim\(\) === ''\s*\?\s*undefined\s*:/,
    'an empty "Thứ tự" box must send `undefined` (backend appends), never 0 and never a client-computed max+1',
  );
  assert.ok(
    !/rows\.length\s*\+\s*1|Math\.max\([^)]*sortOrder/.test(code),
    'the screen must not compute a sort order from the rows it happens to be holding (AD-1)',
  );
});

// (d) OFFICE SCREEN ⇒ IT LIVES IN THE SHELL, and the web nav is permission-filtered.
test('the screen renders INSIDE the shell with a permission-filtered Sidebar (AC-7, AC-8)', () => {
  assert.match(src, /<WebShell/, 'the screen must render inside <WebShell>');
  assert.match(
    src,
    /<Sidebar\s+sections=\{filterNav\(SIDEBAR_NAV, perms\)\}/,
    'the screen must render a <Sidebar> filtered by the session perms',
  );
  assert.match(src, /activeKey="settings"/, 'the screen must mark the settings nav item active');
  assert.match(src, /usePermissions\(\)/, 'the screen must read the session via usePermissions()');
});

// (d.2) THE NAV ITEM IS GATED AND SITS IN THE RIGHT PLACE. A surface the account has
// no permission for must DISAPPEAR (UX-DR-22) — no grey button, no 403 screen.
test('the Cấu hình sidebar link is gated by settings.manage, in the Quản trị section (AC-8)', () => {
  const sidebar = read('web/src/design-system/shell/Sidebar.tsx');
  assert.match(
    sidebar,
    /\{\s*key:\s*'settings'[^}]*requires:\s*PERM\.settingsManage[^}]*\}/,
    "SIDEBAR_NAV's `settings` link must declare requires: PERM.settingsManage",
  );
  // Above Phân quyền, below Kho — the order the shell-behaviour guard pins.
  assert.ok(
    sidebar.indexOf("key: 'inventory'") < sidebar.indexOf("key: 'settings'") &&
      sidebar.indexOf("key: 'settings'") < sidebar.indexOf("key: 'permissions'"),
    'the Cấu hình link must sit between Kho and Phân quyền',
  );
  const perms = read('web/src/design-system/gating/permissions.ts');
  assert.match(perms, /settingsManage:\s*'settings\.manage'/, 'PERM must declare settingsManage');
  // KEY parity is required even though SCREEN parity is not (the mobile drift-guard
  // deepEquals both key lists, in order).
  const appPerms = read('mobile/lib/design_system/gating/app_permissions.dart');
  assert.match(
    appPerms,
    /settingsManage\s*=\s*'settings\.manage'/,
    'mobile AppPerm must declare settingsManage too — parity of KEYS, not of screens',
  );
});

// (e) THE COPY IS THE CONTRACT. The story's copy table is the SSOT (the mockup draws
// no dialogs at all); these strings are what the user reads, and they are pinned
// byte-for-byte so a "small wording tweak" is a visible decision, not a silent drift.
test('every Vietnamese label is byte-identical to the story copy table (AC-7, AC-10)', () => {
  const labels = [
    // topbar / nav
    'CẤU HÌNH HỆ THỐNG',
    'Nguồn khách hàng',
    '+ Thêm nguồn',
    // banner + frame
    'Mỗi nguồn có một câu mô tả để sale phân biệt lúc nhập',
    'Đổi tên nguồn được ghi Audit.',
    'Danh mục nguồn · thứ tự hiện trên form',
    // table columns
    'Tên nguồn',
    'Mô tả cho người nhập',
    'Trạng thái',
    'Thao tác',
    // status + flag chip
    'Đang dùng',
    'Đã tắt',
    'Cờ "Khác"',
    // row actions
    'Sửa',
    'Tắt',
    'Bật lại',
    'Khoá',
    // form dialog
    'Thêm nguồn khách',
    'Sửa nguồn khách',
    'Thứ tự hiện trên form',
    'Lưu',
    'Huỷ',
    // confirm dialog
    'Tắt nguồn khách?',
    'Khách cũ vẫn giữ nguồn này. Nguồn sẽ không còn hiện trên form tạo khách.',
    'Tắt nguồn',
    // list states
    'Đang tải danh mục nguồn khách…',
    'Chưa có nguồn khách nào',
    'Không tải được danh mục nguồn khách.',
    'Thử lại',
  ];
  for (const label of labels) {
    assert.ok(src.includes(label), `the config screen is missing the label "${label}"`);
  }
});

// (e.2) THE THREE PORT STATES ARE REAL, AND THE RETRY BUTTON IS WIRED. `ErrorState`
// only renders its button when it gets an `onRetry` — passing `retryLabel` alone
// renders a label with nothing behind it. That exact dead button was a HIGH finding in
// the 3.4 review; it is cheap to reintroduce and invisible without this assert.
test('loading / empty / error are the three states of the PORT, and Thử lại is really wired (AC-7)', () => {
  assert.match(code, /state === 'loading'[\s\S]{0,200}<Skeleton/, 'loading must render <Skeleton>');
  assert.match(code, /rows\.length === 0[\s\S]{0,200}<EmptyState/, 'empty must render <EmptyState>');
  assert.match(
    code,
    /<ErrorState[\s\S]{0,200}onRetry=\{load\}/,
    'the error state must pass onRetry={load} — a retry button with no handler is a lie',
  );
});

// (e.3) BACKEND ERRORS ARE SHOWN IN THE BACKEND'S WORDS (AD-5). The client owns none
// of these rules ("name taken", "cannot switch off the flagged row"), so it owns no
// words for them: a message invented here is a second opinion that goes stale.
test('backend refusals render the server message + pin fieldErrors (AD-5)', () => {
  assert.match(code, /<Banner tone="danger"[\s\S]{0,120}\{error\.message\}/, 'a backend error must render its own message in a danger Banner');
  assert.match(code, /fieldErrors\?\.find\(/, 'fieldErrors must be pinned to the matching input');
});

// (e.4) THE REFUSAL MUST BE WHERE THE USER IS LOOKING. A <Dialog> paints over a fixed,
// dimming .scrim and carries aria-modal="true". A danger Banner rendered in the PAGE
// body while a dialog is open therefore sits BEHIND the scrim and OUTSIDE the modal's
// accessibility tree: invisible to eyes and to screen readers both. The user sees a
// button that did nothing, and clicks it again. Two rules keep the message reachable:
// the form dialog carries its own copy of the banner, and the page-level banner is
// suppressed while that dialog is open (so the message never renders only-behind-glass).
test('a backend refusal is never rendered behind a modal scrim (AC-7)', () => {
  assert.match(
    code,
    /error !== null && form === null/,
    'the page-level danger Banner must be suppressed while the form dialog is open, or it renders behind the scrim',
  );
  // Inside the dialog body there must be a danger Banner of its own.
  const dialogBody = code.slice(code.indexOf('<Dialog'), code.indexOf('</Dialog>'));
  assert.match(
    dialogBody,
    /<Banner tone="danger"[\s\S]{0,120}\{error\.message\}/,
    'the form Dialog must render the backend message INSIDE the modal — outside it is behind the scrim',
  );
});

// (e.5) ConfirmDialog renders ONLY its `consequence` — it has no surface for a refusal.
// So a failed deactivate (409, network) raised while it is open would have nowhere to
// show. It must close BEFORE the call, which both lands the message on the page banner
// and removes the button that a frustrated admin would otherwise double-click.
test('the confirm closes BEFORE the deactivate call fires (AC-7)', () => {
  const onConfirm = code.slice(code.indexOf('onConfirm={'), code.indexOf('onCancel={'));
  assert.ok(
    onConfirm.indexOf('setConfirming(null)') < onConfirm.indexOf('port.deactivate'),
    'setConfirming(null) must run BEFORE port.deactivate — ConfirmDialog cannot show a refusal',
  );
});

// (e.6) NO DOUBLE-SUBMIT, AND NO NaN REACHING THE PORT. Two clicks on Lưu fire create()
// twice with one name: the second returns 409 and tells the admin the name is taken on
// the very screen where they just took it. And `inputMode="numeric"` is a soft-keyboard
// HINT, not a filter — a real keyboard types "3a" ⇒ Number() ⇒ NaN ⇒ JSON null ⇒ a 400
// nobody can explain. Neither is a business rule; both are hygiene the screen owns.
test('Lưu is disabled in-flight and sortOrder can never become NaN (AC-7)', () => {
  assert.match(code, /onClick=\{save\}\s+disabled=\{busy\}/, 'Lưu must be disabled while a mutation is in flight');
  assert.match(
    code,
    /sortOrder: e\.target\.value\.replace\(\/\\D\/g, ''\)/,
    'the sortOrder box must keep digits only, so Number() cannot yield NaN',
  );
});

// (f) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens (UX-DR-4).
test('no ad-hoc shadow/gradient/elevation, radius via tokens (Viền nét, UX-DR-4)', () => {
  assert.ok(!/box-shadow/i.test(css), 'settings.css must contain 0 box-shadow');
  assert.ok(!/gradient/i.test(css), 'settings.css must contain 0 gradient');
  assert.ok(!/drop-shadow/i.test(css), 'settings.css must contain 0 drop-shadow');
  assert.ok(!/filter:/i.test(css), 'settings.css must contain 0 filter:');
  assert.ok(!/\b9{3,4}px\b/.test(css), 'settings.css must not hardcode a pill radius (use var(--radius-full))');
  for (const decl of css.match(/border-radius:[^;]+;/g) ?? []) {
    assert.match(decl, /var\(--radius/, `settings.css radius must come from a token: ${decl}`);
  }
});

// (g) NO PERMISSION LITERAL IN A SCREEN (AD-17). The registry is the single source; a
// hand-typed 'settings.manage' silently stops matching the day the registry changes.
test('the screen hardcodes no permission literal (AD-17)', () => {
  const body = code.replace(/^\s*(?:import|export)\s+[^;]+;/gm, '');
  assert.ok(
    !/['"][a-z_]+\.[a-z_]+['"]/.test(body),
    'the screen must not hardcode a permission literal — gate through PERM/filterNav',
  );
});

// (h.1) THE VAT SURFACE ARRIVED WITH ITS STORY (4.4, FR-3) — the 3.5-era negative
// assert ("no VAT tab") retired WITH the story that ships the feature. What remains
// deliberate: NO Tabs bar — the design-system has no Tabs component (AD-13), so the
// VAT section is a separate Frame BELOW the source table, not the mockup's tab.
test('the VAT-rate section ships as a Frame (Story 4.4) — still no Tabs bar', () => {
  // The section exists: label + Lưu button + both port calls.
  assert.ok(src.includes('Thuế suất VAT'), 'the screen must render the "Thuế suất VAT" section (FR-3, Story 4.4)');
  assert.ok(src.includes('Thuế suất hiện hành:'), 'the section must show the CURRENT effective rate');
  assert.ok(src.includes('Thuế suất mới (%)'), 'the section must offer the edit box');
  assert.match(code, /settingsPort\.getVatRate\(\)/, 'the screen must load the rate through settingsPort.getVatRate()');
  assert.match(code, /settingsPort\s*[\s\S]{0,30}?\.updateVatRate\(/, 'Lưu must write through settingsPort.updateVatRate()');
  // The rate travels through the injected SettingsPort — never a hardcoded value:
  // the displayed number must come from state the port filled.
  assert.match(code, /\{vatRate === null \? '—' : `\$\{vatRate\}%`\}/, 'the current rate must render from port-filled state with a "—" fallback');
  // Still no Tabs — a deliberate deviation from the mockup (no Tabs component, AD-13).
  assert.ok(!/<Tabs\b/.test(code), 'the screen must not render a Tabs bar — the VAT section is a Frame, not a tab (AD-13)');
  // Input hygiene mirrors sortOrder: digits only, so Number() cannot yield NaN.
  assert.match(code, /setVatText\(e\.target\.value\.replace\(\/\\D\/g, ''\)\)/, 'the rate box must keep digits only');
  // In-flight discipline mirrors Lưu: no double-submit.
  assert.match(code, /disabled=\{vatBusy \|\| vatText\.trim\(\) === ''\}/, 'Lưu (VAT) must be disabled in flight and on an empty box');
});

// (h.2) 🔴 NEGATIVE ASSERT — THE FLAGGED ROW HAS AN EDIT PATH BUT NO SWITCH-OFF PATH
// (AC-2, AC-3). This is the hinge of the whole design:
//   · Renaming it MUST stay possible — the backend recognises "Khác" by its FLAG, so
//     the label is free to change and the Story 3.3 `sourceNote` rule survives it.
//   · Switching it off MUST NOT be offered — every out-of-list customer falls into that
//     row, and without it the "chọn Khác ⇒ bắt buộc sourceNote" rule has nothing to fire on.
// The backend answers 409 either way (AD-4); this asserts the UI does not invite the
// refusal in the first place.
test('the isOther row keeps Sửa but is never offered a way to switch off (AC-2, AC-3)', () => {
  // The flag is read off the row, never matched against the name — a screen that asks
  // `name === 'Khác'` stops asking the right question the moment an admin renames it.
  assert.match(code, /row\.isOther/, 'the screen must read the isOther FLAG off the row');
  assert.ok(
    !/['"]Khác['"]\s*(===|==|!==)|(===|==|!==)\s*['"]Khác['"]/.test(code),
    "the screen must not compare a source name to the literal 'Khác' — read the flag",
  );
  // The flagged branch offers a DISABLED button and nothing else; the switch-off and
  // switch-on calls both live in the branches the flag has already excluded.
  assert.match(
    code,
    /row\.isOther \?[\s\S]{0,260}disabled[\s\S]{0,40}Khoá/,
    'the isOther row must render the disabled Khoá button, not an active switch-off',
  );
  // The flagged branch ends where the `active` ternary begins — slicing past it would
  // sweep in the Tắt branch that the flag has ALREADY excluded, and fail for the wrong reason.
  const flaggedBranch = code.slice(code.indexOf('row.isOther ?'), code.indexOf('row.active ?'));
  assert.ok(
    !/port\.deactivate\(|setConfirming\(row\)/.test(flaggedBranch),
    'the isOther branch must contain NO switch-off path — not even one guarded by a condition',
  );
  // …and Sửa stays alive for every row, including that one: it is rendered before the
  // flag is ever consulted.
  assert.ok(
    code.indexOf('Sửa') < code.indexOf('row.isOther ?'),
    'the Sửa button must render for EVERY row, before the isOther branch — renaming the flagged row is allowed on purpose',
  );
});

// (i) SWITCHING A SOURCE OFF ASKS FIRST (EXPERIENCE §State Patterns: a destructive
// action gets a confirm that STATES THE CONSEQUENCE). It changes what every future
// customer form offers — it is not a bare one-click.
test('Tắt goes through ConfirmDialog and states the consequence (AC-7)', () => {
  assert.match(code, /<ConfirmDialog/, 'switching off must go through <ConfirmDialog>');
  assert.match(
    code,
    /consequence="Khách cũ vẫn giữ nguồn này\. Nguồn sẽ không còn hiện trên form tạo khách\."/,
    'the confirm must state the consequence verbatim',
  );
  // The deactivate call must be reachable ONLY from the confirm's onConfirm — a Tắt
  // button wired straight to the port would skip the dialog entirely while the dialog
  // still sits in the file looking like it does something.
  assert.ok(
    !/onClick=\{\(\)\s*=>\s*(void\s*)?mutate\(\(\)\s*=>\s*port\.deactivate/.test(code),
    'the Tắt button must open the confirm, never call port.deactivate directly',
  );
  assert.match(
    code,
    /onConfirm=\{[\s\S]{0,240}port\.deactivate\(/,
    'port.deactivate must be called from the ConfirmDialog onConfirm',
  );
});
