// Source-guard + parity for the HUỶ ĐƠN flow (Story 5.7 — AC-10, AC-11, AC-12).
//
// The cancel flow is a DIALOG on the order-detail screen, not a screen of its
// own: it collects one line of text, and UX-DR-19/20 put "money/data-consequence
// action" squarely in the dialog bucket. So this file guards the cancel-specific
// slice of both detail screens plus the two ports.
//
// A text-guard reads these files AS STRINGS. It cannot see whether the dialog
// renders — mobile/test/screens/orders/order_detail_cancel_test.dart is the lane
// that proves the behaviour, and backend/test/web-source-parses.spec.ts is the
// lane that proves the .tsx even parses.
//
// The load-bearing rules here:
//  · The client must NOT decide who can cancel. Which statuses have a `huy` edge
//    lives in the backend's transition table; the screens read one boolean
//    (AD-2/AD-4). A screen that spells 'baogia' is carrying a second copy.
//  · The dialog must be composed from the SHIPPED Dialog + Field, never from
//    ConfirmDialog (no input slot) and never from a new one (AD-13).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertScanned, assertCodeNotBlind } from '../lib/assert-scanned.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mobileField, mobileMethod } from '../lib/web-mobile-contract-map.mjs';
import { generatedBody, webAliasDto } from '../lib/web-contract-types.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // design-system/screens -> repo root

const WEB_DETAIL = 'web/src/screens/orders/OrderDetailScreen.tsx';
const MOBILE_DETAIL = 'mobile/lib/screens/orders/order_detail_screen.dart';
const WEB_CSS = 'web/src/screens/orders/order-detail.css';
const WEB_PORT = 'web/src/design-system/session/orders-port.ts';
const MOBILE_PORT = 'mobile/lib/design_system/session/orders_port.dart';
const WEB_FAKE = 'web/src/design-system/session/fake-orders-port.ts';
const MOBILE_FAKE = 'mobile/lib/design_system/session/fake_orders_port.dart';

const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const stripTsx = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const stripDart = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/\/.*$/gm, '')
    .replace(/\/\/.*$/gm, '');

const webCode = stripTsx(read(WEB_DETAIL));
const mobileCode = stripDart(read(MOBILE_DETAIL));
const css = read(WEB_CSS);

/** Both screens, comment-stripped — the surface every "must not appear" rule scans. */
const allCode = [
  ['web:detail', webCode],
  ['mobile:detail', mobileCode],
];

// (a) COMPOSED FROM THE SHIPPED DIALOG + FIELD (AD-13).
test('the cancel dialog uses the shipped Dialog and Field, not a new one', () => {
  for (const name of ['Dialog', 'Field', 'Button']) {
    assert.ok(webCode.includes(`<${name}`), `the web detail must compose <${name}> for the cancel dialog`);
  }
  for (const name of ['AppDialog', 'AppField', 'AppButton']) {
    assert.ok(mobileCode.includes(name), `the mobile detail must compose ${name} for the cancel dialog`);
  }
});

// (a.2) NOT ConfirmDialog. It takes `consequence` as TEXT and has no input slot,
// so a reason field cannot live in it. Reaching for it here would end in either a
// second dialog on top (UX-DR-20) or a reason collected somewhere else entirely.
test('the cancel dialog is NOT ConfirmDialog — that one has no input slot', () => {
  const webHuy = webCode.slice(webCode.indexOf('Huỷ đơn'));
  assert.ok(
    !/<ConfirmDialog[^>]*Huỷ/.test(webHuy),
    'the web cancel flow must not be a ConfirmDialog — it cannot carry the reason field',
  );
  const mobHuy = mobileCode.slice(mobileCode.indexOf('_HuyDonDialog'));
  assert.ok(
    !mobHuy.includes('AppConfirmDialog'),
    'the mobile cancel flow must not be an AppConfirmDialog — it cannot carry the reason field',
  );
});

// (b) THE CONFIRM BUTTON CARRIES THE `danger` VARIANT. Cancelling closes an order
// for good; a default-styled button understates that.
test('the confirm button uses the danger variant', () => {
  assert.match(webCode, /variant="danger"/, 'the web cancel buttons must use the danger variant');
  assert.match(
    mobileCode,
    /AppButtonVariant\.danger/,
    'the mobile cancel buttons must use the danger variant',
  );
});

// (c) 🔴 NO STATUS LITERAL. Which statuses can be cancelled is the transition
// table's answer, delivered as ONE boolean. A screen that spells 'baogia' has
// started keeping its own copy — and the existing detail guard does NOT cover
// these three keys, so this is the only place that catches it.
test('neither screen names a status key to decide cancellability (AD-2)', () => {
  for (const [name, src] of allCode) {
    for (const key of ['baogia', 'dachot', 'dacoc', 'huy']) {
      assert.ok(
        !new RegExp(`['"]${key}['"]`).test(src),
        `${name} must not hardcode the status key '${key}' — coTheHuy is the backend's answer`,
      );
    }
  }
});

