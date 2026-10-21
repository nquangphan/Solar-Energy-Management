import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  StockItemsService,
  type StockList,
} from '../src/inventory/stock-items.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho đường đọc tồn kho — sự thật mà mock KHÔNG chứng minh:
 * `reserved` là `SUM(qty)` có dấu gom theo ĐÚNG `stockItemId` (`groupBy` thật), sản phẩm vắng
 * dòng `stock_items` đọc ra 0/0 (LEFT JOIN qua `include`), lọc `insensitive` của Postgres, và
 * ràng buộc DB (unique `product_id`, FK RESTRICT).
 *
 * Ledger được INSERT thẳng — story này chưa có đường ghi movement nào.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

moTa('Tồn kho (GET /stock-items) trên Postgres THẬT', () => {
  let prisma: PrismaClient;
  let service: StockItemsService;

  const SDT = '+84900000062';
  const ACTOR = 'acc-stock-62';
  const SKU = 'TEST62-';
  let orderId: string;
  let versionId: string;
  const sp: Record<string, string> = {};

  async function donDep(): Promise<void> {
    const products = await prisma.product.findMany({
      where: { sku: { startsWith: SKU } },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    await prisma.stockMovement.deleteMany({
      where: { stockItem: { productId: { in: productIds } } },
    });
    await prisma.stockItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });

    const orders = await prisma.order.findMany({
      where: { customerSdt: SDT },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
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

  async function taoSanPham(
    key: string,
    name: string,
    opts: { tracksStock?: boolean; isActive?: boolean } = {},
  ): Promise<string> {
    const p = await prisma.product.create({
      data: {
        name,
        sku: `${SKU}${key}`,
        unit: 'tấm',
        price: 1_000_000,
        costPrice: 800_000,
        tracksStock: opts.tracksStock ?? true,
        isActive: opts.isActive ?? true,
      },
    });
    sp[key] = p.id;
    return p.id;
  }

  async function taoTon(productId: string, onHand: number): Promise<string> {
    const s = await prisma.stockItem.create({ data: { productId, onHand } });
    return s.id;
  }

  async function ghiSo(stockItemId: string, qty: number): Promise<void> {
    await prisma.stockMovement.create({
      data: {
        stockItemId,
        orderId,
        orderVersionId: versionId,
        qty,
        type: qty > 0 ? 'giu_cho' : 'giai_phong',
      },
    });
  }

  function cuaTest(...keys: string[]): Promise<StockList> {
    return service.lietKeTonKho({ productIds: keys.map((k) => sp[k]) });
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new StockItemsService(prisma as unknown as PrismaService);

    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('Chưa seed CustomerSource — chạy `npx prisma db seed`.');
    }

    await donDep();

    await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'stock-62@test.local',
        passwordHash: 'x',
        displayName: 'Người test tồn kho',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: SDT,
        custType: 'CA_NHAN',
        name: 'Khách test tồn kho',
        sourceId: facebook.id,
      },
    });
    const order = await prisma.order.create({
      data: {
        status: 'dachot',
        customerSdt: SDT,
        ownerAccountId: ACTOR,
        sourceId: facebook.id,
        custType: 'CA_NHAN',
      },
    });
    orderId = order.id;
    const version = await prisma.orderVersion.create({
      data: { orderId, versionNo: 1 },
    });
    versionId = version.id;
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  it('reserved = SUM(qty) có dấu; khả dụng âm vào danh sách cần mua; hai sản phẩm không lẫn ledger', async () => {
    const a = await taoTon(await taoSanPham('A', 'Test62 Pin A'), 5);
    const b = await taoTon(await taoSanPham('B', 'Test62 Pin B'), 10);
    await ghiSo(a, 12);
    await ghiSo(a, 8);
    await ghiSo(b, 3);

    let ket = await cuaTest('A', 'B');
    expect(ket.items).toEqual([
      expect.objectContaining({
        productId: sp.A,
        onHand: 5,
        reserved: 20,
        khaDung: -15,
        canNhap: 15,
        tinhTrang: 'am',
      }),
      expect.objectContaining({
        productId: sp.B,
        onHand: 10,
        reserved: 3,
        khaDung: 7,
        canNhap: 0,
        tinhTrang: 'du',
      }),
    ]);
    expect(ket.danhSachCanMua).toEqual([
      { productId: sp.A, ten: 'Test62 Pin A', donVi: 'tấm', canNhap: 15 },
    ]);

    // Giải phóng là một dòng ÂM — không sửa dòng cũ.
    await ghiSo(a, -8);
    ket = await cuaTest('A');
    expect(ket.items[0]).toMatchObject({
      reserved: 12,
      khaDung: -7,
      canNhap: 7,
    });
  });

  it('sản phẩm theo dõi tồn chưa có dòng stock_items ⇒ 0/0/0 "het"', async () => {
    await taoSanPham('C', 'Test62 Pin C');

    const ket = await cuaTest('C');

    expect(ket.items).toEqual([
      expect.objectContaining({
        productId: sp.C,
        onHand: 0,
        reserved: 0,
        khaDung: 0,
        canNhap: 0,
        tinhTrang: 'het',
      }),
    ]);
    expect(ket.danhSachCanMua).toEqual([]);
  });

  it('sản phẩm đã ẩn còn hàng vẫn hiện; ẩn hết sạch và dịch vụ không theo dõi thì không', async () => {
    await taoTon(
      await taoSanPham('D', 'Test62 Ẩn còn hàng', { isActive: false }),
      4,
    );
    await taoTon(
      await taoSanPham('E', 'Test62 Ẩn hết sạch', { isActive: false }),
      0,
    );
    await taoSanPham('F', 'Test62 Công lắp', { tracksStock: false });

    const ket = await cuaTest('D', 'E', 'F');

    expect(ket.items.map((i) => i.productId)).toEqual([sp.D]);
  });

  it('q tìm theo tên/SKU không phân biệt hoa thường trên Postgres', async () => {
    await taoSanPham('G', 'Test62 Inverter Hybrid');

    const theoTen = await service.lietKeTonKho({ q: 'test62 INVERTER' });
    const theoSku = await service.lietKeTonKho({ q: `${SKU.toLowerCase()}g` });

    expect(theoTen.items.map((i) => i.productId)).toEqual([sp.G]);
    expect(theoSku.items.map((i) => i.productId)).toEqual([sp.G]);
  });

  it('q chứa `_`/`%` khớp NGUYÊN VĂN, không như ký tự đại diện LIKE', async () => {
    await taoSanPham('M', 'Test62 INV_8K');
    await taoSanPham('N', 'Test62 INVX8K');
    await taoSanPham('O', 'Test62 Giảm 50% phí');

    const gach = await service.lietKeTonKho({ q: 'test62 inv_8k' });
    const phanTram = await service.lietKeTonKho({ q: 'test62 giảm 50%' });
    const chiPhanTram = await service.lietKeTonKho({
      q: '%',
      productIds: [sp.M, sp.N, sp.O],
    });

    expect(gach.items.map((i) => i.productId)).toEqual([sp.M]);
    expect(phanTram.items.map((i) => i.productId)).toEqual([sp.O]);
    expect(chiPhanTram.items.map((i) => i.productId)).toEqual([sp.O]);
  });

  it('danhSachCanMua: canNhap giảm dần, hoà theo tên; tính trên đúng tập đã lọc', async () => {
    await ghiSo(
      await taoTon(await taoSanPham('J', 'Test62 Zeta thiếu 3'), 0),
      3,
    );
    await ghiSo(
      await taoTon(await taoSanPham('K', 'Test62 Alpha thiếu 3'), 0),
      3,
    );
    await ghiSo(
      await taoTon(await taoSanPham('L', 'Test62 Mid thiếu 9'), 1),
      10,
    );

    const ca = await cuaTest('J', 'K', 'L');
    const mot = await cuaTest('J');

    expect(ca.danhSachCanMua.map((c) => [c.productId, c.canNhap])).toEqual([
      [sp.L, 9],
      [sp.K, 3],
      [sp.J, 3],
    ]);
    expect(mot.danhSachCanMua.map((c) => c.productId)).toEqual([sp.J]);
  });

  it('unique product_id: một sản phẩm chỉ có một dòng tồn', async () => {
    const id = await taoSanPham('H', 'Test62 Unique');
    await taoTon(id, 1);

    await expect(
      prisma.stockItem.create({ data: { productId: id } }),
    ).rejects.toThrow(/Unique constraint|stock_items_product_id_key/i);
  });

  it('FK RESTRICT: xoá cứng sản phẩm còn dòng tồn bị DB chặn', async () => {
    const id = await taoSanPham('I', 'Test62 Restrict');
    await taoTon(id, 0);

    // Prisma 7 ném DriverAdapterError không gắn mã P2003 cho delete-restrict ⇒ assert message.
    await expect(prisma.product.delete({ where: { id } })).rejects.toThrow(
      /foreign key|stock_items_product_id_fkey/i,
    );
  });
});
