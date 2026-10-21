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

/** Schedule as returned to clients — every number computed here, never by the client. */
export interface PaymentScheduleView {
  readonly orderId: string;
  readonly configured: boolean;
  readonly editable: boolean;
  readonly orderTotal: number;
  readonly scheduledTotal: number;
  readonly difference: number;
  readonly totalMatches: boolean;
  readonly installments: readonly ResolvedInstallment[];
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

/**
 * Payment schedule of an order (FR-11): read, and replace-all.
 *
 * Scope first: every public method goes through `OrdersService.getScopedTotal()` before it
 * touches anything, so an order the caller cannot see is a 404 with the same message as a
 * missing one (source-guard `no-unscoped-order-write.spec.ts`).
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
    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { orderId },
      include: { installments: { orderBy: { seq: 'asc' } } },
    });
    return this.viewOf(
      order,
      total,
      schedule === null ? null : schedule.installments.map(toResolved),
      schedule?.updatedAt ?? null,
    );
  }

  /**
   * Replace the whole installment list. Order of steps is load-bearing:
   *  1. scoped read (404) → 2. status gate (409) → 3. resolve + validate (400) — all before a
   *     transaction, so a rejected request costs no lock;
   *  4. in one transaction: lock the `orders` row FIRST (the same lock payment recording takes),
   *     re-read status/effective version (409 if the total we resolved against is stale), skip
   *     an identical list, then upsert schedule + delete + insert installments;
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

      const existing = await tx.paymentSchedule.findUnique({
        where: { orderId },
        include: { installments: { orderBy: { seq: 'asc' } } },
      });
      let before: ResolvedInstallment[] | null = null;
      if (existing !== null) {
        before = existing.installments.map(toResolved);
        if (isSameSchedule(before, after)) {
          return { changed: false, before, updatedAt: existing.updatedAt };
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
      return { changed: true, before, updatedAt: schedule.updatedAt };
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
    return this.viewOf(order, total, after, outcome.updatedAt);
  }

  private viewOf(
    order: Order,
    orderTotal: number,
    installments: readonly ResolvedInstallment[] | null,
    updatedAt: Date | null,
  ): PaymentScheduleView {
    const list = installments ?? [];
    const scheduledTotal = list.reduce((sum, i) => sum + i.amount, 0);
    const difference = orderTotal - scheduledTotal;
    return {
      orderId: order.id,
      configured: installments !== null,
      editable: EDITABLE_ORDER_STATUSES.has(order.status),
      orderTotal,
      scheduledTotal,
      difference,
      totalMatches: installments !== null && difference === 0,
      installments: list,
      updatedAt,
    };
  }
}
