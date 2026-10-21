import { StockItemsService } from '../src/inventory/stock-items.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Unit test `StockItemsService` — Prisma mock. Canh ba thứ mock canh được: số truy vấn (không
 * N+1), không lệnh ghi nào, và luật tập sản phẩm/sắp xếp. Phép SUM + LEFT JOIN thật đo ở lane
 * DB (`stock-items.db.integration.spec.ts`).
 */
describe('StockItemsService', () => {
  const productRepo = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  };
  const stockItemRepo = {
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  };
  const stockMovementRepo = {
    groupBy: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const transaction = jest.fn();
  const prisma = {
    product: productRepo,
    stockItem: stockItemRepo,
    stockMovement: stockMovementRepo,
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new StockItemsService(prisma);

  function sanPham(
    id: string,
    name: string,
    opts: {
      tracksStock?: boolean;
      isActive?: boolean;
      stockItem?: { id: string; onHand: number } | null;
    } = {},
  ) {
    return {
      id,
      name,
      sku: `SKU-${id}`,
      unit: 'tấm',
      tracksStock: opts.tracksStock ?? true,
      isActive: opts.isActive ?? true,
      stockItem: opts.stockItem ?? null,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    stockMovementRepo.groupBy.mockResolvedValue([]);
  });

  it('gom reserved bằng ĐÚNG một groupBy cho cả tập và một findMany sản phẩm', async () => {
    productRepo.findMany.mockResolvedValue([
      sanPham('p1', 'A', { stockItem: { id: 's1', onHand: 5 } }),
      sanPham('p2', 'B', { stockItem: { id: 's2', onHand: 1 } }),
      sanPham('p3', 'C'),
    ]);
    stockMovementRepo.groupBy.mockResolvedValue([
      { stockItemId: 's1', _sum: { qty: 20 } },
    ]);

    await service.lietKeTonKho({});

    expect(productRepo.findMany).toHaveBeenCalledTimes(1);
    expect(stockMovementRepo.groupBy).toHaveBeenCalledTimes(1);
    expect(stockMovementRepo.groupBy).toHaveBeenCalledWith({
      by: ['stockItemId'],
      where: { stockItemId: { in: ['s1', 's2'] } },
      _sum: { qty: true },
    });
  });

  it('không gọi lệnh ghi nào, không mở transaction', async () => {
    productRepo.findMany.mockResolvedValue([
      sanPham('p1', 'A', { stockItem: { id: 's1', onHand: 5 } }),
    ]);

    await service.lietKeTonKho({ q: 'a' });

    for (const repo of [productRepo, stockItemRepo, stockMovementRepo]) {
      for (const [ten, fn] of Object.entries(repo)) {
        if (ten === 'findMany' || ten === 'groupBy') continue;
        expect(fn).not.toHaveBeenCalled();
      }
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it('ghép số qua tinhTonKho: vắng stock_items ⇒ 0/0, vắng movement ⇒ reserved 0', async () => {
    productRepo.findMany.mockResolvedValue([
      sanPham('p1', 'A', { stockItem: { id: 's1', onHand: 5 } }),
      sanPham('p2', 'B', { stockItem: { id: 's2', onHand: 3 } }),
      sanPham('p3', 'C'),
    ]);
    stockMovementRepo.groupBy.mockResolvedValue([
      { stockItemId: 's1', _sum: { qty: 20 } },
      { stockItemId: 's2', _sum: { qty: null } },
    ]);

    const { items } = await service.lietKeTonKho({});

    expect(items).toEqual([
      {
        productId: 'p1',
        ten: 'A',
        sku: 'SKU-p1',
        donVi: 'tấm',
        onHand: 5,
        reserved: 20,
        khaDung: -15,
        canNhap: 15,
        tinhTrang: 'am',
      },
      expect.objectContaining({
        productId: 'p2',
        onHand: 3,
        reserved: 0,
        khaDung: 3,
        tinhTrang: 'du',
      }),
      expect.objectContaining({
        productId: 'p3',
        onHand: 0,
        reserved: 0,
        khaDung: 0,
        canNhap: 0,
        tinhTrang: 'het',
      }),
    ]);
    expect(items[0]).not.toHaveProperty('costPrice');
  });

  it('sản phẩm ẩn/không theo dõi chỉ hiện khi còn số khác 0', async () => {
    productRepo.findMany.mockResolvedValue([
      sanPham('an-con-hang', 'A', {
        isActive: false,
        stockItem: { id: 's1', onHand: 4 },
      }),
      sanPham('an-con-hua', 'B', {
        isActive: false,
        stockItem: { id: 's2', onHand: 0 },
      }),
      sanPham('an-het-sach', 'C', {
        isActive: false,
        stockItem: { id: 's3', onHand: 0 },
      }),
      sanPham('dich-vu-trong', 'D', {
        tracksStock: false,
        stockItem: { id: 's4', onHand: 0 },
      }),
      sanPham('dang-ban-trong', 'E'),
    ]);
    stockMovementRepo.groupBy.mockResolvedValue([
      { stockItemId: 's2', _sum: { qty: 2 } },
    ]);

    const { items } = await service.lietKeTonKho({});

    expect(items.map((i) => i.productId)).toEqual([
      'an-con-hang',
      'an-con-hua',
      'dang-ban-trong',
    ]);
  });

  it('truy vấn sản phẩm: lọc tập theo dõi, q theo tên/SKU, productIds, sắp theo tên', async () => {
    productRepo.findMany.mockResolvedValue([]);

    await service.lietKeTonKho({ q: 'pin', productIds: ['p1', 'p2'] });

    expect(productRepo.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { tracksStock: true, isActive: true },
              { stockItem: { isNot: null } },
            ],
          },
          {
            OR: [
              { name: { contains: 'pin', mode: 'insensitive' } },
              { sku: { contains: 'pin', mode: 'insensitive' } },
            ],
          },
          { id: { in: ['p1', 'p2'] } },
        ],
      },
      include: { stockItem: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('q có ký tự đại diện LIKE ⇒ escape để khớp nguyên văn', async () => {
    productRepo.findMany.mockResolvedValue([]);

    await service.lietKeTonKho({ q: 'INV_8K 50% a\\b' });

    const arg = productRepo.findMany.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    const q = 'INV\\_8K 50\\% a\\\\b';
    expect(arg.where.AND[1]).toEqual({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ],
    });
  });

  it('không q, không productIds ⇒ chỉ còn điều kiện tập theo dõi', async () => {
    productRepo.findMany.mockResolvedValue([]);

    await service.lietKeTonKho({});

    const arg = productRepo.findMany.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    expect(arg.where.AND).toHaveLength(1);
  });

  it('danhSachCanMua: chỉ món khả dụng âm, canNhap giảm dần rồi theo tên', async () => {
    productRepo.findMany.mockResolvedValue([
      sanPham('p1', 'Ắc quy', { stockItem: { id: 's1', onHand: 0 } }),
      sanPham('p2', 'Inverter', { stockItem: { id: 's2', onHand: 2 } }),
      sanPham('p3', 'Pin', { stockItem: { id: 's3', onHand: 1 } }),
      sanPham('p4', 'Tủ điện', { stockItem: { id: 's4', onHand: 9 } }),
    ]);
    stockMovementRepo.groupBy.mockResolvedValue([
      { stockItemId: 's1', _sum: { qty: 3 } },
      { stockItemId: 's2', _sum: { qty: 12 } },
      { stockItemId: 's3', _sum: { qty: 4 } },
      { stockItemId: 's4', _sum: { qty: 9 } },
    ]);

    const { danhSachCanMua } = await service.lietKeTonKho({});

    expect(danhSachCanMua).toEqual([
      { productId: 'p2', ten: 'Inverter', donVi: 'tấm', canNhap: 10 },
      { productId: 'p1', ten: 'Ắc quy', donVi: 'tấm', canNhap: 3 },
      { productId: 'p3', ten: 'Pin', donVi: 'tấm', canNhap: 3 },
    ]);
  });
});
