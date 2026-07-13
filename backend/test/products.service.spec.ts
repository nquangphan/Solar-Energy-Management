import { ProductsService } from '../src/catalog/products.service';
import {
  ProductCreated,
  ProductDeactivated,
  ProductUpdated,
} from '../src/catalog/domain/product-events';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * Unit `ProductsService` — HERMETIC (mock `PrismaService` + `EventBus`, không cần Postgres).
 *
 * Phủ đúng chỗ dễ mất tiền/lộ tiền: gate GHI `costPrice` (403 TRƯỚC khi chạm DB), che ĐỌC
 * `costPrice` (field bị LOẠI, không phải `0`/`null`), soft-delete (không hard-delete),
 * publish event đúng payload SAU commit, `sku` trùng ⇒ 409.
 *
 * GIỚI HẠN đã biết: mock KHÔNG chứng minh ràng buộc `@unique` trên `sku` chạy thật ở
 * Postgres — nó chỉ chứng minh service DỊCH ĐÚNG lỗi P2002 khi Prisma ném ra. Ràng buộc
 * tầng DB của repo này chưa từng chạy `migrate deploy` (nợ kỹ thuật, xem story).
 */

interface ProductRepoMock {
  create: jest.Mock;
  update: jest.Mock;
  findUnique: jest.Mock;
  findMany: jest.Mock;
  delete: jest.Mock;
}

const PRODUCT = {
  id: 'prod-1',
  name: 'Tấm pin JA Solar 580W',
  sku: 'JAS-580-M10',
  unit: 'tấm',
  price: 2_450_000,
  costPrice: 1_950_000,
  tracksStock: true,
  priceEditable: false,
  warrantyMonths: 144,
  isActive: true,
  createdAt: new Date('2026-07-13T00:00:00Z'),
  updatedAt: new Date('2026-07-13T00:00:00Z'),
};

const ACTOR_ID = 'actor-1';
const CAN_VIEW_COSTS = true;
const NO_COSTS = false;
/** Cờ `catalog.tiered_pricing` — resolve ở controller, truyền xuống service như một boolean. */
const TIERED_ON = true;
const TIERED_OFF = false;

async function catchAppException(p: Promise<unknown>): Promise<AppException> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppException) return err;
    throw err;
  }
  throw new Error('Kỳ vọng AppException nhưng promise resolve');
}

/** Lỗi Prisma vi phạm UNIQUE — shape thật mà driver ném ra (`code: 'P2002'`). */
function uniqueViolation(): Error & { code: string } {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
  });
}

