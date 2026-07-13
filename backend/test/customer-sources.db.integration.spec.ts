import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedCustomerSources } from '../prisma/seed';
import { CustomerSourcesService } from '../src/customers/customer-sources.service';
import { CUST_TYPE } from '../src/customers/domain/customer-type';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho danh mục Nguồn khách.
 *
 * Vì sao lane này phải tồn tại: hai bất biến trung tâm của story KHÔNG chứng minh được bằng mock.
 *
 *  1. "**Đúng một** dòng `isOther`" — không có index DB nào enforce nó. Nó đứng được nhờ SEED,
 *     nên câu hỏi thật là "sau khi seed chạy trên Postgres, đếm ra bao nhiêu?". Chỉ ở đây mới
 *     đếm được.
 *  2. "**Không bao giờ hard-delete**" — mock Prisma chấp nhận `delete()` không kêu ca. Chỉ FK
 *     `ON DELETE RESTRICT` thật mới ném P2003, và test dưới đây bắt nó ném — đó là bằng chứng
 *     cho vì sao soft-delete không phải một lựa chọn phong cách.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB nguồn khách: vắng DATABASE_URL. Chạy: npm run test:db',
  );
}

moTa('Ràng buộc tầng DB của customer_sources (Postgres THẬT)', () => {
  let prisma: PrismaClient;
  let service: CustomerSourcesService;

  // Dữ liệu riêng của test — tên có tiền tố để không bao giờ đụng 5 dòng seed thật.
  const TEN_TEST = 'ZZ Test nguồn tích hợp';
  const SDT_TEST = '+84900000009';

  /**
   * Tên tạm khi test ĐỔI TÊN dòng `isOther` THẬT — và nó CỐ Ý nằm NGOÀI tiền tố `ZZ Test`.
   *
   * `donDep()` xoá cứng mọi dòng có tên bắt đầu bằng `ZZ Test`. Nếu tên tạm này rơi vào tiền tố
   * đó, một cú chết giữa chừng (jest timeout, huỷ CI, `--forceExit`) sẽ bỏ lại dòng seed mang cờ
   * dưới cái tên tạm — và lần chạy sau `donDep()` XOÁ CỨNG chính nó. Mất dòng `isOther` DUY NHẤT
   * của database đó, và mọi test đếm cờ đỏ theo.
   */
  const TEN_DOI_TAM = 'Nguồn khác (test đang đổi tên)';

  async function donDep(): Promise<void> {
    await prisma.customer.deleteMany({ where: { sdt: SDT_TEST } });
    await prisma.customerSource.deleteMany({
      where: { name: { startsWith: 'ZZ Test' } },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new CustomerSourcesService(
      prisma as unknown as PrismaService,
      { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
    );
    await donDep();
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await donDep();
  });

  describe('AC-0 — bất biến "đúng một dòng isOther" sống ở SEED, và nó THẬT', () => {
    it('sau seed: đủ 5 nguồn và ĐÚNG MỘT dòng isOther', async () => {
      const sources = await prisma.customerSource.findMany();

      expect(sources.length).toBeGreaterThanOrEqual(5);
      expect(sources.filter((s) => s.isOther)).toHaveLength(1);
      expect(sources.map((s) => s.name)).toEqual(
        expect.arrayContaining([
          'Facebook',
          'Zalo',
          'Fanpage',
          'Đại lý',
          'Khác',
        ]),
      );
    });

    it('🔴 API KHÔNG tạo nổi dòng isOther thứ hai — cờ không có đường nào đi vào', async () => {
      // Đây là cách bất biến được thi hành: không phải bằng một câu `if`, mà bằng việc cờ không
      // tồn tại trong DTO ghi. Kể cả ném thẳng cờ vào service, cột xuống DB vẫn là false.
      await service.create('acc-test', {
        name: TEN_TEST,
        isOther: true,
      } as never);

      const sources = await prisma.customerSource.findMany();
      expect(sources.filter((s) => s.isOther)).toHaveLength(1);
      const taoMoi = sources.find((s) => s.name === TEN_TEST);
      expect(taoMoi?.isOther).toBe(false);
    });
  });

  describe('AC-1 — UNIQUE customer_sources.name enforce THẬT ở tầng DB', () => {
    it('tên trùng ⇒ service dịch P2002 của Postgres thành 409 (không phải 500)', async () => {
      // P2002 ở đây do Postgres ném thật, không phải một mock được dạy để ném.
      await expect(
        service.create('acc-test', { name: 'Facebook' }),
      ).rejects.toMatchObject({
        errorCode: 'CONFLICT',
        fieldErrors: [{ field: 'name' }],
      });
    });

    it('sortOrder vắng ⇒ xếp xuống cuối THẬT (max + 1 đọc từ DB)', async () => {
      const max = await prisma.customerSource.findFirst({
        orderBy: { sortOrder: 'desc' },
      });

      const taoMoi = await service.create('acc-test', { name: TEN_TEST });

      expect(taoMoi.sortOrder).toBe((max?.sortOrder ?? -1) + 1);
    });
  });

  describe('🔴 AC-3 — FK ON DELETE RESTRICT: vì sao soft-delete là đường DUY NHẤT', () => {
    it('xoá CỨNG một nguồn đang có khách trỏ vào ⇒ Postgres CHẶN, dòng vẫn còn nguyên', async () => {
      const nguon = await prisma.customerSource.create({
        data: { name: TEN_TEST, description: 'test', sortOrder: 500 },
      });
      await prisma.customer.create({
        data: {
          sdt: SDT_TEST,
          custType: CUST_TYPE.caNhan,
          name: 'Khách test FK',
          sourceId: nguon.id,
        },
      });

      // Không đi qua service (service KHÔNG CÓ đường xoá cứng) — gọi thẳng Prisma để chứng minh
      // rằng nếu ai đó thêm đường đó vào, DB sẽ chặn họ, và lịch sử "khách từ đâu tới" được giữ.
      //
      // ⚠️ KHÔNG assert `code: 'P2003'` ở đây. Prisma 7 qua driver adapter chỉ gắn mã P2003 cho
      // FK violation lúc INSERT (đường mà `customers.db.integration.spec.ts` dựa vào); vi phạm
      // RESTRICT lúc DELETE nổi lên dưới dạng `DriverAdapterError` KHÔNG mang `code`. Bám vào mã
      // sẽ làm test đỏ vì một chi tiết của tầng driver, trong khi thứ cần khẳng định là HÀNH VI:
      // lệnh xoá bị từ chối, và dòng còn sống.
      await expect(
        prisma.customerSource.delete({ where: { id: nguon.id } }),
      ).rejects.toThrow(/violates RESTRICT setting of foreign key constraint/);

      const vanCon = await prisma.customerSource.findUnique({
        where: { id: nguon.id },
      });
      expect(vanCon).not.toBeNull();

      // Và khách vẫn trỏ được vào nguồn của mình — cái mà xoá cứng sẽ làm bốc hơi.
      const khach = await prisma.customer.findUnique({
        where: { sdt: SDT_TEST },
      });
      expect(khach?.sourceId).toBe(nguon.id);
    });

    it('TẮT nguồn xong ⇒ khách cũ VẪN đọc được nguồn của mình (đó là điều soft-delete bảo vệ)', async () => {
      const nguon = await prisma.customerSource.create({
        data: { name: TEN_TEST, description: 'test', sortOrder: 500 },
      });
      await prisma.customer.create({
        data: {
          sdt: SDT_TEST,
          custType: CUST_TYPE.caNhan,
          name: 'Khách test FK',
          sourceId: nguon.id,
        },
      });

      await service.deactivate('acc-test', nguon.id);

      const khach = await prisma.customer.findUnique({
        where: { sdt: SDT_TEST },
        include: { source: true },
      });
      expect(khach?.source.id).toBe(nguon.id);
      expect(khach?.source.active).toBe(false);
      expect(khach?.source.name).toBe(TEN_TEST);

      // Và nguồn đã tắt biến khỏi dropdown của khách MỚI — nhưng chỉ khỏi dropdown.
      const chonDuoc = await service.findAll(false);
      expect(chonDuoc.map((s) => s.id)).not.toContain(nguon.id);
      const caDanhMuc = await service.findAll(true);
      expect(caDanhMuc.map((s) => s.id)).toContain(nguon.id);
    });

    it('bật lại ⇒ nguồn quay về dropdown', async () => {
      const nguon = await prisma.customerSource.create({
        data: {
          name: TEN_TEST,
          description: 'test',
          sortOrder: 500,
          active: false,
        },
      });

      await service.reactivate('acc-test', nguon.id);

      const chonDuoc = await service.findAll(false);
      expect(chonDuoc.map((s) => s.id)).toContain(nguon.id);
    });
  });

  describe('AC-2 — đổi tên dòng "Khác" KHÔNG làm sập luật sourceNote của Story 3.3', () => {
    it('đổi tên xong, cờ isOther vẫn còn nguyên trên DB thật', async () => {
      const khac = await prisma.customerSource.findFirst({
        where: { isOther: true },
      });
      expect(khac).not.toBeNull();

      const doiTen = await service.update('acc-test', khac!.id, {
        name: TEN_DOI_TAM,
      });

      try {
        expect(doiTen.isOther).toBe(true);
        const doc = await prisma.customerSource.findUnique({
          where: { id: khac!.id },
        });
        expect(doc?.isOther).toBe(true);
        expect(doc?.name).toBe(TEN_DOI_TAM);
        // Vẫn ĐÚNG MỘT dòng mang cờ — đổi nhãn không nhân bản, không làm rơi cờ.
        const mangCo = await prisma.customerSource.findMany({
          where: { isOther: true },
        });
        expect(mangCo).toHaveLength(1);
      } finally {
        // Trả lại tên gốc: các test/seed khác so theo `name`, và dòng này là dữ liệu THẬT.
        await prisma.customerSource.update({
          where: { id: khac!.id },
          data: { name: khac!.name },
        });
      }
    });

    it('🔴 đổi tên dòng "Khác" RỒI SEED LẠI ⇒ VẪN đúng một dòng isOther (seed khoá theo CỜ, không theo TÊN)', async () => {
      // Ca này là chỗ bất biến trung tâm của story SUÝT gãy. Story 3.5 mở đường ĐỔI TÊN dòng
      // "Khác" (có chủ đích). Seed thì `upsert({ where: { name: 'Khác' } })`. Ghép hai thứ lại:
      // admin đổi tên ⇒ lần `prisma db seed` kế tiếp KHÔNG thấy dòng nào tên "Khác" ⇒ nhánh
      // `create` chạy ⇒ dòng `isOther` THỨ HAI ra đời. Không có index DB nào chặn.
      //
      // Chỉ lane này bắt được: nó là chỗ DUY NHẤT chạy seed THẬT trên Postgres THẬT.
      const khac = await prisma.customerSource.findFirst({
        where: { isOther: true },
      });
      expect(khac).not.toBeNull();

      try {
        await service.update('acc-test', khac!.id, { name: TEN_DOI_TAM });

        await seedCustomerSources(prisma);

        const mangCo = await prisma.customerSource.findMany({
          where: { isOther: true },
        });
        expect(mangCo).toHaveLength(1);
        expect(mangCo[0].id).toBe(khac!.id);
        // Seed KHÔNG đạp lại cái tên admin vừa đặt.
        expect(mangCo[0].name).toBe(TEN_DOI_TAM);
        // Và không có dòng "Khác" nào mọc lại bên cạnh.
        const tenCu = await prisma.customerSource.findUnique({
          where: { name: khac!.name },
        });
        expect(tenCu).toBeNull();
      } finally {
        await prisma.customerSource.update({
          where: { id: khac!.id },
          data: { name: khac!.name },
        });
      }
    });
  });
});
