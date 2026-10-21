// hand-authored — web invoices port (Story 7.4 + 7.5, mirror Flutter
// mobile/lib/design_system/session/invoices_port.dart). The seam between the
// Hoá đơn bán hàng screen and `/orders/{id}/invoices`.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Whether the order can be invoiced,
// the totals and the invoice number are the backend's; the screen only renders them.

/** Mirrors `InvoiceSummary` field for field. */
export interface InvoiceSummary {
  id: string;
  invoiceNo: string;
  versionNo: number;
  /** ISO-8601 UTC. */
  issuedAt: string;
  customerName: string;
  customerTaxCode: string | null;
  vatRate: number;
  applyVat: boolean;
  /** Integer đồng, computed by the backend. */
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  lineCount: number;
}

/** Mirrors `InvoicesOverview` field for field. */
export interface InvoicesOverview {
  /** Decided by the backend. false ⇒ `blockedReason` may say why. */
  creatable: boolean;
  blockedReason: string | null;
  /** Id of the invoice already issued for the current order version, if any. */
  currentInvoiceId: string | null;
  versionNo: number;
  customerName: string;
  customerTaxCode: string | null;
  lineCount: number;
  /** Integer đồng, computed by the backend. */
  orderTotal: number;
  /** Newest first. */
  invoices: InvoiceSummary[];
}

/** Mirrors `InvoiceSeller`: the seller copied at issue time. `''` = not configured then. */
export interface InvoiceSeller {
  legalName: string;
  taxCode: string;
  address: string;
  representative: string;
  representativeTitle: string;
  phone: string;
  bankAccount: string;
}

/** Mirrors `InvoiceLine` field for field. */
export interface InvoiceLine {
  displayOrder: number;
  name: string;
  unit: string;
  qty: number;
  /** Integer đồng. */
  unitPrice: number;
  /** Integer đồng, stored by the backend. */
  amount: number;
}

/** Mirrors `InvoicePdfResponse`: the stored PDF, rendered once by the backend. */
export interface InvoicePdfInfo {
  /** ASCII, with the `.pdf` extension. */
  fileName: string;
  pdfSize: number;
  /** ISO-8601 UTC. */
  exportedAt: string;
}

/** Mirrors `InvoiceDetailResponse`: one invoice read from its stored snapshot. */
export interface InvoiceDetail extends InvoiceSummary {
  orderId: string;
  /** "Gắn đơn" — the order's quote number. */
  quoteNo: string;
  customerSdt: string;
  customerAddress: string | null;
  seller: InvoiceSeller;
  /** In display order. */
  lines: InvoiceLine[];
  /** null until exported. */
  pdf: InvoicePdfInfo | null;
}

/** The AD-5 error envelope this port rejects with (400 / 403 / 404 / 409). `message` is shown verbatim. */
export interface InvoicesPortError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Injectable transport for the Hoá đơn bán hàng screen. A PORT, NOT an HTTP client.
 *
 * TODO(app-runtime/login-network): the real implementation attaches the bearer
 * token and parses the AD-5 envelope into `InvoicesPortError`.
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
