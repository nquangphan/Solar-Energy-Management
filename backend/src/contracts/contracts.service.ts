import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import { resolveOrderTotals } from '../orders/domain/order-totals';
import { quoteNumberOf } from '../orders/domain/quote-number';
import { OrdersService, type OrderView } from '../orders/orders.service';
import { QuoteRendererPort } from '../orders/quote/quote-renderer.port';
import { PrismaService } from '../prisma/prisma.service';
import { missingLegalEntityFields } from '../settings/domain/company-legal-entity';
import { SettingsService } from '../settings/settings.service';
import { StoragePort } from '../storage/storage.port';
import { buildContractHtml } from './contract-template';
import {
  contractBlocker,
  scheduleLabelOf,
} from './domain/contract-eligibility';
import { ContractGenerated } from './domain/contract-events';
import {
  contractFileName,
  contractPdfKey,
  formatContractNo,
} from './domain/contract-number';
import { contractTypeFor, type ContractType } from './domain/contract-type';

/** The order was revised between the scoped read and the lock: the lines read are stale. */
export const ORDER_CHANGED_MESSAGE =
  'Đơn vừa thay đổi — tải lại rồi sinh lại hợp đồng.';

/**
 * Rendering (a cold Chromium launch included) and the R2 upload run while the order row is
 * locked, so the transaction gets more than Prisma's 5 s default.
 */
const GENERATE_TX_TIMEOUT_MS = 30_000;

type DbClient = Prisma.TransactionClient;

/** One generated contract, as the API returns it. */
export interface ContractView {
  readonly id: string;
  readonly contractNo: string;
  readonly contractType: ContractType;
  readonly versionNo: number;
  readonly fileName: string;
  readonly pdfSize: number;
  readonly createdAt: Date;
}

export interface ContractsOverview {
  readonly contractType: ContractType;
  readonly generatable: boolean;
  readonly blockedReason: string | null;
  readonly quoteNo: string;
  readonly versionNo: number;
  readonly customerName: string;
  readonly lineCount: number;
  readonly orderTotal: number;
  readonly scheduleLabel: string | null;
  readonly missingPartyFields: string[];
  readonly contracts: ContractView[];
}

