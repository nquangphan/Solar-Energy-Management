import type { Order, OrderLineItem } from '@prisma/client';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import { lineAmount } from '../src/orders/domain/line-amount';
import {
  OrderConfirmed,
  OrderCreated,
  OrderLineAdded,
  OrderLineRemoved,
  OrderLineUpdated,
  OrderMetaChanged,
  OrderScopeChanged,
} from '../src/orders/domain/order-events';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Unit test `OrdersService` — Prisma mock, EventBus mock.
 *
 * Test canh **PAYLOAD GHI DB** (`data`/`where`), KHÔNG đếm số lần gọi (bài học CRITICAL review
 * 3.2: test đếm-lần-gọi vẫn xanh khi hai field hoán vị). Ba bất biến đắt nhất của story:
 *
 *  1. `Order.sourceId` trong `data` = `Customer.sourceId` (SNAPSHOT lúc tạo, FR-35) — hoán
 *     thành đọc live hay nhận từ client đều phải làm test ĐỎ.
 *  2. Tạo đơn là MỘT `$transaction` đúng 3 op (FK vòng — order → version 1 → repoint).
 *  3. Đơn giá dòng catalog do `resolveUnitPrice()` quyết, KHÔNG phải client.
 */
describe('OrdersService', () => {
  const ACTOR = 'acc-quote-1';
  const SDT_E164 = '+84912345678';
  const NGUON_FACEBOOK_ID = 'src-fb';

  const KHACH = {
    sdt: SDT_E164,
    custType: 'CA_NHAN',
    name: 'Nguyễn Văn A',
    cccd: null,
    taxCode: null,
    address: null,
    bankAccount: null,
    sourceId: NGUON_FACEBOOK_ID,
    sourceNote: null,
    createdAt: new Date('2026-07-16T00:00:00Z'),
    updatedAt: new Date('2026-07-16T00:00:00Z'),
  };

  const VERSION_ID = 'ver-1';
  const DON_BAOGIA: Order = {
    id: 'ord-1',
    status: 'baogia',
    customerSdt: SDT_E164,
    currentVersionId: VERSION_ID,
    ownerAccountId: ACTOR,
    assigneeAccountId: null,
    sourceId: NGUON_FACEBOOK_ID,
    custType: 'CA_NHAN',
    scopeThietBi: true,
    scopeThiCong: false,
    scopeVanChuyen: false,
    kWp: null,
    vatMode: null,
    validityNote: null,
    createdAt: new Date('2026-07-16T01:00:00Z'),
    updatedAt: new Date('2026-07-16T01:00:00Z'),
  };

  /** Sản phẩm catalog KHÔNG cho sửa giá — có bậc thang để test resolveUnitPrice. */
  const PIN_580W = {
    id: 'prod-pin',
    name: 'Tấm pin JA Solar 580W',
    unit: 'tấm',
    price: 2_450_000,
    priceEditable: false,
    warrantyMonths: 144,
    prices: [{ minQty: 10, price: 2_300_000 }],
  };
  /** Sản phẩm CHO sửa giá (phí lắp đặt). */
  const PHI_LAP_DAT = {
    id: 'prod-lapdat',
    name: 'Phí lắp đặt',
    unit: 'gói',
    price: 5_000_000,
    priceEditable: true,
    warrantyMonths: null,
    prices: [],
  };

  const DONG_CATALOG: OrderLineItem = {
    id: 'line-1',
    orderVersionId: VERSION_ID,
    productId: PIN_580W.id,
    name: PIN_580W.name,
    unit: PIN_580W.unit,
    qty: 8,
    unitPrice: 2_450_000,
    priceEditable: false,
    isFlexible: false,
    note: null,
    warrantyMonths: 144,
    unitPriceSnapshot: null,
    catalogPriceSnapshot: null,
    costPriceSnapshot: null,
    warrantyStartAt: null,
    displayOrder: 0,
    createdAt: new Date('2026-07-16T02:00:00Z'),
    updatedAt: new Date('2026-07-16T02:00:00Z'),
  };

  const orderRepo = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const orderVersionRepo = { create: jest.fn() };
  const lineRepo = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const productRepo = { findUnique: jest.fn(), findMany: jest.fn() };
  const customerRepo = { findUnique: jest.fn() };
  const transaction = jest.fn();
  // Interactive tx cho confirm(): callback nhận CHÍNH bộ mock này làm `tx`.
  const txOrderRepo = { updateMany: jest.fn() };
  const txVersionRepo = { update: jest.fn() };
  const txLineRepo = { update: jest.fn() };
  const txMock = {
    order: txOrderRepo,
    orderVersion: txVersionRepo,
    orderLineItem: txLineRepo,
  };
  const prisma = {
    order: orderRepo,
    orderVersion: orderVersionRepo,
    orderLineItem: lineRepo,
    product: productRepo,
    customer: customerRepo,
    $transaction: transaction,
  } as unknown as PrismaService;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  const service = new OrdersService(prisma, eventBus as unknown as EventBus);

  /** Bắt `AppException` để assert `errorCode`/`fieldErrors`/status. */
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
    customerRepo.findUnique.mockResolvedValue(KHACH);
    orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);
    orderRepo.create.mockResolvedValue({
      ...DON_BAOGIA,
      currentVersionId: null,
    });
    orderRepo.update.mockResolvedValue(DON_BAOGIA);
    orderVersionRepo.create.mockResolvedValue({ id: VERSION_ID });
    // Giỏ rỗng mặc định: không có dòng nào ⇒ displayOrder bắt đầu từ 0.
    lineRepo.findFirst.mockResolvedValue(null);
    lineRepo.create.mockResolvedValue(DONG_CATALOG);
    lineRepo.findUnique.mockResolvedValue(DONG_CATALOG);
    lineRepo.findMany.mockResolvedValue([]);
    productRepo.findUnique.mockResolvedValue(PIN_580W);
    productRepo.findMany.mockResolvedValue([PIN_580W]);
    // `$transaction` hai kiểu: array trả tuple đúng thứ tự op; interactive (callback) gọi
    // callback với bộ mock tx — throw trong callback nổi lên như Prisma rollback thật.
    transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(txMock)
        : Promise.all(arg as Promise<unknown>[]),
    );
    txOrderRepo.updateMany.mockResolvedValue({ count: 1 });
    txVersionRepo.update.mockResolvedValue({});
    txLineRepo.update.mockResolvedValue({});
  });

  describe('AC-1/AC-4 — tạo đơn: một transaction 3 op, snapshot sourceId từ Customer', () => {
    it('ghi ĐÚNG payload: status baogia, owner = actor, sourceId = Customer.sourceId, versionNo 1, repoint pointer', async () => {
      await service.create(ACTOR, { customerSdt: '0912 345 678' });

      // Đúng MỘT transaction, đúng 3 op — FK vòng không cho phép tách rời.
      expect(transaction).toHaveBeenCalledTimes(1);
      expect((transaction.mock.calls[0][0] as unknown[]).length).toBe(3);

      // Op 1 — Order: assert TOÀN BỘ data. `sourceId`/`custType` phải là giá trị của
      // CUSTOMER (snapshot lúc tạo), `customerSdt` là chuỗi ĐÃ chuẩn hoá, owner là actor.
      // 3 cờ phạm vi + `vatMode` phải nằm TƯỜNG MINH trong payload (preset CA_NHAN = cả 3
      // true; tick VAT mặc định 'co_vat') — service tự ghi, KHÔNG dựa DB default/null
      // (default trùng preset Thương mại là ngẫu nhiên; null là dấu hiệu đơn trước 4.4).
      expect(orderRepo.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          status: 'baogia',
          customerSdt: SDT_E164,
          ownerAccountId: ACTOR,
          sourceId: NGUON_FACEBOOK_ID,
          custType: 'CA_NHAN',
          scopeThietBi: true,
          scopeThiCong: true,
          scopeVanChuyen: true,
          vatMode: 'co_vat',
        },
      });

      // Op 2 — Version 1 của đúng order id vừa sinh.
      const orderId = (
        orderRepo.create.mock.calls[0][0] as { data: { id: string } }
      ).data.id;
      expect(orderVersionRepo.create).toHaveBeenCalledWith({
        data: { id: expect.any(String), orderId, versionNo: 1 },
      });

      // Op 3 — repoint `currentVersionId` về đúng version vừa sinh.
      const versionId = (
        orderVersionRepo.create.mock.calls[0][0] as { data: { id: string } }
      ).data.id;
      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { currentVersionId: versionId },
      });
    });

    it('khách THUONG_MAI ⇒ payload preset true/false/false (chỉ Thiết bị bật)', async () => {
      customerRepo.findUnique.mockResolvedValue({
        ...KHACH,
        custType: 'THUONG_MAI',
        taxCode: '0312345678',
      });

      await service.create(ACTOR, { customerSdt: '0912 345 678' });

      expect(orderRepo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          custType: 'THUONG_MAI',
          scopeThietBi: true,
          scopeThiCong: false,
          scopeVanChuyen: false,
        }) as unknown,
      });
    });

    it('khách không tồn tại ⇒ 404 NOT_FOUND, DB không bị ghi', async () => {
      customerRepo.findUnique.mockResolvedValue(null);

      const err = await bat(
        service.create(ACTOR, { customerSdt: '0912345678' }),
      );

      expect(err).toBeInstanceOf(AppException);
      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(err.getStatus()).toBe(404);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('SĐT rác ⇒ 400 kèm fieldErrors trỏ customerSdt', async () => {
      const err = await bat(service.create(ACTOR, { customerSdt: 'abc' }));

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0]?.field).toBe('customerSdt');
      expect(customerRepo.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('AC-2/AC-5 — thêm dòng catalog: giá do resolveUnitPrice quyết', () => {
    it('auto-điền unitPrice theo bậc thang khi cờ BẬT (qty đạt ngưỡng ⇒ giá sỉ), copy field từ Product', async () => {
      await service.addLine(
        ACTOR,
        DON_BAOGIA.id,
        { productId: PIN_580W.id, qty: 10 },
        true,
      );

      expect(lineRepo.create).toHaveBeenCalledWith({
        data: {
          orderVersionId: VERSION_ID,
          productId: PIN_580W.id,
          name: PIN_580W.name,
          unit: PIN_580W.unit,
          qty: 10,
          // Bậc minQty 10 ⇒ 2_300_000 — KHÔNG phải basePrice. Đây là bằng chứng
          // resolveUnitPrice() được gọi với tiers + flag, không tra Product.price trần.
          unitPrice: 2_300_000,
          priceEditable: false,
          warrantyMonths: 144,
          isFlexible: false,
          note: null,
          displayOrder: 0,
        },
      });
    });

    it('cờ TẮT ⇒ basePrice kể cả khi qty đạt ngưỡng bậc thang', async () => {
      await service.addLine(
        ACTOR,
        DON_BAOGIA.id,
        { productId: PIN_580W.id, qty: 10 },
        false,
      );

      const data = (
        lineRepo.create.mock.calls[0][0] as { data: { unitPrice: number } }
      ).data;
      expect(data.unitPrice).toBe(2_450_000);
    });

    it('client gửi unitPrice cho sản phẩm priceEditable=false ⇒ 400 fieldErrors, KHÔNG ghi DB', async () => {
      const err = await bat(
        service.addLine(
          ACTOR,
          DON_BAOGIA.id,
          { productId: PIN_580W.id, qty: 1, unitPrice: 1 },
          true,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0]?.field).toBe('unitPrice');
      expect(lineRepo.create).not.toHaveBeenCalled();
    });

    it('sản phẩm priceEditable=true ⇒ giá client THẮNG giá danh mục', async () => {
      productRepo.findUnique.mockResolvedValue(PHI_LAP_DAT);

      await service.addLine(
        ACTOR,
        DON_BAOGIA.id,
        { productId: PHI_LAP_DAT.id, qty: 1, unitPrice: 4_000_000 },
        true,
      );

      const data = (
        lineRepo.create.mock.calls[0][0] as {
          data: { unitPrice: number; priceEditable: boolean };
        }
      ).data;
      expect(data.unitPrice).toBe(4_000_000);
      expect(data.priceEditable).toBe(true);
    });

    it('productId không tồn tại ⇒ 400 fieldErrors productId', async () => {
      productRepo.findUnique.mockResolvedValue(null);

      const err = await bat(
        service.addLine(
          ACTOR,
          DON_BAOGIA.id,
          { productId: 'prod-ma', qty: 1 },
          true,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0]?.field).toBe('productId');
    });

    it('dòng tự do: ghi đúng payload nhập tay, priceEditable=true, displayOrder cuối danh sách', async () => {
      // Dòng cuối hiện tại mang displayOrder 2 ⇒ dòng mới phải là 3 (max + 1 —
      // count sẽ sai ngay khi lịch sử có một lần xoá).
      lineRepo.findFirst.mockResolvedValue({ displayOrder: 2 });
      lineRepo.create.mockResolvedValue({
        ...DONG_CATALOG,
        id: 'line-free',
        productId: null,
        priceEditable: true,
        displayOrder: 3,
      });

      await service.addLine(
        ACTOR,
        DON_BAOGIA.id,
        {
          name: 'Combo phụ kiện\nlắp đặt',
          unit: 'bộ',
          qty: 2,
          unitPrice: 350_000,
          note: 'kèm jack MC4',
        },
        true,
      );

      expect(lineRepo.findFirst).toHaveBeenCalledWith({
        where: { orderVersionId: VERSION_ID },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      expect(lineRepo.create).toHaveBeenCalledWith({
        data: {
          orderVersionId: VERSION_ID,
          productId: null,
          name: 'Combo phụ kiện\nlắp đặt',
          unit: 'bộ',
          qty: 2,
          unitPrice: 350_000,
          priceEditable: true,
          warrantyMonths: null,
          isFlexible: false,
          note: 'kèm jack MC4',
          displayOrder: 3,
        },
      });
    });
  });

  describe('AC-1 — con trỏ bản hiệu lực (currentVersionId)', () => {
    it('get() với pointer null ⇒ lineItems rỗng, KHÔNG truy vấn dòng', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        currentVersionId: null,
      });

      const view = await service.get(DON_BAOGIA.id, true);

      expect(view.lineItems).toEqual([]);
      expect(lineRepo.findMany).not.toHaveBeenCalled();
    });

    it('addLine trên đơn pointer null ⇒ 409 (dữ liệu hỏng, không phải nhánh nghiệp vụ), KHÔNG ghi DB', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        currentVersionId: null,
      });

      const err = await bat(
        service.addLine(
          ACTOR,
          DON_BAOGIA.id,
          { productId: PIN_580W.id, qty: 1 },
          true,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(lineRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('AC-2 — sửa/xoá dòng', () => {
    it('sửa unitPrice trên dòng priceEditable=false ⇒ 400 fieldErrors, KHÔNG update', async () => {
      const err = await bat(
        service.updateLine(
          ACTOR,
          DON_BAOGIA.id,
          DONG_CATALOG.id,
          { unitPrice: 1 },
          true,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.fieldErrors?.[0]?.field).toBe('unitPrice');
      expect(lineRepo.update).not.toHaveBeenCalled();
    });

    it('sửa qty/note/isFlexible ghi đúng payload PATCH (field vắng = undefined, Prisma bỏ qua)', async () => {
      lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, qty: 12 });

      await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        DONG_CATALOG.id,
        { qty: 12, isFlexible: true },
        true,
      );

      expect(lineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          qty: 12,
          unitPrice: undefined,
          note: undefined,
          isFlexible: true,
        },
      });
    });

    it('sửa unitPrice trên dòng priceEditable=true THÀNH CÔNG — giá mới ghi DB, response trả giá đã lưu', async () => {
      const dongPhiLapDat: OrderLineItem = {
        ...DONG_CATALOG,
        id: 'line-editable',
        productId: PHI_LAP_DAT.id,
        priceEditable: true,
        unitPrice: 4_000_000,
        qty: 1,
      };
      lineRepo.findUnique.mockResolvedValue(dongPhiLapDat);
      lineRepo.update.mockResolvedValue({
        ...dongPhiLapDat,
        unitPrice: 4_500_000,
      });

      const view = await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        dongPhiLapDat.id,
        { unitPrice: 4_500_000 },
        true,
      );

      expect(lineRepo.update).toHaveBeenCalledWith({
        where: { id: dongPhiLapDat.id },
        data: {
          qty: undefined,
          unitPrice: 4_500_000,
          note: undefined,
          isFlexible: undefined,
        },
      });
      // Dòng sửa-được-giá trả giá ĐÃ LƯU, không tra lại danh mục.
      expect(view.unitPrice).toBe(4_500_000);
      expect(view.amount).toBe(lineAmount(4_500_000, 1));
      expect(productRepo.findMany).not.toHaveBeenCalled();
    });

    it('note: null xoá ghi chú — null đi TỚI Prisma (khác undefined = giữ nguyên)', async () => {
      lineRepo.findUnique.mockResolvedValue({
        ...DONG_CATALOG,
        note: 'ghi chú cũ',
      });
      lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, note: null });

      const view = await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        DONG_CATALOG.id,
        { note: null },
        true,
      );

      expect(lineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          qty: undefined,
          unitPrice: undefined,
          note: null,
          isFlexible: undefined,
        },
      });
      expect(view.note).toBeNull();
    });

    it('dòng thuộc version KHÁC (không phải bản hiệu lực) ⇒ 404, không sửa được', async () => {
      lineRepo.findUnique.mockResolvedValue({
        ...DONG_CATALOG,
        orderVersionId: 'ver-cu',
      });

      const err = await bat(
        service.updateLine(
          ACTOR,
          DON_BAOGIA.id,
          DONG_CATALOG.id,
          { qty: 2 },
          true,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(lineRepo.update).not.toHaveBeenCalled();
    });

    it('xoá dòng: delete đúng where, publish OrderLineRemoved mang before', async () => {
      await service.removeLine(ACTOR, DON_BAOGIA.id, DONG_CATALOG.id);

      expect(lineRepo.delete).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
      });
      const event = eventBus.publish.mock.calls[0][0] as OrderLineRemoved;
      expect(event).toBeInstanceOf(OrderLineRemoved);
      expect(event.before.id).toBe(DONG_CATALOG.id);
      expect(event.target).toEqual({ type: 'Order', id: DON_BAOGIA.id });
    });
  });

  describe('AC-2 — guard trạng thái: mutation chỉ khi đơn còn baogia', () => {
    const daChot: Order = { ...DON_BAOGIA, status: 'dachot' };

    it.each([
      [
        'addLine',
        () =>
          service.addLine(
            ACTOR,
            DON_BAOGIA.id,
            { productId: PIN_580W.id, qty: 1 },
            true,
          ),
      ],
      [
        'updateLine',
        () =>
          service.updateLine(
            ACTOR,
            DON_BAOGIA.id,
            DONG_CATALOG.id,
            { qty: 2 },
            true,
          ),
      ],
      [
        'removeLine',
        () => service.removeLine(ACTOR, DON_BAOGIA.id, DONG_CATALOG.id),
      ],
    ])(
      '%s trên đơn đã chốt ⇒ 409 CONFLICT, DB không bị ghi',
      async (_ten, goi) => {
        orderRepo.findUnique.mockResolvedValue(daChot);

        const err = await bat(goi());

        expect(err.errorCode).toBe(ErrorCode.CONFLICT);
        expect(err.getStatus()).toBe(409);
        expect(lineRepo.create).not.toHaveBeenCalled();
        expect(lineRepo.update).not.toHaveBeenCalled();
        expect(lineRepo.delete).not.toHaveBeenCalled();
      },
    );
  });

  describe('AC-3 — event publish SAU commit, before/after đúng', () => {
    it('OrderCreated publish SAU khi $transaction resolve, snapshot mang sourceId đã copy', async () => {
      const thuTu: string[] = [];
      transaction.mockImplementation(async (ops: Promise<unknown>[]) => {
        thuTu.push('commit');
        return Promise.all(ops);
      });
      eventBus.publish.mockImplementation(async () => {
        thuTu.push('publish');
      });

      await service.create(ACTOR, { customerSdt: SDT_E164 });

      expect(thuTu).toEqual(['commit', 'publish']);
      const event = eventBus.publish.mock.calls[0][0] as OrderCreated;
      expect(event).toBeInstanceOf(OrderCreated);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.after.sourceId).toBe(NGUON_FACEBOOK_ID);
      expect(event.after.status).toBe('baogia');
      expect(event.target.type).toBe('Order');
    });

    it('OrderLineAdded publish SAU create, after là snapshot dòng vừa ghi', async () => {
      const thuTu: string[] = [];
      lineRepo.create.mockImplementation(async () => {
        thuTu.push('write');
        return DONG_CATALOG;
      });
      eventBus.publish.mockImplementation(async () => {
        thuTu.push('publish');
      });

      await service.addLine(
        ACTOR,
        DON_BAOGIA.id,
        { productId: PIN_580W.id, qty: 8 },
        true,
      );

      expect(thuTu).toEqual(['write', 'publish']);
      const event = eventBus.publish.mock.calls[0][0] as OrderLineAdded;
      expect(event).toBeInstanceOf(OrderLineAdded);
      expect(event.after.qty).toBe(8);
      expect(event.target).toEqual({ type: 'Order', id: DON_BAOGIA.id });
    });

    it('OrderLineUpdated mang CẢ before lẫn after (audit trước→sau)', async () => {
      lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, qty: 12 });

      await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        DONG_CATALOG.id,
        { qty: 12 },
        true,
      );

      const event = eventBus.publish.mock.calls[0][0] as OrderLineUpdated;
      expect(event).toBeInstanceOf(OrderLineUpdated);
      expect(event.before.qty).toBe(8);
      expect(event.after.qty).toBe(12);
    });
  });

  describe('update — toggle cờ phạm vi trong cửa sổ baogia (Story 4.3)', () => {
    it('happy path: ghi ĐÚNG where + data (chỉ field client gửi), trả view phản ánh cờ mới', async () => {
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        scopeThiCong: true,
      });

      const view = await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { scopeThiCong: true },
        true,
      );

      // Partial đúng nghĩa: field không gửi phải là undefined (Prisma bỏ qua),
      // KHÔNG được lôi giá trị hiện tại vào data.
      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id },
        data: { scopeThiCong: true, scopeVanChuyen: undefined },
      });
      expect(view.scopeThiCong).toBe(true);
      expect(view.scopeThietBi).toBe(true);
    });

    it('đơn không tồn tại ⇒ 404 NOT_FOUND, không ghi', async () => {
      orderRepo.findUnique.mockResolvedValue(null);

      const err = await bat(
        service.update(ACTOR, 'ord-x', { scopeThiCong: true }, true),
      );

      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(err.getStatus()).toBe(404);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('đơn ngoài baogia ⇒ 409 CONFLICT, không ghi, không event', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const err = await bat(
        service.update(
          ACTOR,
          DON_BAOGIA.id,
          { scopeVanChuyen: true },
          true,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('OrderScopeChanged publish SAU khi ghi, mang before→after đúng cờ đổi', async () => {
      const thuTu: string[] = [];
      orderRepo.update.mockImplementation(async () => {
        thuTu.push('write');
        return { ...DON_BAOGIA, scopeVanChuyen: true };
      });
      eventBus.publish.mockImplementation(async () => {
        thuTu.push('publish');
      });

      await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { scopeVanChuyen: true },
        true,
      );

      expect(thuTu).toEqual(['write', 'publish']);
      const event = eventBus.publish.mock.calls[0][0] as OrderScopeChanged;
      expect(event).toBeInstanceOf(OrderScopeChanged);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.before.scopeVanChuyen).toBe(false);
      expect(event.after.scopeVanChuyen).toBe(true);
      expect(event.target).toEqual({ type: 'Order', id: DON_BAOGIA.id });
    });

    it('cả 2 cờ trong MỘT lần PATCH ⇒ data mang cả hai, view phản ánh cả hai', async () => {
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        scopeThiCong: true,
        scopeVanChuyen: true,
      });

      const view = await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { scopeThiCong: true, scopeVanChuyen: true },
        true,
      );

      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id },
        data: { scopeThiCong: true, scopeVanChuyen: true },
      });
      expect(view.scopeThiCong).toBe(true);
      expect(view.scopeVanChuyen).toBe(true);
    });

    it('body rỗng (không field nào) ⇒ trả view hiện tại, KHÔNG ghi, KHÔNG event', async () => {
      const view = await service.update(
        ACTOR,
        DON_BAOGIA.id,
        {},
        true,
      );

      expect(view.scopeThiCong).toBe(DON_BAOGIA.scopeThiCong);
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('update — metadata vatMode/kWp/validityNote (Story 4.4)', () => {
    it('đổi tick VAT: ghi ĐÚNG where + data (chỉ vatMode), publish CHỈ OrderMetaChanged mang before→after', async () => {
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        vatMode: 'khong_vat',
      });

      const view = await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { vatMode: 'khong_vat' },
        true,
      );

      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id },
        data: {
          scopeThiCong: undefined,
          scopeVanChuyen: undefined,
          vatMode: 'khong_vat',
          kWp: undefined,
          validityNote: undefined,
        },
      });
      expect(view.vatMode).toBe('khong_vat');

      // CHỈ meta đổi ⇒ đúng MỘT event, đúng loại — không OrderScopeChanged ké theo.
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = eventBus.publish.mock.calls[0][0] as OrderMetaChanged;
      expect(event).toBeInstanceOf(OrderMetaChanged);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.before.vatMode).toBeNull();
      expect(event.after.vatMode).toBe('khong_vat');
      expect(event.target).toEqual({ type: 'Order', id: DON_BAOGIA.id });
    });

    it('nhập kWp + validityNote: data mang đúng giá trị, snapshot event có đủ 3 field meta', async () => {
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        kWp: 8.82,
        validityNote: '48h kể từ ngày lên PO',
      });

      const view = await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { kWp: 8.82, validityNote: '48h kể từ ngày lên PO' },
        true,
      );

      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id },
        data: {
          scopeThiCong: undefined,
          scopeVanChuyen: undefined,
          vatMode: undefined,
          kWp: 8.82,
          validityNote: '48h kể từ ngày lên PO',
        },
      });
      expect(view.kWp).toBe(8.82);
      expect(view.validityNote).toBe('48h kể từ ngày lên PO');

      const event = eventBus.publish.mock.calls[0][0] as OrderMetaChanged;
      expect(event.before.kWp).toBeNull();
      expect(event.after.kWp).toBe(8.82);
      expect(event.after.validityNote).toBe('48h kể từ ngày lên PO');
    });

    it('kWp/validityNote = null GHI null (xoá giá trị) — null đi TỚI Prisma, khác undefined', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        kWp: 8.82,
        validityNote: '48h',
      });
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        kWp: null,
        validityNote: null,
      });

      const view = await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { kWp: null, validityNote: null },
        true,
      );

      expect(orderRepo.update).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id },
        data: {
          scopeThiCong: undefined,
          scopeVanChuyen: undefined,
          vatMode: undefined,
          kWp: null,
          validityNote: null,
        },
      });
      expect(view.kWp).toBeNull();
      expect(view.validityNote).toBeNull();
    });

    it('CHỈ scope đổi ⇒ CHỈ OrderScopeChanged (không OrderMetaChanged ké)', async () => {
      orderRepo.update.mockResolvedValue({
        ...DON_BAOGIA,
        scopeThiCong: true,
      });

      await service.update(ACTOR, DON_BAOGIA.id, { scopeThiCong: true }, true);

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
        OrderScopeChanged,
      );
    });

    it('scope + meta trong MỘT PATCH ⇒ HAI event, mỗi event đúng loại, cả hai SAU write', async () => {
      const thuTu: string[] = [];
      orderRepo.update.mockImplementation(async () => {
        thuTu.push('write');
        return { ...DON_BAOGIA, scopeVanChuyen: true, vatMode: 'khong_vat' };
      });
      eventBus.publish.mockImplementation(async (event: unknown) => {
        thuTu.push(
          event instanceof OrderScopeChanged ? 'publish-scope' : 'publish-meta',
        );
      });

      await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { scopeVanChuyen: true, vatMode: 'khong_vat' },
        true,
      );

      expect(thuTu).toEqual(['write', 'publish-scope', 'publish-meta']);
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(
        OrderScopeChanged,
      );
      expect(eventBus.publish.mock.calls[1][0]).toBeInstanceOf(
        OrderMetaChanged,
      );
    });

    it('meta trên đơn ngoài baogia ⇒ 409, không ghi, không event (4.5 snapshot lúc Chốt)', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const err = await bat(
        service.update(ACTOR, DON_BAOGIA.id, { vatMode: 'khong_vat' }, true),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('previewTotal — stateless, một bộ tính (AD-16, Story 4.2/4.4)', () => {
    it('trả đúng tổng theo rate truyền vào (8%) half-up — số kỳ vọng tính TAY, không tautology', () => {
      const result = service.previewTotal(
        {
          lines: [
            { unitPrice: 2_450_000, qty: 8 },
            { unitPrice: 500_000, qty: 1 },
          ],
        },
        8,
      );

      // 19_600_000 + 500_000 = 20_100_000; 8% = 1_608_000.
      expect(result).toEqual({
        subtotal: 20_100_000,
        vatAmount: 1_608_000,
        total: 21_708_000,
      });
    });

    it('rate từ config (10) THẮNG — service dùng đúng số controller resolve, không hardcode 8', () => {
      const result = service.previewTotal(
        { lines: [{ unitPrice: 1_000_000, qty: 1 }] },
        10,
      );

      expect(result).toEqual({
        subtotal: 1_000_000,
        vatAmount: 100_000,
        total: 1_100_000,
      });
    });

    it("vatMode 'khong_vat' ⇒ vatAmount 0, total = subtotal (tick tắt VAT, FR-3)", () => {
      const result = service.previewTotal(
        {
          lines: [{ unitPrice: 2_450_000, qty: 8 }],
          vatMode: 'khong_vat',
        },
        8,
      );

      expect(result).toEqual({
        subtotal: 19_600_000,
        vatAmount: 0,
        total: 19_600_000,
      });
    });

    it("vatMode 'co_vat' và VẮNG field cho CÙNG kết quả (đơn cũ vatMode null = có VAT)", () => {
      const coVat = service.previewTotal(
        { lines: [{ unitPrice: 1_000_000, qty: 1 }], vatMode: 'co_vat' },
        8,
      );
      const vangField = service.previewTotal(
        { lines: [{ unitPrice: 1_000_000, qty: 1 }] },
        8,
      );

      expect(coVat).toEqual(vangField);
      expect(coVat.vatAmount).toBe(80_000);
    });

    it('mảng rỗng ⇒ {0,0,0}; KHÔNG chạm Prisma, KHÔNG publish event', () => {
      const result = service.previewTotal({ lines: [] }, 8);

      expect(result).toEqual({ subtotal: 0, vatAmount: 0, total: 0 });
      // Stateless đúng nghĩa: zero interaction với DB lẫn EventBus.
      for (const repo of [
        orderRepo,
        orderVersionRepo,
        lineRepo,
        productRepo,
        customerRepo,
      ]) {
        for (const fn of Object.values(repo)) {
          expect(fn).not.toHaveBeenCalled();
        }
      }
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('confirm — Chốt Đơn + snapshot giá (Story 4.5, FR-5/AD-6/AD-16)', () => {
    /** Dòng phí lắp đặt ĐÃ SỬA GIÁ (4tr) — giá danh mục là 5tr: chênh lệch phải lộ ra. */
    const DONG_PHI_LAP: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-phi-lap',
      productId: PHI_LAP_DAT.id,
      name: PHI_LAP_DAT.name,
      unit: PHI_LAP_DAT.unit,
      qty: 1,
      unitPrice: 4_000_000,
      priceEditable: true,
      warrantyMonths: null,
      displayOrder: 1,
    };
    /** Dòng tự do nhập tay — không có giá danh mục để so. */
    const DONG_TU_DO: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-tu-do',
      productId: null,
      name: 'Combo phụ kiện',
      unit: 'bộ',
      qty: 2,
      unitPrice: 350_000,
      priceEditable: true,
      warrantyMonths: null,
      displayOrder: 2,
    };

    beforeEach(() => {
      lineRepo.findMany.mockResolvedValue([
        DONG_CATALOG,
        DONG_PHI_LAP,
        DONG_TU_DO,
      ]);
      // Giá danh mục pin ĐÃ ĐỔI (2_450_000 → 2_600_000) sau khi dòng được thêm: snapshot
      // phải là giá SỐNG resolve tại thời điểm chốt, KHÔNG phải cache `unitPrice` lúc nhập.
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 2_600_000 },
        PHI_LAP_DAT,
      ]);
    });

    it('happy: payload từng op trong tx — updateMany đúng where, version ghi vatRate/vatMode/chotAt, từng dòng đúng cặp snapshot theo 3 loại', async () => {
      const view = await service.confirm(ACTOR, DON_BAOGIA.id, 8, true);

      // Cổng atomic: UPDATE có điều kiện status ngay trong WHERE — không phải update trần.
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'baogia' },
        data: { status: 'dachot' },
      });

      // Version hiệu lực: vatRate từ config (controller resolve), vatMode HIỆU LỰC — đơn
      // vatMode null (trước 4.4) đóng băng thành 'co_vat' TƯỜNG MINH, chotAt là thời điểm chốt.
      expect(txVersionRepo.update).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        data: { vatRate: 8, vatMode: 'co_vat', chotAt: expect.any(Date) },
      });

      // 3 loại dòng — catalog thường: CẢ HAI cột = giá resolve SỐNG (2_600_000, không phải
      // cache 2_450_000); phí lắp: unitPrice ĐÃ SỬA ≠ catalog resolve; tự do: catalog null.
      expect(txLineRepo.update).toHaveBeenCalledTimes(3);
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_600_000,
          catalogPriceSnapshot: 2_600_000,
        },
      });
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_PHI_LAP.id },
        data: {
          unitPriceSnapshot: 4_000_000,
          catalogPriceSnapshot: 5_000_000,
        },
      });
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_TU_DO.id },
        data: { unitPriceSnapshot: 350_000, catalogPriceSnapshot: null },
      });

      // Response nói 'dachot' dù updateMany không trả row (compose trong bộ nhớ).
      expect(view.status).toBe('dachot');

      // Đường tra product của confirm KHÔNG kéo costPrice (PRODUCT_QUOTE_SELECT).
      const select = (
        productRepo.findMany.mock.calls[0][0] as {
          select: Record<string, unknown>;
        }
      ).select;
      expect(select).not.toHaveProperty('costPrice');
    });

    it("đơn vatMode 'khong_vat' ⇒ version snapshot giữ 'khong_vat' (giá trị hiệu lực, không ép co_vat)", async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        vatMode: 'khong_vat',
      });

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true);

      expect(txVersionRepo.update).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        data: { vatRate: 8, vatMode: 'khong_vat', chotAt: expect.any(Date) },
      });
    });

    it("thứ tự ['write','publish'] — OrderConfirmed publish SAU commit, mang before baogia → after dachot", async () => {
      const thuTu: string[] = [];
      transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const ketQua = await callback(txMock);
          thuTu.push('write');
          return ketQua;
        },
      );
      eventBus.publish.mockImplementation(async () => {
        thuTu.push('publish');
      });

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true);

      expect(thuTu).toEqual(['write', 'publish']);
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = eventBus.publish.mock.calls[0][0] as OrderConfirmed;
      expect(event).toBeInstanceOf(OrderConfirmed);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.before.status).toBe('baogia');
      expect(event.after.status).toBe('dachot');
      expect(event.target).toEqual({ type: 'Order', id: DON_BAOGIA.id });
    });

    it("retry trên đơn ĐÃ 'dachot' ⇒ trả view hiện tại, KHÔNG transaction, KHÔNG update, KHÔNG event", async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });

      const view = await service.confirm(ACTOR, DON_BAOGIA.id, 8, true);

      expect(view.status).toBe('dachot');
      expect(transaction).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(txVersionRepo.update).not.toHaveBeenCalled();
      expect(txLineRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("race thua cổng atomic (count 0) → đọc lại thấy 'dachot' ⇒ idempotent: trả view, KHÔNG ghi tiếp, KHÔNG event", async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });
      // Lần 1 (pre-check): còn baogia; lần 2 (đọc lại sau khi thua): bên kia đã chốt.
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_BAOGIA)
        .mockResolvedValueOnce({ ...DON_BAOGIA, status: 'dachot' });

      const view = await service.confirm(ACTOR, DON_BAOGIA.id, 8, true);

      expect(view.status).toBe('dachot');
      // Sentinel abort: các op SAU cổng không được chạy.
      expect(txVersionRepo.update).not.toHaveBeenCalled();
      expect(txLineRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('race thua cổng → đọc lại thấy trạng thái LẠ (huy) ⇒ 409 CONFLICT', async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_BAOGIA)
        .mockResolvedValueOnce({ ...DON_BAOGIA, status: 'huy' });

      const err = await bat(service.confirm(ACTOR, DON_BAOGIA.id, 8, true));

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("trạng thái khác baogia/dachot (huy) ⇒ 409 CONFLICT, KHÔNG transaction", async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'huy',
      });

      const err = await bat(service.confirm(ACTOR, DON_BAOGIA.id, 8, true));

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('đơn 0 dòng ⇒ 400 VALIDATION_ERROR (báo giá rỗng không có gì để đóng băng), KHÔNG transaction', async () => {
      lineRepo.findMany.mockResolvedValue([]);

      const err = await bat(service.confirm(ACTOR, DON_BAOGIA.id, 8, true));

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('toViews ưu tiên snapshot: dòng đã đóng băng trả snapshot dù giá danh mục ĐÃ ĐỔI, bỏ hẳn tra product', async () => {
      // 3 con số PHÂN BIỆT để mutation nào cũng lộ: snapshot 2_400_000 (đúng), cache
      // `unitPrice` 2_450_000 (sai nếu rơi về cache), danh mục sống 9_999_999 (sai nếu
      // live-resolve). Chỉ snapshot được phép thắng.
      lineRepo.findMany.mockResolvedValue([
        {
          ...DONG_CATALOG,
          unitPriceSnapshot: 2_400_000,
          catalogPriceSnapshot: 2_400_000,
        },
      ]);
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 9_999_999 },
      ]);

      const view = await service.get(DON_BAOGIA.id, true);

      expect(view.lineItems[0].unitPrice).toBe(2_400_000);
      expect(view.lineItems[0].amount).toBe(lineAmount(2_400_000, 8));
      // Dòng đóng băng KHÔNG vào liveIds — không còn dòng live nào ⇒ không tra product.
      expect(productRepo.findMany).not.toHaveBeenCalled();
    });

    it('chốt qty chạm bậc thang (cờ tier BẬT) ⇒ snapshot = giá TIER, không phải basePrice', async () => {
      // qty 10 ≥ minQty 10: giá hiệu lực khách đang thấy là tier 2_300_000 —
      // đóng băng phải đúng con số đó, không phải base sống 2_600_000.
      lineRepo.findMany.mockResolvedValue([{ ...DONG_CATALOG, qty: 10 }]);

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true);

      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_300_000,
          catalogPriceSnapshot: 2_300_000,
        },
      });
    });

    it('chốt qty chạm bậc thang nhưng cờ tier TẮT ⇒ snapshot = basePrice (CÙNG cờ với đường live)', async () => {
      // Cùng dữ liệu với test trên, chỉ đảo cờ: nếu confirm() hardcode cờ thay vì
      // nhận từ controller thì test này RED — đóng băng phải đúng số màn đang hiển thị.
      lineRepo.findMany.mockResolvedValue([{ ...DONG_CATALOG, qty: 10 }]);

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, false);

      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_600_000,
          catalogPriceSnapshot: 2_600_000,
        },
      });
    });

    it('product biến mất khỏi danh mục (dữ liệu hỏng) ⇒ snapshot rơi về giá cache của dòng, tx vẫn hoàn tất', async () => {
      // FK restrict lẽ ra chặn xoá Product còn được tham chiếu — nhánh này chỉ là
      // phòng dữ liệu hỏng: rơi về cache `unitPrice` như đường đọc `toViews`.
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
      productRepo.findMany.mockResolvedValue([]);

      const view = await service.confirm(ACTOR, DON_BAOGIA.id, 8, true);

      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_450_000,
          catalogPriceSnapshot: 2_450_000,
        },
      });
      expect(view.status).toBe('dachot');
    });

    it('toViews trộn dòng đóng băng + dòng sống: mỗi dòng theo tín hiệu RIÊNG, product chỉ tra cho dòng sống', async () => {
      // Forward-compat 4.6 (version cũ đã chốt + version mới đang sửa): tín hiệu
      // snapshot nằm trên DÒNG — dòng frozen trả snapshot, dòng sống vẫn re-resolve
      // theo danh mục hiện hành, và liveIds CHỈ chứa product của dòng sống.
      const TU_DIEN = {
        id: 'prod-tu-dien',
        name: 'Tủ điện AC',
        unit: 'bộ',
        price: 1_800_000,
        priceEditable: false,
        warrantyMonths: 24,
        prices: [],
      };
      const DONG_SONG: OrderLineItem = {
        ...DONG_CATALOG,
        id: 'line-song',
        productId: TU_DIEN.id,
        name: TU_DIEN.name,
        unit: TU_DIEN.unit,
        qty: 2,
        // Cache lúc nhập 1_700_000 ≠ danh mục hiện hành 1_800_000: dòng sống phải
        // trả giá MỚI để chứng minh nó không bị dòng frozen kéo theo.
        unitPrice: 1_700_000,
        displayOrder: 1,
      };
      lineRepo.findMany.mockResolvedValue([
        {
          ...DONG_CATALOG,
          unitPriceSnapshot: 2_400_000,
          catalogPriceSnapshot: 2_400_000,
        },
        DONG_SONG,
      ]);
      productRepo.findMany.mockResolvedValue([TU_DIEN]);

      const view = await service.get(DON_BAOGIA.id, true);

      expect(view.lineItems[0].unitPrice).toBe(2_400_000);
      expect(view.lineItems[1].unitPrice).toBe(1_800_000);
      expect(view.lineItems[1].amount).toBe(lineAmount(1_800_000, 2));
      expect(productRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [TU_DIEN.id] } } }),
      );
    });
  });

  describe('FR-5 — giá trước chốt: GET trả giá SỐNG cho dòng catalog không sửa giá', () => {
    it('giá danh mục đổi sau khi thêm dòng ⇒ unitPrice/amount trong response theo giá MỚI, DB không bị ghi đè', async () => {
      // Dòng lưu cache 2_450_000; danh mục đã đổi basePrice thành 2_600_000.
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 2_600_000, prices: [] },
      ]);

      const view = await service.get(DON_BAOGIA.id, true);

      expect(view.lineItems[0].unitPrice).toBe(2_600_000);
      expect(view.lineItems[0].amount).toBe(lineAmount(2_600_000, 8));
      // Đường đọc KHÔNG ghi đè cache trong DB.
      expect(lineRepo.update).not.toHaveBeenCalled();
    });

    it('dòng priceEditable=true giữ giá ĐÃ LƯU (không bị danh mục đè)', async () => {
      const dongPhiLapDat: OrderLineItem = {
        ...DONG_CATALOG,
        id: 'line-2',
        productId: PHI_LAP_DAT.id,
        priceEditable: true,
        unitPrice: 4_000_000,
        qty: 1,
      };
      lineRepo.findMany.mockResolvedValue([dongPhiLapDat]);

      const view = await service.get(DON_BAOGIA.id, true);

      expect(view.lineItems[0].unitPrice).toBe(4_000_000);
      expect(view.lineItems[0].amount).toBe(4_000_000);
      // Không cần tra Product cho dòng giữ-giá-đã-lưu — tránh N+1 vô ích.
      expect(productRepo.findMany).not.toHaveBeenCalled();
    });

    it('truy vấn Product của đường báo giá KHÔNG kéo costPrice (chống leak giá vốn)', async () => {
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
      // Fixture CHỨA costPrice để assert không vacuous: nếu select có lỗ, field này lọt ra.
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, costPrice: 1_950_000 },
      ]);

      await service.get(DON_BAOGIA.id, true);

      const select = (
        productRepo.findMany.mock.calls[0][0] as {
          select: Record<string, unknown>;
        }
      ).select;
      expect(select).not.toHaveProperty('costPrice');
      expect(select).toEqual(
        expect.objectContaining({ id: true, price: true, priceEditable: true }),
      );
    });
  });
});
