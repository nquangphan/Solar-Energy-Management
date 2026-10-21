import { SettingsService } from '../src/settings/settings.service';
import { SystemSettingChanged } from '../src/settings/domain/setting-events';
import type { CompanyLegalEntity } from '../src/settings/domain/company-legal-entity';
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

describe('SettingsService — company legal entity (unit, hermetic)', () => {
  const EMPTY: CompanyLegalEntity = {
    legalName: '',
    taxCode: '',
    address: '',
    representative: '',
    representativeTitle: '',
    phone: '',
    bankAccount: '',
  };
  let findMany: jest.Mock;
  let upsert: jest.Mock;
  let transaction: jest.Mock;
  let publish: jest.Mock;
  let service: SettingsService;
  let order: string[];

  beforeEach(() => {
    order = [];
    findMany = jest.fn().mockResolvedValue([]);
    upsert = jest.fn().mockImplementation(({ create }) => ({ upsert: create }));
    transaction = jest.fn().mockImplementation((ops: unknown[]) => {
      order.push('commit');
      return Promise.resolve(ops);
    });
    publish = jest.fn().mockImplementation(() => {
      order.push('publish');
      return Promise.resolve();
    });
    const prisma = {
      systemSetting: { findMany, upsert },
      $transaction: transaction,
    } as unknown as PrismaService;
    service = new SettingsService(prisma, { publish } as unknown as EventBus);
  });

  it('no rows ⇒ every field empty, ONE read of the 7 company.* keys', async () => {
    await expect(service.companyLegalEntity()).resolves.toEqual(EMPTY);
    expect(findMany).toHaveBeenCalledTimes(1);
    const keys = findMany.mock.calls[0][0].where.key.in as string[];
    expect([...keys].sort()).toEqual(
      [
        SETTING.companyLegalName,
        SETTING.companyTaxCode,
        SETTING.companyAddress,
        SETTING.companyRepresentative,
        SETTING.companyRepresentativeTitle,
        SETTING.companyPhone,
        SETTING.companyBankAccount,
      ].sort(),
    );
  });

  it('rows map back to their fields', async () => {
    findMany.mockResolvedValue([
      { key: SETTING.companyLegalName, value: 'CÔNG TY A' },
      { key: SETTING.companyTaxCode, value: '0123' },
    ]);

    await expect(service.companyLegalEntity()).resolves.toEqual({
      ...EMPTY,
      legalName: 'CÔNG TY A',
      taxCode: '0123',
    });
  });

  it('two changed keys ⇒ 2 upserts in ONE transaction, then exactly 2 events with before ""', async () => {
    const result = await service.updateCompanyLegalEntity(ACTOR_ID, {
      ...EMPTY,
      legalName: '  CÔNG TY A  ',
      taxCode: '0123',
    });

    expect(result).toEqual({
      ...EMPTY,
      legalName: 'CÔNG TY A',
      taxCode: '0123',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith({
      where: { key: SETTING.companyLegalName },
      create: { key: SETTING.companyLegalName, value: 'CÔNG TY A' },
      update: { value: 'CÔNG TY A' },
    });
    expect(publish).toHaveBeenCalledTimes(2);
    const events = publish.mock.calls.map(
      (call) => call[0] as SystemSettingChanged,
    );
    expect(events.map((e) => [e.target, e.before, e.after])).toEqual([
      [
        { type: 'SystemSetting', id: SETTING.companyLegalName },
        { key: SETTING.companyLegalName, value: '' },
        { key: SETTING.companyLegalName, value: 'CÔNG TY A' },
      ],
      [
        { type: 'SystemSetting', id: SETTING.companyTaxCode },
        { key: SETTING.companyTaxCode, value: '' },
        { key: SETTING.companyTaxCode, value: '0123' },
      ],
    ]);
    expect(order).toEqual(['commit', 'publish', 'publish']);
  });

  it('same values again (after trim) ⇒ 0 upserts, 0 events', async () => {
    findMany.mockResolvedValue([
      { key: SETTING.companyLegalName, value: 'CÔNG TY A' },
    ]);

    const result = await service.updateCompanyLegalEntity(ACTOR_ID, {
      ...EMPTY,
      legalName: ' CÔNG TY A ',
    });

    expect(result).toEqual({ ...EMPTY, legalName: 'CÔNG TY A' });
    expect(transaction).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('clearing a field is a change: before = old value, after = ""', async () => {
    findMany.mockResolvedValue([{ key: SETTING.companyPhone, value: '0909' }]);

    await service.updateCompanyLegalEntity(ACTOR_ID, EMPTY);

    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0] as SystemSettingChanged;
    expect(event.before).toEqual({ key: SETTING.companyPhone, value: '0909' });
    expect(event.after).toEqual({ key: SETTING.companyPhone, value: '' });
  });

  it('transaction fails ⇒ no event', async () => {
    transaction.mockRejectedValue(new Error('db down'));

    await expect(
      service.updateCompanyLegalEntity(ACTOR_ID, { ...EMPTY, phone: '1' }),
    ).rejects.toThrow('db down');
    expect(publish).not.toHaveBeenCalled();
  });
});
