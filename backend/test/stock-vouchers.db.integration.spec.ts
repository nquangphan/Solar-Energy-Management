import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AppException } from '../src/common/errors/app.exception';
import type { EventBus } from '../src/events/event-bus';
import { tinhGiaVonBinhQuan } from '../src/inventory/domain/gia-von';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho phiếu kho — sự thật mà mock KHÔNG chứng minh: khoá
 * `products … FOR UPDATE` thật sự bắt hai đường ghi tồn NỐI ĐUÔI (READ COMMITTED), tham số mảng
 * `= ANY(${ids})` bind đúng trên adapter pg, rollback toàn phiếu khi một dòng thiếu tồn, CHECK
 * `on_hand >= 0` đứng được một mình, FK RESTRICT, và `seq` SERIAL.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa('Phiếu kho nhập/xuất trên Postgres THẬT', () => {
  let prisma: PrismaClient;
  let service: StockVouchersService;
  let tonKho: StockItemsService;

  const ACTOR = 'acc-stock-63';
  const SKU = 'TEST63-';
  const bus = {
    publish: async () => {},
    subscribe: () => {},
  } as unknown as EventBus;

  /** Xoá theo chiều FK: dòng phiếu → phiếu → sổ tồn → sản phẩm → tài khoản. */
  async function donDep(): Promise<void> {
    const products = await prisma.product.findMany({
      where: { sku: { startsWith: SKU } },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    await prisma.stockVoucherLine.deleteMany({
      where: { stockVoucher: { createdByAccountId: ACTOR } },
    });
    await prisma.stockVoucher.deleteMany({
      where: { createdByAccountId: ACTOR },
    });
    await prisma.stockItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
  }

  let soSanPham = 0;
  async function taoSanPham(
    opts: { costPrice?: number; onHand?: number } = {},
  ): Promise<string> {
    soSanPham += 1;
    const p = await prisma.product.create({
      data: {
        name: `Test63 Pin ${soSanPham}`,
        sku: `${SKU}${soSanPham}`,
        unit: 'tấm',
        price: 3_000_000,
        costPrice: opts.costPrice ?? 0,
      },
    });
    if (opts.onHand !== undefined) {
      await prisma.stockItem.create({
        data: { productId: p.id, onHand: opts.onHand },
      });
    }
    return p.id;
  }

  async function trangThai(
    productId: string,
  ): Promise<{ onHand: number | null; costPrice: number }> {
    const p = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { stockItem: true },
    });
    return { onHand: p.stockItem?.onHand ?? null, costPrice: p.costPrice };
  }

  /** Chờ một nhịp — ép thứ tự trong ca kiểm khoá `FOR UPDATE`. */
  function doi(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new StockVouchersService(prisma as unknown as PrismaService, bus);
    tonKho = new StockItemsService(prisma as unknown as PrismaService);

    await donDep();
    await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'stock-63@test.local',
        passwordHash: 'x',
        displayName: 'Người test phiếu kho',
      },
    });
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  it('nhập lần đầu tạo sổ tồn, bỏ giá vốn gõ tay cũ; lần hai cộng dồn và bình quân gia quyền', async () => {
    const id = await taoSanPham({ costPrice: 999 });

    const lan1 = await service.taoPhieu(
      {
        type: 'nhap',
        lines: [{ productId: id, qty: 10, unitCost: 2_000_000 }],
      },
      ACTOR,
    );
    expect(await trangThai(id)).toEqual({ onHand: 10, costPrice: 2_000_000 });
    expect(lan1.lines[0]).toMatchObject({ qty: 10, unitCost: 2_000_000 });

    await service.taoPhieu(
      {
        type: 'nhap',
        lines: [{ productId: id, qty: 40, unitCost: 2_110_000 }],
      },
      ACTOR,
    );
    expect(await trangThai(id)).toEqual({
      onHand: 50,
      costPrice: tinhGiaVonBinhQuan({
        onHandTruoc: 10,
        giaVonTruoc: 2_000_000,
        qtyNhap: 40,
        donGiaNhap: 2_110_000,
      }),
    });
    expect((await trangThai(id)).costPrice).toBe(2_088_000);
  });

  it('xuất giảm onHand, giữ giá vốn, dòng xuất mang giá vốn lúc xuất; không ghi ledger; đường đọc tồn thấy số mới', async () => {
    const id = await taoSanPham({ costPrice: 1_500_000, onHand: 8 });
    const soMovementTruoc = await prisma.stockMovement.count();

    const phieu = await service.taoPhieu(
      { type: 'xuat', note: 'Hàng hỏng', lines: [{ productId: id, qty: 3 }] },
      ACTOR,
    );

    expect(await trangThai(id)).toEqual({ onHand: 5, costPrice: 1_500_000 });
    const dong = await prisma.stockVoucherLine.findFirstOrThrow({
      where: { stockVoucherId: phieu.id },
    });
    expect(dong).toMatchObject({ qty: 3, unitCost: 1_500_000 });
    expect(await prisma.stockMovement.count()).toBe(soMovementTruoc);

    const doc = await tonKho.lietKeTonKho({ productIds: [id] });
    expect(doc.items[0]).toMatchObject({ productId: id, onHand: 5 });
  });

  it('xuất quá tồn ở một dòng ⇒ 409, rollback TOÀN phiếu: không phiếu nào, onHand cả hai giữ nguyên', async () => {
    const du = await taoSanPham({ costPrice: 100, onHand: 10 });
    const thieu = await taoSanPham({ costPrice: 100, onHand: 2 });
    const soPhieuTruoc = await prisma.stockVoucher.count({
      where: { createdByAccountId: ACTOR },
    });

    const loi = await service
      .taoPhieu(
        {
          type: 'xuat',
          lines: [
            { productId: du, qty: 4 },
            { productId: thieu, qty: 3 },
          ],
        },
        ACTOR,
      )
      .catch((e: unknown) => e);

    expect(loi).toBeInstanceOf(AppException);
    expect((loi as AppException).getStatus()).toBe(409);
    expect(
      await prisma.stockVoucher.count({ where: { createdByAccountId: ACTOR } }),
    ).toBe(soPhieuTruoc);
    expect((await trangThai(du)).onHand).toBe(10);
    expect((await trangThai(thieu)).onHand).toBe(2);
  });

  it('CHECK on_hand >= 0 đứng một mình, không cần service', async () => {
    const id = await taoSanPham({ onHand: 1 });

    await expect(
      prisma.$executeRaw`UPDATE stock_items SET on_hand = -1 WHERE product_id = ${id}`,
    ).rejects.toThrow(/stock_items_on_hand_non_negative/);
  });

  it('CHECK qty > 0 trên dòng phiếu đứng một mình', async () => {
    const id = await taoSanPham();
    const phieu = await prisma.stockVoucher.create({
      data: { type: 'nhap', createdByAccountId: ACTOR },
    });

    await expect(
      prisma.$executeRaw`INSERT INTO stock_voucher_lines (id, stock_voucher_id, product_id, qty, unit_cost)
        VALUES (gen_random_uuid()::text, ${phieu.id}, ${id}, 0, 1)`,
    ).rejects.toThrow(/stock_voucher_lines_qty_positive/);
  });

  it('CHECK unit_cost >= 0 trên dòng phiếu đứng một mình', async () => {
    const id = await taoSanPham();
    const phieu = await prisma.stockVoucher.create({
      data: { type: 'nhap', createdByAccountId: ACTOR },
    });

    await expect(
      prisma.$executeRaw`INSERT INTO stock_voucher_lines (id, stock_voucher_id, product_id, qty, unit_cost)
        VALUES (gen_random_uuid()::text, ${phieu.id}, ${id}, 1, -1)`,
    ).rejects.toThrow(/stock_voucher_lines_unit_cost_non_negative/);
  });

  describe('🔴 khoá FOR UPDATE trên products: đường ghi tồn khác đang DỞ DANG ⇒ phiếu phải NỐI ĐUÔI', () => {
    it('phiếu nhập chạy chồng lên một tx đã khoá products và đổi tồn/giá vốn ⇒ tính trên trạng thái SAU tx đó', async () => {
      // Gỡ khoá khỏi service ⇒ phiếu đọc onHand/costPrice CŨ (trước tx dở dang) ⇒ ghi đè số tuyệt
      // đối tính từ ảnh chụp cũ ⇒ mất +5 của tx kia và giá vốn sai ⇒ ca này ĐỎ. Viết theo KẾT QUẢ,
      // không theo thời gian, không `Promise.all`.
      const id = await taoSanPham({ costPrice: 1_000_000, onHand: 10 });

      let choCommit!: () => void;
      const dangGiu = new Promise<void>((resolve) => {
        choCommit = resolve;
      });
      const txDoDang = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
          await tx.$executeRaw`UPDATE stock_items SET on_hand = on_hand + 5 WHERE product_id = ${id}`;
          await tx.$executeRaw`UPDATE products SET cost_price = 1300000 WHERE id = ${id}`;
          await dangGiu;
        },
        { timeout: 10_000 },
      );
      await doi(150);

      const phieuB = service.taoPhieu(
        {
          type: 'nhap',
          lines: [{ productId: id, qty: 5, unitCost: 1_600_000 }],
        },
        ACTOR,
      );
      await doi(300); // để phiếu thật sự chạm DB và bị chặn ở khoá

      choCommit();
      await txDoDang;
      await phieuB;

      expect(await trangThai(id)).toEqual({
        onHand: 20,
        costPrice: tinhGiaVonBinhQuan({
          onHandTruoc: 15,
          giaVonTruoc: 1_300_000,
          qtyNhap: 5,
          donGiaNhap: 1_600_000,
        }),
      });
    });

    it('hai phiếu chéo sản phẩm (A,B) và (B,A) chạy đồng thời ⇒ cả hai xong, không deadlock', async () => {
      const a = await taoSanPham({ costPrice: 100, onHand: 50 });
      const b = await taoSanPham({ costPrice: 100, onHand: 50 });

      await Promise.all([
        service.taoPhieu(
          {
            type: 'xuat',
            lines: [
              { productId: a, qty: 1 },
              { productId: b, qty: 1 },
            ],
          },
          ACTOR,
        ),
        service.taoPhieu(
          {
            type: 'xuat',
            lines: [
              { productId: b, qty: 2 },
              { productId: a, qty: 2 },
            ],
          },
          ACTOR,
        ),
      ]);

      expect((await trangThai(a)).onHand).toBe(47);
      expect((await trangThai(b)).onHand).toBe(47);
    });
  });

  it('tham số mảng = ANY(ids) bind đúng trên adapter pg: phiếu 3 sản phẩm khoá đủ 3 dòng', async () => {
    const ids = [await taoSanPham(), await taoSanPham(), await taoSanPham()];

    const phieu = await service.taoPhieu(
      {
        type: 'nhap',
        lines: ids.map((productId, i) => ({
          productId,
          qty: i + 1,
          unitCost: 1_000,
        })),
      },
      ACTOR,
    );

    expect(phieu.soDong).toBe(3);
    expect(phieu.tongSoLuong).toBe(6);
    for (const [i, id] of ids.entries()) {
      expect((await trangThai(id)).onHand).toBe(i + 1);
    }
  });

  it('sản phẩm không tồn tại ⇒ 404 từ câu khoá, không ghi gì', async () => {
    const id = await taoSanPham();

    const loi = await service
      .taoPhieu(
        {
          type: 'nhap',
          lines: [
            { productId: id, qty: 1, unitCost: 1 },
            {
              productId: '00000000-0000-4000-8000-000000000063',
              qty: 1,
              unitCost: 1,
            },
          ],
        },
        ACTOR,
      )
      .catch((e: unknown) => e);

    expect((loi as AppException).getStatus()).toBe(404);
    expect((await trangThai(id)).onHand).toBeNull();
  });

  it('seq tăng dần; FK RESTRICT chặn xoá sản phẩm đã có dòng phiếu', async () => {
    const id = await taoSanPham();
    const p1 = await service.taoPhieu(
      { type: 'nhap', lines: [{ productId: id, qty: 1, unitCost: 1 }] },
      ACTOR,
    );
    const p2 = await service.taoPhieu(
      { type: 'xuat', lines: [{ productId: id, qty: 1 }] },
      ACTOR,
    );
    const [r1, r2] = await Promise.all([
      prisma.stockVoucher.findUniqueOrThrow({ where: { id: p1.id } }),
      prisma.stockVoucher.findUniqueOrThrow({ where: { id: p2.id } }),
    ]);
    expect(r2.seq).toBeGreaterThan(r1.seq);
    expect(p2.ma).toBe(`PK-X-${String(r2.seq).padStart(4, '0')}`);

    await prisma.stockItem.delete({ where: { productId: id } });
    await expect(prisma.product.delete({ where: { id } })).rejects.toThrow(
      /stock_voucher_lines_product_id_fkey|Foreign key/i,
    );
  });

  it('liệt kê theo loại: mới nhất trước, đếm dòng/tổng số lượng ở backend', async () => {
    const id = await taoSanPham();
    const moi = await service.taoPhieu(
      { type: 'nhap', lines: [{ productId: id, qty: 7, unitCost: 1 }] },
      ACTOR,
    );

    const { items } = await service.lietKePhieu({ type: 'nhap' });

    expect(items.every((p) => p.type === 'nhap')).toBe(true);
    expect(items[0]).toMatchObject({
      id: moi.id,
      soDong: 1,
      tongSoLuong: 7,
      nguoiTao: { id: ACTOR, displayName: 'Người test phiếu kho' },
    });
  });
});
