import type { Order } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import type { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import {
  SU_KIEN,
  type TransitionEvent,
} from '../src/orders/domain/allowed-transition';
import {
  KICH_THUOC_TOI_DA_BYTE,
  SO_ANH_TOI_DA,
} from '../src/orders/domain/attachment-limits';
import { StatusChanged } from '../src/orders/domain/order-events';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage, type FakeStorage } from './util/fake-storage';

/**
 * Unit `OrdersService.chuyenTrangThaiThuCong()` — lane CHUYỂN TRẠNG THÁI THỦ CÔNG (Story 5.5).
 *
 * Ba thứ đắt nhất được canh ở đây, mỗi thứ là một ca hỏng thật:
 *  1. WHITELIST — `chot`/`mo_lai`/`huy`/`du_coc`/`ap_chiet_khau` đi qua cửa này là bỏ qua
 *     snapshot giá / lý do huỷ / lane auto. Đơn `dachot` mà giá vẫn trôi theo danh mục là
 *     hỏng DỮ LIỆU, không phải hỏng UX.
 *  2. AC-7 — transition bị từ chối ⇒ KHÔNG hàng `Attachment` nào và status không đổi.
 *  3. `occurredAt` của ảnh BẰNG ĐÚNG `occurredAt` của `StatusChanged` — đây là khoá nối ảnh
 *     vào hàng audit của bước (FR-23). Lệch một millisecond là mất liên kết.
 */
