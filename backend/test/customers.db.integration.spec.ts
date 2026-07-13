import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { CustomersService } from '../src/customers/customers.service';
import { CUST_TYPE } from '../src/customers/domain/customer-type';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT — trả món nợ mà project-context ghi là "đến hạn ở Story 3.3".
 *
 * Vì sao lane này phải tồn tại: mock Prisma chỉ chứng minh *"service dịch đúng lỗi KHI Prisma ném
 * ra"*. Nó KHÔNG chứng minh Postgres thật sự ném. AC-3 ("một SĐT = một khách hàng") là một ràng
 * buộc TẦNG DB — nếu chỉ có mock, nó xanh bằng LỜI HỨA. Ở đây không có mock nào: PK và FK thật
 * đứng ra chặn, hoặc chúng không chặn và test đỏ.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC, không ai bị chặn vì chưa
 * bật Docker. Chạy có chủ đích: `npm run test:db` (nạp `.env` rồi mới gọi jest).
 *
 * Phạm vi: CHỈ ràng buộc do story này thêm. KHÔNG dùng lane này để nhận vơ rằng ràng buộc của
 * Story 3.1/3.2 đã được kiểm — chúng chưa.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB: vắng DATABASE_URL (npm test vẫn hermetic). Chạy: npm run test:db',
  );
}

