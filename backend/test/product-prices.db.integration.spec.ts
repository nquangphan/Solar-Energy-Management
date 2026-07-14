import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ProductPricesService } from '../src/catalog/product-prices.service';
import type { EventBus } from '../src/events/event-bus';
import type { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho bậc thang giá.
 *
 * Vì sao lane này phải tồn tại: `replace()` là atomic-replace (deleteMany + createMany trong một
 * `$transaction`), và `$transaction` MỘT MÌNH KHÔNG đủ để nó nguyên tử dưới cuộc đua — Postgres
 * chạy READ COMMITTED. Chỉ khoá `FOR UPDATE` trên dòng `products` mới bắt hai lệnh thay cùng một
 * sản phẩm NỐI ĐUÔI nhau. Mock Prisma không mô phỏng được isolation, nên bug đua chỉ hiện ra ở đây.
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB bậc thang giá: vắng DATABASE_URL. Chạy: npm run test:db',
  );
}

moTa('Ràng buộc tầng DB của product_prices (Postgres THẬT)', () => {
  let prisma: PrismaClient;
  let service: ProductPricesService;

  const ACTOR = 'acc-test';
  const SKU = 'ZZ-TEST-PRICE-SKU-A';

  // `replace()` chặn khi cờ giá phân tầng TẮT; lane này luôn coi như BẬT để đi vào đường atomic-replace.
  const coBatCo = {
    isEnabled: async () => true,
  } as unknown as FeatureFlagsService;
  const busGia = {
    publish: async () => {},
    subscribe: () => {},
  } as unknown as EventBus;

  /** Xoá theo chiều FK: bậc thang trước, rồi sản phẩm. */
  async function donDep(): Promise<void> {
    const sp = await prisma.product.findMany({
      where: { sku: { startsWith: 'ZZ-TEST-PRICE-SKU-' } },
      select: { id: true },
    });
    await prisma.productPrice.deleteMany({
      where: { productId: { in: sp.map((p) => p.id) } },
    });
    await prisma.product.deleteMany({
      where: { sku: { startsWith: 'ZZ-TEST-PRICE-SKU-' } },
    });
  }

  /** Chờ một nhịp — ép thứ tự trong ca kiểm khoá `FOR UPDATE`. */
  function doi(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function taoSanPham(): Promise<string> {
    const sp = await prisma.product.create({
      data: {
        name: 'Sản phẩm test giá',
        sku: SKU,
        unit: 'cái',
        price: 1_000_000,
        costPrice: 700_000,
      },
    });
    return sp.id;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new ProductPricesService(
      prisma as unknown as PrismaService,
      busGia,
      coBatCo,
    );
    await donDep();
  });

  afterEach(async () => {
    await donDep();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('atomic-replace trên Postgres thật', () => {
    it('mỗi bước thay SẠCH bậc thang cũ; bước RỖNG thật sự xoá hết (3 → 0 → 2)', async () => {
      // Chứng minh NGỮ NGHĨA thay-nguyên-khối end-to-end trên Postgres thật. `minQty >= 2` vì giá
      // gốc `Product.price` chính là mức `minQty = 1` ngầm định.
      const productId = await taoSanPham();

      const ba = await service.replace(ACTOR, productId, [
        { minQty: 2, price: 950_000 },
        { minQty: 5, price: 900_000 },
        { minQty: 10, price: 850_000 },
      ]);
      expect(ba.map((r) => r.minQty)).toEqual([2, 5, 10]);

      const khong = await service.replace(ACTOR, productId, []);
      expect(khong).toEqual([]);
      expect(
        await prisma.productPrice.count({ where: { productId } }),
      ).toBe(0);

      const hai = await service.replace(ACTOR, productId, [
        { minQty: 3, price: 920_000 },
        { minQty: 8, price: 870_000 },
      ]);
      expect(hai.map((r) => r.minQty)).toEqual([3, 8]);
    });
  });

  describe('🔴 khoá FOR UPDATE: hai lệnh thay cùng một sản phẩm phải NỐI ĐUÔI', () => {
    it('một lệnh thay khác đang DỞ DANG ⇒ thay vẫn là THAY, không GỘP hai bậc thang', async () => {
      // Bất biến: sau `replace([{3},{4}])`, sản phẩm chứa ĐÚNG bậc [3, 4] — kể cả khi một lệnh thay
      // khác vừa commit ngay trước đó.
      //
      // Vì sao dễ vỡ: `$transaction` KHÔNG tự làm nên atomic-replace. `deleteMany` của lệnh thứ hai
      // lấy ảnh chụp lúc CÂU LỆNH bắt đầu ⇒ không thấy dòng lệnh thứ nhất vừa chèn + commit sau đó
      // ⇒ xoá hụt rồi chèn tiếp danh sách mình. Hai lần "thay sạch" biến thành GỘP; nếu trùng
      // `minQty` thì vỡ `@@unique(productId, minQty)` NGAY TRONG tx ⇒ 500 cho một cú double-click.
      //
      // ⚠️ Viết theo KẾT QUẢ (đếm bậc thang sau khi ép cuộc đua), KHÔNG theo thời gian và KHÔNG dùng
      // `Promise.all` — cả hai đều XANH GIẢ (đã chứng minh ở khuôn gốc `product-groups`). Gỡ khoá
      // `FOR UPDATE` trong service ⇒ dòng của lệnh dở dang sống sót ⇒ count = 3 ⇒ ca này ĐỎ.
      const productId = await taoSanPham();
      await service.replace(ACTOR, productId, [{ minQty: 2, price: 950_000 }]); // dòng CŨ để cả hai bên cùng xoá

      let choCommit!: () => void;
      const dangGiu = new Promise<void>((resolve) => {
        choCommit = resolve;
      });

      // Một lệnh thay ĐANG DỞ DANG: đã xoá cũ + chèn mức {minQty:9}, CHƯA commit.
      const lenhDoDang = prisma.$transaction(async (tx) => {
        await tx.productPrice.deleteMany({ where: { productId } });
        await tx.productPrice.create({
          data: { productId, minQty: 9, price: 800_000 },
        });
        await dangGiu;
      });
      await doi(150);

      // Lệnh thay THỨ HAI chạy chồng lên nó.
      const dangThay = service.replace(ACTOR, productId, [
        { minQty: 3, price: 920_000 },
        { minQty: 4, price: 910_000 },
      ]);
      await doi(300); // để nó thật sự chạm DB và bị chặn

      choCommit();
      await lenhDoDang;
      const ket = await dangThay;

      // Thay sạch: chỉ còn [3, 4]. Không có khoá, mức {minQty:9} của lệnh dở dang SỐNG SÓT ⇒ 3 dòng.
      expect(ket.map((r) => r.minQty)).toEqual([3, 4]);
      expect(
        await prisma.productPrice.count({ where: { productId } }),
      ).toBe(2);
    });
  });
});
