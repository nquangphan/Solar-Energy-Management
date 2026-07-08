// Generator for the FE permission-key layer (Story 2.6, AC-4 — AD-17).
//
// backend/openapi/permissions.json is the canonical registry (17 keys, owned by
// the backend `accounts/domain`). This script derives the FE key constants from
// it so a permission literal can never drift between the registry, web and
// mobile — the exact same discipline as build-tokens.mjs:
//   web    -> web/src/design-system/gating/permission-keys.generated.ts
//   mobile -> mobile/lib/design_system/gating/app_permission_keys.g.dart
//
// GATING IS UX ONLY (AD-4): these keys drive which surfaces are shown; the
// backend enforces EVERY request. A hidden nav item is never a security boundary.
//
// Zero external dependencies (Node built-ins only). Run from the design-system
// package: `npm run build:permissions`. Outputs are committed;
// permissions/permission-keys.test.mjs fails if a committed file no longer
// matches what this generator produces from the registry (byte-for-byte).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/permissions -> repo root
const SSOT_PATH = resolve(repoRoot, 'backend/openapi/permissions.json');

export const OUT_PATHS = {
  webTs: resolve(repoRoot, 'web/src/design-system/gating/permission-keys.generated.ts'),
  mobileDart: resolve(repoRoot, 'mobile/lib/design_system/gating/app_permission_keys.g.dart'),
};

const REGEN = 'cd design-system && npm run build:permissions';
const GEN_NOTE = `GENERATED from backend/openapi/permissions.json — do not edit by hand; regen: \`${REGEN}\`.`;

export function loadRegistry() {
  return JSON.parse(readFileSync(SSOT_PATH, 'utf8'));
}

// Registry key -> camelCase identifier (orders.view_all -> ordersViewAll,
// dashboard.finance_view -> dashboardFinanceView). Both `.` and `_` are
// separators; the char after a separator is upper-cased.
export function camel(key) {
  return key.replace(/[._]([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// --- Web: permission-keys.generated.ts ------------------------------------
function buildTs(registry) {
  const lines = registry.map((p) => `  ${camel(p.key)}: '${p.key}',`).join('\n');
  return `// ${GEN_NOTE}
/* eslint-disable */

/**
 * Canonical FE permission keys, derived from the backend registry (AD-17). FE
 * gating, BE guard and the noti resolver all consume this same list. Gating is
 * UX only (AD-4) — the backend enforces every request regardless.
 */
export const PERMISSION_KEYS = {
${lines}
} as const;

/** camelCase key name (e.g. \`ordersViewAll\`). */
export type PermissionKeyName = keyof typeof PERMISSION_KEYS;
`;
}

// --- Mobile: app_permission_keys.g.dart -----------------------------------
function buildDart(registry) {
  const lines = registry
    .map((p) => `  static const String ${camel(p.key)} = '${p.key}';`)
    .join('\n');
  return `// ${GEN_NOTE}
// ignore_for_file: constant_identifier_names

/// Canonical FE permission keys, derived from the backend registry (AD-17). FE
/// gating, BE guard and the noti resolver all consume this same list. Gating is
/// UX only (AD-4) — the backend enforces every request regardless.
class AppPermissionKeys {
  AppPermissionKeys._();

${lines}
}
`;
}

export function buildOutputs(registry) {
  return { ts: buildTs(registry), dart: buildDart(registry) };
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

// Run guard: only write files when executed directly (not when imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const registry = loadRegistry();
  const { ts, dart } = buildOutputs(registry);
  write(OUT_PATHS.webTs, ts);
  write(OUT_PATHS.mobileDart, dart);
  console.log('Generated:');
  for (const p of Object.values(OUT_PATHS)) console.log('  ' + p);
}
