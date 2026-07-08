// Source-guard for the gating primitives (Story 1.10, Task 7 — AC-1/3). Web has
// no tsc/runtime build (web/ is source-only, like Stories 1.3–1.9), so — as with
// components.test.mjs — this reads the gating sources as TEXT and asserts the
// non-negotiable contracts: "missing permission ⇒ the surface DISAPPEARS" (never
// disabled/greyed), filterNav drops empty sections, the stub is marked as a
// placeholder (not the canonical registry), and the helpers stay key-agnostic.
// The same contracts are asserted on BOTH platforms (web + Flutter).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/components -> repo root

const webPerms = readFileSync(resolve(repoRoot, 'web/src/design-system/gating/permissions.ts'), 'utf8');
const webGate = readFileSync(resolve(repoRoot, 'web/src/design-system/gating/Gate.tsx'), 'utf8');
const webSidebar = readFileSync(resolve(repoRoot, 'web/src/design-system/shell/Sidebar.tsx'), 'utf8');
const mobPerms = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/gating/app_permissions.dart'), 'utf8');
const mobGate = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/gating/app_gate.dart'), 'utf8');

// Both files DOCUMENT the "no disabled/opacity" rule using those very words, so
// strip comments before any "must NOT contain" scan (same trick as
// shell-parity.test.mjs for toUpperCase).
const stripTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) => s.replace(/\/\/\/.*$/gm, '').replace(/\/\/.*$/gm, '');

// (a) Gate render-null: missing permission ⇒ render NOTHING, never a greyed
// control. Web returns `... : null`; Flutter returns `SizedBox.shrink()`.
test('(a) Gate renders null / shrink when permission missing — never disabled/greyed', () => {
  // web: can(...) ? <>{children}</> : null
  assert.match(webGate, /can\(perms,\s*requires\)\s*\?/, 'web Gate must branch on can(perms, requires)');
  assert.ok(/:\s*null/.test(webGate), 'web Gate must render `: null` when permission is missing');
  // flutter: can(...) ? child : const SizedBox.shrink()
  assert.match(mobGate, /can\(perms,\s*requires\)\s*\?/, 'AppGate must branch on can(perms, requires)');
  assert.ok(mobGate.includes('SizedBox.shrink()'), 'AppGate must render SizedBox.shrink() when missing');
  // No greying: neither Gate may disable / dim / block pointers (comments stripped).
  for (const [name, code] of [['web Gate', stripTs(webGate)], ['AppGate', stripDart(mobGate)]]) {
    assert.ok(!/disabled/i.test(code), `${name} must not use "disabled" (missing perm = hidden, not greyed)`);
    assert.ok(!/opacity/i.test(code), `${name} must not use "opacity"`);
    assert.ok(!/pointer-events|IgnorePointer|AbsorbPointer/i.test(code), `${name} must not block pointers`);
  }
});

