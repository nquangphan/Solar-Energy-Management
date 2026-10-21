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
    stockVoucher: { create: jest.fn() },
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
      ma: 'PK-N-0007',
      type: 'nhap',
      soDong: 1,
      tongSoLuong: 40,
      nguoiTao: { id: ACCOUNT_ID, displayName: 'Thủ kho' },
    });
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
    expect(res.body.ma).toBe('PK-X-0007');
    expect(res.body.lines[0].unitCost).toBe(2_000_000);
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

  it('xuất quá tồn ⇒ 409 CONFLICT, fieldErrors[0].code = INSUFFICIENT_STOCK, không ghi gì', async () => {
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
    expect(auditRepo.create).not.toHaveBeenCalled();
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
        ma: 'PK-N-0007',
        type: 'nhap',
        createdAt: '2026-10-21T03:00:00.000Z',
        nguoiTao: { id: ACCOUNT_ID, displayName: 'Thủ kho' },
        soDong: 2,
        tongSoLuong: 45,
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
    expect(resKho.body).toMatchObject({ note: null, ma: 'PK-N-0007' });
    expect(resKho.body.lines[0]).toEqual({
      productId: P1,
      ten: 'Tấm pin 550W',
      sku: 'PIN-550',
      donVi: 'tấm',
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
});
