import { Injectable } from '@nestjs/common';
import type { Order } from '@prisma/client';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { EventBus } from '../events/event-bus';
import type { MocTuDong } from '../orders/domain/auto-transition-map';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { AMOUNT_TOO_LARGE_MESSAGE } from './dto/installment-input.dto';
import {
  EDITABLE_ORDER_STATUSES,
  SCHEDULE_ERROR,
  isSameSchedule,
  resolveInstallments,
  type InstallmentInput,
  type ResolvedInstallment,
  type ScheduleErrorCode,
} from './domain/payment-schedule';
import { PaymentScheduleConfigured } from './domain/payment-schedule-events';
import {
  RECORDABLE_ORDER_STATUSES,
  installmentStatus,
  orderPaymentStatus,
  paidPercent,
  type PaymentStatus,
} from './domain/payment';

/** One recorded payment as returned to clients. */
export interface PaymentView {
  readonly id: string;
  readonly installmentId: string;
  readonly amount: number;
  readonly paidOn: string;
  readonly method: string;
  readonly note: string | null;
  readonly recordedAt: Date;
}

/** One installment with what has been collected on it — every figure computed here. */
export interface InstallmentView extends ResolvedInstallment {
  readonly id: string;
  readonly paidAmount: number;
  readonly remainingAmount: number;
  readonly status: PaymentStatus;
  readonly payments: readonly PaymentView[];
}

/** Schedule as returned to clients — every number computed here, never by the client. */
export interface PaymentScheduleView {
  readonly orderId: string;
  readonly configured: boolean;
  readonly editable: boolean;
  readonly orderTotal: number;
  readonly scheduledTotal: number;
  readonly difference: number;
  readonly totalMatches: boolean;
  readonly paidTotal: number;
  readonly remainingTotal: number;
  readonly paidPercent: number;
  readonly paymentStatus: PaymentStatus;
  readonly recordable: boolean;
  readonly installments: readonly InstallmentView[];
  readonly updatedAt: Date | null;
}

const ERROR_MESSAGES: Readonly<Record<ScheduleErrorCode, string>> = {
  [SCHEDULE_ERROR.exactlyOneOf]: 'Nhập đúng một trong tỉ lệ (%) hoặc số tiền.',
  [SCHEDULE_ERROR.firstInstallmentZero]: 'Đợt đầu (cọc) phải lớn hơn 0.',
  [SCHEDULE_ERROR.resolvedZero]:
    'Đợt này tính ra 0 đồng — tăng tỉ lệ hoặc nhập số tiền.',
  [SCHEDULE_ERROR.amountTooLarge]: AMOUNT_TOO_LARGE_MESSAGE,
};

const NOT_EDITABLE_MESSAGE =
  'Chỉ cấu hình lịch thanh toán khi đơn đã chốt và chưa đóng.';
const ORDER_CHANGED_MESSAGE =
  'Đơn vừa thay đổi — tải lại rồi cấu hình lại lịch.';
const HAS_PAYMENTS_MESSAGE = 'Đơn đã có thanh toán — không sửa lịch được.';

interface StoredInstallment {
  readonly seq: number;
  readonly percent: number | null;
  readonly amount: number;
  readonly conditionNote: string;
  readonly milestone: string | null;
}

const toResolved = (row: StoredInstallment): ResolvedInstallment => ({
  seq: row.seq,
  percent: row.percent,
  amount: row.amount,
  conditionNote: row.conditionNote,
  milestone: row.milestone as MocTuDong | null,
});

interface StoredPayment {
  readonly id: string;
  readonly installmentId: string;
  readonly amount: number;
  readonly paidOn: Date;
  readonly method: string;
  readonly note: string | null;
  readonly createdAt: Date;
}

/** `paidOn` is a DATE column: Prisma returns UTC midnight, so the ISO date part is the day. */
export const toPaymentView = (row: StoredPayment): PaymentView => ({
  id: row.id,
  installmentId: row.installmentId,
  amount: row.amount,
  paidOn: row.paidOn.toISOString().slice(0, 10),
  method: row.method,
  note: row.note,
  recordedAt: row.createdAt,
});

/**
 * Payment schedule of an order (FR-11): read, and replace-all.
 *
 * Scope first: every public method goes through `OrdersService.getScopedTotal()` before it
 * touches anything, so an order the caller cannot see is a 404 with the same message as a
 * missing one (source-guard `no-unscoped-order-write.spec.ts`).
 *
 * Once an order has a payment its schedule is frozen (409 on replace): `installments` and
 * `payments` then can never disagree, and no replace can hit the FK from `payments`.
 *
 * This service never writes the order aggregate and never touches `Order.status`.
 */
