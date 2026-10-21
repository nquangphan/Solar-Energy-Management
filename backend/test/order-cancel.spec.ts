import type { Order } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import {
  OrderCancelled,
  StatusChanged,
} from '../src/orders/domain/order-events';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Unit `OrdersService.huyDon()` — lane HUỶ ĐƠN KÈM LÝ DO (Story 5.7, FR-9/AD-11).
 *
 * Bốn thứ đắt nhất được canh ở đây:
 *  1. LÝ DO LÀ BẮT BUỘC — gỡ validate ⇒ đơn huỷ không ai biết vì sao. Rỗng/khoảng trắng/quá
 *     ngắn phải ăn 400 và `Order.status` KHÔNG được đổi, KHÔNG event nào phát ra.
 *  2. MỘT `occurredAt` cho cả lượt — cột `cancelledAt`, `StatusChanged`, `OrderCancelled`
 *     phải cùng một "lúc". Ba toạ độ lệch nhau là mất liên kết giữa lý do và hàng audit.
 *  3. PUBLISH SAU COMMIT (AD-18) — transaction rollback ⇒ 0 event. Publish trước commit là
 *     thông báo một việc chưa chắc đã xảy ra.
 *  4. AC-11 — đường huỷ KHÔNG chạm tồn kho. Ở đây canh bằng hành vi (không lệnh ghi nào
 *     ngoài `updateMany` status + `update` hai cột lý do); source-guard canh bằng văn bản.
 */
