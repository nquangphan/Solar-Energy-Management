// Source-guard + parity for the Audit log screens (Story 8.5).
//
// A text-guard reads these files AS STRINGS. It cannot see whether a screen
// renders — web/src/test/audit-log-screen.test.tsx and the mobile widget/bloc
// tests under mobile/test/screens/audit/ are the lanes that prove the behaviour.
//
// The load-bearing rules:
//  - The screen is gated on the `audit.read` PERMISSION, never on a role: no
//    screen text names one (UX-DR-22, AD-4).
//  - Both platforms label the nine target types the same way, and those nine are
//    exactly the backend's `AUDIT_TARGET_TYPES`.
//  - A status value is printed through the StatusChip label map — never a second map.
//  - Instants go through the shared `ngayGio` helper — never `toLocaleString`/`Intl`.
//  - The backend's money field set for audit payloads covers every money field of
//    the API contract, so a money change is always flagged `isMoney`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCodeNotBlind, assertScanned } from '../lib/assert-scanned.mjs';
import { readMobileScreen } from '../lib/read-mobile-screen.mjs';
import { moneyFields } from '../money/money-fields.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const FILES = {
  webScreen: 'web/src/screens/audit/AuditLogScreen.tsx',
  mobileScreen: 'mobile/lib/screens/audit/audit_log_screen.dart',
  mobileCubit: 'mobile/lib/screens/audit/audit_log_cubit.dart',
  mobileState: 'mobile/lib/screens/audit/audit_log_state.dart',
  webPort: 'web/src/design-system/session/audit-logs-port.ts',
  mobilePort: 'mobile/lib/design_system/session/audit_logs_port.dart',
  backendTargetTypes: 'backend/src/audit/domain/audit-target-types.ts',
  backendChanges: 'backend/src/audit/domain/audit-changes.ts',
  statusChip: 'web/src/design-system/components/StatusChip.tsx',
};

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// Comments only: labels are STRINGS, so string literals must stay.
const stripTsxComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripDartComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const web = stripTsxComments(read(FILES.webScreen));
const mobile = stripDartComments(readMobileScreen(repoRoot, FILES.mobileScreen));
const screens = [
  ['web:AuditLogScreen', web],
  ['mobile:audit_log screen+cubit+state', mobile],
];

/** `'Key': 'Label'` or `Key: 'Label'` entries of the map literal opened by `opener`. */
function mapEntries(code, opener) {
  const start = code.indexOf(opener);
  if (start < 0) return [];
  const body = code.slice(start, code.indexOf('};', start));
  return [...body.matchAll(/^\s*'?(\w+)'?\s*:\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]);
}

const WEB_TARGETS = mapEntries(web, 'export const AUDIT_TARGET_LABELS');
const MOBILE_TARGETS = mapEntries(mobile, 'const Map<String, String> kAuditTargetLabels');
const BACKEND_TARGETS = [
  ...(/AUDIT_TARGET_TYPES = \[([\s\S]*?)\] as const/.exec(read(FILES.backendTargetTypes))?.[1] ?? '').matchAll(
    /'(\w+)'/g,
  ),
].map((m) => m[1]);

/** The StatusChip label map, parsed from the web component (never typed here). */
const STATUS_LABEL_BLOCK = /STATUS_LABELS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(read(FILES.statusChip))?.[1] ?? '';
const STATUS_KEYS = [...STATUS_LABEL_BLOCK.matchAll(/^\s*(\w+):\s*'([^']+)'/gm)].map((m) => m[1]);

/** Status keys spelled by the screen: a quoted key, a map entry `key: '…'`, or a switch case. */
function statusLiterals(code) {
  return STATUS_KEYS.filter((key) =>
    [
      new RegExp(`['"\`]${key}['"\`]`),
      new RegExp(`\\b${key}['"\`]?\\s*:\\s*['"\`]`),
      new RegExp(`\\bcase\\s+(?:StatusKey\\.)?['"\`]?${key}\\b`),
    ].some((re) => re.test(code)),
  );
}

/** Role names a screen must not show; the audit screen is gated on a permission. */
const ROLE_WORDS = /Super\s*Admin|SUPER_ADMIN|chỉ\s+Super/i;