// (c.2) NO PERMISSION LITERAL (AD-17). Import paths are stripped first: a Dart
// import matches the same shape as a permission key, and a guard that cries wolf
// gets its regex loosened.
test('neither screen contains a permission literal (AD-17)', () => {
  const dropImports = (s) => s.replace(/^\s*import .*$/gm, '');
  for (const [name, src] of allCode) {
    const hits = dropImports(src).match(/['"][a-z_]+\.[a-z_]+['"]/g) ?? [];
    assert.deepEqual(hits, [], `${name} must not contain a permission literal, found: ${hits.join(', ')}`);
  }
});

// (d) THE SCREEN NEVER TOUCHES THE NETWORK (AD-1/AD-3) — the port owns transport.
test('neither screen talks to the network directly', () => {
  for (const [name, src] of allCode) {
    for (const banned of ['fetch(', 'XMLHttpRequest', 'axios', 'HttpClient', 'package:http', 'http.post']) {
      assert.ok(!src.includes(banned), `${name} must not reference ${banned} — the port owns transport`);
    }
  }
});

// (e) BOTH PORTS DECLARE THE CANCEL METHOD, AND SO DO BOTH FAKES (parity, AD-12).
// Web follows the contract name (Story 10.5); mobile keeps its twin's until 10.8.
const MOBILE_CANCEL = mobileMethod('cancel');
test('the cancel method ships on all FOUR port files', () => {
  assert.match(read(WEB_PORT), /\bcancel\(orderId: string, reason: string\): Promise<void>/, 'web OrdersPort missing cancel');
  assert.match(read(MOBILE_PORT), new RegExp(`Future<void> ${MOBILE_CANCEL}\\(String orderId, String lyDo\\)`), `mobile OrdersPort missing ${MOBILE_CANCEL}`);
  assert.match(read(WEB_FAKE), /\bcancel\(/, 'web FakeOrdersPort missing cancel');
  assert.match(read(MOBILE_FAKE), new RegExp(`${MOBILE_CANCEL}\\(`), `mobile FakeOrdersPort missing ${MOBILE_CANCEL}`);
});

// (e.2) THE REASON IS NOT OPTIONAL ANYWHERE IN THE CONTRACT. A nullable `lyDo`
// would let a caller cancel silently, which is the one thing this story exists to
// prevent.
test('the reason parameter is required on both ports', () => {
  assert.ok(
    !/\bcancel\(orderId: string, reason\?: string/.test(read(WEB_PORT)),
    'the web port must not make reason optional',
  );
  assert.ok(
    !/Future<void> huyDon\(String orderId, \[?String\? lyDo/.test(read(MOBILE_PORT)),
    'the mobile port must not make lyDo nullable',
  );
});

// (f) coTheHuy IS PART OF THE LIFECYCLE CONTRACT ON BOTH PLATFORMS (AD-12).
test('the lifecycle type carries the cancel flag on both platforms', () => {
  assert.equal(webAliasDto(read(WEB_PORT), 'OrderLifecycle'), 'OrderLifecycleResponseDto', 'web OrderLifecycle must be the generated contract type');
  assert.match(generatedBody('OrderLifecycleResponseDto'), /canCancel: boolean/, 'web OrderLifecycle missing canCancel');
  assert.match(read(MOBILE_PORT), /final bool coTheHuy/, 'mobile OrderLifecycle missing coTheHuy');
});

// (g) VIỀN NÉT — flat borders. No elevation, no gradient, radius from tokens
// (UX-DR-4). Re-stated for the CSS this story added.
test('the cancel dialog styles add no elevation and no ad-hoc colour', () => {
  for (const pattern of [/box-shadow/i, /gradient/i, /drop-shadow/i, /filter:/i]) {
    assert.ok(!pattern.test(css), `order-detail.css must contain 0 ${pattern.source}`);
  }
  // Every colour on the new rules comes from a token.
  for (const decl of assertScanned(css.match(/(?:^|\s)color:[^;]+;/g) ?? [], 4, 'order-cancel color declarations')) {
    assert.match(decl, /var\(--/, `order-detail.css colour must come from a token: ${decl.trim()}`);
  }
  assert.ok(!/BoxShadow/.test(mobileCode), 'the mobile detail must contain 0 BoxShadow');
  assert.ok(!/elevation/i.test(mobileCode), 'the mobile detail must contain 0 elevation');
});

// (h) EVERY CSS CLASS THE CANCEL MARKUP NAMES HAS A REAL RULE.
//
// Story 5.6 shipped a gallery calling EIGHT classes that did not exist anywhere,
// and every text-guard stayed green. A class name is a string; nothing checks it
// resolves unless something checks it resolves.
test('every od-huy-* class used in the markup has a rule in the stylesheet', () => {
  const used = new Set(webCode.match(/className="(od-huy-[\w-]+)"/g)?.map((m) => m.slice(11, -1)) ?? []);
  assert.ok(used.size > 0, 'the web cancel dialog should carry its own classes');
  for (const cls of used) {
    assert.ok(
      new RegExp(`\\.${cls}\\s*[,{]`).test(css),
      `order-detail.css has no rule for .${cls} — the class resolves to nothing`,
    );
  }
});

// Anti-empty (E-7): the "must not contain" checks above scan these sources; if a stripper/reader
// ever returned (near-)empty text they would all pass vacuously. Floors are ~40% of the measured
// smallest source, so ordinary edits never trip them but a blind stripper does.
test('scanned sources are not blind — stripped code keeps real content', () => {
  assertCodeNotBlind([['css', css], ...allCode], 1500, 'order-cancel');
});
