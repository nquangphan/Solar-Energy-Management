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
    'password-port.ts': 'password_port.dart',
    'customers-port.ts': 'customers_port.dart',
    'fake-customers-port.ts': 'fake_customers_port.dart',
    'orders-port.ts': 'orders_port.dart',
    'fake-orders-port.ts': 'fake_orders_port.dart',
    'catalog-port.ts': 'catalog_port.dart',
    'fake-catalog-port.ts': 'fake_catalog_port.dart',
    'session.ts': 'app_session.dart',
    'PermissionsProvider.tsx': 'app_session.dart', // provider lives with mapping on mobile
    'fake-me-port.ts': 'fake_me_port.dart',
    'fake-password-port.ts': 'fake_password_port.dart',
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

test('the password port exposes the SAME three methods on both platforms (Story 2.8)', () => {
  const webPort = readFileSync(resolve(webDir, 'password-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'password_port.dart'), 'utf8');
  for (const method of ['requestResetCode', 'resetPassword', 'changePassword']) {
    assert.ok(webPort.includes(method), `web PasswordPort missing ${method}`);
    assert.ok(mobPort.includes(method), `mobile PasswordPort missing ${method}`);
  }
  // The port must never carry the verification code INBOUND: `requestResetCode`
  // returns only the code lifetime. A `code` in a RESPONSE shape would mean the
  // backend leaked it — the whole reset flow collapses if that is ever allowed.
  assert.match(webPort, /requestResetCode\(email: string\): Promise<\{ expiresInSeconds: number \}>/, 'web requestResetCode must resolve only expiresInSeconds');
  assert.match(mobPort, /Future<int> requestResetCode\(String email\)/, 'mobile requestResetCode must resolve only the code lifetime');
});

test('the customers port exposes the SAME five methods on both platforms (Story 3.4)', () => {
  const webPort = readFileSync(resolve(webDir, 'customers-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'customers_port.dart'), 'utf8');
  for (const method of ['lookup', 'list', 'get', 'create', 'listSources']) {
    assert.ok(webPort.includes(method), `web CustomersPort missing ${method}`);
    assert.ok(mobPort.includes(method), `mobile CustomersPort missing ${method}`);
  }
  // NO ORDER DATA ON THIS PORT. `Order` does not exist until Story 4.1 — a port field
  // the backend cannot fill is a number the UI would have to invent. Comments are
  // stripped first: a doc comment that NAMES the banned field to explain why it is
  // banned is documentation, not a violation.
  const strip = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\/\/\/.*$/gm, '');
  for (const [name, src] of [['web', strip(webPort)], ['mobile', strip(mobPort)]]) {
    for (const absent of ['orderCount', 'orders:', 'List<Order>']) {
      assert.ok(!src.includes(absent), `${name} CustomersPort must not carry "${absent}" — Order lands in Story 4.1`);
    }
  }
});

// The parity map above is a HARDCODED list of twin files, so a new port is INVISIBLE
// to it — it neither demands a Dart twin nor forbids one. Story 3.5 adds a port that is
// deliberately web-only, and nothing in this file would have noticed either way. These
// two tests are that exception, written down BY MACHINE, so the next story reads it as
// a decision instead of as an oversight to "fix".
test('the customer-sources port is a DELIBERATE web-only exception (Story 3.5)', () => {
  // Cấu hình nguồn khách is the single screen DESIGN.md ships without a mobile twin
  // (configuring a catalogue is desk work). A Dart twin here would be code no screen
  // calls — so its absence is asserted, not merely tolerated.
  assert.ok(existsSync(resolve(webDir, 'customer-sources-port.ts')), 'web customer-sources port missing');
  assert.ok(existsSync(resolve(webDir, 'fake-customer-sources-port.ts')), 'web fake customer-sources port missing');
  for (const dart of ['customer_sources_port.dart', 'fake_customer_sources_port.dart']) {
    assert.ok(
      !existsSync(resolve(mobDir, dart)),
      `mobile/${dart} must NOT exist — Cấu hình nguồn khách is web-only by name (DESIGN.md). If a mobile config screen is ever commissioned, add the twin AND delete this assert deliberately.`,
    );
  }
  // The web-only port must also stay honest about what it cannot do: `isOther` is
  // readable but settable through NO write input, because the backend accepts it in no
  // write DTO. A create/update input carrying the flag would be a lie in the type system.
  const webPort = readFileSync(resolve(webDir, 'customer-sources-port.ts'), 'utf8');
  const inputs = webPort.match(/interface (?:Create|Update)CustomerSourceInput \{[^}]*\}/g) ?? [];
  assert.equal(inputs.length, 2, 'both write inputs must be declared');
  for (const input of inputs) {
    assert.ok(!/isOther/.test(input), 'no write input may carry isOther — the flag belongs to the seed');
    assert.ok(!/active/.test(input), 'no write input may carry active — switching off goes through deactivate/reactivate');
  }
});

test('the customers port did NOT grow customer-source write methods (Story 3.5)', () => {
  // The tempting shortcut is to bolt create/update/deactivate/reactivate onto
  // CustomersPort, which already has `listSources`. That port IS a web↔Dart twin pair:
  // a web-only method on it either breaks parity or forces a dead Dart method into
  // existence. The check on line 66 only asserts five method names are PRESENT — it
  // compares no sets, so an extra method there would sail through it. This is the assert
  // that does not.
  const webPort = readFileSync(resolve(webDir, 'customers-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'customers_port.dart'), 'utf8');
  for (const [name, src] of [['web', webPort], ['mobile', mobPort]]) {
    for (const method of ['createSource', 'updateSource', 'deactivateSource', 'reactivateSource']) {
      assert.ok(
        !src.includes(method),
        `${name} CustomersPort must not carry "${method}" — customer-source writes live on the web-only CustomerSourcesPort`,
      );
    }
  }
});

test('the orders port carries the Story 4.4 surface on BOTH platforms (twin re-check)', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');
  // The new method + the metadata fields exist on both twins.
  for (const token of ['updateOrderMeta', 'UpdateOrderMetaInput', 'validityNote', 'vatRate', 'applyVat']) {
    assert.ok(webPort.includes(token), `web OrdersPort missing ${token} (Story 4.4)`);
    assert.ok(mobPort.includes(token), `mobile OrdersPort missing ${token} (Story 4.4)`);
  }
  // kWp is FRACTIONAL by nature ("8,82 kWp") — the mobile twin must carry double,
  // not int (AD-10's integer rule is for money only).
  assert.match(mobPort, /final double\? kWp;/, 'mobile Order.kWp must be double? — capacity is fractional (Story 4.4)');
  assert.match(webPort, /kWp: number \| null/, 'web Order.kWp must stay number | null');
  // NEITHER twin lets the client send a VAT rate — the rate is config the backend
  // resolves; only the vatMode ECHO travels out (AD-16).
  const stripTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const stripDartSrc = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // `[\s\S]*?\n\}` — KHÔNG `[^}]*`: PreviewTotalInput lồng `Array<{...}>` nên `[^}]*`
  // dừng ở dấu `}` bên trong và một field lậu thêm SAU đó lọt qua (mutation-check bắt được).
  const webInputs = stripTs(webPort).match(/interface (?:PreviewTotalInput|UpdateOrderMetaInput) \{[\s\S]*?\n\}/g) ?? [];
  assert.equal(webInputs.length, 2, 'both web write inputs must be declared');
  for (const input of webInputs) {
    assert.ok(!/vatRate|ratePercent/.test(input), 'no web write input may carry a VAT rate — the backend resolves config (AD-16)');
  }
  const dartMetaInput = /class UpdateOrderMetaInput \{[\s\S]*?\n\}/.exec(stripDartSrc(mobPort))?.[0] ?? '';
  assert.ok(dartMetaInput.length > 0, 'mobile UpdateOrderMetaInput must be declared');
  assert.ok(!/vatRate|ratePercent/.test(dartMetaInput), 'no mobile write input may carry a VAT rate — the backend resolves config (AD-16)');
});

test('the orders port carries confirmOrder on BOTH platforms (Story 4.5 twin re-check)', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');
  // The confirm method exists on both twins — and takes ONLY the order id: the
  // endpoint has an empty body (no DTO), so a confirm input type on either twin
  // would invent a payload the backend does not accept.
  assert.match(webPort, /confirmOrder\(orderId: string\): Promise<Order>;/, 'web OrdersPort missing confirmOrder (Story 4.5)');
  assert.match(mobPort, /Future<Order> confirmOrder\(String orderId\);/, 'mobile OrdersPort missing confirmOrder (Story 4.5)');
  for (const [name, src] of [['web', webPort], ['mobile', mobPort]]) {
    assert.ok(!/ConfirmOrderInput/.test(src), `${name} must not declare a ConfirmOrderInput — POST :id/chot carries no body`);
  }
});

test('the orders port carries reviseOrder on BOTH platforms (Story 4.6 twin re-check)', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');
  // The revise method exists on both twins — and takes ONLY the order id: the
  // endpoint has an empty body (no DTO), so a revise input type on either twin
  // would invent a payload the backend does not accept (same rule as confirm).
  assert.match(webPort, /reviseOrder\(orderId: string\): Promise<Order>;/, 'web OrdersPort missing reviseOrder (Story 4.6)');
  assert.match(mobPort, /Future<Order> reviseOrder\(String orderId\);/, 'mobile OrdersPort missing reviseOrder (Story 4.6)');
  for (const [name, src] of [['web', webPort], ['mobile', mobPort]]) {
    assert.ok(!/ReviseOrderInput/.test(src), `${name} must not declare a ReviseOrderInput — POST :id/mo-lai carries no body`);
  }
  // The status constant the screens compare against lives in the PORT file on
  // both twins — the guard forbids the literal inside screens (orders.test.mjs n).
  assert.match(webPort, /export const ORDER_STATUS_DACHOT = 'dachot';/, 'web port must export ORDER_STATUS_DACHOT');
  assert.match(mobPort, /const String kOrderStatusDachot = 'dachot';/, 'mobile port must declare kOrderStatusDachot');
});

test('the orders port carries the Story 4.7 discount surface on BOTH platforms (twin re-check)', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');

  // The THREE method signatures exist on both twins, byte-for-byte per platform
  // convention — applyDiscount/resolveDiscount return the fresh Order (the
  // screen renders it), listPendingDiscounts returns the pending items.
  assert.match(webPort, /applyDiscount\(orderId: string, input: ApplyDiscountInput\): Promise<Order>;/, 'web OrdersPort missing applyDiscount (Story 4.7)');
  assert.match(mobPort, /Future<Order> applyDiscount\(String orderId, ApplyDiscountInput input\);/, 'mobile OrdersPort missing applyDiscount (Story 4.7)');
  assert.match(webPort, /resolveDiscount\(orderId: string, input: ResolveDiscountInput\): Promise<Order>;/, 'web OrdersPort missing resolveDiscount (Story 4.7)');
  assert.match(mobPort, /Future<Order> resolveDiscount\(String orderId, ResolveDiscountInput input\);/, 'mobile OrdersPort missing resolveDiscount (Story 4.7)');
  assert.match(webPort, /listPendingDiscounts\(\): Promise<DiscountPendingItem\[\]>;/, 'web OrdersPort missing listPendingDiscounts (Story 4.7)');
  assert.match(mobPort, /Future<List<DiscountPendingItem>> listPendingDiscounts\(\);/, 'mobile OrdersPort missing listPendingDiscounts (Story 4.7)');

  // Twin type tokens: inputs, the pending item + per-line BACKEND margin, the
  // latest-approval record on Order, and the discount echo on the totals path.
  for (const token of ['ApplyDiscountInput', 'ResolveDiscountInput', 'DiscountPendingItem', 'DiscountPendingLine', 'estimatedMarginPct', 'OrderDiscount', 'discountAmount']) {
    assert.ok(webPort.includes(token), `web OrdersPort missing ${token} (Story 4.7)`);
    assert.ok(mobPort.includes(token), `mobile OrdersPort missing ${token} (Story 4.7)`);
  }

  // The status constants live in the PORT file on both twins (the screen guard
  // forbids the literals inside screens): the ORDER status 'choduyet' + the
  // THREE approval statuses (underscore-keyed, distinct from the order status).
  assert.match(webPort, /export const ORDER_STATUS_CHODUYET = 'choduyet';/, 'web port must export ORDER_STATUS_CHODUYET');
  assert.match(mobPort, /const String kOrderStatusChoduyet = 'choduyet';/, 'mobile port must declare kOrderStatusChoduyet');
  assert.match(webPort, /export const DISCOUNT_CHO_DUYET = 'cho_duyet';/, 'web port must export DISCOUNT_CHO_DUYET');
  assert.match(webPort, /export const DISCOUNT_DONG_Y = 'dong_y';/, 'web port must export DISCOUNT_DONG_Y');
  assert.match(webPort, /export const DISCOUNT_TU_CHOI = 'tu_choi';/, 'web port must export DISCOUNT_TU_CHOI');
  assert.match(mobPort, /const String kDiscountChoDuyet = 'cho_duyet';/, 'mobile port must declare kDiscountChoDuyet');
  assert.match(mobPort, /const String kDiscountDongY = 'dong_y';/, 'mobile port must declare kDiscountDongY');
  assert.match(mobPort, /const String kDiscountTuChoi = 'tu_choi';/, 'mobile port must declare kDiscountTuChoi');

  // The approval screen ships on BOTH platforms (UX-DR-27) — the new twin pair
  // this story adds outside the session dir.
  assert.ok(existsSync(resolve(repoRoot, 'web/src/screens/orders/DiscountApprovalScreen.tsx')), 'web DiscountApprovalScreen missing (Story 4.7)');
  assert.ok(existsSync(resolve(repoRoot, 'mobile/lib/screens/orders/discount_approval_screen.dart')), 'mobile discount_approval_screen missing (Story 4.7)');
});

