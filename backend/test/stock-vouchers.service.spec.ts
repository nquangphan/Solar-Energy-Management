import type { Prisma } from '@prisma/client';
import type { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import { StockVoucherCreated } from '../src/inventory/domain/stock-voucher-events';
import { anGiaVonDongPhieu } from '../src/inventory/domain/stock-voucher-visibility';
import { tinhGiaVonBinhQuan } from '../src/inventory/domain/gia-von';
import {
  StockVouchersService,
  type TaoPhieuInput,
} from '../src/inventory/stock-vouchers.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Unit `StockVouchersService` (mock Prisma). Canh những thứ mock đo được còn lane DB thì không
 * cô lập được:
 *  1. THỨ TỰ OP — khoá `products … FOR UPDATE` là lệnh ĐẦU TIÊN trên `tx`, trước mọi đọc/ghi.
 *  2. Lỗi nghiệp vụ (xuất quá tồn, sản phẩm không nhập được) ⇒ KHÔNG lệnh ghi nào được gọi.
 *  3. Phiếu xuất không đổi giá vốn (`product.update` không được gọi).
 *  4. Event đúng MỘT lần, SAU commit; tx lỗi ⇒ 0 event (mock CHẠY thân tx rồi mới ném).
 */
describe('StockVouchersService', () => {
  const ACTOR = 'acc-kho';
  const P1 = '11111111-1111-4111-8111-111111111111';
  const P2 = '22222222-2222-4222-8222-222222222222';

  const thuTu: string[] = [];
  function ghiNhan<T>(ten: string, ketQua: T): jest.Mock {
    return jest.fn(() => {
      thuTu.push(ten);
      return Promise.resolve(ketQua);
    });
  }

  function sanPham(
    id: string,
    o: {
      onHand?: number | null;
      costPrice?: number;
      tracksStock?: boolean;
      isActive?: boolean;
    } = {},
  ) {
    return {
      id,
      name: `SP ${id.slice(0, 2)}`,
      sku: `SKU-${id.slice(0, 2)}`,
      unit: 'tấm',
      price: 3_000_000,
      costPrice: o.costPrice ?? 2_000_000,
      tracksStock: o.tracksStock ?? true,
      isActive: o.isActive ?? true,
      stockItem:
        o.onHand === null
          ? null
          : { id: `s-${id}`, productId: id, onHand: o.onHand ?? 10 },
    };
  }

  let tx: {
    $queryRaw: jest.Mock;
    product: { findMany: jest.Mock; update: jest.Mock };
    stockItem: { upsert: jest.Mock };
    stockVoucher: { create: jest.Mock };
  };
  let commitLoi: Error | null;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  let service: StockVouchersService;

  function phieuDaTao(
    type: string,
    lines: { productId: string; qty: number; unitCost: number }[],
  ) {
    return {
      id: 'v-1',
      seq: 119,
      type,
      note: null,
      createdAt: new Date('2026-10-21T03:00:00Z'),
      createdByAccountId: ACTOR,
      createdBy: { id: ACTOR, displayName: 'Thủ kho' },
      lines: lines.map((l, i) => ({
        id: `l-${i}`,
        stockVoucherId: 'v-1',
        ...l,
        product: {
          name: `SP ${l.productId.slice(0, 2)}`,
          sku: 'SKU',
          unit: 'tấm',
        },
      })),
    };
  }

  function chuanBi(products: ReturnType<typeof sanPham>[], type: string) {
    tx.$queryRaw = ghiNhan(
      '$queryRaw',
      products.map((p) => ({ id: p.id })),
    );
    tx.product.findMany = ghiNhan('product.findMany', products);
    tx.stockVoucher.create = jest.fn(
      (args: {
        data: {
          lines: {
            create: { productId: string; qty: number; unitCost: number }[];
          };
        };
      }) => {
        thuTu.push('stockVoucher.create');
        return Promise.resolve(phieuDaTao(type, args.data.lines.create));
      },
    );
  }

  beforeEach(() => {
    thuTu.length = 0;
    commitLoi = null;
    jest.clearAllMocks();
    tx = {
      $queryRaw: ghiNhan('$queryRaw', []),
      product: {
        findMany: ghiNhan('product.findMany', []),
        update: ghiNhan('product.update', {}),
      },
      stockItem: { upsert: ghiNhan('stockItem.upsert', {}) },
      stockVoucher: { create: ghiNhan('stockVoucher.create', {}) },
    };
    const prisma = {
      // Chạy THẬT thân tx rồi mới mô phỏng commit lỗi — mock reject thẳng sẽ không chạy thân và
      // test "publish sau commit" xanh giả.
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        const ketQua = await fn(tx);
        if (commitLoi) throw commitLoi;
        return ketQua;
      }),
    } as unknown as PrismaService;
    eventBus.publish.mockImplementation(() => {
      thuTu.push('publish');
      return Promise.resolve();
    });
    service = new StockVouchersService(prisma, eventBus as unknown as EventBus);
  });

  async function loiCua(p: Promise<unknown>): Promise<AppException> {
    try {
      await p;
    } catch (e) {
      return e as AppException;
    }
    throw new Error('mong đợi lỗi');
  }

  const NHAP: TaoPhieuInput = {
    type: 'nhap',
    note: 'Tồn đầu kỳ',
    lines: [
      { productId: P1, qty: 40, unitCost: 2_110_000 },
      { productId: P2, qty: 5, unitCost: 300 },
    ],
  };

  it('khoá products FOR UPDATE theo id là lệnh ĐẦU TIÊN trên tx, trước mọi đọc/ghi', async () => {
    chuanBi([sanPham(P1), sanPham(P2, { onHand: null })], 'nhap');

    await service.taoPhieu(NHAP, ACTOR);

    expect(thuTu[0]).toBe('$queryRaw');
    const [chuoi, ids] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string[],
    ];
    expect(chuoi.join('?')).toMatch(
      /SELECT id FROM products WHERE id = ANY\(\?\) ORDER BY id FOR UPDATE/,
    );
    expect(ids).toEqual([P1, P2]);
    expect(thuTu.indexOf('publish')).toBe(thuTu.length - 1);
  });

  it('nhập: upsert onHand cộng dồn, costPrice = bình quân gia quyền, dòng giữ unitCost người gõ', async () => {
    chuanBi(
      [
        sanPham(P1, { onHand: 10, costPrice: 2_000_000 }),
        sanPham(P2, { onHand: null, costPrice: 999 }),
      ],
      'nhap',
    );

    await service.taoPhieu(NHAP, ACTOR);

    expect(tx.stockItem.upsert).toHaveBeenCalledWith({
      where: { productId: P1 },
      create: { productId: P1, onHand: 50 },
      update: { onHand: 50 },
    });
    expect(tx.stockItem.upsert).toHaveBeenCalledWith({
      where: { productId: P2 },
      create: { productId: P2, onHand: 5 },
      update: { onHand: 5 },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: P1 },
      data: {
        costPrice: tinhGiaVonBinhQuan({
          onHandTruoc: 10,
          giaVonTruoc: 2_000_000,
          qtyNhap: 40,
          donGiaNhap: 2_110_000,
        }),
      },
    });
    // Chưa có hàng cũ ⇒ bỏ giá vốn gõ tay (999), lấy đúng giá nhập.
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: P2 },
      data: { costPrice: 300 },
    });
    const data = (
      tx.stockVoucher.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(data).toMatchObject({
      type: 'nhap',
      note: 'Tồn đầu kỳ',
      createdByAccountId: ACTOR,
      lines: {
        create: [
          { productId: P1, qty: 40, unitCost: 2_110_000 },
          { productId: P2, qty: 5, unitCost: 300 },
        ],
      },
    });
  });

  it('xuất: onHand giảm, KHÔNG gọi product.update, dòng xuất unitCost = giá vốn lúc xuất', async () => {
    chuanBi([sanPham(P1, { onHand: 10, costPrice: 2_088_000 })], 'xuat');

    await service.taoPhieu(
      { type: 'xuat', lines: [{ productId: P1, qty: 4 }] },
      ACTOR,
    );

    expect(tx.stockItem.upsert).toHaveBeenCalledWith({
      where: { productId: P1 },
      create: { productId: P1, onHand: 6 },
      update: { onHand: 6 },
    });
    expect(tx.product.update).not.toHaveBeenCalled();
    const data = (
      tx.stockVoucher.create.mock.calls[0][0] as {
        data: { lines: unknown; note: unknown };
      }
    ).data;
    expect(data.lines).toEqual({
      create: [{ productId: P1, qty: 4, unitCost: 2_088_000 }],
    });
    expect(data.note).toBeNull();
  });

  it('xuất sản phẩm đã ngừng bán/không theo dõi tồn mà còn hàng ⇒ vẫn xuất được', async () => {
    chuanBi(
      [sanPham(P1, { onHand: 3, tracksStock: false, isActive: false })],
      'xuat',
    );

    await service.taoPhieu(
      { type: 'xuat', lines: [{ productId: P1, qty: 3 }] },
      ACTOR,
    );

    expect(tx.stockItem.upsert).toHaveBeenCalledTimes(1);
  });

  it('xuất quá tồn (một dòng đủ, một dòng thiếu, một dòng chưa có sổ tồn) ⇒ 409 INSUFFICIENT_STOCK đúng dòng, KHÔNG lệnh ghi nào, 0 event', async () => {
    chuanBi([sanPham(P1, { onHand: 10 }), sanPham(P2, { onHand: 2 })], 'xuat');

    const loi = await loiCua(
      service.taoPhieu(
        {
          type: 'xuat',
          lines: [
            { productId: P1, qty: 10 },
            { productId: P2, qty: 3 },
          ],
        },
        ACTOR,
      ),
    );

    expect(loi.getStatus()).toBe(409);
    expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
    expect(loi.message).toBe(
      'Không đủ tồn — không thể xuất quá số tồn hiện có.',
    );
    expect(loi.fieldErrors).toEqual([
      {
        field: 'lines.1.qty',
        code: 'INSUFFICIENT_STOCK',
        message: 'Còn 2 tấm, không xuất được 3.',
      },
    ]);
    expect(tx.stockItem.upsert).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.stockVoucher.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('xuất sản phẩm chưa từng có sổ tồn ⇒ coi onHand = 0 ⇒ 409', async () => {
    chuanBi([sanPham(P1, { onHand: null })], 'xuat');

    const loi = await loiCua(
      service.taoPhieu(
        { type: 'xuat', lines: [{ productId: P1, qty: 1 }] },
        ACTOR,
      ),
    );

    expect(loi.getStatus()).toBe(409);
    expect(loi.fieldErrors?.[0]).toMatchObject({
      field: 'lines.0.qty',
      message: 'Còn 0 tấm, không xuất được 1.',
    });
  });

  for (const [ten, co] of [
    ['không theo dõi tồn', { tracksStock: false }],
    ['đã ngừng bán', { isActive: false }],
  ] as const) {
    it(`nhập sản phẩm ${ten} ⇒ 409 PRODUCT_NOT_STOCKABLE, KHÔNG lệnh ghi nào`, async () => {
      chuanBi([sanPham(P1), sanPham(P2, co)], 'nhap');

      const loi = await loiCua(service.taoPhieu(NHAP, ACTOR));

      expect(loi.getStatus()).toBe(409);
      expect(loi.fieldErrors).toEqual([
        expect.objectContaining({
          field: 'lines.1.productId',
          code: 'PRODUCT_NOT_STOCKABLE',
        }),
      ]);
      expect(tx.stockItem.upsert).not.toHaveBeenCalled();
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(tx.stockVoucher.create).not.toHaveBeenCalled();
    });
  }

  it('sản phẩm không tồn tại (khoá trả thiếu dòng) ⇒ 404, không đọc/ghi tiếp', async () => {
    chuanBi([sanPham(P1)], 'nhap');

    const loi = await loiCua(service.taoPhieu(NHAP, ACTOR));

    expect(loi.getStatus()).toBe(404);
    expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
    expect(loi.message).toContain(P2);
    expect(tx.product.findMany).not.toHaveBeenCalled();
    expect(tx.stockItem.upsert).not.toHaveBeenCalled();
  });

  it('event StockVoucherCreated đúng MỘT lần, sau commit, payload đủ tồn/giá vốn trước–sau', async () => {
    chuanBi(
      [
        sanPham(P1, { onHand: 10, costPrice: 2_000_000 }),
        sanPham(P2, { onHand: null, costPrice: 999 }),
      ],
      'nhap',
    );

    const ketQua = await service.taoPhieu(NHAP, ACTOR);

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const event = eventBus.publish.mock.calls[0][0] as StockVoucherCreated;
    expect(event).toBeInstanceOf(StockVoucherCreated);
    expect(event.type).toBe('StockVoucherCreated');
    expect(event.actorAccountId).toBe(ACTOR);
    expect(event.target).toEqual({ type: 'StockVoucher', id: 'v-1' });
    expect(event.after).toEqual({
      id: 'v-1',
      ma: 'PK-N-0119',
      type: 'nhap',
      note: null,
      lines: [
        {
          productId: P1,
          qty: 40,
          unitCost: 2_110_000,
          onHandTruoc: 10,
          onHandSau: 50,
          giaVonTruoc: 2_000_000,
          giaVonSau: tinhGiaVonBinhQuan({
            onHandTruoc: 10,
            giaVonTruoc: 2_000_000,
            qtyNhap: 40,
            donGiaNhap: 2_110_000,
          }),
        },
        {
          productId: P2,
          qty: 5,
          unitCost: 300,
          onHandTruoc: 0,
          onHandSau: 5,
          giaVonTruoc: 999,
          giaVonSau: 300,
        },
      ],
    });
    expect(ketQua).toMatchObject({
      id: 'v-1',
      ma: 'PK-N-0119',
      soDong: 2,
      tongSoLuong: 45,
    });
  });

  it('commit lỗi (thân tx đã chạy hết) ⇒ 0 event, lỗi nổi lên', async () => {
    chuanBi([sanPham(P1), sanPham(P2)], 'nhap');
    commitLoi = new Error('serialization failure');

    await expect(service.taoPhieu(NHAP, ACTOR)).rejects.toThrow(
      'serialization failure',
    );

    expect(tx.stockVoucher.create).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

/**
 * Order-bound stock-out primitive — runs INSIDE the caller's tx. Guards: the lock is the first
 * op on `tx`; it never opens/commits a tx, never publishes, never moves the average cost; short
 * stock ⇒ 0 writes; `reserved` is released by what is HELD, not by the issued `qty`.
 */
describe('StockVouchersService.issueForOrderInTx', () => {
  const ACTOR = 'acc-warehouse';
  const P1 = '11111111-1111-4111-8111-111111111111';
  const P2 = '22222222-2222-4222-8222-222222222222';
  const P3 = '33333333-3333-4333-8333-333333333333';
  const AT = new Date('2026-10-21T04:00:00Z');

  const calls: string[] = [];
  function recorded<T>(name: string, result: T): jest.Mock {
    return jest.fn(() => {
      calls.push(name);
      return Promise.resolve(result);
    });
  }

  function product(
    id: string,
    name: string,
    o: {
      onHand?: number | null;
      costPrice?: number;
      tracksStock?: boolean;
    } = {},
  ) {
    return {
      id,
      name,
      sku: `SKU-${id.slice(0, 2)}`,
      unit: 'tấm',
      costPrice: o.costPrice ?? 2_000_000,
      tracksStock: o.tracksStock ?? true,
      stockItem:
        o.onHand === null
          ? null
          : { id: `s-${id}`, productId: id, onHand: o.onHand ?? 10 },
    };
  }

  let tx: {
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
    product: { findMany: jest.Mock; update: jest.Mock };
    stockItem: { upsert: jest.Mock };
    stockMovement: { aggregate: jest.Mock; create: jest.Mock };
    stockVoucher: { create: jest.Mock };
  };
  const prisma = { $transaction: jest.fn() };
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = new StockVouchersService(
    prisma as unknown as PrismaService,
    eventBus as unknown as EventBus,
  );

  function given(products: ReturnType<typeof product>[], held = 0) {
    tx.$queryRaw = recorded(
      '$queryRaw',
      products.map((p) => ({ id: p.id })),
    );
    tx.product.findMany = recorded('product.findMany', products);
    tx.stockItem.upsert = jest.fn((args: { where: { productId: string } }) => {
      calls.push('stockItem.upsert');
      return Promise.resolve({ id: `s-${args.where.productId}` });
    });
    tx.stockMovement.aggregate = recorded('stockMovement.aggregate', {
      _sum: { qty: held },
    });
    tx.stockVoucher.create = jest.fn(
      (args: {
        data: {
          orderId: string;
          lines: {
            create: { productId: string; qty: number; unitCost: number }[];
          };
        };
      }) => {
        calls.push('stockVoucher.create');
        return Promise.resolve({
          id: 'v-9',
          seq: 96,
          type: 'xuat',
          note: null,
          orderId: args.data.orderId,
          createdAt: AT,
          createdBy: { id: ACTOR, displayName: 'Thủ kho' },
          lines: args.data.lines.create.map((l, i) => ({
            id: `l-${i}`,
            ...l,
            product: { name: 'SP', sku: 'SKU', unit: 'tấm' },
          })),
        });
      },
    );
  }

  function issue(orderLines: { productId: string; qty: number }[]) {
    return service.issueForOrderInTx(
      tx as unknown as Prisma.TransactionClient,
      {
        orderId: 'ord-1',
        orderVersionId: 'ver-1',
        orderLines,
        actorAccountId: ACTOR,
        occurredAt: AT,
      },
    );
  }

  beforeEach(() => {
    calls.length = 0;
    jest.clearAllMocks();
    tx = {
      $queryRaw: recorded('$queryRaw', []),
      $transaction: jest.fn(),
      product: {
        findMany: recorded('product.findMany', []),
        update: recorded('product.update', {}),
      },
      stockItem: { upsert: recorded('stockItem.upsert', {}) },
      stockMovement: {
        aggregate: recorded('stockMovement.aggregate', { _sum: { qty: null } }),
        create: recorded('stockMovement.create', {}),
      },
      stockVoucher: { create: recorded('stockVoucher.create', {}) },
    };
  });

  it('locks products FOR UPDATE as the FIRST op on tx; never opens a tx, never publishes, never moves the cost', async () => {
    given([product(P2, 'Tấm pin'), product(P1, 'Inverter')]);

    await issue([
      { productId: P2, qty: 4 },
      { productId: P1, qty: 1 },
      { productId: P2, qty: 2 },
    ]);

    expect(calls[0]).toBe('$queryRaw');
    const [sql, ids] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string[],
    ];
    expect(sql.join('?')).toMatch(
      /SELECT id FROM products WHERE id = ANY\(\?\) ORDER BY id FOR UPDATE/,
    );
    expect([...ids].sort()).toEqual([P1, P2]);
    expect(tx.$transaction).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('merges same-product lines, deducts onHand, order-bound xuat voucher, unitCost = costPrice read under the lock', async () => {
    given([
      product(P1, 'Tấm pin', { onHand: 10, costPrice: 2_088_000 }),
      product(P3, 'Công lắp', { tracksStock: false, onHand: null }),
    ]);

    const result = await issue([
      { productId: P1, qty: 4 },
      { productId: P3, qty: 1 },
      { productId: P1, qty: 2 },
    ]);

    expect(tx.stockItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.stockItem.upsert).toHaveBeenCalledWith({
      where: { productId: P1 },
      create: { productId: P1, onHand: 4 },
      update: { onHand: 4 },
    });
    expect(tx.stockVoucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'xuat',
          orderId: 'ord-1',
          orderVersionId: 'ver-1',
          createdByAccountId: ACTOR,
          lines: { create: [{ productId: P1, qty: 6, unitCost: 2_088_000 }] },
        }) as unknown,
      }),
    );
    expect([...result.costByProduct]).toEqual([[P1, 2_088_000]]);
    expect(result.voucher?.orderId).toBe('ord-1');
    expect(result.event?.type).toBe('StockIssued');
    expect(result.event?.actorAccountId).toBe(ACTOR);
    expect(result.event?.occurredAt).toBe(AT);
    expect(result.event?.target).toEqual({ type: 'StockVoucher', id: 'v-9' });
    expect(result.event?.after).toEqual({
      id: 'v-9',
      code: 'PK-X-0096',
      orderId: 'ord-1',
      orderVersionId: 'ver-1',
      lines: [
        {
          productId: P1,
          qty: 6,
          unitCost: 2_088_000,
          onHandBefore: 10,
          onHandAfter: 4,
          reservedReleased: 0,
        },
      ],
    });
  });

  it('short stock ⇒ 409 INSUFFICIENT_STOCK on `lines.{i}.qty` in canonical order, NO writes', async () => {
    given([
      product(P1, 'B Tấm pin', { onHand: 1 }),
      product(P2, 'A Inverter', { onHand: 5 }),
    ]);

    const err = await issue([
      { productId: P1, qty: 3 },
      { productId: P2, qty: 2 },
    ]).catch((e: AppException) => e);

    expect((err as AppException).getStatus()).toBe(409);
    expect((err as AppException).message).toBe(
      'Không đủ tồn — không thể xuất quá số tồn hiện có.',
    );
    expect((err as AppException).fieldErrors).toEqual([
      {
        field: 'lines.1.qty',
        code: 'INSUFFICIENT_STOCK',
        message: 'Còn 1 tấm, không xuất được 3.',
      },
    ]);
    expect(tx.stockItem.upsert).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.stockVoucher.create).not.toHaveBeenCalled();
  });

  it('no stock-tracked line ⇒ voucher null, empty map, event null, NO writes', async () => {
    given([product(P3, 'Công lắp', { tracksStock: false })]);

    const result = await issue([{ productId: P3, qty: 1 }]);

    expect(result.voucher).toBeNull();
    expect(result.event).toBeNull();
    expect(result.costByProduct.size).toBe(0);
    expect(tx.stockItem.upsert).not.toHaveBeenCalled();
    expect(tx.stockVoucher.create).not.toHaveBeenCalled();
  });

  it('no product line ⇒ no lock, no read, no write', async () => {
    const result = await issue([]);

    expect(result.voucher).toBeNull();
    expect(calls).toEqual([]);
  });

  it('unknown product ⇒ 404', async () => {
    tx.$queryRaw = recorded('$queryRaw', [{ id: P1 }]);

    const err = await issue([
      { productId: P1, qty: 1 },
      { productId: P2, qty: 1 },
    ]).catch((e: AppException) => e);

    expect((err as AppException).getStatus()).toBe(404);
    expect(tx.stockVoucher.create).not.toHaveBeenCalled();
  });

  it('releases reserved = what is HELD for the order (+5 ⇒ one −5 xuat movement), not the issued qty', async () => {
    given([product(P1, 'Tấm pin', { onHand: 10 })], 5);

    const result = await issue([{ productId: P1, qty: 8 }]);

    expect(tx.stockMovement.aggregate).toHaveBeenCalledWith({
      where: { orderId: 'ord-1', stockItemId: `s-${P1}` },
      _sum: { qty: true },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        stockItemId: `s-${P1}`,
        orderId: 'ord-1',
        orderVersionId: 'ver-1',
        qty: -5,
        type: 'xuat',
      },
    });
    expect(result.event?.after.lines[0].reservedReleased).toBe(5);
  });

  it.each([0, -3])(
    'held = %d ⇒ NO movement (never pushes reserved negative)',
    async (held) => {
      given([product(P1, 'Tấm pin', { onHand: 10 })], held);

      await issue([{ productId: P1, qty: 2 }]);

      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    },
  );

  describe('lockTrackedProductsInTx', () => {
    function tracked(ids: string[]) {
      return service.lockTrackedProductsInTx(
        tx as unknown as Prisma.TransactionClient,
        ids,
      );
    }

    it('locks products (same statement, de-duplicated ids) as the FIRST op, THEN reads tracksStock; writes nothing', async () => {
      tx.$queryRaw = recorded('$queryRaw', []);
      tx.product.findMany = recorded('product.findMany', [{ id: P1 }]);

      const result = await tracked([P2, P1, P2]);

      expect(calls).toEqual(['$queryRaw', 'product.findMany']);
      const [strings, ids] = tx.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        string[],
      ];
      expect(strings.join('?').replace(/\s+/g, ' ').trim()).toBe(
        'SELECT id FROM products WHERE id = ANY(?) ORDER BY id FOR UPDATE',
      );
      expect(ids).toEqual([P2, P1]);
      expect(tx.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: [P2, P1] }, tracksStock: true },
        select: { id: true },
      });
      expect([...result]).toEqual([P1]);
      expect(tx.$transaction).not.toHaveBeenCalled();
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(tx.stockItem.upsert).not.toHaveBeenCalled();
      expect(tx.stockVoucher.create).not.toHaveBeenCalled();
    });

    it('no product id ⇒ empty set, no query at all', async () => {
      const result = await tracked([]);

      expect(result.size).toBe(0);
      expect(calls).toEqual([]);
    });
  });
});

describe('anGiaVonDongPhieu', () => {
  const phieu = {
    id: 'v-1',
    lines: [{ productId: 'p1', qty: 2, unitCost: 2_000_000 }],
  };

  it('thiếu costs.view ⇒ mọi dòng mất HẲN key unitCost, object nguồn giữ nguyên', () => {
    const ketQua = anGiaVonDongPhieu(phieu, false);

    expect(ketQua.lines[0]).not.toHaveProperty('unitCost');
    expect(JSON.parse(JSON.stringify(ketQua)).lines[0]).not.toHaveProperty(
      'unitCost',
    );
    expect(phieu.lines[0].unitCost).toBe(2_000_000);
  });

  it('có costs.view ⇒ giữ unitCost', () => {
    expect(anGiaVonDongPhieu(phieu, true).lines[0].unitCost).toBe(2_000_000);
  });
});
