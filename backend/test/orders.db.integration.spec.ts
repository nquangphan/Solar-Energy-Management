import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { EventBus } from '../src/events/event-bus';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
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

  /**
   * TOCTOU giữa `confirm` (đọc dòng → snapshot → commit) và `addLine` (đọc status → chèn
   * dòng), trên Postgres THẬT.
   *
   * BẤT BIẾN: một đơn đã `dachot` thì MỌI dòng của nó phải có `unitPriceSnapshot`. Một dòng
   * lọt vào mà thiếu snapshot sẽ live-resolve theo danh mục TƯƠNG LAI trên một đơn đã đóng
   * băng giá — tức là giá của đơn đã chốt vẫn còn tự đổi.
   *
   * Chạy NHIỀU VÒNG, KHÔNG delay nhân tạo: một vòng duy nhất với `setTimeout` chỉ ép được
   * một thứ tự và sẽ xanh giả kể cả khi đã gỡ sạch khoá (đã kiểm chứng bằng mutation). Nhiều
   * vòng đua tự do mới chạm được cả hai chiều interleaving.
   */
  describe('TOCTOU: chốt đua với thêm dòng (khoá FOR UPDATE hai phía)', () => {
    const TOAN_QUYEN: ReadonlySet<string> = new Set(Object.values(PERM));
    const SO_VONG = 12;

    it('đơn đã chốt ⇒ MỌI dòng đều có snapshot giá (không dòng nào lọt qua cửa sổ)', async () => {
      for (let vong = 0; vong < SO_VONG; vong++) {
        const don = await service.create(accountId, { customerSdt: SDT });
        await service.addLine(accountId, don.id, { productId, qty: 1 }, false);

        // Hai request xuất phát CÙNG LÚC trên cùng một đơn — thứ tự do DB quyết.
        const ketQua = await Promise.allSettled([
          service.confirm(accountId, don.id, 8, false, TOAN_QUYEN),
          service.addLine(accountId, don.id, { productId, qty: 7 }, false),
        ]);

        const sauCung = await prisma.order.findUniqueOrThrow({
          where: { id: don.id },
        });
        const dong = await prisma.orderLineItem.findMany({
          where: { orderVersionId: sauCung.currentVersionId as string },
          orderBy: { displayOrder: 'asc' },
        });

        if (sauCung.status === 'dachot') {
          for (const d of dong) {
            expect({
              vong,
              soDong: dong.length,
              snapshot: d.unitPriceSnapshot,
            }).toEqual({
              vong,
              soDong: dong.length,
              snapshot: expect.any(Number),
            });
          }
        }
        // Bên thua (nếu có) phải thua tử tế bằng 409, không phải 500.
        for (const kq of ketQua) {
          if (kq.status === 'rejected') {
            expect((kq.reason as { getStatus(): number }).getStatus()).toBe(
              409,
            );
          }
        }
      }
    });

    /**
     * Cửa sổ ĐỐI XỨNG với test trên, phía `updateLine`. Đọc-lại-status-trong-tx MỘT MÌNH
     * không đóng được nó: dưới READ COMMITTED, một `SELECT` thường vẫn đọc được ảnh chụp
     * `baogia` trong khi transaction `confirm` đang giữ khoá và chưa commit. `updateLine`
     * đi tiếp, ghi vào dòng (row khác, không đụng khoá nào), rồi commit SAU khi đơn đã
     * `dachot` — giá của một đơn đã đóng băng vừa tự đổi.
     *
     * Bất biến bắt được điều đó mà không cần biết ai thắng: với dòng TỰ DO, `confirm` đóng
     * băng `unitPriceSnapshot = unitPrice` đang thấy. `updateLine` thắng trước ⇒ `confirm`
     * chụp giá MỚI. `confirm` thắng trước ⇒ `updateLine` đọc lại thấy `dachot` ⇒ 409, giá
     * giữ nguyên. Hai cột LỆCH NHAU chỉ xảy ra khi một lệnh ghi lọt qua sau lúc đóng băng.
     */
    it('đơn đã chốt ⇒ unitPriceSnapshot KHỚP unitPrice (không lệnh sửa giá nào lọt qua sau lúc đóng băng)', async () => {
      const GIA_DAU = 100_000;
      const GIA_SUA = 777_000;

      for (let vong = 0; vong < SO_VONG; vong++) {
        const don = await service.create(accountId, { customerSdt: SDT });
        // Dòng TỰ DO: `priceEditable` = true ⇒ `unitPrice` sửa được, và `confirm` đóng băng
        // đúng con số đang thấy (dòng catalog thì snapshot theo giá danh mục, không phản
        // ánh được lệnh sửa).
        const dongTuDo = await service.addLine(
          accountId,
          don.id,
          {
            name: 'Công lắp đặt',
            unit: 'gói',
            qty: 1,
            unitPrice: GIA_DAU,
          },
          false,
        );

        const ketQua = await Promise.allSettled([
          service.confirm(accountId, don.id, 8, false, TOAN_QUYEN),
          service.updateLine(
            accountId,
            don.id,
            dongTuDo.id,
            { unitPrice: GIA_SUA },
            false,
          ),
        ]);

        const sauCung = await prisma.order.findUniqueOrThrow({
          where: { id: don.id },
        });
        const dong = await prisma.orderLineItem.findMany({
          where: { orderVersionId: sauCung.currentVersionId as string },
        });

        if (sauCung.status === 'dachot') {
          for (const d of dong) {
            expect({ vong, snapshot: d.unitPriceSnapshot }).toEqual({
              vong,
              snapshot: d.unitPrice,
            });
          }
        }
        for (const kq of ketQua) {
          if (kq.status === 'rejected') {
            expect((kq.reason as { getStatus(): number }).getStatus()).toBe(
              409,
            );
          }
        }
      }
    });
  });

  /**
   * Story 5.2 — cửa auto-transition dưới ĐUA THẬT trên Postgres.
   *
   * Hai lần ghi nhận CÙNG một khoản tiền (retry mạng, webhook lặp) tới cùng lúc. Bất biến
   * NFR-1: đúng MỘT lần đổi status, đúng MỘT `StatusChanged`, kẻ thua trả no-op — KHÔNG ném
   * 409 vào mặt người vừa ghi nhận tiền lần thứ hai.
   *
   * Nhiều vòng, KHÔNG delay nhân tạo: `setTimeout` chỉ ép được một thứ tự và xanh giả kể cả
   * khi đã gỡ nhánh no-op sau sentinel (bài học 5.1).
   */
  describe('Story 5.2 — auto-transition idempotent dưới đua thật', () => {
    const TOAN_QUYEN: ReadonlySet<string> = new Set(Object.values(PERM));
    const SO_VONG = 12;

    /** Bus GHI LẠI event — bất biến "một sự kiện một event" chỉ quan sát được qua đây. */
    let daPublish: { type: string; after?: { status: string } }[];
    let serviceCoBus: OrdersService;

    beforeEach(() => {
      daPublish = [];
      serviceCoBus = new OrdersService(
        prisma as unknown as PrismaService,
        {
          publish: async (event: unknown) => {
            daPublish.push(
              event as { type: string; after?: { status: string } },
            );
          },
          subscribe: () => {},
        } as unknown as EventBus,
      );
    });

    it('hai auto-transition song song ⇒ MỘT lần đổi status, MỘT StatusChanged, kẻ thua no-op', async () => {
      for (let vong = 0; vong < SO_VONG; vong++) {
        const don = await serviceCoBus.create(accountId, { customerSdt: SDT });
        await serviceCoBus.addLine(
          accountId,
          don.id,
          { productId, qty: 1 },
          false,
        );
        await serviceCoBus.confirm(accountId, don.id, 8, false, TOAN_QUYEN);
        // Chỉ đếm event của cuộc đua, không tính event của bước dựng đơn.
        daPublish = [];

        const goi = () =>
          serviceCoBus.chuyenTrangThaiTuDong({
            orderId: don.id,
            event: SU_KIEN.duCoc,
            actorAccountId: accountId,
            actorPermissions: TOAN_QUYEN,
          });
        const ketQua = await Promise.allSettled([goi(), goi()]);

        const sauCung = await prisma.order.findUniqueOrThrow({
          where: { id: don.id },
        });
        const doiSangDaCoc = daPublish.filter(
          (e) => e.type === 'StatusChanged' && e.after?.status === 'dacoc',
        );

        // Đúng một lần đổi, đúng một vết — hai vết cho một khoản tiền là audit nói dối.
        expect({
          vong,
          status: sauCung.status,
          soEvent: doiSangDaCoc.length,
          soThatBai: ketQua.filter((kq) => kq.status === 'rejected').length,
        }).toEqual({ vong, status: 'dacoc', soEvent: 1, soThatBai: 0 });
      }
    });

    it('gọi lại sau khi ĐÃ tới đích ⇒ no-op tuyệt đối: không event, không đổi updatedAt', async () => {
      const don = await serviceCoBus.create(accountId, { customerSdt: SDT });
      await serviceCoBus.addLine(
        accountId,
        don.id,
        { productId, qty: 1 },
        false,
      );
      await serviceCoBus.confirm(accountId, don.id, 8, false, TOAN_QUYEN);
      await serviceCoBus.chuyenTrangThaiTuDong({
        orderId: don.id,
        event: SU_KIEN.duCoc,
        actorAccountId: accountId,
        actorPermissions: TOAN_QUYEN,
      });
      const sauLanDau = await prisma.order.findUniqueOrThrow({
        where: { id: don.id },
      });
      daPublish = [];

      await serviceCoBus.chuyenTrangThaiTuDong({
        orderId: don.id,
        event: SU_KIEN.duCoc,
        actorAccountId: accountId,
        actorPermissions: TOAN_QUYEN,
      });

      const sauLanHai = await prisma.order.findUniqueOrThrow({
        where: { id: don.id },
      });
      expect(daPublish).toEqual([]);
      // Không lệnh ghi nào chạm dòng đơn — `updatedAt` là bằng chứng ở tầng DB.
      expect(sauLanHai.updatedAt).toEqual(sauLanDau.updatedAt);
    });
  });

  /**
   * Nợ L-1 (giao lại từ review 5.1): `updateLine` validate `lineId` theo con trỏ version đọc
   * NGOÀI tx. Một cặp `chot` + `mo_lai` chen giữa đưa status VỀ LẠI `baogia` (nên
   * `assertMutable` trong tx vẫn qua) nhưng đã repoint sang bản mới.
   *
   * Bất biến bắt được lỗi mà không cần biết ai thắng: `updateLine` mà THÀNH CÔNG thì thay đổi
   * PHẢI nhìn thấy được ở BẢN ĐANG HIỆU LỰC. Ghi vào bản đã chết là "thành công" mà số cũ
   * vẫn nguyên trên báo giá — mất dữ liệu im lặng, không lỗi nào nổi lên.
   */
  describe('L-1: sửa dòng đua với cặp chốt + mở lại (con trỏ version đọc trong tx)', () => {
    const TOAN_QUYEN: ReadonlySet<string> = new Set(Object.values(PERM));
    const SO_VONG = 12;
    const QTY_MOI = 9;

    it('updateLine thành công ⇒ thay đổi nằm ở BẢN HIỆU LỰC (không dòng nào rơi vào bản đã chết)', async () => {
      for (let vong = 0; vong < SO_VONG; vong++) {
        const don = await service.create(accountId, { customerSdt: SDT });
        const dong = await service.addLine(
          accountId,
          don.id,
          { productId, qty: 1 },
          false,
        );

        const ketQua = await Promise.allSettled([
          (async () => {
            await service.confirm(accountId, don.id, 8, false, TOAN_QUYEN);
            await service.revise(accountId, don.id, false, TOAN_QUYEN);
          })(),
          service.updateLine(
            accountId,
            don.id,
            dong.id,
            { qty: QTY_MOI },
            false,
          ),
        ]);

        const sauCung = await prisma.order.findUniqueOrThrow({
          where: { id: don.id },
        });
        const dongHienLuc = await prisma.orderLineItem.findMany({
          where: { orderVersionId: sauCung.currentVersionId as string },
        });

        if (ketQua[1].status === 'fulfilled') {
          expect({
            vong,
            qty: dongHienLuc.map((d) => d.qty),
          }).toEqual({ vong, qty: [QTY_MOI] });
        } else {
          // Thua thì phải thua tử tế: 409 (đơn đã chốt) hoặc 404 (dòng thuộc bản đã chết).
          expect([404, 409]).toContain(
            (ketQua[1].reason as { getStatus(): number }).getStatus(),
          );
        }
      }
    });
  });
});
