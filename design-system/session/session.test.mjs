// Source-guard for the web session seam (Story 2.6, Task 6 — AC-1/2/3/5). Web
// has no tsc/runtime build (web/ is source-only, project-context defers
// web-runtime), so — like gating.test.mjs — this reads the session sources as
// TEXT and asserts the non-negotiable contracts: the port + mapping + provider
// exist, the mapping is `permissions[] → Set`, the provider exposes
// loading/ready/error, production consumers read the provider (NOT the
// DEMO_PERMISSIONS stub), the stub survives only in the fake port, and gating is
// documented as UX-only (AD-4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCodeNotBlind, assertScanned } from '../lib/assert-scanned.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/session -> repo root
const sessionDir = resolve(repoRoot, 'web/src/design-system/session');

const read = (rel) => readFileSync(resolve(sessionDir, rel), 'utf8');
const mePort = read('me-port.ts');
const sessionTs = read('session.ts');
const provider = read('PermissionsProvider.tsx');
const hook = read('use-permissions.ts');
const example = read('SessionGatingExample.tsx');
const fakePort = read('fake-me-port.ts');
const barrel = read('index.ts');

const stripTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// (a) The seam exists: MePort (one method `fetchMe`), a MeResponse matching the
// /me contract, and a pure `toPermissionSet` mapping permissions[] → Set.
test('(a) session module ships MePort + MeResponse + toPermissionSet(perms[] → Set)', () => {
  assert.match(mePort, /interface MePort\s*\{[\s\S]*fetchMe\(\)\s*:\s*Promise<MeResponse>/, 'MePort must declare fetchMe(): Promise<MeResponse>');
  // MeResponse mirrors MeResponseDto { id, email, displayName, permissions: string[] }.
  for (const field of ['id', 'email', 'displayName', 'permissions']) {
    assert.ok(mePort.includes(field), `MeResponse must carry the ${field} field (/me contract)`);
  }
  assert.match(mePort, /permissions:\s*string\[\]/, 'MeResponse.permissions must be string[]');
  assert.match(sessionTs, /toPermissionSet\([^)]*\)\s*:\s*PermissionSet/, 'toPermissionSet must return a PermissionSet');
  assert.match(sessionTs, /new Set<PermissionKey>\(me\.permissions\)/, 'toPermissionSet must map me.permissions into a Set');
});

// (b) The provider exposes the minimal loading/ready/error state + a usePermissions
// hook that re-exports the SAME orderScope selector (signature unchanged).
test('(b) provider exposes loading/ready/error; hook exposes perms + orderScope', () => {
  assert.match(sessionTs, /'loading'\s*\|\s*'ready'\s*\|\s*'error'/, 'SessionStatus must be loading|ready|error');
  assert.ok(provider.includes('createContext') && provider.includes('usePermissionsContext'), 'PermissionsProvider must expose a React context');
  assert.ok(provider.includes("status: 'ready'") && provider.includes("status: 'error'"), 'provider must set ready + error states');
  // hook returns the derived orderScope from the SAME primitive (Story 1.10).
  assert.match(hook, /import\s*\{\s*orderScope\s*\}\s*from\s*'\.\.\/gating\/permissions'/, 'hook must reuse the gating orderScope primitive (not reimplement it)');
  assert.match(hook, /orderScope:\s*orderScope\(perms\)/, 'usePermissions must expose orderScope(perms)');
});

