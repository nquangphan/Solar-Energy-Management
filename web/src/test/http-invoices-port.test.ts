// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/api-error';
import { HttpInvoicesPort } from '../api/http-invoices-port';
import { envelope, json, setupHarness, target } from './http-adapter-harness';

const SUMMARY = {
  id: 'inv1',
  invoiceNo: 'HDBH-0001',
  versionNo: 1,
  issuedAt: '2026-10-01T00:00:00.000Z',
  customerName: 'Nguyễn Văn A',
  customerTaxCode: null,
  vatRate: 8,
  applyVat: true,
  subtotal: 76_862_000,
  discountAmount: 0,
  vatAmount: 6_148_960,
  total: 83_010_960,
  lineCount: 1,
};
const PDF_INFO = { fileName: 'HDBH-0001.pdf', pdfSize: 4, exportedAt: '2026-10-01T00:00:00.000Z' };

describe('HttpInvoicesPort', () => {
  it('getOverview / createInvoice / getInvoice hit the invoice routes', async () => {
    const overview = { creatable: true, blockedReason: null, currentInvoiceId: null, invoices: [] };
    const detail = { ...SUMMARY, orderId: 'o1', quoteNo: 'BG-0001', customerPhone: '+84903176968', pdf: null };
    const h = setupHarness((request) => {
      const key = `${request.method} ${new URL(request.url).pathname}`;
      if (key === 'GET /orders/o1/invoices') return json(200, overview);
      if (key === 'POST /orders/o1/invoices') return json(200, SUMMARY);
      if (key === 'GET /orders/o1/invoices/inv1') return json(200, detail);
      return json(500, { unexpected: key });
    });
    const port = new HttpInvoicesPort(h.client);
    await expect(port.getOverview('o1')).resolves.toEqual(overview);
    await expect(port.createInvoice('o1')).resolves.toEqual(SUMMARY);
    await expect(port.getInvoice('o1', 'inv1')).resolves.toEqual(detail);
    expect(h.fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('exportInvoicePdf POSTs the pdf route and returns the stored file info', async () => {
    const h = setupHarness(() => json(200, PDF_INFO));
    await expect(new HttpInvoicesPort(h.client).exportInvoicePdf('o1', 'inv1')).resolves.toEqual(PDF_INFO);
    expect(h.requests[0].method).toBe('POST');
    expect(target(h.requests[0])).toBe('/orders/o1/invoices/inv1/pdf');
  });

  it('downloadInvoicePdf returns a File named by Content-Disposition, fallback `<invoiceId>.pdf`', async () => {
    let named = true;
    const h = setupHarness(
      () =>
        new Response('%PDF', {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            ...(named ? { 'content-disposition': 'attachment; filename="HDBH-0001.pdf"' } : {}),
          },
        }),
    );
    const port = new HttpInvoicesPort(h.client);
    const file = await port.downloadInvoicePdf('o1', 'inv1');
    expect(h.requests[0].method).toBe('GET');
    expect(target(h.requests[0])).toBe('/orders/o1/invoices/inv1/pdf');
    expect(file.name).toBe('HDBH-0001.pdf');
    expect(file.type).toBe('application/pdf');
    named = false;
    expect((await port.downloadInvoicePdf('o1', 'inv1')).name).toBe('inv1.pdf');
  });

  it('downloadInvoicePdf before the first export is the 404 envelope, not a file', async () => {
    const h = setupHarness(() => envelope(404, 'NOT_FOUND', 'Hoá đơn chưa xuất PDF.'));
    const error = await new HttpInvoicesPort(h.client).downloadInvoicePdf('o1', 'inv1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Hoá đơn chưa xuất PDF.' });
  });
});
