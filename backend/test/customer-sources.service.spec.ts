import type { CustomerSource } from '@prisma/client';
import { CustomerSourcesService } from '../src/customers/customer-sources.service';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import {
  CustomerSourceCreated,
  CustomerSourceDeactivated,
  CustomerSourceReactivated,
  CustomerSourceUpdated,
} from '../src/customers/domain/customer-source-events';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Unit test của `CustomerSourcesService` — hermetic (mock Prisma + EventBus).
 *
 * 🔴 MỌI ca khẳng định PAYLOAD truyền vào Prisma (`data`/`where`), KHÔNG đếm số lần gọi. Bài học
 * CRITICAL của review 3.2: `toHaveBeenCalledTimes(1)` xanh y hệt nhau dù service ghi đúng cột hay
 * ghi nhầm cột — nó chỉ chứng minh "có gọi", không chứng minh "gọi đúng cái gì".
 */
describe('CustomerSourcesService', () => {
  const ACTOR = 'acc-admin-1';

  const FACEBOOK: CustomerSource = {
    id: '5f4d3c2b-1a09-4e8d-9c7b-6a5f4e3d2c1b',
    name: 'Facebook',
    description: 'Từ quảng cáo Facebook.',
    active: true,
    sortOrder: 1,
    isOther: false,
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };
  const KHAC: CustomerSource = {
    ...FACEBOOK,
    id: '11111111-2222-4333-8444-555555555555',
    name: 'Khác',
    description: 'Nguồn không nằm trong danh sách.',
    sortOrder: 99,
    isOther: true,
  };
  const DA_TAT: CustomerSource = {
    ...FACEBOOK,
    id: '99999999-8888-4777-8666-555555555555',
    name: 'Đại lý',
    active: false,
    sortOrder: 4,
  };

  const sourceRepo = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const publish = jest.fn();

  const service = new CustomerSourcesService(
    { customerSource: sourceRepo } as unknown as PrismaService,
    { publish, subscribe: jest.fn() } as unknown as EventBus,
  );

  /** Event duy nhất đã publish. Ném nếu số lượng khác 1 — "đúng một event" là một phần hợp đồng. */
  function eventDuyNhat(): unknown {
    expect(publish).toHaveBeenCalledTimes(1);
    return publish.mock.calls[0][0];
  }

  /** Payload `data` mà service truyền xuống Prisma — thứ mà mọi assert ở đây soi. */
  function dataGhi(fn: jest.Mock): Record<string, unknown> {
    return fn.mock.calls[0][0].data as Record<string, unknown>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    sourceRepo.findUnique.mockResolvedValue(FACEBOOK);
    sourceRepo.findFirst.mockResolvedValue(KHAC); // max(sortOrder) = 99
    sourceRepo.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...FACEBOOK,
        id: 'nguon-moi',
        ...data,
      }),
    );
    sourceRepo.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...FACEBOOK,
        ...data,
      }),
    );
    publish.mockResolvedValue(undefined);
  });

  describe('create — AC-1', () => {
    it('sortOrder VẮNG ⇒ backend tự tính max + 1 (cột NOT NULL, không default ⇒ undefined là 500)', async () => {
      await service.create(ACTOR, { name: 'TikTok' });

      expect(sourceRepo.findFirst).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'desc' },
      });
      expect(dataGhi(sourceRepo.create).sortOrder).toBe(100); // 99 + 1
    });

    it('bảng RỖNG ⇒ nguồn đầu tiên nhận sortOrder 0 (không phải NaN)', async () => {
      sourceRepo.findFirst.mockResolvedValue(null);

      await service.create(ACTOR, { name: 'TikTok' });

      expect(dataGhi(sourceRepo.create).sortOrder).toBe(0);
    });

    it('sortOrder CÓ MẶT ⇒ dùng đúng số đó, KHÔNG hỏi DB', async () => {
      await service.create(ACTOR, { name: 'TikTok', sortOrder: 5 });

      expect(sourceRepo.findFirst).not.toHaveBeenCalled();
      expect(dataGhi(sourceRepo.create).sortOrder).toBe(5);
    });

    it('🔴 isOther LUÔN LUÔN false — kể cả khi client cố nhét cờ vào body', async () => {
      // Cờ không có trong DTO nên `ValidationPipe` (whitelist) đã cắt nó ở tầng HTTP. Đây là
      // hàng rào THỨ HAI, ở tầng service: kể cả một object lọt qua mang `isOther: true`, cột ghi
      // xuống DB vẫn là `false`. Bất biến "đúng một dòng Khác" không được phép phụ thuộc vào
      // việc pipe có bật `whitelist` hay không.
      await service.create(ACTOR, {
        name: 'Nguồn giả mạo',
        isOther: true,
      } as never);

      expect(dataGhi(sourceRepo.create).isOther).toBe(false);
    });

    it('description vắng ⇒ ghi null (cột nullable), name ghi nguyên văn', async () => {
      await service.create(ACTOR, { name: 'TikTok', sortOrder: 5 });

      expect(dataGhi(sourceRepo.create)).toEqual({
        name: 'TikTok',
        description: null,
        sortOrder: 5,
        isOther: false,
      });
    });

    it('name trùng (P2002 từ Postgres) ⇒ 409 CONFLICT + fieldErrors trỏ ô name', async () => {
      sourceRepo.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(
        service.create(ACTOR, { name: 'Facebook', sortOrder: 1 }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.CONFLICT,
        fieldErrors: [{ field: 'name', code: 'isUnique' }],
      });
      expect(publish).not.toHaveBeenCalled();
    });

    it('lỗi KHÁC P2002 ⇒ ném nguyên (không nuốt thành 409 oan)', async () => {
      const loiLa = new Error('mất kết nối DB');
      sourceRepo.create.mockRejectedValue(loiLa);

      await expect(service.create(ACTOR, { name: 'TikTok' })).rejects.toBe(
        loiLa,
      );
    });

    it('publish ĐÚNG MỘT CustomerSourceCreated, snapshot = dòng vừa tạo', async () => {
      await service.create(ACTOR, { name: 'TikTok', sortOrder: 5 });

      const event = eventDuyNhat() as CustomerSourceCreated;
      expect(event).toBeInstanceOf(CustomerSourceCreated);
      expect(event.type).toBe('CustomerSourceCreated');
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.target).toEqual({ type: 'CustomerSource', id: 'nguon-moi' });
      expect(event.after).toMatchObject({
        name: 'TikTok',
        sortOrder: 5,
        isOther: false,
      });
    });
  });

  describe('update — AC-2', () => {
    it('CHỈ field có mặt mới xuống DB (vắng ⇒ undefined ⇒ Prisma bỏ qua cột)', async () => {
      await service.update(ACTOR, FACEBOOK.id, { name: 'Facebook Ads' });

      expect(sourceRepo.update.mock.calls[0][0].where).toEqual({
        id: FACEBOOK.id,
      });
      expect(dataGhi(sourceRepo.update)).toEqual({
        name: 'Facebook Ads',
        description: undefined,
        sortOrder: undefined,
      });
    });

    it('description: null ⇒ XOÁ mô tả (cột nullable — null là giá trị nghiệp vụ)', async () => {
      await service.update(ACTOR, FACEBOOK.id, { description: null });

      expect(dataGhi(sourceRepo.update).description).toBeNull();
    });

    it('🔴 dòng isOther ĐỔI TÊN ĐƯỢC — luật đọc CỜ, không đọc tên (điểm mấu chốt của thiết kế)', async () => {
      sourceRepo.findUnique.mockResolvedValue(KHAC);
      sourceRepo.update.mockResolvedValue({ ...KHAC, name: 'Nguồn khác' });

      const updated = await service.update(ACTOR, KHAC.id, {
        name: 'Nguồn khác',
      });

      expect(updated.name).toBe('Nguồn khác');
      // Đổi tên KHÔNG được phép làm rơi cờ — rơi cờ là luật `sourceNote` của 3.3 sập.
      expect(dataGhi(sourceRepo.update)).not.toHaveProperty('isOther');
      expect(updated.isOther).toBe(true);
    });

    it('KHÔNG BAO GIỜ ghi cột active/isOther qua PATCH (tắt/bật đi route riêng)', async () => {
      await service.update(ACTOR, FACEBOOK.id, {
        name: 'X',
        active: false,
        isOther: true,
      } as never);

      const data = dataGhi(sourceRepo.update);
      expect(data).not.toHaveProperty('active');
      expect(data).not.toHaveProperty('isOther');
    });

    it('id không tồn tại ⇒ 404 NOT_FOUND, KHÔNG chạm update', async () => {
      sourceRepo.findUnique.mockResolvedValue(null);

      await expect(
        service.update(ACTOR, 'id-ma', { name: 'X' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NOT_FOUND });
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('🔴 body RỖNG ⇒ không ghi DB, KHÔNG publish (event before===after là audit nói dối)', async () => {
      const ket_qua = await service.update(ACTOR, FACEBOOK.id, {});

      expect(ket_qua).toEqual(FACEBOOK);
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('🔴 gửi lại Y HỆT giá trị cũ ⇒ không ghi DB, KHÔNG publish (form web save mà không sửa gì)', async () => {
      const ket_qua = await service.update(ACTOR, FACEBOOK.id, {
        name: FACEBOOK.name,
        description: FACEBOOK.description,
        sortOrder: FACEBOOK.sortOrder,
      });

      expect(ket_qua).toEqual(FACEBOOK);
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('CHỈ MỘT field đổi thật (giữa các field gửi lại y hệt) ⇒ VẪN ghi DB và publish', async () => {
      // Rào chắn cho early-return ở trên: nó phải bắt "không có gì đổi", không được nuốt luôn ca
      // "một thứ có đổi". Bỏ vế `sortOrder` khỏi điều kiện thì test này đỏ.
      await service.update(ACTOR, FACEBOOK.id, {
        name: FACEBOOK.name,
        sortOrder: FACEBOOK.sortOrder + 1,
      });

      expect(dataGhi(sourceRepo.update).sortOrder).toBe(FACEBOOK.sortOrder + 1);
      expect(eventDuyNhat()).toBeInstanceOf(CustomerSourceUpdated);
    });

    it('name trùng dòng khác ⇒ 409 + fieldErrors', async () => {
      sourceRepo.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(
        service.update(ACTOR, FACEBOOK.id, { name: 'Zalo' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.CONFLICT,
        fieldErrors: [{ field: 'name', code: 'isUnique' }],
      });
      expect(publish).not.toHaveBeenCalled();
    });

    it('publish ĐÚNG MỘT CustomerSourceUpdated mang snapshot TRƯỚC → SAU', async () => {
      sourceRepo.update.mockResolvedValue({
        ...FACEBOOK,
        name: 'Facebook Ads',
      });

      await service.update(ACTOR, FACEBOOK.id, { name: 'Facebook Ads' });

      const event = eventDuyNhat() as CustomerSourceUpdated;
      expect(event).toBeInstanceOf(CustomerSourceUpdated);
      expect(event.before.name).toBe('Facebook');
      expect(event.after.name).toBe('Facebook Ads');
      expect(event.target).toEqual({
        type: 'CustomerSource',
        id: FACEBOOK.id,
      });
    });
  });

  describe('deactivate — AC-3 (soft-delete, KHÔNG BAO GIỜ hard-delete)', () => {
    it('dòng đang bật ⇒ ghi active:false (KHÔNG gọi delete)', async () => {
      await service.deactivate(ACTOR, FACEBOOK.id);

      expect(sourceRepo.update.mock.calls[0][0]).toEqual({
        where: { id: FACEBOOK.id },
        data: { active: false },
      });
      // Luật "KHÔNG BAO GIỜ hard-delete" được canh bởi source-guard
      // `no-hard-delete-customer-source.spec.ts` — quét `src/` THẬT. Một assert kiểu
      // `expect(sourceRepo).not.toHaveProperty('delete')` ở đây sẽ vô nghĩa: nó soi chính cái
      // mock mà file test này khai ra, và mock đó không bao giờ có `delete` dù service làm gì.
    });

    it('🔴 dòng isOther ⇒ 409 CONFLICT, KHÔNG chạm DB, KHÔNG event', async () => {
      // Tắt dòng "Khác" = giết luật "chọn Khác ⇒ bắt buộc sourceNote" của Story 3.3: form khách
      // sẽ không còn nguồn nào để rơi vào.
      sourceRepo.findUnique.mockResolvedValue(KHAC);

      await expect(service.deactivate(ACTOR, KHAC.id)).rejects.toBeInstanceOf(
        AppException,
      );
      await expect(service.deactivate(ACTOR, KHAC.id)).rejects.toMatchObject({
        errorCode: ErrorCode.CONFLICT,
      });
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('dòng ĐÃ TẮT ⇒ không ghi DB, KHÔNG publish event (không có gì đổi thì không có gì để ghi)', async () => {
      sourceRepo.findUnique.mockResolvedValue(DA_TAT);

      await service.deactivate(ACTOR, DA_TAT.id);

      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('id không tồn tại ⇒ 404', async () => {
      sourceRepo.findUnique.mockResolvedValue(null);

      await expect(service.deactivate(ACTOR, 'id-ma')).rejects.toMatchObject({
        errorCode: ErrorCode.NOT_FOUND,
      });
      expect(sourceRepo.update).not.toHaveBeenCalled();
    });

    it('publish ĐÚNG MỘT CustomerSourceDeactivated (active true → false)', async () => {
      sourceRepo.update.mockResolvedValue({ ...FACEBOOK, active: false });

      await service.deactivate(ACTOR, FACEBOOK.id);

      const event = eventDuyNhat() as CustomerSourceDeactivated;
      expect(event).toBeInstanceOf(CustomerSourceDeactivated);
      expect(event.before.active).toBe(true);
      expect(event.after.active).toBe(false);
    });
  });

  describe('reactivate — AC-4', () => {
    it('dòng đã tắt ⇒ ghi active:true', async () => {
      sourceRepo.findUnique.mockResolvedValue(DA_TAT);
      sourceRepo.update.mockResolvedValue({ ...DA_TAT, active: true });

      const bat = await service.reactivate(ACTOR, DA_TAT.id);

      expect(sourceRepo.update.mock.calls[0][0]).toEqual({
        where: { id: DA_TAT.id },
        data: { active: true },
      });
      expect(bat.active).toBe(true);
    });

    it('dòng ĐANG BẬT ⇒ không ghi DB, KHÔNG publish event (đối xứng với deactivate)', async () => {
      sourceRepo.findUnique.mockResolvedValue(FACEBOOK);

      const ketQua = await service.reactivate(ACTOR, FACEBOOK.id);

      expect(ketQua).toBe(FACEBOOK);
      expect(sourceRepo.update).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('id không tồn tại ⇒ 404', async () => {
      sourceRepo.findUnique.mockResolvedValue(null);

      await expect(service.reactivate(ACTOR, 'id-ma')).rejects.toMatchObject({
        errorCode: ErrorCode.NOT_FOUND,
      });
    });

    it('publish ĐÚNG MỘT CustomerSourceReactivated (active false → true)', async () => {
      sourceRepo.findUnique.mockResolvedValue(DA_TAT);
      sourceRepo.update.mockResolvedValue({ ...DA_TAT, active: true });

      await service.reactivate(ACTOR, DA_TAT.id);

      const event = eventDuyNhat() as CustomerSourceReactivated;
      expect(event).toBeInstanceOf(CustomerSourceReactivated);
      expect(event.before.active).toBe(false);
      expect(event.after.active).toBe(true);
    });
  });

  describe('findAll — hợp đồng ĐỌC của Story 3.3 KHÔNG đổi', () => {
    it('mặc định chỉ nguồn còn hiệu lực, sắp theo sortOrder', async () => {
      sourceRepo.findMany.mockResolvedValue([FACEBOOK]);

      await service.findAll(false);

      expect(sourceRepo.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('includeInactive ⇒ lấy cả nguồn đã tắt (màn cấu hình cần thấy để bật lại)', async () => {
      sourceRepo.findMany.mockResolvedValue([FACEBOOK, DA_TAT]);

      await service.findAll(true);

      expect(sourceRepo.findMany.mock.calls[0][0].where).toEqual({});
    });
  });
});