describe('OrdersService.chuyenTrangThaiThuCong (Story 5.5)', () => {
  const ACTOR = 'acc-thi-cong';
  const ORDER_ID = 'ord-5-5';

  /** Quyền đủ cho cả ba nhánh của lane thủ công. */
  const QUYEN_DU: ReadonlySet<string> = new Set([
    PERM.ordersViewAll,
    PERM.constructionTransition,
    PERM.deliveryConfirm,
    PERM.paymentsRecord,
  ]);

  /** Đơn ở `dacoc`, bật CẢ cờ Thi công lẫn Vận chuyển ⇒ hai bước kế cùng mở. */
  const DON_DACOC: Order = {
    id: ORDER_ID,
    status: 'dacoc',
    customerSdt: '+84912345678',
    currentVersionId: 'ver-1',
    ownerAccountId: ACTOR,
    assigneeAccountId: null,
    sourceId: 'src-fb',
    custType: 'CA_NHAN',
    scopeThietBi: true,
    scopeThiCong: true,
    scopeVanChuyen: true,
    kWp: null,
    vatMode: null,
    validityNote: null,
    createdAt: new Date('2026-07-18T01:00:00Z'),
    updatedAt: new Date('2026-07-18T01:00:00Z'),
  };

  const orderRepo = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const attachmentRepo = { createMany: jest.fn(), findFirst: jest.fn() };
  const queryRaw = jest.fn();
  const transaction = jest.fn();
  const txMock = {
    order: orderRepo,
    attachment: attachmentRepo,
    $queryRaw: queryRaw,
  };
  const prisma = {
    order: orderRepo,
    attachment: attachmentRepo,
    $transaction: transaction,
    $queryRaw: queryRaw,
  } as unknown as PrismaService;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  let storage: FakeStorage;
  let service: OrdersService;

  function anh(ghiDe: Partial<{ name: string; mime: string; size: number }> = {}) {
    return {
      originalname: ghiDe.name ?? 'cong-truong.jpg',
      mimetype: ghiDe.mime ?? 'image/jpeg',
      size: ghiDe.size ?? 2048,
      buffer: Buffer.from('bytes-anh'),
    };
  }

  function goi(input: {
    event?: TransitionEvent;
    quyen?: ReadonlySet<string>;
    anh?: ReturnType<typeof anh>[];
  }) {
    return service.chuyenTrangThaiThuCong({
      callerAccountId: ACTOR,
      quyen: input.quyen ?? QUYEN_DU,
      orderId: ORDER_ID,
      event: input.event ?? SU_KIEN.batDauThiCong,
      anh: input.anh ?? [],
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
    orderRepo.findFirst.mockResolvedValue(DON_DACOC);
    orderRepo.updateMany.mockResolvedValue({ count: 1 });
    attachmentRepo.createMany.mockResolvedValue({ count: 0 });
    queryRaw.mockResolvedValue([]);
    transaction.mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
    );
  });

  describe('đường hạnh phúc (AC-1, AC-2, AC-3)', () => {
    it('chuyển được không kèm ảnh — upload LUÔN optional (FR-23)', async () => {
      const ketQua = await goi({});
      expect(ketQua.status).toBe('thicong');
      expect(ketQua.soAnhDaLuu).toBe(0);
      // Không ảnh ⇒ không gọi createMany, không đụng R2.
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
      expect(storage.objects.size).toBe(0);
    });

    it('ghi `Order.status` qua CỔNG ATOMIC theo status quan sát được — không hardcode literal', async () => {
      await goi({});
      expect(orderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: ORDER_ID, status: 'dacoc' },
        data: { status: 'thicong' },
      });
    });

    it('publish `StatusChanged` SAU commit (AD-18) — service KHÔNG gọi audit trực tiếp', async () => {
      await goi({});
      const [event] = eventBus.publish.mock.calls[0] as [StatusChanged];
      expect(event).toBeInstanceOf(StatusChanged);
      expect(event.before.status).toBe('dacoc');
      expect(event.after.status).toBe('thicong');
    });

    it('ảnh: bytes lên R2, metadata xuống DB (AD-3) — key `attachments/{orderId}/{id}.{ext}`', async () => {
      const ketQua = await goi({ anh: [anh(), anh({ mime: 'image/png' })] });
      expect(ketQua.soAnhDaLuu).toBe(2);
      expect(storage.objects.size).toBe(2);

      const keys = [...storage.objects.keys()];
      expect(keys.every((k) => k.startsWith(`attachments/${ORDER_ID}/`))).toBe(
        true,
      );
      // ĐUÔI SUY TỪ MIME, không từ đuôi file client gửi (cả hai file tên .jpg).
      expect(keys.some((k) => k.endsWith('.jpg'))).toBe(true);
      expect(keys.some((k) => k.endsWith('.png'))).toBe(true);

      const { data } = attachmentRepo.createMany.mock.calls[0][0];
      expect(data).toHaveLength(2);
      // Metadata trỏ ĐÚNG object đã upload — hàng DB mồ côi là ảnh vô hình.
      for (const hang of data) {
        expect(storage.objects.has(hang.objectKey)).toBe(true);
        expect(hang.uploadedByAccountId).toBe(ACTOR);
        expect(hang.orderId).toBe(ORDER_ID);
      }
    });

    it('BỐN TOẠ ĐỘ của bước ghi lên mọi ảnh: đơn, from→to, thời điểm (FR-23)', async () => {
      await goi({ anh: [anh()] });
      const [hang] = attachmentRepo.createMany.mock.calls[0][0].data;
      expect(hang.orderId).toBe(ORDER_ID);
      expect(hang.statusFrom).toBe('dacoc');
      expect(hang.statusTo).toBe('thicong');
      expect(hang.occurredAt).toBeInstanceOf(Date);
    });

    /**
     * Tên file do CLIENT đặt và nó chảy thẳng vào `Content-Disposition` ở đường đọc bytes.
     * Dọn phải xảy ra LÚC GHI — cột này còn phục vụ gallery của 5.6, nên một chỗ dọn thì mọi
     * consumer an toàn. Test canh CHỖ NỐI, không canh hàm: `tenFileAnToan()` có test riêng,
     * nhưng gỡ nó khỏi call-site này thì chỉ test này chết.
     */
    it('tên file client gửi được DỌN trước khi vào cột `fileName`', async () => {
      await goi({
        anh: [anh({ name: 'a"; filename="b.exe' })],
      });
      const [hang] = attachmentRepo.createMany.mock.calls[0][0].data;
      expect(hang.fileName).toBe('a_; filename=_b.exe');
    });

    it('KHOÁ JOIN: `occurredAt` của ảnh BẰNG ĐÚNG `occurredAt` của StatusChanged', async () => {
      await goi({ anh: [anh(), anh()] });
      const [event] = eventBus.publish.mock.calls[0] as [StatusChanged];
      const { data } = attachmentRepo.createMany.mock.calls[0][0];
      for (const hang of data) {
        // `toBe` không `toEqual`: phải là CÙNG MỘT instance `Date`, tức cùng một biến cho
        // cả lượt. Hai `new Date()` sẽ lệch vài ms và cắt đứt khoá nối ảnh vào audit.
        expect(hang.occurredAt).toBe(event.occurredAt);
      }
    });

    it('nhánh giao hàng dùng key quyền KHÁC — `bat_dau_giao` đi được với delivery.confirm', async () => {
      const ketQua = await goi({
        event: SU_KIEN.batDauGiao,
        quyen: new Set([PERM.ordersViewAll, PERM.deliveryConfirm]),
      });
      expect(ketQua.status).toBe('danggiao');
    });
  });

  describe('WHITELIST lane thủ công (AC-13) — năm sự kiện có cửa riêng', () => {
    const CUA_RIENG: readonly TransitionEvent[] = [
      SU_KIEN.chot,
      SU_KIEN.moLai,
      SU_KIEN.huy,
      SU_KIEN.duCoc,
      SU_KIEN.apChietKhau,
    ];

    it.each(CUA_RIENG)('`%s` → 409 và Order.status KHÔNG đổi', async (event) => {
      const loi = await bat(goi({ event }));
      expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
      expect(loi.getStatus()).toBe(409);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('`huy` từ `dacoc` HỢP LỆ với bảng nhưng vẫn 409 ở cửa này — whitelist chặn TRƯỚC engine', async () => {
      // Dòng `dacoc --huy--> huy` có thật trong ALLOWED_TRANSITIONS và actor có quyền.
      // Nếu whitelist chạy SAU `evaluateTransition()` thì ca này lọt.
      const loi = await bat(
        goi({
          event: SU_KIEN.huy,
          quyen: new Set([...QUYEN_DU, PERM.quotesCreateEdit]),
        }),
      );
      expect(loi.getStatus()).toBe(409);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('sự kiện ngoài whitelist KHÔNG upload byte nào — chặn trước khi trả tiền R2', async () => {
      await bat(goi({ event: SU_KIEN.chot, anh: [anh(), anh()] }));
      expect(storage.objects.size).toBe(0);
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
    });
  });

  describe('từ chối: quyền, phạm vi, ngoài bảng (AC-5, AC-6, AC-7)', () => {
    it('thiếu quyền của bước ⇒ 403 FORBIDDEN, status không đổi', async () => {
      const loi = await bat(
        goi({ quyen: new Set([PERM.ordersViewAll, PERM.deliveryConfirm]) }),
      );
      expect(loi.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(loi.getStatus()).toBe(403);
      expect(loi.message).toBe(
        'Bạn không có quyền thực hiện chuyển trạng thái này.',
      );
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('bước ngoài phạm vi đơn ⇒ 409 với thông điệp PHẠM VI', async () => {
      orderRepo.findFirst.mockResolvedValue({
        ...DON_DACOC,
        scopeThiCong: false,
      });
      const loi = await bat(goi({}));
      expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
      expect(loi.message).toBe('Bước này không thuộc phạm vi của đơn.');
    });

    it('BẤM HAI LẦN: đơn đã ở đích ⇒ 409, KHÔNG no-op im lặng (khác lane auto)', async () => {
      // Đơn đã ở `thicong`; bấm lại `bat_dau_thi_cong` ⇒ (from, event) không có trong bảng.
      orderRepo.findFirst.mockResolvedValue({ ...DON_DACOC, status: 'thicong' });
      const loi = await bat(goi({ event: SU_KIEN.batDauThiCong }));
      expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
      expect(loi.message).toBe(
        'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
      );
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('THUA CUỘC ĐUA dưới row lock ⇒ 409, không publish — kẻ thua không được báo thành công', async () => {
      // Pre-check pass, nhưng cổng atomic đếm 0 dòng: một lượt khác đã commit chen vào.
      orderRepo.updateMany.mockResolvedValue({ count: 0 });
      const loi = await bat(goi({}));
      expect(loi.errorCode).toBe(ErrorCode.CONFLICT);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('AC-7: transition bị từ chối kèm N ảnh ⇒ KHÔNG hàng Attachment nào được tạo', async () => {
      const loi = await bat(
        goi({
          quyen: new Set([PERM.ordersViewAll]),
          anh: [anh(), anh(), anh()],
        }),
      );
      expect(loi.getStatus()).toBe(403);
      expect(attachmentRepo.createMany).not.toHaveBeenCalled();
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('PRE-CHECK chặn TRƯỚC R2: request sẽ bị từ chối không tốn một byte upload nào', async () => {
      // Đây là lý do tồn tại của pre-check. Bỏ nó đi ⇒ storage.objects.size = 3.
      await bat(
        goi({ quyen: new Set([PERM.ordersViewAll]), anh: [anh(), anh(), anh()] }),
      );
      expect(storage.objects.size).toBe(0);
    });
  });

  describe('validate file (AC-9)', () => {
    it('quá số ảnh tối đa ⇒ 400 VALIDATION_ERROR + fieldErrors, transition KHÔNG chạy', async () => {
      const loi = await bat(
        goi({ anh: Array.from({ length: SO_ANH_TOI_DA + 1 }, () => anh()) }),
      );
      expect(loi.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(loi.getStatus()).toBe(400);
      expect(loi.fieldErrors?.[0].code).toBe('maxCount');
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('ảnh quá lớn ⇒ 400 + fieldErrors, không upload, status không đổi', async () => {
      const loi = await bat(
        goi({ anh: [anh({ size: KICH_THUOC_TOI_DA_BYTE + 1 })] }),
      );
      expect(loi.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(loi.fieldErrors?.[0].code).toBe('maxSize');
      expect(storage.objects.size).toBe(0);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('mime ngoài allow-list ⇒ 400 + fieldErrors, transition KHÔNG chạy', async () => {
      const loi = await bat(
        goi({ anh: [anh({ name: 'virus.jpg', mime: 'application/pdf' })] }),
      );
      expect(loi.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(loi.fieldErrors?.[0].code).toBe('mimeType');
      expect(storage.objects.size).toBe(0);
      expect(orderRepo.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('phạm vi đơn (AD-4/AD-15)', () => {
    it('đọc đơn qua ĐƯỜNG ĐÃ SCOPE — actor chỉ xem đơn của mình thì `where` phải kẹp owner/assignee', async () => {
      await goi({
        quyen: new Set([PERM.ordersViewOwn, PERM.constructionTransition]),
      });
      const { where } = orderRepo.findFirst.mock.calls[0][0];
      expect(where.AND).toContainEqual({
        OR: [{ ownerAccountId: ACTOR }, { assigneeAccountId: ACTOR }],
      });
    });

    it('đơn ngoài phạm vi ⇒ 404 trước mọi thứ khác — không xác nhận đơn có tồn tại', async () => {
      orderRepo.findFirst.mockResolvedValue(null);
      const loi = await bat(goi({ anh: [anh()] }));
      expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(storage.objects.size).toBe(0);
    });
  });

  describe('anhDinhKem — proxy đọc bytes (AC-8)', () => {
    const HANG_ANH = {
      id: 'att-1',
      orderId: ORDER_ID,
      objectKey: `attachments/${ORDER_ID}/att-1.jpg`,
      fileName: 'cong-truong.jpg',
      contentType: 'image/jpeg',
    };

    it('trả bytes sau khi khẳng định đơn trong phạm vi', async () => {
      await storage.putObject(HANG_ANH.objectKey, Buffer.from('X'), 'image/jpeg');
      attachmentRepo.findFirst.mockResolvedValue(HANG_ANH);
      const file = await service.anhDinhKem(ACTOR, QUYEN_DU, ORDER_ID, 'att-1');
      expect(file.body.toString()).toBe('X');
      expect(file.contentType).toBe('image/jpeg');
    });

    it('SCOPE TRƯỚC R2: đơn ngoài phạm vi ⇒ 404 và KHÔNG đọc object nào', async () => {
      orderRepo.findFirst.mockResolvedValue(null);
      const docObject = jest.spyOn(storage, 'getObject');
      const loi = await bat(
        service.anhDinhKem(ACTOR, QUYEN_DU, ORDER_ID, 'att-1'),
      );
      expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(docObject).not.toHaveBeenCalled();
    });

    it('ảnh của đơn KHÁC ⇒ 404 — truy vấn kẹp CẢ orderId, không chỉ attachmentId', async () => {
      attachmentRepo.findFirst.mockResolvedValue(null);
      const loi = await bat(
        service.anhDinhKem(ACTOR, QUYEN_DU, ORDER_ID, 'att-cua-don-khac'),
      );
      expect(loi.errorCode).toBe(ErrorCode.NOT_FOUND);
      const { where } = attachmentRepo.findFirst.mock.calls[0][0];
      expect(where).toEqual({ id: 'att-cua-don-khac', orderId: ORDER_ID });
    });
  });

  describe('lifecycle mở rộng: `buocKeTiep` (AC-4, AC-11)', () => {
    it('trả CẢ stepper lẫn bước kế — một lần đọc đơn, không đẻ route thứ hai', async () => {
      const vongDoi = await service.lifecycle(ACTOR, QUYEN_DU, ORDER_ID);
      expect(vongDoi.buoc.length).toBeGreaterThan(0);
      expect(vongDoi.buocKeTiep.map((b) => b.event).sort()).toEqual(
        [SU_KIEN.batDauGiao, SU_KIEN.batDauThiCong].sort(),
      );
    });

    it('AC-11: actor không còn bước nào ⇒ mảng RỖNG (client ẩn hẳn nút)', async () => {
      const vongDoi = await service.lifecycle(
        ACTOR,
        new Set([PERM.ordersViewAll]),
        ORDER_ID,
      );
      expect(vongDoi.buocKeTiep).toEqual([]);
      // Stepper vẫn vẽ đủ — ẩn nút không có nghĩa là giấu vòng đời.
      expect(vongDoi.buoc.length).toBeGreaterThan(0);
    });

    it('`buocKeTiep` lọc theo QUYỀN THẬT: chỉ có delivery.confirm ⇒ chỉ thấy nhánh giao', async () => {
      const vongDoi = await service.lifecycle(
        ACTOR,
        new Set([PERM.ordersViewAll, PERM.deliveryConfirm]),
        ORDER_ID,
      );
      expect(vongDoi.buocKeTiep.map((b) => b.event)).toEqual([
        SU_KIEN.batDauGiao,
      ]);
    });
  });
});
