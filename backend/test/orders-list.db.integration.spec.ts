import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { EventBus } from '../src/events/event-bus';
import {
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_DA_CHOT,
} from '../src/orders/domain/order-status';
import type { ListOrdersQueryDto } from '../src/orders/dto/list-orders-query.dto';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho danh sách đơn — sự thật mà mock KHÔNG chứng minh được:
 *
 * Mọi test khác của `GET /orders` khẳng định HÌNH DẠNG của `where` (`AND: [{ OR: [...] }]`)
 * trước một Prisma giả. Hình dạng đúng KHÔNG bằng kết quả đúng: mệnh đề phạm vi là một `OR`
 * LỒNG trong `AND`, và câu hỏi thật — "đơn của người khác có bị loại khỏi tập trả về không" —
 * chỉ Postgres trả lời được. Cùng lý do cho `include customer.name` (JOIN thật) và
 * `skip`/`take` + `count` trong một `$transaction` (phân trang thật trên nhiều hàng).
 *
 * Rò ở đây là rò dữ liệu khách hàng, và triệu chứng duy nhất là "danh sách hơi dài".
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa('Danh sách đơn: phạm vi theo quyền trên Postgres THẬT', () => {
  let prisma: PrismaClient;
  let service: OrdersService;

  const SDT = '+84900000053';
  const TOI = 'acc-orders-list-53-toi';
  const NGUOI_KHAC = 'acc-orders-list-53-khac';
  const TEN_KHACH = 'Khách test danh sách đơn 5.3';

  let sourceId: string;

  /** Đơn của TÔI (owner) · đơn NGƯỜI KHÁC giao cho TÔI (assignee) · đơn hoàn toàn của họ. */
  let donCuaToi: string;
  let donGiaoChoToi: string;
  let donNguoiKhac: string;

  async function donDep(): Promise<void> {
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { currentVersionId: null },
      });
      await prisma.orderVersion.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    await prisma.customer.deleteMany({ where: { sdt: SDT } });
    await prisma.account.deleteMany({
      where: { id: { in: [TOI, NGUOI_KHAC] } },
    });
  }

  /** Đơn thô: story 5.3 chỉ ĐỌC, nên không cần version/dòng — chỉ cần các cột được lọc. */
  async function taoDon(
    ownerAccountId: string,
    assigneeAccountId: string | null,
    status: string,
    createdAt: Date,
  ): Promise<string> {
    const order = await prisma.order.create({
      data: {
        status,
        customerSdt: SDT,
        ownerAccountId,
        assigneeAccountId,
        sourceId,
        custType: 'CA_NHAN',
        createdAt,
      },
    });
    return order.id;
  }

  async function goi(
    quyen: readonly string[],
    query: Partial<ListOrdersQueryDto> = {},
  ) {
    return await service.list(TOI, new Set(quyen), query as ListOrdersQueryDto);
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new OrdersService(
      prisma as unknown as PrismaService,
      { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
      fakeStorage(),
      {} as unknown as StockVouchersService,
    );

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('Chưa seed CustomerSource — chạy `npx prisma db seed`.');
    }
    sourceId = facebook.id;

    await donDep();

    await prisma.account.createMany({
      data: [
        {
          id: TOI,
          email: 'orders-list-53-toi@test.local',
          passwordHash: 'x',
          displayName: 'Tôi 5.3',
        },
        {
          id: NGUOI_KHAC,
          email: 'orders-list-53-khac@test.local',
          passwordHash: 'x',
          displayName: 'Người khác 5.3',
        },
      ],
    });
    await prisma.customer.create({
      data: {
        sdt: SDT,
        custType: 'CA_NHAN',
        name: TEN_KHACH,
        sourceId,
      },
    });

    // `createdAt` cách nhau thật để khẳng định thứ tự mới-nhất-trước trên DB, không phải
    // trên mảng do test tự sắp.
    donNguoiKhac = await taoDon(
      NGUOI_KHAC,
      NGUOI_KHAC,
      TRANG_THAI_BAO_GIA,
      new Date('2026-07-01T00:00:00.000Z'),
    );
    donGiaoChoToi = await taoDon(
      NGUOI_KHAC,
      TOI,
      TRANG_THAI_DA_CHOT,
      new Date('2026-07-02T00:00:00.000Z'),
    );
    donCuaToi = await taoDon(
      TOI,
      null,
      TRANG_THAI_BAO_GIA,
      new Date('2026-07-03T00:00:00.000Z'),
    );
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  it('chỉ view_own ⇒ Postgres LOẠI đơn của người khác, giữ đơn mình owner VÀ đơn mình assignee', async () => {
    const trang = await goi([PERM.ordersViewOwn]);
    const ids = trang.items.map((item) => item.id);

    // Đây là câu hỏi mà mock không trả lời được: `OR` lồng trong `AND` có thật sự thu hẹp
    // tập kết quả không.
    expect(ids).toContain(donCuaToi);
    expect(ids).toContain(donGiaoChoToi);
    expect(ids).not.toContain(donNguoiKhac);
    expect(trang.total).toBe(2);
  });

  it('view_all ⇒ thấy cả ba đơn, mới nhất trước', async () => {
    const trang = await goi([PERM.ordersViewAll]);
    const ids = trang.items.map((item) => item.id);

    expect(ids).toEqual([donCuaToi, donGiaoChoToi, donNguoiKhac]);
    expect(trang.total).toBe(3);
  });

  it('followUp=true + view_own ⇒ chỉ đơn baogia CỦA MÌNH (hai bộ lọc cùng hiệu lực, không cái nào ghi đè cái nào)', async () => {
    const trang = await goi([PERM.ordersViewOwn], { followUp: true });
    const ids = trang.items.map((item) => item.id);

    // Nếu mệnh đề trạng thái đè lên mệnh đề phạm vi (hoặc ngược lại), đơn baogia của NGƯỜI
    // KHÁC sẽ lọt vào đây — đúng cái bẫy `where.OR` bị chiếm chỗ.
    expect(ids).toEqual([donCuaToi]);
    expect(trang.total).toBe(1);
    expect(ids).not.toContain(donNguoiKhac);
  });

  it('đơn đã chốt KHÔNG lọt vào tập follow-up (FR-10)', async () => {
    const trang = await goi([PERM.ordersViewAll], { followUp: true });
    const ids = trang.items.map((item) => item.id);

    expect(ids).not.toContain(donGiaoChoToi);
    expect(
      trang.items.every((item) => item.status === TRANG_THAI_BAO_GIA),
    ).toBe(true);
  });

  it('`total` đếm TOÀN BỘ tập đã scope, không phải số hàng của trang (phân trang thật)', async () => {
    const trang = await goi([PERM.ordersViewOwn], { page: 1, pageSize: 1 });

    expect(trang.items).toHaveLength(1);
    expect(trang.total).toBe(2);
    expect(trang.items[0].id).toBe(donCuaToi);

    const trangSau = await goi([PERM.ordersViewOwn], { page: 2, pageSize: 1 });
    expect(trangSau.items.map((item) => item.id)).toEqual([donGiaoChoToi]);
    expect(trangSau.total).toBe(2);
  });

  it('trang vượt quá trang cuối ⇒ items rỗng nhưng total GIỮ NGUYÊN (rỗng-vì-lật-quá ≠ sổ trống)', async () => {
    const trang = await goi([PERM.ordersViewOwn], { page: 99, pageSize: 20 });

    expect(trang.items).toHaveLength(0);
    expect(trang.total).toBe(2);
  });

  it('customerName lấy qua JOIN quan hệ customerSdt → Customer.sdt (khách định danh bằng SĐT, AD-9)', async () => {
    const trang = await goi([PERM.ordersViewAll]);

    expect(trang.items.every((item) => item.customerName === TEN_KHACH)).toBe(
      true,
    );
    expect(trang.items.every((item) => item.customerSdt === SDT)).toBe(true);
  });

  it('lọc theo status chạy đúng trên cột đã đánh index', async () => {
    const trang = await goi([PERM.ordersViewAll], {
      status: TRANG_THAI_DA_CHOT,
    });

    expect(trang.items.map((item) => item.id)).toEqual([donGiaoChoToi]);
    expect(trang.total).toBe(1);
  });
});
