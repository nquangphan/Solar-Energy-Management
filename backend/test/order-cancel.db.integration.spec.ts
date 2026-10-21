import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import type { AppException } from '../src/common/errors/app.exception';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventBus } from '../src/events/event-bus';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho HUỶ ĐƠN KÈM LÝ DO (Story 5.7) — những sự thật mà mock
 * KHÔNG chứng minh được.
 *
 * `order-cancel.spec.ts` khẳng định service GỬI đúng payload cho một Prisma giả. Hai câu hỏi
 * còn lại chỉ Postgres trả lời được:
 *  1. Hai cột `cancel_reason`/`cancelled_at` có THẬT trong bảng không — migration sinh
 *     OFFLINE (`migrate diff --script`, không có Postgres cục bộ) nên chưa ai chạy nó.
 *  2. Lệnh đổi status và lệnh ghi hai cột có THẬT SỰ cùng một transaction không — mock
 *     `$transaction` chỉ gọi callback, nó không rollback được gì.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa('Huỷ đơn kèm lý do trên Postgres THẬT', () => {
  let prisma: PrismaClient;
  let service: OrdersService;

  const SDT = '+84900000577';
  const TOI = 'acc-cancel-577-toi';
  const NGUOI_KHAC = 'acc-cancel-577-khac';
  const LY_DO = 'Khách đổi ý, không lắp nữa';

  let sourceId: string;

  const QUYEN_DU = new Set<string>([PERM.ordersViewAll, PERM.quotesCreateEdit]);
  const CHI_XEM_CUA_MINH = new Set<string>([
    PERM.ordersViewOwn,
    PERM.quotesCreateEdit,
  ]);

  async function donDep(): Promise<void> {
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { targetId: { in: orderIds } },
      });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    await prisma.customer.deleteMany({ where: { sdt: SDT } });
    await prisma.account.deleteMany({
      where: { id: { in: [TOI, NGUOI_KHAC] } },
    });
  }

  async function taoDon(
    status: string,
    ownerAccountId: string = TOI,
  ): Promise<string> {
    const order = await prisma.order.create({
      data: {
        status,
        customerSdt: SDT,
        ownerAccountId,
        assigneeAccountId: null,
        sourceId,
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: false,
        scopeVanChuyen: false,
      },
    });
    return order.id;
  }

  async function bat(promise: Promise<unknown>): Promise<AppException> {
    try {
      await promise;
    } catch (err: unknown) {
      return err as AppException;
    }
    throw new Error('Kỳ vọng ném AppException nhưng không có lỗi nào.');
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();

    // Bus THẬT → AuditService THẬT: hàng audit đẻ ra bằng đúng đường AD-18.
    const auditService = new AuditService(prisma as unknown as PrismaService);
    const eventBus = {
      publish: async (event: DomainEvent) => {
        await auditService.record(event);
      },
      subscribe: () => {},
    } as unknown as EventBus;

    service = new OrdersService(
      prisma as unknown as PrismaService,
      eventBus,
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
          email: 'cancel-577-toi@test.local',
          passwordHash: 'x',
          displayName: 'Tôi 5.7',
        },
        {
          id: NGUOI_KHAC,
          email: 'cancel-577-khac@test.local',
          passwordHash: 'x',
          displayName: 'Người khác 5.7',
        },
      ],
    });
    await prisma.customer.create({
      data: {
        sdt: SDT,
        custType: 'CA_NHAN',
        name: 'Khách test huỷ đơn 5.7',
        sourceId,
      },
    });
  });

  afterAll(async () => {
    if (!coDb) return;
    await donDep();
    await prisma.$disconnect();
  });

  describe('hai cột mới THẬT SỰ tồn tại và ghi/đọc được (AC-8)', () => {
    it.each(['baogia', 'dachot', 'dacoc'])(
      'đơn `%s` ⇒ status `huy`, `cancel_reason`/`cancelled_at` ghi đúng',
      async (status) => {
        const donId = await taoDon(status);

        const ketQua = await service.huyDon({
          callerAccountId: TOI,
          quyen: QUYEN_DU,
          orderId: donId,
          lyDo: LY_DO,
        });

        const don = await prisma.order.findUniqueOrThrow({
          where: { id: donId },
        });
        expect(don.status).toBe('huy');
        expect(don.cancelReason).toBe(LY_DO);
        expect(don.cancelledAt?.getTime()).toBe(ketQua.occurredAt.getTime());
      },
    );

    it('đơn chưa huỷ ⇒ hai cột NULL (mặc định của migration, không phải chuỗi rỗng)', async () => {
      const donId = await taoDon('baogia');
      const don = await prisma.order.findUniqueOrThrow({ where: { id: donId } });
      expect(don.cancelReason).toBeNull();
      expect(don.cancelledAt).toBeNull();
    });
  });

  describe('MỘT transaction cho cả hai lệnh ghi (AC-8)', () => {
    it('transition bị từ chối ⇒ KHÔNG cột nào đổi (status lẫn hai cột lý do)', async () => {
      const donId = await taoDon('thicong');

      await bat(
        service.huyDon({
          callerAccountId: TOI,
          quyen: QUYEN_DU,
          orderId: donId,
          lyDo: LY_DO,
        }),
      );

      const don = await prisma.order.findUniqueOrThrow({ where: { id: donId } });
      expect(don.status).toBe('thicong');
      expect(don.cancelReason).toBeNull();
      expect(don.cancelledAt).toBeNull();
    });

    it('huỷ lần hai trên đơn ĐÃ huỷ ⇒ 409 và lý do lần đầu KHÔNG bị ghi đè', async () => {
      const donId = await taoDon('baogia');
      await service.huyDon({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        lyDo: LY_DO,
      });

      const err = await bat(
        service.huyDon({
          callerAccountId: TOI,
          quyen: QUYEN_DU,
          orderId: donId,
          lyDo: 'Lý do khác hẳn',
        }),
      );
      expect(err.getStatus()).toBe(409);

      const don = await prisma.order.findUniqueOrThrow({ where: { id: donId } });
      expect(don.cancelReason).toBe(LY_DO);
    });

    it('lý do rỗng ⇒ 400 và không cột nào đổi', async () => {
      const donId = await taoDon('baogia');

      const err = await bat(
        service.huyDon({
          callerAccountId: TOI,
          quyen: QUYEN_DU,
          orderId: donId,
          lyDo: '   ',
        }),
      );
      expect(err.getStatus()).toBe(400);

      const don = await prisma.order.findUniqueOrThrow({ where: { id: donId } });
      expect(don.status).toBe('baogia');
      expect(don.cancelReason).toBeNull();
    });
  });

  describe('phạm vi + audit qua đường THẬT', () => {
    it('đơn của người khác, actor chỉ có `view_own` ⇒ 404 và đơn không đổi', async () => {
      const donId = await taoDon('baogia', NGUOI_KHAC);

      const err = await bat(
        service.huyDon({
          callerAccountId: TOI,
          quyen: CHI_XEM_CUA_MINH,
          orderId: donId,
          lyDo: LY_DO,
        }),
      );
      expect(err.getStatus()).toBe(404);

      const don = await prisma.order.findUniqueOrThrow({ where: { id: donId } });
      expect(don.status).toBe('baogia');
    });

    it('một lần huỷ đẻ HAI hàng audit (`StatusChanged` + `OrderCancelled`) qua bus THẬT', async () => {
      const donId = await taoDon('baogia');

      const ketQua = await service.huyDon({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        lyDo: LY_DO,
      });

      const hang = await prisma.auditLog.findMany({
        where: { targetId: donId },
        orderBy: { createdAt: 'asc' },
      });
      const loai = hang.map((h) => h.eventType);
      expect(loai).toContain('StatusChanged');
      expect(loai).toContain('OrderCancelled');

      const don = await prisma.order.findUniqueOrThrow({ where: { id: donId } });
      // Cột `cancelled_at` và thời điểm của hàng audit là CÙNG một "lúc" — đây là thứ nối
      // lý do trong bảng orders về vết audit, và mock không chứng minh được nó.
      expect(don.cancelledAt?.getTime()).toBe(ketQua.occurredAt.getTime());
    });
  });
});