@Injectable()
export class PaymentSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly orders: OrdersService,
  ) {}

  /** Schedule of an order in any status, with mismatch figures against the CURRENT total. */
  async get(
    callerAccountId: string,
    permissions: ReadonlySet<string>,
    orderId: string,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<PaymentScheduleView> {
    const { order, total } = await this.orders.getScopedTotal(
      callerAccountId,
      permissions,
      orderId,
      vatRatePercent,
      tieredPricingEnabled,
    );
    return this.viewFor(order, total);
  }

  /**
   * Replace the whole installment list. Order of steps is load-bearing:
   *  1. scoped read (404) → 2. status gate (409) → 3. resolve + validate (400) — all before a
   *     transaction, so a rejected request costs no lock;
   *  4. in one transaction: lock the `orders` row FIRST (the same lock payment recording takes),
   *     re-read status/effective version (409 if the total we resolved against is stale), refuse
   *     when the order already has a payment (409 — checked under the lock, a payment may have
   *     just committed), skip an identical list, then upsert schedule + delete + insert
   *     installments;
   *  5. publish `PaymentScheduleConfigured` AFTER commit, once.
   *
   * Without the row lock, delete+insert is not an atomic replace under READ COMMITTED: two
   * concurrent saves interleave into duplicate `seq` rows (P2002 ⇒ 500) or a doubled list, and
   * two first-time saves race on the `order_id` unique.
   */
  async replace(
    actorAccountId: string,
    permissions: ReadonlySet<string>,
    orderId: string,
    inputs: readonly InstallmentInput[],
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<PaymentScheduleView> {
    const { order, total } = await this.orders.getScopedTotal(
      actorAccountId,
      permissions,
      orderId,
      vatRatePercent,
      tieredPricingEnabled,
    );
    if (!EDITABLE_ORDER_STATUSES.has(order.status)) {
      throw new AppException(ErrorCode.CONFLICT, 409, NOT_EDITABLE_MESSAGE);
    }
    const resolved = resolveInstallments(total, inputs);
    if (!resolved.ok) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        400,
        'Lịch thanh toán không hợp lệ.',
        resolved.errors.map((e) => ({
          field: e.field,
          code: e.code,
          message: ERROR_MESSAGES[e.code],
        })),
      );
    }
    const after = resolved.installments;

    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const fresh = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, currentVersionId: true },
      });
      if (
        fresh === null ||
        !EDITABLE_ORDER_STATUSES.has(fresh.status) ||
        fresh.currentVersionId !== order.currentVersionId
      ) {
        throw new AppException(ErrorCode.CONFLICT, 409, ORDER_CHANGED_MESSAGE);
      }
      if ((await tx.payment.count({ where: { orderId } })) > 0) {
        throw new AppException(ErrorCode.CONFLICT, 409, HAS_PAYMENTS_MESSAGE);
      }

      const existing = await tx.paymentSchedule.findUnique({
        where: { orderId },
        include: { installments: { orderBy: { seq: 'asc' } } },
      });
      let before: ResolvedInstallment[] | null = null;
      if (existing !== null) {
        before = existing.installments.map(toResolved);
        if (isSameSchedule(before, after)) {
          return { changed: false, before };
        }
      }

      const schedule = await tx.paymentSchedule.upsert({
        where: { orderId },
        create: { orderId },
        update: { updatedAt: new Date() },
      });
      await tx.installment.deleteMany({ where: { scheduleId: schedule.id } });
      // `after` is never empty (DTO ArrayMinSize(1)); the guard keeps an empty createMany
      // from ever reaching the driver.
      if (after.length > 0) {
        await tx.installment.createMany({
          data: after.map((i) => ({ scheduleId: schedule.id, ...i })),
        });
      }
      return { changed: true, before };
    });

    if (outcome.changed) {
      await this.eventBus.publish(
        new PaymentScheduleConfigured(
          actorAccountId,
          orderId,
          outcome.before,
          after,
          new Date(),
        ),
      );
    }
    return this.viewFor(order, total);
  }

  /**
   * The schedule view of an order, read fresh: installments, the payments on each, and every
   * paid/remaining/status figure (pure domain functions). Shared with payment recording so the
   * view is built in exactly one place. `order` must already be scoped by the caller.
   */
  async viewFor(
    order: Pick<Order, 'id' | 'status'>,
    orderTotal: number,
  ): Promise<PaymentScheduleView> {
    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { orderId: order.id },
      include: {
        installments: {
          orderBy: { seq: 'asc' },
          include: {
            payments: { orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }] },
          },
        },
      },
    });
    const installments: InstallmentView[] = (schedule?.installments ?? []).map(
      (row) => {
        const paidAmount = row.payments.reduce((sum, p) => sum + p.amount, 0);
        return {
          id: row.id,
          ...toResolved(row),
          paidAmount,
          remainingAmount: Math.max(0, row.amount - paidAmount),
          status: installmentStatus(row.amount, paidAmount),
          payments: row.payments.map(toPaymentView),
        };
      },
    );
    const scheduledTotal = installments.reduce((sum, i) => sum + i.amount, 0);
    const paidTotal = installments.reduce((sum, i) => sum + i.paidAmount, 0);
    const difference = orderTotal - scheduledTotal;
    return {
      orderId: order.id,
      configured: schedule !== null,
      editable: EDITABLE_ORDER_STATUSES.has(order.status) && paidTotal === 0,
      orderTotal,
      scheduledTotal,
      difference,
      totalMatches: schedule !== null && difference === 0,
      paidTotal,
      remainingTotal: orderTotal - paidTotal,
      paidPercent: paidPercent(orderTotal, paidTotal),
      paymentStatus: orderPaymentStatus(orderTotal, paidTotal),
      recordable: RECORDABLE_ORDER_STATUSES.has(order.status),
      installments,
      updatedAt: schedule?.updatedAt ?? null,
    };
  }
}
