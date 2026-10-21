/**
 * Invoice PDF file name and R2 key — PURE DOMAIN.
 *
 * One invoice has one PDF: it is rendered once from the immutable snapshot, so the key is
 * deterministic — a retry after a failed DB write overwrites the same object instead of leaving
 * an orphan behind.
 */

/** File name without extension — the download route appends `.pdf`. ASCII only (`HD-yyyy-NNNN`):
 *  a `Content-Disposition` header cannot carry Vietnamese letters. */
export function invoiceFileName(invoiceNo: string): string {
  return `hoa-don-${invoiceNo}`;
}

/** R2 object key — one per invoice, never random. */
export function invoicePdfKey(orderId: string, invoiceId: string): string {
  return `invoices/${orderId}/${invoiceId}.pdf`;
}
