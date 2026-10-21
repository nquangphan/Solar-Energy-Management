import type { Payment } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { isUniqueViolation } from '../common/errors/prisma-unique-violation';
import { EventBus } from '../events/event-bus';
import {
  MOC_TU_DONG,
  suKienChoMoc,
  type MocTuDong,
} from '../orders/domain/auto-transition-map';
import type { StatusChanged } from '../orders/domain/order-events';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_ERROR,
  RECORDABLE_ORDER_STATUSES,
  isFutureDate,
  isSamePaymentRequest,
  milestonesReached,
  normalizeNote,
  todayInVietnam,
  validatePayment,
  type PaymentErrorCode,
  type PaymentFieldError,
  type PaymentMethod,
} from './domain/payment';
import {
  DepositRecorded,
  PaymentRecorded,
  type AutoTransitionOutcome,
} from './domain/payment-events';
import {
  PaymentSchedulesService,
  toPaymentView,
  type PaymentScheduleView,
  type PaymentView,
} from './payment-schedules.service';

export interface RecordPaymentInput {
  readonly idempotencyKey: string;
  readonly installmentId: string;
  readonly amount: number;
  readonly paidOn: string;
  readonly method: PaymentMethod;
  readonly note?: string | null;
}

export interface RecordPaymentResult {
  readonly payment: PaymentView;
  readonly schedule: PaymentScheduleView;
  readonly orderStatus: string;
  readonly autoTransition: AutoTransitionOutcome | null;
}

const FIELD_ERROR_MESSAGES: Readonly<Record<PaymentErrorCode, string>> = {
  [PAYMENT_ERROR.exceedsRemaining]: 'Số tiền thu vượt phần còn lại của đợt.',
  [PAYMENT_ERROR.futureDate]: 'Ngày thu không được sau hôm nay.',
};

const NOT_RECORDABLE_MESSAGE =
  'Chỉ ghi nhận thanh toán khi đơn đã chốt và chưa huỷ.';
const ORDER_CHANGED_MESSAGE = 'Đơn vừa thay đổi — tải lại rồi ghi nhận lại.';
const NO_SCHEDULE_MESSAGE = 'Đơn chưa có lịch thanh toán.';
const SCHEDULE_CHANGED_MESSAGE =
  'Lịch thanh toán vừa thay đổi — tải lại rồi ghi nhận lại.';
const KEY_REUSED_MESSAGE = 'Khoá ghi nhận đã được dùng cho một khoản khác.';

function validationError(errors: readonly PaymentFieldError[]): AppException {
  return new AppException(
    ErrorCode.VALIDATION_ERROR,
    400,
    'Khoản thu không hợp lệ.',
    errors.map((e) => ({
      field: e.field,
      code: e.code,
      message: FIELD_ERROR_MESSAGES[e.code],
    })),
  );
}

/**
 * The one outcome the response reports when a payment triggered transitions: the last one that
 * moved the order (that is what `orderStatus` now shows), otherwise the last one attempted.
 * The business event carries every attempt.
 */
function reportedTransition(
  attempts: readonly AutoTransitionOutcome[],
): AutoTransitionOutcome | null {
  return (
    attempts.findLast((a) => a.outcome === 'applied') ?? attempts.at(-1) ?? null
  );
}

