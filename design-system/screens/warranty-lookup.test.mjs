// Source-guard + parity for the TRA CỨU BẢO HÀNH screens (Story 5.9 — AC-13, AC-14).
//
// A text-guard reads these files AS STRINGS. It cannot see whether the screen
// renders — mobile/test/screens/warranty/warranty_lookup_screen_test.dart is the
// lane that proves the behaviour, and backend/test/web-source-parses.spec.ts is
// the lane that proves the .tsx even parses.
//
// The load-bearing rules here:
//  · The client must NOT normalise a phone number (AD-9). One normaliser exists,
//    and it is on the server; a second one means two records for one person.
//  · The client must NOT do date arithmetic (QĐ-4). Neither platform ships a date
//    library, and "start + N months" has real traps — two implementations would
//    be two answers. Everything numeric arrives computed.
//  · The client must NOT carry the business threshold. "Sắp hết = 90 ngày" lives
//    in ONE named constant in the backend domain; a `90` here is a second copy
//    that goes stale the moment the threshold moves.
//
// ⚠️ WHAT THIS GUARD DELIBERATELY DOES NOT BAN: the literals 'con_han',
// 'sap_het', 'het_han'. The screens MUST write those three strings to map
// `warrantyStatus` onto a colour and a Vietnamese label — banning them would be
// ordering a screen that cannot be written. The danger is a screen DERIVING the
// status, and the two rules above are what actually stop that. A
// `switch (line.warrantyStatus)` is correct architecture, not a violation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_SCREEN = 'web/src/screens/warranty/WarrantyLookupScreen.tsx';
const WEB_FORMAT = 'web/src/screens/warranty/format-ngay.ts';
const WEB_CSS = 'web/src/screens/warranty/warranty-lookup.css';
const MOBILE_SCREEN = 'mobile/lib/screens/warranty/warranty_lookup_screen.dart';
const WEB_PORT = 'web/src/design-system/session/warranty-port.ts';
const MOBILE_PORT = 'mobile/lib/design_system/session/warranty_port.dart';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

// SAME strippers as order-cancel.test.mjs — a second implementation is a second
// chance for the two guards to disagree about what "code" means.
const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const webCode = stripTsx(read(WEB_SCREEN));
const webFormatCode = stripTsx(read(WEB_FORMAT));
const mobileCode = stripDart(read(MOBILE_SCREEN));
const css = read(WEB_CSS);

/** Every screen-side file a "must not appear" rule scans, comment-stripped. */
const allCode = [
  ['web:screen', webCode],
  ['web:format-ngay', webFormatCode],
  ['mobile:screen', mobileCode],
];

// (a) THE CLIENT NEVER NORMALISES A PHONE NUMBER (AD-9).
test('neither screen normalises a phone number — the raw string goes out as typed', () => {
  const banned = ["'+84'", '"+84"', 'libphonenumber', String.raw`replace(/\D`];
  for (const [name, code] of allCode) {
    for (const needle of banned) {
      assert.ok(
        !code.includes(needle),
        `${name} must not contain ${needle} — the backend owns the only phone normaliser (AD-9)`,
      );
    }
  }
});

// (b) THE CLIENT NEVER DOES DATE ARITHMETIC (QĐ-4).
test('neither screen computes a warranty date — every number arrives computed', () => {
  const banned = [
    'setMonth',
    'setUTCMonth',
    'addMonths',
    'Duration(days:',
    'DateTime.now()',
    'Date.now()',
  ];
  for (const [name, code] of allCode) {
    for (const needle of banned) {
      assert.ok(
        !code.includes(needle),
        `${name} must not contain ${needle} — the backend computes warrantyEndAt/remainingDays/warrantyStatus (QĐ-4)`,
      );
    }
  }
});

// (c) THE THRESHOLD LIVES IN EXACTLY ONE PLACE, AND IT IS NOT HERE.
test('neither screen carries the "sắp hết" threshold', () => {
  for (const [name, code] of allCode) {
    assert.ok(
      !/\b90\b/.test(code),
      `${name} must not hard-code 90 — the threshold is one named constant in the backend domain`,
    );
    assert.ok(
      !code.includes('NGUONG_SAP_HET'),
      `${name} must not name the threshold constant — it never crosses the wire`,
    );
  }
});

