/**
 * Two stock figures joined by a compare or an arithmetic operator — the stock rule
 * itself, which only the backend may apply (AD-2). Shared by the stock-out and the
 * quote stock-warning guards so both ban the same thing.
 */
const STOCK = '(?:qty|onHand|reserved|available|shortfall|khaDung)';

export const STOCK_PAIR = new RegExp(
  `\\b${STOCK}\\b[\\s)]*(?:<=|>=|<|>|[-+*/])[\\s(]*[\\w.\\[\\]!?]*\\b${STOCK}\\b`,
);
