import type { ResolvedOrderTotals } from '../../orders/domain/order-totals';
import type { CompanyLegalEntity } from '../../settings/domain/company-legal-entity';

/**
 * What an invoice copies at creation — PURE DOMAIN. ZERO new money arithmetic: the totals are
 * exactly the ONE resolver's output (AD-16) and each line amount is exactly the server-computed
 * `amount` of the order line. The only check is that the two sources agree: if the lines do not
 * add up to the subtotal it is a pricing bug, and a money document must not be stored from it.
 */

export interface InvoiceSnapshotInput {
  readonly customer: {
    readonly sdt: string;
    readonly name: string;
    readonly taxCode: string | null;
    readonly address: string | null;
  };
  readonly seller: CompanyLegalEntity;
  readonly lines: ReadonlyArray<{
    readonly displayOrder: number;
    readonly name: string;
    readonly unit: string;
    readonly qty: number;
    readonly unitPrice: number;
    readonly amount: number;
  }>;
  readonly resolved: ResolvedOrderTotals;
}

export interface InvoiceSnapshotLine {
  readonly displayOrder: number;
  readonly name: string;
  readonly unit: string;
  readonly qty: number;
  readonly unitPrice: number;
  readonly amount: number;
}

export interface InvoiceSnapshot {
  readonly customerSdt: string;
  readonly customerName: string;
  readonly customerTaxCode: string | null;
  readonly customerAddress: string | null;
  readonly seller: CompanyLegalEntity;
  readonly vatRate: number;
  readonly applyVat: boolean;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly vatAmount: number;
  readonly total: number;
  readonly lines: InvoiceSnapshotLine[];
}

export function buildInvoiceSnapshot(
  input: InvoiceSnapshotInput,
): InvoiceSnapshot {
  const { totals, vatRate, applyVat } = input.resolved;
  const linesTotal = input.lines.reduce((sum, line) => sum + line.amount, 0);
  if (linesTotal !== totals.subtotal) {
    throw new Error(
      `Invoice lines add up to ${linesTotal} but the order subtotal is ${totals.subtotal}`,
    );
  }
  // Renumbered 0..n-1 in display order, so `@@unique([invoiceId, displayOrder])` never collides
  // even when the source order has gaps or ties.
  const lines = [...input.lines]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((line, index) => ({
      displayOrder: index,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice,
      amount: line.amount,
    }));
  return {
    customerSdt: input.customer.sdt,
    customerName: input.customer.name,
    customerTaxCode: input.customer.taxCode,
    customerAddress: input.customer.address,
    seller: { ...input.seller },
    vatRate,
    applyVat,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    vatAmount: totals.vatAmount,
    total: totals.total,
    lines,
  };
}
