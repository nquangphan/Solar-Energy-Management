import type { Order } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import {
  KICH_THUOC_TOI_DA_BYTE,
  SO_ANH_TOI_DA,
} from '../src/orders/domain/attachment-limits';
import {
  AttachmentAdded,
  AttachmentRemoved,
} from '../src/orders/domain/order-events';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage, type FakeStorage } from './util/fake-storage';

/**
 * Unit ba đường ảnh của Story 5.6 — list / thêm bổ sung / xoá.
 *
 * Bốn thứ được canh trực tiếp ở đây vì KHÔNG có lớp thứ hai đỡ:
 *  1. `coTheXoa` — luật FR-24 sống ở ĐÚNG một chỗ (backend). Sai là hoặc người không có
 *     quyền xoá được bằng chứng, hoặc người tải lên mất quyền xoá ảnh của chính mình.
 *  2. Thứ tự DB→R2 khi xoá: đảo lại thì hàng DB trỏ vào bytes không tồn tại ⇒ gallery vỡ.
 *  3. Ba cột toạ độ (`statusFrom`/`statusTo`/`occurredAt`) phải `null` cho ảnh bổ sung —
 *     ghi trạng thái hiện tại vào đó là bịa ra một bước không ai bấm.
 *  4. Validate CHẠY TRƯỚC khi chạm R2 — 400 mà bytes đã nằm trên bucket là rác vĩnh viễn.
 */
