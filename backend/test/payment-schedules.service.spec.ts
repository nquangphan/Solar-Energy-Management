import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { EventBus } from '../src/events/event-bus';
import type { OrdersService } from '../src/orders/orders.service';
import type { InstallmentInput } from '../src/payments/domain/payment-schedule';
import { PaymentScheduleConfigured } from '../src/payments/domain/payment-schedule-events';
import { PaymentSchedulesService } from '../src/payments/payment-schedules.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * PaymentSchedulesService — hermetic unit. Pins the step order (scope → status → validate →
 * tx[lock first → re-check → write] → publish after commit), the no-op on an identical save,
 * and that every rejection publishes nothing. `$transaction` RUNS its callback (a mock that
 * only rejects would hide publish-order bugs).
 */
describe('PaymentSchedulesService', () => {
  const ACTOR = 'acc-actor';
  const ORDER_ID = '0f43a2b1-9c8d-4e7f-a6b5-c4d3e2f10987';
  const VERSION_ID = 'v-1';
  const SCHEDULE_ID = 's-1';
  const TOTAL = 83_010_960;
  const PERMS = new Set<string>(['payments.record', 'orders.view_all']);
  const UPDATED_AT = new Date('2026-10-21T10:00:00Z');

  const ORDER = {
    id: ORDER_ID,
    status: 'dachot',
    currentVersionId: VERSION_ID,
  };
  const INPUT_20_70_10: InstallmentInput[] = [
    { percent: 20, conditionNote: 'Cọc khi ký hợp đồng' },
    { percent: 70, conditionNote: 'Khi thi công' },
    { percent: 10, conditionNote: 'Khi nghiệm thu, bàn giao' },
  ];
  const RESOLVED_20_70_10 = [
    {
      seq: 1,
      percent: 20,
      amount: 16_602_192,
      conditionNote: 'Cọc khi ký hợp đồng',
      milestone: 'coc',
    },
    {
      seq: 2,
      percent: 70,
      amount: 58_107_672,
      conditionNote: 'Khi thi công',
      milestone: null,
    },
    {
      seq: 3,
      percent: 10,
      amount: 8_301_096,
      conditionNote: 'Khi nghiệm thu, bàn giao',
      milestone: 'tat_toan',
    },
  ];

  let log: string[];
  let existing: unknown;
  let fresh: unknown;
  let commitFails: boolean;

  const getScopedTotal = jest.fn();
  const publish = jest.fn();
  const queryRaw = jest.fn();
  const txOrderFindUnique = jest.fn();
  const txScheduleFindUnique = jest.fn();
  const upsert = jest.fn();
  const deleteMany = jest.fn();
  const createMany = jest.fn();
  const scheduleFindUnique = jest.fn();
  const transaction = jest.fn();

  const tx = {
    $queryRaw: queryRaw,
    order: { findUnique: txOrderFindUnique },
    paymentSchedule: { findUnique: txScheduleFindUnique, upsert },
    installment: { deleteMany, createMany },
  };

  const service = new PaymentSchedulesService(
    {
      $transaction: transaction,
      paymentSchedule: { findUnique: scheduleFindUnique },
    } as unknown as PrismaService,
    { publish, subscribe: jest.fn() } as unknown as EventBus,
    { getScopedTotal } as unknown as OrdersService,
  );

  const track =
    <T>(label: string, value: () => T) =>
    () => {
      log.push(label);
      return Promise.resolve(value());
    };

  beforeEach(() => {
    jest.clearAllMocks();
    log = [];
    existing = null;
    fresh = { status: 'dachot', currentVersionId: VERSION_ID };
    commitFails = false;
    getScopedTotal.mockImplementation(
      track('scope', () => ({ order: ORDER, total: TOTAL })),
    );
    queryRaw.mockImplementation(track('lock', () => []));
    txOrderFindUnique.mockImplementation(track('recheck', () => fresh));
    txScheduleFindUnique.mockImplementation(
      track('readSchedule', () => existing),
    );
    upsert.mockImplementation(
      track('upsert', () => ({ id: SCHEDULE_ID, updatedAt: UPDATED_AT })),
    );
    deleteMany.mockImplementation(track('deleteMany', () => ({ count: 0 })));
    createMany.mockImplementation(track('createMany', () => ({ count: 3 })));
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

  async function caught(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (err) {
      return err as AppException;
    }
    throw new Error('expected a rejection');
  }

  const replace = (inputs: InstallmentInput[] = INPUT_20_70_10) =>
    service.replace(ACTOR, PERMS, ORDER_ID, inputs, 8, false);

  it('first save: scope → tx[lock FIRST → recheck → read → upsert → delete → insert] → commit → publish once', async () => {
    const view = await replace();

    expect(log).toEqual([
      'scope',
      'tx:begin',
      'lock',
      'recheck',
      'readSchedule',
      'upsert',
      'deleteMany',
      'createMany',
      'tx:commit',
      'publish',
    ]);
    expect(getScopedTotal).toHaveBeenCalledWith(
      ACTOR,
      PERMS,
      ORDER_ID,
      8,
      false,
    );
    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
    expect(sql).toMatch(/SELECT id FROM orders WHERE id = \? FOR UPDATE/);
    expect(queryRaw.mock.calls[0][1]).toBe(ORDER_ID);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: ORDER_ID },
        create: { orderId: ORDER_ID },
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { scheduleId: SCHEDULE_ID },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: RESOLVED_20_70_10.map((i) => ({ scheduleId: SCHEDULE_ID, ...i })),
    });

    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0] as PaymentScheduleConfigured;
    expect(event).toBeInstanceOf(PaymentScheduleConfigured);
    expect(event.target).toEqual({ type: 'Order', id: ORDER_ID });
    expect(event.actorAccountId).toBe(ACTOR);
    expect(event.before).toBeNull();
    expect(event.after).toEqual(RESOLVED_20_70_10);

    expect(view).toEqual({
      orderId: ORDER_ID,
      configured: true,
      editable: true,
      orderTotal: TOTAL,
      scheduledTotal: TOTAL,
      difference: 0,
      totalMatches: true,
      installments: RESOLVED_20_70_10,
      updatedAt: UPDATED_AT,
    });
  });

  it('replacing an existing schedule carries the old list as `before`', async () => {
    const old = [
      {
        seq: 1,
        percent: 100,
        amount: TOTAL,
        conditionNote: 'Toàn bộ',
        milestone: 'coc',
      },
    ];
    existing = { id: SCHEDULE_ID, updatedAt: UPDATED_AT, installments: old };

    await replace();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(
      (publish.mock.calls[0][0] as PaymentScheduleConfigured).before,
    ).toEqual(old);
  });

  it('an identical save writes nothing and publishes nothing', async () => {
    existing = {
      id: SCHEDULE_ID,
      updatedAt: UPDATED_AT,
      installments: RESOLVED_20_70_10,
    };

    const view = await replace();

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(0);
    expect(view.updatedAt).toBe(UPDATED_AT);
    expect(view.totalMatches).toBe(true);
  });

  it('a mismatching schedule is saved with a warning, not rejected', async () => {
    const view = await replace([
      { percent: 20, conditionNote: 'a' },
      { percent: 70, conditionNote: 'b' },
    ]);
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(view.totalMatches).toBe(false);
    expect(view.scheduledTotal).toBe(16_602_192 + 58_107_672);
    expect(view.difference).toBe(TOTAL - (16_602_192 + 58_107_672));
  });

  it.each(['baogia', 'choduyet', 'hoanthanh', 'huy'])(
    'status %s ⇒ 409 before any transaction, no publish',
    async (status) => {
      getScopedTotal.mockResolvedValue({
        order: { ...ORDER, status },
        total: TOTAL,
      });
      const err = await caught(replace());
      expect(err.getStatus()).toBe(409);
      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(transaction).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it('a first installment resolving to 0 ⇒ 400 with field errors, no transaction, no publish', async () => {
    getScopedTotal.mockResolvedValue({ order: ORDER, total: 50 });
    const err = await caught(
      replace([
        { percent: 1, conditionNote: 'a' },
        { percent: 99, conditionNote: 'b' },
      ]),
    );
    expect(err.getStatus()).toBe(400);
    expect(err.fieldErrors).toEqual([
      {
        field: 'installments.0.amount',
        code: 'firstInstallmentZero',
        message: 'Đợt đầu (cọc) phải lớn hơn 0.',
      },
    ]);
    expect(transaction).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('out of scope (404 from the scoped read) ⇒ nothing else runs', async () => {
    getScopedTotal.mockRejectedValue(
      new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy đơn hàng'),
    );
    const err = await caught(replace());
    expect(err.getStatus()).toBe(404);
    expect(transaction).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    ['cancelled meanwhile', { status: 'huy', currentVersionId: VERSION_ID }],
    ['reopened meanwhile', { status: 'baogia', currentVersionId: VERSION_ID }],
    [
      're-confirmed with a new version',
      { status: 'dachot', currentVersionId: 'v-2' },
    ],
    ['gone', null],
  ])(
    'order %s between the scoped read and the lock ⇒ 409, no write',
    async (_l, state) => {
      fresh = state;
      const err = await caught(replace());
      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Đơn vừa thay đổi — tải lại rồi cấu hình lại lịch.',
      );
      expect(log.slice(0, 4)).toEqual(['scope', 'tx:begin', 'lock', 'recheck']);
      expect(upsert).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it('commit failure after the callback ran ⇒ no publish', async () => {
    commitFails = true;
    await expect(replace()).rejects.toThrow('commit failed');
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  describe('get', () => {
    const get = () => service.get(ACTOR, PERMS, ORDER_ID, 8, false);

    it('scoped read first; not configured ⇒ configured=false, empty list, difference = total', async () => {
      scheduleFindUnique.mockImplementation(track('readSchedule', () => null));
      const view = await get();
      expect(log).toEqual(['scope', 'readSchedule']);
      expect(view).toEqual({
        orderId: ORDER_ID,
        configured: false,
        editable: true,
        orderTotal: TOTAL,
        scheduledTotal: 0,
        difference: TOTAL,
        totalMatches: false,
        installments: [],
        updatedAt: null,
      });
    });

    it('configured schedule against a changed total ⇒ mismatch recomputed on read', async () => {
      scheduleFindUnique.mockResolvedValue({
        id: SCHEDULE_ID,
        updatedAt: UPDATED_AT,
        installments: RESOLVED_20_70_10,
      });
      getScopedTotal.mockResolvedValue({
        order: { ...ORDER, status: 'baogia' },
        total: TOTAL + 1_000,
      });
      const view = await get();
      expect(view.configured).toBe(true);
      expect(view.editable).toBe(false);
      expect(view.totalMatches).toBe(false);
      expect(view.difference).toBe(1_000);
    });

    it('404 from the scoped read ⇒ schedule is never read', async () => {
      getScopedTotal.mockRejectedValue(
        new AppException(ErrorCode.NOT_FOUND, 404, 'Không tìm thấy đơn hàng'),
      );
      await expect(get()).rejects.toBeInstanceOf(AppException);
      expect(scheduleFindUnique).not.toHaveBeenCalled();
    });
  });
});
