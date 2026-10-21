import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { EventBus } from '../src/events/event-bus';
import { OrdersService } from '../src/orders/orders.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho Story 4.7 — những sự thật mà mock KHÔNG
 * chứng minh được:
 *
 *  1. Migration `add_discount_approvals` áp được: bảng `discount_approvals` +
 *     cột `order_versions.discount_amount` tồn tại và interactive tx của
 *     `applyDiscount` (cổng status + create approval) hoàn tất trên DB thật.
 *  2. Cổng atomic THẬT: hai `applyDiscount` đua nhau ⇒ đúng MỘT approval sinh
 *     ra (READ COMMITTED re-check WHERE sau row lock); hai `resolveDiscount`
 *     cùng decision đua nhau ⇒ đúng MỘT lần resolve (không double-event path).
 *  3. FK `discount_approvals.order_id` là ràng buộc thật — row trỏ đơn ma bị
 *     Postgres chặn ngay lúc INSERT (P2003 — Prisma 7 chỉ tag code ở INSERT).
 *  4. Chốt-từ-choduyet ghi `discountAmount` lên version THẬT; đường baogia
 *     giữ null.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy:
 * `npm run test:db`. Phạm vi: CHỈ ràng buộc do story này thêm.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB: vắng DATABASE_URL (npm test vẫn hermetic). Chạy: npm run test:db',
  );
}