// (b) filterNav drops orphan sections; orderScope returns 'all'/'mine'.
test("(b) filterNav drops empty sections + orderScope returns 'all'/'mine' (both platforms)", () => {
  for (const [name, code] of [['web permissions.ts', webPerms], ['app_permissions.dart', mobPerms]]) {
    assert.ok(/\.(filter|where)\(/.test(code), `${name} filterNav must filter links`);
    assert.ok(/links\.(length|isNotEmpty|isEmpty)/.test(code), `${name} filterNav must drop empty sections by link count`);
    assert.ok(code.includes("'all'") && code.includes("'mine'"), `${name} orderScope must return 'all'/'mine'`);
  }
});

// (c) Stub is marked as a placeholder, NOT the canonical registry (AD-17), and
// gating is documented as UX-only with the backend enforcing (AD-4). Guards
// against a future dev treating PERM/DEMO_PERMISSIONS as the source of truth.
test('(c) stub is marked placeholder (AD-17) + gating documented UX-only (AD-4) on both platforms', () => {
  for (const [name, code] of [['web permissions.ts', webPerms], ['app_permissions.dart', mobPerms]]) {
    assert.match(code, /STUB|placeholder/i, `${name} must mark the demo set as a stub/placeholder`);
    assert.ok(code.includes('registry'), `${name} must reference the canonical (backend) registry`);
    assert.ok(code.includes('AD-17'), `${name} must cite AD-17 (registry ownership)`);
    assert.ok(code.includes('AD-4'), `${name} must cite AD-4 (backend enforces; gating is UX only)`);
  }
});

// (d) key-agnostic: `can` is pure membership (.has / .contains), with NO
// hardcoded permission-string literal in the can/filterNav LOGIC (AD-17). The
// registry owns the strings; these helpers only compare.
test('(d) can is membership-only, no permission literal hardcoded in can/filterNav (AD-17)', () => {
  assert.ok(webPerms.includes('perms.has(key)'), 'web can() must be perms.has(key)');
  assert.ok(mobPerms.includes('perms.contains(key)'), 'mobile can() must be perms.contains(key)');
  // Extract the can(...) body on each platform and assert it holds no quoted string.
  const webCanBody = webPerms.match(/function can\([^)]*\):\s*boolean\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.ok(webCanBody.length > 0 && !/['"`]/.test(webCanBody), 'web can() body must contain no string literal');
  const mobCanBody = mobPerms.match(/bool can\([^)]*\)\s*=>([^;]*);/)?.[1] ?? '';
  assert.ok(mobCanBody.length > 0 && !/['"]/.test(mobCanBody), 'mobile can() body must contain no string literal');
  // Each permission string literal appears EXACTLY ONCE per platform — only in
  // the PERM/AppPerm registry stub, never re-hardcoded in helper logic
  // (filterNav/orderScope reference PERM.*, not the raw string). Guards AD-17
  // key-agnosticism at the whole-file level, not just the can() body.
  for (const literal of ["'orders.view_all'", "'audit.read'", "'permissions.manage'"]) {
    assert.equal(webPerms.split(literal).length - 1, 1, `web permissions.ts must hold ${literal} exactly once (registry only)`);
    assert.equal(mobPerms.split(literal).length - 1, 1, `app_permissions.dart must hold ${literal} exactly once (registry only)`);
  }
  // orderScope compares against the PERM reference, not a raw literal.
  assert.ok(webPerms.includes('PERM.ordersViewAll'), 'web orderScope must reference PERM.ordersViewAll (not a raw literal)');
  assert.ok(mobPerms.includes('AppPerm.ordersViewAll'), 'mobile orderScope must reference AppPerm.ordersViewAll (not a raw literal)');
});

// (e) Sidebar wiring: the "Audit hidden except Super Admin" contract (FR-20,
// UX-DR-22) is expressed as SIDEBAR_NAV data — Audit `requires` the audit-read
// permission, Phân quyền `requires` permissions-manage — and NavLink carries the
// optional `requires` field for filterNav to read. Guards that the gate keys are
// actually attached to the nav (not just declared in PERM).
test('(e) SIDEBAR_NAV gates Audit to auditRead (Super Admin) + Phân quyền to permissionsManage', () => {
  assert.match(webSidebar, /requires\?\s*:\s*PermissionKey/, 'NavLink must carry an optional `requires: PermissionKey` field');
  assert.match(
    webSidebar,
    /key:\s*'audit'[\s\S]*?requires:\s*PERM\.auditRead/,
    'SIDEBAR_NAV Audit link must require PERM.auditRead (Super Admin only, FR-20)',
  );
  assert.match(
    webSidebar,
    /key:\s*'permissions'[\s\S]*?requires:\s*PERM\.permissionsManage/,
    'SIDEBAR_NAV Phân quyền link must require PERM.permissionsManage',
  );
});

// (f) The demo/stub permission set DEMONSTRATES gating: it holds ordersViewAll +
// permissionsManage but NOT auditRead, so filterNav(SIDEBAR_NAV, demo) drops the
// Audit item — the concrete "Audit hidden for a non-Super-Admin" case. Asserted
// on both platforms so the stub sets stay in parity.
test('(f) demo permission set excludes auditRead (Audit gates out) but includes ordersViewAll + permissionsManage', () => {
  // web DEMO_PERMISSIONS body
  const webSet = webPerms.match(/DEMO_PERMISSIONS[\s\S]*?\[([\s\S]*?)\]/)?.[1] ?? '';
  assert.ok(webSet.includes('PERM.ordersViewAll'), 'web demo set must include ordersViewAll');
  assert.ok(webSet.includes('PERM.permissionsManage'), 'web demo set must include permissionsManage');
  assert.ok(!webSet.includes('auditRead'), 'web demo set must NOT include auditRead (Audit stays gated out)');
  // mobile demoPermissions body
  const mobSet = mobPerms.match(/demoPermissions\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.ok(mobSet.includes('AppPerm.ordersViewAll'), 'mobile demo set must include ordersViewAll');
  assert.ok(mobSet.includes('AppPerm.permissionsManage'), 'mobile demo set must include permissionsManage');
  assert.ok(!mobSet.includes('auditRead'), 'mobile demo set must NOT include auditRead (Audit stays gated out)');
});
