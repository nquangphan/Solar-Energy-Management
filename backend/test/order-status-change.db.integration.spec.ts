import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import type { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { DomainEvent } from '../src/events/domain-event';
import type { EventBus } from '../src/events/event-bus';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
import { OrdersService } from '../src/orders/orders.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage, type FakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho chuyển trạng thái THỦ CÔNG + ảnh đính kèm (Story 5.5)
 * — những sự thật mà mock KHÔNG chứng minh được.
 *
 * `order-status-change.spec.ts` khẳng định service GỬI đúng payload cho một Prisma giả: nó
 * hỏi "có truyền `occurredAt` xuống `createMany` không". Câu hỏi thật thì khác: **ảnh có
 * THẬT SỰ nối được về hàng audit của chính bước đó không**. FR-23 định nghĩa ràng buộc bằng
 * bốn toạ độ (đơn, từ→đến, thời điểm) chứ không có FK, nên "nối được" là một phép JOIN có
 * chạy hay không trên dữ liệu thật — hai cột `timestamp` bằng nhau trong một mock chỉ là hai
 * con số bằng nhau, không phải một liên kết.
 *
 * Lane này dựng bus THẬT → `AuditService` THẬT, nên hàng `audit_logs` do đúng đường AD-18 đẻ
 * ra (producer publish, subscriber ghi) chứ không do test tự chèn — một hàng audit do test
 * viết tay sẽ khớp mọi lúc, kể cả khi đường thật đã đứt.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa('Chuyển trạng thái thủ công + ảnh trên Postgres THẬT', () => {
  let prisma: PrismaClient;
  let service: OrdersService;
  let storage: FakeStorage;

  const SDT = '+84900000555';
  const TOI = 'acc-transition-555-toi';
  const NGUOI_KHAC = 'acc-transition-555-khac';

  let sourceId: string;

  /** Quyền đủ cho lane thủ công + xem mọi đơn. */
  const QUYEN_DU = new Set<string>([
    PERM.ordersViewAll,
    PERM.constructionTransition,
    PERM.deliveryConfirm,
    PERM.paymentsRecord,
  ]);
  /** Chỉ xem ĐƠN CỦA MÌNH — dùng cho ca rò bytes. */
  const CHI_XEM_CUA_MINH = new Set<string>([
    PERM.ordersViewOwn,
    PERM.constructionTransition,
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

  /** Đơn ở `dacoc`, cả ba cờ bật ⇒ cả hai nhánh thi công/giao hàng cùng mở. */
  async function taoDon(
    ownerAccountId: string,
    assigneeAccountId: string | null,
  ): Promise<string> {
    const order = await prisma.order.create({
      data: {
        status: 'dacoc',
        customerSdt: SDT,
        ownerAccountId,
        assigneeAccountId,
        sourceId,
        custType: 'CA_NHAN',
        scopeThietBi: true,
        scopeThiCong: true,
        scopeVanChuyen: true,
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
    storage = fakeStorage();

    // Bus THẬT → AuditService THẬT: hàng audit đẻ ra bằng đúng đường AD-18 mà production
    // dùng. Test tự `auditLog.create(...)` sẽ khớp mãi mãi, kể cả khi publish đã hỏng.
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
      new StockVouchersService(prisma as unknown as PrismaService, eventBus),
      {} as unknown as StockItemsService,
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
          email: 'transition-555-toi@test.local',
          passwordHash: 'x',
          displayName: 'Tôi 5.5',
        },
        {
          id: NGUOI_KHAC,
          email: 'transition-555-khac@test.local',
          passwordHash: 'x',
          displayName: 'Người khác 5.5',
        },
      ],
    });
    await prisma.customer.create({
      data: {
        sdt: SDT,
        custType: 'CA_NHAN',
        name: 'Khách test chuyển trạng thái 5.5',
        sourceId,
      },
    });
  });

  afterAll(async () => {
    if (!coDb) return;
    await donDep();
    await prisma.$disconnect();
  });

  describe('round-trip: transition + 2 ảnh (AC-1, AC-2, AC-3)', () => {
    it('đơn tới đúng đích, 2 hàng `attachments`, 1 hàng `audit_logs`, CÙNG occurred_at', async () => {
      const donId = await taoDon(TOI, null);

      const ketQua = await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.batDauThiCong,
        anh: [anh('truoc.jpg'), anh('sau.png', 'image/png')],
      });

      expect(ketQua.status).toBe('thicong');
      expect(ketQua.soAnhDaLuu).toBe(2);

      const don = await prisma.order.findUniqueOrThrow({
        where: { id: donId },
      });
      expect(don.status).toBe('thicong');

      const hangAnh = await prisma.attachment.findMany({
        where: { orderId: donId },
        orderBy: { fileName: 'asc' },
      });
      expect(hangAnh).toHaveLength(2);
      for (const hang of hangAnh) {
        expect(hang.statusFrom).toBe('dacoc');
        expect(hang.statusTo).toBe('thicong');
        expect(hang.uploadedByAccountId).toBe(TOI);
        // Bytes THẬT SỰ nằm ở storage dưới đúng key mà DB trỏ tới — một hàng DB trỏ vào hư
        // vô là một ảnh vô hình với mọi endpoint.
        expect(storage.objects.has(hang.objectKey)).toBe(true);
      }
      // Postgres round-trip `timestamp(3)` — hai hàng phải mang CÙNG một thời điểm.
      expect(hangAnh[0].occurredAt?.getTime()).toBe(
        hangAnh[1].occurredAt?.getTime(),
      );

      const audit = await prisma.auditLog.findMany({
        where: { targetId: donId, eventType: 'StatusChanged' },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0].actorAccountId).toBe(TOI);
    });

    it('KHOÁ JOIN THẬT: mỗi ảnh khớp ĐÚNG MỘT hàng audit qua (orderId, occurredAt)', async () => {
      const donId = await taoDon(TOI, null);

      // HAI lượt chuyển liên tiếp, mỗi lượt một ảnh. Đây là ca mà một khoá join hỏng mới lộ
      // ra: với một lượt duy nhất, "khớp đúng một hàng" đúng kể cả khi occurredAt là rác.
      await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.batDauThiCong,
        anh: [anh('buoc-1.jpg')],
      });
      await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.xongThiCong,
        anh: [anh('buoc-2.jpg')],
      });

      const hangAnh = await prisma.attachment.findMany({
        where: { orderId: donId },
      });
      expect(hangAnh).toHaveLength(2);

      for (const hang of hangAnh) {
        // Cột nullable có chủ đích (5.6 gắn ảnh NGOÀI luồng chuyển trạng thái để `null`);
        // ảnh sinh ra từ một bước thì KHÔNG được null, và đó là điều kiện để join chạy.
        expect(hang.occurredAt).not.toBeNull();
        const audit = await prisma.auditLog.findMany({
          where: {
            targetId: hang.orderId,
            eventType: 'StatusChanged',
            occurredAt: hang.occurredAt as Date,
          },
        });
        // ĐÚNG MỘT: đây là thứ chứng minh FR-23 "ảnh ghi vào Audit của bước", chứ không phải
        // hai cột tình cờ mang cùng con số.
        expect(audit).toHaveLength(1);
        // Và hàng audit tìm được phải là hàng của ĐÚNG bước ảnh đó thuộc về.
        const after = audit[0].after as { status?: string } | null;
        expect(after?.status).toBe(hang.statusTo);
      }

      // Hai lượt ⇒ hai thời điểm KHÁC nhau; nếu chúng bằng nhau thì phép join trên chỉ đúng
      // do may mắn và test này phải đỏ.
      expect(hangAnh[0].occurredAt?.getTime()).not.toBe(
        hangAnh[1].occurredAt?.getTime(),
      );
    });

    it('chuyển KHÔNG kèm ảnh vẫn ghi audit — upload luôn optional (FR-23)', async () => {
      const donId = await taoDon(TOI, null);

      await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.batDauGiao,
        anh: [],
      });

      expect(
        await prisma.attachment.count({ where: { orderId: donId } }),
      ).toBe(0);
      expect(
        await prisma.auditLog.count({
          where: { targetId: donId, eventType: 'StatusChanged' },
        }),
      ).toBe(1);
    });
  });

  describe('khách tự lấy trên Postgres THẬT', () => {
    it('đơn Thương mại `dacoc → dagiao → hoanthanh`: 2 hàng audit, ảnh nối vào bước `dagiao`', async () => {
      const donId = await taoDon(TOI, null);
      await prisma.order.update({
        where: { id: donId },
        data: { scopeThiCong: false, scopeVanChuyen: false },
      });
      // A deposit-paid order always has a confirmed current version; a free-text line ⇒
      // nothing to issue.
      const ban = await prisma.orderVersion.create({
        data: {
          orderId: donId,
          versionNo: 1,
          lineItems: {
            create: {
              name: 'Công lắp đặt',
              unit: 'gói',
              qty: 1,
              unitPrice: 1_000_000,
              unitPriceSnapshot: 1_000_000,
              displayOrder: 0,
            },
          },
        },
      });
      await prisma.order.update({
        where: { id: donId },
        data: { currentVersionId: ban.id },
      });

      const giao = await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.xongGiao,
        anh: [anh('khach-nhan-hang.jpg')],
      });
      expect(giao.status).toBe('dagiao');

      const xong = await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.hoanThanh,
        anh: [],
      });
      expect(xong.status).toBe('hoanthanh');

      const don = await prisma.order.findUniqueOrThrow({
        where: { id: donId },
      });
      expect(don.status).toBe('hoanthanh');

      const audit = await prisma.auditLog.findMany({
        where: { targetId: donId, eventType: 'StatusChanged' },
        orderBy: { occurredAt: 'asc' },
      });
      expect(
        audit.map((a) => [
          (a.before as { status?: string } | null)?.status,
          (a.after as { status?: string } | null)?.status,
        ]),
      ).toEqual([
        ['dacoc', 'dagiao'],
        ['dagiao', 'hoanthanh'],
      ]);

      const hangAnh = await prisma.attachment.findMany({
        where: { orderId: donId },
      });
      expect(hangAnh).toHaveLength(1);
      expect(hangAnh[0].statusFrom).toBe('dacoc');
      expect(hangAnh[0].statusTo).toBe('dagiao');
      expect(hangAnh[0].occurredAt?.getTime()).toBe(
        audit[0].occurredAt.getTime(),
      );
    });
  });

  describe('từ chối trên dữ liệu THẬT (AC-5, AC-6, AC-7, AC-13)', () => {
    it('AC-7: thiếu quyền ⇒ 403, KHÔNG hàng attachment nào và status GIỮ NGUYÊN', async () => {
      const donId = await taoDon(TOI, null);

      const loi = await bat(
        service.chuyenTrangThaiThuCong({
          callerAccountId: TOI,
          quyen: new Set([PERM.ordersViewAll]),
          orderId: donId,
          event: SU_KIEN.batDauThiCong,
          anh: [anh('a.jpg'), anh('b.jpg')],
        }),
      );

      expect(loi.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(
        await prisma.attachment.count({ where: { orderId: donId } }),
      ).toBe(0);
      const don = await prisma.order.findUniqueOrThrow({
        where: { id: donId },
      });
      expect(don.status).toBe('dacoc');
    });

    it('AC-13: `chot` qua cửa này ⇒ 409 và status KHÔNG đổi trên DB thật', async () => {
      // Ca hỏng dữ liệu nặng nhất của story: `chot` bằng applyTransition trần bỏ qua snapshot
      // giá + đóng băng VAT ⇒ đơn `dachot` mà giá vẫn trôi theo danh mục.
      const donId = await taoDon(TOI, null);

      const loi = await bat(
        service.chuyenTrangThaiThuCong({
          callerAccountId: TOI,
          quyen: new Set([...QUYEN_DU, PERM.ordersConfirm, PERM.quotesCreateEdit]),
          orderId: donId,
          event: SU_KIEN.chot,
          anh: [],
        }),
      );

      expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
      const don = await prisma.order.findUniqueOrThrow({
        where: { id: donId },
      });
      expect(don.status).toBe('dacoc');
      expect(
        await prisma.auditLog.count({ where: { targetId: donId } }),
      ).toBe(0);
    });

    it('AC-6: BẤM HAI LẦN ⇒ lần hai 409, đúng MỘT hàng audit tồn tại', async () => {
      const donId = await taoDon(TOI, null);

      await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.batDauThiCong,
        anh: [],
      });
      const loi = await bat(
        service.chuyenTrangThaiThuCong({
          callerAccountId: TOI,
          quyen: QUYEN_DU,
          orderId: donId,
          event: SU_KIEN.batDauThiCong,
          anh: [],
        }),
      );

      expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
      expect(
        await prisma.auditLog.count({
          where: { targetId: donId, eventType: 'StatusChanged' },
        }),
      ).toBe(1);
    });

    it('AC-6: bước ngoài phạm vi đơn ⇒ 409 (cờ Thi công TẮT)', async () => {
      const order = await prisma.order.create({
        data: {
          status: 'dacoc',
          customerSdt: SDT,
          ownerAccountId: TOI,
          assigneeAccountId: null,
          sourceId,
          custType: 'THUONG_MAI',
          scopeThietBi: true,
          scopeThiCong: false,
          scopeVanChuyen: false,
        },
      });

      const loi = await bat(
        service.chuyenTrangThaiThuCong({
          callerAccountId: TOI,
          quyen: QUYEN_DU,
          orderId: order.id,
          event: SU_KIEN.batDauThiCong,
          anh: [],
        }),
      );

      expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
      expect(loi.message).toBe('Bước này không thuộc phạm vi của đơn.');
    });
  });

  describe('phạm vi trên đường ghi và đường đọc bytes (AC-8, AD-4/AD-15)', () => {
    it('đơn NGOÀI phạm vi ⇒ 404 khi chuyển, và không byte nào lên storage', async () => {
      const donHo = await taoDon(NGUOI_KHAC, NGUOI_KHAC);
      const truoc = storage.objects.size;

      const loi = await bat(
        service.chuyenTrangThaiThuCong({
          callerAccountId: TOI,
          quyen: CHI_XEM_CUA_MINH,
          orderId: donHo,
          event: SU_KIEN.batDauThiCong,
          anh: [anh('len-lut.jpg')],
        }),
      );

      expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(storage.objects.size).toBe(truoc);
    });

    it('AC-8: chủ đơn đọc lại được bytes của ảnh mình vừa gắn', async () => {
      const donId = await taoDon(TOI, null);
      await service.chuyenTrangThaiThuCong({
        callerAccountId: TOI,
        quyen: QUYEN_DU,
        orderId: donId,
        event: SU_KIEN.batDauThiCong,
        anh: [anh('bang-chung.jpg')],
      });
      const hang = await prisma.attachment.findFirstOrThrow({
        where: { orderId: donId },
      });

      const file = await service.anhDinhKem(TOI, QUYEN_DU, donId, hang.id);
      expect(file.body.toString()).toBe('bytes-bang-chung.jpg');
      expect(file.contentType).toBe('image/jpeg');
      expect(file.fileName).toBe('bang-chung.jpg');
    });

    it('AC-8: actor NGOÀI phạm vi đơn ⇒ 404, KHÔNG rò bytes', async () => {
      const donHo = await taoDon(NGUOI_KHAC, NGUOI_KHAC);
      await service.chuyenTrangThaiThuCong({
        callerAccountId: NGUOI_KHAC,
        quyen: QUYEN_DU,
        orderId: donHo,
        event: SU_KIEN.batDauThiCong,
        anh: [anh('rieng-tu.jpg')],
      });
      const hang = await prisma.attachment.findFirstOrThrow({
        where: { orderId: donHo },
      });

      const loi = await bat(
        service.anhDinhKem(TOI, CHI_XEM_CUA_MINH, donHo, hang.id),
      );
      // 404, KHÔNG 403: 403 xác nhận ảnh có thật — một bit rò ra cho người không được thấy nó.
      expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
    });

    it('AC-8: đoán id ảnh của đơn khác qua đơn MÌNH xem được ⇒ 404', async () => {
      // Truy vấn phải kẹp CẢ `orderId`: chỉ kẹp `attachmentId` là ai xem được một đơn bất kỳ
      // cũng đọc được mọi ảnh trong hệ thống.
      const donCuaToi = await taoDon(TOI, null);
      const donHo = await taoDon(NGUOI_KHAC, NGUOI_KHAC);
      await service.chuyenTrangThaiThuCong({
        callerAccountId: NGUOI_KHAC,
        quyen: QUYEN_DU,
        orderId: donHo,
        event: SU_KIEN.batDauThiCong,
        anh: [anh('cua-ho.jpg')],
      });
      const anhCuaHo = await prisma.attachment.findFirstOrThrow({
        where: { orderId: donHo },
      });

      const loi = await bat(
        service.anhDinhKem(TOI, CHI_XEM_CUA_MINH, donCuaToi, anhCuaHo.id),
      );
      expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('đơn đủ ba cờ ở `dacoc` (có Vận chuyển ⇒ không có lối tự lấy)', () => {
    it('`buocKeTiep` qua lifecycle trên đơn THẬT trả đúng hai nhánh mở', async () => {
      const donId = await taoDon(TOI, null);
      const vongDoi = await service.lifecycle(TOI, QUYEN_DU, donId);
      expect(vongDoi.buocKeTiep.map((b) => b.event).sort()).toEqual(
        [SU_KIEN.batDauGiao, SU_KIEN.batDauThiCong].sort(),
      );
    });
  });
});