/** Locale-dependent time formatting the screens must not use. */
const LOCALE_TIME = /\.toLocale(?:Date|Time)?String\s*\(|\bIntl\b|\bDateFormat\s*\(/;

/** `AUDIT_MONEY_FIELDS` of the backend, parsed from its Set literal. */
const BACKEND_MONEY = [
  ...(/AUDIT_MONEY_FIELDS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(read(FILES.backendChanges))?.[1] ?? '').matchAll(
    /'(\w+)'/g,
  ),
].map((m) => m[1]);

test('every audit file exists (port + screen on both platforms, cubit + state on mobile)', () => {
  for (const rel of Object.values(FILES)) assert.ok(existsSync(resolve(repoRoot, rel)), `missing: ${rel}`);
});

test('guard is not blind: the screens have real code and every map is parsed', () => {
  assertCodeNotBlind(screens, 2000);
  assert.ok(mobile.includes('class AuditLogCubit'), 'the mobile text must include the cubit');
  assertScanned(WEB_TARGETS, 9, 'web AUDIT_TARGET_LABELS entries');
  assertScanned(MOBILE_TARGETS, 9, 'mobile kAuditTargetLabels entries');
  assertScanned(BACKEND_TARGETS, 9, 'backend AUDIT_TARGET_TYPES');
  assertScanned(STATUS_KEYS, 10, 'StatusChip STATUS_LABELS keys');
  assertScanned(BACKEND_MONEY, 18, 'backend AUDIT_MONEY_FIELDS');
});

test('the matchers catch what they must and spare the rest', () => {
  assert.deepEqual(mapEntries("const m = {\n  'Order': 'Đơn',\n  Account: 'Tài khoản',\n};", 'const m'), [
    ['Order', 'Đơn'],
    ['Account', 'Tài khoản'],
  ]);
  assert.ok(ROLE_WORDS.test("'Chỉ Super Admin được xem'"));
  assert.ok(ROLE_WORDS.test('<Banner>SuperAdmin</Banner>'));
  assert.ok(!ROLE_WORDS.test("'Bản ghi bất biến — chỉ đọc, không sửa/xoá.'"));
  for (const bad of ['d.toLocaleString("vi-VN")', 'd.toLocaleDateString()', 'new Intl.DateTimeFormat()', "DateFormat('dd/MM')"]) {
    assert.ok(LOCALE_TIME.test(bad), bad);
  }
  assert.ok(!LOCALE_TIME.test('ngayGio(entry.occurredAt)'));
  assert.deepEqual(statusLiterals("if (v === 'dachot') return 'Đã chốt';"), ['dachot']);
  assert.deepEqual(statusLiterals("const m = { baogia: 'Báo giá' };"), ['baogia']);
  assert.deepEqual(statusLiterals("change.field === 'status' && isStatusKey(value)"), []);
});

test('no screen text names a role — the gate is the audit.read permission', () => {
  for (const [name, code] of screens) assert.ok(!ROLE_WORDS.test(code), `${name} names a role`);
});

test('the nine target-type labels are the same on web and mobile, and match the backend types', () => {
  assert.deepEqual(MOBILE_TARGETS, WEB_TARGETS);
  assert.deepEqual(
    WEB_TARGETS.map(([key]) => key).sort(),
    [...BACKEND_TARGETS].sort(),
  );
});

test('a status is printed only through the StatusChip label map', () => {
  for (const [name, code] of screens) assert.deepEqual(statusLiterals(code), [], `${name} spells a status key`);
  assert.ok(web.includes('STATUS_LABELS[value]'), 'web must print a status through STATUS_LABELS');
  assert.ok(/kStatusLabels\[key\]/.test(mobile), 'mobile must print a status through kStatusLabels');
});

test('instants go through ngayGio, never a locale formatter', () => {
  for (const [name, code] of screens) assert.ok(!LOCALE_TIME.test(code), `${name} formats time by locale`);
  assert.ok(/\bngayGio\(entry\.occurredAt\)/.test(web), 'web must print occurredAt through ngayGio');
  assert.ok(/\bngayGio\(entry\.occurredAt\.toIso8601String\(\)\)/.test(mobile), 'mobile must print occurredAt through ngayGio');
});

test('the backend audit money set covers every money field of the API contract', () => {
  const contract = moneyFields();
  assertScanned(contract, 8, 'contract money fields');
  const missing = contract.filter((field) => !BACKEND_MONEY.includes(field));
  assert.deepEqual(missing, [], `add to AUDIT_MONEY_FIELDS: ${missing.join(', ')}`);
});
