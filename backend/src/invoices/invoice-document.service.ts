import { Injectable } from '@nestjs/common';
import type { InvoicePdf, Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import { quoteNumberOf } from '../orders/domain/quote-number';
import { OrdersService } from '../orders/orders.service';
import { QuoteRendererPort } from '../orders/quote/quote-renderer.port';
import { PrismaService } from '../prisma/prisma.service';
import { StoragePort } from '../storage/storage.port';
import { InvoicePdfExported } from './domain/invoice-events';
import { invoiceFileName, invoicePdfKey } from './domain/invoice-file';
import { buildInvoiceHtml } from './invoice-template';
import type { InvoiceView } from './invoices.service';

export const INVOICE_NOT_FOUND_MESSAGE = 'Không tìm thấy hoá đơn.';
export const INVOICE_PDF_NOT_EXPORTED_MESSAGE = 'Hoá đơn này chưa xuất PDF.';

/**
 * Rendering (a cold Chromium launch included) and the R2 upload run while the invoice row is
 * locked, so the transaction gets more than Prisma's 5 s default.
 */
const EXPORT_TX_TIMEOUT_MS = 30_000;

/** Everything an invoice is shown and printed from: the row, its version number, its lines. */
const DETAIL_INCLUDE = {
  orderVersion: { select: { versionNo: true } },
  lines: { orderBy: { displayOrder: 'asc' } },
  pdf: true,
} as const;

type DetailRow = Prisma.InvoiceGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** The stored PDF of an invoice, as the API returns it. */
export interface InvoicePdfView {
  readonly fileName: string;
  readonly pdfSize: number;
  readonly exportedAt: Date;
}

export interface InvoiceLineView {
  readonly displayOrder: number;
  readonly name: string;
  readonly unit: string;
  readonly qty: number;
  readonly unitPrice: number;
  readonly amount: number;
}

/** One invoice in full, as the API returns it — every amount already a `number`. */
export interface InvoiceDetailView extends InvoiceView {
  readonly orderId: string;
  readonly quoteNo: string;
  readonly customerSdt: string;
  readonly customerAddress: string | null;
  readonly seller: {
    readonly legalName: string;
    readonly taxCode: string;
    readonly address: string;
    readonly representative: string;
    readonly representativeTitle: string;
    readonly phone: string;
    readonly bankAccount: string;
  };
  readonly lines: InvoiceLineView[];
  readonly pdf: InvoicePdfView | null;
}

/**
 * Viewing and exporting an invoice (FR-28). Everything shown or printed is the snapshot stored
 * at issue time (Story 7.4) — the live order, customer and settings are never re-read.
 *
 * Order of `exportPdf` (MANDATORY): scope → [tx: lock invoice row → replay check → read →
 * render → upload → create row] → publish AFTER commit, only for a new file.
 *
 * The PDF is rendered ONCE: the snapshot is immutable, so its document is too. A later export
 * returns the stored file (200, no render, no upload, no event). The lock is on the INVOICE row,
 * not the order: exporting writes no money and no order state, so locking the order would block
 * every order write for the whole render for nothing. No path locks `invoices` and then
 * `orders`, so the system-wide lock order (orders first) is not inverted. Two concurrent exports
 * of one invoice serialise on that lock; the second sees the first's row and replays it.
 *
 * A render or upload failure rolls the transaction back (0 rows, 0 events). A failure writing the
 * row after the upload leaves bytes at the deterministic key; the next export overwrites them.
 *
 * Money columns are `BigInt`; `toDetail` is the ONE place in this file they become `number`.
 *
 * Side effects only through `EventBus` (AD-18) — no `AuditService`/`NotificationDispatcher`.
 */
@Injectable()
export class InvoiceDocumentService {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly storage: StoragePort,
    private readonly renderer: QuoteRendererPort,
  ) {}

  async detail(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    invoiceId: string,
  ): Promise<InvoiceDetailView> {
    // 404 (missing OR out of scope — same message) before the invoice is read.
    await this.orders.assertScoped(actorAccountId, actorPermissions, orderId);
    // `orderId` in the filter: an invoice of ANOTHER order gets the same 404 as a missing one.
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orderId },
      include: DETAIL_INCLUDE,
    });
    if (row === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        INVOICE_NOT_FOUND_MESSAGE,
      );
    }
    return toDetail(row);
  }

  async exportPdf(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    invoiceId: string,
  ): Promise<InvoicePdfView> {
    // Scope before anything else, replays included: an out-of-scope caller never learns a file exists.
    await this.orders.assertScoped(actorAccountId, actorPermissions, orderId);
    const result = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM invoices WHERE id = ${invoiceId} AND order_id = ${orderId} FOR UPDATE`;
        if (locked.length === 0) {
          throw new AppException(
            ErrorCode.NOT_FOUND,
            404,
            INVOICE_NOT_FOUND_MESSAGE,
          );
        }
        const existing = await tx.invoicePdf.findUnique({
          where: { invoiceId },
        });
        if (existing !== null) return { replay: true as const, row: existing };

        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: DETAIL_INCLUDE,
        });
        // The row is locked above, and invoices are never deleted.
        const detail = toDetail(invoice as DetailRow);
        const html = buildInvoiceHtml({
          invoiceNo: detail.invoiceNo,
          issuedAt: detail.issuedAt,
          quoteNo: detail.quoteNo,
          versionNo: detail.versionNo,
          seller: detail.seller,
          customer: {
            name: detail.customerName,
            sdt: detail.customerSdt,
            taxCode: detail.customerTaxCode,
            address: detail.customerAddress,
          },
          lines: detail.lines,
          vatRate: detail.vatRate,
          applyVat: detail.applyVat,
          subtotal: detail.subtotal,
          discountAmount: detail.discountAmount,
          vatAmount: detail.vatAmount,
          total: detail.total,
        });

        const pdf = await this.renderer.renderPdf(html);
        // Never upload an empty object: the row's CHECK (pdf_size > 0) would reject it AFTER the
        // upload and leave the bytes behind.
        if (pdf.length === 0)
          throw new Error('Invoice renderer returned an empty PDF');
        const pdfKey = invoicePdfKey(orderId, invoiceId);
        await this.storage.putObject(pdfKey, pdf, 'application/pdf');
        const row = await tx.invoicePdf.create({
          data: {
            invoiceId,
            pdfKey,
            pdfSize: pdf.length,
            fileName: invoiceFileName(detail.invoiceNo),
            createdByAccountId: actorAccountId,
          },
        });
        return { replay: false as const, row, invoiceNo: detail.invoiceNo };
      },
      { timeout: EXPORT_TX_TIMEOUT_MS },
    );

    const view = toPdfView(result.row);
    if (!result.replay) {
      // AFTER commit. occurredAt = createdAt: the audit row and the response carry ONE timestamp.
      await this.eventBus.publish(
        new InvoicePdfExported(
          actorAccountId,
          orderId,
          {
            invoiceId,
            invoiceNo: result.invoiceNo,
            fileName: view.fileName,
          },
          view.exportedAt,
        ),
      );
    }
    return view;
  }

  /**
   * Bytes of the stored invoice PDF for the download proxy (AD-3). Scope runs BEFORE the invoice
   * lookup and BEFORE R2; an invoice of ANOTHER order gets the same 404 as a missing one.
   */
  async getPdf(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    invoiceId: string,
  ): Promise<{ body: Buffer; fileName: string }> {
    await this.orders.assertScoped(actorAccountId, actorPermissions, orderId);
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, orderId },
      include: { pdf: true },
    });
    if (row === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        INVOICE_NOT_FOUND_MESSAGE,
      );
    }
    if (row.pdf === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        INVOICE_PDF_NOT_EXPORTED_MESSAGE,
      );
    }
    const { body } = await this.storage.getObject(row.pdf.pdfKey);
    return { body, fileName: `${row.pdf.fileName}.pdf` };
  }
}

function toPdfView(row: InvoicePdf): InvoicePdfView {
  return {
    fileName: `${row.fileName}.pdf`,
    pdfSize: row.pdfSize,
    exportedAt: row.createdAt,
  };
}

/** The ONE `bigint` → `number` conversion of this file (amounts are far below 2^53). */
function toDetail(row: DetailRow): InvoiceDetailView {
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    versionNo: row.orderVersion.versionNo,
    issuedAt: row.issuedAt,
    customerName: row.customerName,
    customerTaxCode: row.customerTaxCode,
    vatRate: row.vatRate,
    applyVat: row.applyVat,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discountAmount),
    vatAmount: Number(row.vatAmount),
    total: Number(row.total),
    lineCount: row.lines.length,
    orderId: row.orderId,
    quoteNo: quoteNumberOf(row.orderId),
    customerSdt: row.customerSdt,
    customerAddress: row.customerAddress,
    seller: {
      legalName: row.sellerLegalName,
      taxCode: row.sellerTaxCode,
      address: row.sellerAddress,
      representative: row.sellerRepresentative,
      representativeTitle: row.sellerRepresentativeTitle,
      phone: row.sellerPhone,
      bankAccount: row.sellerBankAccount,
    },
    lines: row.lines.map((line) => ({
      displayOrder: line.displayOrder,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice,
      amount: Number(line.amount),
    })),
    pdf: row.pdf === null ? null : toPdfView(row.pdf),
  };
}
