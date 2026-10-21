import type { Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { EventBus } from '../src/events/event-bus';
import type { AddLineItemRequestDto } from '../src/orders/dto/add-line-item-request.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import { fakeStorage } from './util/fake-storage';

/**
 * PHẠM VI của ĐƯỜNG GHI đơn — hermetic, Prisma mock.
 *
 * Đường ghi từng đọc đơn bằng `findOrThrow(id)` trần: người chỉ có `orders.view_own` KHÔNG xem
 * được đơn người khác nhưng SỬA/CHỐT/áp chiết khấu được nếu biết id. Không xem được thì cũng
 * không sửa được — lần đọc đầu của mọi đường ghi do người gọi kích hoạt phải là
 * `findScopedOrThrow`, với CÙNG mệnh đề như đường đọc chi tiết.
 *
 * Mỗi ca dưới đây cho `findFirst` trả `null` (ngoài phạm vi, nhìn từ DB) rồi khẳng định ba
 * điều: mệnh đề phạm vi ĐÃ được gửi xuống, lỗi là 404 cùng thông điệp với "không tồn tại", và
 * KHÔNG có gì chạm tới tx/khoá/event — 404 phải đứng TRƯỚC mọi ghi.
 */
describe('OrdersService — đường GHI đơn thu hẹp theo phạm vi quyền', () => {
  const CALLER = 'acc-caller';
  const ORDER_ID = 'order-1';

  function dungService() {
    const batDuoc: {
      findFirst: Prisma.OrderFindFirstArgs[];
      findUniqueGoi: number;
    } = { findFirst: [], findUniqueGoi: 0 };
    const transaction = jest.fn();
    const queryRaw = jest.fn();
    const publish = jest.fn();
    const prisma = {
      order: {
        findFirst: (args: Prisma.OrderFindFirstArgs) => {
          batDuoc.findFirst.push(args);
          return null;
        },
        findUnique: () => {
          batDuoc.findUniqueGoi += 1;
          return null;
        },
      },
      $transaction: transaction,
      $queryRaw: queryRaw,
    } as unknown as PrismaService;
    const service = new OrdersService(
      prisma,
      { publish, subscribe: jest.fn() } as unknown as EventBus,
      fakeStorage(),
      {} as unknown as StockVouchersService,
      {} as unknown as StockItemsService,
    );
    return { service, batDuoc, transaction, queryRaw, publish };
  }

  type Goi = (s: OrdersService, quyen: ReadonlySet<string>) => Promise<unknown>;

  const DUONG_GHI: readonly [string, Goi][] = [
    [
      'update',
      (s, q) =>
        s.update(CALLER, ORDER_ID, { scopeConstruction: true }, false, q),
    ],
    ['confirm', (s, q) => s.confirm(CALLER, ORDER_ID, 8, false, q)],
    ['revise', (s, q) => s.revise(CALLER, ORDER_ID, false, q)],
    [
      'applyDiscount',
      (s, q) => s.applyDiscount(CALLER, ORDER_ID, 1_000, null, false, q),
    ],
    [
      'resolveDiscount',
      (s, q) => s.resolveDiscount(CALLER, ORDER_ID, true, null, false, q),
    ],
    [
      'addLine',
      (s, q) =>
        s.addLine(
          CALLER,
          ORDER_ID,
          { productId: 'p-1', qty: 1 } as AddLineItemRequestDto,
          false,
          q,
        ),
    ],
    [
      'updateLine',
      (s, q) => s.updateLine(CALLER, ORDER_ID, 'line-1', { qty: 2 }, false, q),
    ],
    ['removeLine', (s, q) => s.removeLine(CALLER, ORDER_ID, 'line-1', q)],
  ];

  it('bảng đường ghi đủ 8 method (chống bảng rỗng ⇒ describe.each xanh giả)', () => {
    expect(DUONG_GHI.map(([ten]) => ten)).toEqual([
      'update',
      'confirm',
      'revise',
      'applyDiscount',
      'resolveDiscount',
      'addLine',
      'updateLine',
      'removeLine',
    ]);
  });

  describe.each(DUONG_GHI)('%s', (_ten, goi) => {
    it('chỉ view_own ⇒ lần đọc đầu gửi {id} VÀ OR(owner, assignee) của chính người gọi', async () => {
      const { service, batDuoc } = dungService();
      await goi(service, new Set([PERM.ordersViewOwn])).catch(() => undefined);

      expect(batDuoc.findUniqueGoi).toBe(0);
      expect(batDuoc.findFirst).toHaveLength(1);
      expect(batDuoc.findFirst[0].where).toEqual({
        AND: [
          { id: ORDER_ID },
          { OR: [{ ownerAccountId: CALLER }, { assigneeAccountId: CALLER }] },
        ],
      });
    });

    it('view_all ⇒ CHỈ {id}, không mệnh đề phạm vi', async () => {
      const { service, batDuoc } = dungService();
      await goi(service, new Set([PERM.ordersViewAll])).catch(() => undefined);

      expect(batDuoc.findFirst[0].where).toEqual({ AND: [{ id: ORDER_ID }] });
    });

    it('ngoài phạm vi ⇒ 404 NOT_FOUND cùng thông điệp "không tồn tại", KHÔNG tx/khoá/event', async () => {
      const { service, transaction, queryRaw, publish } = dungService();
      const loi = goi(service, new Set([PERM.ordersViewOwn]));

      await expect(loi).rejects.toBeInstanceOf(AppException);
      await expect(loi).rejects.toMatchObject({
        errorCode: ErrorCode.NOT_FOUND,
        status: 404,
        message: `Không tìm thấy đơn hàng: ${ORDER_ID}`,
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(queryRaw).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });
  });
});