moTa('Ràng buộc tầng DB của duyệt chiết khấu (Postgres THẬT)', () => {
  let prisma: PrismaClient;
  let service: OrdersService;

  /** Bộ quyền đầy đủ — lane này kiểm ràng buộc DB, không kiểm phân quyền. */
  const TOAN_QUYEN: ReadonlySet<string> = new Set(Object.values(PERM));

  // Dữ liệu riêng của test — dọn trước và sau mỗi lần chạy.
  const SDT = '+84900000047';
  const ACTOR = 'acc-discount-db-47';
  const APPROVER = 'acc-discount-db-47b';
  const SKU = 'TEST-DIS-47';

  let sourceFacebookId: string;
  let accountId: string;
  let approverId: string;
  let productId: string;

  async function donDep(): Promise<void> {
    // Thứ tự xuôi theo FK: approval → line → gỡ pointer → version → order →
    // customer → product → account.
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.discountApproval.deleteMany({
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
    await prisma.stockItem.deleteMany({ where: { product: { sku: SKU } } });
    await prisma.product.deleteMany({ where: { sku: SKU } });
    await prisma.account.deleteMany({
      where: { id: { in: [ACTOR, APPROVER] } },
    });
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
      new StockVouchersService(
        prisma as unknown as PrismaService,
        { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
      ),
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
          email: 'discount-db-47@test.local',
          passwordHash: 'x',
          displayName: 'Test discount 4.7',
        },
      })
    ).id;
    approverId = (
      await prisma.account.create({
        data: {
          id: APPROVER,
          email: 'discount-db-47b@test.local',
          passwordHash: 'x',
          displayName: 'Test approver 4.7',
        },
      })
    ).id;

    productId = (
      await prisma.product.create({
        data: {
          name: 'Sản phẩm test discount 4.7',
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
      await prisma.stockMovement.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.discountApproval.deleteMany({
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
        name: 'Khách test discount 4.7',
        sourceId: sourceFacebookId,
      },
    });
  });

  /** Đơn baogia có 1 dòng catalog (subtotal 300_000) — điểm xuất phát của mọi test. */
  async function taoDonCoDong(): Promise<string> {
    const view = await service.create(accountId, { customerPhone: SDT });
    await service.addLine(
      accountId,
      view.id,
      { productId, qty: 3 },
      false,
      TOAN_QUYEN,
    );
    return view.id;
  }

  describe('AC-1 — áp chiết khấu: interactive tx thật (cổng status + approval row)', () => {
    it('applyDiscount tạo approval cho_duyet gắn đúng bản hiệu lực; đơn sang choduyet trên DB thật', async () => {
      const orderId = await taoDonCoDong();

      const view = await service.applyDiscount(
        accountId,
        orderId,
        50_000,
        'Khách quen',
        false,
        TOAN_QUYEN,
      );

      expect(view.status).toBe('choduyet');
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe('choduyet');
      const approvals = await prisma.discountApproval.findMany({
        where: { orderId },
      });
      expect(approvals).toHaveLength(1);
      expect(approvals[0].status).toBe('cho_duyet');
      expect(approvals[0].amount).toBe(50_000);
      expect(approvals[0].orderVersionId).toBe(order.currentVersionId);
      expect(approvals[0].requestedByAccountId).toBe(accountId);
    });

    it('hai applyDiscount ĐUA NHAU ⇒ đúng MỘT approval sinh ra (cổng atomic thật, không phải lời hứa của mock)', async () => {
      const orderId = await taoDonCoDong();

      const ketQua = await Promise.allSettled([
        service.applyDiscount(
          accountId,
          orderId,
          10_000,
          null,
          false,
          TOAN_QUYEN,
        ),
        service.applyDiscount(
          accountId,
          orderId,
          20_000,
          null,
          false,
          TOAN_QUYEN,
        ),
      ]);

      const thang = ketQua.filter((r) => r.status === 'fulfilled');
      const thua = ketQua.filter((r) => r.status === 'rejected');
      expect(thang).toHaveLength(1);
      expect(thua).toHaveLength(1);
      // Bên thua rollback TOÀN tx — không approval mồ côi nào nằm lại.
      const approvals = await prisma.discountApproval.findMany({
        where: { orderId },
      });
      expect(approvals).toHaveLength(1);
    });
  });

  describe('AC-2 — duyệt: cổng atomic trên CHÍNH row approval', () => {
    it('hai resolveDiscount CÙNG decision đua nhau ⇒ cả hai 200 nhưng row chỉ resolve MỘT lần (resolvedBy không bị đè)', async () => {
      const orderId = await taoDonCoDong();
      await service.applyDiscount(
        accountId,
        orderId,
        50_000,
        null,
        false,
        TOAN_QUYEN,
      );

      const ketQua = await Promise.allSettled([
        service.resolveDiscount(
          approverId,
          orderId,
          true,
          null,
          false,
          TOAN_QUYEN,
        ),
        service.resolveDiscount(
          approverId,
          orderId,
          true,
          null,
          false,
          TOAN_QUYEN,
        ),
      ]);

      // Cùng decision: bên thua cổng đọc lại thấy dong_y ⇒ idempotent-return.
      expect(ketQua.every((r) => r.status === 'fulfilled')).toBe(true);
      const approval = await prisma.discountApproval.findFirstOrThrow({
        where: { orderId },
      });
      expect(approval.status).toBe('dong_y');
      expect(approval.resolvedByAccountId).toBe(approverId);
      // Đồng ý KHÔNG đổi status đơn.
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe('choduyet');
    });

    it('từ chối trả đơn về baogia trong CÙNG tx với resolve row', async () => {
      const orderId = await taoDonCoDong();
      await service.applyDiscount(
        accountId,
        orderId,
        50_000,
        null,
        false,
        TOAN_QUYEN,
      );

      await service.resolveDiscount(
        approverId,
        orderId,
        false,
        'Biên quá mỏng',
        false,
        TOAN_QUYEN,
      );

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(order.status).toBe('baogia');
      const approval = await prisma.discountApproval.findFirstOrThrow({
        where: { orderId },
      });
      expect(approval.status).toBe('tu_choi');
      expect(approval.resolveNote).toBe('Biên quá mỏng');
    });
  });

  describe('AC-3 — chốt sau duyệt: snapshot discountAmount lên version thật', () => {
    it('confirm từ choduyet (approval dong_y) ghi discount_amount; đường baogia giữ null', async () => {
      // Đường có chiết khấu.
      const coCk = await taoDonCoDong();
      await service.applyDiscount(
        accountId,
        coCk,
        50_000,
        null,
        false,
        TOAN_QUYEN,
      );
      await service.resolveDiscount(
        approverId,
        coCk,
        true,
        null,
        false,
        TOAN_QUYEN,
      );
      const chot = await service.confirm(accountId, coCk, 8, false, TOAN_QUYEN);
      expect(chot.status).toBe('dachot');
      const verCoCk = await prisma.orderVersion.findUniqueOrThrow({
        where: { id: chot.currentVersionId as string },
      });
      expect(verCoCk.discountAmount).toBe(50_000);

      // Đường baogia thẳng (regression 4.5): discountAmount null tường minh.
      const khongCk = await taoDonCoDong();
      const chotThang = await service.confirm(
        accountId,
        khongCk,
        8,
        false,
        TOAN_QUYEN,
      );
      const verKhongCk = await prisma.orderVersion.findUniqueOrThrow({
        where: { id: chotThang.currentVersionId as string },
      });
      expect(verKhongCk.discountAmount).toBeNull();
    });
  });

  describe('FK — discount_approvals là ràng buộc thật', () => {
    it('INSERT approval trỏ đơn MA ⇒ Postgres ném P2003 (FK violation lúc INSERT)', async () => {
      const orderId = await taoDonCoDong();
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      await expect(
        prisma.discountApproval.create({
          data: {
            orderId: 'ord-khong-ton-tai',
            orderVersionId: order.currentVersionId as string,
            amount: 1,
            status: 'cho_duyet',
            requestedByAccountId: accountId,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
  });
});
