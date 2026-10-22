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

import { generatedBody, generatedFields, webAliasDto, webTypeFields } from '../lib/web-contract-types.mjs';
import { WEB_TO_MOBILE_FIELD, mobileField, mobileMethod } from '../lib/web-mobile-contract-map.mjs';

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
    'warranty-port.ts': 'warranty_port.dart',
    'fake-warranty-port.ts': 'fake_warranty_port.dart',
    'inventory-port.ts': 'inventory_port.dart',
    'fake-inventory-port.ts': 'fake_inventory_port.dart',
    'stock-vouchers-port.ts': 'stock_vouchers_port.dart',
    'fake-stock-vouchers-port.ts': 'fake_stock_vouchers_port.dart',
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
  // Since Story 10.4 the inputs ARE the generated write DTOs, so the check reads the
  // DTOs they alias in openapi.json.
  const webPort = readFileSync(resolve(webDir, 'customer-sources-port.ts'), 'utf8');
  const spec = JSON.parse(readFileSync(resolve(repoRoot, 'backend/openapi/openapi.json'), 'utf8'));
  for (const [input, dto] of [
    ['CreateCustomerSourceInput', 'CreateCustomerSourceRequestDto'],
    ['UpdateCustomerSourceInput', 'UpdateCustomerSourceRequestDto'],
  ]) {
    assert.ok(
      webPort.includes(`export type ${input} = Schemas['${dto}'];`),
      `${input} must alias the generated ${dto}`,
    );
    const props = Object.keys(spec.components.schemas[dto]?.properties ?? {});
    assert.ok(props.includes('name'), `${dto} must be read from the spec (name missing — reader went blind)`);
    assert.ok(!props.includes('isOther'), 'no write input may carry isOther — the flag belongs to the seed');
    assert.ok(!props.includes('active'), 'no write input may carry active — switching off goes through deactivate/reactivate');
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
  // The new method + the metadata fields exist on both twins. Web data types are the
  // generated contract types (Story 10.5), so the web fields are read from those.
  for (const token of ['updateOrderMeta', 'UpdateOrderMetaInput', 'validityNote', 'vatRate', 'applyVat']) {
    assert.ok(mobPort.includes(token), `mobile OrdersPort missing ${token} (Story 4.4)`);
  }
  assert.ok(webPort.includes('updateOrderMeta'), 'web OrdersPort missing updateOrderMeta (Story 4.4)');
  assert.match(webPort, /export type UpdateOrderMetaInput = Pick<[\s\S]*?'validityNote'/, 'web UpdateOrderMetaInput must pick validityNote (Story 4.4)');
  const webTotals = generatedFields(webAliasDto(webPort, 'OrderTotals'));
  for (const field of ['vatRate', 'applyVat']) {
    assert.ok(Object.hasOwn(webTotals, field), `web OrderTotals missing ${field} (Story 4.4)`);
  }
  // kWp is FRACTIONAL by nature ("8,82 kWp") — the mobile twin must carry double,
  // not int (AD-10's integer rule is for money only).
  assert.match(mobPort, /final double\? kWp;/, 'mobile Order.kWp must be double? — capacity is fractional (Story 4.4)');
  assert.match(generatedBody(webAliasDto(webPort, 'Order')), /kWp\?: number \| null/, 'web Order.kWp must stay number | null');
  // NEITHER twin lets the client send a VAT rate — the rate is config the backend
  // resolves; only the vatMode ECHO travels out (AD-16).
  const stripTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const stripDartSrc = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // `[\s\S]*?\n\}` — KHÔNG `[^}]*`: PreviewTotalInput lồng `Array<{...}>` nên `[^}]*`
  // dừng ở dấu `}` bên trong và một field lậu thêm SAU đó lọt qua (mutation-check bắt được).
  // Web: the two write inputs are the generated request types (UpdateOrderMetaInput picks
  // from UpdateOrderRequestDto) — none of the fields they really have may be a rate.
  const webInputs = ['PreviewTotalInput', 'UpdateOrderMetaInput'].map((t) => Object.keys(webTypeFields(stripTs(webPort), t)));
  assert.ok(webInputs[0].includes('lines'), 'web PreviewTotalInput must resolve to the generated request fields');
  assert.deepEqual([...webInputs[1]].sort(), ['kWp', 'validityNote', 'vatMode'], 'web UpdateOrderMetaInput must pick exactly the meta fields');
  for (const fields of webInputs) {
    assert.ok(!/vatRate|ratePercent/.test(fields.join(' ')), 'no web write input may carry a VAT rate — the backend resolves config (AD-16)');
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
    assert.ok(!/ConfirmOrderInput/.test(src), `${name} must not declare a ConfirmOrderInput — POST :id/confirm carries no body`);
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
    assert.ok(!/ReviseOrderInput/.test(src), `${name} must not declare a ReviseOrderInput — POST :id/reopen carries no body`);
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

test('the orders port carries the Story 4.8 quote-export surface on BOTH platforms (twin re-check)', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');

  // The export method exists on both twins — and takes ONLY the order id
  // (same rule as confirm/revise: no invented input payload; the backend
  // renders from the order's own content).
  assert.match(webPort, /exportQuote\(orderId: string\): Promise<QuoteExportFiles>;/, 'web OrdersPort missing exportQuote (Story 4.8)');
  assert.match(mobPort, /Future<QuoteExportFiles> exportQuote\(String orderId\);/, 'mobile OrdersPort missing exportQuote (Story 4.8)');
  for (const [name, src] of [['web', webPort], ['mobile', mobPort]]) {
    assert.ok(!/ExportQuoteInput/.test(src), `${name} must not declare an ExportQuoteInput — POST :id/export-quote carries no body`);
  }

  // Twin type tokens: the file pair + the single file shape (fileName/mimeType/
  // bytes — Uint8Array on web, Uint8List via dart:typed_data on mobile).
  for (const token of ['QuoteExportFile', 'QuoteExportFiles', 'fileName', 'mimeType']) {
    assert.ok(webPort.includes(token), `web OrdersPort missing ${token} (Story 4.8)`);
    assert.ok(mobPort.includes(token), `mobile OrdersPort missing ${token} (Story 4.8)`);
  }
  assert.ok(webPort.includes('bytes: Uint8Array'), 'web QuoteExportFile must carry bytes as Uint8Array');
  assert.ok(mobPort.includes('final Uint8List bytes'), 'mobile QuoteExportFile must carry bytes as Uint8List');
  assert.ok(mobPort.includes("import 'dart:typed_data';"), 'mobile orders port must import dart:typed_data for Uint8List');
});

test('the orders port carries the Story 5.5 status-change surface on BOTH platforms (twin re-check)', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');

  // The transition method exists on both twins and takes the SAME three things:
  // the order, the EVENT (never a destination — that belongs to the backend's
  // transition table, AD-11), and a photo list that may be empty.
  // Web uses the contract name (Story 10.5); mobile keeps its twin's name until 10.8.
  const mobTransition = mobileMethod('transition');
  assert.match(webPort, /\btransition\(/, 'web OrdersPort missing transition (Story 5.5)');
  assert.match(mobPort, new RegExp(`Future<StatusChangeResult> ${mobTransition}\\(`), `mobile OrdersPort missing ${mobTransition} (Story 5.5)`);
  for (const [name, src, method] of [['web', webPort, 'transition'], ['mobile', mobPort, mobTransition]]) {
    // No `to`/`status` input: a client that names its destination has an opinion
    // about the lifecycle, and that is the one thing AD-11 reserves.
    assert.ok(!new RegExp(`\\b${method}\\([^)]*\\bto\\b`).test(src), `${name} ${method} must not take a destination`);
  }

  // Twin type tokens for the widened lifecycle read + the transition reply.
  for (const token of ['OrderNextStep', 'OrderLifecycle', 'StatusChangeResult']) {
    assert.ok(webPort.includes(token), `web OrdersPort missing ${token} (Story 5.5)`);
    assert.ok(mobPort.includes(token), `mobile OrdersPort missing ${token} (Story 5.5)`);
  }
  for (const [type, dto, field] of [
    ['OrderLifecycle', 'OrderLifecycleResponseDto', 'nextSteps'],
    ['StatusChangeResult', 'StatusChangeResponseDto', 'savedAttachmentCount'],
  ]) {
    assert.equal(webAliasDto(webPort, type), dto, `web ${type} must be the generated ${dto}`);
    assert.ok(Object.hasOwn(generatedFields(dto), field), `web ${type} missing ${field} (Story 5.5)`);
    assert.ok(mobPort.includes(mobileField(dto, field)), `mobile OrdersPort missing ${mobileField(dto, field)} (Story 5.5)`);
  }

  // `getLifecycle` returns the WIDENED shape on both — one read answers both
  // "what does the stepper draw" and "what can this caller do next".
  assert.match(webPort, /getLifecycle\(orderId: string\): Promise<OrderLifecycle>/, 'web getLifecycle must return OrderLifecycle (Story 5.5)');
  assert.match(mobPort, /Future<OrderLifecycle> getLifecycle\(/, 'mobile getLifecycle must return OrderLifecycle (Story 5.5)');

  // The photo payload is each platform's native picked-file type: File[] on web,
  // XFile[] on mobile (what AppImageUpload emits).
  assert.ok(webPort.includes('files: File[]'), 'web transition must take File[]');
  assert.ok(mobPort.includes('List<XFile> anh'), 'mobile chuyenTrangThai must take List<XFile>');
  assert.ok(mobPort.includes("import 'package:image_picker/image_picker.dart';"), 'mobile orders port must import image_picker for XFile');
});

test('huyDon + coTheHuy ship on ALL FOUR orders-port files (Story 5.7)', () => {
  // Cancelling is its OWN endpoint, not an event of chuyenTrangThai: the reason
  // is mandatory and only that path enforces it. So the seam has to appear on
  // both real ports AND both fakes — a fake without it makes every screen test
  // hit an unimplemented method instead of the demo data it was written for.
  const files = [
    ['web port', resolve(webDir, 'orders-port.ts')],
    ['mobile port', resolve(mobDir, 'orders_port.dart')],
    ['web fake', resolve(webDir, 'fake-orders-port.ts')],
    ['mobile fake', resolve(mobDir, 'fake_orders_port.dart')],
  ];
  // Code only: a doc comment naming the flag is not the flag.
  const stripCode = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [name, path] of files) {
    const src = stripCode(readFileSync(path, 'utf8'));
    // Web follows the contract names (Story 10.5); mobile keeps its twin's until 10.8.
    const web = name.startsWith('web');
    const method = web ? 'cancel' : mobileMethod('cancel');
    const flag = web ? 'canCancel' : mobileField('OrderLifecycleResponseDto', 'canCancel');
    assert.ok(new RegExp(`\\b${method}\\(`).test(src), `${name} must declare/implement ${method}() (Story 5.7)`);
    if (name === 'web port') {
      // The web port's lifecycle IS the generated DTO, so the flag lives in schema.d.ts.
      assert.ok(Object.hasOwn(webTypeFields(src, 'OrderLifecycle'), flag), `${name} must carry ${flag} (Story 5.7)`);
    } else {
      assert.ok(new RegExp(`\\b${flag}\\b`).test(src), `${name} must carry ${flag} (Story 5.7)`);
    }
  }
});

test('the orders port carries the Story 4.9 warranty surface on BOTH platforms (twin re-check)', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');

  // `warrantyMonths` is a NEW field on the line-update input on both twins. Web
  // uses `number | null` (TS distinguishes absent vs null natively); the Dart
  // twin CANNOT use a plain `int?` — that conflates "not sent" with "clear", so
  // it reuses the sentinel tri-state (kLineFieldAbsent) exactly like kWp's meta
  // input, exposing hasWarrantyMonths so `null` can travel as "bỏ bảo hành".
  assert.match(generatedBody(webAliasDto(webPort, 'UpdateOrderLineInput')), /warrantyMonths\?: number \| null/, 'web UpdateOrderLineInput must carry warrantyMonths?: number | null (Story 4.9)');
  assert.ok(mobPort.includes('kLineFieldAbsent'), 'mobile UpdateOrderLineInput must use the sentinel tri-state kLineFieldAbsent for warrantyMonths (Story 4.9)');
  assert.ok(mobPort.includes('hasWarrantyMonths'), 'mobile UpdateOrderLineInput must expose hasWarrantyMonths so null can travel as clear (Story 4.9)');
  // The line-update input carries warrantyMonths on both twins.
  assert.ok(
    Object.hasOwn(generatedFields(webAliasDto(webPort, 'UpdateOrderLineInput')), 'warrantyMonths'),
    'web UpdateOrderLineInput must declare warrantyMonths',
  );
  const mobUpdateInput = /class UpdateOrderLineInput \{[\s\S]*?\n\}/.exec(mobPort)?.[0] ?? '';
  assert.ok(mobUpdateInput.includes('warrantyMonths'), 'mobile UpdateOrderLineInput block must declare warrantyMonths');

  // The warranty formatter is a twin helper on BOTH CartLineRow components —
  // same NAME, same rule ("X năm"/"X tháng"/empty), pinned so the two never drift.
  const webRow = readFileSync(resolve(repoRoot, 'web/src/design-system/components/CartLineRow.tsx'), 'utf8');
  const mobRow = readFileSync(resolve(repoRoot, 'mobile/lib/design_system/components/cart_line_row.dart'), 'utf8');
  for (const token of ['formatWarrantyMonths', 'năm', 'tháng']) {
    assert.ok(webRow.includes(token), `web CartLineRow missing warranty formatter token "${token}" (Story 4.9)`);
    assert.ok(mobRow.includes(token), `mobile CartLineRow missing warranty formatter token "${token}" (Story 4.9)`);
  }
  // ⚠️ The Dart twin MUST use integer division for the years branch: `60 / 12`
  // is `5.0` (double) → "5.0 năm". The web twin's `/ 12` is safe (already known
  // divisible). Guarding the operator keeps the twins semantically identical.
  assert.ok(mobRow.includes('~/ 12'), 'mobile formatWarrantyMonths must use integer division `~/ 12` (60/12==5.0 would render "5.0 năm")');
});

