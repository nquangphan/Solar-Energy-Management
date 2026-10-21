/**
 * `StockMovement.type` values — PURE DOMAIN: no Nest, no Prisma.
 *
 * `reserved = SUM(qty)` never filters by type, so each type has a fixed sign, also enforced by
 * the `stock_movements_qty_sign` CHECK: `reserve` > 0, `release` < 0, `xuat` < 0. `xuat` keeps
 * its existing stored value.
 */
export const STOCK_MOVEMENT_TYPE = {
  /** Held for a confirmed order version (qty > 0). */
  reserve: 'reserve',
  /** What an older version still held, given back on re-confirm (qty < 0). */
  release: 'release',
  /** Order-bound stock issue releasing what the order holds (qty < 0). */
  issue: 'xuat',
} as const;

export type StockMovementType =
  (typeof STOCK_MOVEMENT_TYPE)[keyof typeof STOCK_MOVEMENT_TYPE];