/**
 * Contract generation (FR-13): HĐ Thi công / HĐ Mua bán as a PDF from a confirmed order.
 *
 * Order of `generate` (MANDATORY): scope → [tx: lock order row → re-read status/version →
 * read → blocker → reserve seq → render → upload → create row] → publish AFTER commit. The order
 * row lock (`SELECT id FROM orders … FOR UPDATE`, the system-wide first lock) serialises the
 * generation with every other write on the order — schedule replace, revise/reopen, payments —
 * so the printed status, version and schedule are the committed ones and the number is
 * reserved under that lock. A failure stops where it happens: no event until everything
 * succeeded; a failure at "create row" leaves orphan bytes in R2 that no endpoint can reach
 * (accepted — the `StoragePort` philosophy).
 *
 * Contracts are append-only: generating again makes a NEW row, number and R2 key — a contract
 * already printed or signed is never overwritten.
 *
 * Side effects only through `EventBus` (AD-18) — no `AuditService`/`NotificationDispatcher`.
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly storage: StoragePort,
    private readonly renderer: QuoteRendererPort,
    private readonly settings: SettingsService,
  ) {}

  async overview(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<ContractsOverview> {
    const view = await this.orders.getScoped(
      actorAccountId,
      actorPermissions,
      orderId,
      tieredPricingEnabled,
    );
    const [inputs, rows] = await Promise.all([
      this.loadInputs(view, vatRatePercent, this.prisma),
      this.prisma.contract.findMany({
        where: { orderId },
        include: { orderVersion: { select: { versionNo: true } } },
        orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }],
      }),
    ]);
    return {
      contractType: contractTypeFor(view),
      generatable: inputs.blocker === null,
      blockedReason: inputs.blocker?.message ?? null,
      quoteNo: quoteNumberOf(orderId),
      versionNo: inputs.version?.versionNo ?? 0,
      customerName: inputs.customer.name,
      lineCount: view.lineItems.length,
      orderTotal: inputs.totals.total,
      scheduleLabel: scheduleLabelOf(inputs.installments),
      missingPartyFields: missingLegalEntityFields(inputs.company),
      contracts: rows.map((row) => ({
        id: row.id,
        contractNo: row.contractNo,
        contractType: row.type as ContractType,
        versionNo: row.orderVersion.versionNo,
        fileName: row.fileName,
        pdfSize: row.pdfSize,
        createdAt: row.createdAt,
      })),
    };
  }

  async generate(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<ContractView> {
    // 404 (missing OR out of scope — same message) before anything else.
    const view = await this.orders.getScoped(
      actorAccountId,
      actorPermissions,
      orderId,
      tieredPricingEnabled,
    );
    const created = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
        // Committed state under the lock: a payment may have advanced the status (still
        // eligible), a reopen moved it out of the set (blocker), a revise replaced the version
        // whose lines `view` carries (stale ⇒ 409).
        const fresh = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true, currentVersionId: true },
        });
        if (
          fresh === null ||
          fresh.currentVersionId !== view.currentVersionId
        ) {
          throw new AppException(
            ErrorCode.CONFLICT,
            409,
            ORDER_CHANGED_MESSAGE,
          );
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

        // The number is printed INSIDE the PDF, so it is reserved before rendering. `nextval` is
        // the only source: `count() + 1` would hand two concurrent requests the same number.
        const issuedAt = new Date();
        const [reserved] = await tx.$queryRaw<
          { seq: bigint }[]
        >`SELECT nextval(pg_get_serial_sequence('contracts', 'seq')) AS seq`;
        const seq = Number(reserved.seq);
        const type = contractTypeFor(view);
        const contractNo = formatContractNo(type, seq, issuedAt);
        const contractId = randomUUID();
        const fileName = contractFileName(type, seq);

        const html = buildContractHtml({
          type,
          contractNo,
          issuedAt,
          quoteNo: quoteNumberOf(orderId),
          kWp: view.kWp,
          customer: {
            name: inputs.customer.name,
            sdt: inputs.customer.sdt,
            address: inputs.customer.address,
            cccd: inputs.customer.cccd,
            taxCode: inputs.customer.taxCode,
            bankAccount: inputs.customer.bankAccount,
          },
          company: inputs.company,
          lines: view.lineItems.map((line) => ({
            name: line.name,
            unit: line.unit,
            qty: line.qty,
            unitPrice: line.unitPrice,
            amount: line.amount,
            warrantyMonths: line.warrantyMonths,
          })),
          totals: inputs.totals,
          vatRate: inputs.vatRate,
          applyVat: inputs.applyVat,
          installments: inputs.installments ?? [],
        });

        const pdf = await this.renderer.renderPdf(html);
        const pdfKey = contractPdfKey(orderId, contractId);
        await this.storage.putObject(pdfKey, pdf, 'application/pdf');
        await tx.contract.create({
          data: {
            id: contractId,
            seq,
            orderId,
            orderVersionId: version.id,
            type,
            contractNo,
            pdfKey,
            pdfSize: pdf.length,
            fileName,
            createdByAccountId: actorAccountId,
            createdAt: issuedAt,
          },
        });
        return {
          id: contractId,
          contractNo,
          contractType: type,
          versionNo: version.versionNo,
          orderVersionId: version.id,
          fileName,
          pdfSize: pdf.length,
          createdAt: issuedAt,
        };
      },
      { timeout: GENERATE_TX_TIMEOUT_MS },
    );

    // AFTER commit. occurredAt = createdAt: the audit row and the response carry ONE timestamp.
    await this.eventBus.publish(
      new ContractGenerated(
        actorAccountId,
        orderId,
        {
          contractId: created.id,
          contractNo: created.contractNo,
          contractType: created.contractType,
          orderVersionId: created.orderVersionId,
          fileName: created.fileName,
        },
        created.createdAt,
      ),
    );

    return {
      id: created.id,
      contractNo: created.contractNo,
      contractType: created.contractType,
      versionNo: created.versionNo,
      fileName: created.fileName,
      pdfSize: created.pdfSize,
      createdAt: created.createdAt,
    };
  }

  /**
   * Bytes of one generated contract for the download proxy (AD-3). Scope runs BEFORE the contract
   * lookup and BEFORE R2; a contract of ANOTHER order gets the same 404 as a missing one (never
   * confirms it exists).
   */
  async getPdf(
    actorAccountId: string,
    actorPermissions: ReadonlySet<string>,
    orderId: string,
    contractId: string,
  ): Promise<{ body: Buffer; fileName: string }> {
    await this.orders.assertScoped(actorAccountId, actorPermissions, orderId);
    const row = await this.prisma.contract.findFirst({
      where: { id: contractId, orderId },
    });
    if (row === null) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        404,
        'Không tìm thấy hợp đồng.',
      );
    }
    const { body } = await this.storage.getObject(row.pdfKey);
    return { body, fileName: `${row.fileName}.pdf` };
  }

  /**
   * Everything a contract is built from, for an order the caller ALREADY scoped: customer,
   * current version, schedule, company legal entity, totals (the ONE resolver — AD-16) and the
   * eligibility verdict. Shared by `overview` and `generate`, so the screen and the POST never
   * disagree. `db` is the generation's locked transaction, or the plain client for the overview.
   */
  private async loadInputs(
    view: OrderView,
    vatRatePercent: number,
    db: DbClient,
  ) {
    const [customer, version, schedule, company] = await Promise.all([
      db.customer.findUnique({ where: { sdt: view.customerSdt } }),
      view.currentVersionId === null
        ? Promise.resolve(null)
        : db.orderVersion.findUnique({
            where: { id: view.currentVersionId },
          }),
      db.paymentSchedule.findUnique({
        where: { orderId: view.id },
        include: { installments: { orderBy: { seq: 'asc' } } },
      }),
      this.settings.companyLegalEntity(),
    ]);
    if (customer === null) {
      // The FK guarantees the customer exists — this only guards against corrupt data.
      throw new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy đơn.');
    }
    const { totals, vatRate, applyVat } = resolveOrderTotals({
      lines: view.lineItems.map((line) => ({
        unitPrice: line.unitPrice,
        qty: line.qty,
      })),
      version,
      order: view,
      fallbackVatRate: vatRatePercent,
    });
    const installments =
      schedule === null
        ? null
        : schedule.installments.map((installment) => ({
            seq: installment.seq,
            percent: installment.percent,
            amount: installment.amount,
            conditionNote: installment.conditionNote,
          }));
    const blocker = contractBlocker({
      status: view.status,
      lineCount: view.lineItems.length,
      hasSchedule: installments !== null,
      scheduleTotal: (installments ?? []).reduce(
        (sum, installment) => sum + installment.amount,
        0,
      ),
      orderTotal: totals.total,
    });
    return {
      customer,
      version,
      company,
      installments,
      totals,
      vatRate,
      applyVat,
      blocker,
    };
  }
}
