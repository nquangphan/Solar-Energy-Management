// Drift-guard for the FE permission-key layer (Story 2.6, Task 1 — AC-4, AD-17).
//
// Closes the Epic 1 action item "verify PermissionKey/filterNav matches the
// registry enum before coding 2.6" — and makes drift IMPOSSIBLE to reintroduce:
//   1. the committed generated files match what build-permission-keys.mjs emits
//      from backend/openapi/permissions.json, byte-for-byte (regen discipline);
//   2. every named key the UI uses (PERM / AppPerm) is a key that exists in the
//      registry — a hand-typed value outside the registry fails here;
//   3. every SIDEBAR_NAV `requires` value is a registry key.
// FE gating, BE guard and the noti resolver therefore consume ONE key list.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRegistry, buildOutputs, OUT_PATHS } from './build-permission-keys.mjs';
import { stripComments } from '../lib/strip-comments.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/permissions -> repo root

const registry = loadRegistry();
const registryKeys = new Set(registry.map((p) => p.key));

const webPerms = readFileSync(resolve(repoRoot, 'web/src/design-system/gating/permissions.ts'), 'utf8');
const mobPerms = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/gating/app_permissions.dart'), 'utf8');
const webSidebar = readFileSync(resolve(repoRoot, 'web/src/design-system/shell/Sidebar.tsx'), 'utf8');

// (1) Committed generated files are byte-for-byte what the generator emits from
// the registry — a stale checkout (someone edited permissions.json but forgot to
// regen) fails here, exactly like tokens/parity.test.mjs.
test('(1) generated key files match the registry byte-for-byte (regen discipline)', () => {
  const { ts, dart } = buildOutputs(registry);
  const committedTs = readFileSync(OUT_PATHS.webTs, 'utf8');
  const committedDart = readFileSync(OUT_PATHS.mobileDart, 'utf8');
  assert.equal(committedTs, ts, 'permission-keys.generated.ts is stale — run `npm run build:permissions`');
  assert.equal(committedDart, dart, 'app_permission_keys.g.dart is stale — run `npm run build:permissions`');
});

