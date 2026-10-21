/**
 * Stock shortfall rules — PURE DOMAIN: no Nest, no Prisma.
 *
 * The ONE place that compares a requested quantity with stock (AD-2): the stock-out check
 * under the lock, the stock-out preview warning and the quote early warning all call these,
 * so the warning and the final decision can never disagree. Clients only render the result.
 */

/** Units of a stock-out beyond on-hand — `0` when on-hand covers it; never negative. */
export function issueShortfall(qty: number, onHand: number): number {
  return qty > onHand ? qty - onHand : 0;
}

export type QuoteStockStatus = 'enough' | 'short';

export interface QuoteStockLine {
  /** `onHand − reserved` — MAY be negative. */
  readonly available: number;
  /** Units to bring in before this line can be issued; never negative. */
  readonly shortfall: number;
  readonly status: QuoteStockStatus;
}

/**
 * Early warning for one quoted product: compares `qty` with what is still free to promise
 * (`onHand − reserved`). A warning only — confirming the order is never blocked by stock.
 */
export function quoteStockLine(input: {
  qty: number;
  onHand: number;
  reserved: number;
}): QuoteStockLine {
  const available = input.onHand - input.reserved;
  const shortfall = issueShortfall(input.qty, available);
  return { available, shortfall, status: shortfall > 0 ? 'short' : 'enough' };
}
