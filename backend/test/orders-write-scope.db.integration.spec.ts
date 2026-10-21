import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import type { EventBus } from '../src/events/event-bus';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import { QuoteExportService } from '../src/orders/quote-export.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho PHẠM VI của ĐƯỜNG GHI đơn.
 *
 * `orders-write-scope.spec.ts` khẳng định service GỬI mệnh đề phạm vi; lane này trả lời câu
 * hỏi thật: Thợ KS A có THẬT SỰ không sửa được đơn của Thợ KS B không — và dữ liệu của B có
 * nguyên vẹn sau mọi lần thử không. Mệnh đề là `OR` lồng trong `AND` với nhánh
 * `assigneeAccountId` NULLABLE: chỉ Postgres trả lời được nhánh assignee có khớp đúng không.
 *
 * Bộ quyền lấy từ PRESET THẬT (`ROLE_PRESETS.THO_KS` / `QUAN_LY`), không tự gõ tay — preset đổi
 * thì lane này đổi theo.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa('Đường GHI đơn chịu phạm vi trên Postgres THẬT', () => {
  let prisma: PrismaClient;
  let service: OrdersService;
  let quoteExport: QuoteExportService;
  const storage = fakeStorage();

  const SDT = '0900000931';
  const SDT_E164 = '+84900000931';
  const THO_A = 'acc-write-scope-a';
  const THO_B = 'acc-write-scope-b';
  const QUAN_LY = 'acc-write-scope-ql';
  const KE_TOAN = 'acc-write-scope-kt';

  const QUYEN_THO_KS: ReadonlySet<string> = new Set(ROLE_PRESETS.THO_KS);
  const QUYEN_QUAN_LY: ReadonlySet<string> = new Set(ROLE_PRESETS.QUAN_LY);
  const QUYEN_KE_TOAN: ReadonlySet<string> = new Set(ROLE_PRESETS.KE_TOAN);

  /** Đơn của B (A không được chạm) · đơn của A · đơn của B GIAO cho A. */
  let donCuaB: string;
  let dongCuaB: string;
  let donCuaA: string;
  let donGiaoChoA: string;

  const DONG_TU_DO = {
    name: 'Combo phụ kiện',
    unit: 'bộ',
    qty: 2,
    unitPrice: 1_000_000,
  };

  async function donDep(): Promise<void> {
    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT_E164 },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      await prisma.quoteExport.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.discountApproval.deleteMany({
        where: { orderId: { in: orderIds } },
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
    await prisma.customer.deleteMany({ where: { sdt: SDT_E164 } });
    await prisma.account.deleteMany({
      where: { id: { in: [THO_A, THO_B, QUAN_LY, KE_TOAN] } },
    });
  }

  /** Ảnh chụp mọi thứ một đường ghi có thể đổi trên đơn — so trước/sau. */
  async function anhChup(orderId: string) {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const versions = await prisma.orderVersion.findMany({
      where: { orderId },
      orderBy: { versionNo: 'asc' },
    });
    const lines = await prisma.orderLineItem.findMany({
      where: { orderVersionId: { in: versions.map((v) => v.id) } },
      orderBy: { id: 'asc' },
    });
    const approvals = await prisma.discountApproval.findMany({
      where: { orderId },
    });
    return { order, versions, lines, approvals };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new OrdersService(
      prisma as unknown as PrismaService,
      { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
      storage,
      {} as unknown as StockVouchersService,
    );
    quoteExport = new QuoteExportService(
      service,
      prisma as unknown as PrismaService,
      { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
      storage,
      {} as unknown as QuoteRendererPort,
    );

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('Chưa seed CustomerSource — chạy `npx prisma db seed`.');
    }

    await donDep();
    await prisma.account.createMany({
      data: [THO_A, THO_B, QUAN_LY, KE_TOAN].map((id) => ({
        id,
        email: `${id}@test.local`,
        passwordHash: 'x',
        displayName: id,
      })),
    });
    await prisma.customer.create({
      data: {
        sdt: SDT_E164,
        custType: 'CA_NHAN',
        name: 'Khách test phạm vi đường ghi',
        sourceId: facebook.id,
      },
    });

    donCuaB = (await service.create(THO_B, { customerSdt: SDT })).id;
    dongCuaB = (
      await service.addLine(THO_B, donCuaB, DONG_TU_DO, false, QUYEN_THO_KS)
    ).id;
    donCuaA = (await service.create(THO_A, { customerSdt: SDT })).id;
    donGiaoChoA = (await service.create(THO_B, { customerSdt: SDT })).id;
    await prisma.order.update({
      where: { id: donGiaoChoA },
      data: { assigneeAccountId: THO_A },
    });
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  describe('Thợ KS A trên đơn của Thợ KS B ⇒ 404, dữ liệu B nguyên vẹn', () => {
    const DUONG_GHI: readonly [string, () => Promise<unknown>][] = [
      [
        'update (PATCH đơn)',
        () =>
          service.update(
            THO_A,
            donCuaB,
            { scopeThiCong: true, kWp: 9.9 },
            false,
            QUYEN_THO_KS,
          ),
      ],
      [
        'confirm (chốt)',
        () => service.confirm(THO_A, donCuaB, 8, false, QUYEN_THO_KS),
      ],
      [
        'revise (mở lại)',
        () => service.revise(THO_A, donCuaB, false, QUYEN_THO_KS),
      ],
      [
        'applyDiscount',
        () =>
          service.applyDiscount(
            THO_A,
            donCuaB,
            100_000,
            null,
            false,
            QUYEN_THO_KS,
          ),
      ],
      [
        'resolveDiscount (kể cả có thêm discounts.approve)',
        () =>
          service.resolveDiscount(
            THO_A,
            donCuaB,
            true,
            null,
            false,
            new Set([...QUYEN_THO_KS, PERM.discountsApprove]),
          ),
      ],
      [
        'addLine',
        () => service.addLine(THO_A, donCuaB, DONG_TU_DO, false, QUYEN_THO_KS),
      ],
      [
        'updateLine',
        () =>
          service.updateLine(
            THO_A,
            donCuaB,
            dongCuaB,
            { qty: 99 },
            false,
            QUYEN_THO_KS,
          ),
      ],
      [
        'removeLine',
        () => service.removeLine(THO_A, donCuaB, dongCuaB, QUYEN_THO_KS),
      ],
    ];

    it.each(DUONG_GHI)(
      '%s ⇒ 404 cùng thông điệp "không tồn tại"',
      async (_ten, goi) => {
        const truoc = await anhChup(donCuaB);

        await expect(goi()).rejects.toMatchObject({
          status: 404,
          message: `Không tìm thấy đơn hàng: ${donCuaB}`,
        });

        expect(await anhChup(donCuaB)).toEqual(truoc);
      },
    );

    it('bảng đủ 8 đường ghi (chống bảng rỗng ⇒ it.each xanh giả)', () => {
      expect(DUONG_GHI).toHaveLength(8);
    });
  });

  describe('trong phạm vi vẫn ghi được', () => {
    it('Thợ KS A sửa + thêm dòng + áp chiết khấu trên đơn CỦA MÌNH', async () => {
      await service.update(
        THO_A,
        donCuaA,
        { scopeThiCong: true },
        false,
        QUYEN_THO_KS,
      );
      await service.addLine(THO_A, donCuaA, DONG_TU_DO, false, QUYEN_THO_KS);
      const view = await service.applyDiscount(
        THO_A,
        donCuaA,
        100_000,
        null,
        false,
        QUYEN_THO_KS,
      );

      expect(view.status).toBe('choduyet');
      const sau = await anhChup(donCuaA);
      expect(sau.order.scopeThiCong).toBe(true);
      expect(sau.lines).toHaveLength(1);
      expect(sau.approvals).toHaveLength(1);
    });

    it('Thợ KS A sửa được đơn B GIAO cho mình (nhánh assignee của OR)', async () => {
      await service.update(
        THO_A,
        donGiaoChoA,
        { scopeVanChuyen: true },
        false,
        QUYEN_THO_KS,
      );
      expect((await anhChup(donGiaoChoA)).order.scopeVanChuyen).toBe(true);
    });

    it('Quản lý (orders.view_all) sửa được đơn của B', async () => {
      await service.update(
        QUAN_LY,
        donCuaB,
        { validityNote: 'Quản lý sửa' },
        false,
        QUYEN_QUAN_LY,
      );
      expect((await anhChup(donCuaB)).order.validityNote).toBe('Quản lý sửa');
    });
  });

  describe('đường ĐỌC chạm file/hàng chờ của đơn cũng chịu phạm vi', () => {
    it('tải file báo giá: A ⇒ 404 "không tìm thấy đơn" trên đơn của B; Quản lý tải được', async () => {
      const ban = await prisma.order.findUniqueOrThrow({
        where: { id: donCuaB },
      });
      await prisma.quoteExport.create({
        data: {
          orderId: donCuaB,
          orderVersionId: ban.currentVersionId as string,
          imageKey: `quotes/${donCuaB}/bao-gia.png`,
          pdfKey: `quotes/${donCuaB}/bao-gia.pdf`,
          imageSize: 3,
          pdfSize: 4,
          fileName: 'bao-gia-b',
          createdByAccountId: THO_B,
        },
      });
      storage.objects.set(`quotes/${donCuaB}/bao-gia.pdf`, {
        body: Buffer.from('%PDF'),
        contentType: 'application/pdf',
      });

      for (const kind of ['anh', 'pdf'] as const) {
        await expect(
          quoteExport.getExportFile(THO_A, QUYEN_THO_KS, donCuaB, kind),
        ).rejects.toMatchObject({
          status: 404,
          message: `Không tìm thấy đơn hàng: ${donCuaB}`,
        });
      }
      const file = await quoteExport.getExportFile(
        QUAN_LY,
        QUYEN_QUAN_LY,
        donCuaB,
        'pdf',
      );
      expect(file.body.toString()).toBe('%PDF');
    });

    it('hàng chờ duyệt chiết khấu: chỉ view_own ⇒ chỉ đơn mình owner/assignee; view_all ⇒ thấy cả đơn B', async () => {
      // Đơn B GIAO cho A chờ duyệt (nhánh assignee) + đơn riêng của B chờ duyệt.
      await service.addLine(
        THO_B,
        donGiaoChoA,
        DONG_TU_DO,
        false,
        QUYEN_THO_KS,
      );
      await service.applyDiscount(
        THO_B,
        donGiaoChoA,
        50_000,
        null,
        false,
        QUYEN_THO_KS,
      );
      const donChoCuaB = (await service.create(THO_B, { customerSdt: SDT })).id;
      await service.addLine(THO_B, donChoCuaB, DONG_TU_DO, false, QUYEN_THO_KS);
      await service.applyDiscount(
        THO_B,
        donChoCuaB,
        50_000,
        null,
        false,
        QUYEN_THO_KS,
      );

      const cuaA = (
        await service.listPendingDiscounts(
          false,
          false,
          THO_A,
          new Set([...QUYEN_THO_KS, PERM.discountsApprove]),
        )
      ).map((item) => item.orderId);
      expect(cuaA).toContain(donGiaoChoA);
      expect(cuaA).not.toContain(donChoCuaB);

      const cuaQuanLy = (
        await service.listPendingDiscounts(false, false, QUAN_LY, QUYEN_QUAN_LY)
      ).map((item) => item.orderId);
      expect(cuaQuanLy).toEqual(
        expect.arrayContaining([donGiaoChoA, donChoCuaB]),
      );
    });
  });

  describe('tra cứu bảo hành theo SĐT (mặc định E-9)', () => {
    let donBaoHanh: string;
    let dongCoBaoHanh: string;
    let dongKhongBaoHanh: string;

    beforeAll(async () => {
      donBaoHanh = (await service.create(THO_B, { customerSdt: SDT })).id;
      dongCoBaoHanh = (
        await service.addLine(
          THO_B,
          donBaoHanh,
          { ...DONG_TU_DO, name: 'Inverter' },
          false,
          QUYEN_THO_KS,
        )
      ).id;
      await service.updateLine(
        THO_B,
        donBaoHanh,
        dongCoBaoHanh,
        { warrantyMonths: 60 },
        false,
        QUYEN_THO_KS,
      );
      dongKhongBaoHanh = (
        await service.addLine(
          THO_B,
          donBaoHanh,
          { ...DONG_TU_DO, name: 'Công lắp' },
          false,
          QUYEN_THO_KS,
        )
      ).id;
      await service.confirm(THO_B, donBaoHanh, 8, false, QUYEN_THO_KS);
    });

    it('preset KE_TOAN (orders.view_all) tra được đơn KHÔNG phải của mình — không ra rỗng', async () => {
      const ketQua = await service.traCuuBaoHanh(KE_TOAN, QUYEN_KE_TOAN, SDT);

      expect(ketQua.found).toBe(true);
      expect(ketQua.orders.map((o) => o.id)).toContain(donBaoHanh);
    });

    it('dòng KHÔNG bảo hành bị bỏ hẳn khỏi kết quả, dòng có bảo hành còn', async () => {
      // Tiền đề: dòng không bảo hành THẬT SỰ tồn tại trong bản hiệu lực đã chốt — nếu không,
      // ca này xanh mà không chứng minh gì.
      const dong = await prisma.orderLineItem.findUniqueOrThrow({
        where: { id: dongKhongBaoHanh },
      });
      expect(dong.warrantyMonths).toBeNull();

      const ketQua = await service.traCuuBaoHanh(KE_TOAN, QUYEN_KE_TOAN, SDT);
      const don = ketQua.orders.find((o) => o.id === donBaoHanh);
      expect(don?.lineItems.map((l) => l.name)).toEqual(['Inverter']);
      // Đơn chỉ có dòng không bảo hành (đơn của A, chưa chốt) không xuất hiện.
      expect(ketQua.orders.map((o) => o.id)).not.toContain(donCuaA);
    });

    it('Thợ KS A (chỉ view_own, không owner/assignee) KHÔNG thấy đơn bảo hành của B', async () => {
      const ketQua = await service.traCuuBaoHanh(THO_A, QUYEN_THO_KS, SDT);
      expect(ketQua.orders.map((o) => o.id)).not.toContain(donBaoHanh);
    });
  });
});
