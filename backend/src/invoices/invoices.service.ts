import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import { resolveOrderTotals } from '../orders/domain/order-totals';
import { OrdersService, type OrderView } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  INVOICE_ORDER_STATUSES,
  invoiceBlocker,
} from './domain/invoice-eligibility';
import { InvoiceCreated } from './domain/invoice-events';
import { formatInvoiceNo } from './domain/invoice-number';
import { buildInvoiceSnapshot } from './domain/invoice-snapshot';

/** The order was revised between the scoped read and the lock: the lines read are stale. */
export const ORDER_CHANGED_MESSAGE =
  'Đơn vừa thay đổi — tải lại rồi tạo lại hoá đơn.';

type DbClient = Prisma.TransactionClient;

/** What every invoice read selects besides the row: the version number and the line count. */
const INVOICE_INCLUDE = {
  orderVersion: { select: { versionNo: true } },
  _count: { select: { lines: true } },
} as const;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

/** One created invoice, as the API returns it — every amount already a `number`. */
export interface InvoiceView {
  readonly id: string;
  readonly invoiceNo: string;
  readonly versionNo: number;
  readonly issuedAt: Date;
  readonly customerName: string;
  readonly customerTaxCode: string | null;
  readonly vatRate: number;
  readonly applyVat: boolean;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly vatAmount: number;
  readonly total: number;
  readonly lineCount: number;
}

export interface InvoicesOverview {
  readonly creatable: boolean;
  readonly blockedReason: string | null;
  readonly currentInvoiceId: string | null;
  readonly versionNo: number;
  readonly customerName: string;
  readonly customerTaxCode: string | null;
  readonly lineCount: number;
  readonly orderTotal: number;
  readonly invoices: InvoiceView[];
}

