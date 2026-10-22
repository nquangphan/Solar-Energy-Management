// hand-authored — web invoices port (Story 7.4 + 7.5, mirror Flutter
// mobile/lib/design_system/session/invoices_port.dart). The seam between the
// Hoá đơn bán hàng screen and `/orders/{id}/invoices`.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Whether the order can be invoiced,
// the totals and the invoice number are the backend's; the screen only renders them.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];

/** `InvoiceResponseDto` — every amount integer đồng, computed by the backend. */
export type InvoiceSummary = Schemas['InvoiceResponseDto'];

/**
 * `InvoicesOverviewResponseDto`. `creatable` is decided by the backend (false ⇒
 * `blockedReason` may say why); `currentInvoiceId` is the invoice already issued
 * for the current order version, if any; `invoices` newest first.
 */
export type InvoicesOverview = Schemas['InvoicesOverviewResponseDto'];

/** `InvoiceSellerDto`: the seller copied at issue time. `''` = not configured then. */
export type InvoiceSeller = Schemas['InvoiceSellerDto'];

/** `InvoiceLineDto` — `unitPrice`/`amount` integer đồng, stored by the backend. */
export type InvoiceLine = Schemas['InvoiceLineDto'];

/** `InvoicePdfResponseDto`: the stored PDF (ASCII `fileName` with `.pdf`), rendered once by the backend. */
export type InvoicePdfInfo = Schemas['InvoicePdfResponseDto'];

/**
 * `InvoiceDetailResponseDto`: one invoice read from its stored snapshot.
 * `quoteNo` is "Gắn đơn"; `lines` in display order; `pdf` null until exported.
 */
export type InvoiceDetail = Schemas['InvoiceDetailResponseDto'];

/** The AD-5 error envelope this port rejects with (400 / 403 / 404 / 409). `message` is shown verbatim. */
export interface InvoicesPortError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Injectable transport for the Hoá đơn bán hàng screen. A PORT, NOT an HTTP client.
 *
 * The real implementation is `web/src/api/http-invoices-port.ts` (the transport
 * attaches the Bearer token and parses the AD-5 envelope).
 */
export interface InvoicesPort {
  getOverview(orderId: string): Promise<InvoicesOverview>;
  /** Idempotent per order version: a replay returns the same invoice. Rejects with `InvoicesPortError`. */
  createInvoice(orderId: string): Promise<InvoiceSummary>;
  /** One invoice of this order. Rejects with `InvoicesPortError` (404 for another order's invoice). */
  getInvoice(orderId: string, invoiceId: string): Promise<InvoiceDetail>;
  /** Renders the PDF the first time; every later call returns the same stored file. */
  exportInvoicePdf(orderId: string, invoiceId: string): Promise<InvoicePdfInfo>;
  /** The stored PDF, named `fileName`. Rejects with 404 before the first export. */
  downloadInvoicePdf(orderId: string, invoiceId: string): Promise<File>;
}
