import type { Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { EventBus } from '../src/events/event-bus';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_DA_CHOT,
} from '../src/orders/domain/order-status';
import { ListOrdersQueryDto } from '../src/orders/dto/list-orders-query.dto';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import { fakeStorage } from './util/fake-storage';

/**
 * HÌNH DẠNG `where` mà `OrdersService.list` dựng ra — hermetic, Prisma mock.
 *
 * Test này canh đúng MỘT bẫy: mệnh đề phạm vi quyền phải nằm trong `where.AND`, KHÔNG được
 * gán vào `where.OR`. `where.OR` chỉ có đúng một chỗ, nên bộ lọc thứ hai nào cũng dùng `OR`
 * sẽ GHI ĐÈ phạm vi và làm rò đơn của người khác — người dùng chỉ có `view_own` bỗng đọc
 * được toàn bộ sổ đơn, và không có triệu chứng nào ngoài "danh sách hơi dài".
 */
describe('OrdersService.list — phạm vi theo quyền nằm trong where.AND', () => {
  const CALLER = 'acc-caller';

  /** Bắt lại đối số `findMany`/`count` mà service đưa xuống Prisma. */
  function dungService() {
    const batDuoc: { findMany?: Prisma.OrderFindManyArgs; count?: unknown } =
      {};
    const prisma = {
      order: {
        findMany: (args: Prisma.OrderFindManyArgs) => {
          batDuoc.findMany = args;
          return { __op: 'findMany' };
        },
        count: (args: unknown) => {
          batDuoc.count = args;
          return { __op: 'count' };
        },
      },
      // `$transaction` nhận MẢNG promise-like đã dựng sẵn — trả về kết quả rỗng là đủ, test
      // này chỉ quan tâm tới `where`.
      $transaction: async (ops: readonly unknown[]) => {
        expect(ops).toHaveLength(2);
        return [[], 0];
      },
    } as unknown as PrismaService;

    const service = new OrdersService(
      prisma,
      {} as unknown as EventBus,
      fakeStorage(),
      {} as unknown as StockVouchersService,
      {} as unknown as StockItemsService,
    );
    return { service, batDuoc };
  }

  async function whereCuaQuery(
    quyen: readonly string[],
    query: Partial<ListOrdersQueryDto> = {},
  ): Promise<Prisma.OrderWhereInput> {
    const { service, batDuoc } = dungService();
    await service.list(CALLER, new Set(quyen), query as ListOrdersQueryDto);
    return batDuoc.findMany?.where ?? {};
  }

  it('chỉ view_own ⇒ where.AND chứa OR(owner, assignee) của CHÍNH người gọi', async () => {
    const where = await whereCuaQuery([PERM.ordersViewOwn]);
    expect(where.AND).toEqual([
      {
        OR: [{ ownerAccountId: CALLER }, { assigneeAccountId: CALLER }],
      },
    ]);
  });

  it('view_all ⇒ KHÔNG có mệnh đề phạm vi nào (thấy toàn bộ đơn)', async () => {
    const where = await whereCuaQuery([PERM.ordersViewAll]);
    expect(where.AND).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it('view_all + view_own ⇒ view_all THẮNG, vẫn không thu hẹp phạm vi', async () => {
    const where = await whereCuaQuery([PERM.ordersViewAll, PERM.ordersViewOwn]);
    expect(where.AND).toBeUndefined();
  });

  it('view_own + status ⇒ CẢ HAI nằm trong where.AND, và where.OR là undefined', async () => {
    const where = await whereCuaQuery([PERM.ordersViewOwn], {
      status: TRANG_THAI_DA_CHOT,
    });
    // Đây là khẳng định trung tâm: bộ lọc thứ hai KHÔNG được đẩy phạm vi ra khỏi `AND`,
    // và KHÔNG được chiếm chỗ `where.OR`.
    expect(where.OR).toBeUndefined();
    expect(where.AND).toEqual([
      { OR: [{ ownerAccountId: CALLER }, { assigneeAccountId: CALLER }] },
      { status: TRANG_THAI_DA_CHOT },
    ]);
  });

  it('followUp=true ⇒ lọc đúng trạng thái baogia (follow-up là bộ lọc DẪN XUẤT)', async () => {
    const where = await whereCuaQuery([PERM.ordersViewAll], { followUp: true });
    expect(where.AND).toEqual([{ status: TRANG_THAI_BAO_GIA }]);
  });

  it('followUp=false ⇒ KHÔNG thêm mệnh đề trạng thái nào', async () => {
    const where = await whereCuaQuery([PERM.ordersViewAll], {
      followUp: false,
    });
    expect(where.AND).toBeUndefined();
  });

  it('followUp=false + status ⇒ 200 và LỌC theo status — chỉ followUp=true mới mâu thuẫn', async () => {
    // Chỉ `followUp === true` là bộ lọc trạng thái. `followUp=false` là "không bật follow-up",
    // tức KHÔNG mâu thuẫn với `status` — nới điều kiện xung đột thành `!== undefined` sẽ
    // biến một truy vấn hợp lệ (UI gửi cả hai field, follow-up đang tắt) thành 400.
    const where = await whereCuaQuery([PERM.ordersViewAll], {
      followUp: false,
      status: TRANG_THAI_DA_CHOT,
    });
    expect(where.AND).toEqual([{ status: TRANG_THAI_DA_CHOT }]);
  });

  it('followUp + status cùng gửi ⇒ 400 VALIDATION_ERROR, KHÔNG im lặng trả tập rỗng', async () => {
    const { service } = dungService();
    const loi = await service
      .list(CALLER, new Set([PERM.ordersViewAll]), {
        followUp: true,
        status: TRANG_THAI_DA_CHOT,
      } as ListOrdersQueryDto)
      .catch((e: unknown) => e);
    expect(loi).toBeInstanceOf(AppException);
    expect((loi as AppException).errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    expect((loi as AppException).getStatus()).toBe(400);
  });

  it('phân trang: skip/take suy từ page/pageSize, mới nhất trước', async () => {
    const { service, batDuoc } = dungService();
    await service.list(CALLER, new Set([PERM.ordersViewAll]), {
      page: 3,
      pageSize: 20,
    } as ListOrdersQueryDto);
    expect(batDuoc.findMany?.skip).toBe(40);
    expect(batDuoc.findMany?.take).toBe(20);
    expect(batDuoc.findMany?.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('count đọc CÙNG `where` với findMany (total không lệch khỏi tập đã lọc + đã scope)', async () => {
    const { service, batDuoc } = dungService();
    await service.list(CALLER, new Set([PERM.ordersViewOwn]), {
      status: TRANG_THAI_DA_CHOT,
    } as ListOrdersQueryDto);
    expect(batDuoc.count).toEqual({ where: batDuoc.findMany?.where });
  });
});
