import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { EventBus } from '../src/events/event-bus';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho Story 4.8 — những sự thật mà mock KHÔNG
 * chứng minh được:
 *
 *  1. Migration `add_quote_exports` áp được: bảng `quote_exports` tồn tại với đủ cột.
 *  2. UNIQUE `order_id` là ràng buộc thật: upsert 2 lần = MỘT row (nhánh update);
 *     INSERT trần lần 2 cùng orderId bị Postgres chặn (P2002).
 *  3. FK `quote_exports.order_id` là ràng buộc thật — row trỏ đơn ma bị chặn
 *     ngay lúc INSERT (P2003 — Prisma 7 chỉ tag code ở INSERT).
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy:
 * `npm run test:db`. Phạm vi: CHỈ ràng buộc do story này thêm.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

/** Bộ quyền xem-hết — các ca ở đây không về phạm vi, chỉ cần qua cửa `findScopedOrThrow`. */
const XEM_TAT_CA: ReadonlySet<string> = new Set([PERM.ordersViewAll]);

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB: vắng DATABASE_URL (npm test vẫn hermetic). Chạy: npm run test:db',
  );
}

moTa('Ràng buộc tầng DB của hồ sơ xuất báo giá (Postgres THẬT)', () => {
  let prisma: PrismaClient;
  let service: OrdersService;

  const SDT = '+84900000048';
  const ACTOR = 'acc-quote-export-db-48';
  const SKU = 'TEST-QE-48';

  let sourceFacebookId: string;
  let accountId: string;
  let productId: string;

  async function donDep(): Promise<void> {
    // Thứ tự xuôi theo FK: quote_exports → line → gỡ pointer → version → order →
    // customer → product → account.
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      await prisma.quoteExport.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.orderLineItem.deleteMany({
        where: { orderVersion: { orderId: { in: orderIds } } },
      });
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
    await prisma.product.deleteMany({ where: { sku: SKU } });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
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
      {} as unknown as StockItemsService,
    );

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('Chưa seed CustomerSource — chạy `npx prisma db seed`.');
    }
    sourceFacebookId = facebook.id;

    await donDep();

    accountId = (
      await prisma.account.create({
        data: {
          id: ACTOR,
          email: 'quote-export-db-48@test.local',
          passwordHash: 'x',
          displayName: 'Test quote export 4.8',
        },
      })
    ).id;

    productId = (
      await prisma.product.create({
        data: {
          name: 'Sản phẩm test quote export 4.8',
          sku: SKU,
          unit: 'cái',
          price: 100_000,
          costPrice: 80_000,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      await prisma.quoteExport.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.orderLineItem.deleteMany({
        where: { orderVersion: { orderId: { in: orderIds } } },
      });
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
    await prisma.customer.create({
      data: {
        sdt: SDT,
        custType: 'CA_NHAN',
        name: 'Khách test quote export 4.8',
        sourceId: sourceFacebookId,
      },
    });
  });

  /** Đơn baogia có 1 dòng catalog — điểm xuất phát; trả về order + versionId thật. */
  async function taoDonCoDong(): Promise<{
    orderId: string;
    versionId: string;
  }> {
    const view = await service.create(accountId, { customerPhone: SDT });
    await service.addLine(
      accountId,
      view.id,
      { productId, qty: 3 },
      false,
      XEM_TAT_CA,
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: view.id },
    });
    return {
      orderId: order.id,
      versionId: order.currentVersionId as string,
    };
  }

  function duLieuExport(orderId: string, versionId: string) {
    return {
      orderId,
      orderVersionId: versionId,
      imageKey: `quotes/${orderId}/bao-gia.png`,
      pdfKey: `quotes/${orderId}/bao-gia.pdf`,
      imageSize: 111,
      pdfSize: 222,
      fileName: `bao-gia-${orderId.slice(0, 8)}`,
      createdByAccountId: accountId,
    };
  }

  it('unique order_id THẬT: upsert 2 lần = MỘT row (nhánh update giữ id, đè metadata)', async () => {
    const { orderId, versionId } = await taoDonCoDong();
    const data = duLieuExport(orderId, versionId);

    const lan1 = await prisma.quoteExport.upsert({
      where: { orderId },
      create: data,
      update: {},
    });
    const lan2 = await prisma.quoteExport.upsert({
      where: { orderId },
      create: data,
      update: { imageSize: 999, pdfSize: 888 },
    });

    const rows = await prisma.quoteExport.findMany({ where: { orderId } });
    expect(rows).toHaveLength(1);
    expect(lan2.id).toBe(lan1.id);
    expect(rows[0].imageSize).toBe(999);
    expect(rows[0].pdfSize).toBe(888);
  });

  it('INSERT trần lần 2 cùng orderId ⇒ Postgres chặn unique (P2002)', async () => {
    const { orderId, versionId } = await taoDonCoDong();
    await prisma.quoteExport.create({
      data: duLieuExport(orderId, versionId),
    });

    await expect(
      prisma.quoteExport.create({ data: duLieuExport(orderId, versionId) }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('INSERT trỏ đơn MA ⇒ Postgres ném P2003 (FK violation lúc INSERT)', async () => {
    const { versionId } = await taoDonCoDong();

    await expect(
      prisma.quoteExport.create({
        data: {
          ...duLieuExport('ord-khong-ton-tai', versionId),
          orderId: 'ord-khong-ton-tai',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
