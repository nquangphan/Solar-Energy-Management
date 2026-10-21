/**
 * Cost price frozen onto an ORDER LINE at stock issue (AD-20, FR-37) — PURE DOMAIN.
 *
 * The selling price is snapshotted at Chốt (the promise); the cost price is snapshotted
 * when the goods LEAVE THE WAREHOUSE (the fact): an order may be confirmed while stock is
 * short, so the cost at confirmation is the cost of goods not yet bought.
 *
 * - Stock-tracked line ⇒ `Product.costPrice` read UNDER the `products` lock — exactly the
 *   voucher line's `unitCost` (`inventory/` hands it back as `costByProduct`).
 * - Every other line (installation, fees, free-text lines, `tracksStock = false`) ⇒ the
 *   selling price snapshot: line margin = 0, so the profit formula needs no special case.
 *
 * `trackedCost` absent (`undefined`) means the line is not stock-tracked; `0` is a real cost.
 */
export function lineCostSnapshot(
  line: { readonly unitPriceSnapshot: number },
  trackedCost: number | undefined,
): number {
  return trackedCost ?? line.unitPriceSnapshot;
}