// (2) Every named UI key (PERM / AppPerm) is a registry key. Extract the string
// literals from the PERM / AppPerm blocks and assert membership. A hand-typed
// value outside the registry (drift) fails here — this is the AD-17 lock.
test('(2) every PERM / AppPerm value is a canonical registry key (no drift)', () => {
  const webPermBlock = webPerms.match(/export const PERM =\s*\{([\s\S]*?)\}\s*as const;/)?.[1] ?? '';
  const mobPermBlock = mobPerms.match(/class AppPerm \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.ok(webPermBlock.length > 0, 'could not locate the web PERM block');
  assert.ok(mobPermBlock.length > 0, 'could not locate the mobile AppPerm block');

  // Strip comments first — doc comments mention `'mine'`/`'all'`, which are NOT
  // permission keys (they are orderScope return values).
  const strip = stripComments;
  const literals = (block) => [...strip(block).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const webValues = literals(webPermBlock);
  const mobValues = literals(mobPermBlock);
  assert.ok(webValues.length >= 5, 'web PERM must declare at least the 5 keys used by 2.6');
  assert.deepEqual(webValues, mobValues, 'web PERM and mobile AppPerm must declare the SAME keys (parity)');

  for (const key of webValues) {
    assert.ok(registryKeys.has(key), `PERM/AppPerm key "${key}" is NOT in the canonical registry (AD-17 drift)`);
  }
  // The five keys 2.6 relies on are all present.
  for (const key of ['orders.view_all', 'orders.view_own', 'audit.read', 'permissions.manage', 'dashboard.finance_view']) {
    assert.ok(webValues.includes(key), `web PERM missing required 2.6 key "${key}"`);
    assert.ok(mobValues.includes(key), `mobile AppPerm missing required 2.6 key "${key}"`);
  }
});

// (4) 🔴 EVERY key NAME a screen references EXISTS in its source block/file —
// the Story 4.5 bug class: `PERM.ordersConfirm` referenced a name the 7-key
// hand-block never declared, so `Gate requires=undefined` fail-closed and the
// button NEVER rendered (web has no tsc to catch it — TD-1/C-4). This scans
// every screen for `PERM.x` / `PERMISSION_KEYS.x` (web) and `AppPermissionKeys.x`
// / `AppPerm.x` (mobile) and asserts each NAME is declared where it claims to be.
test('(4) every permission-key NAME a screen references is declared in its source (no ghost keys)', () => {
  /** Every file under `dir` (recursive) with one of `exts`. */
  const filesUnder = (dir, exts) =>
    readdirSync(resolve(repoRoot, dir), { recursive: true })
      .filter((f) => exts.some((ext) => String(f).endsWith(ext)))
      .map((f) => join(dir, String(f)));

  // Declared names, per source-of-truth.
  const names = (src, re) => new Set([...stripComments(src).matchAll(re)].map((m) => m[1]));
  const permNames = names(
    webPerms.match(/export const PERM =\s*\{([\s\S]*?)\}\s*as const;/)?.[1] ?? '',
    /(\w+):\s*'[^']+'/g,
  );
  const generatedTs = readFileSync(resolve(repoRoot, 'web/src/design-system/gating/permission-keys.generated.ts'), 'utf8');
  const permissionKeysNames = names(
    generatedTs.match(/export const PERMISSION_KEYS = \{([\s\S]*?)\}\s*as const;/)?.[1] ?? '',
    /(\w+):\s*'[^']+'/g,
  );
  const generatedDart = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/gating/app_permission_keys.g.dart'), 'utf8');
  const appPermissionKeysNames = names(generatedDart, /static const String (\w+) =/g);
  const appPermNames = names(mobPerms, /static const String (\w+) =/g);
  assert.ok(permNames.size > 0, 'could not extract PERM names');
  assert.ok(permissionKeysNames.size >= 21, 'could not extract PERMISSION_KEYS names');
  assert.ok(appPermissionKeysNames.size >= 21, 'could not extract AppPermissionKeys names');

  // References, per platform — comments stripped first (a doc comment may NAME
  // a ghost key to explain this very bug).
  const sources = {
    'PERM.': permNames,
    'PERMISSION_KEYS.': permissionKeysNames,
    'AppPermissionKeys.': appPermissionKeysNames,
    'AppPerm.': appPermNames,
  };
  const scan = (files, prefixes) => {
    for (const rel of files) {
      const code = stripComments(readFileSync(resolve(repoRoot, rel), 'utf8'));
      for (const prefix of prefixes) {
        const declared = sources[prefix];
        for (const [, ref] of code.matchAll(new RegExp(`\\b${prefix.replace('.', '\\.')}(\\w+)`, 'g'))) {
          assert.ok(
            declared.has(ref),
            `${rel} references ${prefix}${ref} — that name is NOT declared in its source (ghost key: Gate would get undefined and fail closed, the 4.5 bug)`,
          );
        }
      }
    }
  };
  scan(filesUnder('web/src/screens', ['.tsx', '.ts']), ['PERM.', 'PERMISSION_KEYS.']);
  scan(filesUnder('mobile/lib/screens', ['.dart']), ['AppPermissionKeys.', 'AppPerm.']);
});

// (3) Every SIDEBAR_NAV `requires` resolves (via PERM.*) to a registry key — the
// nav gates only on canonical keys, never a stray literal.
test('(3) every SIDEBAR_NAV requires is a canonical registry key', () => {
  const webPermMap = Object.fromEntries(
    [...(webPerms.match(/export const PERM =\s*\{([\s\S]*?)\}\s*as const;/)?.[1] ?? '').matchAll(/(\w+):\s*'([^']+)'/g)]
      .map((m) => [m[1], m[2]]),
  );
  // Both gate shapes are scanned: `requires:` (one key) and `requiresAny: [...]`
  // (any-of). A key that only ever appears in the any-of list must be canonical too.
  const requiresRefs = [
    ...[...webSidebar.matchAll(/requires:\s*PERM\.(\w+)/g)].map((m) => m[1]),
    ...[...webSidebar.matchAll(/requiresAny:\s*\[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/PERM\.(\w+)/g)].map((k) => k[1]),
    ),
  ];
  assert.ok(requiresRefs.length >= 2, 'SIDEBAR_NAV must gate at least Audit + Phân quyền');
  for (const ref of requiresRefs) {
    const key = webPermMap[ref];
    assert.ok(key, `SIDEBAR_NAV references PERM.${ref} which is not declared in PERM`);
    assert.ok(registryKeys.has(key), `SIDEBAR_NAV gate PERM.${ref} ("${key}") is not a registry key`);
  }
});
