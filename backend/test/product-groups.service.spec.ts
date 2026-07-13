import type { ProductGroup } from '@prisma/client';
import {
  ProductGroupCreated,
  ProductGroupDeactivated,
  ProductGroupItemsReplaced,
  ProductGroupReactivated,
  ProductGroupUpdated,
} from '../src/catalog/domain/product-group-events';
import { ProductGroupsService } from '../src/catalog/product-groups.service';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Unit test của `ProductGroupsService` — hermetic (mock Prisma + EventBus).
 *
 * 🔴 MỌI ca khẳng định PAYLOAD truyền vào Prisma (`data`/`where`/`select`), KHÔNG đếm số lần gọi.
 * Bài học CRITICAL của review 3.2: `toHaveBeenCalledTimes(1)` xanh y hệt nhau dù service ghi đúng
 * cột hay ghi nhầm cột — nó chỉ chứng minh "có gọi", không chứng minh "gọi đúng cái gì".
 */
describe('ProductGroupsService', () => {
  const ACTOR = 'acc-admin-1';
  const GROUP_ID = '5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b';
  const PROD_A = '3b1f0c9a-5d2e-4a7b-8c6d-9e0f1a2b3c4d';
  const PROD_B = '7e6d5c4b-3a2f-4b1e-9d8c-0a1b2c3d4e5f';
  const PROD_LA = '00000000-0000-4000-8000-000000000000';

  const GOI: ProductGroup = {
    id: GROUP_ID,
    name: 'Gói Hybrid 8kW',
    description: 'Trọn bộ hybrid 8kW.',
    isActive: true,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };
  const GOI_DA_TAT: ProductGroup = { ...GOI, isActive: false };

  /** Bản ghi item như Prisma trả về SAU `select` hẹp — sản phẩm KHÔNG mang `costPrice`. */
  const ITEM_A = {
    displayOrder: 0,
    product: {
      id: PROD_A,
      name: 'Tấm pin JA Solar 580W',
      sku: 'JAS-580-M10',
      unit: 'tấm',
      price: 2_450_000,
      isActive: true,
    },
  };
  const ITEM_B = {
    displayOrder: 1,
    product: {
      id: PROD_B,
      name: 'Inverter Deye 8kW',
      sku: 'DEYE-8K',
      unit: 'cái',
      price: 18_000_000,
      isActive: true,
    },
  };

  const groupRepo = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const itemRepo = {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  };
  const productRepo = { findMany: jest.fn() };
  const transaction = jest.fn();
  const queryRaw = jest.fn();
  const publish = jest.fn();

  const service = new ProductGroupsService(
    {
      productGroup: groupRepo,
      productGroupItem: itemRepo,
      product: productRepo,
      $transaction: transaction,
      $queryRaw: queryRaw,
    } as unknown as PrismaService,
    { publish, subscribe: jest.fn() } as unknown as EventBus,
  );

  /** Event duy nhất đã publish. Ném nếu số lượng khác 1 — "đúng một event" là một phần hợp đồng. */
  function eventDuyNhat(): unknown {
    expect(publish).toHaveBeenCalledTimes(1);
    return publish.mock.calls[0][0] as unknown;
  }

  /** Payload `data` mà service truyền xuống Prisma — thứ mà mọi assert ở đây soi. */
  function dataGhi(fn: jest.Mock): Record<string, unknown> {
    return fn.mock.calls[0][0].data as Record<string, unknown>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    groupRepo.findUnique.mockResolvedValue(GOI);
    groupRepo.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...GOI,
        ...data,
      }),
    );
    groupRepo.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...GOI,
        ...data,
      }),
    );
    groupRepo.findMany.mockResolvedValue([GOI]);
    itemRepo.findMany.mockResolvedValue([]);
    itemRepo.deleteMany.mockReturnValue({ op: 'deleteMany' });
    itemRepo.createMany.mockReturnValue({ op: 'createMany' });
    queryRaw.mockReturnValue({ op: 'lock' });
    productRepo.findMany.mockResolvedValue([{ id: PROD_A }, { id: PROD_B }]);
    transaction.mockResolvedValue([]);
  });

  describe('findAll — mặc định ẩn gói đã tắt', () => {
    it('includeInactive=false ⇒ where chỉ lấy gói còn hiệu lực', async () => {
      await service.findAll(false);

      expect(groupRepo.findMany.mock.calls[0][0].where).toEqual({
        isActive: true,
      });
    });

    it('includeInactive=true ⇒ where rỗng (lấy cả gói đã tắt)', async () => {
      await service.findAll(true);

      expect(groupRepo.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('KHÔNG kèm items (danh sách gọn)', async () => {
      await service.findAll(false);

      expect(groupRepo.findMany.mock.calls[0][0]).not.toHaveProperty('include');
    });
  });

  describe('🔴 findOne — select TƯỜNG MINH, giá vốn không có đường nào rời server', () => {
    it('truy vấn KHÔNG dùng `include: { product: true }` trần — và select KHÔNG xin costPrice', async () => {
      // Đây là bất biến an ninh trung tâm của story. Một `include: { product: true }` hồn nhiên
      // trả nguyên bản ghi Product — KÈM giá vốn — cho mọi ai có quyền sửa danh mục, đi VÒNG QUA
      // hàng rào `stripCostPrice` của đường /products. Test soi thẳng payload truy vấn: cột nào
      // được xin, chứ không chỉ soi kết quả (mock trả gì là do ta dạy nó).
      groupRepo.findUnique.mockResolvedValue({ ...GOI, items: [ITEM_A] });

      await service.findOne(GROUP_ID);

      const truyVan = groupRepo.findUnique.mock.calls[0][0] as {
        include: { items: { select: Record<string, unknown> } };
      };
      const itemSelect = truyVan.include.items.select;
      // `select` phải có mặt — `include` trần (không select) là đúng cái lỗi ta đang chặn.
      expect(itemSelect).toBeDefined();

      const productSelect = (
        itemSelect.product as { select: Record<string, boolean> }
      ).select;
      expect(productSelect).not.toHaveProperty('costPrice');
      expect(Object.keys(productSelect).sort()).toEqual([
        'id',
        'isActive',
        'name',
        'price',
        'sku',
        'unit',
      ]);
    });

    it('items sắp theo displayOrder tăng dần và được phẳng hoá (không lồng `product`)', async () => {
      groupRepo.findUnique.mockResolvedValue({
        ...GOI,
        items: [ITEM_A, ITEM_B],
      });

      const detail = await service.findOne(GROUP_ID);

      expect(
        (
          groupRepo.findUnique.mock.calls[0][0] as {
            include: { items: { orderBy: unknown } };
          }
        ).include.items.orderBy,
      ).toEqual({ displayOrder: 'asc' });
      expect(detail.items).toEqual([
        {
          productId: PROD_A,
          name: 'Tấm pin JA Solar 580W',
          sku: 'JAS-580-M10',
          unit: 'tấm',
          price: 2_450_000,
          isActive: true,
          displayOrder: 0,
        },
        {
          productId: PROD_B,
          name: 'Inverter Deye 8kW',
          sku: 'DEYE-8K',
          unit: 'cái',
          price: 18_000_000,
          isActive: true,
          displayOrder: 1,
        },
      ]);
      expect(JSON.stringify(detail)).not.toMatch(/costPrice/);
    });

    it('id lạ ⇒ 404 NOT_FOUND', async () => {
      groupRepo.findUnique.mockResolvedValue(null);

      await expect(service.findOne('không-có')).rejects.toMatchObject({
        errorCode: ErrorCode.NOT_FOUND,
        status: 404,
      });
    });
  });

  describe('create', () => {
    it('isActive: true CỨNG — không đọc từ dto', async () => {
      await service.create(ACTOR, {
        name: 'Gói mới',
        description: 'Mô tả',
        isActive: false,
      } as never);

      expect(dataGhi(groupRepo.create)).toEqual({
        name: 'Gói mới',
        description: 'Mô tả',
        isActive: true,
      });
    });

    it('description vắng ⇒ ghi null (không phải undefined)', async () => {
      await service.create(ACTOR, { name: 'Gói mới' });

      expect(dataGhi(groupRepo.create).description).toBeNull();
    });

    it('publish ProductGroupCreated với snapshot sau', async () => {
      await service.create(ACTOR, { name: 'Gói mới' });

      const event = eventDuyNhat() as ProductGroupCreated;
      expect(event).toBeInstanceOf(ProductGroupCreated);
      expect(event.type).toBe('ProductGroupCreated');
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.after).toEqual({
        id: GROUP_ID,
        name: 'Gói mới',
        description: null,
        isActive: true,
      });
      expect(event.target).toEqual({ type: 'ProductGroup', id: GROUP_ID });
    });

    it('tên trùng ⇒ 409 CONFLICT + fieldErrors trỏ ô name, KHÔNG publish', async () => {
      groupRepo.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(
        service.create(ACTOR, { name: 'Gói Hybrid 8kW' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.CONFLICT,
        status: 409,
        fieldErrors: [{ field: 'name', code: 'isUnique' }],
      });
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe('update — chỉ ghi field có mặt, và KHÔNG ghi gì khi không có gì đổi', () => {
    it('chỉ gửi description ⇒ name đi xuống Prisma là undefined (Prisma bỏ qua cột đó)', async () => {
      await service.update(ACTOR, GROUP_ID, { description: 'Mô tả mới' });

      const data = dataGhi(groupRepo.update);
      expect(data.description).toBe('Mô tả mới');
      expect(data.name).toBeUndefined();
      expect(data).not.toHaveProperty('isActive');
    });

    it('description: null ⇒ ghi null thật (xoá mô tả — cột nullable)', async () => {
      await service.update(ACTOR, GROUP_ID, { description: null });

      expect(dataGhi(groupRepo.update).description).toBeNull();
    });

    it('🔴 PATCH không đổi gì (gửi lại đúng giá trị cũ) ⇒ KHÔNG ghi DB, KHÔNG publish', async () => {
      // Một `Updated` với before === after là một dòng audit NÓI DỐI: nó khai có người sửa gói
      // này, trong khi không có gì sửa cả. Ca này có thật — form gửi lại nguyên giá trị cũ.
      const ketQua = await service.update(ACTOR, GROUP_ID, {
        name: GOI.name,
        description: GOI.description,
      });

      expect(groupRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(ketQua).toEqual(GOI);
    });

    it('🔴 PATCH rỗng {} ⇒ KHÔNG ghi DB, KHÔNG publish', async () => {
      await service.update(ACTOR, GROUP_ID, {});

      expect(groupRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('publish ProductGroupUpdated mang cả trước lẫn sau', async () => {
      await service.update(ACTOR, GROUP_ID, { name: 'Gói Hybrid 10kW' });

      const event = eventDuyNhat() as ProductGroupUpdated;
      expect(event).toBeInstanceOf(ProductGroupUpdated);
      expect(event.before.name).toBe('Gói Hybrid 8kW');
      expect(event.after.name).toBe('Gói Hybrid 10kW');
    });

    it('id lạ ⇒ 404, KHÔNG ghi DB', async () => {
      groupRepo.findUnique.mockResolvedValue(null);

      await expect(
        service.update(ACTOR, 'không-có', { name: 'X' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NOT_FOUND });
      expect(groupRepo.update).not.toHaveBeenCalled();
    });

    it('tên mới trùng gói khác ⇒ 409 + fieldErrors', async () => {
      groupRepo.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(
        service.update(ACTOR, GROUP_ID, { name: 'Gói khác' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.CONFLICT,
        fieldErrors: [{ field: 'name' }],
      });
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe('deactivate / reactivate — no-op thì KHÔNG publish', () => {
    it('deactivate gói đang bật ⇒ ghi isActive: false + publish', async () => {
      await service.deactivate(ACTOR, GROUP_ID);

      expect(groupRepo.update.mock.calls[0][0]).toEqual({
        where: { id: GROUP_ID },
        data: { isActive: false },
      });
      const event = eventDuyNhat() as ProductGroupDeactivated;
      expect(event).toBeInstanceOf(ProductGroupDeactivated);
      expect(event.before.isActive).toBe(true);
      expect(event.after.isActive).toBe(false);
    });

    it('🔴 deactivate gói ĐÃ tắt ⇒ KHÔNG ghi DB, KHÔNG publish', async () => {
      groupRepo.findUnique.mockResolvedValue(GOI_DA_TAT);

      await service.deactivate(ACTOR, GROUP_ID);

      expect(groupRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('reactivate gói đã tắt ⇒ ghi isActive: true + publish', async () => {
      groupRepo.findUnique.mockResolvedValue(GOI_DA_TAT);

      await service.reactivate(ACTOR, GROUP_ID);

      expect(groupRepo.update.mock.calls[0][0]).toEqual({
        where: { id: GROUP_ID },
        data: { isActive: true },
      });
      const event = eventDuyNhat() as ProductGroupReactivated;
      expect(event).toBeInstanceOf(ProductGroupReactivated);
      expect(event.before.isActive).toBe(false);
      expect(event.after.isActive).toBe(true);
    });

    it('🔴 reactivate gói ĐANG bật ⇒ KHÔNG ghi DB, KHÔNG publish', async () => {
      await service.reactivate(ACTOR, GROUP_ID);

      expect(groupRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('deactivate id lạ ⇒ 404, KHÔNG publish', async () => {
      groupRepo.findUnique.mockResolvedValue(null);

      await expect(service.deactivate(ACTOR, 'không-có')).rejects.toMatchObject(
        { errorCode: ErrorCode.NOT_FOUND },
      );
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe('replaceItems — atomic replace, thứ tự mảng LÀ displayOrder', () => {
    it('deleteMany + createMany đi CÙNG một $transaction, displayOrder = index mảng', async () => {
      groupRepo.findUnique.mockResolvedValue({
        ...GOI,
        items: [ITEM_A, ITEM_B],
      });

      await service.replaceItems(ACTOR, GROUP_ID, [PROD_A, PROD_B]);

      expect(itemRepo.deleteMany.mock.calls[0][0]).toEqual({
        where: { productGroupId: GROUP_ID },
      });
      expect(dataGhi(itemRepo.createMany)).toEqual([
        { productGroupId: GROUP_ID, productId: PROD_A, displayOrder: 0 },
        { productGroupId: GROUP_ID, productId: PROD_B, displayOrder: 1 },
      ]);
      // Cả ba op nằm trong CÙNG mảng truyền vào một `$transaction` — nếu tách ra các lệnh rời,
      // một cú chết giữa chừng để lại gói RỖNG. Khoá đứng ĐẦU (xem ca dưới).
      const ops = transaction.mock.calls[0][0] as unknown[];
      expect(ops).toEqual([
        { op: 'lock' },
        { op: 'deleteMany' },
        { op: 'createMany' },
      ]);
    });

    it('🔴 KHOÁ dòng gói (FOR UPDATE) là op ĐẦU TIÊN của tx — hai lệnh thay cùng gói phải nối đuôi', async () => {
      // `$transaction` KHÔNG tự làm nên atomic-replace. Postgres chạy READ COMMITTED: thiếu khoá,
      // `deleteMany` của request thứ hai không thấy dòng request thứ nhất vừa commit ⇒ nó xoá 0
      // dòng rồi chèn tiếp ⇒ hai lần "thay sạch" GỘP thành một gói có cả hai danh sách,
      // `displayOrder` lặp. Đã tái hiện trên Postgres thật. Khoá phải nằm TRƯỚC `deleteMany`, kẻo
      // vô nghĩa.
      groupRepo.findUnique.mockResolvedValue({ ...GOI, items: [] });

      await service.replaceItems(ACTOR, GROUP_ID, [PROD_A]);

      const ops = transaction.mock.calls[0][0] as unknown[];
      expect(ops[0]).toEqual({ op: 'lock' });

      // Khoá đúng DÒNG của gói này, không phải khoá bảng.
      const [sql, param] = queryRaw.mock.calls[0] as [string[], string];
      expect(sql.join('?')).toMatch(
        /SELECT id FROM product_groups WHERE id = \? FOR UPDATE/,
      );
      expect(param).toBe(GROUP_ID);
    });

    it('thứ tự mảng ĐẢO ⇒ displayOrder đảo theo (thứ tự là dữ liệu, không phải trang trí)', async () => {
      groupRepo.findUnique.mockResolvedValue({ ...GOI, items: [] });

      await service.replaceItems(ACTOR, GROUP_ID, [PROD_B, PROD_A]);

      expect(dataGhi(itemRepo.createMany)).toEqual([
        { productGroupId: GROUP_ID, productId: PROD_B, displayOrder: 0 },
        { productGroupId: GROUP_ID, productId: PROD_A, displayOrder: 1 },
      ]);
    });

    it('🔴 productIds: [] ⇒ CHỈ deleteMany, KHÔNG createMany rỗng (createMany rỗng làm no-op cả tx)', async () => {
      // `createMany({ data: [] })` với mảng RỖNG làm hỏng atomic-replace ở Prisma 7 + adapter-pg:
      // cả transaction thành no-op ⇒ item cũ KHÔNG bị xoá. Mảng rỗng là đầu vào hợp lệ (gói vừa
      // tạo chưa có món), nên đây là đường đi thật, không phải phòng xa.
      groupRepo.findUnique.mockResolvedValue({ ...GOI, items: [] });

      await service.replaceItems(ACTOR, GROUP_ID, []);

      expect(itemRepo.createMany).not.toHaveBeenCalled();
      const ops = transaction.mock.calls[0][0] as unknown[];
      expect(ops).toEqual([{ op: 'lock' }, { op: 'deleteMany' }]);
    });

    it('🔴 productId TRÙNG trong payload ⇒ 400, chặn TRƯỚC khi chạm $transaction', async () => {
      // Để `@@unique` của DB nổ SAU khi `deleteMany` đã chạy trong tx là một cách thua khó chịu.
      await expect(
        service.replaceItems(ACTOR, GROUP_ID, [PROD_A, PROD_B, PROD_A]),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.VALIDATION_ERROR,
        status: 400,
        fieldErrors: [{ field: 'productIds', code: 'isUnique' }],
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(itemRepo.deleteMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('productId KHÔNG tồn tại ⇒ 400 + fieldErrors chỉ đúng id thiếu, KHÔNG chạm tx', async () => {
      productRepo.findMany.mockResolvedValue([{ id: PROD_A }]);

      await expect(
        service.replaceItems(ACTOR, GROUP_ID, [PROD_A, PROD_LA]),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.VALIDATION_ERROR,
        status: 400,
        fieldErrors: [{ field: 'productIds', code: 'isNotFound' }],
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('kiểm tồn tại sản phẩm bằng MỘT findMany cho cả mảng (không N+1)', async () => {
      groupRepo.findUnique.mockResolvedValue({ ...GOI, items: [] });

      await service.replaceItems(ACTOR, GROUP_ID, [PROD_A, PROD_B]);

      expect(productRepo.findMany).toHaveBeenCalledTimes(1);
      expect(productRepo.findMany.mock.calls[0][0].where).toEqual({
        id: { in: [PROD_A, PROD_B] },
      });
    });

    it('gói không tồn tại ⇒ 404, KHÔNG chạm tx', async () => {
      groupRepo.findUnique.mockResolvedValue(null);

      await expect(
        service.replaceItems(ACTOR, 'không-có', [PROD_A]),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NOT_FOUND });
      expect(transaction).not.toHaveBeenCalled();
    });

    it('publish ProductGroupItemsReplaced — target là GÓI, snapshot trước→sau đúng', async () => {
      itemRepo.findMany.mockResolvedValue([
        { productId: PROD_A, displayOrder: 0 },
      ]);
      groupRepo.findUnique
        .mockResolvedValueOnce(GOI) // findOrThrow
        .mockResolvedValueOnce({ ...GOI, items: [ITEM_A, ITEM_B] }); // findOne sau tx

      await service.replaceItems(ACTOR, GROUP_ID, [PROD_A, PROD_B]);

      const event = eventDuyNhat() as ProductGroupItemsReplaced;
      expect(event).toBeInstanceOf(ProductGroupItemsReplaced);
      expect(event.type).toBe('ProductGroupItemsReplaced');
      // Target trỏ về GÓI (cha), không phải item — để vết audit của một gói gom cả "sửa gói" lẫn
      // "đổi danh sách món".
      expect(event.target).toEqual({ type: 'ProductGroup', id: GROUP_ID });
      expect(event.before).toEqual([{ productId: PROD_A, displayOrder: 0 }]);
      expect(event.after).toEqual([
        { productId: PROD_A, displayOrder: 0 },
        { productId: PROD_B, displayOrder: 1 },
      ]);
    });

    it('snapshot event KHÔNG mang giá vốn (audit ghi checklist, không ghi bảng giá)', async () => {
      groupRepo.findUnique.mockResolvedValue({ ...GOI, items: [ITEM_A] });

      await service.replaceItems(ACTOR, GROUP_ID, [PROD_A]);

      expect(JSON.stringify(eventDuyNhat())).not.toMatch(/costPrice/);
    });
  });
});
