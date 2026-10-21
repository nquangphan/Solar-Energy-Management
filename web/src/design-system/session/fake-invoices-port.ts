// hand-authored — TEST/DEMO-ONLY fake port (Story 7.4, mirror Flutter
// mobile/lib/design_system/session/fake_invoices_port.dart).
//
// NOT a real backend: it computes no money and owns no invoice rule. The numbers are
// literal constants as the backend returns them (mockup order, total 83.010.960 đ).
// `createInvoice` appends HD-2026-0001 the first time and returns the SAME invoice on
// every later call (mirrors the backend's idempotency per order version).

import type {
  InvoiceSummary,
  InvoicesOverview,
  InvoicesPort,
  InvoicesPortError,
} from "./invoices-port";

export interface FakeInvoicesOptions {
  creatable?: boolean;
  blockedReason?: string | null;
  /** Default: the mockup tax code. Pass null for a customer without one. */
  customerTaxCode?: string | null;
  invoices?: InvoiceSummary[];
  /** Rejects `getOverview` with this error. */
  overviewError?: InvoicesPortError;
  /** Rejects `createInvoice` with this error. */
  createError?: InvoicesPortError;
}

const DEFAULT_TAX_CODE = "0316552018";

/** The backend's status refusal (`invoice-eligibility.ts`), the default blocked reason. */
const STATUS_BLOCKED_MESSAGE = "Chỉ tạo hoá đơn khi đơn đã chốt và chưa huỷ.";

export const DEMO_INVOICE_SUMMARY: InvoiceSummary = {
  id: "invoice-1",
  invoiceNo: "HD-2026-0001",
  versionNo: 1,
  issuedAt: "2026-10-22T03:00:00.000Z",
  customerName: "VP Công Chứng Lê Đình Thao",
  customerTaxCode: DEFAULT_TAX_CODE,
  vatRate: 8,
  applyVat: true,
  subtotal: 76_862_000,
  discountAmount: 0,
  vatAmount: 6_148_960,
  total: 83_010_960,
  lineCount: 4,
};

export class FakeInvoicesPort implements InvoicesPort {
  private readonly options: FakeInvoicesOptions;
  private invoices: InvoiceSummary[];
  private currentInvoiceId: string | null;
  private created = false;

  constructor(options: FakeInvoicesOptions = {}) {
    this.options = options;
    this.invoices = [...(options.invoices ?? [])];
    this.currentInvoiceId = null;
  }

  getOverview(_orderId: string): Promise<InvoicesOverview> {
    if (this.options.overviewError)
      return Promise.reject(this.options.overviewError);
    const creatable =
      (this.options.creatable ?? true) && this.currentInvoiceId === null;
    return Promise.resolve({
      creatable,
      // Like the backend: the blocker's message whenever one applies, even beside an
      // existing invoice; none when the invoice is the only reason.
      blockedReason: creatable
        ? null
        : (this.options.blockedReason ??
          (this.currentInvoiceId === null ? STATUS_BLOCKED_MESSAGE : null)),
      currentInvoiceId: this.currentInvoiceId,
      versionNo: 1,
      customerName: "VP Công Chứng Lê Đình Thao",
      customerTaxCode:
        this.options.customerTaxCode === undefined
          ? DEFAULT_TAX_CODE
          : this.options.customerTaxCode,
      lineCount: 4,
      orderTotal: 83_010_960,
      invoices: [...this.invoices],
    });
  }

  createInvoice(_orderId: string): Promise<InvoiceSummary> {
    if (this.options.createError)
      return Promise.reject(this.options.createError);
    if (!this.created) {
      // Like the backend: a blocked order is refused with 409 and its reason.
      if (this.options.creatable === false) {
        return Promise.reject({
          message: this.options.blockedReason ?? STATUS_BLOCKED_MESSAGE,
          status: 409,
          code: "CONFLICT",
        } satisfies InvoicesPortError);
      }
      this.created = true;
      const invoice: InvoiceSummary = {
        ...DEMO_INVOICE_SUMMARY,
        // Unique even when the seeded list already holds the demo invoice.
        id: `invoice-${this.invoices.length + 1}`,
        customerTaxCode:
          this.options.customerTaxCode === undefined
            ? DEFAULT_TAX_CODE
            : this.options.customerTaxCode,
      };
      this.invoices = [invoice, ...this.invoices];
      this.currentInvoiceId = invoice.id;
      return Promise.resolve(invoice);
    }
    const current = this.invoices.find((i) => i.id === this.currentInvoiceId);
    return Promise.resolve(current ?? DEMO_INVOICE_SUMMARY);
  }
}