/**
 * Internal sales invoices (FR-27): an immutable snapshot of one confirmed order version —
 * customer, seller (company legal entity), lines, VAT and totals — with an internal number.
 *
 * Order of `create` (MANDATORY): scope → [tx: lock order row → re-read status/version → replay
 * check → stale-quote check → read → blocker → seller → reserve seq → create row] → publish AFTER commit, only for a
 * new invoice. The order row lock (`SELECT id FROM orders … FOR UPDATE`, the system-wide first
 * lock) serialises creation with every other write on the order — revise, reopen, payments — so
 * the copied version is the committed one, and two concurrent POSTs for the same version end as
 * one invoice: the second sees the first under the lock and replays it.
 *
 * Idempotent per order version: one version has at most one invoice (`@@unique`), so a POST for
 * a version already invoiced returns that invoice (200, no write, no event) — even when the order
 * has since moved on (completed or cancelled): the invoice exists. A revise makes a new version,
 * which may get its own invoice; earlier invoices are never touched.
 *
 * A failure anywhere in the transaction rolls everything back (0 rows, 0 events); a `nextval`
 * already taken leaves a gap in the numbering — accepted, sequences do not roll back.
 *
 * Money columns are `BigInt`; `toView` is the ONE place they become `number` (a `bigint` in a
 * response or an event payload makes `JSON.stringify` throw).
 *
 * Side effects only through `EventBus` (AD-18) — no `AuditService`/`NotificationDispatcher`.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly settings: SettingsService,
  ) {}

  async overview(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<InvoicesOverview> {
    const view = await this.orders.getScoped(
      actorAccountId,
      actorPermissions,
      orderId,
      tieredPricingEnabled,
    );
    const [inputs, rows] = await Promise.all([
      this.loadInputs(view, vatRatePercent, this.prisma),
      this.prisma.invoice.findMany({
        where: { orderId },
        include: INVOICE_INCLUDE,
        orderBy: [{ issuedAt: 'desc' }, { seq: 'desc' }],
      }),
    ]);
    const current =
      rows.find((row) => row.orderVersionId === view.currentVersionId) ?? null;
    return {
      creatable: inputs.blocker === null && current === null,
      blockedReason: inputs.blocker?.message ?? null,
      currentInvoiceId: current?.id ?? null,
      versionNo: inputs.version?.versionNo ?? 0,
      customerName: inputs.customer.name,
      customerTaxCode: inputs.customer.taxCode,
      lineCount: view.lineItems.length,
      orderTotal: inputs.resolved.totals.total,
      invoices: rows.map(toView),
    };
  }

  async create(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<InvoiceView> {
    // 404 (missing OR out of scope — same message) before anything else, replays included: an
    // out-of-scope caller never receives an existing invoice.
    const view = await this.orders.getScoped(
      actorAccountId,
      actorPermissions,
      orderId,
      tieredPricingEnabled,
    );
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      // Committed state under the lock: a payment may have advanced the status (still
      // eligible), a reopen moved it out of the set (blocker), a revise replaced the version
      // whose lines `view` carries (stale ⇒ 409).
      const fresh = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, currentVersionId: true },
      });
      if (fresh === null || fresh.currentVersionId !== view.currentVersionId) {
        throw new AppException(ErrorCode.CONFLICT, 409, ORDER_CHANGED_MESSAGE);
      }
      // Replay BEFORE the blocker: a retry whose first response was lost gets the same invoice
      // back even if the order has since been completed or cancelled.
      if (fresh.currentVersionId !== null) {
        const existing = await tx.invoice.findUnique({
          where: { orderVersionId: fresh.currentVersionId },
          include: INVOICE_INCLUDE,
        });
        if (existing !== null) return { replay: true, row: existing };
      }
      // Confirming keeps the version, so the pointer check above cannot see it: a scoped read
      // taken while the order was still a quote carries live lines and prices that may have
      // been edited before the confirm. Only a read of an already-frozen order is copied.
      if (
        fresh.status !== view.status &&
        !INVOICE_ORDER_STATUSES.has(view.status)
      ) {
        throw new AppException(ErrorCode.CONFLICT, 409, ORDER_CHANGED_MESSAGE);
      }

      const inputs = await this.loadInputs(
        { ...view, status: fresh.status },
        vatRatePercent,
        tx,
      );
      if (inputs.blocker !== null) {
        throw new AppException(
          inputs.blocker.status === 400
            ? ErrorCode.VALIDATION_ERROR
            : ErrorCode.CONFLICT,
          inputs.blocker.status,
          inputs.blocker.message,
        );
      }
      // Eligible ⇒ the order has lines, so its current version exists.
      const version = inputs.version as NonNullable<typeof inputs.version>;
      const seller = await this.settings.companyLegalEntity();
      const snapshot = buildInvoiceSnapshot({
        customer: inputs.customer,
        seller,
        lines: view.lineItems,
        resolved: inputs.resolved,
      });

      // `nextval` is the only source of the number: `count() + 1` would hand two concurrent
      // requests on different orders the same number.
      const issuedAt = new Date();
      const [reserved] = await tx.$queryRaw<
        { seq: bigint }[]
      >`SELECT nextval(pg_get_serial_sequence('invoices', 'seq')) AS seq`;
      const seq = Number(reserved.seq);
      const row = await tx.invoice.create({
        data: {
          seq,
          invoiceNo: formatInvoiceNo(seq, issuedAt),
          orderId,
          orderVersionId: version.id,
          customerSdt: snapshot.customerSdt,
          customerName: snapshot.customerName,
          customerTaxCode: snapshot.customerTaxCode,
          customerAddress: snapshot.customerAddress,
          sellerLegalName: snapshot.seller.legalName,
          sellerTaxCode: snapshot.seller.taxCode,
          sellerAddress: snapshot.seller.address,
          sellerRepresentative: snapshot.seller.representative,
          sellerRepresentativeTitle: snapshot.seller.representativeTitle,
          sellerPhone: snapshot.seller.phone,
          sellerBankAccount: snapshot.seller.bankAccount,
          vatRate: snapshot.vatRate,
          applyVat: snapshot.applyVat,
          subtotal: BigInt(snapshot.subtotal),
          discountAmount: BigInt(snapshot.discountAmount),
          vatAmount: BigInt(snapshot.vatAmount),
          total: BigInt(snapshot.total),
          issuedAt,
          createdByAccountId: actorAccountId,
          lines: {
            create: snapshot.lines.map((line) => ({
              displayOrder: line.displayOrder,
              name: line.name,
              unit: line.unit,
              qty: line.qty,
              unitPrice: line.unitPrice,
              amount: BigInt(line.amount),
            })),
          },
        },
        include: INVOICE_INCLUDE,
      });
      return { replay: false, row };
    });

    const invoice = toView(result.row);
    if (!result.replay) {
      // AFTER commit. occurredAt = issuedAt: the audit row and the response carry ONE timestamp.
      await this.eventBus.publish(
        new InvoiceCreated(
          actorAccountId,
          orderId,
          {
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            orderVersionId: result.row.orderVersionId,
            total: invoice.total,
          },
          invoice.issuedAt,
        ),
      );
    }
    return invoice;
  }

  /**
   * Everything an invoice is built from, for an order the caller ALREADY scoped: customer,
   * current version, totals (the ONE resolver — AD-16) and the eligibility verdict. Shared by
   * `overview` and `create`, so the screen and the POST never disagree. `db` is the creation's
   * locked transaction, or the plain client for the overview.
   */
  private async loadInputs(
    view: OrderView,
    vatRatePercent: number,
    db: DbClient,
  ) {
    const [customer, version] = await Promise.all([
      db.customer.findUnique({ where: { sdt: view.customerSdt } }),
      view.currentVersionId === null
        ? Promise.resolve(null)
        : db.orderVersion.findUnique({
            where: { id: view.currentVersionId },
          }),
    ]);
    if (customer === null) {
      // The FK guarantees the customer exists — this only guards against corrupt data.
      throw new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy đơn.');
    }
    const resolved = resolveOrderTotals({
      lines: view.lineItems.map((line) => ({
        unitPrice: line.unitPrice,
        qty: line.qty,
      })),
      version,
      order: view,
      fallbackVatRate: vatRatePercent,
    });
    const blocker = invoiceBlocker({
      status: view.status,
      lineCount: view.lineItems.length,
    });
    return { customer, version, resolved, blocker };
  }
}

/** The ONE `bigint` → `number` conversion (amounts are far below 2^53). */
function toView(row: InvoiceRow): InvoiceView {
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    versionNo: row.orderVersion.versionNo,
    issuedAt: row.issuedAt,
    customerName: row.customerName,
    customerTaxCode: row.customerTaxCode,
    vatRate: row.vatRate,
    applyVat: row.applyVat,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discountAmount),
    vatAmount: Number(row.vatAmount),
    total: Number(row.total),
    lineCount: row._count.lines,
  };
}