// (c) Production consumers read the PROVIDER, not the DEMO_PERMISSIONS stub. The
// stub (and the demo payload) live only in the fake port. AC-1: "stub removed
// from the real path."
test('(c) production session files never import DEMO_PERMISSIONS (stub is off the real path)', () => {
  // Scan CODE only (strip comments) — a comment may name the stub to explain the
  // migration; what must not survive is an actual import/reference.
  for (const [name, code] of [
    ['me-port.ts', stripTs(mePort)],
    ['session.ts', stripTs(sessionTs)],
    ['PermissionsProvider.tsx', stripTs(provider)],
    ['use-permissions.ts', stripTs(hook)],
    ['SessionGatingExample.tsx', stripTs(example)],
  ]) {
    assert.ok(!code.includes('DEMO_PERMISSIONS'), `${name} must NOT reference DEMO_PERMISSIONS in code (read the provider instead)`);
    assert.ok(!/\bdemoPermissions\b/.test(code), `${name} must NOT reference demoPermissions in code`);
  }
  // The compose point reads the provider hook + filters nav by its perms.
  assert.ok(example.includes('usePermissions()'), 'the compose point must read usePermissions()');
  assert.match(example, /filterNav\(SIDEBAR_NAV,\s*perms\)/, 'the compose point must filter the nav by the provider perms');
  assert.match(example, /requires=\{PERM\.dashboardFinanceView\}/, 'the revenue Gate must require PERM.dashboardFinanceView');
  // The error branch must use the real ErrorState contract (`message`, not a
  // stray `title` prop — web has no tsc to catch a wrong prop name).
  assert.match(example, /<ErrorState\s+message=/, 'the error state must pass ErrorState a `message` (its required prop)');
});

// (d) The fake port is clearly TEST/DEMO-ONLY and is the only place carrying the
// demo permission payload (mirror the Epic 1 demo manager shape).
test('(d) fake port is marked TEST/DEMO-ONLY and carries the demo payload', () => {
  assert.match(fakePort, /TEST\/DEMO[- ]ONLY/i, 'fake-me-port.ts must be marked TEST/DEMO-ONLY');
  assert.ok(fakePort.includes("'orders.view_all'") && fakePort.includes("'permissions.manage'"), 'demo payload must model the manager (all orders + manage, no audit)');
  assert.ok(!fakePort.includes("'audit.read'"), 'demo payload must NOT include audit.read (Audit stays gated out, parity with Story 1.10)');
  assert.match(barrel, /TEST\/DEMO[- ]ONLY/i, 'the barrel must flag the fake-port re-export as test/demo-only');
});

// (e) Gating is documented as UX-only (AD-4) across the seam, and the layer runs
// no business logic (AD-1/2) — comments must say so on the port + mapping.
test('(e) AD-4 (UX-only) + AD-1/2 (no business logic) are documented on the seam', () => {
  for (const [name, code] of [['me-port.ts', mePort], ['session.ts', sessionTs], ['PermissionsProvider.tsx', provider]]) {
    assert.ok(code.includes('AD-4'), `${name} must cite AD-4 (backend enforces; gating is UX only)`);
  }
  assert.ok(sessionTs.includes('AD-1/2') || provider.includes('AD-1/2'), 'the mapping/provider must cite AD-1/2 (no business logic, no DB)');
});

// (f) No permission-string literal leaks into the session layer — keys come from
// PERM (registry-derived). Only me-port.ts (the contract-shape doc) and the fake
// port (test payload) may carry raw permission strings.
test('(f) session logic uses named keys, not raw permission literals (AD-17)', () => {
  const registryLike = /['"][a-z_]+\.[a-z_]+['"]/; // e.g. 'orders.view_all'
  for (const [name, code] of [
    ['session.ts', stripTs(sessionTs)],
    ['PermissionsProvider.tsx', stripTs(provider)],
    ['use-permissions.ts', stripTs(hook)],
    ['SessionGatingExample.tsx', stripTs(example)],
  ]) {
    assert.ok(!registryLike.test(code), `${name} must not hardcode a permission literal — use PERM.* (AD-17)`);
  }
});

// Anti-empty (E-7): the negative scans in this file read these stripped sources; if a stripper/reader
// ever returned (near-)empty text they would pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('session scans are not blind — stripped production files keep real code', () => {
  assertCodeNotBlind(
    [
      ['me-port.ts', stripTs(mePort)],
      ['session.ts', stripTs(sessionTs)],
      ['PermissionsProvider.tsx', stripTs(provider)],
      ['use-permissions.ts', stripTs(hook)],
      ['SessionGatingExample.tsx', stripTs(example)],
    ], 70,
    'session',
  );
});
