import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountPermissionsService } from '../src/accounts/account-permissions.service';
import { AccountsService } from '../src/accounts/accounts.service';
import { PERM } from '../src/accounts/domain/permission-registry';
import { ROLE_PRESETS } from '../src/accounts/domain/role-presets';
import { ErrorCode } from '../src/common/errors/error-code';
import { PrismaService } from '../src/prisma/prisma.service';
import { initAppOnLoopback } from './util/listen-loopback';

/** `JwtModule.register` đọc secret lúc import module ⇒ set env TRƯỚC khi nạp `AppModule`. */
const TEST_JWT_SECRET = 'test-jwt-access-secret-0123456789abcdef';
process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

/**
 * e2e `GET /stock-items` (hermetic — override `PrismaService`, ký JWT thật). Phủ thứ chỉ sống
 * ở tầng HTTP: gate OR theo preset vai trò thật, `ValidationPipe` thật cho `productIds`, và
 * hình dạng body (không rò giá vốn).
 */
describe('GET /stock-items (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  const ACCOUNT_ID = 'acc-stock-1';
  const account = {
    id: ACCOUNT_ID,
    email: 'kho@example.com',
    displayName: 'Thủ kho',
    passwordHash: 'argon2-secret-hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const productRepo = { findMany: jest.fn() };
  const stockMovementRepo = { groupBy: jest.fn() };
  const prismaMock = {
    product: productRepo,
    stockMovement: stockMovementRepo,
    // The read path runs both queries in one array-form `$transaction`.
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
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
    productRepo.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Tấm pin 550W',
        sku: 'PIN-550',
        unit: 'tấm',
        price: 2_500_000,
        costPrice: 1_900_000,
        tracksStock: true,
        isActive: true,
        stockItem: { id: 's1', productId: 'p1', onHand: 5 },
      },
    ]);
    stockMovementRepo.groupBy.mockResolvedValue([
      { stockItemId: 's1', _sum: { qty: 20 } },
    ]);
  });

  it('không token ⇒ 401', async () => {
    const res = await request(server()).get('/stock-items');

    expect(res.status).toBe(401);
  });

  for (const role of ['KE_TOAN', 'THI_CONG'] as const) {
    it(`${role} (không inventory.manage, không quotes.create_edit) ⇒ 403 FORBIDDEN`, async () => {
      givenPermissions(...ROLE_PRESETS[role]);

      const res = await request(server())
        .get('/stock-items')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.FORBIDDEN);
      expect(productRepo.findMany).not.toHaveBeenCalled();
    });
  }

  // Gate là OR: MỘT trong hai key là đủ — preset vai trò có thể mang cả hai nên đo bằng key lẻ.
  for (const key of [PERM.inventoryManage, PERM.quotesCreateEdit]) {
    it(`chỉ có ${key} ⇒ 200`, async () => {
      givenPermissions(key);

      const res = await request(server())
        .get('/stock-items')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(productRepo.findMany).toHaveBeenCalledTimes(1);
    });
  }

  for (const role of ['ADMIN', 'QUAN_LY', 'SUPER_ADMIN'] as const) {
    it(`${role} ⇒ 200`, async () => {
      givenPermissions(...ROLE_PRESETS[role]);

      const res = await request(server())
        .get('/stock-items')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
    });
  }

  it('q dài hơn 100 ký tự ⇒ 400 VALIDATION_ERROR ở field q', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);

    const res = await request(server())
      .get('/stock-items')
      .query({ q: 'a'.repeat(101) })
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.fieldErrors[0].field).toBe('q');
    expect(productRepo.findMany).not.toHaveBeenCalled();
  });

  for (const role of ['KHO_GIAO', 'THO_KS'] as const) {
    it(`${role} ⇒ 200 với items + danhSachCanMua, không có giá vốn`, async () => {
      givenPermissions(...ROLE_PRESETS[role]);

      const res = await request(server())
        .get('/stock-items')
        .set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [
          {
            productId: 'p1',
            ten: 'Tấm pin 550W',
            sku: 'PIN-550',
            donVi: 'tấm',
            onHand: 5,
            reserved: 20,
            khaDung: -15,
            canNhap: 15,
            tinhTrang: 'am',
          },
        ],
        danhSachCanMua: [
          { productId: 'p1', ten: 'Tấm pin 550W', donVi: 'tấm', canNhap: 15 },
        ],
      });
      expect(JSON.stringify(res.body)).not.toContain('costPrice');
    });
  }

  it('productIds có phần tử không phải UUID ⇒ 400 VALIDATION_ERROR kèm fieldErrors', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);

    const res = await request(server())
      .get('/stock-items')
      .query({ productIds: 'khong-phai-uuid' })
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.fieldErrors[0].field).toBe('productIds');
    expect(productRepo.findMany).not.toHaveBeenCalled();
  });

  it('productIds CSV hợp lệ + q ⇒ tách thành mảng UUID và trim q trước khi xuống service', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);
    const a = '3f1c9d2e-8b7a-4c6d-9e5f-1a2b3c4d5e6f';
    const b = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

    const res = await request(server())
      .get('/stock-items')
      .query({ productIds: `${a}, ${b}`, q: '  pin  ' })
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    const arg = productRepo.findMany.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    expect(arg.where.AND).toContainEqual({ id: { in: [a, b] } });
    expect(arg.where.AND).toContainEqual({
      OR: [
        { name: { contains: 'pin', mode: 'insensitive' } },
        { sku: { contains: 'pin', mode: 'insensitive' } },
      ],
    });
  });

  it('productIds lặp tham số ⇒ gộp mọi giá trị, vẫn tách CSV trong từng giá trị', async () => {
    givenPermissions(...ROLE_PRESETS.KHO_GIAO);
    const a = '3f1c9d2e-8b7a-4c6d-9e5f-1a2b3c4d5e6f';
    const b = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
    const c = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';

    const res = await request(server())
      .get(`/stock-items?productIds=${a}&productIds=${b},${c}`)
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    const arg = productRepo.findMany.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    expect(arg.where.AND).toContainEqual({ id: { in: [a, b, c] } });
  });
});
