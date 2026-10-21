/**
 * Internal invoice number — PURE DOMAIN.
 *
 * `seq` is a global serial reserved from the `invoices.seq` sequence under the order row lock.
 * It never resets per year; the padding is a minimum of 4 digits, not a width limit.
 */

const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `HD-{yyyy}-{seq padded to 4}`; the year is the issue year in UTC+7. */
export function formatInvoiceNo(seq: number, issuedAt: Date): string {
  const year = new Date(issuedAt.getTime() + UTC7_OFFSET_MS).getUTCFullYear();
  return `HD-${year}-${String(seq).padStart(4, '0')}`;
}
