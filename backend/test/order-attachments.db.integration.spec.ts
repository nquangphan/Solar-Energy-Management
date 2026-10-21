import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventBus } from '../src/events/event-bus';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage, type FakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho ảnh bổ sung (Story 5.6) — những sự thật mà mock
 * KHÔNG chứng minh được.
 *
 * `order-attachments.spec.ts` khẳng định service GỬI đúng payload cho một Prisma giả. Ba câu
 * hỏi thật thì khác:
 *
 *  1. **Danh sách có thật sự trộn được hai loại ảnh không.** Ảnh của 5.5 mang ba cột toạ độ
 *     CÓ giá trị, ảnh của 5.6 mang `null`. Với mock, "một mảng hai phần tử" là thứ test tự
 *     đặt vào. Trên DB thật, `orderBy: createdAt desc` phải xếp đúng hai hàng có hình dạng
 *     KHÁC NHAU — và cột `occurredAt` null của ảnh bổ sung phải không làm hỏng thứ tự.
 *  2. **`nguoiTaiLen` có join được không.** `include: { uploadedBy: … }` là một JOIN thật;
 *     mock trả về đúng cái test nhét vào và sẽ khớp mãi mãi, kể cả khi quan hệ đã đứt.
 *  3. **Xoá có ĐỂ LẠI vết audit không.** Hard delete xoá hàng `attachments`; FR-24 đòi vết
 *     phải còn. Chỉ bus THẬT → `AuditService` THẬT mới chứng minh đường AD-18 còn thông —
 *     một hàng audit do test tự chèn khớp mọi lúc, kể cả khi publish đã hỏng.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB ảnh bổ sung: vắng DATABASE_URL. Chạy: npm run test:db',
  );
}

moTa('Ảnh bổ sung của đơn trên Postgres THẬT', () => {
  let prisma: PrismaClient;
  let service: OrdersService;
  let storage: FakeStorage;

  const SDT = '+84900000566';
  const TOI = 'acc-anh-566-toi';
  const NGUOI_KHAC = 'acc-anh-566-khac';

  let sourceId: string;

  /** Quyền đủ cho lane thủ công (để dựng ảnh 5.5) + xem mọi đơn. */
  const QUYEN_DU = new Set<string>([
    PERM.ordersViewAll,
    PERM.constructionTransition,
    PERM.deliveryConfirm,
    PERM.paymentsRecord,
  ]);

  function anh(ten: string, mime = 'image/jpeg') {
    return {
      originalname: ten,
      mimetype: mime,
      size: 2048,
      buffer: Buffer.from(`bytes-${ten}`),
    };
  }

  async function donDep(): Promise<void> {
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      await prisma.attachment.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { targetId: { in: orderIds } },
      });
      await prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { currentVersionId: null },
      });
      const versions = await prisma.orderVersion.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
      });
      await prisma.orderLineItem.deleteMany({
        where: { orderVersionId: { in: versions.map((v) => v.id) } },
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

  /** Đơn ở `dacoc`, cả ba cờ bật ⇒ lane thủ công mở để dựng được ảnh theo bước. */
  async function taoDon(): Promise<string> {
    const order = await prisma.order.create({
      data: {
        status: 'dacoc',
        customerSdt: SDT,
        ownerAccountId: TOI,
        assigneeAccountId: null,
        sourceId,
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: true,
        scopeVanChuyen: true,
      },
    });
    return order.id;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    storage = fakeStorage();

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
      storage,
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
          email: 'anh-566-toi@test.local',
          passwordHash: 'x',
          displayName: 'Tôi 5.6',
        },
        {
          id: NGUOI_KHAC,
          email: 'anh-566-khac@test.local',
          passwordHash: 'x',
          displayName: 'Người khác 5.6',
        },
      ],
    });
    await prisma.customer.create({
      data: {
        sdt: SDT,
        custType: 'CA_NHAN',
        name: 'Khách test ảnh bổ sung 5.6',
        sourceId,
      },
    });
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  it('round-trip: ảnh theo bước (5.5) + ảnh bổ sung (5.6) về CÙNG một danh sách, đúng thứ tự', async () => {
    const orderId = await taoDon();

    // Ảnh của 5.5: ba cột toạ độ CÓ giá trị, do người khác tải lên.
    await service.chuyenTrangThaiThuCong({
      callerAccountId: NGUOI_KHAC,
      quyen: QUYEN_DU,
      orderId,
      event: SU_KIEN.batDauThiCong,
      anh: [anh('nghiem-thu.jpg')],
    });

    // Ảnh của 5.6: ba cột toạ độ null, do tôi tải lên — và MỚI HƠN.
    const them = await service.themAnh({
      callerAccountId: TOI,
      quyen: QUYEN_DU,
      orderId,
      anh: [anh('bien-ban.png', 'image/png'), anh('hien-truong.jpg')],
    });
    expect(them.soAnhDaLuu).toBe(2);

    const items = await service.danhSachAnh(TOI, QUYEN_DU, orderId);

    expect(items).toHaveLength(3);
    // Mới nhất trước — hai ảnh bổ sung đứng trên ảnh theo bước dù `occurredAt`
    // của chúng là null.
    expect(items[2].fileName).toBe('nghiem-thu.jpg');
    expect(items[2].statusFrom).toBe('dacoc');
    expect(items[2].statusTo).toBe('thicong');
    expect(items[0].statusFrom).toBeNull();
    expect(items[0].statusTo).toBeNull();

    // JOIN thật sang Account.
    expect(items[2].nguoiTaiLen).toBe('Người khác 5.6');
    expect(items[0].nguoiTaiLen).toBe('Tôi 5.6');

    // Luật xoá tính trên dữ liệu thật: tôi xoá được ảnh của tôi, không xoá được
    // ảnh người khác (tôi không có quotesCreateEdit).
    expect(items[0].coTheXoa).toBe(true);
    expect(items[2].coTheXoa).toBe(false);
  });

  it('xoá thật: hàng biến mất khỏi attachments, ĐÚNG MỘT hàng audit AttachmentRemoved ở lại', async () => {
    const orderId = await taoDon();
    const them = await service.themAnh({
      callerAccountId: TOI,
      quyen: QUYEN_DU,
      orderId,
      anh: [anh('se-bi-xoa.jpg')],
    });
    const attachmentId = them.attachmentIds[0];

    await service.xoaAnh(TOI, QUYEN_DU, orderId, attachmentId);

    const conLai = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    expect(conLai).toBeNull();

    // Hard delete xoá hàng; FR-24 đòi vết. Vết nằm ở audit_logs, và nó đến đây
    // qua đúng đường AD-18 (publish → subscriber ghi), không do test tự chèn.
    const audit = await prisma.auditLog.findMany({
      where: { targetId: orderId, eventType: 'AttachmentRemoved' },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorAccountId).toBe(TOI);

    // Thêm cũng để lại vết của chính nó.
    const auditThem = await prisma.auditLog.findMany({
      where: { targetId: orderId, eventType: 'AttachmentAdded' },
    });
    expect(auditThem).toHaveLength(1);
  });
});
