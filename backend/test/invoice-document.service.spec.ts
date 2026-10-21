import { AppException } from '../src/common/errors/app.exception';
import type { EventBus } from '../src/events/event-bus';
import { InvoicePdfExported } from '../src/invoices/domain/invoice-events';
import {
  INVOICE_NOT_FOUND_MESSAGE,
  INVOICE_PDF_NOT_EXPORTED_MESSAGE,
  InvoiceDocumentService,
} from '../src/invoices/invoice-document.service';
import { quoteNumberOf } from '../src/orders/domain/quote-number';
import type { OrdersService } from '../src/orders/orders.service';
import type { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { StoragePort } from '../src/storage/storage.port';

/**
 * Unit `InvoiceDocumentService` — HERMETIC. Every collaborator is a mock that appends to ONE log,
 * so the pipeline order (scope → [lock → replay check → read → render → upload → create] →
 * commit → publish) is asserted directly. The transaction mock RUNS its callback and logs the
 * commit only when it resolves, so "publish after commit" is measured, not assumed.
 */

const ORDER_ID = '3f2a9b1c-1111-4222-8333-444444444444';
const INVOICE_ID = 'bbbbbbbb-1111-4222-8333-444444444444';
const ACTOR = 'acc-invoices-1';
const PERMS = new Set<string>(['orders.view_all', 'invoices.manage']);
const PDF = Buffer.from('%PDF-1.4 invoice');
const CREATED_AT = new Date('2026-07-06T02:00:00Z');

/** An invoice row as Prisma returns it: money columns are `bigint`. */
function invoiceRow(pdf: unknown = null) {
  return {
    id: INVOICE_ID,
    seq: 731,
    invoiceNo: 'HD-2026-0731',
    orderId: ORDER_ID,
    orderVersionId: 'v-1',
    customerSdt: '+84901234567',
    customerName: 'VP Công Chứng Lê Đình Thao',
    customerTaxCode: '0316552018',
    customerAddress: '122 Trần Não, TP. Thủ Đức',
    sellerLegalName: 'CÔNG TY NLMT PHƯƠNG NAM',
    sellerTaxCode: '0312998771',
    // Seven DISTINCT values: a mapping that swaps two seller fields cannot pass.
    sellerAddress: '12 Nguyễn Văn Bảo, Gò Vấp',
    sellerRepresentative: 'Nguyễn Văn An',
    sellerRepresentativeTitle: 'Giám đốc',
    sellerPhone: '028 3899 1234',
    sellerBankAccount: '0071001234567 Vietcombank',
    vatRate: 8,
    applyVat: true,
    subtotal: 76_862_000n,
    discountAmount: 0n,
    vatAmount: 6_148_960n,
    total: 83_010_960n,
    issuedAt: new Date('2026-07-05T18:30:00Z'),
    createdByAccountId: ACTOR,
    createdAt: new Date('2026-07-05T18:30:00Z'),
    orderVersion: { versionNo: 2 },
    lines: [
      {
        displayOrder: 1,
        name: 'Tấm pin AE 630W',
        unit: 'Tấm',
        qty: 14,
        unitPrice: 2_583_000,
        amount: 36_162_000n,
      },
      {
        displayOrder: 2,
        name: 'Inverter Solplanet ASW8000-S',
        unit: 'Bộ',
        qty: 1,
        unitPrice: 18_500_000,
        amount: 18_500_000n,
      },
    ],
    pdf,
  };
}

function pdfRow() {
  return {
    id: 'pdf-1',
    invoiceId: INVOICE_ID,
    pdfKey: `invoices/${ORDER_ID}/${INVOICE_ID}.pdf`,
    pdfSize: PDF.length,
    fileName: 'hoa-don-HD-2026-0731',
    createdByAccountId: ACTOR,
    createdAt: CREATED_AT,
  };
}

describe('InvoiceDocumentService (unit, hermetic)', () => {
  let log: string[];
  let assertScoped: jest.Mock;
  let queryRaw: jest.Mock;
  let lockedRows: { id: string }[];
  let existingPdf: unknown;
  let pdfFindUnique: jest.Mock;
  let invoiceFindUnique: jest.Mock;
  let invoiceFindFirst: jest.Mock;
  let pdfCreate: jest.Mock;
  let renderPdf: jest.Mock;
  let putObject: jest.Mock;
  let getObject: jest.Mock;
  let publish: jest.Mock;
  let service: InvoiceDocumentService;
  let prismaMock: PrismaService;
  const prisma$transaction = () =>
    (prismaMock as unknown as { $transaction: jest.Mock }).$transaction;

  const step =
    <T>(name: string, value?: T) =>
    () => {
      log.push(name);
      return Promise.resolve(value);
    };

  beforeEach(() => {
    log = [];
    lockedRows = [{ id: INVOICE_ID }];
    existingPdf = null;
    assertScoped = jest.fn().mockImplementation(step('scope'));
    queryRaw = jest.fn().mockImplementation(() => step('lock', lockedRows)());
    pdfFindUnique = jest
      .fn()
      .mockImplementation(() => step('replay-check', existingPdf)());
    invoiceFindUnique = jest
      .fn()
      .mockImplementation(() => step('read', invoiceRow())());
    invoiceFindFirst = jest
      .fn()
      .mockImplementation(() => step('find', invoiceRow())());
    pdfCreate = jest.fn().mockImplementation(() => step('create', pdfRow())());
    renderPdf = jest.fn().mockImplementation(step('render', PDF));
    putObject = jest.fn().mockImplementation(step('upload'));
    getObject = jest
      .fn()
      .mockImplementation(
        step('download', { body: PDF, contentType: 'application/pdf' }),
      );
    publish = jest.fn().mockImplementation(step('publish'));
    const prisma = {
      invoice: { findUnique: invoiceFindUnique, findFirst: invoiceFindFirst },
      invoicePdf: { findUnique: pdfFindUnique, create: pdfCreate },
      $queryRaw: queryRaw,
    } as unknown as PrismaService;
    (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest
      .fn()
      .mockImplementation(async (body: (tx: unknown) => Promise<unknown>) => {
        const result = await body(prisma);
        log.push('commit');
        return result;
      });
    prismaMock = prisma;
    service = new InvoiceDocumentService(
      { assertScoped } as unknown as OrdersService,
      prisma,
      { publish } as unknown as EventBus,
      { putObject, getObject } as unknown as StoragePort,
      { renderPdf } as unknown as QuoteRendererPort,
    );
  });

  const exportPdf = () => service.exportPdf(ACTOR, PERMS, ORDER_ID, INVOICE_ID);

  async function rejection(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (e) {
      return e as AppException;
    }
    throw new Error('expected a rejection');
  }

  describe('exportPdf — first export', () => {
    it('runs scope → [lock → replay check → read → render → upload → create] → commit → publish', async () => {
      await exportPdf();
      expect(log).toEqual([
        'scope',
        'lock',
        'replay-check',
        'read',
        'render',
        'upload',
        'create',
        'commit',
        'publish',
      ]);
      expect(renderPdf).toHaveBeenCalledTimes(1);
      expect(putObject).toHaveBeenCalledTimes(1);
      expect(pdfCreate).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
    });

    it('locks the invoice row of THIS order as the first statement of the transaction', async () => {
      await exportPdf();
      expect(queryRaw).toHaveBeenCalledTimes(1);
      const [sql, ...values] = queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(sql.join('?')).toBe(
        'SELECT id FROM invoices WHERE id = ? AND order_id = ? FOR UPDATE',
      );
      expect(values).toEqual([INVOICE_ID, ORDER_ID]);
      expect(log.indexOf('lock')).toBe(log.indexOf('scope') + 1);
    });

    it('gives the transaction 30 s: a cold Chromium render plus the upload outlasts the 5 s default', async () => {
      await exportPdf();
      expect((prisma$transaction() as jest.Mock).mock.calls[0][1]).toEqual({
        timeout: 30_000,
      });
    });

    it('scopes with the caller and the order before anything else', async () => {
      await exportPdf();
      expect(assertScoped).toHaveBeenCalledTimes(1);
      expect(assertScoped).toHaveBeenCalledWith(ACTOR, PERMS, ORDER_ID);
    });

    it('renders the snapshot, uploads at the deterministic key and records the file', async () => {
      const result = await exportPdf();
      const html = renderPdf.mock.calls[0][0] as string;
      expect(html).toContain('HD-2026-0731');
      expect(html).toContain(quoteNumberOf(ORDER_ID));
      expect(html).toContain('83.010.960');
      expect(html).toContain('36.162.000');
      expect(putObject).toHaveBeenCalledWith(
        `invoices/${ORDER_ID}/${INVOICE_ID}.pdf`,
        PDF,
        'application/pdf',
      );
      expect(pdfCreate).toHaveBeenCalledWith({
        data: {
          invoiceId: INVOICE_ID,
          pdfKey: `invoices/${ORDER_ID}/${INVOICE_ID}.pdf`,
          pdfSize: PDF.length,
          fileName: 'hoa-don-HD-2026-0731',
          createdByAccountId: ACTOR,
        },
      });
      expect(result).toEqual({
        fileName: 'hoa-don-HD-2026-0731.pdf',
        pdfSize: PDF.length,
        exportedAt: CREATED_AT,
      });
    });

    it('publishes InvoicePdfExported once with the stored row timestamp', async () => {
      await exportPdf();
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0][0] as InvoicePdfExported;
      expect(event).toBeInstanceOf(InvoicePdfExported);
      expect(event.type).toBe('InvoicePdfExported');
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.target).toEqual({ type: 'Order', id: ORDER_ID });
      expect(event.after).toEqual({
        invoiceId: INVOICE_ID,
        invoiceNo: 'HD-2026-0731',
        fileName: 'hoa-don-HD-2026-0731.pdf',
      });
      expect(event.occurredAt).toBe(CREATED_AT);
      expect(() => JSON.stringify(event)).not.toThrow();
    });
  });

  describe('exportPdf — replay', () => {
    it('returns the stored file with no render, no upload, no row and no event', async () => {
      existingPdf = pdfRow();
      const result = await exportPdf();
      expect(log).toEqual(['scope', 'lock', 'replay-check', 'commit']);
      expect(renderPdf).toHaveBeenCalledTimes(0);
      expect(putObject).toHaveBeenCalledTimes(0);
      expect(pdfCreate).toHaveBeenCalledTimes(0);
      expect(publish).toHaveBeenCalledTimes(0);
      expect(result).toEqual({
        fileName: 'hoa-don-HD-2026-0731.pdf',
        pdfSize: PDF.length,
        exportedAt: CREATED_AT,
      });
    });
  });

  describe('exportPdf — failures', () => {
    it('scope failure ⇒ no invoice read, no lock, no R2', async () => {
      assertScoped.mockRejectedValue(new Error('scope'));
      await expect(exportPdf()).rejects.toThrow('scope');
      expect(queryRaw).toHaveBeenCalledTimes(0);
      expect(pdfFindUnique).toHaveBeenCalledTimes(0);
      expect(invoiceFindUnique).toHaveBeenCalledTimes(0);
      expect(renderPdf).toHaveBeenCalledTimes(0);
      expect(putObject).toHaveBeenCalledTimes(0);
      expect(publish).toHaveBeenCalledTimes(0);
    });

    it('invoice not on this order ⇒ 404 "Không tìm thấy hoá đơn.", nothing else', async () => {
      lockedRows = [];
      const error = await rejection(exportPdf());
      expect(error).toBeInstanceOf(AppException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe(INVOICE_NOT_FOUND_MESSAGE);
      expect(pdfFindUnique).toHaveBeenCalledTimes(0);
      expect(renderPdf).toHaveBeenCalledTimes(0);
      expect(putObject).toHaveBeenCalledTimes(0);
      expect(publish).toHaveBeenCalledTimes(0);
    });

    it('render throws ⇒ no upload, no row, no event', async () => {
      renderPdf.mockRejectedValue(new Error('chromium'));
      await expect(exportPdf()).rejects.toThrow('chromium');
      expect(putObject).toHaveBeenCalledTimes(0);
      expect(pdfCreate).toHaveBeenCalledTimes(0);
      expect(publish).toHaveBeenCalledTimes(0);
      expect(log).not.toContain('commit');
    });

    it('empty render ⇒ no upload, no row, no event', async () => {
      renderPdf.mockImplementation(step('render', Buffer.alloc(0)));
      await expect(exportPdf()).rejects.toThrow('empty PDF');
      expect(putObject).toHaveBeenCalledTimes(0);
      expect(pdfCreate).toHaveBeenCalledTimes(0);
      expect(publish).toHaveBeenCalledTimes(0);
    });

    it('upload throws ⇒ no row, no event', async () => {
      putObject.mockRejectedValue(new Error('r2'));
      await expect(exportPdf()).rejects.toThrow('r2');
      expect(pdfCreate).toHaveBeenCalledTimes(0);
      expect(publish).toHaveBeenCalledTimes(0);
    });

    it('row write throws after the upload ⇒ no event', async () => {
      pdfCreate.mockRejectedValue(new Error('db'));
      await expect(exportPdf()).rejects.toThrow('db');
      expect(putObject).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(0);
    });
  });

  describe('detail', () => {
    it('scopes first, then reads the invoice filtered by THIS order', async () => {
      await service.detail(ACTOR, PERMS, ORDER_ID, INVOICE_ID);
      expect(log).toEqual(['scope', 'find']);
      expect(assertScoped).toHaveBeenCalledWith(ACTOR, PERMS, ORDER_ID);
      expect(invoiceFindFirst).toHaveBeenCalledTimes(1);
      const args = invoiceFindFirst.mock.calls[0][0] as {
        where: unknown;
        include: { lines: unknown };
      };
      expect(args.where).toEqual({ id: INVOICE_ID, orderId: ORDER_ID });
      expect(args.include.lines).toEqual({ orderBy: { displayOrder: 'asc' } });
    });

    it('maps the snapshot with every amount as an integer number', async () => {
      const detail = await service.detail(ACTOR, PERMS, ORDER_ID, INVOICE_ID);
      expect(detail).toMatchObject({
        id: INVOICE_ID,
        invoiceNo: 'HD-2026-0731',
        orderId: ORDER_ID,
        quoteNo: quoteNumberOf(ORDER_ID),
        versionNo: 2,
        customerSdt: '+84901234567',
        customerAddress: '122 Trần Não, TP. Thủ Đức',
        lineCount: 2,
        pdf: null,
      });
      expect(detail.seller).toEqual({
        legalName: 'CÔNG TY NLMT PHƯƠNG NAM',
        taxCode: '0312998771',
        address: '12 Nguyễn Văn Bảo, Gò Vấp',
        representative: 'Nguyễn Văn An',
        representativeTitle: 'Giám đốc',
        phone: '028 3899 1234',
        bankAccount: '0071001234567 Vietcombank',
      });
      for (const value of [
        detail.subtotal,
        detail.discountAmount,
        detail.vatAmount,
        detail.total,
        ...detail.lines.flatMap((line) => [line.unitPrice, line.amount]),
      ]) {
        expect(typeof value).toBe('number');
        expect(Number.isInteger(value)).toBe(true);
      }
      expect(detail.total).toBe(83_010_960);
      expect(detail.lines.map((line) => line.amount)).toEqual([
        36_162_000, 18_500_000,
      ]);
      expect(() => JSON.stringify(detail)).not.toThrow();
    });

    it('maps the stored PDF when exported', async () => {
      invoiceFindFirst.mockResolvedValue(invoiceRow(pdfRow()));
      const detail = await service.detail(ACTOR, PERMS, ORDER_ID, INVOICE_ID);
      expect(detail.pdf).toEqual({
        fileName: 'hoa-don-HD-2026-0731.pdf',
        pdfSize: PDF.length,
        exportedAt: CREATED_AT,
      });
    });

    it('unknown invoice ⇒ 404 "Không tìm thấy hoá đơn."', async () => {
      invoiceFindFirst.mockResolvedValue(null);
      const error = await rejection(
        service.detail(ACTOR, PERMS, ORDER_ID, INVOICE_ID),
      );
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe(INVOICE_NOT_FOUND_MESSAGE);
    });

    it('scope failure ⇒ the invoice is never read', async () => {
      assertScoped.mockRejectedValue(new Error('scope'));
      await expect(
        service.detail(ACTOR, PERMS, ORDER_ID, INVOICE_ID),
      ).rejects.toThrow('scope');
      expect(invoiceFindFirst).toHaveBeenCalledTimes(0);
    });
  });

  describe('getPdf', () => {
    it('scopes, finds the invoice of THIS order, then reads the stored key', async () => {
      invoiceFindFirst.mockImplementation(() =>
        step('find', invoiceRow(pdfRow()))(),
      );
      const file = await service.getPdf(ACTOR, PERMS, ORDER_ID, INVOICE_ID);
      expect(log).toEqual(['scope', 'find', 'download']);
      expect(invoiceFindFirst.mock.calls[0][0]).toMatchObject({
        where: { id: INVOICE_ID, orderId: ORDER_ID },
      });
      expect(getObject).toHaveBeenCalledTimes(1);
      expect(getObject).toHaveBeenCalledWith(
        `invoices/${ORDER_ID}/${INVOICE_ID}.pdf`,
      );
      expect(file).toEqual({ body: PDF, fileName: 'hoa-don-HD-2026-0731.pdf' });
    });

    it('not exported ⇒ 404 "Hoá đơn này chưa xuất PDF." without touching R2', async () => {
      const error = await rejection(
        service.getPdf(ACTOR, PERMS, ORDER_ID, INVOICE_ID),
      );
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe(INVOICE_PDF_NOT_EXPORTED_MESSAGE);
      expect(getObject).toHaveBeenCalledTimes(0);
    });

    it('unknown invoice ⇒ 404 "Không tìm thấy hoá đơn." without touching R2', async () => {
      invoiceFindFirst.mockResolvedValue(null);
      const error = await rejection(
        service.getPdf(ACTOR, PERMS, ORDER_ID, INVOICE_ID),
      );
      expect(error.message).toBe(INVOICE_NOT_FOUND_MESSAGE);
      expect(getObject).toHaveBeenCalledTimes(0);
    });

    it('scope failure ⇒ no invoice read, no R2', async () => {
      assertScoped.mockRejectedValue(new Error('scope'));
      await expect(
        service.getPdf(ACTOR, PERMS, ORDER_ID, INVOICE_ID),
      ).rejects.toThrow('scope');
      expect(invoiceFindFirst).toHaveBeenCalledTimes(0);
      expect(getObject).toHaveBeenCalledTimes(0);
    });
  });
});