describe('OrdersService.huyDon (Story 5.7)', () => {
  const ACTOR = 'acc-sale';
  const ORDER_ID = 'ord-5-7';
  const LY_DO = 'Khách đổi ý, không lắp nữa';

  const QUYEN_DU: ReadonlySet<string> = new Set([
    PERM.ordersViewAll,
    PERM.quotesCreateEdit,
  ]);

  function don(status: string): Order {
    return {
      id: ORDER_ID,
      status,
      customerSdt: '+84912345678',
      currentVersionId: 'ver-1',
      ownerAccountId: ACTOR,
      assigneeAccountId: null,
      sourceId: 'src-fb',
      custType: 'CA_NHAN',
      scopeThietBi: true,
      scopeThiCong: true,
      scopeVanChuyen: true,
      kWp: null,
      vatMode: null,
      validityNote: null,
      cancelReason: null,
      cancelledAt: null,
      createdAt: new Date('2026-07-18T01:00:00Z'),
      updatedAt: new Date('2026-07-18T01:00:00Z'),
    };
  }

  const orderRepo = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  };
  const queryRaw = jest.fn();
  const transaction = jest.fn();
  const txMock = { order: orderRepo, $queryRaw: queryRaw };
  const prisma = {
    order: orderRepo,
    $transaction: transaction,
    $queryRaw: queryRaw,
  } as unknown as PrismaService;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  let service: OrdersService;

  function goi(input: { lyDo?: string; quyen?: ReadonlySet<string> } = {}) {
    return service.huyDon({
      callerAccountId: ACTOR,
      quyen: input.quyen ?? QUYEN_DU,
      orderId: ORDER_ID,
      lyDo: input.lyDo ?? LY_DO,
    });
  }

  async function bat(promise: Promise<unknown>): Promise<AppException> {
    try {
      await promise;
    } catch (err: unknown) {
      return err as AppException;
    }
    throw new Error('Kỳ vọng ném AppException nhưng không có lỗi nào.');
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(
      prisma,
      eventBus as unknown as EventBus,
      fakeStorage(),
      {} as unknown as StockVouchersService,
    );
    orderRepo.findFirst.mockResolvedValue(don('baogia'));
    orderRepo.updateMany.mockResolvedValue({ count: 1 });
    orderRepo.update.mockResolvedValue(don('huy'));
    queryRaw.mockResolvedValue([]);
    transaction.mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
    );
  });

  describe('đường thành công — cả BA trạng thái có cạnh huỷ (AC-1)', () => {
    it.each(['baogia', 'dachot', 'dacoc'])(
      'đơn `%s` ⇒ status về `huy` qua cổng atomic theo status quan sát được',
      async (status) => {
        orderRepo.findFirst.mockResolvedValue(don(status));
        const ketQua = await goi();
        expect(ketQua.status).toBe('huy');
        expect(orderRepo.updateMany).toHaveBeenCalledWith({
          where: { id: ORDER_ID, status },
          data: { status: 'huy' },
        });
      },
    );

    it('ghi `cancelReason` + `cancelledAt` trong CÙNG transaction (AC-8)', async () => {
      const ketQua = await goi();
      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { cancelReason: LY_DO, cancelledAt: ketQua.occurredAt },
      });
    });

    it('lý do được TRIM trước khi lưu — khoảng trắng thừa không phải nội dung', async () => {
      await goi({ lyDo: `   ${LY_DO}   ` });
      expect(orderRepo.update.mock.calls[0][0].data.cancelReason).toBe(LY_DO);
    });

    it('phát ĐÚNG HAI event, thứ tự `StatusChanged` → `OrderCancelled` (AC-4)', async () => {
      await goi();
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const [thu1] = eventBus.publish.mock.calls[0] as [StatusChanged];
      const [thu2] = eventBus.publish.mock.calls[1] as [OrderCancelled];
      expect(thu1).toBeInstanceOf(StatusChanged);
      expect(thu1.before.status).toBe('baogia');
      expect(thu1.after.status).toBe('huy');
      expect(thu2).toBeInstanceOf(OrderCancelled);
      expect(thu2.lyDo).toBe(LY_DO);
      expect(thu2.statusTruocHuy).toBe('baogia');
      expect(thu2.orderVersionId).toBe('ver-1');
      expect(thu2.target).toEqual({ type: 'Order', id: ORDER_ID });
    });

    it('MỘT `occurredAt` cho cả lượt: cột `cancelledAt` ≡ hai event ≡ giá trị trả về', async () => {
      const ketQua = await goi();
      const [statusChanged] = eventBus.publish.mock.calls[0] as [StatusChanged];
      const [orderCancelled] = eventBus.publish.mock.calls[1] as [
        OrderCancelled,
      ];
      const cot = orderRepo.update.mock.calls[0][0].data.cancelledAt as Date;
      expect(cot.getTime()).toBe(ketQua.occurredAt.getTime());
      expect(statusChanged.occurredAt.getTime()).toBe(
        ketQua.occurredAt.getTime(),
      );
      expect(orderCancelled.occurredAt.getTime()).toBe(
        ketQua.occurredAt.getTime(),
      );
    });
  });

  describe('lý do là BẮT BUỘC (AC-5)', () => {
    it.each([
      ['rỗng', ''],
      ['chỉ khoảng trắng', '    '],
      ['hai ký tự sau trim', ' x. '],
    ])('%s ⇒ 400 VALIDATION_ERROR kèm fieldErrors.lyDo', async (_ten, lyDo) => {
      const err = await bat(goi({ lyDo }));
      expect(err.getStatus()).toBe(400);
      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0].field).toBe('lyDo');
    });

    it('lý do không hợp lệ ⇒ status KHÔNG đổi, KHÔNG event nào phát ra', async () => {
      await bat(goi({ lyDo: '  ' }));
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('đúng 3 ký tự sau trim là HỢP LỆ — ngưỡng là >= 3, không phải > 3', async () => {
      await expect(goi({ lyDo: ' huỷ ' })).resolves.toBeDefined();
    });
  });

  describe('quyền và trạng thái (AC-6, AC-7)', () => {
    it('thiếu `quotes.create_edit` ⇒ 403, status không đổi', async () => {
      const err = await bat(
        goi({ quyen: new Set([PERM.ordersViewAll]) }),
      );
      expect(err.getStatus()).toBe(403);
      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it.each(['choduyet', 'thicong', 'nghiemthu', 'danggiao', 'dagiao', 'hoanthanh'])(
      'trạng thái `%s` không có cạnh huỷ ⇒ 409',
      async (status) => {
        orderRepo.findFirst.mockResolvedValue(don(status));
        const err = await bat(goi());
        expect(err.getStatus()).toBe(409);
        expect(err.errorCode).toBe(ErrorCode.CONFLICT);
        expect(orderRepo.updateMany).not.toHaveBeenCalled();
      },
    );

    it('đơn ĐÃ huỷ ⇒ 409, KHÔNG no-op im lặng — người bấm cần biết việc đã xảy ra rồi', async () => {
      orderRepo.findFirst.mockResolvedValue(don('huy'));
      const err = await bat(goi());
      expect(err.getStatus()).toBe(409);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('đơn ngoài phạm vi xem ⇒ 404, không rò rỉ sự tồn tại của đơn', async () => {
      orderRepo.findFirst.mockResolvedValue(null);
      const err = await bat(goi());
      expect(err.getStatus()).toBe(404);
      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('ranh giới transaction (AC-8)', () => {
    it('COMMIT hỏng SAU khi thân tx chạy xong ⇒ KHÔNG event nào publish (AD-18)', async () => {
      // ⚠️ Mock phải CHẠY callback rồi mới ném. `mockRejectedValue` trần không chạy thân tx,
      // nên nó xanh y hệt cho cả bản publish-trong-tx lẫn publish-sau-commit — tức là không
      // đo được thứ nó tự nhận là đang đo (đột biến "publish trước commit" sống sót).
      transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => {
        await fn(txMock);
        throw new Error('commit-that-bai');
      });

      await bat(goi());

      // Thân tx đã chạy: nếu publish nằm trong đó, event vừa thông báo một việc bị rollback.
      expect(orderRepo.updateMany).toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('thua cổng atomic (đơn vừa đổi status ở request khác) ⇒ 409, 0 event', async () => {
      orderRepo.updateMany.mockResolvedValue({ count: 0 });
      const err = await bat(goi());
      expect(err.getStatus()).toBe(409);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('AC-11: đường huỷ chỉ chạm ĐÚNG hai lệnh ghi — status và hai cột lý do', async () => {
      await goi();
      expect(orderRepo.updateMany).toHaveBeenCalledTimes(1);
      expect(orderRepo.update).toHaveBeenCalledTimes(1);
      expect(Object.keys(orderRepo.update.mock.calls[0][0].data).sort()).toEqual(
        ['cancelReason', 'cancelledAt'],
      );
    });
  });

  describe('lifecycle trả `coTheHuy` (AC-9)', () => {
    it('đơn `baogia` + có quyền ⇒ `coTheHuy: true`', async () => {
      const vongDoi = await service.lifecycle(ACTOR, QUYEN_DU, ORDER_ID);
      expect(vongDoi.coTheHuy).toBe(true);
    });

    it('đơn `baogia` nhưng THIẾU quyền ⇒ `coTheHuy: false` (backend tính, không client)', async () => {
      const vongDoi = await service.lifecycle(
        ACTOR,
        new Set([PERM.ordersViewAll]),
        ORDER_ID,
      );
      expect(vongDoi.coTheHuy).toBe(false);
    });

    it('đơn `thicong` ⇒ `coTheHuy: false` dù đủ quyền — bảng không có cạnh từ đây', async () => {
      orderRepo.findFirst.mockResolvedValue(don('thicong'));
      const vongDoi = await service.lifecycle(ACTOR, QUYEN_DU, ORDER_ID);
      expect(vongDoi.coTheHuy).toBe(false);
    });
  });
});
