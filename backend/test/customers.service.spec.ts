import type { Customer, CustomerSource } from '@prisma/client';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { CustomersService } from '../src/customers/customers.service';
import { CUST_TYPE } from '../src/customers/domain/customer-type';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Unit test `CustomersService` — Prisma mock, EventBus mock.
 *
 * Test ở đây canh **PAYLOAD GHI DB**, không chỉ đếm số lần gọi: bài học CRITICAL của review 3.2
 * là một test đếm-lần-gọi vẫn xanh 37/37 khi hai field bị hoán vị. Với story này, field quan
 * trọng nhất là `sdt` — nó là KHOÁ CHÍNH, và nếu service ghi chuỗi THÔ thay vì chuỗi đã chuẩn
 * hoá thì bất biến "một SĐT = một khách" vỡ mà không test nào kêu, trừ test dưới đây.
 */
describe('CustomersService', () => {
  const ACTOR = 'acc-1';
  const SDT_THO = '0912 345 678';
  const SDT_E164 = '+84912345678';

  const NGUON_FACEBOOK: CustomerSource = {
    id: 'src-fb',
    name: 'Facebook',
    description: 'Từ quảng cáo Facebook.',
    active: true,
    sortOrder: 1,
    isOther: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const NGUON_KHAC: CustomerSource = {
    ...NGUON_FACEBOOK,
    id: 'src-khac',
    name: 'Khác',
    sortOrder: 99,
    isOther: true,
  };

  const KHACH: Customer = {
    sdt: SDT_E164,
    custType: CUST_TYPE.caNhan,
    name: 'Nguyễn Văn A',
    cccd: null,
    taxCode: null,
    address: null,
    bankAccount: null,
    sourceId: NGUON_FACEBOOK.id,
    sourceNote: null,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };

  const customerRepo = {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  };
  const customerSourceRepo = { findUnique: jest.fn() };
  const prisma = {
    customer: customerRepo,
    customerSource: customerSourceRepo,
  } as unknown as PrismaService;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = new CustomersService(prisma, eventBus as unknown as EventBus);

  /** Body hợp lệ tối thiểu — bốn field bắt buộc, không hơn. */
  const bodyHopLe = {
    sdt: SDT_THO,
    custType: CUST_TYPE.caNhan,
    name: 'Nguyễn Văn A',
    sourceId: NGUON_FACEBOOK.id,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    customerSourceRepo.findUnique.mockResolvedValue(NGUON_FACEBOOK);
    customerRepo.create.mockResolvedValue(KHACH);
    customerRepo.update.mockResolvedValue(KHACH);
    customerRepo.findUnique.mockResolvedValue(KHACH);
  });

  /** Bắt `AppException` và trả về nó để assert `errorCode`/`fieldErrors`/status. */
  async function bat(promise: Promise<unknown>): Promise<AppException> {
    try {
      await promise;
    } catch (err: unknown) {
      return err as AppException;
    }
    throw new Error('Kỳ vọng ném AppException nhưng không có lỗi nào.');
  }

  describe('AC-1 — SĐT ghi xuống DB là chuỗi ĐÃ CHUẨN HOÁ, không phải chuỗi thô', () => {
    it('create ghi ĐÚNG payload, `sdt` là E.164 (không phải raw)', async () => {
      await service.create(ACTOR, {
        ...bodyHopLe,
        cccd: '079201001234',
        address: '12 Nguyễn Huệ',
      });

      // Assert TOÀN BỘ `data` — không chỉ "đã gọi create". Hoán vị hai field, hay tuồn `raw`
      // vào PK, đều phải làm test này ĐỎ.
      expect(customerRepo.create).toHaveBeenCalledWith({
        data: {
          sdt: SDT_E164,
          custType: CUST_TYPE.caNhan,
          name: 'Nguyễn Văn A',
          cccd: '079201001234',
          taxCode: null,
          address: '12 Nguyễn Huệ',
          bankAccount: null,
          sourceId: NGUON_FACEBOOK.id,
          sourceNote: null,
        },
      });
    });

    it('mọi dạng thô của cùng một số ⇒ CÙNG một PK ghi xuống DB', async () => {
      for (const raw of [
        '0912345678',
        '0912.345.678',
        '84912345678',
        SDT_E164,
      ]) {
        customerRepo.create.mockClear();
        await service.create(ACTOR, { ...bodyHopLe, sdt: raw });
        expect(customerRepo.create.mock.calls[0][0].data.sdt).toBe(SDT_E164);
      }
    });

    it('findOne tra bằng SĐT thô ⇒ tìm bằng E.164 (cùng bộ chuẩn hoá với lúc ghi)', async () => {
      await service.findOne('0912 345 678');

      expect(customerRepo.findUnique).toHaveBeenCalledWith({
        where: { sdt: SDT_E164 },
      });
    });
  });

  describe('AC-2 — SĐT không hợp lệ ⇒ 400, KHÔNG chạm DB', () => {
    for (const rac of ['abc', '123', '+16505550123', '']) {
      it(`create "${rac}" ⇒ 400 VALIDATION_ERROR field sdt`, async () => {
        const err = await bat(
          service.create(ACTOR, { ...bodyHopLe, sdt: rac }),
        );

        expect(err).toBeInstanceOf(AppException);
        expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
        expect(err.getStatus()).toBe(400);
        expect(err.fieldErrors?.[0].field).toBe('sdt');
        expect(customerRepo.create).not.toHaveBeenCalled();
        expect(eventBus.publish).not.toHaveBeenCalled();
      });
    }

    it('findOne với SĐT rác ⇒ 400 (không phải 404) — chưa từng là khoá hợp lệ', async () => {
      const err = await bat(service.findOne('abc'));

      expect(err.getStatus()).toBe(400);
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('AC-3 — SĐT trùng: P2002 từ DB ⇒ 409, KHÔNG 500', () => {
    it('create ⇒ 409 CONFLICT kèm fieldErrors trỏ ô sdt', async () => {
      customerRepo.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const err = await bat(service.create(ACTOR, bodyHopLe));

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(err.fieldErrors?.[0]).toMatchObject({
        field: 'sdt',
        code: 'isUnique',
      });
      // Write hỏng ⇒ KHÔNG có event: audit không được ghi cho việc chưa xảy ra.
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('lỗi DB KHÁC (không phải P2002) KHÔNG bị nuốt thành 409', async () => {
      const loiKhac = Object.assign(new Error('connection reset'), {
        code: 'P1001',
      });
      customerRepo.create.mockRejectedValue(loiKhac);

      await expect(service.create(ACTOR, bodyHopLe)).rejects.toBe(loiKhac);
    });
  });

  describe('AC-4 — field lạc LOẠI KHÁCH ⇒ 400', () => {
    const matran: readonly [string, string][] = [
      [CUST_TYPE.caNhan, 'taxCode'],
      [CUST_TYPE.caNhan, 'bankAccount'],
      [CUST_TYPE.thuongMai, 'cccd'],
    ];

    for (const [custType, field] of matran) {
      it(`${custType} + ${field} ⇒ 400, KHÔNG ghi DB`, async () => {
        const err = await bat(
          service.create(ACTOR, {
            ...bodyHopLe,
            custType,
            [field]: 'giá-trị-nào-đó',
          }),
        );

        expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
        expect(err.fieldErrors?.[0].field).toBe(field);
        expect(customerRepo.create).not.toHaveBeenCalled();
      });
    }

    it('CA_NHAN + cccd ⇒ hợp lệ (field ĐÚNG loại không bị chặn oan)', async () => {
      await service.create(ACTOR, {
        ...bodyHopLe,
        custType: CUST_TYPE.caNhan,
        cccd: '079201001234',
      });

      expect(customerRepo.create).toHaveBeenCalled();
    });

    it('THUONG_MAI + taxCode + bankAccount ⇒ hợp lệ', async () => {
      await service.create(ACTOR, {
        ...bodyHopLe,
        custType: CUST_TYPE.thuongMai,
        taxCode: '0312345678',
        bankAccount: '0071000123456',
      });

      expect(customerRepo.create).toHaveBeenCalled();
    });

    it('field lạc gửi kèm `null` ⇒ KHÔNG chặn ("không có" thì không phải vi phạm)', async () => {
      await service.create(ACTOR, {
        ...bodyHopLe,
        custType: CUST_TYPE.caNhan,
        taxCode: null,
      });

      expect(customerRepo.create).toHaveBeenCalled();
    });

    it('update đổi loại khách mà field cũ còn sót ⇒ 400 (kiểm trên bản ghi HIỆU LỰC, không chỉ body)', async () => {
      // Khách Cá nhân đang có CCCD; đổi sang Thương mại mà không xoá CCCD ⇒ bản ghi kết quả sai.
      customerRepo.findUnique.mockResolvedValue({
        ...KHACH,
        cccd: '079201001234',
      });

      const err = await bat(
        service.update(ACTOR, SDT_E164, { custType: CUST_TYPE.thuongMai }),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0].field).toBe('cccd');
      expect(customerRepo.update).not.toHaveBeenCalled();
    });

    it('update đổi loại khách KÈM xoá field cũ (`cccd: null`) ⇒ hợp lệ (đường ra tồn tại)', async () => {
      customerRepo.findUnique.mockResolvedValue({
        ...KHACH,
        cccd: '079201001234',
      });

      await service.update(ACTOR, SDT_E164, {
        custType: CUST_TYPE.thuongMai,
        cccd: null,
        taxCode: '0312345678',
      });

      expect(customerRepo.update.mock.calls[0][0].data).toMatchObject({
        custType: CUST_TYPE.thuongMai,
        cccd: null,
        taxCode: '0312345678',
      });
    });
  });

  describe('AC-5 — sourceId bắt buộc và phải TỒN TẠI', () => {
    it('sourceId trỏ tới nguồn không tồn tại ⇒ 400 (KHÔNG 500 do FK violation)', async () => {
      customerSourceRepo.findUnique.mockResolvedValue(null);

      const err = await bat(
        service.create(ACTOR, { ...bodyHopLe, sourceId: 'src-ma' }),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.[0].field).toBe('sourceId');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('AC-6 — sourceNote bắt buộc khi nguồn có cờ isOther', () => {
    it('nguồn isOther + thiếu sourceNote ⇒ 400 field sourceNote', async () => {
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      const err = await bat(
        service.create(ACTOR, { ...bodyHopLe, sourceId: NGUON_KHAC.id }),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0].field).toBe('sourceNote');
      expect(customerRepo.create).not.toHaveBeenCalled();
    });

    it('nguồn isOther + sourceNote toàn khoảng trắng ⇒ 400 (khoảng trắng không phải câu trả lời)', async () => {
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      const err = await bat(
        service.create(ACTOR, {
          ...bodyHopLe,
          sourceId: NGUON_KHAC.id,
          sourceNote: '   ',
        }),
      );

      expect(err.fieldErrors?.[0].field).toBe('sourceNote');
    });

    it('nguồn isOther + có sourceNote ⇒ ghi được', async () => {
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      await service.create(ACTOR, {
        ...bodyHopLe,
        sourceId: NGUON_KHAC.id,
        sourceNote: 'Khách cũ giới thiệu',
      });

      expect(customerRepo.create.mock.calls[0][0].data.sourceNote).toBe(
        'Khách cũ giới thiệu',
      );
    });

    it('nguồn KHÔNG isOther + thiếu sourceNote ⇒ hợp lệ (không đòi oan)', async () => {
      await service.create(ACTOR, bodyHopLe);

      expect(customerRepo.create).toHaveBeenCalled();
    });

    it('luật đọc CỜ isOther, KHÔNG so tên "Khác"', async () => {
      // Nguồn TÊN là "Khác" nhưng cờ isOther = false ⇒ KHÔNG đòi sourceNote. Một implementation
      // so chuỗi tên sẽ đỏ ở đây.
      customerSourceRepo.findUnique.mockResolvedValue({
        ...NGUON_KHAC,
        isOther: false,
      });

      await service.create(ACTOR, { ...bodyHopLe, sourceId: NGUON_KHAC.id });

      expect(customerRepo.create).toHaveBeenCalled();
    });

    it('update đổi sang nguồn isOther mà chưa có sourceNote ⇒ 400 (kiểm lại trên nguồn MỚI)', async () => {
      customerRepo.findUnique.mockResolvedValue({ ...KHACH, sourceNote: null });
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      const err = await bat(
        service.update(ACTOR, SDT_E164, { sourceId: NGUON_KHAC.id }),
      );

      expect(err.fieldErrors?.[0].field).toBe('sourceNote');
      expect(customerRepo.update).not.toHaveBeenCalled();
    });

    it('update XOÁ sourceNote (`null`) khi nguồn hiện tại là isOther ⇒ 400 (không có cửa sau)', async () => {
      // Khách đang ở nguồn "Khác" và CÓ ghi chú; PATCH xoá ghi chú mà giữ nguyên nguồn ⇒ bản ghi
      // kết thúc ở đúng trạng thái AC-6 cấm. Luật phải chạy trên giá trị HIỆU LỰC sau PATCH, chứ
      // không chỉ trên nguồn mới.
      customerRepo.findUnique.mockResolvedValue({
        ...KHACH,
        sourceId: NGUON_KHAC.id,
        sourceNote: 'Khách cũ giới thiệu',
      });
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      const err = await bat(
        service.update(ACTOR, SDT_E164, { sourceNote: null }),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0].field).toBe('sourceNote');
      expect(customerRepo.update).not.toHaveBeenCalled();
    });

    it('update đổi sang nguồn isOther KÈM sourceNote ⇒ ghi được', async () => {
      customerSourceRepo.findUnique.mockResolvedValue(NGUON_KHAC);

      await service.update(ACTOR, SDT_E164, {
        sourceId: NGUON_KHAC.id,
        sourceNote: 'Hội chợ triển lãm',
      });

      expect(customerRepo.update.mock.calls[0][0].data).toMatchObject({
        sourceId: NGUON_KHAC.id,
        sourceNote: 'Hội chợ triển lãm',
      });
    });
  });

  describe('AC-7 — sdt bất biến: update KHÔNG bao giờ ghi cột sdt', () => {
    it('update ghi payload KHÔNG chứa `sdt`, và where trỏ đúng PK', async () => {
      await service.update(ACTOR, SDT_THO, { name: 'Tên mới' });

      expect(customerRepo.update).toHaveBeenCalledWith({
        where: { sdt: SDT_E164 },
        data: {
          custType: undefined,
          name: 'Tên mới',
          cccd: undefined,
          taxCode: undefined,
          address: undefined,
          bankAccount: undefined,
          sourceId: undefined,
          sourceNote: undefined,
        },
      });
      expect(customerRepo.update.mock.calls[0][0].data).not.toHaveProperty(
        'sdt',
      );
    });

    it('update khách không tồn tại ⇒ 404, KHÔNG ghi DB, KHÔNG ghi audit', async () => {
      customerRepo.findUnique.mockResolvedValue(null);

      const err = await bat(service.update(ACTOR, SDT_E164, { name: 'x' }));

      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(customerRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('findAll — danh sách khách hàng', () => {
    it('sắp MỚI NHẤT TRƯỚC, và KHÔNG lọc mất bản ghi nào', async () => {
      // Thứ tự là hợp đồng, không phải trang trí: sale mở màn khách để tìm người vừa nhập xong.
      // Không assert `orderBy` thì ai đổi sang `asc` cũng không có test nào kêu.
      customerRepo.findMany.mockResolvedValue([KHACH]);

      const found = await service.findAll();

      expect(customerRepo.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(found).toEqual([KHACH]);
    });
  });

  describe('AC-8 — event publish SAU khi write commit', () => {
    it('CustomerCreated mang snapshot đầy đủ, target.id = SĐT đã chuẩn hoá', async () => {
      await service.create(ACTOR, bodyHopLe);

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = eventBus.publish.mock.calls[0][0];
      expect(event.type).toBe('CustomerCreated');
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.target).toEqual({ type: 'Customer', id: SDT_E164 });
      expect(event.after).toMatchObject({
        sdt: SDT_E164,
        custType: CUST_TYPE.caNhan,
        name: KHACH.name,
        sourceId: NGUON_FACEBOOK.id,
      });
    });

    it('publish xảy ra SAU prisma.create (không phải trước/song song)', async () => {
      const thuTu: string[] = [];
      customerRepo.create.mockImplementation(async () => {
        thuTu.push('db');
        return KHACH;
      });
      eventBus.publish.mockImplementation(async () => {
        thuTu.push('event');
      });

      await service.create(ACTOR, bodyHopLe);

      expect(thuTu).toEqual(['db', 'event']);
    });

    it('CustomerUpdated mang CẢ before lẫn after', async () => {
      customerRepo.update.mockResolvedValue({ ...KHACH, name: 'Tên mới' });

      await service.update(ACTOR, SDT_E164, { name: 'Tên mới' });

      const event = eventBus.publish.mock.calls[0][0];
      expect(event.type).toBe('CustomerUpdated');
      expect(event.before.name).toBe(KHACH.name);
      expect(event.after.name).toBe('Tên mới');
    });
  });
});