test('the settings port is a DELIBERATE web-only exception (Story 4.4)', () => {
  // Same decision as customer-sources (Story 3.5): system config is desk work,
  // DESIGN.md ships no mobile config screen — a Dart twin would be code no screen
  // calls. Sale screens get the EFFECTIVE rate on every previewTotal response
  // (OrderTotals.vatRate), so no mobile surface needs this port.
  assert.ok(existsSync(resolve(webDir, 'settings-port.ts')), 'web settings port missing');
  assert.ok(existsSync(resolve(webDir, 'fake-settings-port.ts')), 'web fake settings port missing');
  for (const dart of ['settings_port.dart', 'fake_settings_port.dart']) {
    assert.ok(
      !existsSync(resolve(mobDir, dart)),
      `mobile/${dart} must NOT exist — system config is web-only (DESIGN.md). If a mobile config screen is ever commissioned, add the twin AND delete this assert deliberately.`,
    );
  }
  // The write path takes ONE integer percent — no client-side derivation surface.
  const webPort = readFileSync(resolve(webDir, 'settings-port.ts'), 'utf8');
  assert.match(webPort, /updateVatRate\(ratePercent: number\): Promise<number>/, 'updateVatRate must take one integer percent and resolve the new rate');
});

test('the session provider exposes the /me identity on both platforms (Story 2.8)', () => {
  // The Hồ sơ screen needs displayName/email. The provider ALREADY fetched /me —
  // it must expose the payload, not force a second call.
  const provider = readFileSync(resolve(webDir, 'PermissionsProvider.tsx'), 'utf8');
  const hook = readFileSync(resolve(webDir, 'use-permissions.ts'), 'utf8');
  const mobSession = readFileSync(resolve(mobDir, 'app_session.dart'), 'utf8');
  assert.match(provider, /me: MeResponse \| null/, 'web PermissionsState must carry `me`');
  assert.match(hook, /\bme\b/, 'usePermissions must re-expose `me`');
  assert.match(mobSession, /final MeResponse\? me;/, 'mobile PermissionsScope must carry `me`');
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
