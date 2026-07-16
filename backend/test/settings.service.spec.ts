import { SettingsService } from '../src/settings/settings.service';
import { SystemSettingChanged } from '../src/settings/domain/setting-events';
import { SETTING } from '../src/settings/domain/setting-registry';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { EventBus } from '../src/events/event-bus';

/**
 * Unit `SettingsService` — HERMETIC (mock `PrismaService` + `EventBus`).
 *
 * Phủ ba bất biến của config nghiệp vụ:
 *  - VẮNG ROW = DEFAULT 8 từ registry — hệ thống mới cài, bảng rỗng, không seed.
 *  - `updateVatRate` là upsert đúng PAYLOAD (`where` + `create` + `update`) — assert cái ghi
 *    xuống DB, không đếm số lần gọi mock.
 *  - Event before→after publish SAU write (audit không được ghi sự việc chưa xảy ra, AD-18).
 */

interface SystemSettingRepoMock {
  findUnique: jest.Mock;
  upsert: jest.Mock;
}

const KEY = SETTING.vatRatePercent;
const ACTOR_ID = 'actor-settings-1';

describe('SettingsService (unit, hermetic)', () => {
  let systemSettingRepo: SystemSettingRepoMock;
  let publish: jest.Mock;
  let service: SettingsService;
  /** Nhật ký thứ tự write/publish — chứng minh event đi SAU commit. */
  let thuTu: string[];

  beforeEach(() => {
    thuTu = [];
    systemSettingRepo = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(({ create }) => {
        thuTu.push('write');
        return Promise.resolve({ ...create, updatedAt: new Date() });
      }),
    };
    publish = jest.fn().mockImplementation(() => {
      thuTu.push('publish');
      return Promise.resolve();
    });
    const prisma = {
      systemSetting: systemSettingRepo,
    } as unknown as PrismaService;
    const eventBus = { publish } as unknown as EventBus;
    service = new SettingsService(prisma, eventBus);
  });

  describe('vatRatePercent — default từ registry', () => {
    it('bảng rỗng (chưa ai cấu hình bao giờ) ⇒ 8, KHÔNG ném lỗi, KHÔNG cần seed', async () => {
      systemSettingRepo.findUnique.mockResolvedValue(null);

      await expect(service.vatRatePercent()).resolves.toBe(8);
    });

    it('row value "10" ⇒ 10 (parse String → number ở service)', async () => {
      systemSettingRepo.findUnique.mockResolvedValue({
        key: KEY,
        value: '10',
        updatedAt: new Date(),
      });

      await expect(service.vatRatePercent()).resolves.toBe(10);
    });

    it('row value "0" ⇒ 0 (0% hợp lệ, không rơi về default)', async () => {
      systemSettingRepo.findUnique.mockResolvedValue({
        key: KEY,
        value: '0',
        updatedAt: new Date(),
      });

      await expect(service.vatRatePercent()).resolves.toBe(0);
    });
  });

  describe('updateVatRate', () => {
    it('upsert đúng PAYLOAD: where theo key registry, create + update cùng value String', async () => {
      systemSettingRepo.findUnique.mockResolvedValue(null);
      systemSettingRepo.upsert.mockResolvedValue({
        key: KEY,
        value: '10',
        updatedAt: new Date(),
      });

      const result = await service.updateVatRate(ACTOR_ID, 10);

      expect(result).toBe(10);
      expect(systemSettingRepo.upsert).toHaveBeenCalledWith({
        where: { key: KEY },
        create: { key: KEY, value: '10' },
        update: { value: '10' },
      });
    });

    it('event before→after: row vắng ⇒ before là DEFAULT hiệu lực "8" (audit đọc được 8 → 10)', async () => {
      systemSettingRepo.findUnique.mockResolvedValue(null);
      systemSettingRepo.upsert.mockResolvedValue({
        key: KEY,
        value: '10',
        updatedAt: new Date(),
      });

      await service.updateVatRate(ACTOR_ID, 10);

      const event = publish.mock.calls[0][0] as SystemSettingChanged;
      expect(event).toBeInstanceOf(SystemSettingChanged);
      expect(event.type).toBe('SystemSettingChanged');
      expect(event.actorAccountId).toBe(ACTOR_ID);
      // `target.id` là chính KEY — setting không có id uuid riêng.
      expect(event.target).toEqual({ type: 'SystemSetting', id: KEY });
      expect(event.before).toEqual({ key: KEY, value: '8' });
      expect(event.after).toEqual({ key: KEY, value: '10' });
    });

    it('row đã có "10" đổi sang 12 ⇒ before "10", after "12"', async () => {
      systemSettingRepo.findUnique.mockResolvedValue({
        key: KEY,
        value: '10',
        updatedAt: new Date(),
      });
      systemSettingRepo.upsert.mockResolvedValue({
        key: KEY,
        value: '12',
        updatedAt: new Date(),
      });

      await service.updateVatRate(ACTOR_ID, 12);

      const event = publish.mock.calls[0][0] as SystemSettingChanged;
      expect(event.before).toEqual({ key: KEY, value: '10' });
      expect(event.after).toEqual({ key: KEY, value: '12' });
    });

    it('publish đi SAU write — audit không được ghi sự việc chưa xảy ra (AD-18)', async () => {
      systemSettingRepo.findUnique.mockResolvedValue(null);

      await service.updateVatRate(ACTOR_ID, 10);

      expect(thuTu).toEqual(['write', 'publish']);
    });
  });
});
