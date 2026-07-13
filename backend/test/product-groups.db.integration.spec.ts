import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ProductGroupsService } from '../src/catalog/product-groups.service';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Lane TÍCH HỢP trên Postgres THẬT cho gói vật tư.
 *
 * Vì sao lane này phải tồn tại: ba bất biến của story sống ở TẦNG DB và mock không chứng minh nổi
 * cái nào — mock Prisma nhận `deleteMany`/`createMany`/`delete` không kêu ca, dù DDL có đúng hay
 * không:
 *
 *  1. `@@unique(product_group_id, product_id)` — một sản phẩm không nằm hai lần trong cùng gói.
 *  2. `ON DELETE CASCADE` từ gói xuống item, và `ON DELETE RESTRICT` từ item lên sản phẩm.
 *  3. Atomic-replace thật sự nguyên tử qua `$transaction` — kể cả khi danh sách mới RỖNG (chỗ mà
 *     `createMany` rỗng làm no-op cả transaction trên Prisma 7 + adapter-pg).
 *
 * TỰ SKIP khi vắng `DATABASE_URL` ⇒ `npm test` mặc định vẫn HERMETIC. Chạy: `npm run test:db`.
 */
const coDb = Boolean(process.env.DATABASE_URL);
const moTa = coDb ? describe : describe.skip;

if (!coDb) {
  console.log(
    'Bỏ qua lane tích hợp DB gói vật tư: vắng DATABASE_URL. Chạy: npm run test:db',
  );
}

