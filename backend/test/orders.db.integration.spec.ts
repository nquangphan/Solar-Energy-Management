import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { EventBus } from '../src/events/event-bus';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho Story 4.1 — ba sự thật mà mock KHÔNG chứng minh được:
 *
 *  1. FK VÒNG Order ↔ OrderVersion tạo được trong MỘT transaction (id sinh trước, 3 bước).
 *  2. `Order.sourceId` là SNAPSHOT: đổi `Customer.sourceId` SAU khi tạo đơn ⇒ đơn GIỮ NGUYÊN.
 *  3. FK `order_line_items.product_id` ON DELETE RESTRICT thật sự chặn xoá cứng Product.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 * Phạm vi: CHỈ ràng buộc do story này thêm.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB: vắng DATABASE_URL (npm test vẫn hermetic). Chạy: npm run test:db',
  );
}

moTa('Ràng buộc tầng DB của orders (Postgres THẬT)', () => {
  let prisma: PrismaClient;
  let service: OrdersService;

  // Dữ liệu riêng của test — dọn trước và sau mỗi lần chạy.
  const SDT = '+84900000041';
  const ACTOR = 'acc-orders-db-41';
  const SKU = 'TEST-ORD-41';

  let sourceFacebookId: string;
  let sourceZaloId: string;
  let accountId: string;
  let productId: string;

  async function donDep(): Promise<void> {
    // Thứ tự xuôi theo FK: line → gỡ pointer → version → order → customer → product → account.
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
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
    );

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    const zalo = await prisma.customerSource.findUnique({
      where: { name: 'Zalo' },
    });
    if (facebook === null || zalo === null) {
      throw new Error('Chưa seed CustomerSource — chạy `npx prisma db seed`.');
    }
    sourceFacebookId = facebook.id;
    sourceZaloId = zalo.id;

    await donDep();

    const account = await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'orders-db-41@test.local',
        passwordHash: 'x',
        displayName: 'Test orders 4.1',
      },
    });
    accountId = account.id;

    const product = await prisma.product.create({
      data: {
        name: 'Sản phẩm test orders 4.1',
        sku: SKU,
        unit: 'cái',
        price: 100_000,
        costPrice: 80_000,
      },
    });
    productId = product.id;
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
        name: 'Khách test orders 4.1',
        sourceId: sourceFacebookId,
      },
    });
  });

  describe('AC-1 — FK vòng Order ↔ OrderVersion tạo được trong MỘT transaction', () => {
    it('service.create dựng đơn + version 1 + pointer trên Postgres thật; FK hai chiều đều đúng', async () => {
      const view = await service.create(accountId, { customerSdt: SDT });

      const order = await prisma.order.findUnique({ where: { id: view.id } });
      expect(order).not.toBeNull();
      expect(order?.status).toBe('baogia');
      expect(order?.currentVersionId).not.toBeNull();

      const version = await prisma.orderVersion.findUnique({
        where: { id: order?.currentVersionId ?? '' },
      });
      expect(version?.orderId).toBe(order?.id);
      expect(version?.versionNo).toBe(1);
    });

    it('pointer trỏ version MA ⇒ Postgres ném FK violation (ràng buộc có thật, không phải lời hứa)', async () => {
      const view = await service.create(accountId, { customerSdt: SDT });

      await expect(
        prisma.order.update({
          where: { id: view.id },
          data: { currentVersionId: '99999999-8888-4777-8666-555555555555' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('AC-4 — bản chất SNAPSHOT của Order.sourceId (FR-35)', () => {
    it('đổi Customer.sourceId SAU khi tạo đơn ⇒ Order.sourceId GIỮ NGUYÊN kênh cũ', async () => {
      const view = await service.create(accountId, { customerSdt: SDT });
      expect(view.sourceId).toBe(sourceFacebookId);

      // Khách quay lại qua kênh KHÁC — hồ sơ khách đổi nguồn.
      await prisma.customer.update({
        where: { sdt: SDT },
        data: { sourceId: sourceZaloId },
      });

      // Đơn cũ vẫn giữ kênh đã mang nó về — đọc từ DB thật, không qua cache nào.
      const order = await prisma.order.findUnique({ where: { id: view.id } });
      expect(order?.sourceId).toBe(sourceFacebookId);

      // Và đơn MỚI tạo sau khi đổi phải mang kênh MỚI (snapshot theo thời điểm tạo).
      const donMoi = await service.create(accountId, { customerSdt: SDT });
      expect(donMoi.sourceId).toBe(sourceZaloId);
    });
  });

  describe('AC-5 — FK order_line_items.product_id ON DELETE RESTRICT', () => {
    it('xoá cứng Product đang có dòng đơn trỏ vào ⇒ Postgres CHẶN', async () => {
      const view = await service.create(accountId, { customerSdt: SDT });
      await service.addLine(accountId, view.id, { productId, qty: 2 }, false);

      // P2003 chỉ có ở INSERT; delete-restrict ném DriverAdapterError KHÔNG mã —
      // assert theo hành vi (reject + bản ghi còn nguyên), không theo code.
      await expect(
        prisma.product.delete({ where: { id: productId } }),
      ).rejects.toThrow();

      const conSong = await prisma.product.findUnique({
        where: { id: productId },
      });
      expect(conSong).not.toBeNull();
    });

    it('dòng catalog auto-điền giá + amount từ DB thật; UNIQUE (orderId, versionNo) enforce', async () => {
      const view = await service.create(accountId, { customerSdt: SDT });
      const line = await service.addLine(
        accountId,
        view.id,
        { productId, qty: 3 },
        false,
      );

      expect(line.unitPrice).toBe(100_000);
      expect(line.amount).toBe(300_000);

      // UNIQUE (order_id, version_no): tạo version 1 THỨ HAI cho cùng đơn phải bị chặn.
      await expect(
        prisma.orderVersion.create({
          data: { orderId: view.id, versionNo: 1 },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });
});
