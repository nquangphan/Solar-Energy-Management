import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { FeatureFlagToggled } from '../src/feature-flags/domain/feature-flag-events';
import {
  FLAG,
  FEATURE_FLAG_KEYS,
} from '../src/feature-flags/domain/feature-flag-registry';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';

/**
 * Unit `FeatureFlagsService` — HERMETIC (mock `PrismaService` + `EventBus`).
 *
 * Phủ ba bất biến của cờ nghiệp vụ:
 *  - VẮNG DÒNG = TẮT (fail-closed) — hệ thống mới cài, bảng rỗng, không seed.
 *  - `listAll` trả MỌI key registry, kể cả key chưa có dòng DB.
 *  - TẮT CỜ KHÔNG XOÁ bậc thang giá (AC-6) — cờ là công tắc ĐỌC, không phải lệnh xoá.
 */

interface FeatureFlagRepoMock {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  upsert: jest.Mock;
}

/** Mock đầy đủ `productPrice` để chứng minh service KHÔNG hề gọi method nào của nó (AC-6). */
interface ProductPriceRepoMock {
  deleteMany: jest.Mock;
  createMany: jest.Mock;
  findMany: jest.Mock;
}

const KEY = FLAG.catalogTieredPricing;
const ACTOR_ID = 'actor-1';

describe('FeatureFlagsService (unit, hermetic)', () => {
  let featureFlagRepo: FeatureFlagRepoMock;
  let productPriceRepo: ProductPriceRepoMock;
  let publish: jest.Mock;
  let service: FeatureFlagsService;

  beforeEach(() => {
    featureFlagRepo = {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    };
    productPriceRepo = {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    };
    publish = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      featureFlag: featureFlagRepo,
      productPrice: productPriceRepo,
    } as unknown as PrismaService;
    const eventBus = { publish } as unknown as EventBus;
    service = new FeatureFlagsService(prisma, eventBus);
  });

  describe('isEnabled — fail-closed', () => {
    it('bảng rỗng (chưa ai bấm cờ bao giờ) ⇒ false, KHÔNG ném lỗi, KHÔNG cần seed', async () => {
      featureFlagRepo.findUnique.mockResolvedValue(null);

      await expect(service.isEnabled(KEY)).resolves.toBe(false);
    });

    it('dòng enabled=true ⇒ true', async () => {
      featureFlagRepo.findUnique.mockResolvedValue({
        key: KEY,
        enabled: true,
        updatedAt: new Date(),
      });

      await expect(service.isEnabled(KEY)).resolves.toBe(true);
    });

    it('dòng enabled=false ⇒ false', async () => {
      featureFlagRepo.findUnique.mockResolvedValue({
        key: KEY,
        enabled: false,
        updatedAt: new Date(),
      });

      await expect(service.isEnabled(KEY)).resolves.toBe(false);
    });
  });

  describe('listAll', () => {
    it('trả ĐỦ key registry kể cả key CHƯA có dòng DB (enabled=false)', async () => {
      // Bảng rỗng. Trả theo DB sẽ ra mảng rỗng ⇒ cờ vô hình với client cho tới lần bấm đầu.
      featureFlagRepo.findMany.mockResolvedValue([]);

      const result = await service.listAll();

      expect(result.map((flag) => flag.key)).toEqual([...FEATURE_FLAG_KEYS]);
      expect(result.every((flag) => flag.enabled === false)).toBe(true);
      expect(result[0].label).toBeTruthy();
    });

    it('cờ có dòng enabled=true ⇒ phản ánh đúng trạng thái', async () => {
      featureFlagRepo.findMany.mockResolvedValue([
        { key: KEY, enabled: true, updatedAt: new Date() },
      ]);

      const result = await service.listAll();

      expect(result.find((flag) => flag.key === KEY)?.enabled).toBe(true);
    });
  });

  describe('setEnabled', () => {
    it('bật cờ ⇒ upsert (tạo dòng nếu chưa có) + publish FeatureFlagToggled SAU commit', async () => {
      featureFlagRepo.findUnique.mockResolvedValue(null); // trước: vắng dòng ⇒ TẮT
      featureFlagRepo.upsert.mockResolvedValue({
        key: KEY,
        enabled: true,
        updatedAt: new Date(),
      });

      const result = await service.setEnabled(ACTOR_ID, KEY, true);

      expect(featureFlagRepo.upsert).toHaveBeenCalledTimes(1);
      expect(result.enabled).toBe(true);

      const event = publish.mock.calls[0][0] as FeatureFlagToggled;
      expect(event).toBeInstanceOf(FeatureFlagToggled);
      expect(event.type).toBe('FeatureFlagToggled');
      expect(event.actorAccountId).toBe(ACTOR_ID);
      // `target.id` là chính TÊN CỜ — cờ không có id uuid riêng.
      expect(event.target).toEqual({ type: 'FeatureFlag', id: KEY });
      expect(event.before).toEqual({ key: KEY, enabled: false });
      expect(event.after).toEqual({ key: KEY, enabled: true });
    });

    it('tắt cờ ⇒ before=true, after=false trong event', async () => {
      featureFlagRepo.findUnique.mockResolvedValue({
        key: KEY,
        enabled: true,
        updatedAt: new Date(),
      });
      featureFlagRepo.upsert.mockResolvedValue({
        key: KEY,
        enabled: false,
        updatedAt: new Date(),
      });

      await service.setEnabled(ACTOR_ID, KEY, false);

      const event = publish.mock.calls[0][0] as FeatureFlagToggled;
      expect(event.before).toEqual({ key: KEY, enabled: true });
      expect(event.after).toEqual({ key: KEY, enabled: false });
    });

    it('AC-6 — TẮT cờ KHÔNG chạm prisma.productPrice ở bất kỳ method nào (bậc thang ngủ đông, không bị xoá)', async () => {
      featureFlagRepo.findUnique.mockResolvedValue({
        key: KEY,
        enabled: true,
        updatedAt: new Date(),
      });
      featureFlagRepo.upsert.mockResolvedValue({
        key: KEY,
        enabled: false,
        updatedAt: new Date(),
      });

      await service.setEnabled(ACTOR_ID, KEY, false);

      // Cờ là công tắc ĐỌC. Nếu tắt cờ xoá dữ liệu, người dùng bấm nhầm sẽ mất bậc thang
      // không hoàn tác được — bật lại cờ phải thấy 3 mức cũ y nguyên.
      expect(productPriceRepo.deleteMany).not.toHaveBeenCalled();
      expect(productPriceRepo.createMany).not.toHaveBeenCalled();
      expect(productPriceRepo.findMany).not.toHaveBeenCalled();
    });
  });
});