/** `paidOn` is stored in a DATE column; UTC midnight keeps the day intact. */
const toDateColumn = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/**
 * Payment recording (FR-12): one payment against one installment, idempotent by a
 * client-generated key, and the automatic status transition it triggers — in ONE transaction
 * under the order row lock (AD-11, decided 2026-10-21).
 *
 * Money already received is never rolled back because of an operational gate: a 403/409 from
 * the transition is caught, the payment still commits, and the refusal is reported in
 * `autoTransition` (outcome `skipped`), logged, and carried by the business event. Any other
 * error rolls the whole transaction back.
 *
 * This service never writes `Order.status` (only `OrdersService.autoTransitionInTx` does,
 * through the engine) and never writes the order aggregate: its only write is `payment.create`.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
    private readonly orders: OrdersService,
    private readonly schedules: PaymentSchedulesService,
  ) {}

  /**
   * Order of steps is load-bearing:
   *  1. scoped read (404) — before anything, a replay included: someone out of scope sending a
   *     used key gets a 404, not the other person's payment;
   *  2. future date (400) — pure, before the tx, a refusal costs no lock;
   *  3. in one transaction: lock the `orders` row FIRST → re-read the order → idempotency
   *     lookup (replay or 409) → status gate and version re-check (409) → schedule + paid sums
   *     read under the lock (409 when missing/changed) → amount vs remaining (400) → insert →
   *     milestones → transitions;
   *  4. AFTER commit: publish the business event once, then each `StatusChanged` once.
   *     A replay publishes nothing.
   *
   * The idempotency lookup sits UNDER the lock: two concurrent requests with one key both see
   * "not there yet" outside a tx, both insert, and the second hits the unique index as a 500.
   * Under the lock they queue and the second sees the first ⇒ replay. The lookup also comes
   * BEFORE the status gate: a retry whose first response was lost must replay what was
   * recorded even if the order was cancelled or reopened in between, not report a refusal.
   */
  async record(
    actorAccountId: string,
    permissions: ReadonlySet<string>,
    orderId: string,
    input: RecordPaymentInput,
    vatRatePercent: number,
    tieredPricingEnabled: boolean,
  ): Promise<RecordPaymentResult> {
    const { order, total } = await this.orders.getScopedTotal(
      actorAccountId,
      permissions,
      orderId,
      vatRatePercent,
      tieredPricingEnabled,
    );
    // ONE timestamp for the whole request: business event, StatusChanged and "today".
    const occurredAt = new Date();
    const today = todayInVietnam(occurredAt);
    if (isFutureDate(input.paidOn, today)) {
      throw validationError([
        { field: 'paidOn', code: PAYMENT_ERROR.futureDate },
      ]);
    }
    const request = {
      orderId,
      installmentId: input.installmentId,
      amount: input.amount,
      paidOn: input.paidOn,
      method: input.method,
      note: normalizeNote(input.note),
    };

    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const fresh = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, currentVersionId: true },
      });
      if (fresh === null) {
        throw new AppException(ErrorCode.CONFLICT, 409, ORDER_CHANGED_MESSAGE);
      }

      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing !== null) {
        const stored = toPaymentView(existing);
        if (
          !isSamePaymentRequest(
            { ...stored, orderId: existing.orderId },
            request,
          )
        ) {
          throw new AppException(ErrorCode.CONFLICT, 409, KEY_REUSED_MESSAGE);
        }
        return { replay: true as const, payment: stored, status: fresh.status };
      }
      if (!RECORDABLE_ORDER_STATUSES.has(fresh.status)) {
        // Left the recordable set since the scoped read ⇒ "it just changed", else plain refusal.
        throw new AppException(
          ErrorCode.CONFLICT,
          409,
          RECORDABLE_ORDER_STATUSES.has(order.status)
            ? ORDER_CHANGED_MESSAGE
            : NOT_RECORDABLE_MESSAGE,
        );
      }
      if (fresh.currentVersionId !== order.currentVersionId) {
        throw new AppException(ErrorCode.CONFLICT, 409, ORDER_CHANGED_MESSAGE);
      }

      const schedule = await tx.paymentSchedule.findUnique({
        where: { orderId },
        include: {
          installments: {
            orderBy: { seq: 'asc' },
            include: { payments: { select: { amount: true } } },
          },
        },
      });
      if (schedule === null) {
        throw new AppException(ErrorCode.CONFLICT, 409, NO_SCHEDULE_MESSAGE);
      }
      const states = schedule.installments.map((row) => ({
        id: row.id,
        seq: row.seq,
        amount: row.amount,
        milestone: row.milestone as MocTuDong | null,
        paid: row.payments.reduce((sum, p) => sum + p.amount, 0),
      }));
      const target = states.find((i) => i.id === input.installmentId);
      if (target === undefined) {
        throw new AppException(
          ErrorCode.CONFLICT,
          409,
          SCHEDULE_CHANGED_MESSAGE,
        );
      }
      const errors = validatePayment({
        amount: input.amount,
        installmentRemaining: target.amount - target.paid,
        paidOn: input.paidOn,
        today,
      });
      if (errors.length > 0) throw validationError(errors);

      let created: Payment;
      try {
        created = await tx.payment.create({
          data: {
            orderId,
            installmentId: input.installmentId,
            amount: input.amount,
            paidOn: toDateColumn(input.paidOn),
            method: input.method,
            note: request.note,
            idempotencyKey: input.idempotencyKey,
            recordedByAccountId: actorAccountId,
          },
        });
      } catch (error) {
        // The order lock serialises one key on ONE order; the same key sent concurrently to
        // ANOTHER order is only stopped by the unique index — that is a reused key, not a 500.
        if (isUniqueViolation(error)) {
          throw new AppException(ErrorCode.CONFLICT, 409, KEY_REUSED_MESSAGE);
        }
        throw error;
      }

      const milestones = milestonesReached({
        installments: states,
        installmentId: target.id,
        amount: input.amount,
        orderTotal: total,
      });
      // Attempted one by one in schedule order: the second sees what the first wrote (both
      // re-read the order through this tx). The next one is attempted only after the previous
      // one MOVED the order: a deposit refused on `dachot` must never let the settlement take
      // the direct `dachot → hoanthanh` edge and skip delivery.
      const statusChanges: StatusChanged[] = [];
      const autoTransitions: AutoTransitionOutcome[] = [];
      for (const milestone of milestones) {
        const event = suKienChoMoc(milestone);
        try {
          const statusChanged = await this.orders.autoTransitionInTx(tx, {
            orderId,
            event,
            actorAccountId,
            actorPermissions: permissions,
            occurredAt,
          });
          if (statusChanged !== null) statusChanges.push(statusChanged);
          autoTransitions.push({
            event,
            outcome: statusChanged === null ? 'already' : 'applied',
            message: null,
          });
        } catch (error) {
          // Only the engine's refusals are swallowed — they are thrown before its first
          // write, so this tx is clean and the payment commits. Anything else rolls back.
          if (
            !(error instanceof AppException) ||
            (error.getStatus() !== 403 && error.getStatus() !== 409)
          ) {
            throw error;
          }
          autoTransitions.push({
            event,
            outcome: 'skipped',
            message: error.message,
          });
          this.logger.warn(
            `Auto transition ${event} skipped for order ${orderId} after payment ${created.id} (HTTP ${error.getStatus()})`,
          );
        }
        if (autoTransitions.at(-1)?.outcome !== 'applied') break;
      }

      const paidTotalBefore = states.reduce((sum, i) => sum + i.paid, 0);
      return {
        replay: false as const,
        payment: toPaymentView(created),
        status: statusChanges.at(-1)?.after.status ?? fresh.status,
        statusChanges,
        autoTransitions,
        isDeposit: target.milestone === MOC_TU_DONG.coc,
        before: {
          installmentSeq: target.seq,
          installmentPaid: target.paid,
          orderPaid: paidTotalBefore,
        },
      };
    });

    if (!outcome.replay) {
      const { payment } = outcome;
      const after = {
        paymentId: payment.id,
        installmentSeq: outcome.before.installmentSeq,
        amount: payment.amount,
        paidOn: payment.paidOn,
        method: payment.method,
        installmentPaid: outcome.before.installmentPaid + payment.amount,
        orderPaid: outcome.before.orderPaid + payment.amount,
        autoTransitions: outcome.autoTransitions,
      };
      const EventClass = outcome.isDeposit ? DepositRecorded : PaymentRecorded;
      await this.eventBus.publish(
        new EventClass(
          actorAccountId,
          orderId,
          outcome.before,
          after,
          occurredAt,
        ),
      );
      for (const statusChanged of outcome.statusChanges) {
        await this.eventBus.publish(statusChanged);
      }
    }

    return {
      payment: outcome.payment,
      schedule: await this.schedules.viewFor(
        { id: orderId, status: outcome.status },
        total,
      ),
      orderStatus: outcome.status,
      autoTransition: outcome.replay
        ? null
        : reportedTransition(outcome.autoTransitions),
    };
  }
}
