import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { StoragePort } from '../src/storage/storage.port';
import { QuoteExported } from '../src/orders/domain/order-events';
import type { OrdersService, OrderView } from '../src/orders/orders.service';
import { QuoteExportService } from '../src/orders/quote-export.service';
import type { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';

/** Bộ quyền xem-hết — phạm vi do `getScoped()` lo, các ca dưới không về phạm vi. */
const XEM_TAT_CA: ReadonlySet<string> = new Set([PERM.ordersViewAll]);

/**
 * QuoteExportService (Story 4.8) — unit, mock đủ 5 dep. Assert PAYLOAD từng bước +
 * THỨ TỰ pipeline `['render','put','put','write','publish']` (fail bước nào dừng bước đó,
 * KHÔNG event khi chưa trọn vẹn). Fixture CON SỐ PHÂN BIỆT: subtotal 10.000.000,
 * discount 1.000.000, rate 8 ⇒ VAT 720.000 — mutant bỏ discount cho VAT 800.000, lộ ngay.
 */
describe('QuoteExportService (unit, hermetic)', () => {
  const ORDER_ID = '0f43a2b1-9c8d-4e7f-a6b5-c4d3e2f10987';
  const ORDER_ID8 = '0f43a2b1';
  const VERSION_ID = 'aaaa1111-2222-3333-4444-555566667777';
  const ACTOR = 'acc-nguoi-xuat';

  const KHACH = {
    sdt: '+84912345678',
    name: 'Nguyễn Văn A',
    address: '12 Lê Lợi, Dĩ An',
    taxCode: '0312345678',
  };

  /** OrderView tối thiểu — chỉ field export dùng. 2 dòng: 5tr×1 + 2,5tr×2 = 10tr. */
  const VIEW_DA_CHOT = {
    id: ORDER_ID,
    status: 'dachot',
    customerSdt: KHACH.sdt,
    currentVersionId: VERSION_ID,
    scopeThietBi: true,
    scopeThiCong: false,
    scopeVanChuyen: false,
    kWp: 5.5,
    vatMode: 'co_vat',
    validityNote: '31/07/2026',
    discount: null,
    lineItems: [
      {
        id: 'line-1',
        productId: 'prod-1',
        name: 'Tấm pin 580W',
        unit: 'Tấm',
        qty: 1,
        unitPrice: 5000000,
        priceEditable: false,
        isFlexible: false,
        note: null,
        warrantyMonths: 60,
        displayOrder: 0,
        amount: 5000000,
      },
      {
        id: 'line-2',
        productId: null,
        name: 'Phụ kiện lắp đặt',
        unit: 'Bộ',
        qty: 2,
        unitPrice: 2500000,
        priceEditable: true,
        isFlexible: false,
        note: null,
        warrantyMonths: null,
        displayOrder: 1,
        amount: 5000000,
      },
    ],
  } as unknown as OrderView;

  /** Version ĐÃ CHỐT: snapshot vatRate 8 + discount 1tr — nguồn chân lý totals sau chốt. */
  const VERSION_SNAPSHOT = {
    id: VERSION_ID,
    orderId: ORDER_ID,
    versionNo: 1,
    vatRate: 8,
    vatMode: 'co_vat',
    chotAt: new Date('2026-07-16T08:00:00Z'),
    discountAmount: 1000000,
  };

  const PDF_BYTES = Buffer.from('%PDF-1.4 gia-lap');
  const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  /** Nhật ký thứ tự pipeline — mọi mock đẩy nhãn vào đây. */
  let callLog: string[];

  const ordersGetScoped = jest.fn();
  const ordersAssertScoped = jest.fn();
  const customerFindUnique = jest.fn();
  const versionFindUnique = jest.fn();
  const quoteExportUpsert = jest.fn();
  const quoteExportFindUnique = jest.fn();
  const render = jest.fn();
  const putObject = jest.fn();
  const getObject = jest.fn();
  const publish = jest.fn();

  const service = new QuoteExportService(
    {
      getScoped: ordersGetScoped,
      assertScoped: ordersAssertScoped,
    } as unknown as OrdersService,
    {
      customer: { findUnique: customerFindUnique },
      orderVersion: { findUnique: versionFindUnique },
      quoteExport: { upsert: quoteExportUpsert, findUnique: quoteExportFindUnique },
    } as unknown as PrismaService,
    { publish, subscribe: jest.fn() } as unknown as EventBus,
    { putObject, getObject } as unknown as StoragePort,
    { render } as unknown as QuoteRendererPort,
  );

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
    callLog = [];
    ordersGetScoped.mockResolvedValue(VIEW_DA_CHOT);
    ordersAssertScoped.mockResolvedValue(undefined);
    customerFindUnique.mockResolvedValue(KHACH);
    versionFindUnique.mockResolvedValue(VERSION_SNAPSHOT);
    render.mockImplementation(async () => {
      callLog.push('render');
      return { pdf: PDF_BYTES, image: PNG_BYTES };
    });
    putObject.mockImplementation(async () => {
      callLog.push('put');
    });
    quoteExportUpsert.mockImplementation(async () => {
      callLog.push('write');
      return {};
    });
    publish.mockImplementation(async () => {
      callLog.push('publish');
    });
  });

  it('happy path: html nhận totals ĐÚNG từ computeOrderTotals (discount trừ trước VAT)', async () => {
    await service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA);

    expect(render).toHaveBeenCalledTimes(1);
    const html = render.mock.calls[0][0] as string;
    // Snapshot version: subtotal 10tr − discount 1tr = 9tr ⇒ VAT 8% = 720.000, tổng 9.720.000.
    expect(html).toContain('10.000.000');
    expect(html).toContain('-1.000.000');
    expect(html).toContain('720.000');
    expect(html).toContain('9.720.000');
    // Mutant bỏ discount ⇒ VAT 800.000 — không được xuất hiện.
    expect(html).not.toContain('800.000');
    // Số báo giá + khách + cột Bảo hành từ view.
    expect(html).toContain(`BG-${ORDER_ID8.toUpperCase()}`);
    expect(html).toContain('Nguyễn Văn A');
    expect(html).toContain('5 năm');
  });

  it('phạm vi: đọc đơn qua getScoped(actor, quyền người gọi) — KHÔNG đường đọc trần', async () => {
    const quyen = new Set<string>([PERM.ordersViewOwn]);
    await service.exportQuote(ACTOR, ORDER_ID, 8, false, quyen);

    expect(ordersGetScoped).toHaveBeenCalledTimes(1);
    expect(ordersGetScoped).toHaveBeenCalledWith(ACTOR, quyen, ORDER_ID, false);
  });

  it('phạm vi: đơn ngoài phạm vi (getScoped ném 404) ⇒ KHÔNG render, KHÔNG upload R2, KHÔNG ghi, KHÔNG publish', async () => {
    ordersGetScoped.mockRejectedValue(
      new AppException(
        ErrorCode.NOT_FOUND,
        404,
        `Không tìm thấy đơn hàng: ${ORDER_ID}`,
      ),
    );

    const loi = await bat(
      service.exportQuote(
        ACTOR,
        ORDER_ID,
        8,
        false,
        new Set<string>([PERM.ordersViewOwn]),
      ),
    );

    expect(loi.errorCode).toBe('NOT_FOUND');
    expect(loi.getStatus()).toBe(404);
    expect(render).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
    expect(quoteExportUpsert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('happy path: putObject ×2 đúng key deterministic + contentType; upsert đúng where/create/update', async () => {
    await service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA);

    expect(putObject).toHaveBeenNthCalledWith(
      1,
      `quotes/${ORDER_ID}/bao-gia.png`,
      PNG_BYTES,
      'image/png',
    );
    expect(putObject).toHaveBeenNthCalledWith(
      2,
      `quotes/${ORDER_ID}/bao-gia.pdf`,
      PDF_BYTES,
      'application/pdf',
    );

    const fileMeta = {
      orderVersionId: VERSION_ID,
      imageKey: `quotes/${ORDER_ID}/bao-gia.png`,
      pdfKey: `quotes/${ORDER_ID}/bao-gia.pdf`,
      imageSize: PNG_BYTES.length,
      pdfSize: PDF_BYTES.length,
      fileName: `bao-gia-${ORDER_ID8}`,
    };
    expect(quoteExportUpsert).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID },
      create: { orderId: ORDER_ID, createdByAccountId: ACTOR, ...fileMeta },
      update: fileMeta,
    });
  });

  it('happy path: publish QuoteExported SAU upsert — thứ tự [render, put, put, write, publish]', async () => {
    const ketQua = await service.exportQuote(
      ACTOR,
      ORDER_ID,
      8,
      false,
      XEM_TAT_CA,
    );

    expect(callLog).toEqual(['render', 'put', 'put', 'write', 'publish']);
    const event = publish.mock.calls[0][0] as QuoteExported;
    expect(event).toBeInstanceOf(QuoteExported);
    expect(event.type).toBe('QuoteExported');
    expect(event.actorAccountId).toBe(ACTOR);
    expect(event.target).toEqual({ type: 'Order', id: ORDER_ID });
    expect(event.orderVersionId).toBe(VERSION_ID);
    expect(event.fileName).toBe(`bao-gia-${ORDER_ID8}`);
    // Audit và response cùng MỘT timestamp — không lệch vài giây render.
    expect(event.occurredAt).toBe(ketQua.exportedAt);

    // Response metadata — bytes KHÔNG nằm trong response.
    expect(ketQua.orderId).toBe(ORDER_ID);
    expect(ketQua.orderVersionId).toBe(VERSION_ID);
    expect(ketQua.image).toEqual({
      fileName: `bao-gia-${ORDER_ID8}.png`,
      size: PNG_BYTES.length,
    });
    expect(ketQua.pdf).toEqual({
      fileName: `bao-gia-${ORDER_ID8}.pdf`,
      size: PDF_BYTES.length,
    });
  });

  it('0 dòng → 400 VALIDATION_ERROR, KHÔNG render/upload/upsert/event', async () => {
    ordersGetScoped.mockResolvedValue({ ...VIEW_DA_CHOT, lineItems: [] });

    const loi = await bat(
      service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA),
    );
    expect(loi.errorCode).toBe('VALIDATION_ERROR');
    expect(loi.getStatus()).toBe(400);
    expect(callLog).toEqual([]);
  });

  it('renderer throw → propagate, KHÔNG putObject/upsert/event', async () => {
    render.mockRejectedValue(new Error('Chromium chết'));

    await expect(
      service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA),
    ).rejects.toThrow('Chromium chết');
    expect(putObject).not.toHaveBeenCalled();
    expect(quoteExportUpsert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('storage throw → propagate, KHÔNG upsert KHÔNG event', async () => {
    putObject.mockRejectedValue(new Error('R2 sập'));

    await expect(
      service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA),
    ).rejects.toThrow('R2 sập');
    expect(quoteExportUpsert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("totals rule: đơn 'baogia' chưa chốt → rate settings + discount 0 (KHÔNG dùng approval cũ)", async () => {
    ordersGetScoped.mockResolvedValue({
      ...VIEW_DA_CHOT,
      status: 'baogia',
      // Approval bị TỪ CHỐI còn nằm làm hồ sơ — không được trừ tiền.
      discount: {
        amount: 1000000,
        status: 'tu_choi',
        requestNote: null,
        resolveNote: 'không duyệt',
        requestedAt: new Date('2026-07-15T00:00:00Z'),
        resolvedAt: new Date('2026-07-15T01:00:00Z'),
      },
    });
    versionFindUnique.mockResolvedValue({
      ...VERSION_SNAPSHOT,
      vatRate: null,
      vatMode: null,
      chotAt: null,
      discountAmount: null,
    });

    // Settings rate 10 (≠ snapshot 8 — chứng minh nguồn rate): VAT 10% trên 10tr = 1.000.000.
    await service.exportQuote(ACTOR, ORDER_ID, 10, false, XEM_TAT_CA);
    const html = render.mock.calls[0][0] as string;
    expect(html).toContain('VAT (10%)');
    expect(html).toContain('1.000.000');
    expect(html).toContain('11.000.000');
    // Không dòng chiết khấu.
    expect(html).not.toContain('Chiết khấu');
  });

  it("totals rule: đơn 'choduyet' + approval dong_y chưa snapshot → discount từ approval (mirror refreshTotals 4.7)", async () => {
    ordersGetScoped.mockResolvedValue({
      ...VIEW_DA_CHOT,
      status: 'choduyet',
      discount: {
        amount: 1000000,
        status: 'dong_y',
        requestNote: null,
        resolveNote: null,
        requestedAt: new Date('2026-07-15T00:00:00Z'),
        resolvedAt: new Date('2026-07-15T01:00:00Z'),
      },
    });
    versionFindUnique.mockResolvedValue({
      ...VERSION_SNAPSHOT,
      vatRate: null,
      vatMode: null,
      chotAt: null,
      discountAmount: null,
    });

    await service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA);
    const html = render.mock.calls[0][0] as string;
    // 10tr − 1tr = 9tr ⇒ VAT 720.000 — giống snapshot case nhưng nguồn là approval.
    expect(html).toContain('-1.000.000');
    expect(html).toContain('720.000');
    expect(html).toContain('9.720.000');
  });

  it("applyVat rule: đơn chưa chốt vatMode 'khong_vat' → KHÔNG tính VAT (mutant luôn-áp-VAT lộ ngay)", async () => {
    ordersGetScoped.mockResolvedValue({
      ...VIEW_DA_CHOT,
      status: 'baogia',
      vatMode: 'khong_vat',
    });
    versionFindUnique.mockResolvedValue({
      ...VERSION_SNAPSHOT,
      vatRate: null,
      vatMode: null,
      chotAt: null,
      discountAmount: null,
    });

    await service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA);
    const html = render.mock.calls[0][0] as string;
    // Không áp VAT: label 'VAT' trần (không '(8%)'), KHÔNG có 800.000 (= 8% subtotal).
    expect(html).not.toContain('VAT (');
    expect(html).not.toContain('800.000');
    // Tổng sau VAT = subtotal 10tr nguyên (discount 0, VAT 0).
    expect(html).toContain('Tổng sau VAT');
    expect(html).toContain('10.000.000');
  });

  it("applyVat rule: snapshot version 'khong_vat' THẮNG Order.vatMode 'co_vat' (nguồn chân lý sau chốt)", async () => {
    // VIEW_DA_CHOT giữ vatMode 'co_vat' — mutant đọc Order.vatMode thay snapshot sẽ tính VAT.
    versionFindUnique.mockResolvedValue({
      ...VERSION_SNAPSHOT,
      vatMode: 'khong_vat',
    });

    await service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA);
    const html = render.mock.calls[0][0] as string;
    // Discount snapshot 1tr vẫn trừ: tổng = 10tr − 1tr = 9.000.000; VAT 0 (không 720.000).
    expect(html).toContain('-1.000.000');
    expect(html).not.toContain('720.000');
    expect(html).not.toContain('9.720.000');
    expect(html).toContain('9.000.000');
  });

  it("totals rule: đơn 'choduyet' + approval CHO_DUYET (chưa quyết) → discount vẫn trừ (mirror refreshTotals 4.7)", async () => {
    ordersGetScoped.mockResolvedValue({
      ...VIEW_DA_CHOT,
      status: 'choduyet',
      discount: {
        amount: 1000000,
        status: 'cho_duyet',
        requestNote: null,
        resolveNote: null,
        requestedAt: new Date('2026-07-15T00:00:00Z'),
        resolvedAt: null,
      },
    });
    versionFindUnique.mockResolvedValue({
      ...VERSION_SNAPSHOT,
      vatRate: null,
      vatMode: null,
      chotAt: null,
      discountAmount: null,
    });

    await service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA);
    const html = render.mock.calls[0][0] as string;
    // Thứ khách thấy trên màn (đang chờ duyệt vẫn hiện chiết khấu) = thứ in ra giấy.
    expect(html).toContain('-1.000.000');
    expect(html).toContain('720.000');
    expect(html).toContain('9.720.000');
  });

  it('dữ liệu hỏng: customer hoặc version null → 404 NOT_FOUND, KHÔNG render/upload', async () => {
    customerFindUnique.mockResolvedValue(null);
    const loiKhach = await bat(
      service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA),
    );
    expect(loiKhach.errorCode).toBe('NOT_FOUND');
    expect(loiKhach.getStatus()).toBe(404);

    customerFindUnique.mockResolvedValue(KHACH);
    versionFindUnique.mockResolvedValue(null);
    const loiVersion = await bat(
      service.exportQuote(ACTOR, ORDER_ID, 8, false, XEM_TAT_CA),
    );
    expect(loiVersion.errorCode).toBe('NOT_FOUND');
    expect(loiVersion.getStatus()).toBe(404);

    expect(callLog).toEqual([]);
  });

  it.each(['anh', 'pdf'] as const)(
    'getExportFile(%s): kiểm phạm vi với quyền người gọi; ngoài phạm vi ⇒ 404 TRƯỚC khi đọc hồ sơ xuất và R2',
    async (kind) => {
      const quyen = new Set<string>([PERM.ordersViewOwn]);
      ordersAssertScoped.mockRejectedValue(
        new AppException(
          ErrorCode.NOT_FOUND,
          404,
          `Không tìm thấy đơn hàng: ${ORDER_ID}`,
        ),
      );

      const loi = await bat(
        service.getExportFile(ACTOR, quyen, ORDER_ID, kind),
      );

      expect(ordersAssertScoped).toHaveBeenCalledWith(ACTOR, quyen, ORDER_ID);
      expect(loi.getStatus()).toBe(404);
      expect(loi.message).toBe(`Không tìm thấy đơn hàng: ${ORDER_ID}`);
      expect(quoteExportFindUnique).not.toHaveBeenCalled();
      expect(getObject).not.toHaveBeenCalled();
    },
  );

  it('getExportFile: chưa xuất lần nào → 404 NOT_FOUND, KHÔNG gọi storage', async () => {
    quoteExportFindUnique.mockResolvedValue(null);

    const loi = await bat(
      service.getExportFile(ACTOR, XEM_TAT_CA, ORDER_ID, 'anh'),
    );
    expect(loi.errorCode).toBe('NOT_FOUND');
    expect(loi.getStatus()).toBe(404);
    expect(getObject).not.toHaveBeenCalled();
  });

  it('getExportFile: đọc đúng key theo kind + contentType/fileName cố định theo loại', async () => {
    quoteExportFindUnique.mockResolvedValue({
      orderId: ORDER_ID,
      imageKey: `quotes/${ORDER_ID}/bao-gia.png`,
      pdfKey: `quotes/${ORDER_ID}/bao-gia.pdf`,
      fileName: `bao-gia-${ORDER_ID8}`,
    });
    getObject.mockResolvedValue({
      body: PNG_BYTES,
      contentType: 'application/octet-stream',
    });

    const anh = await service.getExportFile(ACTOR, XEM_TAT_CA, ORDER_ID, 'anh');
    expect(getObject).toHaveBeenLastCalledWith(`quotes/${ORDER_ID}/bao-gia.png`);
    expect(anh.contentType).toBe('image/png');
    expect(anh.fileName).toBe(`bao-gia-${ORDER_ID8}.png`);
    expect(anh.body).toBe(PNG_BYTES);

    getObject.mockResolvedValue({
      body: PDF_BYTES,
      contentType: 'application/octet-stream',
    });
    const pdf = await service.getExportFile(ACTOR, XEM_TAT_CA, ORDER_ID, 'pdf');
    expect(getObject).toHaveBeenLastCalledWith(`quotes/${ORDER_ID}/bao-gia.pdf`);
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.fileName).toBe(`bao-gia-${ORDER_ID8}.pdf`);
  });
});