describe('ProductsService (unit, hermetic)', () => {
  let repo: ProductRepoMock;
  let publish: jest.Mock;
  let service: ProductsService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(PRODUCT),
      update: jest.fn().mockResolvedValue(PRODUCT),
      findUnique: jest.fn().mockResolvedValue(PRODUCT),
      findMany: jest.fn().mockResolvedValue([PRODUCT]),
      delete: jest.fn(),
    };
    publish = jest.fn().mockResolvedValue(undefined);
    const prisma = { product: repo } as unknown as PrismaService;
    const eventBus = { publish } as unknown as EventBus;
    service = new ProductsService(prisma, eventBus);
  });

  describe('create', () => {
    it('tạo sản phẩm rồi publish ProductCreated SAU commit, payload đủ costPrice', async () => {
      const result = await service.create(
        ACTOR_ID,
        {
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
          costPrice: PRODUCT.costPrice,
        },
        CAN_VIEW_COSTS,
      );

      expect(repo.create).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0][0] as ProductCreated;
      expect(event).toBeInstanceOf(ProductCreated);
      expect(event.type).toBe('ProductCreated');
      expect(event.actorAccountId).toBe(ACTOR_ID);
      expect(event.target).toEqual({ type: 'Product', id: PRODUCT.id });
      // Audit ghi SỰ THẬT: payload luôn đủ giá vốn, không lọc theo quyền người xem.
      expect(event.after.costPrice).toBe(PRODUCT.costPrice);
      expect(result).toHaveProperty('costPrice', PRODUCT.costPrice);
    });

    it('costPrice vắng mặt ⇒ mặc định 0 (Story 6.3 sẽ tự cập nhật bằng bình quân gia quyền)', async () => {
      await service.create(
        ACTOR_ID,
        {
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
        },
        CAN_VIEW_COSTS,
      );

      expect(repo.create.mock.calls[0][0].data.costPrice).toBe(0);
    });

    it('warrantyMonths bỏ trống ⇒ null (công lắp không bảo hành — hợp lệ, KHÔNG chặn)', async () => {
      await service.create(
        ACTOR_ID,
        {
          name: 'Công lắp đặt',
          sku: 'CONG-LAP',
          unit: 'gói',
          price: 3_000_000,
        },
        CAN_VIEW_COSTS,
      );

      expect(repo.create.mock.calls[0][0].data.warrantyMonths).toBeNull();
    });

    it('body có costPrice mà KHÔNG có costs.view ⇒ 403 và KHÔNG chạm DB', async () => {
      const err = await catchAppException(
        service.create(
          ACTOR_ID,
          {
            name: PRODUCT.name,
            sku: PRODUCT.sku,
            unit: PRODUCT.unit,
            price: PRODUCT.price,
            costPrice: 1_950_000,
          },
          NO_COSTS,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      // Fail-closed: từ chối TRƯỚC khi ghi. Ghi rồi mới ném = đã lộ/đã đổi dữ liệu.
      expect(repo.create).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('costPrice: 0 vẫn bị chặn khi thiếu costs.view (0 là giá trị, không phải "vắng mặt")', async () => {
      const err = await catchAppException(
        service.create(
          ACTOR_ID,
          {
            name: PRODUCT.name,
            sku: PRODUCT.sku,
            unit: PRODUCT.unit,
            price: PRODUCT.price,
            costPrice: 0,
          },
          NO_COSTS,
        ),
      );

      expect(err.getStatus()).toBe(403);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('thiếu costs.view (không gửi costPrice) ⇒ response bị LOẠI HẲN key costPrice', async () => {
      const result = await service.create(
        ACTOR_ID,
        {
          name: PRODUCT.name,
          sku: PRODUCT.sku,
          unit: PRODUCT.unit,
          price: PRODUCT.price,
        },
        NO_COSTS,
      );

      // `not.toHaveProperty` chứ KHÔNG `toBeUndefined()`: key phải BIẾN MẤT khỏi object.
      expect(result).not.toHaveProperty('costPrice');
      expect(result).toHaveProperty('price', PRODUCT.price);
    });

    it('sku trùng (P2002) ⇒ 409 CONFLICT kèm fieldErrors trỏ đúng ô sku', async () => {
      repo.create.mockRejectedValue(uniqueViolation());

      const err = await catchAppException(
        service.create(
          ACTOR_ID,
          {
            name: PRODUCT.name,
            sku: PRODUCT.sku,
            unit: PRODUCT.unit,
            price: PRODUCT.price,
          },
          CAN_VIEW_COSTS,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(err.fieldErrors?.[0].field).toBe('sku');
      expect(publish).not.toHaveBeenCalled();
    });

    it('lỗi DB khác P2002 KHÔNG bị nuốt thành 409', async () => {
      repo.create.mockRejectedValue(new Error('mất kết nối'));

      await expect(
        service.create(
          ACTOR_ID,
          {
            name: PRODUCT.name,
            sku: PRODUCT.sku,
            unit: PRODUCT.unit,
            price: PRODUCT.price,
          },
          CAN_VIEW_COSTS,
        ),
      ).rejects.toThrow('mất kết nối');
    });
  });

  describe('update', () => {
    it('sửa giá bán ⇒ publish ProductUpdated mang cả before và after', async () => {
      const after = { ...PRODUCT, price: 2_600_000 };
      repo.update.mockResolvedValue(after);

      const result = await service.update(
        ACTOR_ID,
        PRODUCT.id,
        { price: 2_600_000 },
        CAN_VIEW_COSTS,
      );

      const event = publish.mock.calls[0][0] as ProductUpdated;
      expect(event).toBeInstanceOf(ProductUpdated);
      expect(event.before.price).toBe(PRODUCT.price);
      expect(event.after.price).toBe(2_600_000);
      expect(result).toHaveProperty('price', 2_600_000);
    });

    it('KHÔNG đọc/ghi orders — chỉ chạm bảng products (không hồi tố đơn đã chốt)', async () => {
      const prismaSpy = { product: repo } as unknown as PrismaService;
      // Nếu service đụng tới bất kỳ model nào khác `product`, truy cập đó sẽ ném ở đây.
      const guarded = new Proxy(prismaSpy, {
        get(target, prop) {
          if (prop !== 'product') {
            throw new Error(
              `Service chạm model ngoài phạm vi: ${String(prop)}`,
            );
          }
          return Reflect.get(target, prop);
        },
      });
      const scoped = new ProductsService(guarded, {
        publish,
      } as unknown as EventBus);

      await expect(
        scoped.update(ACTOR_ID, PRODUCT.id, { price: 1 }, CAN_VIEW_COSTS),
      ).resolves.toBeDefined();
    });

    it('body có costPrice mà thiếu costs.view ⇒ 403 và KHÔNG chạm DB', async () => {
      const err = await catchAppException(
        service.update(ACTOR_ID, PRODUCT.id, { costPrice: 1 }, NO_COSTS),
      );

      expect(err.getStatus()).toBe(403);
      expect(repo.findUnique).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('id không tồn tại ⇒ 404 NOT_FOUND', async () => {
      repo.findUnique.mockResolvedValue(null);

      const err = await catchAppException(
        service.update(ACTOR_ID, 'không-có', { price: 1 }, CAN_VIEW_COSTS),
      );

      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(err.getStatus()).toBe(404);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('warrantyMonths: null được chấp nhận (đặt lại về "không bảo hành")', async () => {
      await service.update(
        ACTOR_ID,
        PRODUCT.id,
        { warrantyMonths: null },
        CAN_VIEW_COSTS,
      );

      expect(repo.update.mock.calls[0][0].data.warrantyMonths).toBeNull();
    });
  });

  describe('deactivate', () => {
    it('soft-delete: update isActive=false, KHÔNG gọi prisma.product.delete', async () => {
      repo.update.mockResolvedValue({ ...PRODUCT, isActive: false });

      await service.deactivate(ACTOR_ID, PRODUCT.id);

      expect(repo.update).toHaveBeenCalledWith({
        where: { id: PRODUCT.id },
        data: { isActive: false },
      });
      // Hard delete sẽ mồ côi dòng đơn/tồn kho lịch sử (FK từ Epic 4/6).
      expect(repo.delete).not.toHaveBeenCalled();

      const event = publish.mock.calls[0][0] as ProductDeactivated;
      expect(event).toBeInstanceOf(ProductDeactivated);
      expect(event.before.isActive).toBe(true);
      expect(event.after.isActive).toBe(false);
    });

    it('id không tồn tại ⇒ 404 và KHÔNG publish', async () => {
      repo.findUnique.mockResolvedValue(null);

      const err = await catchAppException(
        service.deactivate(ACTOR_ID, 'không-có'),
      );

      expect(err.getStatus()).toBe(404);
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe('đọc', () => {
    it('findAll mặc định CHỈ sản phẩm còn hiệu lực', async () => {
      await service.findAll(false, CAN_VIEW_COSTS, TIERED_OFF);

      expect(repo.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    });

    it('findAll(includeInactive) trả cả sản phẩm đã ẩn', async () => {
      await service.findAll(true, CAN_VIEW_COSTS, TIERED_OFF);

      expect(repo.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('findAll thiếu costs.view ⇒ MỌI phần tử bị loại key costPrice', async () => {
      repo.findMany.mockResolvedValue([PRODUCT, { ...PRODUCT, id: 'prod-2' }]);

      const result = await service.findAll(false, NO_COSTS, TIERED_OFF);

      expect(result).toHaveLength(2);
      for (const product of result) {
        expect(product).not.toHaveProperty('costPrice');
      }
    });

    it('findOne có costs.view ⇒ costPrice có mặt', async () => {
      const result = await service.findOne(
        PRODUCT.id,
        CAN_VIEW_COSTS,
        TIERED_OFF,
      );

      expect(result).toHaveProperty('costPrice', PRODUCT.costPrice);
    });

    it('findOne thiếu costs.view ⇒ costPrice bị loại khỏi payload', async () => {
      const result = await service.findOne(PRODUCT.id, NO_COSTS, TIERED_OFF);

      expect(result).not.toHaveProperty('costPrice');
    });

    it('findOne id không tồn tại ⇒ 404', async () => {
      repo.findUnique.mockResolvedValue(null);

      const err = await catchAppException(
        service.findOne('không-có', CAN_VIEW_COSTS, TIERED_OFF),
      );

      expect(err.getStatus()).toBe(404);
    });
  });

  describe('cờ giá phân tầng (Story 3.2)', () => {
    it('cờ TẮT ⇒ KHÔNG include prices (payload không có key `prices`)', async () => {
      await service.findOne(PRODUCT.id, CAN_VIEW_COSTS, TIERED_OFF);

      // `include: undefined` ⇒ Prisma không nối bảng ⇒ bản ghi trả về không có key `prices`.
      // Đây là chỗ bất biến "cờ TẮT ⇒ mỗi sản phẩm MỘT giá duy nhất" được enforce ở SERVER.
      expect(repo.findUnique.mock.calls[0][0].include).toBeUndefined();
    });

    it('cờ BẬT ⇒ include prices, sắp xếp minQty tăng dần', async () => {
      await service.findOne(PRODUCT.id, CAN_VIEW_COSTS, TIERED_ON);

      expect(repo.findUnique.mock.calls[0][0].include).toEqual({
        prices: { orderBy: { minQty: 'asc' } },
      });
    });

    it('findAll cờ TẮT ⇒ không include; cờ BẬT ⇒ có include', async () => {
      await service.findAll(false, CAN_VIEW_COSTS, TIERED_OFF);
      expect(repo.findMany.mock.calls[0][0].include).toBeUndefined();

      await service.findAll(false, CAN_VIEW_COSTS, TIERED_ON);
      expect(repo.findMany.mock.calls[1][0].include).toEqual({
        prices: { orderBy: { minQty: 'asc' } },
      });
    });

    it('cờ BẬT + thiếu costs.view ⇒ vẫn có prices, vẫn KHÔNG có costPrice (hai gate độc lập)', async () => {
      // Hồi quy 3.1: thêm `prices` không được làm hỏng việc che giá vốn. Bậc thang KHÔNG mang
      // giá vốn, nên không cần strip gì bên trong nó.
      const withPrices = {
        ...PRODUCT,
        prices: [{ id: 'pp-1', minQty: 10, price: 2_300_000 }],
      };
      repo.findUnique.mockResolvedValue(withPrices);

      const result = await service.findOne(PRODUCT.id, NO_COSTS, TIERED_ON);

      expect(result).not.toHaveProperty('costPrice');
      expect(result).toHaveProperty('prices');
    });
  });
});
