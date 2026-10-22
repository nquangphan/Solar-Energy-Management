// Every entry of the temporary web→mobile name map is LIVE: the contract name exists in
// openapi.json, the mobile twin still uses the old name, and the web no longer does. A stale
// entry (mobile renamed early, a field removed) fails here instead of hiding a drift.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments.mjs';
import { WEB_TO_MOBILE_FIELD, WEB_TO_MOBILE_METHOD } from './web-mobile-contract-map.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const spec = JSON.parse(readFileSync(resolve(repoRoot, 'backend/openapi/openapi.json'), 'utf8'));
const read = (rel) => readFileSync(resolve(repoRoot, rel), 'utf8');

const mobilePorts = [
  'orders_port.dart',
  'inventory_port.dart',
  'stock_vouchers_port.dart',
  'invoices_port.dart',
].map((f) => stripComments(read(`mobile/lib/design_system/session/${f}`)));

/** Contract DTO → the mobile class holding its fields (a subclass is checked through its parent). */
const MOBILE_CLASS = {
  OrderResponseDto: 'Order',
  OrderListItemDto: 'OrderListItem',
  DiscountPendingItemDto: 'DiscountPendingItem',
  InvoiceDetailResponseDto: 'InvoiceDetail',
  OrderLifecycleStepDto: 'OrderLifecycleStep',
  OrderLifecycleResponseDto: 'OrderLifecycle',
  StatusChangeResponseDto: 'StatusChangeResult',
  AttachmentItemDto: 'AttachmentItem',
  OrderVersionItemDto: 'OrderVersionItem',
  VersionChangesDto: 'OrderVersionChange',
  QtyChangeDto: 'OrderVersionQtyChange',
  StockItemViewDto: 'StockItemView',
  PurchaseNeedViewDto: 'CanMuaView',
  StockListResponseDto: 'StockList',
  StockVoucherSummaryDto: 'StockVoucherSummary',
  StockVoucherDetailDto: 'StockVoucherSummary', // `class StockVoucherDetail extends StockVoucherSummary`
  StockVoucherLineResponseDto: 'StockVoucherLine',
  StockVoucherReturnOfDto: 'StockVoucherReturnOf',
  StockVoucherReturnRefDto: 'StockVoucherReturnRef',
};

/** The body of `class <name>` in the mobile ports, up to its closing `}` at column 0. */
function mobileClassBody(name) {
  const re = new RegExp(`\\nclass ${name}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`);
  const bodies = mobilePorts.map((src) => re.exec(src)?.[1]).filter((b) => b !== undefined);
  assert.equal(bodies.length, 1, `mobile ports must declare class ${name} exactly once`);
  return bodies[0];
}

function filesUnder(rel, ext) {
  return readdirSync(resolve(repoRoot, rel), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && ext.some((x) => e.name.endsWith(x)))
    .map((e) => join(e.parentPath, e.name));
}
// All of web/src except the generated contract (whose names are the contract's).
const webFiles = filesUnder('web/src', ['.ts', '.tsx']).filter((f) => !f.includes('/api/generated/'));
const webCode = webFiles.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]);

test('every mapped contract field exists in openapi.json; its mobile twin class still declares the old name', () => {
  assert.deepEqual(Object.keys(MOBILE_CLASS).sort(), Object.keys(WEB_TO_MOBILE_FIELD).sort(), 'every mapped DTO names its mobile class');
  let entries = 0;
  for (const [dto, fields] of Object.entries(WEB_TO_MOBILE_FIELD)) {
    const props = spec.components.schemas[dto]?.properties;
    assert.ok(props, `openapi.json has no ${dto}`);
    const body = mobileClassBody(MOBILE_CLASS[dto]);
    for (const [contract, mobile] of Object.entries(fields)) {
      assert.ok(Object.hasOwn(props, contract), `${dto}.${contract} is not a contract field`);
      assert.notEqual(contract, mobile, `${dto}.${contract} maps to itself — drop the entry`);
      assert.ok(
        new RegExp(`\\n\\s+final [\\w<>?, ]+ ${mobile};`).test(body),
        `mobile ${MOBILE_CLASS[dto]} no longer declares ${mobile} (${dto}.${contract}) — drop the entry`,
      );
      entries += 1;
    }
  }
  assert.ok(entries >= 40, `only ${entries} field entries read — the map reader went blind`);
});

test('the class reader is scoped: a name declared only in another class is not found', () => {
  // `ten` lives in StockItemView, CanMuaView, StockVoucherLine, OrderVersionQtyChange — never in Order.
  assert.ok(/\n\s+final [\w<>?, ]+ ten;/.test(mobileClassBody('StockItemView')));
  assert.ok(!/\n\s+final [\w<>?, ]+ ten;/.test(mobileClassBody('Order')));
});

test('nowhere in web/src reads a mapped old field name or calls a mapped old method', () => {
  // Measured 2026-10-22: 150+ files (api, app, design-system, screens, test).
  assert.ok(webCode.length >= 120, `only ${webCode.length} web files scanned`);
  assert.ok(webCode.some(([f]) => f.endsWith('/design-system/components/AttachmentGallery.tsx')), 'scan reaches shared components');
  assert.ok(webCode.some(([f]) => f.endsWith('/app/AppRoutes.tsx')), 'scan reaches the router');
  const old = new Set(Object.values(WEB_TO_MOBILE_FIELD).flatMap((f) => Object.values(f)));
  for (const name of old) {
    for (const [file, src] of webCode) {
      assert.ok(!new RegExp(`\\.${name}\\b`).test(src), `${file} still reads .${name}`);
    }
  }
  for (const method of Object.values(WEB_TO_MOBILE_METHOD)) {
    for (const [file, src] of webCode) {
      assert.ok(!new RegExp(`\\b${method}\\s*\\(`).test(src), `${file} still calls ${method}()`);
    }
  }
});

test('every mapped method: web port declares the contract name, mobile the old one', () => {
  const webPort = stripComments(read('web/src/design-system/session/orders-port.ts'));
  const mobPort = mobilePorts[0];
  assert.ok(Object.keys(WEB_TO_MOBILE_METHOD).length === 6, 'the six Vietnamese order methods are mapped');
  for (const [web, mobile] of Object.entries(WEB_TO_MOBILE_METHOD)) {
    assert.match(webPort, new RegExp(`\\n  ${web}\\(`), `web OrdersPort must declare ${web}()`);
    assert.ok(!webPort.includes(`${mobile}(`), `web OrdersPort still declares ${mobile}()`);
    assert.match(mobPort, new RegExp(`\\b${mobile}\\(`), `mobile OrdersPort no longer declares ${mobile}() — drop the entry`);
  }
});