// (d) THE STATUS IS READ, NOT DERIVED.
test('both screens branch on warrantyStatus rather than on the numbers', () => {
  for (const [name, code] of allCode.filter(([n]) => n.endsWith('screen'))) {
    assert.ok(
      code.includes('warrantyStatus'),
      `${name} must map warrantyStatus onto its label/colour`,
    );
  }
  for (const status of ['con_han', 'sap_het', 'het_han']) {
    // Deliberately asserted PRESENT (see the header): the screens own the label
    // and colour for each status, so they must name all three.
    assert.ok(webCode.includes(status), `web screen missing the ${status} branch`);
    assert.ok(mobileCode.includes(status), `mobile screen missing the ${status} branch`);
  }
});

// (e) COMPOSED FROM THE SHIPPED DESIGN SYSTEM (AD-13).
test('both screens compose shipped components instead of inventing widgets', () => {
  for (const name of ['Field', 'Card', 'Frame', 'Table', 'EmptyState', 'ErrorState', 'Skeleton']) {
    assert.ok(webCode.includes(`<${name}`), `the web screen must compose <${name}>`);
  }
  for (const name of ['AppField', 'AppCard', 'AppFrame', 'AppTable', 'AppEmptyState', 'AppErrorState', 'AppSkeleton', 'AppChip']) {
    assert.ok(mobileCode.includes(name), `the mobile screen must compose ${name}`);
  }
  // The warranty duration formatter is the SHIPPED one on both sides — a fourth
  // copy of "5 năm / 18 tháng" is exactly what the parity pin exists to prevent.
  assert.ok(webCode.includes('formatWarrantyMonths'), 'web screen must reuse formatWarrantyMonths');
  assert.ok(mobileCode.includes('formatWarrantyMonths'), 'mobile screen must reuse formatWarrantyMonths');
});

// (f) NO AD-HOC PALETTE. The status pill reuses `.chip` + the shipped tokens.
test('the web screen tints the pill from tokens, never from a hex code', () => {
  assert.ok(webCode.includes('className="chip'), 'the pill must reuse the shipped .chip class');
  for (const token of ['var(--ok)', 'var(--warn)', 'var(--danger)']) {
    assert.ok(webCode.includes(token), `the pill must take its colour from ${token}`);
  }
  assert.ok(
    !/#[0-9a-fA-F]{3,8}\b/.test(webCode),
    'the web screen must not hard-code a hex colour (AD-13)',
  );
  assert.ok(
    !/#[0-9a-fA-F]{3,8}\b/.test(css),
    'warranty-lookup.css must not invent a colour — layout only, palette from tokens',
  );
});

test('the mobile screen tints the pill from AppTokens, never from a hex code', () => {
  for (const token of ['AppTokens.ok', 'AppTokens.warn', 'AppTokens.danger']) {
    assert.ok(mobileCode.includes(token), `the pill must take its colour from ${token}`);
  }
  assert.ok(
    !/Color\(0x/.test(mobileCode),
    'the mobile screen must not hard-code a colour literal (AD-13)',
  );
});

// (g) PHASE 1 IS READ-ONLY (FR-36). No claim, no lifecycle, no reminder.
test('neither port offers a warranty write path', () => {
  for (const [name, rel] of [['web', WEB_PORT], ['mobile', MOBILE_PORT]]) {
    const port = read(rel);
    for (const verb of ['create', 'update', 'delete', 'submit']) {
      assert.ok(
        !new RegExp(`\\b${verb}\\w*\\s*\\(`, 'i').test(port),
        `${name} WarrantyPort must expose no ${verb}* method — Phase 1 only reads (FR-36)`,
      );
    }
    assert.ok(port.includes('lookup'), `${name} WarrantyPort must expose lookup()`);
  }
});
