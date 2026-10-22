import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { ErrorCode } from '../src/common/errors/error-code';
import { PrismaService } from '../src/prisma/prisma.service';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` đọc secret lúc import module ⇒ set env TRƯỚC khi nạp `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `/stock-vouchers` (hermetic — override `PrismaService`, ký JWT thật). Phủ thứ chỉ sống ở
 * tầng HTTP: gate `inventory.manage` theo preset thật, `ValidationPipe` thật (luật `unitCost`
 * theo loại phiếu, lặp sản phẩm…), mã HTTP của lỗi nghiệp vụ, và che `unitCost` theo
 * `costs.view`.
 */
describe('/stock-vouchers (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-kho-1';
  const P1 = '11111111-1111-4111-8111-111111111111';
  const P2 = '22222222-2222-4222-8222-222222222222';
  const VOUCHER_ID = '33333333-3333-4333-8333-333333333333';
  const account = {
    id: ACCOUNT_ID,
    email: 'kho@example.com',
    displayName: 'Thủ kho',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function phieuRow(
    type: string,
    lines: { productId: string; qty: number; unitCost: number }[],
  ) {
    return {
      id: VOUCHER_ID,
      seq: 7,
      type,
      note: null,
      createdAt: new Date('2026-10-21T03:00:00Z'),
      createdByAccountId: ACCOUNT_ID,
      createdBy: { id: ACCOUNT_ID, displayName: 'Thủ kho' },
      lines: lines.map((l, i) => ({
        id: `l-${i}`,
        stockVoucherId: VOUCHER_ID,
        ...l,
        product: { name: 'Tấm pin 550W', sku: 'PIN-550', unit: 'tấm' },
      })),
    };
  }

  const tx = {
    $queryRaw: jest.fn(),
    product: { findMany: jest.fn(), update: jest.fn() },
    stockItem: { upsert: jest.fn() },
    stockVoucher: { create: jest.fn(), findUnique: jest.fn() },
    order: { findUnique: jest.fn() },
    stockMovement: { create: jest.fn() },
  };
  const voucherRepo = { findMany: jest.fn(), findUnique: jest.fn() };
  // `auditLog` có mặt vì `AuditSubscriber` THẬT chạy trong `AppModule`.
  const auditRepo = { create: jest.fn() };
  const prismaMock = {
    stockVoucher: voucherRepo,
    auditLog: auditRepo,
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const accountsMock = {
    findById: jest.fn((id: string) => (id === ACCOUNT_ID ? account : null)),
  };
  const accountPermissionsMock = { listForAccount: jest.fn() };

  function givenPermissions(...keys: readonly string[]): void {
    accountPermissionsMock.listForAccount.mockResolvedValue(new Set(keys));
  }

  function token(): string {
    return jwt.sign({ sub: ACCOUNT_ID, email: account.email });
  }

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function post(body: unknown) {
    return request(server())
      .post('/stock-vouchers')
      .set('Authorization', `Bearer ${token()}`)
      .send(body as object);
  }

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(AccountsService)
      .useValue(accountsMock)
      .overrideProvider(AccountPermissionsService)
      .useValue(accountPermissionsMock)
      .compile();

    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);
    await initAppOnLoopback(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: P1 }]);
    tx.product.findMany.mockResolvedValue([
      {
        id: P1,
        name: 'Tấm pin 550W',
        sku: 'PIN-550',
        unit: 'tấm',
        price: 3_000_000,
        costPrice: 2_000_000,
        tracksStock: true,
        isActive: true,
        stockItem: { id: 's1', productId: P1, onHand: 5 },
      },
    ]);
    tx.stockVoucher.create.mockImplementation(
      (args: {
        data: {
          type: string;
          lines: {
            create: { productId: string; qty: number; unitCost: number }[];
          };
        };
      }) => Promise.resolve(phieuRow(args.data.type, args.data.lines.create)),
    );
    voucherRepo.findMany.mockResolvedValue([]);
    auditRepo.create.mockResolvedValue({});
    voucherRepo.findUnique.mockResolvedValue(
      phieuRow('nhap', [{ productId: P1, qty: 40, unitCost: 2_110_000 }]),
    );
  });

  const NHAP = {
    type: 'nhap',
    note: '  Tồn đầu kỳ  ',
    lines: [{ productId: P1, qty: 40, unitCost: 2_110_000 }],
  };

  it('không token ⇒ 401', async () => {
    const res = await request(server()).post('/stock-vouchers').send(NHAP);

    expect(res.status).toBe(401);
  });

  it('KHO_GIAO (inventory.manage, không costs.view) ⇒ 201, ghi được giá nhập nhưng body KHÔNG có unitCost', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);

    const res = await post(NHAP);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: VOUCHER_ID,
      code: 'PK-N-0007',
      type: 'nhap',
      lineCount: 1,
      totalQty: 40,
      createdBy: { id: ACCOUNT_ID, displayName: 'Thủ kho' },
    });
    for (const old of ['ma', 'soDong', 'tongSoLuong', 'nguoiTao']) {
      expect(res.body).not.toHaveProperty(old);
    }
    expect(res.body.lines[0]).toMatchObject({ productId: P1, qty: 40 });
    expect(res.body.lines[0]).not.toHaveProperty('unitCost');
    expect(JSON.stringify(res.body)).not.toContain('costPrice');
    // Giá nhập vẫn đi xuống DB nguyên vẹn; ghi chú được trim.
    expect(tx.stockVoucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          note: 'Tồn đầu kỳ',
          lines: { create: [{ productId: P1, qty: 40, unitCost: 2_110_000 }] },
        }),
      }),
    );
    // Audit qua event, đúng MỘT dòng, ghi sự thật đầy đủ (kể cả giá nhập).
    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create.mock.calls[0][0].data).toMatchObject({
      eventType: 'StockVoucherCreated',
      actorAccountId: ACCOUNT_ID,
      targetType: 'StockVoucher',
      targetId: VOUCHER_ID,
      after: {
        ma: 'PK-N-0007',
        lines: [
          {
            productId: P1,
            qty: 40,
            unitCost: 2_110_000,
            onHandTruoc: 5,
            onHandSau: 45,
          },
        ],
      },
    });
  });

  it('QUAN_LY (có costs.view) ⇒ 201 kèm unitCost', async () => {
    givenPermissions(...ROLE_PRESETS.QUAN_LY);

    const res = await post(NHAP);

    expect(res.status).toBe(201);
    expect(res.body.lines[0].unitCost).toBe(2_110_000);
  });

  it('xuất hợp lệ ⇒ 201, server tự đặt unitCost = giá vốn hiện hành', async () => {
    givenPermissions(...ROLE_PRESETS.QUAN_LY);

    const res = await post({
      type: 'xuat',
      lines: [{ productId: P1, qty: 2 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('PK-X-0007');
    expect(res.body.lines[0].unitCost).toBe(2_000_000);
  });

  it('a free-standing voucher cannot bind an order: body with orderId ⇒ 201, field stripped, voucher has no orderId', async () => {
    const res = await post({
      type: 'xuat',
      orderId: '44444444-4444-4444-8444-444444444444',
      lines: [{ productId: P1, qty: 2 }],
    });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('orderId');
    const data = (
      tx.stockVoucher.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(data).not.toHaveProperty('orderId');
    expect(data).not.toHaveProperty('orderVersionId');
  });

  it('THO_KS (quotes.create_edit, không inventory.manage) ⇒ 403 ở POST lẫn GET', async () => {
    givenPermissions(...ROLE_PRESETS.THO_KS);

    const resPost = await post(NHAP);
    const resList = await request(server())
      .get('/stock-vouchers')
      .set('Authorization', `Bearer ${token()}`);
    const resDetail = await request(server())
      .get(`/stock-vouchers/${VOUCHER_ID}`)
      .set('Authorization', `Bearer ${token()}`);

    for (const res of [resPost, resList, resDetail]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(voucherRepo.findMany).not.toHaveBeenCalled();
  });

  const BODY_SAI: [string, unknown, string, string?][] = [
    [
      'phiếu nhập thiếu unitCost',
      { type: 'nhap', lines: [{ productId: P1, qty: 1 }] },
      'lines.0.unitCost',
      'unitCostTheoLoaiPhieu',
    ],
    [
      'phiếu nhập unitCost lẻ',
      { type: 'nhap', lines: [{ productId: P1, qty: 1, unitCost: 1.5 }] },
      'lines.0.unitCost',
      'unitCostTheoLoaiPhieu',
    ],
    [
      'phiếu xuất có unitCost',
      { type: 'xuat', lines: [{ productId: P1, qty: 1, unitCost: 100 }] },
      'lines.0.unitCost',
      'unitCostTheoLoaiPhieu',
    ],
    [
      'qty = 0',
      { type: 'xuat', lines: [{ productId: P1, qty: 0 }] },
      'lines.0.qty',
    ],
    [
      'qty = 1.5',
      { type: 'xuat', lines: [{ productId: P1, qty: 1.5 }] },
      'lines.0.qty',
    ],
    ['lines rỗng', { type: 'xuat', lines: [] }, 'lines'],
    [
      'productId không phải UUID',
      { type: 'xuat', lines: [{ productId: 'abc', qty: 1 }] },
      'lines.0.productId',
    ],
    [
      'lặp productId',
      {
        type: 'xuat',
        lines: [
          { productId: P1, qty: 1 },
          { productId: P1, qty: 2 },
        ],
      },
      'lines',
      'DUPLICATE_PRODUCT',
    ],
    [
      'type nhaptra',
      { type: 'nhaptra', lines: [{ productId: P1, qty: 1 }] },
      'type',
    ],
    [
      'qty vượt 1_000_000',
      { type: 'xuat', lines: [{ productId: P1, qty: 1_000_001 }] },
      'lines.0.qty',
    ],
    [
      'phiếu nhập unitCost âm',
      { type: 'nhap', lines: [{ productId: P1, qty: 1, unitCost: -1 }] },
      'lines.0.unitCost',
      'unitCostTheoLoaiPhieu',
    ],
    [
      'phiếu nhập unitCost vượt Int32',
      {
        type: 'nhap',
        lines: [{ productId: P1, qty: 1, unitCost: 2_147_483_648 }],
      },
      'lines.0.unitCost',
      'unitCostTheoLoaiPhieu',
    ],
    [
      'ghi chú 501 ký tự',
      {
        type: 'xuat',
        note: 'a'.repeat(501),
        lines: [{ productId: P1, qty: 1 }],
      },
      'note',
    ],
    [
      'quá 100 dòng',
      {
        type: 'xuat',
        lines: Array.from({ length: 101 }, (_, i) => ({
          productId: `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`,
          qty: 1,
        })),
      },
      'lines',
    ],
  ];

  for (const [ten, body, field, code] of BODY_SAI) {
    it(`${ten} ⇒ 400 VALIDATION_ERROR ở ${field}, không mở tx`, async () => {
      givenPermissions(...ROLE_PRESETS.QUAN_LY);

      const res = await post(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.fieldErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining(code ? { field, code } : { field }),
        ]),
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  }

  it('stock-out beyond on-hand ⇒ 409 CONFLICT, fieldErrors[0].code = INSUFFICIENT_STOCK, nothing written, exactly 1 StockOutBlocked audit row', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);

    const res = await post({
      type: 'xuat',
      lines: [{ productId: P1, qty: 6 }],
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.CONFLICT);
    expect(res.body.message).toBe(
      'Không đủ tồn — không thể xuất quá số tồn hiện có.',
    );
    expect(res.body.fieldErrors[0]).toEqual({
      field: 'lines.0.qty',
      code: 'INSUFFICIENT_STOCK',
      message: 'Còn 5 tấm, không xuất được 6.',
    });
    expect(tx.stockItem.upsert).not.toHaveBeenCalled();
    expect(tx.stockVoucher.create).not.toHaveBeenCalled();
    // The refused attempt is itself the fact: one audit row via the subscriber, no target.
    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create.mock.calls[0][0]).toMatchObject({
      data: {
        eventType: 'StockOutBlocked',
        targetType: null,
        targetId: null,
        after: { lines: [{ productId: P1, qty: 6, onHand: 5 }] },
      },
    });
  });

  for (const [ten, co] of [
    ['không theo dõi tồn', { tracksStock: false }],
    ['đã ngừng bán', { isActive: false }],
  ] as const) {
    it(`nhập sản phẩm ${ten} ⇒ 409 CONFLICT, fieldErrors PRODUCT_NOT_STOCKABLE ở lines.0.productId`, async () => {
      givenPermissions(...ROLE_PRESETS.KHO_GIAO);
      const [sp] = (await tx.product.findMany()) as object[];
      tx.product.findMany.mockResolvedValue([{ ...sp, ...co }]);

      const res = await post(NHAP);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.CONFLICT);
      expect(res.body.fieldErrors).toEqual([
        expect.objectContaining({
          field: 'lines.0.productId',
          code: 'PRODUCT_NOT_STOCKABLE',
        }),
      ]);
      expect(tx.stockItem.upsert).not.toHaveBeenCalled();
      expect(tx.stockVoucher.create).not.toHaveBeenCalled();
    });
  }

  for (const preset of ['ADMIN', 'SUPER_ADMIN'] as const) {
    it(`${preset} ⇒ 201 ở POST, 200 ở GET`, async () => {
      givenPermissions(...ROLE_PRESETS[preset]);

      const resPost = await post(NHAP);
      const resList = await request(server())
        .get('/stock-vouchers')
        .set('Authorization', `Bearer ${token()}`);

      expect(resPost.status).toBe(201);
      expect(resList.status).toBe(200);
    });
  }

  for (const preset of ['KE_TOAN', 'THI_CONG'] as const) {
    it(`${preset} (không inventory.manage) ⇒ 403, không mở tx`, async () => {
      givenPermissions(...ROLE_PRESETS[preset]);

      const res = await post(NHAP);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  }

  it('sản phẩm không tồn tại ⇒ 404 NOT_FOUND', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);
    tx.$queryRaw.mockResolvedValue([]);

    const res = await post(NHAP);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('GET /stock-vouchers?type=nhap ⇒ 200, lọc theo loại, mới nhất trước, tối đa 100', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);
    voucherRepo.findMany.mockResolvedValue([
      {
        ...phieuRow('nhap', []),
        lines: [{ qty: 40 }, { qty: 5 }],
      },
    ]);

    const res = await request(server())
      .get('/stock-vouchers?type=nhap')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        id: VOUCHER_ID,
        code: 'PK-N-0007',
        type: 'nhap',
        createdAt: '2026-10-21T03:00:00.000Z',
        createdBy: { id: ACCOUNT_ID, displayName: 'Thủ kho' },
        lineCount: 2,
        totalQty: 45,
      },
    ]);
    expect(voucherRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'nhap' },
        orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }],
        take: 100,
      }),
    );
  });

  it('GET /stock-vouchers?type=nhaptra ⇒ 400', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);

    const res = await request(server())
      .get('/stock-vouchers?type=nhaptra')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('GET /stock-vouchers/:id — KHO_GIAO không thấy unitCost, QUAN_LY thấy', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);
    const resKho = await request(server())
      .get(`/stock-vouchers/${VOUCHER_ID}`)
      .set('Authorization', `Bearer ${token()}`);
    givenPermissions(...ROLE_PRESETS.QUAN_LY);
    const resQl = await request(server())
      .get(`/stock-vouchers/${VOUCHER_ID}`)
      .set('Authorization', `Bearer ${token()}`);

    expect(resKho.status).toBe(200);
    expect(resKho.body).toMatchObject({ note: null, code: 'PK-N-0007' });
    expect(resKho.body.lines[0]).toEqual({
      productId: P1,
      name: 'Tấm pin 550W',
      sku: 'PIN-550',
      unit: 'tấm',
      qty: 40,
    });
    expect(resQl.body.lines[0].unitCost).toBe(2_110_000);
  });

  it('GET /stock-vouchers/khong-phai-uuid ⇒ 400', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);

    const res = await request(server())
      .get('/stock-vouchers/khong-phai-uuid')
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(voucherRepo.findUnique).not.toHaveBeenCalled();
  });

  it('GET /stock-vouchers/<uuid lạ> ⇒ 404', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);
    voucherRepo.findUnique.mockResolvedValue(null);

    const res = await request(server())
      .get(`/stock-vouchers/${P2}`)
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(ErrorCode.NOT_FOUND);
  });
  describe('POST /stock-vouchers/:id/return — return voucher from a cancelled order', () => {
    const ORIGIN_ID = '55555555-5555-4555-8555-555555555555';
    const ORDER_ID = '66666666-6666-4666-8666-666666666666';

    function postReturn(body: unknown, id: string = ORIGIN_ID) {
      return request(server())
        .post(`/stock-vouchers/${id}/return`)
        .set('Authorization', `Bearer ${token()}`)
        .send(body as object);
    }

    function origin(o: { type?: string; orderId?: string | null } = {}) {
      return {
        id: ORIGIN_ID,
        seq: 96,
        type: o.type ?? 'xuat',
        orderId: o.orderId === undefined ? ORDER_ID : o.orderId,
        lines: [
          {
            productId: P1,
            qty: 12,
            unitCost: 1_000_000,
            product: { unit: 'tấm' },
          },
          { productId: P2, qty: 2, unitCost: 300_000, product: { unit: 'bộ' } },
        ],
      };
    }

    function given(
      o: {
        origin?: ReturnType<typeof origin> | null;
        existingReturn?: { seq: number; type: string } | null;
        orderStatus?: string;
      } = {},
    ) {
      tx.stockVoucher.findUnique.mockImplementation(
        (args: { where: { id?: string } }) =>
          Promise.resolve(
            args.where.id !== undefined
              ? o.origin === undefined
                ? origin()
                : o.origin
              : (o.existingReturn ?? null),
          ),
      );
      tx.order.findUnique.mockResolvedValue({ status: o.orderStatus ?? 'huy' });
    }

    beforeEach(() => {
      givenPermissions(...ROLE_PRESETS.KHO_GIAO);
      tx.product.findMany.mockResolvedValue([
        {
          id: P1,
          name: 'Tấm pin 550W',
          unit: 'tấm',
          costPrice: 1_200_000,
          tracksStock: true,
          isActive: true,
          stockItem: { id: 's1', productId: P1, onHand: 8 },
        },
      ]);
      tx.stockVoucher.create.mockImplementation(
        (args: {
          data: {
            type: string;
            returnOfVoucherId: string;
            lines: {
              create: { productId: string; qty: number; unitCost: number }[];
            };
          };
        }) =>
          Promise.resolve({
            ...phieuRow(args.data.type, args.data.lines.create),
            seq: 4,
            orderId: null,
            returnOfVoucherId: args.data.returnOfVoucherId,
            order: null,
            returnOf: {
              id: ORIGIN_ID,
              seq: 96,
              type: 'xuat',
              orderId: ORDER_ID,
            },
            returnVoucher: null,
          }),
      );
      given();
    });

    it('KHO_GIAO ⇒ 201: PK-NT code, origin link, no top-level orderId, no unitCost in the body; a client unitCost is stripped', async () => {
      const res = await postReturn({
        note: '  2 tấm nứt  ',
        lines: [{ productId: P1, qty: 10, unitCost: 1 }],
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        code: 'PK-NT-0004',
        type: 'nhap',
        returnOfVoucherId: ORIGIN_ID,
        returnOf: { id: ORIGIN_ID, code: 'PK-X-0096', orderId: ORDER_ID },
        canReturn: false,
      });
      expect(res.body.returnOf).not.toHaveProperty('ma');
      expect(res.body).not.toHaveProperty('orderId');
      expect(res.body.lines[0]).not.toHaveProperty('unitCost');
      // The line cost is the ORIGIN line's, not the client's 1.
      expect(tx.stockVoucher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            note: '2 tấm nứt',
            returnOfVoucherId: ORIGIN_ID,
            lines: {
              create: [{ productId: P1, qty: 10, unitCost: 1_000_000 }],
            },
          }),
        }),
      );
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
      // Audit through the event: exactly ONE row, linking the origin and the cancelled order.
      expect(auditRepo.create).toHaveBeenCalledTimes(1);
      expect(auditRepo.create.mock.calls[0][0].data).toMatchObject({
        eventType: 'StockVoucherCreated',
        targetType: 'StockVoucher',
        after: {
          ma: 'PK-NT-0004',
          returnOfVoucherId: ORIGIN_ID,
          orderId: ORDER_ID,
          lines: [
            {
              productId: P1,
              qty: 10,
              unitCost: 1_000_000,
              onHandTruoc: 8,
              onHandSau: 18,
            },
          ],
        },
      });
    });

    it('QUAN_LY (costs.view) ⇒ 201 with the origin unitCost', async () => {
      givenPermissions(...ROLE_PRESETS.QUAN_LY);

      const res = await postReturn({ lines: [{ productId: P1, qty: 12 }] });

      expect(res.status).toBe(201);
      expect(res.body.lines[0].unitCost).toBe(1_000_000);
    });

    it.each<[string, unknown, string]>([
      ['empty lines', { lines: [] }, 'lines'],
      ['qty 0', { lines: [{ productId: P1, qty: 0 }] }, 'lines.0.qty'],
      [
        'fractional qty',
        { lines: [{ productId: P1, qty: 1.5 }] },
        'lines.0.qty',
      ],
      [
        'productId not a UUID',
        { lines: [{ productId: 'abc', qty: 1 }] },
        'lines.0.productId',
      ],
      [
        'note over 500 chars',
        { note: 'x'.repeat(501), lines: [{ productId: P1, qty: 1 }] },
        'note',
      ],
    ])('%s ⇒ 400 VALIDATION_ERROR at %s, no tx', async (_name, body, field) => {
      const res = await postReturn(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(
        res.body.fieldErrors.map((f: { field: string }) => f.field),
      ).toContain(field);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it(':id not a UUID ⇒ 400, no tx', async () => {
      const res = await postReturn(
        { lines: [{ productId: P1, qty: 1 }] },
        'abc',
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(res.body.message).toBe('Mã định danh không hợp lệ.');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it.each<
      [
        string,
        Parameters<typeof given>[0],
        unknown,
        number,
        string,
        string?,
        string?,
      ]
    >([
      [
        'origin missing',
        { origin: null },
        { lines: [{ productId: P1, qty: 1 }] },
        404,
        ErrorCode.NOT_FOUND,
        undefined,
        undefined,
      ],
      [
        'origin is a free-standing stock-in',
        { origin: origin({ type: 'nhap', orderId: null }) },
        { lines: [{ productId: P1, qty: 1 }] },
        409,
        ErrorCode.CONFLICT,
        undefined,
        undefined,
      ],
      [
        'origin is a free-standing stock-out',
        { origin: origin({ orderId: null }) },
        { lines: [{ productId: P1, qty: 1 }] },
        409,
        ErrorCode.CONFLICT,
        undefined,
        undefined,
      ],
      [
        'order not cancelled',
        { orderStatus: 'dacoc' },
        { lines: [{ productId: P1, qty: 1 }] },
        409,
        ErrorCode.CONFLICT,
        undefined,
        undefined,
      ],
      [
        'already returned',
        { existingReturn: { seq: 4, type: 'nhap' } },
        { lines: [{ productId: P1, qty: 1 }] },
        409,
        ErrorCode.CONFLICT,
        undefined,
        undefined,
      ],
      [
        'duplicate product',
        {},
        {
          lines: [
            { productId: P1, qty: 1 },
            { productId: P1, qty: 2 },
          ],
        },
        400,
        ErrorCode.VALIDATION_ERROR,
        'lines.1.productId',
        'DUPLICATE_PRODUCT',
      ],
      [
        'product not on the origin',
        {},
        {
          lines: [
            { productId: '77777777-7777-4777-8777-777777777777', qty: 1 },
          ],
        },
        400,
        ErrorCode.VALIDATION_ERROR,
        'lines.0.productId',
        'NOT_ON_ORIGIN_VOUCHER',
      ],
      [
        'more than issued',
        {},
        { lines: [{ productId: P1, qty: 13 }] },
        400,
        ErrorCode.VALIDATION_ERROR,
        'lines.0.qty',
        'RETURN_EXCEEDS_ISSUED',
      ],
    ])(
      '%s ⇒ refused with the envelope, nothing written, no audit',
      async (_name, state, body, status, code, field, fieldCode) => {
        given(state);

        const res = await postReturn(body);

        expect(res.status).toBe(status);
        expect(res.body.code).toBe(code);
        expect(typeof res.body.traceId).toBe('string');
        if (field) {
          expect(res.body.fieldErrors).toEqual([
            expect.objectContaining({ field, code: fieldCode }),
          ]);
        }
        expect(tx.stockItem.upsert).not.toHaveBeenCalled();
        expect(tx.product.update).not.toHaveBeenCalled();
        expect(tx.stockVoucher.create).not.toHaveBeenCalled();
        expect(auditRepo.create).not.toHaveBeenCalled();
      },
    );

    it('already returned ⇒ the message names the PK-NT voucher', async () => {
      given({ existingReturn: { seq: 4, type: 'nhap' } });

      const res = await postReturn({ lines: [{ productId: P1, qty: 1 }] });

      expect(res.body.message).toContain('PK-NT-0004');
    });

    it('THO_KS (no inventory.manage) ⇒ 403, no tx', async () => {
      givenPermissions(...ROLE_PRESETS.THO_KS);

      const res = await postReturn({ lines: [{ productId: P1, qty: 1 }] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('GET /stock-vouchers — return voucher filter and fields', () => {
    const ORIGIN_ID = '55555555-5555-4555-8555-555555555555';

    function list(query: string) {
      return request(server())
        .get(`/stock-vouchers${query}`)
        .set('Authorization', `Bearer ${token()}`);
    }

    beforeEach(() => givenPermissions(...ROLE_PRESETS.KHO_GIAO));

    it('?isReturn=true ⇒ only return vouchers; the summary carries returnOfVoucherId and a PK-NT code', async () => {
      voucherRepo.findMany.mockResolvedValue([
        {
          ...phieuRow('nhap', []),
          seq: 4,
          returnOfVoucherId: ORIGIN_ID,
          lines: [{ qty: 10 }],
        },
      ]);

      const res = await list('?isReturn=true');

      expect(res.status).toBe(200);
      expect(voucherRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { returnOfVoucherId: { not: null } },
        }),
      );
      expect(res.body.items[0]).toMatchObject({
        code: 'PK-NT-0004',
        returnOfVoucherId: ORIGIN_ID,
      });
    });

    it('?type=nhap&isReturn=false ⇒ plain stock-ins only; a summary without a return link omits the key', async () => {
      voucherRepo.findMany.mockResolvedValue([
        {
          ...phieuRow('nhap', []),
          returnOfVoucherId: null,
          lines: [{ qty: 1 }],
        },
      ]);

      const res = await list('?type=nhap&isReturn=false');

      expect(res.status).toBe(200);
      expect(voucherRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'nhap', returnOfVoucherId: null },
        }),
      );
      expect(res.body.items[0]).not.toHaveProperty('returnOfVoucherId');
    });

    it('no filter ⇒ no return condition', async () => {
      await list('');

      expect(voucherRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('detail of a return voucher without costs.view ⇒ origin link, no top-level orderId, no unitCost, canReturn false', async () => {
      voucherRepo.findUnique.mockResolvedValue({
        ...phieuRow('nhap', [{ productId: P1, qty: 10, unitCost: 1_000_000 }]),
        seq: 4,
        orderId: null,
        returnOfVoucherId: ORIGIN_ID,
        order: null,
        returnOf: {
          id: ORIGIN_ID,
          seq: 96,
          type: 'xuat',
          orderId: '66666666-6666-4666-8666-666666666666',
        },
        returnVoucher: null,
      });

      const res = await list(`/${VOUCHER_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        code: 'PK-NT-0004',
        type: 'nhap',
        returnOfVoucherId: ORIGIN_ID,
        returnOf: {
          id: ORIGIN_ID,
          code: 'PK-X-0096',
          orderId: '66666666-6666-4666-8666-666666666666',
        },
        canReturn: false,
      });
      expect(res.body).not.toHaveProperty('orderId');
      expect(res.body).not.toHaveProperty('returnVoucher');
      expect(res.body.lines[0]).not.toHaveProperty('unitCost');
      for (const old of ['ma', 'soDong', 'tongSoLuong', 'nguoiTao']) {
        expect(res.body).not.toHaveProperty(old);
      }
      expect(res.body.returnOf).not.toHaveProperty('ma');
    });

    it('?isReturn=maybe ⇒ 400', async () => {
      const res = await list('?isReturn=maybe');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it.each<[string, Record<string, unknown>, boolean]>([
      [
        'cancelled order, no return yet',
        { order: { status: 'huy' }, returnVoucher: null },
        true,
      ],
      [
        'live order',
        { order: { status: 'dacoc' }, returnVoucher: null },
        false,
      ],
      [
        'already returned',
        {
          order: { status: 'huy' },
          returnVoucher: { id: 'vr', seq: 4, type: 'nhap' },
        },
        false,
      ],
    ])(
      'detail of an order-bound stock-out: %s (%j) ⇒ canReturn %s',
      async (_name, rel, canReturn) => {
        voucherRepo.findUnique.mockResolvedValue({
          ...phieuRow('xuat', [
            { productId: P1, qty: 12, unitCost: 1_000_000 },
          ]),
          orderId: '66666666-6666-4666-8666-666666666666',
          returnOf: null,
          ...rel,
        });

        const res = await list(`/${VOUCHER_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.canReturn).toBe(canReturn);
        if (rel.returnVoucher) {
          expect(res.body.returnVoucher).toEqual({
            id: 'vr',
            code: 'PK-NT-0004',
          });
        } else {
          expect(res.body).not.toHaveProperty('returnVoucher');
        }
      },
    );
  });
});