moTa('Ràng buộc tầng DB của customers (Postgres THẬT)', () => {
  let prisma: PrismaClient;
  let sourceId: string;

  // SĐT riêng của test — không đụng dữ liệu thật; dọn trước và sau mỗi lần chạy.
  const SDT = '+84900000001';
  const SDT_KHAC = '+84900000002';

  function khach(sdt: string, srcId: string) {
    return {
      sdt,
      custType: CUST_TYPE.caNhan,
      name: 'Khách test tích hợp',
      sourceId: srcId,
    };
  }

  async function donDep(): Promise<void> {
    await prisma.customer.deleteMany({
      where: { sdt: { in: [SDT, SDT_KHAC] } },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('Chưa seed CustomerSource — chạy `npx prisma db seed`.');
    }
    sourceId = facebook.id;
    await donDep();
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  describe('AC-9 — migration mới chạy được trên DB ĐÃ CÓ dữ liệu/migration cũ', () => {
    it('migration của story này nằm trong _prisma_migrations, cùng với các migration trước đó', async () => {
      const applied = await prisma.$queryRawUnsafe<
        { migration_name: string }[]
      >(
        'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL',
      );
      const names = applied.map((row) => row.migration_name);

      expect(names).toContain(
        '20260713020000_add_customers_and_customer_sources',
      );
      // Không phải DB rỗng: các migration cũ vẫn nằm đó ⇒ `migrate deploy` chạy được ĐÈ LÊN
      // lịch sử có sẵn, không phải chỉ chạy được trên một DB mới tinh.
      expect(names).toContain('20260708000000_init_auth_accounts_sessions');
      expect(names.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('AC-10 — seed nguồn khách', () => {
    it('có đủ 5 nguồn và ĐÚNG MỘT dòng isOther', async () => {
      const sources = await prisma.customerSource.findMany();

      expect(sources.length).toBeGreaterThanOrEqual(5);
      expect(sources.filter((source) => source.isOther)).toHaveLength(1);
      expect(sources.map((source) => source.name)).toEqual(
        expect.arrayContaining([
          'Facebook',
          'Zalo',
          'Fanpage',
          'Đại lý',
          'Khác',
        ]),
      );
    });

    it('chạy LẠI seed ⇒ KHÔNG nhân đôi danh mục (idempotent — bằng cách chạy thật, không bằng lời hứa)', async () => {
      // AC-10 đòi seed idempotent. Đọc code thấy `upsert` là chưa đủ: cái ta cần biết là chạy
      // lần hai trên DB ĐANG CÓ dữ liệu thì chuyện gì xảy ra. Nên ở đây gọi ĐÚNG lệnh mà người
      // vận hành gọi, rồi đếm lại. Một `create` lọt vào thay `upsert` sẽ vỡ ngay ở đây.
      const truoc = await prisma.customerSource.findMany();

      execFileSync('npx', ['prisma', 'db', 'seed'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe',
      });

      const sau = await prisma.customerSource.findMany();
      expect(sau).toHaveLength(truoc.length);
      expect(sau.filter((source) => source.isOther)).toHaveLength(1);
      // Id phải GIỮ NGUYÊN: khách cũ FK vào chúng — seed lại mà sinh id mới là mồ côi cả bảng.
      expect(sau.map((source) => source.id).sort()).toEqual(
        truoc.map((source) => source.id).sort(),
      );
    }, 180_000);

    it('UNIQUE customer_sources.name THỰC SỰ enforce (nền móng của upsert-theo-name)', async () => {
      // Seed idempotent được là nhờ ràng buộc này. Nếu nó không có ở DB, `upsert` theo `name`
      // chỉ là một câu lệnh may rủi.
      await expect(
        prisma.customerSource.create({
          data: { name: 'Facebook', description: 'trùng tên', sortOrder: 1 },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('AC-3 — PK customers.sdt THỰC SỰ chặn trùng (không phải một câu `if`)', () => {
    it('insert lại cùng sdt ⇒ Postgres ném P2002', async () => {
      await prisma.customer.create({ data: khach(SDT, sourceId) });

      // Không đi qua service, không mock: đây là PK của Postgres đứng ra chặn.
      await expect(
        prisma.customer.create({ data: khach(SDT, sourceId) }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('sdt KHÁC ⇒ insert được (PK chặn đúng cái cần chặn, không chặn oan)', async () => {
      await prisma.customer.create({ data: khach(SDT_KHAC, sourceId) });

      const found = await prisma.customer.findUnique({
        where: { sdt: SDT_KHAC },
      });
      expect(found?.sdt).toBe(SDT_KHAC);
    });
  });

  describe('AC-9 — FK customers.source_id THỰC SỰ chặn nguồn ma', () => {
    it('sourceId không tồn tại ⇒ Postgres ném FK violation (P2003)', async () => {
      await expect(
        prisma.customer.create({
          data: khach(SDT, '99999999-8888-4777-8666-555555555555'),
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      // Và không có bản ghi rác nào sót lại.
      const found = await prisma.customer.findUnique({ where: { sdt: SDT } });
      expect(found).toBeNull();
    });
  });

  describe('$transaction rollback THẬT', () => {
    it('transaction ném giữa chừng ⇒ bản ghi đã insert bị rollback, không sót nửa vời', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.customer.create({ data: khach(SDT, sourceId) });
          // Trùng PK ngay trong cùng transaction ⇒ vỡ ⇒ cả khối phải bị huỷ.
          await tx.customer.create({ data: khach(SDT, sourceId) });
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const found = await prisma.customer.findUnique({ where: { sdt: SDT } });
      expect(found).toBeNull();
    });
  });

  /**
   * Story 3.4 — tìm kiếm/lọc/phân trang chạy qua CHÍNH `CustomersService`, trên Postgres THẬT.
   *
   * Mock Prisma chỉ chứng minh service DỰNG `where` như ta nghĩ. Nó KHÔNG chứng minh Postgres
   * TRẢ VỀ đúng dòng: `mode: 'insensitive'` có thật sự bỏ qua hoa/thường trên tiếng Việt có dấu
   * không, và `contains` needle có thật sự khớp được PK `+84903…` không. Hai câu đó chỉ trả lời
   * được ở đây.
   */
  describe('Story 3.4 — search/filter/paging trên Postgres THẬT', () => {
    const SDT_TIM = '+84903176968'; // gõ là "0903176968" — needle "903176968"
    const SDT_HOA = '+84912000003';
    const SDT_CTY = '+84987000004';
    const SDT_SEARCH = [SDT_TIM, SDT_HOA, SDT_CTY];

    let service: CustomersService;

    async function donDepSearch(): Promise<void> {
      await prisma.customer.deleteMany({ where: { sdt: { in: SDT_SEARCH } } });
    }

    beforeAll(async () => {
      // EventBus giả: story này chỉ ĐỌC, không phát event nào — nhưng service đòi cái port.
      service = new CustomersService(
        prisma as unknown as PrismaService,
        { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
      );
      await donDepSearch();

      // Ba khách, tạo TUẦN TỰ để `createdAt` khác nhau ⇒ thứ tự "mới nhất trước" xác định được.
      await prisma.customer.create({
        data: {
          sdt: SDT_TIM,
          custType: CUST_TYPE.caNhan,
          name: 'Trần Văn Tìm',
          sourceId,
        },
      });
      await prisma.customer.create({
        data: {
          sdt: SDT_HOA,
          custType: CUST_TYPE.caNhan,
          name: 'Nguyễn Thị Hoà',
          sourceId,
        },
      });
      await prisma.customer.create({
        data: {
          sdt: SDT_CTY,
          custType: CUST_TYPE.thuongMai,
          name: 'Công ty TNHH Hoà Phát',
          taxCode: '0312345678',
          sourceId,
        },
      });
    });

    afterAll(async () => {
      await donDepSearch();
    });

    it('🔴 gõ "0903" ⇒ TÌM RA khách có PK "+84903176968" (cái mà `contains` thô làm trượt)', async () => {
      const trang = await service.list({ q: '0903' });

      const sdts = trang.items.map((khach) => khach.sdt);
      expect(sdts).toContain(SDT_TIM);
    });

    it('gõ TRỌN số nội địa "0903176968" ⇒ vẫn ra đúng khách đó', async () => {
      const trang = await service.list({ q: '0903176968' });

      expect(trang.items.map((khach) => khach.sdt)).toContain(SDT_TIM);
    });

    it('mode insensitive là THẬT với tiếng Việt có dấu ("hoà" ⇒ ra "Nguyễn Thị Hoà")', async () => {
      const trang = await service.list({ q: 'hoà' });

      const names = trang.items.map((khach) => khach.name);
      expect(names).toContain('Nguyễn Thị Hoà');
      expect(names).toContain('Công ty TNHH Hoà Phát');
    });

    it('q chỉ CHỮ không biến thành contains rỗng (không kéo về cả bảng)', async () => {
      const trang = await service.list({ q: 'Trần Văn Tìm' });

      expect(trang.items.map((khach) => khach.sdt)).toEqual([SDT_TIM]);
      expect(trang.total).toBe(1);
    });

    it('q + custType gộp AND đúng trên DB thật', async () => {
      const trang = await service.list({
        q: 'hoà',
        custType: CUST_TYPE.thuongMai,
      });

      expect(trang.items.map((khach) => khach.name)).toEqual([
        'Công ty TNHH Hoà Phát',
      ]);
    });

    it('total là TỔNG TOÀN BỘ, không phải độ dài trang; page/pageSize cắt đúng', async () => {
      // Lọc về đúng 3 khách của test này bằng needle chung là không làm được (SĐT khác nhau),
      // nên lọc bằng loại khách + đọc tổng từ chính DB để so.
      const tongCaNhan = await prisma.customer.count({
        where: { custType: CUST_TYPE.caNhan },
      });

      const trang1 = await service.list({
        custType: CUST_TYPE.caNhan,
        page: 1,
        pageSize: 1,
      });

      expect(trang1.items).toHaveLength(1);
      expect(trang1.total).toBe(tongCaNhan);
      expect(trang1.total).toBeGreaterThan(trang1.items.length);

      const trang2 = await service.list({
        custType: CUST_TYPE.caNhan,
        page: 2,
        pageSize: 1,
      });

      expect(trang2.items).toHaveLength(1);
      // Trang 2 phải là bản ghi KHÁC trang 1 — `skip` sai (vd luôn 0) sẽ trả lại đúng bản ghi cũ.
      expect(trang2.items[0].sdt).not.toBe(trang1.items[0].sdt);
      expect(trang2.total).toBe(tongCaNhan);
    });

    it('lookup() tra được khách bằng dạng THÔ trên DB thật (hội tụ E.164)', async () => {
      const ketQua = await service.lookup('0903 176 968');

      expect(ketQua.found).toBe(true);
      expect(ketQua.sdt).toBe(SDT_TIM);
      expect(ketQua.customer?.name).toBe('Trần Văn Tìm');
    });

    it('lookup() số chưa có ⇒ found:false (200, không phải 404)', async () => {
      const ketQua = await service.lookup('0999999998');

      expect(ketQua).toMatchObject({ found: false, customer: null });
    });
  });

  beforeEach(async () => {
    await donDep();
  });
});
