// @vitest-environment node
// Every method of the six order/stock/money/document adapters lets a refusal through as
// the transport's ApiError — none swallows it into a value. Each case table is typed as
// `Record<keyof <Port>, …>`, so a port method without a case does not compile.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpContractsPort } from '../api/http-contracts-port';
import { HttpInventoryPort } from '../api/http-inventory-port';
import { HttpInvoicesPort } from '../api/http-invoices-port';
import { HttpOrdersPort } from '../api/http-orders-port';
import { HttpPaymentsPort } from '../api/http-payments-port';
import { HttpStockVouchersPort } from '../api/http-stock-vouchers-port';
import type {
  ContractsPort,
  InventoryPort,
  InvoicesPort,
  OrdersPort,
  PaymentsPort,
  StockVouchersPort,
} from '../design-system/session';
import { envelope, setupHarness, type Harness } from './http-adapter-harness';

/** The body never matters here: the server refuses every request before reading it. */
const INPUT = {} as never;
const photo = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

type Cases<P> = Record<keyof P, (port: P) => Promise<unknown>>;

const ORDERS: Cases<OrdersPort> = {
  create: (p) => p.create(INPUT),
  get: (p) => p.get('o1'),
  list: (p) => p.list({}),
  getLifecycle: (p) => p.getLifecycle('o1'),
  listVersions: (p) => p.listVersions('o1'),
  addLine: (p) => p.addLine('o1', INPUT),
  updateLine: (p) => p.updateLine('o1', 'l1', INPUT),
  removeLine: (p) => p.removeLine('o1', 'l1'),
  updateScopeFlags: (p) => p.updateScopeFlags('o1', INPUT),
  updateOrderMeta: (p) => p.updateOrderMeta('o1', INPUT),
  previewTotal: (p) => p.previewTotal(INPUT),
  confirmOrder: (p) => p.confirmOrder('o1'),
  reviseOrder: (p) => p.reviseOrder('o1'),
  applyDiscount: (p) => p.applyDiscount('o1', INPUT),
  resolveDiscount: (p) => p.resolveDiscount('o1', INPUT),
  listPendingDiscounts: (p) => p.listPendingDiscounts(),
  exportQuote: (p) => p.exportQuote('o1'),
  transition: (p) => p.transition('o1', 'xong_giao', [photo]),
  cancel: (p) => p.cancel('o1', 'Khách đổi ý'),
  listAttachments: (p) => p.listAttachments('o1'),
  addAttachments: (p) => p.addAttachments('o1', [photo]),
  removeAttachment: (p) => p.removeAttachment('o1', 'a1'),
  attachmentBytes: (p) => p.attachmentBytes('o1', 'a1'),
  getStockIssue: (p) => p.getStockIssue('o1'),
  issueStock: (p) => p.issueStock('o1'),
  getStockCheck: (p) => p.getStockCheck('o1'),
};
const INVENTORY: Cases<InventoryPort> = {
  listStock: (p) => p.listStock({ q: 'pin' }),
};
const STOCK_VOUCHERS: Cases<StockVouchersPort> = {
  listVouchers: (p) => p.listVouchers({}),
  getVoucher: (p) => p.getVoucher('pk1'),
  createVoucher: (p) => p.createVoucher(INPUT),
  createReturnVoucher: (p) => p.createReturnVoucher('pk1', INPUT),
};
const PAYMENTS: Cases<PaymentsPort> = {
  getSchedule: (p) => p.getSchedule('o1'),
  replaceSchedule: (p) => p.replaceSchedule('o1', INPUT),
  recordPayment: (p) => p.recordPayment('o1', INPUT),
};
const CONTRACTS: Cases<ContractsPort> = {
  getOverview: (p) => p.getOverview('o1'),
  generateContract: (p) => p.generateContract('o1'),
  downloadContractPdf: (p) => p.downloadContractPdf('o1', 'c1'),
};
const INVOICES: Cases<InvoicesPort> = {
  getOverview: (p) => p.getOverview('o1'),
  createInvoice: (p) => p.createInvoice('o1'),
  getInvoice: (p) => p.getInvoice('o1', 'i1'),
  exportInvoicePdf: (p) => p.exportInvoicePdf('o1', 'i1'),
  downloadInvoicePdf: (p) => p.downloadInvoicePdf('o1', 'i1'),
};

const ADAPTERS: { name: string; build: (h: Harness) => object; cases: Record<string, (port: never) => Promise<unknown>> }[] = [
  { name: 'HttpOrdersPort', build: (h) => new HttpOrdersPort(h.client), cases: ORDERS },
  { name: 'HttpInventoryPort', build: (h) => new HttpInventoryPort(h.client), cases: INVENTORY },
  { name: 'HttpStockVouchersPort', build: (h) => new HttpStockVouchersPort(h.client), cases: STOCK_VOUCHERS },
  { name: 'HttpPaymentsPort', build: (h) => new HttpPaymentsPort(h.client), cases: PAYMENTS },
  { name: 'HttpContractsPort', build: (h) => new HttpContractsPort(h.client), cases: CONTRACTS },
  { name: 'HttpInvoicesPort', build: (h) => new HttpInvoicesPort(h.client), cases: INVOICES },
];

const CASES = ADAPTERS.flatMap(({ name, build, cases }) =>
  Object.entries(cases).map(([method, call]) => ({ label: `${name}.${method}`, build, method, call })),
);

describe('the order/stock/money/document adapters never swallow a refusal', () => {
  it('covers every method of the six adapters (not blind)', () => {
    // 26 + 1 + 4 + 3 + 3 + 5 — the typed tables above make a missing method a compile error.
    expect(CASES).toHaveLength(42);
  });

  it.each(CASES)('$label rejects the 409 envelope as ApiError', async ({ build, method, call }) => {
    const h = setupHarness(() => envelope(409, 'CONFLICT', 'Bị từ chối.'));
    const port = build(h);
    expect(typeof (port as Record<string, unknown>)[method]).toBe('function');
    const error = await (call as (p: object) => Promise<unknown>)(port).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Bị từ chối.' });
    expect(h.fetchImpl).toHaveBeenCalledTimes(1);
  });
});
