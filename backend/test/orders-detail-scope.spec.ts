import type { Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { EventBus } from '../src/events/event-bus';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import { fakeStorage } from './util/fake-storage';

/**
 * HÌNH DẠNG `where` của ĐƯỜNG ĐỌC-THEO-ID — hermetic, Prisma mock.
 *
 * `GET /orders/:id` từng đọc bằng `findUnique({where:{id}})`: không actor, không quyền, không
 * phạm vi. Bất kỳ ai qua được cửa guard đọc được MỌI đơn theo id, và triệu chứng duy nhất là
 * không có triệu chứng nào. Ba endpoint của màn chi tiết phải đi CHUNG một đường đọc scoped —
 * test này canh cả ba, vì một endpoint quên scope thì lỗ mở lại y như cũ.
 *
 * Ngoài phạm vi và không tồn tại phải trả CÙNG một 404 với CÙNG thông điệp: 403 xác nhận đơn
 * có tồn tại, đó là một bit rò ra.
 */
describe('OrdersService — đọc theo id thu hẹp theo phạm vi quyền', () => {
  const CALLER = 'acc-caller';
  const ORDER_ID = 'order-1';

  const DON_MAU = {
    id: ORDER_ID,
    status: 'dachot',
    currentVersionId: null,
    scopeThietBi: true,
    scopeThiCong: true,
    scopeVanChuyen: true,
  };

  /** Bắt lại đối số `order.findFirst` mà service đưa xuống Prisma. */
  function dungService(donTraVe: unknown = DON_MAU) {
    const batDuoc: {
      findFirst?: Prisma.OrderFindFirstArgs;
      findUniqueGoi: number;
    } = { findUniqueGoi: 0 };
    const prisma = {
      order: {
        findFirst: (args: Prisma.OrderFindFirstArgs) => {
          batDuoc.findFirst = args;
          return donTraVe;
        },
        findUnique: () => {
          batDuoc.findUniqueGoi += 1;
          return donTraVe;
        },
      },
      orderVersion: { findMany: () => [] },
      orderLineItem: { findMany: () => [] },
      discountApproval: { findFirst: () => null },
    } as unknown as PrismaService;

    const service = new OrdersService(
      prisma,
      {} as unknown as EventBus,
      fakeStorage(),
      {} as unknown as StockVouchersService,
    );
    return { service, batDuoc };
  }

  /** `where` mà mỗi trong ba đường đọc dựng ra, với bộ quyền cho trước. */
  async function whereCua(
    duong: 'getScoped' | 'lifecycle' | 'listVersions',
    quyen: readonly string[],
  ): Promise<Prisma.OrderWhereInput> {
    const { service, batDuoc } = dungService();
    const bo = new Set(quyen);
    if (duong === 'getScoped') {
      await service.getScoped(CALLER, bo, ORDER_ID, false);
    } else if (duong === 'lifecycle') {
      await service.lifecycle(CALLER, bo, ORDER_ID);
    } else {
      await service.listVersions(CALLER, bo, ORDER_ID);
    }
    // Đọc-theo-id KHÔNG được đi qua `findUnique` nữa: nó không nhận nổi mệnh đề phạm vi.
    expect(batDuoc.findUniqueGoi).toBe(0);
    return batDuoc.findFirst?.where ?? {};
  }

  const DUONG_DOC = ['getScoped', 'lifecycle', 'listVersions'] as const;

  describe.each(DUONG_DOC)('%s', (duong) => {
    it('chỉ view_own ⇒ where.AND có {id} VÀ OR(owner, assignee) của chính người gọi', async () => {
      const where = await whereCua(duong, [PERM.ordersViewOwn]);
      expect(where.AND).toEqual([
        { id: ORDER_ID },
        { OR: [{ ownerAccountId: CALLER }, { assigneeAccountId: CALLER }] },
      ]);
    });

    it('view_all ⇒ where.AND CHỈ có {id}, không mệnh đề phạm vi', async () => {
      const where = await whereCua(duong, [PERM.ordersViewAll]);
      expect(where.AND).toEqual([{ id: ORDER_ID }]);
    });

    it('where.OR là undefined ở mọi ca — phạm vi gom vào AND để bộ lọc khác không chiếm chỗ', async () => {
      for (const quyen of [[PERM.ordersViewOwn], [PERM.ordersViewAll]]) {
        expect((await whereCua(duong, quyen)).OR).toBeUndefined();
      }
    });

    it('không khớp (không tồn tại HOẶC ngoài phạm vi) ⇒ NOT_FOUND 404, cùng một thông điệp', async () => {
      const { service } = dungService(null);
      const bo = new Set([PERM.ordersViewOwn]);
      const goi =
        duong === 'getScoped'
          ? service.getScoped(CALLER, bo, ORDER_ID, false)
          : duong === 'lifecycle'
            ? service.lifecycle(CALLER, bo, ORDER_ID)
            : service.listVersions(CALLER, bo, ORDER_ID);

      await expect(goi).rejects.toMatchObject({
        errorCode: ErrorCode.NOT_FOUND,
        status: 404,
        message: `Không tìm thấy đơn hàng: ${ORDER_ID}`,
      });
      await expect(goi).rejects.toBeInstanceOf(AppException);
    });
  });
});
