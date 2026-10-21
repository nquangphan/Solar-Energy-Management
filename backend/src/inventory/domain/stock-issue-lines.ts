/**
 * Lines of an order-bound stock-out voucher — PURE DOMAIN, shared by the preview and the
 * write path.
 *
 * Voucher lines = lines of the current version that have a `productId` AND whose product
 * tracks stock, MERGED per product (`qty` = sum). Canonical order: name ascending, ties by
 * `productId` — `fieldErrors` indices (`lines.{i}.qty`) follow this order, so the preview
 * and the write must use this one function.
 *
 * A product missing from `products` is dropped — the `tracksStock` flag is never guessed.
 */
export interface StockIssueLine {
  readonly productId: string;
  readonly name: string;
  readonly qty: number;
}

export function stockIssueLines(
  orderLines: readonly {
    readonly productId: string | null;
    readonly qty: number;
  }[],
  products: ReadonlyMap<
    string,
    { readonly name: string; readonly tracksStock: boolean }
  >,
): StockIssueLine[] {
  const totals = new Map<string, number>();
  for (const line of orderLines) {
    if (line.productId === null) continue;
    if (products.get(line.productId)?.tracksStock !== true) continue;
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.qty);
  }
  return [...totals]
    .map(([productId, qty]) => ({
      productId,
      name: products.get(productId)!.name,
      qty,
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'vi') ||
        (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0),
    );
}