test('the warranty port is the SAME one-method read contract on both platforms (Story 5.9)', () => {
  const webPort = readFileSync(resolve(webDir, 'warranty-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'warranty_port.dart'), 'utf8');

  assert.match(webPort, /lookup\(sdt: string\): Promise<WarrantyLookup>/, 'web WarrantyPort must expose lookup(sdt) => WarrantyLookup');
  assert.match(mobPort, /Future<WarrantyLookup> lookup\(String sdt\)/, 'mobile WarrantyPort must expose lookup(sdt) => WarrantyLookup');

  // The client never normalises the phone (AD-9) — both port docs must SAY so,
  // because the rule is invisible in the signature: `sdt` is a String either way.
  for (const [name, src] of [['web', webPort], ['mobile', mobPort]]) {
    assert.ok(/NEVER NORMALISES A PHONE NUMBER/.test(src), `${name} warranty port doc must state that the client never normalises the phone (AD-9)`);
  }

  // Every computed field crosses the wire on BOTH twins. A field missing on one
  // side is a screen that would have to compute it locally — the exact thing
  // QĐ-4 forbids.
  // Web: WarrantyLine IS the generated WarrantyLineItemDto (Story 10.4), so the fields
  // are read from the spec it aliases. Mobile still declares them by hand until 10.7.
  assert.ok(
    webPort.includes("export type WarrantyLine = Schemas['WarrantyLineItemDto'];"),
    'web WarrantyLine must alias the generated WarrantyLineItemDto',
  );
  const lineDto = JSON.parse(readFileSync(resolve(repoRoot, 'backend/openapi/openapi.json'), 'utf8'))
    .components.schemas.WarrantyLineItemDto;
  for (const field of ['warrantyEndAt', 'remainingDays', 'remainingMonths', 'warrantyStatus', 'warrantyStartAt', 'warrantyMonths']) {
    assert.ok(lineDto.properties[field], `WarrantyLineItemDto (web WarrantyLine) missing ${field}`);
    assert.ok(mobPort.includes(field), `mobile WarrantyLine missing ${field}`);
  }
});

test('the warranty date formatter is a twin helper on BOTH screens (Story 5.9)', () => {
  // Neither platform has a date library, so this ISO→DD/MM/YYYY slice had to be
  // written twice. Pinned here for the same reason formatWarrantyMonths is: two
  // copies of one rule drift the moment nobody is watching them together.
  const webFmt = readFileSync(resolve(repoRoot, 'web/src/screens/warranty/format-ngay.ts'), 'utf8');
  const mobScreen = readFileSync(resolve(repoRoot, 'mobile/lib/screens/warranty/warranty_lookup_screen.dart'), 'utf8');

  assert.match(webFmt, /export function formatNgay\(/, 'web must expose formatNgay()');
  assert.match(mobScreen, /String dinhDangNgay\(/, 'mobile must expose dinhDangNgay()');

  // Both are a STRING SLICE, not a date parse: `warrantyEndAt` arrives at
  // 00:00:00Z, and parsing it into a local Date would shift the day in UTC+7.
  assert.ok(webFmt.includes('.slice(0, 10)'), 'web formatNgay must slice the ISO date part, not parse it');
  assert.ok(mobScreen.includes('substring(0, 10)'), 'mobile dinhDangNgay must slice the ISO date part, not parse it');
  // The fallback for a missing date is the SAME glyph on both sides.
  assert.ok(webFmt.includes("'—'"), 'web formatNgay must fall back to —');
  assert.ok(mobScreen.includes("'—'"), 'mobile dinhDangNgay must fall back to —');
});

test('the "how much is left" sentence is the SAME on both warranty screens (Story 5.9)', () => {
  // `formatWarrantyMonths` prints ONE unit and reads 0 as "0 năm", so the line a
  // staffer is actually on the phone about — weeks left, `remainingMonths == 0` —
  // would say "Còn 0 năm" on a screen that fed it straight through. Both screens
  // fall back to the day count the backend already sent; web has no widget test,
  // so this pin is the only lane that sees the web half of that agreement.
  const webScreen = readFileSync(resolve(repoRoot, 'web/src/screens/warranty/WarrantyLookupScreen.tsx'), 'utf8');
  const mobScreen = readFileSync(resolve(repoRoot, 'mobile/lib/screens/warranty/warranty_lookup_screen.dart'), 'utf8');

  for (const [name, src] of [['web', webScreen], ['mobile', mobScreen]]) {
    assert.ok(/remainingMonths >= 1/.test(src), `${name} warranty screen must guard the month sentence on a WHOLE month (0 would render "0 năm")`);
    assert.ok(/remainingDays > 0/.test(src), `${name} warranty screen must fall back to the backend's day count under one month`);
    assert.ok(src.includes(' ngày'), `${name} warranty screen missing the day-count sentence`);
    assert.ok(src.includes('Hết hạn hôm nay'), `${name} warranty screen must name the expiry day itself — "Còn 0 ngày" reads as expired`);
  }
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

test('Story 5.6 attachment surface exists on BOTH platforms (ports + gallery component)', () => {
  // A surface that ships on one platform only is worse than one that ships on
  // neither: half the users get a feature the other half cannot see, and no
  // single lane fails. The four port methods and the gallery widget are checked
  // together because they are one surface — a port with no renderer, or a
  // renderer with no port, is a dead end either way.
  const ports = [
    ['web', readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8')],
    ['mobile', readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8')],
  ];
  // Web uses the contract names (Story 10.5); mobile keeps its twin's until 10.8.
  const methods = ['listAttachments', 'addAttachments', 'removeAttachment', 'attachmentBytes'];
  const methodOf = (platform, method) => (platform === 'web' ? method : mobileMethod(method));
  for (const [platform, src] of ports) {
    for (const method of methods.map((m) => methodOf(platform, m))) {
      assert.ok(src.includes(`${method}(`), `${platform} orders port must declare ${method}()`);
    }
    assert.ok(src.includes('AttachmentItem'), `${platform} orders port must declare AttachmentItem`);
  }

  // The fakes must answer them too, or every screen test hits an unimplemented
  // method instead of the demo data it was written against.
  const fakes = [
    ['web', readFileSync(resolve(webDir, 'fake-orders-port.ts'), 'utf8')],
    ['mobile', readFileSync(resolve(mobDir, 'fake_orders_port.dart'), 'utf8')],
  ];
  for (const [platform, src] of fakes) {
    for (const method of methods.map((m) => methodOf(platform, m))) {
      assert.ok(src.includes(`${method}(`), `${platform} fake orders port must implement ${method}()`);
    }
    // The demo data must cover the branch the UI treats specially: a photo the
    // caller cannot delete. Without it, "hide the button" is never exercised.
    const flag = platform === 'web' ? 'canDelete' : mobileField('AttachmentItemDto', 'canDelete');
    assert.ok(new RegExp(`${flag}:\\s*false`).test(src), `${platform} fake must include a photo with ${flag} false`);
  }

  assert.ok(
    existsSync(resolve(repoRoot, 'web/src/design-system/components/AttachmentGallery.tsx')),
    'web gallery component missing',
  );
  assert.ok(
    existsSync(resolve(repoRoot, 'mobile/lib/design_system/components/attachment_gallery.dart')),
    'mobile gallery widget missing',
  );
});

test('the inventory port is the SAME one-method read contract on both platforms (Story 6.2)', () => {
  const webPort = readFileSync(resolve(webDir, 'inventory-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'inventory_port.dart'), 'utf8');
  assert.match(webPort, /listStock\(query\?: StockListQuery\): Promise<StockList>/, 'web InventoryPort must expose listStock(query?) => StockList');
  assert.match(mobPort, /Future<StockList> listStock\(\{String\? q\}\)/, 'mobile InventoryPort must expose listStock({q}) => StockList');
  // Web data types are the generated contract types (Story 10.5); mobile keeps its
  // twin's field names until 10.8, mapped one way through the shared table.
  assert.match(webPort, /export type StockListQuery = NonNullable<paths\['\/stock-items'\]\['get'\]\['parameters'\]\['query'\]>/, 'web StockListQuery must be the generated /stock-items query');
  assert.ok(Object.hasOwn(generatedFields('StockItemViewDto'), 'productId'), 'generated reader sees StockItemViewDto');
  const fields = [
    ['StockItemViewDto', ['productId', 'name', 'sku', 'unit', 'onHand', 'reserved', 'available', 'toPurchase', 'stockStatus']],
    ['StockListResponseDto', ['items', 'purchaseList']],
  ];
  for (const [dto, names] of fields) {
    const web = generatedFields(dto);
    for (const field of names) {
      assert.ok(Object.hasOwn(web, field), `web ${dto} missing ${field}`);
      const mob = mobileField(dto, field);
      assert.ok(new RegExp(`\\b${mob}\\b`).test(mobPort), `mobile inventory port missing ${mob} (contract ${field})`);
    }
  }
  assert.equal(webAliasDto(webPort, 'StockItemView'), 'StockItemViewDto', 'web StockItemView must be the generated StockItemViewDto');
  assert.equal(webAliasDto(webPort, 'StockList'), 'StockListResponseDto', 'web StockList must be the generated StockListResponseDto');
  for (const [name, src] of [
    ['web', webPort + generatedBody('StockItemViewDto') + generatedBody('PurchaseNeedViewDto')],
    ['mobile', mobPort],
  ]) {
    assert.ok(!/costPrice/.test(src.replace(/\/\/.*$/gm, '')), `${name} inventory port must not carry costPrice — sale reads this payload`);
  }
});

test('the stock-vouchers port is the SAME four-method contract on both platforms, field for field with openapi.json', () => {
  const webPort = readFileSync(resolve(webDir, 'stock-vouchers-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'stock_vouchers_port.dart'), 'utf8');
  assert.match(webPort, /listVouchers\(query\?: StockVoucherListQuery\): Promise<StockVoucherList>/, 'web listVouchers(query?) => StockVoucherList');
  assert.match(mobPort, /Future<StockVoucherList> listVouchers\(\{String\? type, bool\? isReturn\}\)/, 'mobile listVouchers({type, isReturn}) => StockVoucherList');
  assert.match(webPort, /getVoucher\(id: string\): Promise<StockVoucherDetail>/, 'web getVoucher(id) => StockVoucherDetail');
  assert.match(mobPort, /Future<StockVoucherDetail> getVoucher\(String id\)/, 'mobile getVoucher(id) => StockVoucherDetail');
  assert.match(webPort, /createVoucher\(input: CreateStockVoucherInput\): Promise<StockVoucherDetail>/, 'web createVoucher(input) => StockVoucherDetail');
  assert.match(mobPort, /Future<StockVoucherDetail> createVoucher\(CreateStockVoucherInput input\)/, 'mobile createVoucher(input) => StockVoucherDetail');
  assert.match(webPort, /createReturnVoucher\(\s*originVoucherId: string,\s*input: CreateReturnVoucherInput,?\s*\): Promise<StockVoucherDetail>/, 'web createReturnVoucher(originVoucherId, input) => StockVoucherDetail');
  assert.match(mobPort, /Future<StockVoucherDetail> createReturnVoucher\(\s*String originVoucherId,\s*\{\s*String\? note,\s*required List<CreateReturnVoucherLineInput> lines,?\s*\}\)/, 'mobile createReturnVoucher(originVoucherId, {note, lines}) => StockVoucherDetail');

  // Every property of every voucher DTO in the backend's generated spec is in BOTH ports —
  // parity with the contract, not only between the twins. The web types ARE the generated
  // ones (Story 10.5): each top DTO is aliased by the web port and the nested ones are
  // referenced from those. Mobile keeps its twin's names until 10.8: the shared one-way map
  // is the ONLY place a contract name may differ, and every voucher entry of it is used here.
  const spec = JSON.parse(readFileSync(resolve(repoRoot, 'backend/openapi/openapi.json'), 'utf8'));
  const aliased = {
    StockVoucherCreatorDto: 'StockVoucherCreator',
    StockVoucherSummaryDto: 'StockVoucherSummary',
    StockVoucherListResponseDto: 'StockVoucherList',
    StockVoucherLineResponseDto: 'StockVoucherLine',
    StockVoucherDetailDto: 'StockVoucherDetail',
    StockVoucherLineRequestDto: 'CreateStockVoucherLineInput',
    CreateStockVoucherRequestDto: 'CreateStockVoucherInput',
    CreateReturnVoucherRequestDto: 'CreateReturnVoucherInput',
  };
  const nested = {
    StockVoucherReturnOfDto: 'StockVoucherDetailDto',
    StockVoucherReturnRefDto: 'StockVoucherDetailDto',
    ReturnVoucherLineRequestDto: 'CreateReturnVoucherRequestDto',
  };
  for (const [dto, type] of Object.entries(aliased)) {
    assert.equal(webAliasDto(webPort, type), dto, `web ${type} must be the generated ${dto}`);
  }
  for (const [dto, parent] of Object.entries(nested)) {
    assert.ok(generatedBody(parent).includes(`components["schemas"]["${dto}"]`), `web ${parent} must reference ${dto}`);
  }
  const mapped = new Set();
  let fields = 0;
  for (const dto of [...Object.keys(aliased), ...Object.keys(nested)]) {
    const schema = spec.components.schemas[dto];
    assert.ok(schema, `openapi.json missing ${dto}`);
    const props = { ...(schema.properties ?? {}) };
    for (const part of schema.allOf ?? []) Object.assign(props, part.properties ?? {});
    assert.deepEqual(Object.keys(generatedFields(dto)).sort(), Object.keys(props).sort(), `web ${dto} must carry exactly the contract fields`);
    for (const field of Object.keys(props)) {
      const mob = mobileField(dto, field);
      if (mob !== field) mapped.add(`${dto}.${field}`);
      assert.ok(new RegExp(`\\b${mob}\\b`).test(mobPort), `mobile stock-vouchers port missing ${mob} (contract ${dto}.${field})`);
      fields += 1;
    }
  }
  assert.ok(fields >= 30, `checked only ${fields} DTO fields — the spec reader went blind`);
  const voucherEntries = Object.entries(WEB_TO_MOBILE_FIELD)
    .filter(([dto]) => dto in aliased || dto in nested)
    .flatMap(([dto, map]) => Object.keys(map).map((f) => `${dto}.${f}`));
  assert.deepEqual([...mapped].sort(), voucherEntries.sort(), 'every voucher entry of the web→mobile map must be used');
  // The voucher payload never carries the product's current cost price.
  for (const [name, src] of [
    ['web', webPort + Object.keys(aliased).map((dto) => generatedBody(dto)).join('\n')],
    ['mobile', mobPort],
  ]) {
    assert.ok(!/costPrice/.test(src.replace(/\/\/.*$/gm, '')), `${name} stock-vouchers port must not carry costPrice`);
  }
});

test('the orders port carries the stock-issue surface on BOTH platforms, field for field with openapi.json', () => {
  const webPort = readFileSync(resolve(webDir, 'orders-port.ts'), 'utf8');
  const mobPort = readFileSync(resolve(mobDir, 'orders_port.dart'), 'utf8');
  assert.match(webPort, /getStockIssue\(orderId: string\): Promise<OrderStockIssueView>/, 'web getStockIssue(orderId) => OrderStockIssueView');
  assert.match(mobPort, /Future<OrderStockIssueView> getStockIssue\(String orderId\)/, 'mobile getStockIssue(orderId) => OrderStockIssueView');
  assert.match(webPort, /issueStock\(orderId: string\): Promise<OrderStockIssueResult>/, 'web issueStock(orderId) => OrderStockIssueResult');
  assert.match(mobPort, /Future<OrderStockIssueResult> issueStock\(String orderId\)/, 'mobile issueStock(orderId) => OrderStockIssueResult');
  assert.match(webPort, /getStockCheck\(orderId: string\): Promise<OrderStockCheck>/, 'web getStockCheck(orderId) => OrderStockCheck');
  assert.match(mobPort, /Future<OrderStockCheck> getStockCheck\(String orderId\)/, 'mobile getStockCheck(orderId) => OrderStockCheck');
  for (const [name, src] of [['web', webPort], ['mobile', mobPort]]) {
    // POST :id/stock-issue carries no body — a client that sends lines or quantities
    // has an opinion about what leaves the warehouse, and that is the backend's.
    assert.ok(!/issueStock\(\s*(?:orderId: string|String orderId)\s*,/.test(src), `${name} issueStock must take the order id only`);
  }
  // The "Đã giao" event lives in the port, never as a literal in a screen.
  assert.match(webPort, /export const EVENT_DELIVERED = 'xong_giao';/, 'web port must export EVENT_DELIVERED');
  assert.match(mobPort, /const String kEventDelivered = 'xong_giao';/, 'mobile port must export kEventDelivered');

  // Field for field INSIDE each type's own body (comments stripped), with the
  // optionality the spec declares — a name that merely appears somewhere else in
  // the port (`qty`, `unit`, `lines` appear many times) proves nothing.
  const spec = JSON.parse(readFileSync(resolve(repoRoot, 'backend/openapi/openapi.json'), 'utf8'));
  const webCode = webPort.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const mobCode = mobPort.replace(/\/\/.*$/gm, '');
  let checked = 0;
  for (const [dto, type] of [
    ['OrderStockIssueLineDto', 'OrderStockIssueLine'],
    ['OrderStockIssueViewDto', 'OrderStockIssueView'],
    ['OrderStockIssueResultDto', 'OrderStockIssueResult'],
    ['OrderStockCheckLineDto', 'OrderStockCheckLine'],
    ['OrderStockCheckDto', 'OrderStockCheck'],
  ]) {
    const schema = spec.components.schemas[dto];
    assert.ok(schema, `openapi.json missing ${dto}`);
    const required = new Set(schema.required ?? []);
    const expected = Object.fromEntries(Object.keys(schema.properties ?? {}).map((k) => [k, !required.has(k)]));
    // Web: the port type IS the generated contract type (Story 10.5).
    assert.equal(webAliasDto(webCode, type), dto, `web ${type} must be the generated ${dto}`);
    const mobBody = typeBody(mobCode, `class ${type}`);
    assert.deepEqual(generatedFields(dto), expected, `web ${type} must declare exactly the ${dto} fields with the same optionality`);
    assert.deepEqual(dartFields(mobBody), expected, `mobile ${type} must declare exactly the ${dto} fields with the same nullability`);
    checked += Object.keys(expected).length;
  }
  assert.ok(checked >= 23, `checked only ${checked} DTO fields — the spec reader went blind`);
  // The stock warning fields are among the compared ones — a spec reader that
  // skipped them would leave the new contract unguarded.
  for (const [dto, field] of [
    ['OrderStockIssueLineDto', 'shortfall'],
    ['OrderStockIssueViewDto', 'blocked'],
    ['OrderStockCheckLineDto', 'status'],
  ]) {
    assert.ok(spec.components.schemas[dto].properties[field], `openapi.json ${dto} must declare ${field}`);
  }
});

/** The `{ … }` body of a declaration, up to the first `}` at column 0. */
function typeBody(code, head) {
  const match = new RegExp(`${head} \\{[\\s\\S]*?\\n\\}`).exec(code);
  assert.ok(match, `declaration not found: ${head}`);
  return match[0];
}

/** `final T name;` fields of a Dart class body ⇒ { name: nullable }. */
function dartFields(body) {
  return Object.fromEntries(
    [...body.matchAll(/^\s+final ([\w<>, ]+?)(\??) (\w+);/gm)].map((m) => [m[3], m[2] === '?']),
  );
}

test('the type-body field readers see a missing or wrongly-optional field (guard is not toothless)', () => {
  const dart = 'class X {\n  const X();\n  final String a;\n  final List<int>? b;\n}\n';
  assert.deepEqual(dartFields(typeBody(dart, 'class X')), { a: false, b: true });
  assert.notDeepEqual(dartFields(typeBody('class X {\n  final String a;\n}\n', 'class X')), { a: false, b: true });
});
