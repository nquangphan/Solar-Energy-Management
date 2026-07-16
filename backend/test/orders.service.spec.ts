import type { Order, OrderLineItem } from '@prisma/client';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import { lineAmount } from '../src/orders/domain/line-amount';
import {
  OrderCreated,
  OrderLineAdded,
  OrderLineRemoved,
  OrderLineUpdated,
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
    // `$transaction` array Prisma: trả tuple đúng thứ tự op truyền vào.
    transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  describe('AC-1/AC-4 — tạo đơn: một transaction 3 op, snapshot sourceId từ Customer', () => {
    it('ghi ĐÚNG payload: status baogia, owner = actor, sourceId = Customer.sourceId, versionNo 1, repoint pointer', async () => {
      await service.create(ACTOR, { customerSdt: '0912 345 678' });

      // Đúng MỘT transaction, đúng 3 op — FK vòng không cho phép tách rời.
      expect(transaction).toHaveBeenCalledTimes(1);
      expect((transaction.mock.calls[0][0] as unknown[]).length).toBe(3);

      // Op 1 — Order: assert TOÀN BỘ data. `sourceId`/`custType` phải là giá trị của
      // CUSTOMER (snapshot lúc tạo), `customerSdt` là chuỗi ĐÃ chuẩn hoá, owner là actor.
      expect(orderRepo.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          status: 'baogia',
          customerSdt: SDT_E164,
          ownerAccountId: ACTOR,
          sourceId: NGUON_FACEBOOK_ID,
          custType: 'CA_NHAN',
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