moTa('Ràng buộc tầng DB của product_groups (Postgres THẬT)', () => {
  let prisma: PrismaClient;
  let service: ProductGroupsService;

  const ACTOR = 'acc-test';
  // Tiền tố để không bao giờ đụng dữ liệu thật.
  const TEN_GOI = 'ZZ Test gói tích hợp';
  const SKU_A = 'ZZ-TEST-SKU-A';
  const SKU_B = 'ZZ-TEST-SKU-B';
  const SKU_C = 'ZZ-TEST-SKU-C';

  /**
   * Xoá theo đúng chiều FK: item trước, rồi gói, rồi sản phẩm. `RESTRICT` trên `product_id` sẽ
   * CHẶN xoá sản phẩm nếu còn item trỏ vào — chính là bất biến ta kiểm bên dưới, nên dọn dẹp phải
   * tôn trọng nó, không lách nó.
   */
  async function donDep(): Promise<void> {
    const goi = await prisma.productGroup.findMany({
      where: { name: { startsWith: 'ZZ Test' } },
      select: { id: true },
    });
    await prisma.productGroupItem.deleteMany({
      where: { productGroupId: { in: goi.map((g) => g.id) } },
    });
    await prisma.productGroup.deleteMany({
      where: { name: { startsWith: 'ZZ Test' } },
    });
    await prisma.product.deleteMany({
      where: { sku: { startsWith: 'ZZ-TEST-SKU-' } },
    });
  }

  /** Chờ một nhịp — dùng để ép thứ tự trong ca kiểm khoá `FOR UPDATE`. */
  function doi(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Ba sản phẩm test, trả về id theo đúng thứ tự A, B, C. */
  async function taoSanPham(): Promise<[string, string, string]> {
    const ids: string[] = [];
    for (const sku of [SKU_A, SKU_B, SKU_C]) {
      const sanPham = await prisma.product.create({
        data: {
          name: `Sản phẩm test ${sku}`,
          sku,
          unit: 'cái',
          price: 1_000_000,
          costPrice: 700_000,
        },
      });
      ids.push(sanPham.id);
    }
    return ids as [string, string, string];
  }

  async function taoGoi(): Promise<string> {
    const goi = await prisma.productGroup.create({
      data: { name: TEN_GOI, description: 'Gói của lane tích hợp.' },
    });
    return goi.id;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    service = new ProductGroupsService(
      prisma as unknown as PrismaService,
      { publish: async () => {}, subscribe: () => {} } as unknown as EventBus,
    );
    await donDep();
  });

  afterAll(async () => {
    await donDep();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await donDep();
  });

  describe('UNIQUE (product_group_id, product_id) — enforce THẬT ở tầng DB', () => {
    it('cùng một sản phẩm hai lần trong CÙNG một gói ⇒ Postgres CHẶN', async () => {
      // Service đã chặn trùng ở tầng app (400 trước khi vào transaction). Ở đây ta chứng minh
      // rằng NẾU ai đó gỡ câu kiểm ấy, DB vẫn là lưới cuối cùng — bất biến không treo vào một
      // câu `if` nhớ chạy.
      const [prodA] = await taoSanPham();
      const goiId = await taoGoi();
      await prisma.productGroupItem.create({
        data: { productGroupId: goiId, productId: prodA, displayOrder: 0 },
      });

      await expect(
        prisma.productGroupItem.create({
          data: { productGroupId: goiId, productId: prodA, displayOrder: 1 },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('cùng một sản phẩm ở HAI gói khác nhau ⇒ HỢP LỆ (unique chỉ chặn trong cùng một gói)', async () => {
      // "Dây DC 4mm²" nằm cả gói Hybrid lẫn gói Bám tải là chuyện bình thường.
      const [prodA] = await taoSanPham();
      const goi1 = await taoGoi();
      const goi2 = await prisma.productGroup.create({
        data: { name: `${TEN_GOI} 2` },
      });

      await prisma.productGroupItem.create({
        data: { productGroupId: goi1, productId: prodA, displayOrder: 0 },
      });
      await prisma.productGroupItem.create({
        data: { productGroupId: goi2.id, productId: prodA, displayOrder: 0 },
      });

      const dem = await prisma.productGroupItem.count({
        where: { productId: prodA },
      });
      expect(dem).toBe(2);
    });
  });

  describe('FK: Cascade xuống item, Restrict lên sản phẩm', () => {
    it('ON DELETE CASCADE — xoá CỨNG một gói ⇒ item con biến mất theo', async () => {
      const [prodA, prodB] = await taoSanPham();
      const goiId = await taoGoi();
      await service.replaceItems(ACTOR, goiId, [prodA, prodB]);

      await prisma.productGroup.delete({ where: { id: goiId } });

      const conLai = await prisma.productGroupItem.count({
        where: { productGroupId: goiId },
      });
      expect(conLai).toBe(0);
    });

    it('🔴 ON DELETE RESTRICT — xoá CỨNG một sản phẩm đang nằm trong gói ⇒ bị CHẶN, dòng còn sống', async () => {
      const [prodA] = await taoSanPham();
      const goiId = await taoGoi();
      await service.replaceItems(ACTOR, goiId, [prodA]);

      // ⚠️ KHÔNG assert `code: 'P2003'`. Prisma 7 qua driver adapter chỉ gắn mã P2003 cho FK
      // violation lúc INSERT; vi phạm RESTRICT lúc DELETE nổi lên dưới dạng `DriverAdapterError`
      // KHÔNG mang `code`. Bám vào mã sẽ làm test đỏ vì một chi tiết của tầng driver, trong khi
      // thứ cần khẳng định là HÀNH VI: lệnh xoá bị từ chối, và dòng còn sống.
      await expect(
        prisma.product.delete({ where: { id: prodA } }),
      ).rejects.toThrow(/violates RESTRICT setting of foreign key constraint/);

      const vanCon = await prisma.product.findUnique({ where: { id: prodA } });
      expect(vanCon).not.toBeNull();
      const item = await prisma.productGroupItem.findFirst({
        where: { productGroupId: goiId, productId: prodA },
      });
      expect(item).not.toBeNull();
    });
  });

  describe('🔴 atomic-replace trên Postgres thật: 3 món → 0 món → 2 món', () => {
    it('mỗi bước thay SẠCH danh sách cũ, và bước RỖNG thật sự xoá hết', async () => {
      // Ca này chứng minh NGỮ NGHĨA thay-nguyên-khối end-to-end (3 → 0 → 2, displayOrder đánh lại
      // từ 0 mỗi lần) trên Postgres thật.
      //
      // ⚠️ Nó KHÔNG canh được guard `if (productIds.length > 0)` trong service. Đã kiểm chứng bằng
      // đột biến: gỡ guard đó ra, lane DB này VẪN XANH (`deleteMany` vẫn chạy, count vẫn về 0) —
      // chỉ ca unit `productIds: [] ⇒ CHỈ deleteMany` mới ĐỎ. Vậy nên đừng đọc ca này rồi kết luận
      // ca unit kia là thừa: nó là guard DUY NHẤT của cái bug `createMany` rỗng. Xoá nó = mất canh.
      const [prodA, prodB, prodC] = await taoSanPham();
      const goiId = await taoGoi();

      const ba = await service.replaceItems(ACTOR, goiId, [
        prodA,
        prodB,
        prodC,
      ]);
      expect(ba.items).toHaveLength(3);
      expect(ba.items.map((i) => i.productId)).toEqual([prodA, prodB, prodC]);
      expect(ba.items.map((i) => i.displayOrder)).toEqual([0, 1, 2]);
      expect(
        await prisma.productGroupItem.count({
          where: { productGroupId: goiId },
        }),
      ).toBe(3);

      const khong = await service.replaceItems(ACTOR, goiId, []);
      expect(khong.items).toHaveLength(0);
      expect(
        await prisma.productGroupItem.count({
          where: { productGroupId: goiId },
        }),
      ).toBe(0);

      const hai = await service.replaceItems(ACTOR, goiId, [prodC, prodA]);
      expect(hai.items.map((i) => i.productId)).toEqual([prodC, prodA]);
      expect(hai.items.map((i) => i.displayOrder)).toEqual([0, 1]);
      expect(
        await prisma.productGroupItem.count({
          where: { productGroupId: goiId },
        }),
      ).toBe(2);
    });

    it('thay list mà một sản phẩm được GIỮ LẠI ⇒ không vướng UNIQUE (xoá rồi mới tạo, cùng tx)', async () => {
      // Nếu ai đó đổi `deleteMany + createMany` thành "upsert từng món", ca này là nơi nó vỡ:
      // sản phẩm A đã có dòng cũ, và một INSERT thẳng sẽ đụng `@@unique`.
      const [prodA, prodB] = await taoSanPham();
      const goiId = await taoGoi();

      await service.replaceItems(ACTOR, goiId, [prodA, prodB]);
      const sau = await service.replaceItems(ACTOR, goiId, [prodB, prodA]);

      expect(sau.items.map((i) => i.productId)).toEqual([prodB, prodA]);
      expect(sau.items.map((i) => i.displayOrder)).toEqual([0, 1]);
    });

    it('🔴 một lệnh thay khác đang DỞ DANG ⇒ thay vẫn là THAY, không GỘP hai danh sách', async () => {
      // Bất biến: sau `replaceItems([C, D])`, gói chứa ĐÚNG [C, D] — kể cả khi một lệnh thay khác
      // vừa commit ngay trước đó.
      //
      // Vì sao dễ vỡ: `$transaction` KHÔNG tự làm nên atomic-replace. Postgres chạy READ COMMITTED,
      // nên `deleteMany` của lệnh thứ hai lấy ảnh chụp lúc CÂU LỆNH bắt đầu ⇒ nó KHÔNG thấy những
      // dòng lệnh thứ nhất vừa chèn và commit sau đó ⇒ xoá hụt, rồi chèn tiếp danh sách của mình.
      // Hai lần "thay sạch" biến thành GỘP. Khoá `FOR UPDATE` trên dòng gói bắt lệnh sau CHỜ lệnh
      // trước commit, rồi mới xoá — trên ảnh chụp MỚI, thấy đủ.
      //
      // ⚠️ Ca này viết theo KẾT QUẢ, không theo thời gian, và đó là chủ ý. Hai bản nháp trước đều
      // XANH GIẢ (đã chứng minh bằng đột biến gỡ khoá):
      //   - `Promise.all` hai `replaceItems`: hai batch-transaction tình cờ nối đuôi ⇒ cuộc đua
      //     không bao giờ xảy ra.
      //   - "giữ khoá rồi assert lệnh thay CHƯA xong": nó chặn thật, nhưng vì lý do KHÁC — INSERT
      //     dòng con lấy khoá FOR KEY SHARE trên dòng cha để kiểm FK, vốn đã đụng FOR UPDATE. Ca đó
      //     đo cái chặn của FK, không đo khoá của service.
      // Nên ở đây ta ép đúng cuộc đua thật rồi ĐẾM: gỡ khoá ⇒ gói còn dòng của lệnh dở dang ⇒ ĐỎ.
      const [prodA, prodB, prodC] = await taoSanPham();
      const prodD = (
        await prisma.product.create({
          data: {
            name: 'Sản phẩm test D',
            sku: 'ZZ-TEST-SKU-D',
            unit: 'cái',
            price: 1_000_000,
            costPrice: 700_000,
          },
        })
      ).id;
      const goiId = await taoGoi();
      await service.replaceItems(ACTOR, goiId, [prodA]); // dòng CŨ để cả hai bên cùng xoá

      let choCommit!: () => void;
      const dangGiu = new Promise<void>((resolve) => {
        choCommit = resolve;
      });

      // Một lệnh thay ĐANG DỞ DANG (đã xoá cũ + chèn B, chưa commit).
      const lenhDoDang = prisma.$transaction(async (tx) => {
        await tx.productGroupItem.deleteMany({
          where: { productGroupId: goiId },
        });
        await tx.productGroupItem.create({
          data: { productGroupId: goiId, productId: prodB, displayOrder: 0 },
        });
        await dangGiu;
      });
      await doi(150);

      // Lệnh thay THỨ HAI chạy chồng lên nó.
      const dangThay = service.replaceItems(ACTOR, goiId, [prodC, prodD]);
      await doi(300); // để nó thật sự chạm DB và bị chặn

      choCommit();
      await lenhDoDang;
      const ket = await dangThay;

      // Thay sạch: chỉ còn [C, D]. Không có khoá, dòng B của lệnh dở dang SỐNG SÓT ⇒ 3 món.
      expect(ket.items.map((i) => i.productId)).toEqual([prodC, prodD]);
      expect(ket.items.map((i) => i.displayOrder)).toEqual([0, 1]);
      expect(
        await prisma.productGroupItem.count({
          where: { productGroupId: goiId },
        }),
      ).toBe(2);
    });

    it('🔴 payload đọc từ Postgres THẬT không mang giá vốn — dù cột đó có giá trị trong DB', async () => {
      // Ba sản phẩm test đều có `costPrice: 700_000` trong DB. Nếu service `include` trần, con số
      // đó có mặt trong object trả về. `select` tường minh là thứ chặn nó — và chỉ ở đây, với dữ
      // liệu thật, mới chứng minh được là chặn thật chứ không phải mock được dạy thế.
      const [prodA] = await taoSanPham();
      const goiId = await taoGoi();
      await service.replaceItems(ACTOR, goiId, [prodA]);

      const chiTiet = await service.findOne(goiId);

      expect(JSON.stringify(chiTiet)).not.toMatch(/costPrice/);
      expect(chiTiet.items[0].price).toBe(1_000_000);
    });
  });

  describe('sản phẩm đã TẮT vẫn nằm được trong gói (cố ý — picker tự làm mờ)', () => {
    it('tắt một sản phẩm SAU khi nó đã vào gói ⇒ item còn nguyên, payload trả isActive: false', async () => {
      const [prodA] = await taoSanPham();
      const goiId = await taoGoi();
      await service.replaceItems(ACTOR, goiId, [prodA]);

      await prisma.product.update({
        where: { id: prodA },
        data: { isActive: false },
      });

      const chiTiet = await service.findOne(goiId);
      expect(chiTiet.items).toHaveLength(1);
      expect(chiTiet.items[0].isActive).toBe(false);
    });
  });

  describe('UNIQUE product_groups.name — service dịch P2002 thành 409', () => {
    it('tên gói trùng ⇒ 409 + fieldErrors (P2002 do Postgres ném thật)', async () => {
      await taoGoi();

      await expect(
        service.create(ACTOR, { name: TEN_GOI }),
      ).rejects.toMatchObject({
        errorCode: 'CONFLICT',
        fieldErrors: [{ field: 'name' }],
      });
    });
  });
});
