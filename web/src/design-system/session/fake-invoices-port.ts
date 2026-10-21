// hand-authored — TEST/DEMO-ONLY fake port (Story 7.4 + 7.5, mirror Flutter
// mobile/lib/design_system/session/fake_invoices_port.dart).
//
// NOT a real backend: it computes no money and owns no invoice rule. The numbers are
// literal constants as the backend returns them (mockup order, total 83.010.960 đ).
// `createInvoice` appends HD-2026-0001 the first time and returns the SAME invoice on
// every later call (mirrors the backend's idempotency per order version).
// `exportInvoicePdf` stores a PDF the first time and returns the SAME one afterwards; an
// unknown invoice, an invoice asked for through ANOTHER order and a download before the
// export are refused like the backend does. The fake holds the invoices of ONE order: the
// first order it is asked about.

import type {
  InvoiceDetail,
  InvoicePdfInfo,
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
  /** Replaces fields of every invoice detail (discount, VAT, seller, pdf…). */
  detail?: Partial<InvoiceDetail>;
  /** Rejects `getInvoice` with this error. */
  getInvoiceError?: InvoicesPortError;
  /** Rejects `exportInvoicePdf` with this error. */
  exportError?: InvoicesPortError;
  /** Rejects `downloadInvoicePdf` with this error. */
  downloadError?: InvoicesPortError;
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

/** The backend's refusals for one invoice (`invoice-document.service.ts`). */
const INVOICE_NOT_FOUND: InvoicesPortError = {
  message: "Không tìm thấy hoá đơn.",
  status: 404,
  code: "NOT_FOUND",
};
const PDF_NOT_EXPORTED: InvoicesPortError = {
  message: "Hoá đơn này chưa xuất PDF.",
  status: 404,
  code: "NOT_FOUND",
};

/** The mockup invoice in full (`#s-invoice`) — literal figures as the backend returns them. */
export const DEMO_INVOICE_DETAIL: InvoiceDetail = {
  ...DEMO_INVOICE_SUMMARY,
  orderId: "DH-2048",
  quoteNo: "BG-2048",
  customerSdt: "+84901234567",
  customerAddress: "122 Trần Não, TP. Thủ Đức",
  seller: {
    legalName: "CÔNG TY NLMT PHƯƠNG NAM",
    taxCode: "0312998771",
    address: "",
    representative: "",
    representativeTitle: "",
    phone: "",
    bankAccount: "",
  },
  lines: [
    {
      displayOrder: 0,
      name: "Tấm pin AE 630W",
      unit: "Tấm",
      qty: 14,
      unitPrice: 2_583_000,
      amount: 36_162_000,
    },
    {
      displayOrder: 1,
      name: "Inverter Solplanet ASW8000-S",
      unit: "Bộ",
      qty: 1,
      unitPrice: 18_500_000,
      amount: 18_500_000,
    },
    {
      displayOrder: 2,
      name: "Vật tư (gói)",
      unit: "Gói",
      qty: 1,
      unitPrice: 12_400_000,
      amount: 12_400_000,
    },
    {
      displayOrder: 3,
      name: "Công lắp đặt",
      unit: "Gói",
      qty: 1,
      unitPrice: 9_800_000,
      amount: 9_800_000,
    },
  ],
  pdf: null,
};

export class FakeInvoicesPort implements InvoicesPort {
  private readonly options: FakeInvoicesOptions;
  private invoices: InvoiceSummary[];
  private currentInvoiceId: string | null;
  private created = false;
  private readonly pdfs = new Map<string, InvoicePdfInfo>();
  private orderId: string | null = null;

  constructor(options: FakeInvoicesOptions = {}) {
    this.options = options;
    this.invoices = [...(options.invoices ?? [])];
    this.currentInvoiceId = null;
  }

  getOverview(orderId: string): Promise<InvoicesOverview> {
    this.bind(orderId);
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

  createInvoice(orderId: string): Promise<InvoiceSummary> {
    this.bind(orderId);
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

  getInvoice(orderId: string, invoiceId: string): Promise<InvoiceDetail> {
    if (this.options.getInvoiceError)
      return Promise.reject(this.options.getInvoiceError);
    const summary = this.find(orderId, invoiceId);
    if (summary === undefined) return Promise.reject(INVOICE_NOT_FOUND);
    return Promise.resolve({
      ...DEMO_INVOICE_DETAIL,
      ...summary,
      orderId,
      ...this.options.detail,
      pdf: this.pdfOf(invoiceId),
    });
  }

  exportInvoicePdf(
    orderId: string,
    invoiceId: string,
  ): Promise<InvoicePdfInfo> {
    if (this.options.exportError)
      return Promise.reject(this.options.exportError);
    const summary = this.find(orderId, invoiceId);
    if (summary === undefined) return Promise.reject(INVOICE_NOT_FOUND);
    const stored = this.pdfOf(invoiceId);
    if (stored !== null) return Promise.resolve(stored);
    const pdf: InvoicePdfInfo = {
      fileName: `hoa-don-${summary.invoiceNo}.pdf`,
      pdfSize: 48_213,
      exportedAt: "2026-10-22T04:00:00.000Z",
    };
    this.pdfs.set(invoiceId, pdf);
    return Promise.resolve(pdf);
  }

  downloadInvoicePdf(orderId: string, invoiceId: string): Promise<File> {
    if (this.options.downloadError)
      return Promise.reject(this.options.downloadError);
    if (this.find(orderId, invoiceId) === undefined)
      return Promise.reject(INVOICE_NOT_FOUND);
    const pdf = this.pdfOf(invoiceId);
    if (pdf === null) return Promise.reject(PDF_NOT_EXPORTED);
    return Promise.resolve(
      new File(["%PDF-1.4 fake"], pdf.fileName, { type: "application/pdf" }),
    );
  }

  /** The fake's one order is the first one it is asked about. */
  private bind(orderId: string): void {
    this.orderId ??= orderId;
  }

  /** Like the backend: an invoice of ANOTHER order is as missing as an unknown one. */
  private find(orderId: string, invoiceId: string): InvoiceSummary | undefined {
    this.bind(orderId);
    if (orderId !== this.orderId) return undefined;
    return this.invoices.find((i) => i.id === invoiceId);
  }

  /** The stored PDF, or the one the options seeded as already exported. */
  private pdfOf(invoiceId: string): InvoicePdfInfo | null {
    return this.pdfs.get(invoiceId) ?? this.options.detail?.pdf ?? null;
  }
}
