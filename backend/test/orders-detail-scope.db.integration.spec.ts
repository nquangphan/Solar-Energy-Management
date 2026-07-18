import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { EventBus } from '../src/events/event-bus';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho ĐƯỜNG ĐỌC-THEO-ID của màn chi tiết — sự thật mà mock
 * KHÔNG chứng minh được.
 *
 * `orders-detail-scope.spec.ts` khẳng định HÌNH DẠNG của `where` trước một Prisma giả: nó hỏi
 * "service có gửi đúng mệnh đề không". Câu hỏi thật thì khác: "đơn của người khác có THẬT SỰ
 * không trả về không". Mệnh đề phạm vi ở đây là một `OR` LỒNG trong `AND` với một nhánh so
 * `assigneeAccountId` NULLABLE — và `NULL` trong SQL không bằng cái gì cả, kể cả chính nó.
 * Hình dạng đúng mà kết quả sai vẫn là rò đơn, chỉ Postgres trả lời được.
 *
 * Đây là lỗ bảo mật story 5.4 vá (`GET /orders/:id` từng `findUnique({where:{id}})`), nên nó
 * xứng đáng có lane chứng minh trên DB thật chứ không chỉ trên mock — đúng bài học G1 của 5.3.
 *
 * Lane này cũng chốt AD-6 trên dữ liệu THẬT: `laBanHienLuc` theo CON TRỎ `currentVersionId`,
 * với fixture ép con trỏ vào bản CŨ hơn (fixture "tự nhiên" luôn trỏ bản mới nhất ⇒ một cài
 * đặt sai theo `max(versionNo)` vẫn xanh).
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa(
  'Đọc chi tiết đơn theo id: phạm vi + lịch sử bản trên Postgres THẬT',
  () => {
    let prisma: PrismaClient;
    let service: OrdersService;

    const SDT = '+84900000544';
    const TOI = 'acc-detail-544-toi';
    const NGUOI_KHAC = 'acc-detail-544-khac';

    let sourceId: string;

    /** Đơn của TÔI (owner) · đơn NGƯỜI KHÁC giao cho TÔI (assignee) · đơn hoàn toàn của họ. */
    let donCuaToi: string;
    let donGiaoChoToi: string;
    let donNguoiKhac: string;

    /** Hai bản của `donCuaToi`; con trỏ hiệu lực trỏ bản CŨ (bản 1). */
    let banMot: string;
    let banHai: string;

    const CHI_XEM_CUA_MINH = new Set<string>([PERM.ordersViewOwn]);
    const XEM_TAT_CA = new Set<string>([PERM.ordersViewAll]);

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

    async function taoDon(
      ownerAccountId: string,
      assigneeAccountId: string | null,
    ): Promise<string> {
      const order = await prisma.order.create({
        data: {
          status: 'baogia',
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

    /** Dòng tự do (productId null) — lane này về phạm vi và lịch sử, không về danh mục giá. */
    async function taoDong(
      orderVersionId: string,
      name: string,
      qty: number,
      displayOrder: number,
    ): Promise<void> {
      await prisma.orderLineItem.create({
        data: {
          orderVersionId,
          productId: null,
          name,
          unit: 'cái',
          qty,
          unitPrice: 1_000_000,
          displayOrder,
        },
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
      );

      const facebook = await prisma.customerSource.findUnique({
        where: { name: 'Facebook' },
      });
      if (facebook === null) {
        throw new Error(
          'Chưa seed CustomerSource — chạy `npx prisma db seed`.',
        );
      }
      sourceId = facebook.id;

      await donDep();

      await prisma.account.createMany({
        data: [
          {
            id: TOI,
            email: 'detail-544-toi@test.local',
            passwordHash: 'x',
            displayName: 'Tôi 5.4',
          },
          {
            id: NGUOI_KHAC,
            email: 'detail-544-khac@test.local',
            passwordHash: 'x',
            displayName: 'Nguyễn Quản Lý',
          },
        ],
      });
      await prisma.customer.create({
        data: {
          sdt: SDT,
          custType: 'CA_NHAN',
          name: 'Khách test chi tiết đơn 5.4',
          sourceId,
        },
      });

      donCuaToi = await taoDon(TOI, null);
      donGiaoChoToi = await taoDon(NGUOI_KHAC, TOI);
      donNguoiKhac = await taoDon(NGUOI_KHAC, NGUOI_KHAC);

      // Bản 1: một dòng, có actor. Bản 2: hai dòng (một dòng THÊM + một dòng đổi SL), không actor.
      const v1 = await prisma.orderVersion.create({
        data: {
          orderId: donCuaToi,
          versionNo: 1,
          createdByAccountId: NGUOI_KHAC,
        },
      });
      banMot = v1.id;
      await taoDong(banMot, 'Tấm pin', 8, 0);

      const v2 = await prisma.orderVersion.create({
        data: { orderId: donCuaToi, versionNo: 2 },
      });
      banHai = v2.id;
      await taoDong(banHai, 'Tấm pin', 12, 0);
      await taoDong(banHai, 'Inverter', 1, 1);

      // ⚠️ Con trỏ hiệu lực trỏ bản CŨ có CHỦ ĐÍCH — AD-6: "bản hiệu lực" là con trỏ, không
      // phải bản mới nhất. Với con trỏ ở bản 2, một cài đặt sai theo max(versionNo) vẫn xanh.
      await prisma.order.update({
        where: { id: donCuaToi },
        data: { currentVersionId: banMot },
      });
    });

    afterAll(async () => {
      await donDep();
      await prisma.$disconnect();
    });

    describe('phạm vi: chỉ `orders.view_own`', () => {
      it('đọc được đơn mình LÀM CHỦ', async () => {
        const view = await service.getScoped(
          TOI,
          CHI_XEM_CUA_MINH,
          donCuaToi,
          false,
        );
        expect(view.id).toBe(donCuaToi);
      });

      it('đọc được đơn được GIAO cho mình (nhánh assignee của mệnh đề OR)', async () => {
        // Nhánh này là thứ mock không kiểm được: `assigneeAccountId` nullable, và trên đơn
        // mình làm chủ nó là NULL — `OR` phải khớp bằng nhánh owner, không bằng NULL = NULL.
        const view = await service.getScoped(
          TOI,
          CHI_XEM_CUA_MINH,
          donGiaoChoToi,
          false,
        );
        expect(view.id).toBe(donGiaoChoToi);
      });

      it('đơn NGƯỜI KHÁC ⇒ 404 — không trả hàng, không 403', async () => {
        await expect(
          service.getScoped(TOI, CHI_XEM_CUA_MINH, donNguoiKhac, false),
        ).rejects.toMatchObject({ status: 404 });
      });

      it('id KHÔNG TỒN TẠI ⇒ cùng một 404 với cùng thông điệp: ngoài phạm vi không phân biệt được với không có', async () => {
        const ngoaiPhamVi = await service
          .getScoped(TOI, CHI_XEM_CUA_MINH, donNguoiKhac, false)
          .catch((e: Error) => e.message);
        const khongTonTai = await service
          .getScoped(TOI, CHI_XEM_CUA_MINH, 'khong-ton-tai-544', false)
          .catch((e: Error) => e.message);
        // Thông điệp có kèm id nên khác nhau ở phần id — hình dạng câu phải trùng.
        expect(ngoaiPhamVi).toBe(`Không tìm thấy đơn hàng: ${donNguoiKhac}`);
        expect(khongTonTai).toBe('Không tìm thấy đơn hàng: khong-ton-tai-544');
      });

      it('`/vong-doi` và `/phien-ban` chịu CÙNG phạm vi — không endpoint nào quên', async () => {
        await expect(
          service.lifecycle(TOI, CHI_XEM_CUA_MINH, donNguoiKhac),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          service.listVersions(TOI, CHI_XEM_CUA_MINH, donNguoiKhac),
        ).rejects.toMatchObject({ status: 404 });
      });
    });

    describe('phạm vi: `orders.view_all`', () => {
      it('đọc được đơn của BẤT KỲ ai — mệnh đề phạm vi không được thêm vào', async () => {
        const view = await service.getScoped(
          TOI,
          XEM_TAT_CA,
          donNguoiKhac,
          false,
        );
        expect(view.id).toBe(donNguoiKhac);
        const vongDoi = await service.lifecycle(TOI, XEM_TAT_CA, donNguoiKhac);
        expect(vongDoi.buoc.length).toBeGreaterThan(0);
      });
    });

    describe('lịch sử bản trên dữ liệu THẬT (AC-2, AC-9, AC-10)', () => {
      it('mọi bản theo versionNo tăng dần; `laBanHienLuc` theo CON TRỎ, ở bản CŨ', async () => {
        const bans = await service.listVersions(
          TOI,
          CHI_XEM_CUA_MINH,
          donCuaToi,
        );

        expect(bans.map((b) => b.versionNo)).toEqual([1, 2]);
        expect(bans.filter((b) => b.laBanHienLuc)).toHaveLength(1);
        expect(bans[0].id).toBe(banMot);
        expect(bans[0].laBanHienLuc).toBe(true);
        expect(bans[1].id).toBe(banHai);
        expect(bans[1].laBanHienLuc).toBe(false);
      });

      it('tên người tạo lấy qua JOIN `createdBy`; bản không có actor ⇒ null, KHÔNG bịa tên', async () => {
        const bans = await service.listVersions(
          TOI,
          CHI_XEM_CUA_MINH,
          donCuaToi,
        );
        expect(bans[0].createdByDisplayName).toBe('Nguyễn Quản Lý');
        expect(bans[1].createdByAccountId).toBeNull();
        expect(bans[1].createdByDisplayName).toBeNull();
      });

      it('`soDong` và `thayDoi` tính từ DÒNG THẬT của đúng bản đó', async () => {
        const bans = await service.listVersions(
          TOI,
          CHI_XEM_CUA_MINH,
          donCuaToi,
        );

        expect(bans.map((b) => b.soDong)).toEqual([1, 2]);
        // Bản gốc không so với gì cả.
        expect(bans[0].thayDoi).toEqual({ them: [], xoa: [], doiSoLuong: [] });
        expect(bans[1].thayDoi.them).toEqual(['Inverter']);
        expect(bans[1].thayDoi.xoa).toEqual([]);
        expect(bans[1].thayDoi.doiSoLuong).toEqual([
          { ten: 'Tấm pin', tu: 8, den: 12 },
        ]);
      });

      it('đơn CHƯA có bản nào ⇒ mảng rỗng, không nổ', async () => {
        expect(
          await service.listVersions(TOI, CHI_XEM_CUA_MINH, donGiaoChoToi),
        ).toEqual([]);
      });
    });
  },
);
