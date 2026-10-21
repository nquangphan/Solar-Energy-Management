/**
 * Quote number printed on the quote (4.8) and referenced by contracts (7.3) — ONE function, so a
 * contract always cites the same number as the quote the customer holds.
 */
export function quoteNumberOf(orderId: string): string {
  return `BG-${orderId.slice(0, 8).toUpperCase()}`;
}
