import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { EventBus } from '../src/events/event-bus';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
import { StatusChanged } from '../src/orders/domain/order-events';
import type { OrdersService } from '../src/orders/orders.service';
import {
  DepositRecorded,
  PaymentRecorded,
} from '../src/payments/domain/payment-events';
import type { PaymentSchedulesService } from '../src/payments/payment-schedules.service';
import {
  PaymentsService,
  type RecordPaymentInput,
} from '../src/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * PaymentsService — hermetic unit. Pins the step order (scope → status → paidOn → tx[lock FIRST
 * → re-check → idempotency → schedule → validate → insert → transition] → commit → publish), that
 * the transition receives THE tx of `$transaction`, that only 403/409 refusals are swallowed,
 * and the exact publish count of every path. `$transaction` RUNS its callback and can fail at
 * commit (a mock that only rejects would hide publish-order bugs).
 */
describe('PaymentsService', () => {
  const ACTOR = 'acc-accountant';
  const ORDER_ID = '0f43a2b1-9c8d-4e7f-a6b5-c4d3e2f10987';
  const VERSION_ID = 'v-1';
  const KEY = '3b241101-e2bb-4255-8caf-4136c566a962';
  const TOTAL = 83_010_960;
  const PERMS = new Set<string>(['payments.record', 'orders.view_all']);
  const NOW = new Date('2026-10-21T03:00:00.000Z');
  const ORDER = {
    id: ORDER_ID,
    status: 'dachot',
    currentVersionId: VERSION_ID,
  };

  const INSTALLMENTS = [
    { id: 'inst-1', seq: 1, amount: 16_602_192, milestone: 'coc' },
    { id: 'inst-2', seq: 2, amount: 58_107_672, milestone: null },
    { id: 'inst-3', seq: 3, amount: 8_301_096, milestone: 'tat_toan' },
  ];

  const INPUT: RecordPaymentInput = {
    idempotencyKey: KEY,
    installmentId: 'inst-1',
    amount: 16_602_192,
    paidOn: '2026-10-21',
    method: 'bank_transfer',
    note: '  chuyển khoản VCB  ',
  };

  let log: string[];
  let fresh: unknown;
  let existingPayment: unknown;
  let paidByInstallment: Record<string, number[]>;
  let scheduleExists: boolean;
  let commitFails: boolean;
  let txSeen: unknown;

  const getScopedTotal = jest.fn();
  const autoTransitionInTx = jest.fn();
  const viewFor = jest.fn();
  const publish = jest.fn();
  const queryRaw = jest.fn();
  const txOrderFindUnique = jest.fn();
  const txPaymentFindUnique = jest.fn();
  const txPaymentCreate = jest.fn();
  const txScheduleFindUnique = jest.fn();
  const transaction = jest.fn();

  const tx = {
    $queryRaw: queryRaw,
    order: { findUnique: txOrderFindUnique },
    payment: { findUnique: txPaymentFindUnique, create: txPaymentCreate },
    paymentSchedule: { findUnique: txScheduleFindUnique },
  };

  const service = new PaymentsService(
    { $transaction: transaction } as unknown as PrismaService,
    { publish, subscribe: jest.fn() } as unknown as EventBus,
    { getScopedTotal, autoTransitionInTx } as unknown as OrdersService,
    { viewFor } as unknown as PaymentSchedulesService,
  );

  const track =
    <T>(label: string, value: (...args: unknown[]) => T) =>
    (...args: unknown[]) => {
      log.push(label);
      return Promise.resolve(value(...args));
    };

  const statusChanged = (from: string, to: string) =>
    new StatusChanged(
      ACTOR,
      { id: ORDER_ID, status: from } as never,
      { id: ORDER_ID, status: to } as never,
      NOW,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    log = [];
    fresh = { status: 'dachot', currentVersionId: VERSION_ID };
    existingPayment = null;
    paidByInstallment = {};
    scheduleExists = true;
    commitFails = false;
    txSeen = undefined;
    getScopedTotal.mockImplementation(
      track('scope', () => ({ order: ORDER, total: TOTAL })),
    );
    queryRaw.mockImplementation(track('lock', () => []));
    txOrderFindUnique.mockImplementation(track('recheck', () => fresh));
    txPaymentFindUnique.mockImplementation(
      track('idempotency', () => existingPayment),
    );
    txScheduleFindUnique.mockImplementation(
      track('schedule', () =>
        scheduleExists
          ? {
              id: 's-1',
              installments: INSTALLMENTS.map((i) => ({
                ...i,
                payments: (paidByInstallment[i.id] ?? []).map((amount) => ({
                  amount,
                })),
              })),
            }
          : null,
      ),
    );
    txPaymentCreate.mockImplementation(
      track('create', (args) => {
        const { data } = args as { data: Record<string, unknown> };
        return { id: 'pay-new', ...data, createdAt: NOW };
      }),
    );
    autoTransitionInTx.mockImplementation((t: unknown) => {
      txSeen = t;
      log.push('transition');
      return Promise.resolve(statusChanged('dachot', 'dacoc'));
    });
    viewFor.mockImplementation(track('view', () => ({ view: true })));
    publish.mockImplementation(track('publish', () => undefined));
    transaction.mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => {
        log.push('tx:begin');
        const result = await cb(tx);
        if (commitFails) throw new Error('commit failed');
        log.push('tx:commit');
        return result;
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function caught(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (err) {
      return err as AppException;
    }
    throw new Error('expected a rejection');
  }

  const record = (input: Partial<RecordPaymentInput> = {}) =>
    service.record(ACTOR, PERMS, ORDER_ID, { ...INPUT, ...input }, 8, false);

  const publishedTypes = () =>
    publish.mock.calls.map(([e]) => (e as { type: string }).type);

  it('full deposit: exact step order, insert THEN transition on the same tx, publish Deposit then StatusChanged once each', async () => {
    const result = await record();

    expect(log).toEqual([
      'scope',
      'tx:begin',
      'lock',
      'recheck',
      'idempotency',
      'schedule',
      'create',
      'transition',
      'tx:commit',
      'publish',
      'publish',
      'view',
    ]);
    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sql).toMatch(/SELECT id FROM orders WHERE id = \? FOR UPDATE/);
    expect(queryRaw.mock.calls[0][1]).toBe(ORDER_ID);
    expect(txPaymentFindUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: KEY },
    });
    expect(txPaymentCreate).toHaveBeenCalledWith({
      data: {
        orderId: ORDER_ID,
        installmentId: 'inst-1',
        amount: 16_602_192,
        paidOn: new Date('2026-10-21T00:00:00.000Z'),
        method: 'bank_transfer',
        note: 'chuyển khoản VCB',
        idempotencyKey: KEY,
        recordedByAccountId: ACTOR,
      },
    });
    // The transition runs on THE transaction client, with the caller's real permissions.
    expect(txSeen).toBe(tx);
    expect(autoTransitionInTx).toHaveBeenCalledTimes(1);
    expect(autoTransitionInTx).toHaveBeenCalledWith(tx, {
      orderId: ORDER_ID,
      event: SU_KIEN.duCoc,
      actorAccountId: ACTOR,
      actorPermissions: PERMS,
      occurredAt: NOW,
    });

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publishedTypes()).toEqual(['DepositRecorded', 'StatusChanged']);
    const event = publish.mock.calls[0][0] as DepositRecorded;
    expect(event).toBeInstanceOf(DepositRecorded);
    expect(event.target).toEqual({ type: 'Order', id: ORDER_ID });
    // ONE Date for the request: the business event and the transition share it.
    expect(event.occurredAt).toEqual(NOW);
    expect(event.occurredAt).toBe(
      (autoTransitionInTx.mock.calls[0][1] as { occurredAt: Date }).occurredAt,
    );
    expect(event.before).toEqual({
      installmentSeq: 1,
      installmentPaid: 0,
      orderPaid: 0,
    });
    expect(event.after).toEqual({
      paymentId: 'pay-new',
      installmentSeq: 1,
      amount: 16_602_192,
      paidOn: '2026-10-21',
      method: 'bank_transfer',
      installmentPaid: 16_602_192,
      orderPaid: 16_602_192,
      autoTransitions: [{ event: 'du_coc', outcome: 'applied', message: null }],
    });
    expect(JSON.stringify(event)).not.toContain('VCB');

    expect(viewFor).toHaveBeenCalledWith(
      { id: ORDER_ID, status: 'dacoc' },
      TOTAL,
    );
    expect(result).toEqual({
      payment: {
        id: 'pay-new',
        installmentId: 'inst-1',
        amount: 16_602_192,
        paidOn: '2026-10-21',
        method: 'bank_transfer',
        note: 'chuyển khoản VCB',
        recordedAt: NOW,
      },
      schedule: { view: true },
      orderStatus: 'dacoc',
      autoTransition: { event: 'du_coc', outcome: 'applied', message: null },
    });
  });

  it('partial deposit: no milestone, no transition, DepositRecorded once and nothing else', async () => {
    const result = await record({ amount: 10_000_000 });
    expect(autoTransitionInTx).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publishedTypes()).toEqual(['DepositRecorded']);
    expect(result.autoTransition).toBeNull();
    expect(result.orderStatus).toBe('dachot');
  });

  it('completing a deposit already partly paid fires du_coc; one dong more on a paid deposit is a 400', async () => {
    paidByInstallment = { 'inst-1': [10_000_000] };
    const done = await record({ amount: 6_602_192 });
    expect(done.autoTransition?.outcome).toBe('applied');

    jest.clearAllMocks();
    paidByInstallment = { 'inst-1': [10_000_000, 6_602_192] };
    const err = await caught(record({ amount: 1 }));
    expect(err.getStatus()).toBe(400);
    expect(err.fieldErrors).toEqual([
      {
        field: 'amount',
        code: 'exceedsRemaining',
        message: 'Số tiền thu vượt phần còn lại của đợt.',
      },
    ]);
    expect(txPaymentCreate).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('a middle installment publishes PaymentRecorded only', async () => {
    paidByInstallment = { 'inst-1': [16_602_192] };
    await record({ installmentId: 'inst-2', amount: 58_107_672 });
    expect(autoTransitionInTx).not.toHaveBeenCalled();
    expect(publishedTypes()).toEqual(['PaymentRecorded']);
    expect(publish.mock.calls[0][0]).toBeInstanceOf(PaymentRecorded);
  });

  it('the middle installment paid last settles the order: hoan_thanh fires whichever installment completes it', async () => {
    paidByInstallment = { 'inst-1': [16_602_192], 'inst-3': [8_301_096] };
    autoTransitionInTx.mockImplementation(() =>
      Promise.resolve(statusChanged('dagiao', 'hoanthanh')),
    );
    const result = await record({
      installmentId: 'inst-2',
      amount: 58_107_672,
    });
    expect(autoTransitionInTx).toHaveBeenCalledTimes(1);
    expect(autoTransitionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ event: SU_KIEN.hoanThanh }),
    );
    expect(result.autoTransition).toEqual({
      event: 'hoan_thanh',
      outcome: 'applied',
      message: null,
    });
    expect(result.orderStatus).toBe('hoanthanh');
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publishedTypes()).toEqual(['PaymentRecorded', 'StatusChanged']);
  });

  it('the deposit paid last fires du_coc then hoan_thanh in the same tx; each refusal is swallowed on its own', async () => {
    paidByInstallment = { 'inst-2': [58_107_672], 'inst-3': [8_301_096] };
    const message = 'Không chuyển được trạng thái đơn từ trạng thái hiện tại.';
    const seen: unknown[] = [];
    autoTransitionInTx
      .mockImplementationOnce((t: unknown) => {
        seen.push(t);
        return Promise.resolve(statusChanged('dachot', 'dacoc'));
      })
      .mockImplementationOnce((t: unknown) => {
        seen.push(t);
        return Promise.reject(
          new AppException(ErrorCode.CONFLICT, 409, message),
        );
      });
    const warn = jest
      .spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    const result = await record();

    expect(seen).toEqual([tx, tx]);
    expect(
      autoTransitionInTx.mock.calls.map(
        ([, input]) => (input as { event: string }).event,
      ),
    ).toEqual([SU_KIEN.duCoc, SU_KIEN.hoanThanh]);
    expect(txPaymentCreate).toHaveBeenCalledTimes(1);
    // The response reports the transition that moved the order.
    expect(result.autoTransition).toEqual({
      event: 'du_coc',
      outcome: 'applied',
      message: null,
    });
    expect(result.orderStatus).toBe('dacoc');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publishedTypes()).toEqual(['DepositRecorded', 'StatusChanged']);
    const event = publish.mock.calls[0][0] as DepositRecorded;
    expect(event.after.autoTransitions).toEqual([
      { event: 'du_coc', outcome: 'applied', message: null },
      { event: 'hoan_thanh', outcome: 'skipped', message },
    ]);
    warn.mockRestore();
  });

  it('the deposit paid last but refused ⇒ the settlement is NOT attempted (no direct dachot → hoanthanh)', async () => {
    paidByInstallment = { 'inst-2': [58_107_672], 'inst-3': [8_301_096] };
    const message = 'Bạn không có quyền thực hiện chuyển trạng thái này.';
    autoTransitionInTx.mockRejectedValue(
      new AppException(ErrorCode.FORBIDDEN, 403, message),
    );
    const warn = jest
      .spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    const result = await record();

    expect(autoTransitionInTx).toHaveBeenCalledTimes(1);
    expect(result.autoTransition).toEqual({
      event: 'du_coc',
      outcome: 'skipped',
      message,
    });
    expect(txPaymentCreate).toHaveBeenCalledTimes(1);
    expect(publishedTypes()).toEqual(['DepositRecorded']);
    warn.mockRestore();
  });

  it('order already at the target: outcome already, no StatusChanged', async () => {
    autoTransitionInTx.mockResolvedValue(null);
    const result = await record();
    expect(result.autoTransition).toEqual({
      event: 'du_coc',
      outcome: 'already',
      message: null,
    });
    expect(publishedTypes()).toEqual(['DepositRecorded']);
  });

  it.each([
    [
      409,
      ErrorCode.CONFLICT,
      'Đơn còn vật tư chưa xuất kho — xuất kho trước khi hoàn thành.',
    ],
    [
      403,
      ErrorCode.FORBIDDEN,
      'Bạn không có quyền thực hiện chuyển trạng thái này.',
    ],
  ])(
    'transition refused with %s: the payment still commits, outcome skipped + message, business event only',
    async (status, code, message) => {
      paidByInstallment = { 'inst-1': [16_602_192], 'inst-2': [58_107_672] };
      fresh = { status: 'nghiemthu', currentVersionId: VERSION_ID };
      getScopedTotal.mockResolvedValue({
        order: { ...ORDER, status: 'nghiemthu' },
        total: TOTAL,
      });
      autoTransitionInTx.mockRejectedValue(
        new AppException(code, status, message),
      );
      const warn = jest
        .spyOn(
          (service as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const result = await record({
        installmentId: 'inst-3',
        amount: 8_301_096,
      });

      expect(txPaymentCreate).toHaveBeenCalledTimes(1);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(result.autoTransition).toEqual({
        event: 'hoan_thanh',
        outcome: 'skipped',
        message,
      });
      expect(result.orderStatus).toBe('nghiemthu');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).not.toContain(message);
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0][0] as PaymentRecorded;
      expect(event).toBeInstanceOf(PaymentRecorded);
      expect(event.after.autoTransitions).toEqual([result.autoTransition]);
    },
  );

  it.each([
    ['a database error', new Error('connection reset')],
    [
      'a 404 AppException',
      new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy đơn hàng'),
    ],
    [
      'a 400 AppException',
      new AppException(ErrorCode.VALIDATION_ERROR, 400, 'x'),
    ],
  ])(
    'transition failing with %s is NOT swallowed: rethrown, tx rolls back, nothing published',
    async (_l, error) => {
      autoTransitionInTx.mockRejectedValue(error);
      await expect(record()).rejects.toBe(error);
      expect(log).not.toContain('tx:commit');
      expect(publish).not.toHaveBeenCalled();
      expect(viewFor).not.toHaveBeenCalled();
    },
  );

  it('commit failure after the callback ran ⇒ nothing published', async () => {
    commitFails = true;
    await expect(record()).rejects.toThrow('commit failed');
    expect(txPaymentCreate).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  describe('idempotency', () => {
    const stored = {
      id: 'pay-old',
      orderId: ORDER_ID,
      installmentId: 'inst-1',
      amount: 16_602_192,
      paidOn: new Date('2026-10-21T00:00:00.000Z'),
      method: 'bank_transfer',
      note: 'chuyển khoản VCB',
      idempotencyKey: KEY,
      createdAt: new Date('2026-10-21T02:00:00.000Z'),
    };

    it('same key + same payload ⇒ replay: no write, no transition, 0 publish, current view, autoTransition null', async () => {
      existingPayment = stored;
      fresh = { status: 'dacoc', currentVersionId: VERSION_ID };
      const result = await record();
      expect(log).toEqual([
        'scope',
        'tx:begin',
        'lock',
        'recheck',
        'idempotency',
        'tx:commit',
        'view',
      ]);
      expect(txPaymentCreate).not.toHaveBeenCalled();
      expect(autoTransitionInTx).not.toHaveBeenCalled();
      expect(publish).toHaveBeenCalledTimes(0);
      expect(result.payment.id).toBe('pay-old');
      expect(result.orderStatus).toBe('dacoc');
      expect(result.autoTransition).toBeNull();
    });

    it.each([
      ['another amount', { amount: 1 }],
      ['another installment', { installmentId: 'inst-2' }],
      ['another date', { paidOn: '2026-10-20' }],
      ['another method', { method: 'cash' as const }],
      ['another note', { note: 'khác' }],
    ])('same key + %s ⇒ 409, nothing written', async (_l, diff) => {
      existingPayment = stored;
      const err = await caught(record(diff));
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Khoá ghi nhận đã được dùng cho một khoản khác.',
      );
      expect(txPaymentCreate).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('same key used on ANOTHER order ⇒ 409 (never a replay of that order)', async () => {
      existingPayment = { ...stored, orderId: 'other-order' };
      const err = await caught(record());
      expect(err.getStatus()).toBe(409);
      expect(txPaymentCreate).not.toHaveBeenCalled();
    });

    it('out of scope ⇒ 404 before the key is even looked up', async () => {
      existingPayment = stored;
      getScopedTotal.mockRejectedValue(
        new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy đơn hàng'),
      );
      const err = await caught(record());
      expect(err.getStatus()).toBe(404);
      expect(transaction).not.toHaveBeenCalled();
      expect(txPaymentFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('refusals publish nothing and write nothing', () => {
    it.each(['baogia', 'choduyet', 'huy'])(
      'order %s ⇒ 409 under the lock, after the key lookup, nothing written',
      async (status) => {
        getScopedTotal.mockResolvedValue({
          order: { ...ORDER, status },
          total: TOTAL,
        });
        fresh = { status, currentVersionId: VERSION_ID };
        const err = await caught(record());
        expect(err.getStatus()).toBe(409);
        expect(err.message).toBe(
          'Chỉ ghi nhận thanh toán khi đơn đã chốt và chưa huỷ.',
        );
        expect(log).toEqual(['tx:begin', 'lock', 'recheck', 'idempotency']);
        expect(txPaymentCreate).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      },
    );

    it('a retry whose first response was lost replays even after the order was cancelled', async () => {
      getScopedTotal.mockResolvedValue({
        order: { ...ORDER, status: 'huy' },
        total: TOTAL,
      });
      fresh = { status: 'huy', currentVersionId: VERSION_ID };
      existingPayment = {
        id: 'pay-old',
        orderId: ORDER_ID,
        installmentId: 'inst-1',
        amount: 16_602_192,
        paidOn: new Date('2026-10-21T00:00:00.000Z'),
        method: 'bank_transfer',
        note: 'chuyển khoản VCB',
        createdAt: NOW,
      };
      const result = await record();
      expect(result.payment.id).toBe('pay-old');
      expect(result.autoTransition).toBeNull();
      expect(result.orderStatus).toBe('huy');
      expect(txPaymentCreate).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('the same key already used on ANOTHER order, inserted concurrently ⇒ unique violation becomes 409', async () => {
      txPaymentCreate.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );
      const err = await caught(record());
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Khoá ghi nhận đã được dùng cho một khoản khác.',
      );
      expect(autoTransitionInTx).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('any other insert failure is not turned into a 409', async () => {
      const boom = new Error('connection lost');
      txPaymentCreate.mockRejectedValue(boom);
      await expect(record()).rejects.toBe(boom);
      expect(publish).not.toHaveBeenCalled();
    });

    it('hoanthanh order with money still owed ⇒ recorded', async () => {
      getScopedTotal.mockResolvedValue({
        order: { ...ORDER, status: 'hoanthanh' },
        total: TOTAL,
      });
      fresh = { status: 'hoanthanh', currentVersionId: VERSION_ID };
      paidByInstallment = { 'inst-1': [16_602_192] };
      await record({ installmentId: 'inst-2', amount: 1_000 });
      expect(txPaymentCreate).toHaveBeenCalledTimes(1);
    });

    it('payment date tomorrow in Vietnam ⇒ 400 paidOn/futureDate before any transaction', async () => {
      // NOW = 03:00 UTC = 10:00 in Vietnam on 2026-10-21.
      const err = await caught(record({ paidOn: '2026-10-22' }));
      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors).toEqual([
        {
          field: 'paidOn',
          code: 'futureDate',
          message: 'Ngày thu không được sau hôm nay.',
        },
      ]);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('23:30 UTC is already the next day in Vietnam: that date is accepted', async () => {
      jest.setSystemTime(new Date('2026-10-21T23:30:00.000Z'));
      await record({ paidOn: '2026-10-22' });
      expect(txPaymentCreate).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['cancelled meanwhile', { status: 'huy', currentVersionId: VERSION_ID }],
      [
        'reopened meanwhile',
        { status: 'baogia', currentVersionId: VERSION_ID },
      ],
      [
        're-confirmed with a new version',
        { status: 'dachot', currentVersionId: 'v-2' },
      ],
      ['gone', null],
    ])(
      'order %s between the scoped read and the lock ⇒ 409, nothing written',
      async (_l, state) => {
        fresh = state;
        const err = await caught(record());
        expect(err.getStatus()).toBe(409);
        expect(err.message).toBe(
          'Đơn vừa thay đổi — tải lại rồi ghi nhận lại.',
        );
        expect(log).toEqual(
          state === null
            ? ['scope', 'tx:begin', 'lock', 'recheck']
            : ['scope', 'tx:begin', 'lock', 'recheck', 'idempotency'],
        );
        expect(txPaymentCreate).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      },
    );

    it('no schedule ⇒ 409', async () => {
      scheduleExists = false;
      const err = await caught(record());
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe('Đơn chưa có lịch thanh toán.');
      expect(txPaymentCreate).not.toHaveBeenCalled();
    });

    it('installment not in the current schedule (replaced, or another order) ⇒ 409', async () => {
      const err = await caught(
        record({ installmentId: 'inst-of-old-schedule' }),
      );
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Lịch thanh toán vừa thay đổi — tải lại rồi ghi nhận lại.',
      );
      expect(txPaymentCreate).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });
  });
});
