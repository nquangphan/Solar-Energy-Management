// Source-guard + parity for the Phân quyền screens (Story 8.2).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/permissions-screen.test.tsx and the mobile widget/bloc
// tests under mobile/test/screens/permissions/ are the lanes that prove the behaviour.
//
// The load-bearing rules:
//  - No permission key literal on these screens (AD-17): the list of permissions,
//    their labels, groups and the preset sets all arrive from the backend.
//  - The client never decides who may grant or edit what (AD-2): `grantable`,
//    `editable` and the filtered presets come from the backend, so the screens hold
//    no permission check of their own.
//  - Both platforms show the SAME Vietnamese labels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCodeNotBlind, assertScanned } from '../lib/assert-scanned.mjs';
import { readMobileScreen } from '../lib/read-mobile-screen.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const FILES = {
  webScreen: 'web/src/screens/permissions/PermissionsScreen.tsx',
  mobileListScreen: 'mobile/lib/screens/permissions/account_list_screen.dart',
  mobileListCubit: 'mobile/lib/screens/permissions/account_list_cubit.dart',
  mobileListState: 'mobile/lib/screens/permissions/account_list_state.dart',
  mobileScreen: 'mobile/lib/screens/permissions/account_permissions_screen.dart',
  mobileCubit: 'mobile/lib/screens/permissions/account_permissions_cubit.dart',
  mobileState: 'mobile/lib/screens/permissions/account_permissions_state.dart',
  webPort: 'web/src/design-system/session/accounts-port.ts',
  mobilePort: 'mobile/lib/design_system/session/accounts_port.dart',
};

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// Comments only: permission literals and labels are STRINGS, so string literals must stay.
const stripTsxComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripDartComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const web = stripTsxComments(read(FILES.webScreen));
const mobileList = stripDartComments(readMobileScreen(repoRoot, FILES.mobileListScreen));
const mobilePerms = stripDartComments(readMobileScreen(repoRoot, FILES.mobileScreen));
const screens = [
  ['web:screen', web],
  ['mobile:account_list screen+cubit+state', mobileList],
  ['mobile:account_permissions screen+cubit+state', mobilePerms],
];

/** Every registry key, read from the generated artifact (never typed here). */
const REGISTRY_KEYS = JSON.parse(read('backend/openapi/permissions.json')).map((entry) => entry.key);

/** Every quoted registry key in `code` (single, double or backtick quotes). */
function permissionLiterals(code) {
  return REGISTRY_KEYS.filter((key) => new RegExp(`['"\`]${key.replace('.', '\\.')}['"\`]`).test(code));
}

/** A label standing alone: a whole string literal or a whole JSX text node — not a substring of a longer one. */
function hasStandaloneLabel(code, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(['"\`]|>)\\s*${escaped}\\s*(['"\`]|<)`).test(code);
}

/** Labels both platforms must render verbatim. */
const SHARED_LABELS = ['QUẢN TRỊ', 'Áp preset role', 'Lưu', 'Tuỳ chỉnh', 'Đã vô hiệu'];

/** A permission decision the client must not make on these screens — each pattern with why. */
const BANNED_CHECKS = [
  [/\bcan\s*\(/, 'a can() check (grantable/editable come from the backend)'],
  [/\bperms\s*\.\s*has\s*\(/, 'reading the session permission set to decide what is grantable'],
  [/PermissionsScope/, 'reading the session permission set on mobile'],
  [/keysActorCannotGrant|keysBlockingActorFromTarget/, 'a copy of the backend escalation rules'],
];

test('every permissions file exists (port + screen on both platforms, two cubits + states on mobile)', () => {
  for (const rel of Object.values(FILES)) {
    assert.ok(existsSync(resolve(repoRoot, rel)), `${rel} must exist`);
  }
});

test('guard is not blind: every scanned file has real code, the registry is read', () => {
  assertCodeNotBlind(screens, 300, 'permissions screens');
  assertScanned(REGISTRY_KEYS, 20, 'registry keys from permissions.json');
  assert.match(mobileList, /class AccountListCubit\b/);
  assert.match(mobilePerms, /class AccountPermissionsCubit\b/);
});

test('the literal matcher catches every quoting style and ignores the generated constant names', () => {
  assert.deepEqual(permissionLiterals("x = 'audit.read';"), ['audit.read']);
  assert.deepEqual(permissionLiterals('x = "costs.view";'), ['costs.view']);
  assert.deepEqual(permissionLiterals('x = `catalog.view`;'), ['catalog.view']);
  assert.deepEqual(permissionLiterals('PERMISSION_KEYS.auditRead; AppPermissionKeys.costsView'), []);
  // A dot in a key is literal, not a wildcard.
  assert.deepEqual(permissionLiterals("'auditXread'"), []);
});

test('no permission key literal on the screens or their cubits/states', () => {
  for (const [name, code] of screens) {
    assert.deepEqual(permissionLiterals(code), [], `${name} must take every permission key from the backend`);
  }
});

test('the standalone-label matcher rejects a label nested in a longer string', () => {
  assert.ok(hasStandaloneLabel("Text('Lưu')", 'Lưu'));
  assert.ok(hasStandaloneLabel('<Button>\n  Lưu\n</Button>', 'Lưu'));
  assert.ok(!hasStandaloneLabel("'Lưu thay đổi'", 'Lưu'));
  assert.ok(!hasStandaloneLabel("'Đã lưu'", 'Lưu'));
});

test('both platforms render the same Vietnamese labels', () => {
  const mobile = `${mobileList}\n${mobilePerms}`;
  for (const label of SHARED_LABELS) {
    assert.ok(hasStandaloneLabel(web, label), `web must render "${label}"`);
    assert.ok(hasStandaloneLabel(mobile, label), `mobile must render "${label}"`);
  }
  // The dependency sentence has the same shape on both (backend `dependencyMessage`).
  for (const [name, code] of [['web', web], ['mobile', mobilePerms]]) {
    assert.ok(code.includes('cần thêm'), `${name} must build "«A» cần thêm «B»."`);
    assert.ok(code.includes('«'), `${name} must quote the labels with « »`);
  }
});

test('the screens hold no permission decision of their own', () => {
  for (const [name, code] of screens) {
    for (const [pattern, why] of BANNED_CHECKS) {
      assert.doesNotMatch(code, pattern, `${name}: ${why}`);
    }
  }
  // The decisions the screens DO display are the backend fields.
  for (const field of ['grantable', 'editable', 'readOnlyReason', 'requires']) {
    assert.ok(web.includes(field), `web must display the backend field ${field}`);
    assert.ok(mobilePerms.includes(field), `mobile must display the backend field ${field}`);
  }
});
