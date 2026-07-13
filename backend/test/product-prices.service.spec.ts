import { ProductPricesService } from '../src/catalog/product-prices.service';
import { ProductPricesReplaced } from '../src/catalog/domain/product-price-events';
import type { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

/**
 * Unit `ProductPricesService` — HERMETIC (mock `PrismaService` + `EventBus` + `FeatureFlagsService`).
 *
 * Phủ đúng chỗ dễ mất tiền/mất dữ liệu:
 *  - Cờ TẮT ⇒ 409 TRƯỚC khi chạm DB (không ghi dữ liệu ma vào bảng không ai đọc).
 *  - Trùng `minQty` ⇒ 400 ở tầng APP (không để DB P2002 quyết sau khi deleteMany đã chạy).
 *  - `PUT []` ⇒ `deleteMany` chạy, `createMany` KHÔNG được gọi — cạm bẫy Prisma 7:
 *    `createMany({ data: [] })` làm hỏng atomic-replace (đã cắn một lần ở account-permissions).
 */

const PRODUCT_ID = 'prod-1';
const ACTOR_ID = 'actor-1';

/** Bản ghi ProductPrice như Prisma trả về. */
function row(id: string, minQty: number, price: number) {
  return {
    id,
    productId: PRODUCT_ID,
    minQty,
    price,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };
}

async function catchAppException(p: Promise<unknown>): Promise<AppException> {
  try {
    await p;
  } catch (err) {
    if (err instanceof AppException) return err;
    throw err;
  }
  throw new Error('Kỳ vọng AppException nhưng promise resolve');
}

describe('ProductPricesService (unit, hermetic)', () => {
  let productPriceRepo: {
    findMany: jest.Mock;
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  let productRepo: { findUnique: jest.Mock };
  let transaction: jest.Mock;
  let publish: jest.Mock;
  let isEnabled: jest.Mock;
  let service: ProductPricesService;

  beforeEach(() => {
    productPriceRepo = {
      findMany: jest.fn().mockResolvedValue([]),
      // `deleteMany`/`createMany` trả "mô tả thao tác" — trong Prisma thật đây là promise lười
      // được `$transaction` gom lại; ta chỉ cần nhận diện được chúng trong mảng ops.
      deleteMany: jest.fn().mockReturnValue({ op: 'deleteMany' }),
      createMany: jest.fn().mockReturnValue({ op: 'createMany' }),
    };
    productRepo = {
      findUnique: jest.fn().mockResolvedValue({ id: PRODUCT_ID }),
    };
    transaction = jest.fn().mockResolvedValue([]);
    publish = jest.fn().mockResolvedValue(undefined);
    isEnabled = jest.fn().mockResolvedValue(true);

    const prisma = {
      productPrice: productPriceRepo,
      product: productRepo,
      $transaction: transaction,
    } as unknown as PrismaService;
    const eventBus = { publish } as unknown as EventBus;
    const featureFlags = { isEnabled } as unknown as FeatureFlagsService;

    service = new ProductPricesService(prisma, eventBus, featureFlags);
  });

  describe('replace — cờ TẮT là chốt chặn đầu tiên', () => {
    it('cờ TẮT ⇒ 409 CONFLICT và $transaction KHÔNG được gọi (chặn TRƯỚC khi chạm DB)', async () => {
      isEnabled.mockResolvedValue(false);

      const err = await catchAppException(
        service.replace(ACTOR_ID, PRODUCT_ID, [{ minQty: 10, price: 100 }]),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      // Ghi âm thầm vào một bảng không ai đọc = tạo dữ liệu ma. Muốn cấu hình ⇒ bật cờ trước.
      expect(transaction).not.toHaveBeenCalled();
      expect(productPriceRepo.deleteMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe('replace — validate', () => {
    it('sản phẩm không tồn tại ⇒ 404 và KHÔNG chạm bậc thang', async () => {
      productRepo.findUnique.mockResolvedValue(null);

      const err = await catchAppException(
        service.replace(ACTOR_ID, 'không-có', [{ minQty: 10, price: 100 }]),
      );

      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(err.getStatus()).toBe(404);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('trùng minQty trong CÙNG payload ⇒ 400 kèm fieldErrors (bắt ở app, không để DB quyết)', async () => {
      const err = await catchAppException(
        service.replace(ACTOR_ID, PRODUCT_ID, [
          { minQty: 10, price: 100 },
          { minQty: 10, price: 90 },
        ]),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.[0].field).toBe('prices');
      // Để DB P2002 quyết ⇒ lỗi nổ SAU khi deleteMany đã chạy trong tx.
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('replace — atomic, cạm bẫy Prisma 7', () => {
    it('PUT [] (xoá hết bậc thang) ⇒ deleteMany CHẠY, createMany KHÔNG được gọi', async () => {
      productPriceRepo.findMany
        .mockResolvedValueOnce([row('pp-1', 10, 2_300_000)]) // before
        .mockResolvedValueOnce([]); // after

      const result = await service.replace(ACTOR_ID, PRODUCT_ID, []);

      expect(productPriceRepo.deleteMany).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID },
      });
      // `createMany({ data: [] })` làm hỏng atomic-replace ở Prisma 7 (revocation im lặng không
      // chạy) — đã cắn một lần. Mảng rỗng là đầu vào HỢP LỆ ở đây, nên đây là đường đi thật.
      expect(productPriceRepo.createMany).not.toHaveBeenCalled();

      // Và bậc thang thật sự TRỐNG sau đó.
      const ops = transaction.mock.calls[0][0] as unknown[];
      expect(ops).toHaveLength(1);
      expect(result).toEqual([]);
    });

    it('PUT có mức ⇒ deleteMany + createMany trong CÙNG một $transaction (nguyên tử)', async () => {
      productPriceRepo.findMany
        .mockResolvedValueOnce([]) // before
        .mockResolvedValueOnce([
          row('pp-1', 10, 2_300_000),
          row('pp-2', 50, 2_150_000),
        ]); // after

      const result = await service.replace(ACTOR_ID, PRODUCT_ID, [
        { minQty: 10, price: 2_300_000 },
        { minQty: 50, price: 2_150_000 },
      ]);

      expect(productPriceRepo.deleteMany).toHaveBeenCalledTimes(1);
      // Ghi ĐÚNG CÁI GÌ, không chỉ "có gọi": `after` là một lần đọc lại từ mock, nên nếu chỉ
      // đếm số lần gọi thì hoán vị `minQty`/`price` (ghi giá 10đ ở ngưỡng 2.3 triệu) hoặc ghi
      // nhầm sang `productId` khác vẫn xanh — bậc thang sai giá đi thẳng vào DB.
      expect(productPriceRepo.createMany).toHaveBeenCalledWith({
        data: [
          { productId: PRODUCT_ID, minQty: 10, price: 2_300_000 },
          { productId: PRODUCT_ID, minQty: 50, price: 2_150_000 },
        ],
      });
      // Cả hai thao tác phải nằm trong MỘT tx — nửa vời (xoá xong mà tạo hỏng) là bậc thang bốc hơi.
      const ops = transaction.mock.calls[0][0] as unknown[];
      expect(ops).toHaveLength(2);
      expect(transaction).toHaveBeenCalledTimes(1);

      expect(result).toEqual([
        { id: 'pp-1', minQty: 10, price: 2_300_000 },
        { id: 'pp-2', minQty: 50, price: 2_150_000 },
      ]);
    });
  });

  describe('replace — event', () => {
    it('publish ProductPricesReplaced SAU commit, before/after là CẢ BẬC THANG', async () => {
      productPriceRepo.findMany
        .mockResolvedValueOnce([row('pp-1', 10, 2_300_000)]) // before
        .mockResolvedValueOnce([row('pp-2', 20, 2_200_000)]); // after

      await service.replace(ACTOR_ID, PRODUCT_ID, [
        { minQty: 20, price: 2_200_000 },
      ]);

      const event = publish.mock.calls[0][0] as ProductPricesReplaced;
      expect(event).toBeInstanceOf(ProductPricesReplaced);
      expect(event.type).toBe('ProductPricesReplaced');
      expect(event.actorAccountId).toBe(ACTOR_ID);
      expect(event.target).toEqual({ type: 'Product', id: PRODUCT_ID });
      // Cả TẬP trước và sau — không phải từng dòng một.
      expect(event.before).toEqual([{ minQty: 10, price: 2_300_000 }]);
      expect(event.after).toEqual([{ minQty: 20, price: 2_200_000 }]);
    });
  });

  describe('findByProduct', () => {
    it('sắp xếp minQty tăng dần', async () => {
      productPriceRepo.findMany.mockResolvedValue([
        row('pp-1', 10, 2_300_000),
        row('pp-2', 50, 2_150_000),
      ]);

      const result = await service.findByProduct(PRODUCT_ID);

      expect(productPriceRepo.findMany.mock.calls[0][0].orderBy).toEqual({
        minQty: 'asc',
      });
      expect(result).toEqual([
        { id: 'pp-1', minQty: 10, price: 2_300_000 },
        { id: 'pp-2', minQty: 50, price: 2_150_000 },
      ]);
    });

    it('sản phẩm không tồn tại ⇒ 404', async () => {
      productRepo.findUnique.mockResolvedValue(null);

      const err = await catchAppException(service.findByProduct('không-có'));

      expect(err.getStatus()).toBe(404);
    });
  });
});
