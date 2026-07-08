// Cross-platform parity guard for the session seam (Story 2.6, Task 6 — AC-5,
// UX-DR-27 "same concept on web + mobile"). The session layer is a shared CONCEPT
// with a per-platform impl: web session/ (port + mapping + provider/hook) ↔
// mobile session/ (port + mapping + provider/scope). This asserts the twin
// exists on both sides, the /me→PermissionSet mapping is symmetric, and both
// platforms derive their keys from the SAME registry. Mirrors
// components/parity.test.mjs.
//
// Surface ownership (session layer): gating stays UX-only (AD-4); the registry is
// backend-owned (AD-17); both provider impls only map the `/me` payload (AD-1/2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/session -> repo root
const webDir = resolve(repoRoot, 'web/src/design-system/session');
const mobDir = resolve(repoRoot, 'mobile/lib/design_system/session');

test('the session module ships on BOTH platforms (twin files)', () => {
  const parityFiles = {
    'me-port.ts': 'me_port.dart',
    'session.ts': 'app_session.dart',
    'PermissionsProvider.tsx': 'app_session.dart', // provider lives with mapping on mobile
    'fake-me-port.ts': 'fake_me_port.dart',
    'SessionGatingExample.tsx': 'app_session_gating_example.dart',
    'index.ts': 'session.dart',
  };
  for (const [web, mob] of Object.entries(parityFiles)) {
    assert.ok(existsSync(resolve(webDir, web)), `web session missing ${web}`);
    assert.ok(existsSync(resolve(mobDir, mob)), `mobile session missing ${mob}`);
  }
});

test('/me → PermissionSet mapping is symmetric (both build a Set from permissions)', () => {
  const webSession = readFileSync(resolve(webDir, 'session.ts'), 'utf8');
  const mobSession = readFileSync(resolve(mobDir, 'app_session.dart'), 'utf8');
  assert.match(webSession, /new Set<PermissionKey>\(me\.permissions\)/, 'web toPermissionSet must build a Set from me.permissions');
  assert.match(mobSession, /me\.permissions\.toSet\(\)/, 'mobile toPermissionSet must build a Set from me.permissions');
  // Both expose the same three-state lifecycle.
  assert.ok(webSession.includes("'loading'") && webSession.includes("'ready'") && webSession.includes("'error'"), 'web must expose loading/ready/error');
  assert.ok(mobSession.includes('SessionStatus') && mobSession.includes('loading') && mobSession.includes('ready') && mobSession.includes('error'), 'mobile must expose loading/ready/error');
});

test('both platforms derive permission keys from the SAME registry (AD-17)', () => {
  // The generated key files (byte-checked in permissions/permission-keys.test.mjs)
  // exist on both sides — the single registry-derived source.
  assert.ok(existsSync(resolve(repoRoot, 'web/src/design-system/gating/permission-keys.generated.ts')), 'web generated key file missing');
  assert.ok(existsSync(resolve(repoRoot, 'mobile/lib/design_system/gating/app_permission_keys.g.dart')), 'mobile generated key file missing');
});

test('mobile production session files never reference demoPermissions (stub off the real path, parity with web session.test.mjs (c))', () => {
  // Web guards this on its side (session.test.mjs test (c)); the mobile twin was
  // missing, so AC-1 ("stub removed from the real path") was only half-enforced
  // and the parity was asymmetric. The demo payload lives in the fake port; every
  // OTHER session file must read the provider/scope, never the demoPermissions
  // stub. Comments may NAME the stub to explain the migration — strip them first
  // and assert no code reference survives.
  const stripDart = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const productionFiles = [
    'me_port.dart',
    'app_session.dart',
    'app_session_gating_example.dart',
    'session.dart',
  ];
  for (const file of productionFiles) {
    const code = stripDart(readFileSync(resolve(mobDir, file), 'utf8'));
    assert.ok(!/\bdemoPermissions\b/.test(code), `${file} must NOT reference demoPermissions in code (read the PermissionsScope instead, AC-1)`);
  }
});

test('mobile bottom-nav stays hard-locked — the session example never gates its 5 tabs (UX-DR-15)', () => {
  // Gating wires into the Menu list + revenue surface, NEVER the locked 5-tab
  // bottom nav. Guards against a future dev pulling the scope into the tabs.
  const example = readFileSync(resolve(mobDir, 'app_session_gating_example.dart'), 'utf8');
  assert.ok(!example.includes('AppBottomNav'), 'the session example must not touch AppBottomNav (5 tabs are locked, UX-DR-15)');
  const botnav = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/shell/app_bottom_nav.dart'), 'utf8');
  assert.ok(botnav.includes('_tabs.length == 5'), 'bottom-nav must keep its 5-tab lock assertion');
});
