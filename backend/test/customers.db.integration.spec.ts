import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { CUST_TYPE } from '../src/customers/domain/customer-type';

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

  beforeEach(async () => {
    await donDep();
  });
});