describe('OrdersService — ảnh bổ sung (Story 5.6)', () => {
  const ACTOR = 'acc-thi-cong';
  const NGUOI_KHAC = 'acc-nguoi-khac';
  const ORDER_ID = 'ord-5-6';

  /** Quyền xem-mọi-đơn + được ghi vào đơn, KHÔNG có `quotesCreateEdit`. */
  const QUYEN_THO: ReadonlySet<string> = new Set([
    PERM.ordersViewAll,
    PERM.constructionTransition,
  ]);

  /** Quyền chỉnh sửa đơn — cửa thứ hai của luật `coTheXoa`. */
  const QUYEN_SUA_DON: ReadonlySet<string> = new Set([
    PERM.ordersViewAll,
    PERM.quotesCreateEdit,
  ]);

  const DON: Order = {
    id: ORDER_ID,
    status: 'thicong',
    customerSdt: '+84912345678',
    currentVersionId: 'ver-1',
    ownerAccountId: ACTOR,
    assigneeAccountId: null,
    sourceId: 'src-fb',
    custType: 'CA_NHAN',
    scopeThietBi: true,
    scopeThiCong: true,
    scopeVanChuyen: false,
    kWp: null,
    vatMode: null,
    validityNote: null,
    createdAt: new Date('2026-07-18T01:00:00Z'),
    updatedAt: new Date('2026-07-18T01:00:00Z'),
  };

  /** Ảnh của 5.5 — gắn vào một bước, ba cột toạ độ có giá trị. */
  const ANH_THEO_BUOC = {
    id: 'att-buoc',
    orderId: ORDER_ID,
    uploadedByAccountId: NGUOI_KHAC,
    objectKey: `attachments/${ORDER_ID}/att-buoc.jpg`,
    fileName: 'nghiem-thu.jpg',
    contentType: 'image/jpeg',
    size: 4096,
    statusFrom: 'dacoc',
    statusTo: 'thicong',
    occurredAt: new Date('2026-07-18T03:00:00Z'),
    createdAt: new Date('2026-07-18T03:00:00Z'),
    uploadedBy: { displayName: 'Trần Thợ' },
  };

  /** Ảnh bổ sung của 5.6 — ba cột toạ độ null, mới hơn nên đứng TRƯỚC. */
  const ANH_BO_SUNG = {
    id: 'att-bo-sung',
    orderId: ORDER_ID,
    uploadedByAccountId: ACTOR,
    objectKey: `attachments/${ORDER_ID}/att-bo-sung.png`,
    fileName: 'bien-ban.png',
    contentType: 'image/png',
    size: 2048,
    statusFrom: null,
    statusTo: null,
    occurredAt: null,
    createdAt: new Date('2026-07-18T05:00:00Z'),
    uploadedBy: { displayName: 'Lê Kỹ Thuật' },
  };

  const orderRepo = { findFirst: jest.fn() };
  const attachmentRepo = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = {
    order: orderRepo,
    attachment: attachmentRepo,
  } as unknown as PrismaService;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  let storage: FakeStorage;
  let service: OrdersService;

  function anh(
    ghiDe: Partial<{ name: string; mime: string; size: number }> = {},
  ) {
    return {
      originalname: ghiDe.name ?? 'bo-sung.jpg',
      mimetype: ghiDe.mime ?? 'image/jpeg',
      size: ghiDe.size ?? 2048,
      buffer: Buffer.from('bytes-anh'),
    };
  }

  function them(input: {
    quyen?: ReadonlySet<string>;
    anh?: ReturnType<typeof anh>[];
  }) {
    return service.themAnh({
      callerAccountId: ACTOR,
      quyen: input.quyen ?? QUYEN_THO,
      orderId: ORDER_ID,
      anh: input.anh ?? [anh()],
    });
  }

  async function bat(promise: Promise<unknown>): Promise<AppException> {
    try {
      await promise;
    } catch (err: unknown) {
      return err as AppException;
    }
    throw new Error('Kỳ vọng ném AppException nhưng không có lỗi nào.');
  }

  beforeEach(() => {
    jest.clearAllMocks();
    storage = fakeStorage();
    service = new OrdersService(
      prisma,
      eventBus as unknown as EventBus,
      storage,
    );
    orderRepo.findFirst.mockResolvedValue(DON);
    attachmentRepo.findMany.mockResolvedValue([ANH_BO_SUNG, ANH_THEO_BUOC]);
    attachmentRepo.createMany.mockResolvedValue({ count: 1 });
    attachmentRepo.delete.mockResolvedValue(ANH_BO_SUNG);
  });

  describe('danhSachAnh — danh sách phẳng (AC-4)', () => {
    it('trả CẢ ảnh theo bước lẫn ảnh bổ sung, sắp createdAt giảm dần', async () => {
      const items = await service.danhSachAnh(ACTOR, QUYEN_THO, ORDER_ID);

      expect(attachmentRepo.findMany).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { displayName: true } } },
      });
      expect(items.map((i) => i.id)).toEqual(['att-bo-sung', 'att-buoc']);
      expect(items[1].statusFrom).toBe('dacoc');
      expect(items[1].statusTo).toBe('thicong');
      expect(items[0].statusFrom).toBeNull();
      expect(items[0].statusTo).toBeNull();
    });

    it('nguoiTaiLen lấy đúng Account.displayName; DTO KHÔNG rò objectKey (AD-3)', async () => {
      const items = await service.danhSachAnh(ACTOR, QUYEN_THO, ORDER_ID);

      expect(items[0].nguoiTaiLen).toBe('Lê Kỹ Thuật');
      expect(items[1].nguoiTaiLen).toBe('Trần Thợ');
      for (const item of items) {
        expect(Object.keys(item)).not.toContain('objectKey');
      }
    });
  });

  describe('coTheXoa — luật FR-24 tính ở BACKEND (AC-6)', () => {
    it('true cho NGƯỜI TẢI LÊN dù không có quotesCreateEdit', async () => {
      const items = await service.danhSachAnh(ACTOR, QUYEN_THO, ORDER_ID);

      // ACTOR tải `att-bo-sung`, không tải `att-buoc`.
      expect(items[0].coTheXoa).toBe(true);
      expect(items[1].coTheXoa).toBe(false);
    });

    it('true cho người có quotesCreateEdit dù KHÔNG phải người tải lên', async () => {
      const items = await service.danhSachAnh(
        NGUOI_KHAC,
        QUYEN_SUA_DON,
        ORDER_ID,
      );

      expect(items.every((i) => i.coTheXoa)).toBe(true);
    });

    it('false khi vừa không tải lên vừa không có quotesCreateEdit', async () => {
      const items = await service.danhSachAnh(
        'acc-nguoi-thu-ba',
        QUYEN_THO,
        ORDER_ID,
      );

      expect(items.every((i) => i.coTheXoa === false)).toBe(true);
    });
  });

  describe('phạm vi đóng bằng findScopedOrThrow (AC-5)', () => {
    it('actor ngoài phạm vi ⇒ 404 "không tìm thấy đơn" ở CẢ BA route', async () => {
      orderRepo.findFirst.mockResolvedValue(null);

      for (const goi of [
        () => service.danhSachAnh(ACTOR, QUYEN_THO, ORDER_ID),
        () => them({}),
        () => service.xoaAnh(ACTOR, QUYEN_THO, ORDER_ID, 'att-bo-sung'),
      ]) {
        const loi = await bat(goi());
        expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
        expect(loi.getStatus()).toBe(404);
        expect(loi.message).toContain('Không tìm thấy đơn hàng');
      }

      // Không route nào chạm dữ liệu ảnh hay R2 sau khi phạm vi đóng.
      expect(attachmentRepo.findMany).not.toHaveBeenCalled();
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
      expect(attachmentRepo.delete).not.toHaveBeenCalled();
      expect(storage.objects.size).toBe(0);
    });
  });

  describe('themAnh — ba cột toạ độ NULL (AC-9, AC-11)', () => {
    it('createMany ghi statusFrom/statusTo/occurredAt đều null + id đã mint', async () => {
      await them({ anh: [anh(), anh({ name: 'hai.png', mime: 'image/png' })] });

      const dulieu = attachmentRepo.createMany.mock.calls[0][0].data as {
        id: string;
        objectKey: string;
        statusFrom: string | null;
        statusTo: string | null;
        occurredAt: Date | null;
        uploadedByAccountId: string;
        fileName: string;
      }[];
      expect(dulieu).toHaveLength(2);
      for (const hang of dulieu) {
        expect(hang.statusFrom).toBeNull();
        expect(hang.statusTo).toBeNull();
        expect(hang.occurredAt).toBeNull();
        expect(hang.uploadedByAccountId).toBe(ACTOR);
        // Id đã mint phải đi vào CẢ object key lẫn hàng DB.
        expect(hang.objectKey).toContain(hang.id);
      }
      expect(dulieu[0].objectKey).toBe(
        `attachments/${ORDER_ID}/${dulieu[0].id}.jpg`,
      );
      expect(dulieu[1].objectKey).toBe(
        `attachments/${ORDER_ID}/${dulieu[1].id}.png`,
      );
    });

    it('đuôi key suy từ MIME, KHÔNG từ tên file client gửi', async () => {
      await them({
        anh: [anh({ name: 'gia-mao.exe.jpg', mime: 'image/webp' })],
      });

      const hang = attachmentRepo.createMany.mock.calls[0][0].data[0] as {
        objectKey: string;
        fileName: string;
      };
      expect(hang.objectKey).toMatch(/\.webp$/);
      expect(hang.fileName).toBe('gia-mao.exe.jpg');
    });

    it('KHÔNG đọc/ghi Order.status — đây là đường metadata, không phải transition', async () => {
      await them({});

      expect(attachmentRepo.createMany).toHaveBeenCalledTimes(1);
      const hang = attachmentRepo.createMany.mock.calls[0][0].data[0] as Record<
        string,
        unknown
      >;
      expect(hang).not.toHaveProperty('status');
    });

    it('publish AttachmentAdded SAU commit, mang đủ id của cả lượt (AC-2)', async () => {
      await them({ anh: [anh(), anh()] });

      const event = eventBus.publish.mock.calls[0][0] as AttachmentAdded;
      expect(event).toBeInstanceOf(AttachmentAdded);
      expect(event.type).toBe('AttachmentAdded');
      expect(event.soAnh).toBe(2);
      expect(event.attachmentIds).toHaveLength(2);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.target).toEqual({ type: 'Order', id: ORDER_ID });
      // Ghi DB xong mới publish.
      expect(attachmentRepo.createMany).toHaveBeenCalled();
    });
  });

  describe('themAnh — validate TRƯỚC khi chạm R2 (AC-10)', () => {
    it('quá số lượng ⇒ 400 + fieldErrors, KHÔNG byte nào lên R2, KHÔNG hàng nào tạo', async () => {
      const qua = Array.from({ length: SO_ANH_TOI_DA + 1 }, () => anh());
      const loi = await bat(them({ anh: qua }));

      expect(loi.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(loi.getStatus()).toBe(400);
      expect(loi.fieldErrors?.[0].code).toBe('maxCount');
      expect(storage.objects.size).toBe(0);
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
    });

    // Lượt rỗng là hợp lệ với `kiemTraAnh()` (kèm ảnh optional khi chuyển trạng
    // thái) nhưng KHÔNG hợp lệ ở route này: đi tiếp sẽ để lại một hàng audit nói
    // đã thêm ảnh trong khi chẳng có ảnh nào.
    it('không ảnh nào ⇒ 400, KHÔNG hàng nào tạo, KHÔNG event nào publish', async () => {
      const loi = await bat(them({ anh: [] }));

      expect(loi.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(loi.getStatus()).toBe(400);
      expect(loi.fieldErrors?.[0].code).toBe('minCount');
      expect(storage.objects.size).toBe(0);
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('mime ngoài allow-list ⇒ 400, không upload', async () => {
      const loi = await bat(
        them({ anh: [anh({ mime: 'application/pdf' })] }),
      );

      expect(loi.getStatus()).toBe(400);
      expect(loi.fieldErrors?.[0].code).toBe('mimeType');
      expect(storage.objects.size).toBe(0);
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
    });

    it('ảnh quá 10 MB ⇒ 400, không upload', async () => {
      const loi = await bat(
        them({ anh: [anh({ size: KICH_THUOC_TOI_DA_BYTE + 1 })] }),
      );

      expect(loi.getStatus()).toBe(400);
      expect(loi.fieldErrors?.[0].code).toBe('maxSize');
      expect(storage.objects.size).toBe(0);
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
    });
  });

  describe('xoaAnh — luật hàng + thứ tự DB→R2 (AC-7, AC-8)', () => {
    beforeEach(() => {
      attachmentRepo.findFirst.mockResolvedValue(ANH_BO_SUNG);
    });

    it('người tải lên xoá được: DB xoá, event publish, R2 xoá SAU CÙNG', async () => {
      storage.objects.set(ANH_BO_SUNG.objectKey, {
        body: Buffer.from('x'),
        contentType: 'image/png',
      });

      await service.xoaAnh(ACTOR, QUYEN_THO, ORDER_ID, ANH_BO_SUNG.id);

      expect(attachmentRepo.delete).toHaveBeenCalledWith({
        where: { id: ANH_BO_SUNG.id },
      });
      const event = eventBus.publish.mock.calls[0][0] as AttachmentRemoved;
      expect(event).toBeInstanceOf(AttachmentRemoved);
      expect(event.attachmentId).toBe(ANH_BO_SUNG.id);
      expect(event.fileName).toBe('bien-ban.png');
      expect(storage.objects.has(ANH_BO_SUNG.objectKey)).toBe(false);
    });

    it('người có quotesCreateEdit xoá được ảnh của người khác', async () => {
      attachmentRepo.findFirst.mockResolvedValue(ANH_THEO_BUOC);

      await service.xoaAnh(ACTOR, QUYEN_SUA_DON, ORDER_ID, ANH_THEO_BUOC.id);

      expect(attachmentRepo.delete).toHaveBeenCalled();
    });

    it('không tải lên + không quotesCreateEdit ⇒ 403, hàng DB và object R2 CÒN NGUYÊN', async () => {
      attachmentRepo.findFirst.mockResolvedValue(ANH_THEO_BUOC);
      storage.objects.set(ANH_THEO_BUOC.objectKey, {
        body: Buffer.from('x'),
        contentType: 'image/jpeg',
      });

      const loi = await bat(
        service.xoaAnh(ACTOR, QUYEN_THO, ORDER_ID, ANH_THEO_BUOC.id),
      );

      expect(loi.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(loi.getStatus()).toBe(403);
      expect(loi.message).toBe('Bạn không có quyền xoá ảnh này.');
      expect(attachmentRepo.delete).not.toHaveBeenCalled();
      expect(storage.objects.has(ANH_THEO_BUOC.objectKey)).toBe(true);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('ảnh không thuộc đơn ⇒ 404, không xác nhận sự tồn tại', async () => {
      attachmentRepo.findFirst.mockResolvedValue(null);

      const loi = await bat(
        service.xoaAnh(ACTOR, QUYEN_THO, ORDER_ID, 'att-cua-don-khac'),
      );

      expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(loi.getStatus()).toBe(404);
      expect(attachmentRepo.delete).not.toHaveBeenCalled();
    });

    it('DB delete REJECT ⇒ deleteObject KHÔNG được gọi (thứ tự DB trước R2)', async () => {
      const deleteObject = jest.spyOn(storage, 'deleteObject');
      attachmentRepo.delete.mockRejectedValue(new Error('DB sập'));

      await expect(
        service.xoaAnh(ACTOR, QUYEN_THO, ORDER_ID, ANH_BO_SUNG.id),
      ).rejects.toThrow('DB sập');

      expect(deleteObject).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('deleteObject REJECT ⇒ endpoint VẪN thành công (bytes mồ côi là hậu quả chấp nhận)', async () => {
      jest
        .spyOn(storage, 'deleteObject')
        .mockRejectedValue(new Error('R2 chớp'));

      await expect(
        service.xoaAnh(ACTOR, QUYEN_THO, ORDER_ID, ANH_BO_SUNG.id),
      ).resolves.toBeUndefined();

      expect(attachmentRepo.delete).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalled();
    });
  });
});
