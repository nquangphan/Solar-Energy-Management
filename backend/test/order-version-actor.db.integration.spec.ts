import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho cột actor của `OrderVersion` — sự thật mà mock KHÔNG
 * chứng minh được:
 *
 * Mọi test hermetic của story này khẳng định service TRUYỀN `createdByAccountId` xuống Prisma.
 * Truyền đúng KHÔNG bằng lưu được: cột phải TỒN TẠI, phải NULLABLE (bản cũ trong DB không có
 * actor — nếu migration lỡ tay `NOT NULL` thì mọi bản cũ chặn deploy), và FK phải trỏ đúng
 * `accounts` (FK sai kiểu chỉ nổ lúc INSERT thật, không lúc typecheck).
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa('OrderVersion.createdByAccountId trên Postgres THẬT', () => {
  let prisma: PrismaClient;

  const SDT = '+84900000054';
  const ACTOR = 'acc-order-version-54';
  let sourceId: string;
  let orderId: string;

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
      await prisma.orderVersion.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    await prisma.customer.deleteMany({ where: { sdt: SDT } });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
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

    await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'order-version-54@test.local',
        passwordHash: 'x',
        displayName: 'Người tạo bản 5.4',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: SDT,
        custType: 'CA_NHAN',
        name: 'Khách test lịch sử bản 5.4',
        sourceId,
      },
    });
    const order = await prisma.order.create({
      data: {
        status: 'baogia',
        customerSdt: SDT,
        ownerAccountId: ACTOR,
        sourceId,
        custType: 'CA_NHAN',
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  it('ghi được actor và đọc lại qua relation `createdBy`', async () => {
    const version = await prisma.orderVersion.create({
      data: { orderId, versionNo: 1, createdByAccountId: ACTOR },
    });

    const docLai = await prisma.orderVersion.findUnique({
      where: { id: version.id },
      include: { createdBy: true },
    });

    expect(docLai?.createdByAccountId).toBe(ACTOR);
    // Tên hiển thị lấy qua `include` — KHÔNG batch tay, không N+1.
    expect(docLai?.createdBy?.displayName).toBe('Người tạo bản 5.4');
  });

  it('cột NULLABLE: bản không có actor (bản tạo trước migration này) vẫn ghi và đọc được', async () => {
    // Nếu migration lỡ tay `NOT NULL`, câu INSERT này nổ — và mọi bản cũ trong DB thật sẽ
    // chặn deploy. Nullable là một quyết định dữ liệu, không phải gu.
    const version = await prisma.orderVersion.create({
      data: { orderId, versionNo: 2 },
    });

    const docLai = await prisma.orderVersion.findUnique({
      where: { id: version.id },
      include: { createdBy: true },
    });

    expect(docLai?.createdByAccountId).toBeNull();
    expect(docLai?.createdBy).toBeNull();
  });

  it('FK trỏ `accounts`: actor không tồn tại ⇒ DB từ chối', async () => {
    await expect(
      prisma.orderVersion.create({
        data: {
          orderId,
          versionNo: 3,
          createdByAccountId: 'acc-khong-ton-tai-54',
        },
      }),
    ).rejects.toThrow();
  });
});
