import type { Order, OrderLineItem } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import type { EventBus } from '../src/events/event-bus';
import { SU_KIEN } from '../src/orders/domain/allowed-transition';
import { lineAmount } from '../src/orders/domain/line-amount';
import {
  DiscountRequested,
  DiscountResolved,
  OrderConfirmed,
  OrderCreated,
  OrderLineAdded,
  OrderLineRemoved,
  OrderLineUpdated,
  OrderMetaChanged,
  OrderRevised,
  OrderScopeChanged,
  StatusChanged,
} from '../src/orders/domain/order-events';
import { OrdersService } from '../src/orders/orders.service';
import type { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import type { StockItemsService } from '../src/inventory/stock-items.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { fakeStorage } from './util/fake-storage';

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
  /**
   * Bộ quyền ĐẦY ĐỦ — mặc định cho mọi test không xoay quanh permission. Engine transition
   * đánh giá guard theo bộ này; test nào muốn kiểm nhánh 403 thì truyền bộ hẹp hơn.
   */
  const TOAN_QUYEN: ReadonlySet<string> = new Set(Object.values(PERM));

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
    cancelReason: null,
    cancelledAt: null,
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
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const orderVersionRepo = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const lineRepo = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const productRepo = { findUnique: jest.fn(), findMany: jest.fn() };
  const customerRepo = { findUnique: jest.fn() };
  const discountApprovalRepo = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  };
  const transaction = jest.fn();
  const queryRaw = jest.fn();
  /**
   * `tx` bên trong interactive `$transaction` dùng CHÍNH bộ repo mock ở trên — cùng object,
   * chỉ khác tên. Đây là sự thật của Prisma (tx client có cùng bộ model), và nó giữ cho một
   * assertion như `expect(lineRepo.create).toHaveBeenCalledWith(...)` vẫn đúng dù lệnh ghi
   * đã chuyển vào trong tx.
   */
  const txOrderRepo = orderRepo;
  const txVersionRepo = orderVersionRepo;
  const txLineRepo = lineRepo;
  const txDiscountRepo = discountApprovalRepo;
  const txMock = {
    order: txOrderRepo,
    orderVersion: txVersionRepo,
    orderLineItem: txLineRepo,
    discountApproval: txDiscountRepo,
    // `confirm` resolve giá danh mục BÊN TRONG tx (đọc dòng sau khoá ⇒ tra product cũng ở đó).
    product: productRepo,
    $queryRaw: queryRaw,
  };
  const prisma = {
    order: orderRepo,
    orderVersion: orderVersionRepo,
    orderLineItem: lineRepo,
    product: productRepo,
    customer: customerRepo,
    discountApproval: discountApprovalRepo,
    $transaction: transaction,
    $queryRaw: queryRaw,
  } as unknown as PrismaService;
  const eventBus = { publish: jest.fn(), subscribe: jest.fn() };
  // Stock reads the engine / `revise` make under the order lock — default: nothing issued,
  // nothing tracked (this spec is not about stock; `order-stock-issue.spec.ts` is).
  const stockVouchers = {
    findOrderIssueVoucher: jest.fn(),
    lockTrackedProductsInTx: jest.fn(),
    reserveForOrderInTx: jest.fn(),
    releaseHeldForOrderInTx: jest.fn(),
  };
  const service = new OrdersService(
    prisma,
    eventBus as unknown as EventBus,
    fakeStorage(),
    stockVouchers as unknown as StockVouchersService,
    {} as unknown as StockItemsService,
  );

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
    stockVouchers.findOrderIssueVoucher.mockResolvedValue(null);
    stockVouchers.lockTrackedProductsInTx.mockResolvedValue(new Set());
    stockVouchers.reserveForOrderInTx.mockResolvedValue(undefined);
    stockVouchers.releaseHeldForOrderInTx.mockResolvedValue(undefined);
    customerRepo.findUnique.mockResolvedValue(KHACH);
    orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);
    // Lần đọc đầu của đường đọc/ghi do người gọi kích hoạt đi qua `findScopedOrThrow`
    // (`findFirst` + `where.AND`). Spec này KHÔNG về phạm vi (đã có `orders-write-scope.spec.ts`)
    // nên `findFirst` đọc lại qua `findUnique`: mọi chuỗi `mockResolvedValueOnce` của
    // `findUnique` vẫn được tiêu thụ đúng thứ tự như trước khi đường ghi được scope.
    orderRepo.findFirst.mockImplementation((...args: unknown[]) =>
      orderRepo.findUnique(...args),
    );
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
    // CHỈ khai default cho method chưa có default ở trên — `tx*` và repo thường là CÙNG
    // object, khai lại sẽ ghi đè mất giá trị trả về mà test khác đang dựa vào.
    txOrderRepo.updateMany.mockResolvedValue({ count: 1 });
    txVersionRepo.update.mockResolvedValue({});
    txLineRepo.createMany.mockResolvedValue({ count: 0 });
    orderVersionRepo.findUnique.mockResolvedValue(null);
    // Mặc định: đơn chưa từng áp chiết khấu — view compose `discount: null`.
    discountApprovalRepo.findFirst.mockResolvedValue(null);
    discountApprovalRepo.findMany.mockResolvedValue([]);
    txDiscountRepo.create.mockResolvedValue({});
    txDiscountRepo.updateMany.mockResolvedValue({ count: 1 });
    queryRaw.mockResolvedValue([{ id: DON_BAOGIA.id }]);
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
      // `createdByAccountId` = người gọi: lịch sử bản update phải trả lời được "ai".
      expect(orderVersionRepo.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          orderId,
          versionNo: 1,
          createdByAccountId: ACTOR,
        },
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
          TOAN_QUYEN,
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
        TOAN_QUYEN,
      );

      const data = (
        lineRepo.create.mock.calls[0][0] as {
          data: { unitPrice: number; priceEditable: boolean };
        }
      ).data;
      expect(data.unitPrice).toBe(4_000_000);
      expect(data.priceEditable).toBe(true);
    });

    it('catalog priceEditable=true mà catalog LỠ có warrantyMonths ⇒ dòng ép warrantyMonths null (công lắp không bảo hành)', async () => {
      // Form Sản phẩm cho nhập warrantyMonths với MỌI product; nếu công lắp lỡ có 12 tháng,
      // dòng vẫn KHÔNG được mang bảo hành. Assert payload create ghi null, không phải 12.
      productRepo.findUnique.mockResolvedValue({
        ...PHI_LAP_DAT,
        warrantyMonths: 12,
      });

      await service.addLine(
        ACTOR,
        DON_BAOGIA.id,
        { productId: PHI_LAP_DAT.id, qty: 1, unitPrice: 4_000_000 },
        true,
        TOAN_QUYEN,
      );

      const data = (
        lineRepo.create.mock.calls[0][0] as {
          data: { warrantyMonths: number | null };
        }
      ).data;
      expect(data.warrantyMonths).toBeNull();
    });

    it('productId không tồn tại ⇒ 400 fieldErrors productId', async () => {
      productRepo.findUnique.mockResolvedValue(null);

      const err = await bat(
        service.addLine(
          ACTOR,
          DON_BAOGIA.id,
          { productId: 'prod-ma', qty: 1 },
          true,
          TOAN_QUYEN,
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
        TOAN_QUYEN,
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

      const view = await service.getScoped(
        ACTOR,
        TOAN_QUYEN,
        DON_BAOGIA.id,
        true,
      );

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
          TOAN_QUYEN,
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
          TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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

    it('warrantyMonths: 24 trên dòng catalog thường ⇒ data ghi 24', async () => {
      lineRepo.update.mockResolvedValue({
        ...DONG_CATALOG,
        warrantyMonths: 24,
      });

      await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        DONG_CATALOG.id,
        { warrantyMonths: 24 },
        true,
        TOAN_QUYEN,
      );

      const data = (
        lineRepo.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data;
      expect(data.warrantyMonths).toBe(24);
    });

    it('warrantyMonths: null (bỏ bảo hành) ⇒ null đi TỚI Prisma (giá trị nghiệp vụ, không phải undefined)', async () => {
      lineRepo.update.mockResolvedValue({
        ...DONG_CATALOG,
        warrantyMonths: null,
      });

      await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        DONG_CATALOG.id,
        { warrantyMonths: null },
        true,
        TOAN_QUYEN,
      );

      const data = (
        lineRepo.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data;
      // Phân biệt "gửi null" (có key, value null) vs "không gửi" (key vắng mặt).
      expect('warrantyMonths' in data).toBe(true);
      expect(data.warrantyMonths).toBeNull();
    });

    it('không gửi warrantyMonths ⇒ data KHÔNG chứa key (PATCH giữ nguyên)', async () => {
      lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, qty: 5 });

      await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        DONG_CATALOG.id,
        { qty: 5 },
        true,
        TOAN_QUYEN,
      );

      const data = (
        lineRepo.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data;
      expect('warrantyMonths' in data).toBe(false);
    });

    it('warrantyMonths gửi lên dòng CÔNG LẮP (catalog priceEditable=true) ⇒ BỎ QUA im lặng: data KHÔNG chứa key, KHÔNG 400', async () => {
      // Dòng công lắp: productId non-null + priceEditable=true → khoá bảo hành.
      const dongCongLap: OrderLineItem = {
        ...DONG_CATALOG,
        id: 'line-conglap',
        productId: PHI_LAP_DAT.id,
        priceEditable: true,
        warrantyMonths: null,
      };
      lineRepo.findUnique.mockResolvedValue(dongCongLap);
      lineRepo.update.mockResolvedValue(dongCongLap);

      await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        dongCongLap.id,
        { warrantyMonths: 12 },
        true,
        TOAN_QUYEN,
      );

      const data = (
        lineRepo.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data;
      // Bỏ qua im lặng — key vắng mặt, dòng giữ null; KHÔNG ném lỗi.
      expect('warrantyMonths' in data).toBe(false);
    });

    it('warrantyMonths: 18 trên DÒNG TỰ DO (productId null, priceEditable=true) ⇒ GHI được (khác công lắp)', async () => {
      // Bẫy priceEditable: dòng tự do cũng priceEditable=true nhưng productId null ⇒ ĐƯỢC
      // có bảo hành. Điều kiện khoá phải kèm `productId !== null`.
      const dongTuDo: OrderLineItem = {
        ...DONG_CATALOG,
        id: 'line-tudo',
        productId: null,
        priceEditable: true,
        warrantyMonths: null,
      };
      lineRepo.findUnique.mockResolvedValue(dongTuDo);
      lineRepo.update.mockResolvedValue({ ...dongTuDo, warrantyMonths: 18 });

      await service.updateLine(
        ACTOR,
        DON_BAOGIA.id,
        dongTuDo.id,
        { warrantyMonths: 18 },
        true,
        TOAN_QUYEN,
      );

      const data = (
        lineRepo.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data;
      expect(data.warrantyMonths).toBe(18);
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
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
      expect(lineRepo.update).not.toHaveBeenCalled();
    });

    it('xoá dòng: delete đúng where, publish OrderLineRemoved mang before', async () => {
      await service.removeLine(
        ACTOR,
        DON_BAOGIA.id,
        DONG_CATALOG.id,
        TOAN_QUYEN,
      );

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
            TOAN_QUYEN,
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
            TOAN_QUYEN,
          ),
      ],
      [
        'removeLine',
        () =>
          service.removeLine(ACTOR, DON_BAOGIA.id, DONG_CATALOG.id, TOAN_QUYEN),
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        service.update(
          ACTOR,
          'ord-x',
          { scopeThiCong: true },
          true,
          TOAN_QUYEN,
        ),
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
          TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
        TOAN_QUYEN,
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
    cancelReason: null,
    cancelledAt: null,
      });

      const view = await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { kWp: null, validityNote: null },
        true,
        TOAN_QUYEN,
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

      await service.update(
        ACTOR,
        DON_BAOGIA.id,
        { scopeThiCong: true },
        true,
        TOAN_QUYEN,
      );

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
        TOAN_QUYEN,
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
        service.update(
          ACTOR,
          DON_BAOGIA.id,
          { vatMode: 'khong_vat' },
          true,
          TOAN_QUYEN,
        ),
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
        discountAmount: 0,
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
        discountAmount: 0,
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
        discountAmount: 0,
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

      expect(result).toEqual({
        subtotal: 0,
        discountAmount: 0,
        vatAmount: 0,
        total: 0,
      });
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

    it('discountAmount trừ TRƯỚC VAT: vat trên vatBase với CON SỐ PHÂN BIỆT (720k chứ KHÔNG 800k) — mutant bỏ discount khỏi base lộ ngay', () => {
      const result = service.previewTotal(
        {
          lines: [{ unitPrice: 10_000_000, qty: 1 }],
          discountAmount: 1_000_000,
        },
        8,
      );

      // vatBase = 10tr − 1tr = 9tr; 8% của 9tr = 720_000 (mutant tính trên subtotal sẽ ra
      // 800_000); total = 9tr + 720k.
      expect(result).toEqual({
        subtotal: 10_000_000,
        discountAmount: 1_000_000,
        vatAmount: 720_000,
        total: 9_720_000,
      });
    });

    it('discountAmount 0 và VẮNG field cho CÙNG kết quả (hành vi cũ y hệt — regression 4.2/4.4)', () => {
      const soKhong = service.previewTotal(
        { lines: [{ unitPrice: 1_000_000, qty: 1 }], discountAmount: 0 },
        8,
      );
      const vangField = service.previewTotal(
        { lines: [{ unitPrice: 1_000_000, qty: 1 }] },
        8,
      );

      expect(soKhong).toEqual(vangField);
      expect(soKhong.vatAmount).toBe(80_000);
      expect(soKhong.total).toBe(1_080_000);
    });

    it('discountAmount > subtotal ⇒ 400 fieldErrors discountAmount', async () => {
      const err = await bat(
        Promise.resolve().then(() =>
          service.previewTotal(
            {
              lines: [{ unitPrice: 1_000_000, qty: 1 }],
              discountAmount: 1_000_001,
            },
            8,
          ),
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
    });

    it("vatMode 'khong_vat' + discount ⇒ total = subtotal − discount (afterDiscount cho màn duyệt)", () => {
      const result = service.previewTotal(
        {
          lines: [{ unitPrice: 10_000_000, qty: 1 }],
          vatMode: 'khong_vat',
          discountAmount: 2_000_000,
        },
        8,
      );

      expect(result).toEqual({
        subtotal: 10_000_000,
        discountAmount: 2_000_000,
        vatAmount: 0,
        total: 8_000_000,
      });
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
      const view = await service.confirm(
        ACTOR,
        DON_BAOGIA.id,
        8,
        true,
        TOAN_QUYEN,
      );

      // Cổng atomic: UPDATE có điều kiện status ngay trong WHERE — không phải update trần.
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'baogia' },
        data: { status: 'dachot' },
      });

      // Version hiệu lực: vatRate từ config (controller resolve), vatMode HIỆU LỰC — đơn
      // vatMode null (trước 4.4) đóng băng thành 'co_vat' TƯỜNG MINH, chotAt là thời điểm
      // chốt. Đường `baogia` KHÔNG mang chiết khấu — `discountAmount` phải là null TƯỜNG
      // MINH (regression 4.5 sau khi 4.7 mở đường chốt-từ-choduyet).
      expect(txVersionRepo.update).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        data: {
          vatRate: 8,
          vatMode: 'co_vat',
          chotAt: expect.any(Date),
          discountAmount: null,
        },
      });

      // 3 loại dòng — catalog thường: CẢ HAI cột = giá resolve SỐNG (2_600_000, không phải
      // cache 2_450_000); phí lắp: unitPrice ĐÃ SỬA ≠ catalog resolve; tự do: catalog null.
      // MỌI dòng (cả 3 loại, kể cả không bảo hành) đóng băng warrantyStartAt lúc chốt lần đầu.
      expect(txLineRepo.update).toHaveBeenCalledTimes(3);
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_600_000,
          catalogPriceSnapshot: 2_600_000,
          warrantyStartAt: expect.any(Date),
        },
      });
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_PHI_LAP.id },
        data: {
          unitPriceSnapshot: 4_000_000,
          catalogPriceSnapshot: 5_000_000,
          warrantyStartAt: expect.any(Date),
        },
      });
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_TU_DO.id },
        data: {
          unitPriceSnapshot: 350_000,
          catalogPriceSnapshot: null,
          warrantyStartAt: expect.any(Date),
        },
      });

      // AC#3 — MỘT timestamp cho MỘT sự kiện: warrantyStartAt của MỌI dòng phải là ĐÚNG
      // CÙNG instance Date đã ghi lên OrderVersion.chotAt, không phải `new Date()` thứ hai
      // (bài học review 4.8). So sánh identity bằng `.toBe`.
      const chotAtVersion = (
        txVersionRepo.update.mock.calls[0][0] as { data: { chotAt: Date } }
      ).data.chotAt;
      for (const call of txLineRepo.update.mock.calls) {
        const data = (call[0] as { data: { warrantyStartAt: Date } }).data;
        expect(data.warrantyStartAt).toBe(chotAtVersion);
      }

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

    it('re-chốt bản update: dòng ĐÃ có warrantyStartAt GIỮ NGUYÊN (không ghi lại), CHỈ dòng null nhận mốc mới', async () => {
      // Kịch bản 4.6: bản update có dòng cũ (mốc từ lần chốt trước) + dòng mới thêm (null).
      // Mutant "ghi đè warrantyStartAt mọi dòng" phải RED — dòng cũ payload KHÔNG chứa key.
      const NGAY_CU = new Date('2026-07-10T00:00:00Z');
      const DONG_DA_CO_MOC: OrderLineItem = {
        ...DONG_CATALOG,
        id: 'line-cu',
        warrantyStartAt: NGAY_CU,
      };
      const DONG_MOI_NULL: OrderLineItem = {
        ...DONG_CATALOG,
        id: 'line-moi',
        warrantyStartAt: null,
        displayOrder: 1,
      };
      lineRepo.findMany.mockResolvedValue([DONG_DA_CO_MOC, DONG_MOI_NULL]);
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 2_600_000 },
      ]);

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN);

      // Dòng CŨ: payload KHÔNG chứa warrantyStartAt — chỉ 2 cột giá.
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_DA_CO_MOC.id },
        data: {
          unitPriceSnapshot: 2_600_000,
          catalogPriceSnapshot: 2_600_000,
        },
      });
      // Dòng MỚI: nhận warrantyStartAt = chotAt của version.
      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_MOI_NULL.id },
        data: {
          unitPriceSnapshot: 2_600_000,
          catalogPriceSnapshot: 2_600_000,
          warrantyStartAt: expect.any(Date),
        },
      });
      // Chốt chặt: dòng cũ TUYỆT ĐỐI không mang key warrantyStartAt (mutant ghi đè lộ ở đây).
      const callCu = txLineRepo.update.mock.calls.find(
        (c) =>
          (c[0] as { where: { id: string } }).where.id === DONG_DA_CO_MOC.id,
      );
      const dataCu = (callCu?.[0] as { data: Record<string, unknown> }).data;
      expect('warrantyStartAt' in dataCu).toBe(false);
    });

    it("đơn vatMode 'khong_vat' ⇒ version snapshot giữ 'khong_vat' (giá trị hiệu lực, không ép co_vat)", async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        vatMode: 'khong_vat',
      });

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN);

      expect(txVersionRepo.update).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        data: {
          vatRate: 8,
          vatMode: 'khong_vat',
          chotAt: expect.any(Date),
          discountAmount: null,
        },
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

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN);

      // HAI event cho MỘT hành động, cả hai SAU commit: event nghiệp vụ + vết from→to.
      expect(thuTu).toEqual(['write', 'publish', 'publish']);
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const vet = eventBus.publish.mock.calls[1][0] as StatusChanged;
      expect(vet).toBeInstanceOf(StatusChanged);
      expect(vet.before.status).toBe('baogia');
      expect(vet.after.status).toBe('dachot');
      expect(vet.actorAccountId).toBe(ACTOR);
      const event = eventBus.publish.mock.calls[0][0] as OrderConfirmed;
      expect(event).toBeInstanceOf(OrderConfirmed);
      // MỘT timestamp cho MỘT sự kiện — hai event của cùng một lần chốt cùng `occurredAt`.
      expect(vet.occurredAt).toEqual(event.occurredAt);
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

      const view = await service.confirm(
        ACTOR,
        DON_BAOGIA.id,
        8,
        true,
        TOAN_QUYEN,
      );

      expect(view.status).toBe('dachot');
      expect(transaction).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(txVersionRepo.update).not.toHaveBeenCalled();
      expect(txLineRepo.update).not.toHaveBeenCalled();
      expect(stockVouchers.reserveForOrderInTx).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("race thua cổng atomic (count 0) → đọc lại thấy 'dachot' ⇒ idempotent: trả view, KHÔNG ghi tiếp, KHÔNG event", async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });
      // Lần 1 (pre-check): còn baogia; lần 2 (đọc lại sau khi thua): bên kia đã chốt.
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_BAOGIA)
        .mockResolvedValueOnce({ ...DON_BAOGIA, status: 'dachot' });

      const view = await service.confirm(
        ACTOR,
        DON_BAOGIA.id,
        8,
        true,
        TOAN_QUYEN,
      );

      expect(view.status).toBe('dachot');
      // Sentinel abort: các op SAU cổng không được chạy.
      expect(txVersionRepo.update).not.toHaveBeenCalled();
      expect(txLineRepo.update).not.toHaveBeenCalled();
      expect(stockVouchers.reserveForOrderInTx).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('race thua cổng → đọc lại thấy trạng thái LẠ (huy) ⇒ 409 CONFLICT', async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_BAOGIA)
        .mockResolvedValueOnce({ ...DON_BAOGIA, status: 'huy' });

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('trạng thái khác baogia/dachot (huy) ⇒ 409 CONFLICT, KHÔNG transaction', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'huy',
      });

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('đơn 0 dòng ⇒ 400 VALIDATION_ERROR (báo giá rỗng không có gì để đóng băng), KHÔNG transaction', async () => {
      lineRepo.findMany.mockResolvedValue([]);

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(transaction).not.toHaveBeenCalled();
      expect(stockVouchers.reserveForOrderInTx).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('reserves stock exactly once, inside the transaction, AFTER the line snapshots, from the lines read under the lock (free-text lines dropped)', async () => {
      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN);

      expect(stockVouchers.reserveForOrderInTx).toHaveBeenCalledTimes(1);
      expect(stockVouchers.reserveForOrderInTx).toHaveBeenCalledWith(txMock, {
        orderId: DON_BAOGIA.id,
        orderVersionId: VERSION_ID,
        orderLines: [
          { productId: DONG_CATALOG.productId, qty: DONG_CATALOG.qty },
          { productId: DONG_PHI_LAP.productId, qty: DONG_PHI_LAP.qty },
        ],
      });
      const reserveOrder =
        stockVouchers.reserveForOrderInTx.mock.invocationCallOrder[0];
      expect(txLineRepo.update).toHaveBeenCalledTimes(3);
      for (const order of txLineRepo.update.mock.invocationCallOrder) {
        expect(order).toBeLessThan(reserveOrder);
      }
      expect(reserveOrder).toBeLessThan(
        eventBus.publish.mock.invocationCallOrder[0],
      );
    });

    it('order reopened onto a newer version between the read and the lock ⇒ 409, no snapshot, no reservation, nothing published', async () => {
      // First read (outside the tx) sees the old version; the re-read under the lock sees the
      // order already confirmed + reopened onto a newer version, back in `baogia`.
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_BAOGIA)
        .mockResolvedValueOnce({
          ...DON_BAOGIA,
          currentVersionId: 'ver-newer',
        });

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.getStatus()).toBe(409);
      expect(txOrderRepo.updateMany).toHaveBeenCalledTimes(1);
      expect(txVersionRepo.update).not.toHaveBeenCalled();
      expect(txLineRepo.update).not.toHaveBeenCalled();
      expect(stockVouchers.reserveForOrderInTx).not.toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledTimes(0);
    });

    it('reservation failure rolls the confirm back: the error surfaces and nothing is published', async () => {
      const boom = new Error('reservation failed');
      stockVouchers.reserveForOrderInTx.mockRejectedValue(boom);

      await expect(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      ).rejects.toBe(boom);

      // The transaction body really ran up to the reservation (not a rejected-tx shortcut).
      expect(txOrderRepo.updateMany).toHaveBeenCalledTimes(1);
      expect(txLineRepo.update).toHaveBeenCalledTimes(3);
      expect(eventBus.publish).toHaveBeenCalledTimes(0);
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

      const view = await service.getScoped(
        ACTOR,
        TOAN_QUYEN,
        DON_BAOGIA.id,
        true,
      );

      expect(view.lineItems[0].unitPrice).toBe(2_400_000);
      expect(view.lineItems[0].amount).toBe(lineAmount(2_400_000, 8));
      // Dòng đóng băng KHÔNG vào liveIds — không còn dòng live nào ⇒ không tra product.
      expect(productRepo.findMany).not.toHaveBeenCalled();
    });

    it('chốt qty chạm bậc thang (cờ tier BẬT) ⇒ snapshot = giá TIER, không phải basePrice', async () => {
      // qty 10 ≥ minQty 10: giá hiệu lực khách đang thấy là tier 2_300_000 —
      // đóng băng phải đúng con số đó, không phải base sống 2_600_000.
      lineRepo.findMany.mockResolvedValue([{ ...DONG_CATALOG, qty: 10 }]);

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN);

      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_300_000,
          catalogPriceSnapshot: 2_300_000,
          warrantyStartAt: expect.any(Date),
        },
      });
    });

    it('chốt qty chạm bậc thang nhưng cờ tier TẮT ⇒ snapshot = basePrice (CÙNG cờ với đường live)', async () => {
      // Cùng dữ liệu với test trên, chỉ đảo cờ: nếu confirm() hardcode cờ thay vì
      // nhận từ controller thì test này RED — đóng băng phải đúng số màn đang hiển thị.
      lineRepo.findMany.mockResolvedValue([{ ...DONG_CATALOG, qty: 10 }]);

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, false, TOAN_QUYEN);

      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_600_000,
          catalogPriceSnapshot: 2_600_000,
          warrantyStartAt: expect.any(Date),
        },
      });
    });

    it('product biến mất khỏi danh mục (dữ liệu hỏng) ⇒ snapshot rơi về giá cache của dòng, tx vẫn hoàn tất', async () => {
      // FK restrict lẽ ra chặn xoá Product còn được tham chiếu — nhánh này chỉ là
      // phòng dữ liệu hỏng: rơi về cache `unitPrice` như đường đọc `toViews`.
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
      productRepo.findMany.mockResolvedValue([]);

      const view = await service.confirm(
        ACTOR,
        DON_BAOGIA.id,
        8,
        true,
        TOAN_QUYEN,
      );

      expect(txLineRepo.update).toHaveBeenCalledWith({
        where: { id: DONG_CATALOG.id },
        data: {
          unitPriceSnapshot: 2_450_000,
          catalogPriceSnapshot: 2_450_000,
          warrantyStartAt: expect.any(Date),
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

      const view = await service.getScoped(
        ACTOR,
        TOAN_QUYEN,
        DON_BAOGIA.id,
        true,
      );

      expect(view.lineItems[0].unitPrice).toBe(2_400_000);
      expect(view.lineItems[1].unitPrice).toBe(1_800_000);
      expect(view.lineItems[1].amount).toBe(lineAmount(1_800_000, 2));
      expect(productRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [TU_DIEN.id] } } }),
      );
    });
  });

  describe('revise — Mở lại Đơn đã chốt: version mới + lịch sử bất biến (Story 4.6, FR-6/AD-6)', () => {
    const DON_DACHOT: Order = { ...DON_BAOGIA, status: 'dachot' };
    /** Bản hiệu lực versionNo 3 — chứng minh versionNo mới = n + 1, KHÔNG hardcode 2. */
    const VERSION_HIEU_LUC = {
      id: VERSION_ID,
      orderId: DON_BAOGIA.id,
      versionNo: 3,
      vatRate: 8,
      vatMode: 'co_vat',
      chotAt: new Date('2026-07-16T10:00:00Z'),
      createdAt: new Date('2026-07-16T01:00:00Z'),
      updatedAt: new Date('2026-07-16T10:00:00Z'),
    };
    /**
     * 3 dòng ĐÃ ĐÓNG BĂNG với con số PHÂN BIỆT: snapshot 2_400_000 ≠ cache `unitPrice`
     * 2_450_000 ≠ giá danh mục sống 2_600_000 — mutant nào lẫn lộn nguồn giá cũng lộ.
     * `warrantyStartAt` non-null trên dòng catalog để chứng minh copy-as-is (AD-20).
     */
    const NGAY_BH = new Date('2026-07-10T00:00:00Z');
    const DONG_CATALOG_DA_CHOT: OrderLineItem = {
      ...DONG_CATALOG,
      unitPriceSnapshot: 2_400_000,
      catalogPriceSnapshot: 2_400_000,
      warrantyStartAt: NGAY_BH,
    };
    const DONG_PHI_LAP_DA_CHOT: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-phi-lap',
      productId: PHI_LAP_DAT.id,
      name: PHI_LAP_DAT.name,
      unit: PHI_LAP_DAT.unit,
      qty: 1,
      unitPrice: 4_000_000,
      priceEditable: true,
      warrantyMonths: null,
      unitPriceSnapshot: 4_000_000,
      catalogPriceSnapshot: 5_000_000,
      displayOrder: 1,
    };
    const DONG_TU_DO_DA_CHOT: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-tu-do',
      productId: null,
      name: 'Combo phụ kiện',
      unit: 'bộ',
      qty: 2,
      unitPrice: 350_000,
      priceEditable: true,
      isFlexible: true,
      note: 'kèm jack MC4',
      warrantyMonths: null,
      unitPriceSnapshot: 350_000,
      catalogPriceSnapshot: null,
      displayOrder: 2,
    };
    const CAC_DONG_DA_CHOT = [
      DONG_CATALOG_DA_CHOT,
      DONG_PHI_LAP_DA_CHOT,
      DONG_TU_DO_DA_CHOT,
    ];

    /** Version id MỚI mà revise() sinh — bắt từ payload create trong tx. */
    function versionIdMoi(): string {
      return (txVersionRepo.create.mock.calls[0][0] as { data: { id: string } })
        .data.id;
    }

    beforeEach(() => {
      orderRepo.findUnique.mockResolvedValue(DON_DACHOT);
      orderVersionRepo.findUnique.mockResolvedValue(VERSION_HIEU_LUC);
      // Đường đọc dòng theo con trỏ: version CŨ trả dòng đã đóng băng; version MỚI (bất kỳ
      // id nào khác) trả bản copy snapshot-null — mô phỏng trạng thái DB sau tx.
      lineRepo.findMany.mockImplementation(
        async (arg: { where: { orderVersionId: string } }) =>
          arg.where.orderVersionId === VERSION_ID
            ? CAC_DONG_DA_CHOT
            : (
                (txLineRepo.createMany.mock.calls[0]?.[0] as {
                  data: OrderLineItem[];
                }) ?? { data: [] }
              ).data,
      );
      // Giá danh mục pin ĐÃ ĐỔI sau khi chốt (2_450_000 cache → 2_600_000 sống): sau mở lại
      // dòng catalog phải live-resolve ra giá MỚI (nghịch đảo test FR-5 của 4.5).
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 2_600_000 },
        PHI_LAP_DAT,
      ]);
    });

    it('happy: payload từng op trong tx — cổng updateMany đúng where, version mới n+1, createMany copy đúng bảng, repoint con trỏ; KHÔNG op nào chạm row cũ', async () => {
      const view = await service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN);

      // Op 1 — cổng atomic: UPDATE điều kiện status NGAY trong WHERE (nghịch đảo cổng chốt).
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'dachot' },
        data: { status: 'baogia' },
      });

      // Op 2 — version MỚI: versionNo = 3 + 1 (đọc từ bản hiệu lực, không hardcode);
      // KHÔNG ghi vatRate/vatMode/chotAt — bản đang sửa chưa đóng băng thuế.
      // `createdByAccountId` phải có Ở CẢ ĐÂY: ghi actor chỉ ở `create()` làm lịch sử thủng
      // đúng nửa — mọi bản sinh từ mở-lại sẽ vô danh mà không ai báo lỗi.
      expect(txVersionRepo.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          orderId: DON_BAOGIA.id,
          versionNo: 4,
          createdByAccountId: ACTOR,
        },
      });
      const verMoi = versionIdMoi();
      expect(verMoi).not.toBe(VERSION_ID);

      // Op 3 — copy TOÀN BỘ dòng theo bảng: field nghiệp vụ nguyên (unitPrice = CACHE
      // 2_450_000, không phải snapshot 2_400_000), snapshot cả 3 cột null, warrantyStartAt
      // copy nguyên, id MỚI + orderVersionId = version mới, displayOrder giữ nguyên.
      expect(txLineRepo.createMany).toHaveBeenCalledTimes(1);
      const copies = (
        txLineRepo.createMany.mock.calls[0][0] as {
          data: Array<Record<string, unknown>>;
        }
      ).data;
      expect(copies).toHaveLength(3);
      expect(copies[0]).toEqual({
        id: expect.any(String),
        orderVersionId: verMoi,
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
        warrantyStartAt: NGAY_BH,
        displayOrder: 0,
      });
      expect(copies[0].id).not.toBe(DONG_CATALOG_DA_CHOT.id);
      expect(copies[1]).toEqual({
        id: expect.any(String),
        orderVersionId: verMoi,
        productId: PHI_LAP_DAT.id,
        name: PHI_LAP_DAT.name,
        unit: PHI_LAP_DAT.unit,
        qty: 1,
        unitPrice: 4_000_000,
        priceEditable: true,
        isFlexible: false,
        note: null,
        warrantyMonths: null,
        unitPriceSnapshot: null,
        catalogPriceSnapshot: null,
        costPriceSnapshot: null,
        warrantyStartAt: null,
        displayOrder: 1,
      });
      expect(copies[2]).toEqual({
        id: expect.any(String),
        orderVersionId: verMoi,
        productId: null,
        name: 'Combo phụ kiện',
        unit: 'bộ',
        qty: 2,
        unitPrice: 350_000,
        priceEditable: true,
        isFlexible: true,
        note: 'kèm jack MC4',
        warrantyMonths: null,
        unitPriceSnapshot: null,
        catalogPriceSnapshot: null,
        costPriceSnapshot: null,
        warrantyStartAt: null,
        displayOrder: 2,
      });

      // Op 4 — repoint con trỏ bản hiệu lực sang version mới.
      expect(txOrderRepo.update).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id },
        data: { currentVersionId: verMoi },
      });

      // Lịch sử BẤT BIẾN: KHÔNG op update/delete nào nhắm version/dòng CŨ.
      expect(txVersionRepo.update).not.toHaveBeenCalled();
      expect(txLineRepo.update).not.toHaveBeenCalled();
      expect(lineRepo.update).not.toHaveBeenCalled();
      expect(lineRepo.delete).not.toHaveBeenCalled();

      // Response: status baogia + con trỏ mới (compose trong bộ nhớ).
      expect(view.status).toBe('baogia');
      expect(view.currentVersionId).toBe(verMoi);
    });

    it("thứ tự ['write','publish'] — OrderRevised publish SAU commit, before dachot/con trỏ cũ → after baogia/con trỏ mới", async () => {
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

      await service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN);

      expect(thuTu).toEqual(['write', 'publish', 'publish']);
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const vet = eventBus.publish.mock.calls[1][0] as StatusChanged;
      expect(vet).toBeInstanceOf(StatusChanged);
      expect(vet.before.status).toBe('dachot');
      expect(vet.after.status).toBe('baogia');
      const event = eventBus.publish.mock.calls[0][0] as OrderRevised;
      expect(event).toBeInstanceOf(OrderRevised);
      expect(vet.occurredAt).toEqual(event.occurredAt);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.before.status).toBe('dachot');
      expect(event.before.currentVersionId).toBe(VERSION_ID);
      expect(event.after.status).toBe('baogia');
      expect(event.after.currentVersionId).toBe(versionIdMoi());
      expect(event.target).toEqual({ type: 'Order', id: DON_BAOGIA.id });
    });

    it("retry trên đơn ĐANG 'baogia' ⇒ trả view hiện tại, KHÔNG transaction, KHÔNG version mới, KHÔNG event", async () => {
      orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);

      const view = await service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN);

      expect(view.status).toBe('baogia');
      expect(view.currentVersionId).toBe(VERSION_ID);
      expect(transaction).not.toHaveBeenCalled();
      expect(txVersionRepo.create).not.toHaveBeenCalled();
      expect(txLineRepo.createMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("race thua cổng atomic (count 0) → đọc lại thấy 'baogia' ⇒ idempotent: trả view, KHÔNG create gì, KHÔNG event", async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });
      // Lần 1 (pre-check): còn dachot; lần 2 (đọc lại sau khi thua): bên kia đã mở.
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_DACHOT)
        .mockResolvedValueOnce(DON_BAOGIA);

      const view = await service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN);

      expect(view.status).toBe('baogia');
      // Cổng đặt ĐẦU tx: bên thua abort TRƯỚC khi create version/dòng.
      expect(txVersionRepo.create).not.toHaveBeenCalled();
      expect(txLineRepo.createMany).not.toHaveBeenCalled();
      expect(txOrderRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('race thua cổng → đọc lại thấy trạng thái LẠ (huy) ⇒ 409 CONFLICT', async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_DACHOT)
        .mockResolvedValueOnce({ ...DON_BAOGIA, status: 'huy' });

      const err = await bat(
        service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it.each([['huy'], ['choduyet']])(
      "trạng thái '%s' ⇒ 409 CONFLICT, KHÔNG transaction",
      async (status) => {
        orderRepo.findUnique.mockResolvedValue({ ...DON_BAOGIA, status });

        const err = await bat(
          service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN),
        );

        expect(err.errorCode).toBe(ErrorCode.CONFLICT);
        expect(err.getStatus()).toBe(409);
        expect(transaction).not.toHaveBeenCalled();
        expect(eventBus.publish).not.toHaveBeenCalled();
      },
    );

    it('view trả về đọc dòng bản MỚI + live-resolve giá danh mục HIỆN TẠI (snapshot null — nghịch đảo FR-5 của 4.5)', async () => {
      const view = await service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN);

      // Đường đọc sau tx đi qua con trỏ MỚI, không phải version cũ.
      const lanDocCuoi = lineRepo.findMany.mock.calls.at(-1)?.[0] as {
        where: { orderVersionId: string };
      };
      expect(lanDocCuoi.where.orderVersionId).toBe(versionIdMoi());

      // Dòng catalog sống lại: giá = danh mục HIỆN TẠI 2_600_000 — KHÔNG phải snapshot cũ
      // 2_400_000, KHÔNG phải cache 2_450_000. Phí lắp/tự do giữ giá đã lưu.
      expect(view.lineItems[0].unitPrice).toBe(2_600_000);
      expect(view.lineItems[0].amount).toBe(lineAmount(2_600_000, 8));
      expect(view.lineItems[1].unitPrice).toBe(4_000_000);
      expect(view.lineItems[2].unitPrice).toBe(350_000);
    });

    it('con trỏ bản hiệu lực trỏ version KHÔNG tồn tại ⇒ 409 CONFLICT, KHÔNG transaction, KHÔNG event', async () => {
      orderVersionRepo.findUnique.mockResolvedValue(null);

      const err = await bat(
        service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('bản hiệu lực 0 dòng ⇒ tx vẫn trọn vẹn (version mới + repoint) nhưng KHÔNG gọi createMany rỗng (gotcha Prisma 7)', async () => {
      lineRepo.findMany.mockResolvedValue([]);

      const view = await service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN);

      expect(txVersionRepo.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          orderId: DON_BAOGIA.id,
          versionNo: 4,
          createdByAccountId: ACTOR,
        },
      });
      expect(txLineRepo.createMany).not.toHaveBeenCalled();
      expect(txOrderRepo.update).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id },
        data: { currentVersionId: versionIdMoi() },
      });
      expect(view.status).toBe('baogia');
      expect(view.lineItems).toEqual([]);
    });
  });

  describe('applyDiscount — Áp chiết khấu + gửi duyệt (Story 4.7, FR-18/AD-18)', () => {
    const APPROVAL_ROW = {
      id: 'apr-1',
      orderId: DON_BAOGIA.id,
      orderVersionId: VERSION_ID,
      amount: 1_000_000,
      status: 'cho_duyet',
      requestNote: 'Khách quen',
      resolveNote: null,
      requestedByAccountId: ACTOR,
      resolvedByAccountId: null,
      resolvedAt: null,
      createdAt: new Date('2026-07-17T03:00:00Z'),
      updatedAt: new Date('2026-07-17T03:00:00Z'),
    };

    beforeEach(() => {
      // Giỏ 1 dòng catalog: qty 8 × 2_450_000 = subtotal 19_600_000 (cờ tier BẬT nhưng
      // qty < ngưỡng 10 ⇒ base price).
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
    });

    it("happy: payload từng op — cổng baogia→choduyet, create đúng row approval; thứ tự ['write','publish']; event mang amount/note; view compose discount", async () => {
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
      discountApprovalRepo.findFirst.mockResolvedValue(APPROVAL_ROW);

      const view = await service.applyDiscount(
        ACTOR,
        DON_BAOGIA.id,
        1_000_000,
        'Khách quen',
        true,
        TOAN_QUYEN,
      );

      // Cổng atomic: UPDATE điều kiện status trong WHERE — bất biến "một pending mỗi đơn".
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'baogia' },
        data: { status: 'choduyet' },
      });
      // Row approval: uuid tiền-sinh, gắn bản hiệu lực, trạng thái pending, actor đề xuất.
      expect(txDiscountRepo.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          orderId: DON_BAOGIA.id,
          orderVersionId: VERSION_ID,
          amount: 1_000_000,
          status: 'cho_duyet',
          requestNote: 'Khách quen',
          requestedByAccountId: ACTOR,
        },
      });

      expect(thuTu).toEqual(['write', 'publish', 'publish']);
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const vet = eventBus.publish.mock.calls[1][0] as StatusChanged;
      expect(vet).toBeInstanceOf(StatusChanged);
      expect(vet.before.status).toBe('baogia');
      expect(vet.after.status).toBe('choduyet');
      const event = eventBus.publish.mock.calls[0][0] as DiscountRequested;
      expect(event).toBeInstanceOf(DiscountRequested);
      expect(vet.occurredAt).toEqual(event.occurredAt);
      expect(event.actorAccountId).toBe(ACTOR);
      expect(event.amount).toBe(1_000_000);
      expect(event.note).toBe('Khách quen');
      expect(event.before.status).toBe('baogia');
      expect(event.after.status).toBe('choduyet');
      expect(event.target).toEqual({ type: 'Order', id: DON_BAOGIA.id });

      expect(view.status).toBe('choduyet');
      expect(view.discount).toEqual({
        amount: 1_000_000,
        status: 'cho_duyet',
        requestNote: 'Khách quen',
        resolveNote: null,
        requestedAt: APPROVAL_ROW.createdAt,
        resolvedAt: null,
      });
    });

    it('amount vượt subtotal hiện hành ⇒ 400 fieldErrors amount, KHÔNG transaction, KHÔNG event', async () => {
      const err = await bat(
        service.applyDiscount(
          ACTOR,
          DON_BAOGIA.id,
          19_600_001,
          null,
          true,
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('amount ĐÚNG BẰNG subtotal (biên trên) hợp lệ — tx chạy, row mang đúng amount', async () => {
      await service.applyDiscount(
        ACTOR,
        DON_BAOGIA.id,
        19_600_000,
        null,
        true,
        TOAN_QUYEN,
      );

      expect(txDiscountRepo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 19_600_000,
          requestNote: null,
        }) as unknown,
      });
    });

    it('đơn 0 dòng ⇒ 400 VALIDATION_ERROR, KHÔNG transaction', async () => {
      lineRepo.findMany.mockResolvedValue([]);

      const err = await bat(
        service.applyDiscount(ACTOR, DON_BAOGIA.id, 1, null, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("status khác baogia ('choduyet' — double-tap) ⇒ 409, KHÔNG transaction, KHÔNG event", async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'choduyet',
      });

      const err = await bat(
        service.applyDiscount(
          ACTOR,
          DON_BAOGIA.id,
          1_000_000,
          null,
          true,
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('race thua cổng atomic (count 0) → đọc lại → 409 (áp KHÔNG idempotent-return), KHÔNG event', async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });

      const err = await bat(
        service.applyDiscount(
          ACTOR,
          DON_BAOGIA.id,
          1_000_000,
          null,
          true,
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('áp LẠI sau từ chối: approval tu_choi cũ KHÔNG chặn — tạo approval MỚI pending, view compose bản mới nhất', async () => {
      // Đơn đã quay về baogia sau từ chối; approval tu_choi nằm lại làm hồ sơ. Áp lại
      // phải đi qua (cổng chỉ nhìn Order.status) và bản MỚI đè vai trò "mới nhất".
      const TU_CHOI_CU = {
        ...APPROVAL_ROW,
        status: 'tu_choi',
        resolveNote: 'Biên quá mỏng',
        resolvedByAccountId: 'acc-quanly-1',
        resolvedAt: new Date('2026-07-17T04:00:00Z'),
      };
      const PENDING_MOI = {
        ...APPROVAL_ROW,
        id: 'apr-2',
        amount: 500_000,
        requestNote: 'Giảm ít hơn',
        createdAt: new Date('2026-07-17T05:00:00Z'),
        updatedAt: new Date('2026-07-17T05:00:00Z'),
      };
      discountApprovalRepo.findFirst
        .mockResolvedValueOnce(TU_CHOI_CU) // viewOf(before) — tính subtotal
        .mockResolvedValue(PENDING_MOI); // viewOf(after) — sau tx

      const view = await service.applyDiscount(
        ACTOR,
        DON_BAOGIA.id,
        500_000,
        'Giảm ít hơn',
        true,
        TOAN_QUYEN,
      );

      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'baogia' },
        data: { status: 'choduyet' },
      });
      expect(txDiscountRepo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 500_000,
          status: 'cho_duyet',
          requestNote: 'Giảm ít hơn',
        }) as unknown,
      });
      // `DiscountRequested` + `StatusChanged` — áp lại sau từ chối vẫn là một transition thật.
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      expect(view.status).toBe('choduyet');
      expect(view.discount).toMatchObject({
        amount: 500_000,
        status: 'cho_duyet',
      });
    });
  });

  describe('resolveDiscount — Duyệt/Từ chối chiết khấu (Story 4.7, FR-18/AD-18)', () => {
    const NGUOI_DUYET = 'acc-quanly-1';
    const DON_CHODUYET: Order = { ...DON_BAOGIA, status: 'choduyet' };
    const APPROVAL_PENDING = {
      id: 'apr-1',
      orderId: DON_BAOGIA.id,
      orderVersionId: VERSION_ID,
      amount: 1_000_000,
      status: 'cho_duyet',
      requestNote: 'Khách quen',
      resolveNote: null,
      requestedByAccountId: ACTOR,
      resolvedByAccountId: null,
      resolvedAt: null,
      createdAt: new Date('2026-07-17T03:00:00Z'),
      updatedAt: new Date('2026-07-17T03:00:00Z'),
    };

    beforeEach(() => {
      orderRepo.findUnique.mockResolvedValue(DON_CHODUYET);
      discountApprovalRepo.findFirst.mockResolvedValue(APPROVAL_PENDING);
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
    });

    it("đồng ý: cổng trên CHÍNH row approval đúng where/data; KHÔNG op order nào (đơn Ở NGUYÊN choduyet); thứ tự ['write','publish']; event approved=true", async () => {
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

      const view = await service.resolveDiscount(
        'acc-quanly-1',
        DON_BAOGIA.id,
        true,
        null,
        true,
        TOAN_QUYEN,
      );

      expect(txDiscountRepo.updateMany).toHaveBeenCalledWith({
        where: { id: APPROVAL_PENDING.id, status: 'cho_duyet' },
        data: {
          status: 'dong_y',
          resolvedByAccountId: NGUOI_DUYET,
          resolveNote: null,
          resolvedAt: expect.any(Date),
        },
      });
      // Đồng ý KHÔNG đổi status đơn — Chốt là hành động RIÊNG qua confirm().
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();

      expect(thuTu).toEqual(['write', 'publish']);
      const event = eventBus.publish.mock.calls[0][0] as DiscountResolved;
      expect(event).toBeInstanceOf(DiscountResolved);
      expect(event.actorAccountId).toBe(NGUOI_DUYET);
      expect(event.approved).toBe(true);
      expect(event.reason).toBeNull();
      expect(event.before.status).toBe('choduyet');
      expect(event.after.status).toBe('choduyet');

      expect(view.status).toBe('choduyet');
    });

    it('từ chối: CÓ op order choduyet→baogia đúng where/data; approval ghi resolveNote; event approved=false mang reason', async () => {
      const view = await service.resolveDiscount(
        'acc-quanly-1',
        DON_BAOGIA.id,
        false,
        'Biên quá mỏng',
        true,
        TOAN_QUYEN,
      );

      expect(txDiscountRepo.updateMany).toHaveBeenCalledWith({
        where: { id: APPROVAL_PENDING.id, status: 'cho_duyet' },
        data: {
          status: 'tu_choi',
          resolvedByAccountId: NGUOI_DUYET,
          resolveNote: 'Biên quá mỏng',
          resolvedAt: expect.any(Date),
        },
      });
      // Đơn quay về Báo giá — sửa lại được; approval tu_choi nằm lại làm hồ sơ.
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'choduyet' },
        data: { status: 'baogia' },
      });

      const event = eventBus.publish.mock.calls[0][0] as DiscountResolved;
      expect(event.approved).toBe(false);
      expect(event.reason).toBe('Biên quá mỏng');
      expect(event.before.status).toBe('choduyet');
      expect(event.after.status).toBe('baogia');

      expect(view.status).toBe('baogia');
    });

    it('từ chối THIẾU reason (null / toàn whitespace) ⇒ 400 fieldErrors reason, KHÔNG transaction, KHÔNG event', async () => {
      const errNull = await bat(
        service.resolveDiscount(
          NGUOI_DUYET,
          DON_BAOGIA.id,
          false,
          null,
          true,
          TOAN_QUYEN,
        ),
      );
      const errTrang = await bat(
        service.resolveDiscount(
          NGUOI_DUYET,
          DON_BAOGIA.id,
          false,
          '   ',
          true,
          TOAN_QUYEN,
        ),
      );

      expect(errNull.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(errNull.getStatus()).toBe(400);
      expect(errTrang.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('retry CÙNG decision trên approval đã dong_y ⇒ 200 view hiện tại, KHÔNG transaction, KHÔNG event', async () => {
      discountApprovalRepo.findFirst.mockResolvedValue({
        ...APPROVAL_PENDING,
        status: 'dong_y',
        resolvedByAccountId: NGUOI_DUYET,
        resolvedAt: new Date('2026-07-17T04:00:00Z'),
      });

      const view = await service.resolveDiscount(
        'acc-quanly-1',
        DON_BAOGIA.id,
        true,
        null,
        true,
        TOAN_QUYEN,
      );

      expect(view.status).toBe('choduyet');
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('decision NGƯỢC trên approval đã dong_y ⇒ 409 CONFLICT, KHÔNG transaction', async () => {
      discountApprovalRepo.findFirst.mockResolvedValue({
        ...APPROVAL_PENDING,
        status: 'dong_y',
      });

      const err = await bat(
        service.resolveDiscount(
          NGUOI_DUYET,
          DON_BAOGIA.id,
          false,
          'Đổi ý',
          true,
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('KHÔNG có approval nào ⇒ 409 CONFLICT, KHÔNG transaction', async () => {
      discountApprovalRepo.findFirst.mockResolvedValue(null);

      const err = await bat(
        service.resolveDiscount(
          NGUOI_DUYET,
          DON_BAOGIA.id,
          true,
          null,
          true,
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('race thua cổng (count 0) → đọc lại thấy CÙNG decision ⇒ idempotent view, KHÔNG event', async () => {
      txDiscountRepo.updateMany.mockResolvedValue({ count: 0 });
      discountApprovalRepo.findFirst
        .mockResolvedValueOnce(APPROVAL_PENDING) // pre-check: còn pending
        .mockResolvedValueOnce({ ...APPROVAL_PENDING, status: 'dong_y' }); // bên kia đã duyệt

      const view = await service.resolveDiscount(
        'acc-quanly-1',
        DON_BAOGIA.id,
        true,
        null,
        true,
        TOAN_QUYEN,
      );

      expect(view.status).toBe('choduyet');
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('race thua cổng → đọc lại thấy decision NGƯỢC ⇒ 409, KHÔNG event', async () => {
      txDiscountRepo.updateMany.mockResolvedValue({ count: 0 });
      discountApprovalRepo.findFirst
        .mockResolvedValueOnce(APPROVAL_PENDING)
        .mockResolvedValueOnce({ ...APPROVAL_PENDING, status: 'tu_choi' });

      const err = await bat(
        service.resolveDiscount(
          NGUOI_DUYET,
          DON_BAOGIA.id,
          true,
          null,
          true,
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('retry TỪ CHỐI trên approval đã tu_choi KHÔNG kèm reason ⇒ idempotent view (check idempotency TRƯỚC validate reason), đọc approval MỚI NHẤT, KHÔNG tx/event', async () => {
      // Retry sau khi từ chối thành công: client có thể gửi lại body không reason —
      // đảo thứ tự idempotency/validate-reason sẽ 400 sai và phá NFR SM-1.
      orderRepo.findUnique.mockResolvedValue(DON_BAOGIA); // đơn đã quay về baogia
      discountApprovalRepo.findFirst.mockResolvedValue({
        ...APPROVAL_PENDING,
        status: 'tu_choi',
        resolveNote: 'Biên quá mỏng',
        resolvedByAccountId: NGUOI_DUYET,
        resolvedAt: new Date('2026-07-17T04:00:00Z'),
      });

      const view = await service.resolveDiscount(
        'acc-quanly-1',
        DON_BAOGIA.id,
        false,
        null,
        true,
        TOAN_QUYEN,
      );

      // "Mới nhất" là hợp đồng thật: sau áp-lại có NHIỀU approval — bỏ orderBy là
      // resolve nhầm bản cũ nhất. Pin CALL ĐẦU (điểm đọc quyết định của resolveDiscount)
      // vì viewOf cũng findFirst với orderBy khớp — assert any-call sẽ false-green.
      expect(discountApprovalRepo.findFirst).toHaveBeenNthCalledWith(1, {
        where: { orderId: DON_BAOGIA.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(view.status).toBe('baogia');
      expect(view.discount).toMatchObject({
        status: 'tu_choi',
        resolveNote: 'Biên quá mỏng',
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('từ chối thắng cổng approval nhưng đơn KHÔNG ở choduyet (bất biến gãy) ⇒ lỗi nổi lên, rollback TOÀN tx, KHÔNG event', async () => {
      // Approval cho_duyet ⇒ đơn PHẢI choduyet (cổng áp bảo đảm). Cổng order count 0
      // trong nhánh từ chối là dữ liệu gãy — PHẢI throw để Prisma rollback cả op approval,
      // KHÔNG được nuốt im lặng (approval resolved trong khi đơn kẹt choduyet).
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resolveDiscount(
          NGUOI_DUYET,
          DON_BAOGIA.id,
          false,
          'Biên quá mỏng',
          true,
          TOAN_QUYEN,
        ),
      ).rejects.toThrow(/[Bb]ất biến/);

      // Cổng approval ĐÃ chạy trước khi phát hiện gãy — rollback là việc của tx.
      expect(txDiscountRepo.updateMany).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe("confirm — Chốt từ choduyet sau duyệt (Story 4.7, spine 'duyệt then Chốt')", () => {
    const DON_CHODUYET: Order = { ...DON_BAOGIA, status: 'choduyet' };
    const APPROVAL_DONG_Y = {
      id: 'apr-1',
      orderId: DON_BAOGIA.id,
      orderVersionId: VERSION_ID,
      amount: 1_500_000,
      status: 'dong_y',
      requestNote: null,
      resolveNote: 'OK',
      requestedByAccountId: ACTOR,
      resolvedByAccountId: 'acc-quanly-1',
      resolvedAt: new Date('2026-07-17T04:00:00Z'),
      createdAt: new Date('2026-07-17T03:00:00Z'),
      updatedAt: new Date('2026-07-17T04:00:00Z'),
    };

    beforeEach(() => {
      orderRepo.findUnique.mockResolvedValue(DON_CHODUYET);
      discountApprovalRepo.findFirst.mockResolvedValue(APPROVAL_DONG_Y);
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
    });

    it('approval dong_y ⇒ cổng where dùng status QUAN SÁT (choduyet), version snapshot mang discountAmount = amount đã duyệt', async () => {
      const view = await service.confirm(
        ACTOR,
        DON_BAOGIA.id,
        8,
        true,
        TOAN_QUYEN,
      );

      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'choduyet' },
        data: { status: 'dachot' },
      });
      expect(txVersionRepo.update).toHaveBeenCalledWith({
        where: { id: VERSION_ID },
        data: {
          vatRate: 8,
          vatMode: 'co_vat',
          chotAt: expect.any(Date),
          discountAmount: 1_500_000,
        },
      });
      expect(view.status).toBe('dachot');
      expect(eventBus.publish.mock.calls[0][0]).toBeInstanceOf(OrderConfirmed);
      expect(stockVouchers.reserveForOrderInTx).toHaveBeenCalledTimes(1);
      expect(stockVouchers.reserveForOrderInTx).toHaveBeenCalledWith(txMock, {
        orderId: DON_BAOGIA.id,
        orderVersionId: VERSION_ID,
        orderLines: [
          { productId: DONG_CATALOG.productId, qty: DONG_CATALOG.qty },
        ],
      });
    });

    it("approval còn cho_duyet ⇒ 409 'Chiết khấu chưa được duyệt', KHÔNG transaction", async () => {
      discountApprovalRepo.findFirst.mockResolvedValue({
        ...APPROVAL_DONG_Y,
        status: 'cho_duyet',
        resolvedAt: null,
      });

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('approval tu_choi (dữ liệu kẹt bất thường) ⇒ 409, KHÔNG transaction', async () => {
      discountApprovalRepo.findFirst.mockResolvedValue({
        ...APPROVAL_DONG_Y,
        status: 'tu_choi',
      });

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('đơn choduyet KHÔNG có approval nào ⇒ 409, KHÔNG transaction', async () => {
      discountApprovalRepo.findFirst.mockResolvedValue(null);

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('race reject-giữa-chừng: thua cổng choduyet (count 0) → đọc lại thấy baogia ⇒ 409, KHÔNG event', async () => {
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_CHODUYET) // pre-check
        .mockResolvedValueOnce({ ...DON_BAOGIA, status: 'baogia' }); // reject thắng trước

      const err = await bat(
        service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('listPendingDiscounts — danh sách chờ duyệt + biên ước tính (Story 4.7, FR-18/FR-37)', () => {
    const DON_CHODUYET: Order = { ...DON_BAOGIA, status: 'choduyet' };
    /** Biên 33.4% (1000−666=334) — half-up XUỐNG 33. */
    const SP_A = {
      id: 'prod-a',
      name: 'SP A',
      unit: 'cái',
      price: 1_000,
      priceEditable: false,
      warrantyMonths: null,
      prices: [],
    };
    /** Biên 33.5% (200−133=67) — half-up LÊN 34. */
    const SP_B = {
      id: 'prod-b',
      name: 'SP B',
      unit: 'cái',
      price: 200,
      priceEditable: false,
      warrantyMonths: null,
      prices: [],
    };
    const DONG_A: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-a',
      productId: 'prod-a',
      name: 'SP A',
      qty: 2,
      unitPrice: 1_000,
      displayOrder: 0,
    };
    const DONG_B: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-b',
      productId: 'prod-b',
      name: 'SP B',
      qty: 1,
      unitPrice: 200,
      displayOrder: 1,
    };
    /** Dòng tự do — không productId ⇒ margin null. */
    const DONG_TU_DO: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-c',
      productId: null,
      name: 'Tự do',
      unit: 'bộ',
      qty: 1,
      unitPrice: 500,
      priceEditable: true,
      displayOrder: 2,
    };
    /** Dòng giá 0 (tặng kèm) — chia 0 ⇒ margin null dù có costPrice. */
    const DONG_GIA_0: OrderLineItem = {
      ...DONG_CATALOG,
      id: 'line-d',
      productId: 'prod-a',
      name: 'SP A tặng kèm',
      qty: 1,
      unitPrice: 0,
      priceEditable: true,
      displayOrder: 3,
    };
    const APPROVAL_KEM_ORDER = {
      id: 'apr-1',
      orderId: DON_BAOGIA.id,
      orderVersionId: VERSION_ID,
      amount: 700,
      status: 'cho_duyet',
      requestNote: 'Khách quen',
      resolveNote: null,
      requestedByAccountId: ACTOR,
      resolvedByAccountId: null,
      resolvedAt: null,
      createdAt: new Date('2026-07-17T03:00:00Z'),
      updatedAt: new Date('2026-07-17T03:00:00Z'),
      order: DON_CHODUYET,
      requestedBy: { displayName: 'Thợ Kỹ Sư A' },
    };

    beforeEach(() => {
      discountApprovalRepo.findMany.mockResolvedValue([APPROVAL_KEM_ORDER]);
      lineRepo.findMany.mockResolvedValue([
        DONG_A,
        DONG_B,
        DONG_TU_DO,
        DONG_GIA_0,
      ]);
      // HAI đường tra product: toViews (quote select — KHÔNG costPrice) và margin
      // (select riêng {id, costPrice}) — phân biệt theo select của call.
      productRepo.findMany.mockImplementation(
        async (args: { select: Record<string, unknown> }) =>
          args.select.costPrice === true
            ? [
                { id: 'prod-a', costPrice: 666 },
                { id: 'prod-b', costPrice: 133 },
              ]
            : [SP_A, SP_B],
      );
    });

    it('CÓ costs.view: item đúng shape, subtotal/afterDiscount backend tính, margin half-up biên (33.4→33, 33.5→34), null cho tự do/giá 0', async () => {
      const items = await service.listPendingDiscounts(
        true,
        true,
        ACTOR,
        TOAN_QUYEN,
      );

      expect(discountApprovalRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // TOAN_QUYEN có view_all ⇒ mệnh đề phạm vi rỗng.
          where: { status: 'cho_duyet', order: { AND: [] } },
        }),
      );
      expect(items).toHaveLength(1);
      const item = items[0];
      expect(item.orderId).toBe(DON_BAOGIA.id);
      expect(item.customerSdt).toBe(SDT_E164);
      expect(item.amount).toBe(700);
      expect(item.requestNote).toBe('Khách quen');
      expect(item.requestedByAccountId).toBe(ACTOR);
      expect(item.requestedByDisplayName).toBe('Thợ Kỹ Sư A');
      // subtotal = 2×1000 + 1×200 + 500 + 0 = 2_700; afterDiscount = 2_700 − 700 = 2_000.
      expect(item.subtotal).toBe(2_700);
      expect(item.afterDiscount).toBe(2_000);
      expect(item.lines.map((line) => line.estimatedMarginPct)).toEqual([
        33,
        34,
        null,
        null,
      ]);
      // Margin là số ĐÃ LÀM TRÒN — response không chứa costPrice dưới bất kỳ dạng nào.
      expect(JSON.stringify(items)).not.toContain('costPrice');
    });

    it('KHÔNG costs.view: mọi margin null VÀ KHÔNG query costPrice (fence FR-37 hai chiều)', async () => {
      const items = await service.listPendingDiscounts(
        false,
        true,
        ACTOR,
        TOAN_QUYEN,
      );

      expect(
        items[0].lines.every((line) => line.estimatedMarginPct === null),
      ).toBe(true);
      for (const call of productRepo.findMany.mock.calls) {
        expect(
          (call[0] as { select: Record<string, unknown> }).select,
        ).not.toHaveProperty('costPrice');
      }
      expect(JSON.stringify(items)).not.toContain('costPrice');
    });

    it('không approval pending nào ⇒ mảng rỗng, KHÔNG tra dòng/product', async () => {
      discountApprovalRepo.findMany.mockResolvedValue([]);

      const items = await service.listPendingDiscounts(
        true,
        true,
        ACTOR,
        TOAN_QUYEN,
      );

      expect(items).toEqual([]);
      expect(lineRepo.findMany).not.toHaveBeenCalled();
      expect(productRepo.findMany).not.toHaveBeenCalled();
    });
  });

  describe('FR-5 — giá trước chốt: GET trả giá SỐNG cho dòng catalog không sửa giá', () => {
    it('giá danh mục đổi sau khi thêm dòng ⇒ unitPrice/amount trong response theo giá MỚI, DB không bị ghi đè', async () => {
      // Dòng lưu cache 2_450_000; danh mục đã đổi basePrice thành 2_600_000.
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);
      productRepo.findMany.mockResolvedValue([
        { ...PIN_580W, price: 2_600_000, prices: [] },
      ]);

      const view = await service.getScoped(
        ACTOR,
        TOAN_QUYEN,
        DON_BAOGIA.id,
        true,
      );

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

      const view = await service.getScoped(
        ACTOR,
        TOAN_QUYEN,
        DON_BAOGIA.id,
        true,
      );

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

      await service.getScoped(ACTOR, TOAN_QUYEN, DON_BAOGIA.id, true);

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

  /**
   * Engine `applyTransition()` (AD-11) — những bất biến mà 4 call-site cũ không tự nói ra.
   * Canh THỨ TỰ op trong tx và PAYLOAD từng op, KHÔNG đếm số lần gọi.
   */
  describe('applyTransition — engine chuyển trạng thái', () => {
    /** Ghi lại thứ tự op chạm DB bên trong tx để khẳng định khoá đi TRƯỚC lệnh ghi. */
    function ghiThuTuOp(): string[] {
      const thuTu: string[] = [];
      queryRaw.mockImplementation(async () => {
        thuTu.push('lock');
        return [{ id: DON_BAOGIA.id }];
      });
      txOrderRepo.updateMany.mockImplementation(async () => {
        thuTu.push('updateMany');
        return { count: 1 };
      });
      txDiscountRepo.create.mockImplementation(async () => {
        thuTu.push('approval.create');
        return {};
      });
      txDiscountRepo.updateMany.mockImplementation(async () => {
        thuTu.push('approval.updateMany');
        return { count: 1 };
      });
      txVersionRepo.create.mockImplementation(async () => {
        thuTu.push('version.create');
        return {};
      });
      txVersionRepo.update.mockImplementation(async () => {
        thuTu.push('version.update');
        return {};
      });
      return thuTu;
    }

    it('confirm: KHOÁ DÒNG là op ĐẦU TIÊN chạm DB, TRƯỚC cổng atomic', async () => {
      const thuTu = ghiThuTuOp();
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN);

      expect(thuTu.slice(0, 2)).toEqual(['lock', 'updateMany']);
      expect(queryRaw).toHaveBeenCalled();
    });

    it('revise: khoá TRƯỚC cổng, và cổng vẫn là op ghi đầu tiên (rollback rẻ)', async () => {
      const thuTu = ghiThuTuOp();
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dachot',
      });
      orderVersionRepo.findUnique.mockResolvedValue({
        id: VERSION_ID,
        versionNo: 1,
      });
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);

      await service.revise(ACTOR, DON_BAOGIA.id, true, TOAN_QUYEN);

      expect(thuTu.slice(0, 3)).toEqual([
        'lock',
        'updateMany',
        'version.create',
      ]);
    });

    it('applyDiscount: khoá + cổng chạy TRƯỚC khi tạo approval (bất biến một-pending-mỗi-đơn)', async () => {
      const thuTu = ghiThuTuOp();
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);

      await service.applyDiscount(
        ACTOR,
        DON_BAOGIA.id,
        1_000_000,
        null,
        true,
        TOAN_QUYEN,
      );

      expect(thuTu).toEqual(['lock', 'updateMany', 'approval.create']);
    });

    it('chốt từ choduyet: WHERE dùng status QUAN SÁT ĐƯỢC, KHÔNG hardcode baogia', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'choduyet',
      });
      discountApprovalRepo.findFirst.mockResolvedValue({
        id: 'ap-1',
        orderId: DON_BAOGIA.id,
        amount: 500_000,
        status: 'dong_y',
        requestNote: null,
        resolveNote: null,
        createdAt: new Date('2026-07-17T00:00:00Z'),
        resolvedAt: new Date('2026-07-17T01:00:00Z'),
      });
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);

      await service.confirm(ACTOR, DON_BAOGIA.id, 8, true, TOAN_QUYEN);

      // Literal 'baogia' ở đây sẽ làm nhánh choduyet → dachot trượt cổng im lặng.
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'choduyet' },
        data: { status: 'dachot' },
      });
    });

    it('thiếu permission ⇒ 403 FORBIDDEN, KHÔNG khoá, KHÔNG ghi, KHÔNG event', async () => {
      lineRepo.findMany.mockResolvedValue([DONG_CATALOG]);

      const err = await bat(
        service.confirm(
          ACTOR,
          DON_BAOGIA.id,
          8,
          true,
          new Set([PERM.quotesCreateEdit]),
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      // Guard đánh giá TRƯỚC khi đụng DB: không một khoá nào bị lấy, không dòng nào bị ghi.
      expect(queryRaw).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(txVersionRepo.update).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('duyệt ĐỒNG Ý: KHÔNG gọi engine (đơn ở nguyên choduyet) — không khoá, không ghi status', async () => {
      const thuTu = ghiThuTuOp();
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'choduyet',
      });
      discountApprovalRepo.findFirst.mockResolvedValue({
        id: 'ap-1',
        orderId: DON_BAOGIA.id,
        amount: 500_000,
        status: 'cho_duyet',
        requestNote: null,
        resolveNote: null,
        createdAt: new Date('2026-07-17T00:00:00Z'),
        resolvedAt: null,
      });

      await service.resolveDiscount(
        'acc-quanly-1',
        DON_BAOGIA.id,
        true,
        null,
        true,
        TOAN_QUYEN,
      );

      expect(thuTu).toEqual(['approval.updateMany']);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('từ chối: cổng approval chạy TRƯỚC, engine chạy SAU (thứ tự bất đối xứng giữ nguyên)', async () => {
      const thuTu = ghiThuTuOp();
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'choduyet',
      });
      discountApprovalRepo.findFirst.mockResolvedValue({
        id: 'ap-1',
        orderId: DON_BAOGIA.id,
        amount: 500_000,
        status: 'cho_duyet',
        requestNote: null,
        resolveNote: null,
        createdAt: new Date('2026-07-17T00:00:00Z'),
        resolvedAt: null,
      });

      await service.resolveDiscount(
        'acc-quanly-1',
        DON_BAOGIA.id,
        false,
        'Biên mỏng quá',
        true,
        TOAN_QUYEN,
      );

      expect(thuTu).toEqual(['approval.updateMany', 'lock', 'updateMany']);
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_BAOGIA.id, status: 'choduyet' },
        data: { status: 'baogia' },
      });
    });

    /**
     * Ba lý do từ chối của `evaluateTransition` phải ra BA kết quả HTTP phân biệt được. Bốn
     * call-site hiện tại KHÔNG chạm tới hai nhánh `scope`/`not_in_table`: mỗi cái đều có
     * pre-check trạng thái riêng bắn 409 trước khi mở transaction, nên engine không bao giờ
     * thấy một cặp ngoài bảng. Nhánh vẫn là HỢP ĐỒNG cho caller đầu tiên dispatch nhiều
     * transition qua một entry point — không test thì gộp `scope` vào chung thông điệp
     * `not_in_table` (hoặc đổi 409 thành 403) sẽ trôi qua mọi lane.
     *
     * Gọi thẳng engine vì không có đường công khai nào tới đây. Từ chối xảy ra TRƯỚC op DB
     * đầu tiên nên `tx` không bao giờ bị chạm — truyền một object rỗng là đủ và chính nó
     * khẳng định luôn thứ tự "đánh giá guard trước khi đụng DB".
     */
    describe('từ chối: mỗi lý do ra một kết quả HTTP riêng', () => {
      type Engine = {
        applyTransition(
          tx: unknown,
          input: Record<string, unknown>,
        ): Promise<unknown>;
      };

      function goiEngine(order: Order, event: string) {
        return (service as unknown as Engine).applyTransition({} as never, {
          order,
          event,
          actorPermissions: TOAN_QUYEN,
          actorAccountId: ACTOR,
          sentinel: new Error('không được chạm tới'),
          occurredAt: new Date('2026-07-18T00:00:00Z'),
        });
      }

      it('cờ phạm vi TẮT ⇒ 409 với thông điệp RIÊNG về phạm vi (không gộp chung ngoài-bảng)', async () => {
        // `dacoc --bắt đầu thi công--> thicong` có trong bảng nhưng đòi cờ Thi công; đơn mẫu
        // bật Thiết bị, tắt Thi công.
        const err = await bat(
          goiEngine({ ...DON_BAOGIA, status: 'dacoc' }, SU_KIEN.batDauThiCong),
        );

        expect(err.getStatus()).toBe(409);
        expect(err.errorCode).toBe(ErrorCode.CONFLICT);
        expect(err.message).toBe('Bước này không thuộc phạm vi của đơn.');
      });

      it('cặp ngoài bảng ⇒ 409 với thông điệp về trạng thái', async () => {
        const err = await bat(
          goiEngine({ ...DON_BAOGIA, status: 'huy' }, SU_KIEN.chot),
        );

        expect(err.getStatus()).toBe(409);
        expect(err.errorCode).toBe(ErrorCode.CONFLICT);
        expect(err.message).toBe(
          'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
        );
      });

      it('cùng một cặp: thiếu quyền ra 403, đủ quyền nhưng sai cờ ra 409 — hai nhánh KHÔNG hoán đổi', async () => {
        const donDaCoc = { ...DON_BAOGIA, status: 'dacoc' };

        const thieuQuyen = await bat(
          (service as unknown as Engine).applyTransition({} as never, {
            order: { ...donDaCoc, scopeThiCong: true },
            event: SU_KIEN.batDauThiCong,
            actorPermissions: new Set([PERM.quotesCreateEdit]),
            actorAccountId: ACTOR,
            sentinel: new Error('không được chạm tới'),
            occurredAt: new Date('2026-07-18T00:00:00Z'),
          }),
        );

        expect(thieuQuyen.getStatus()).toBe(403);
        expect(thieuQuyen.errorCode).toBe(ErrorCode.FORBIDDEN);
        expect(
          (await bat(goiEngine(donDaCoc, SU_KIEN.batDauThiCong))).getStatus(),
        ).toBe(409);
      });
    });
  });

  /**
   * Story 5.2 — cửa vào CÔNG KHAI DUY NHẤT cho auto-transition. Method này KHÔNG sở hữu một
   * luật transition nào: nó chỉ sở hữu phần *no-op + transaction + publish*, còn hợp lệ hay
   * không vẫn do CÙNG `applyTransition()` mà `confirm`/`revise` đi qua (AD-11).
   */
  describe('chuyenTrangThaiTuDong — auto-transition qua CÙNG engine (Story 5.2)', () => {
    const DON_DA_CHOT: Order = { ...DON_BAOGIA, status: 'dachot' };

    it('AC-1: đủ cọc trên đơn đã chốt ⇒ cổng atomic ghi dachot → dacoc, publish StatusChanged của actor', async () => {
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);

      await service.chuyenTrangThaiTuDong({
        orderId: DON_DA_CHOT.id,
        event: SU_KIEN.duCoc,
        actorAccountId: ACTOR,
        actorPermissions: TOAN_QUYEN,
      });

      // WHERE dùng status QUAN SÁT ĐƯỢC, `data` mang ĐÚNG đích của bảng — không literal nào
      // do call-site tự chế.
      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_DA_CHOT.id, status: 'dachot' },
        data: { status: 'dacoc' },
      });
      // ĐÚNG MỘT event: auto-transition không có event nghiệp vụ đi kèm ở story này
      // (`DepositRecorded` là của 7.2 và do `payments/` publish).
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = eventBus.publish.mock.calls[0][0] as StatusChanged;
      expect(event).toBeInstanceOf(StatusChanged);
      expect({
        actorAccountId: event.actorAccountId,
        truoc: event.before.status,
        sau: event.after.status,
      }).toEqual({
        actorAccountId: ACTOR,
        truoc: 'dachot',
        sau: 'dacoc',
      });
    });

    it('AC-5: đơn ĐÃ ở đích + cùng sự kiện ⇒ no-op — KHÔNG mở transaction, KHÔNG publish, KHÔNG ném', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_BAOGIA,
        status: 'dacoc',
      });

      await expect(
        service.chuyenTrangThaiTuDong({
          orderId: DON_BAOGIA.id,
          event: SU_KIEN.duCoc,
          actorAccountId: ACTOR,
          actorPermissions: TOAN_QUYEN,
        }),
      ).resolves.toBeUndefined();

      expect(transaction).not.toHaveBeenCalled();
      expect(queryRaw).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('AC-5: thua cuộc đua (cổng count 0) nhưng đọc lại thấy ĐÃ tới đích ⇒ no-op, không 409', async () => {
      // Kẻ thua cuộc đua thấy đúng kết quả mình muốn ⇒ retry thành công, không phải xung đột.
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_DA_CHOT)
        .mockResolvedValue({ ...DON_BAOGIA, status: 'dacoc' });
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.chuyenTrangThaiTuDong({
          orderId: DON_DA_CHOT.id,
          event: SU_KIEN.duCoc,
          actorAccountId: ACTOR,
          actorPermissions: TOAN_QUYEN,
        }),
      ).resolves.toBeUndefined();

      // Kẻ thua KHÔNG publish — nếu không, một sự kiện thanh toán đẻ ra hai `StatusChanged`.
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('thua cuộc đua và đọc lại thấy đơn ĐI CHỖ KHÁC ⇒ 409 (không nuốt im lặng)', async () => {
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_DA_CHOT)
        .mockResolvedValue({ ...DON_BAOGIA, status: 'huy' });
      txOrderRepo.updateMany.mockResolvedValue({ count: 0 });

      const err = await bat(
        service.chuyenTrangThaiTuDong({
          orderId: DON_DA_CHOT.id,
          event: SU_KIEN.duCoc,
          actorAccountId: ACTOR,
          actorPermissions: TOAN_QUYEN,
        }),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('AC-6: bộ quyền RỖNG ⇒ 403 — không khoá dòng nào, không lệnh ghi nào, không event', async () => {
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);

      const err = await bat(
        service.chuyenTrangThaiTuDong({
          orderId: DON_DA_CHOT.id,
          event: SU_KIEN.duCoc,
          actorAccountId: ACTOR,
          actorPermissions: new Set(),
        }),
      );

      expect(err.errorCode).toBe(ErrorCode.FORBIDDEN);
      expect(err.getStatus()).toBe(403);
      // Bằng chứng KHÔNG có đường bypass: engine nhận đúng bộ quyền của actor, và nó từ chối
      // TRƯỚC op DB đầu tiên.
      expect(queryRaw).not.toHaveBeenCalled();
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('AC-6: quyền của actor được truyền NGUYÊN VẸN — thiếu đúng key mà bảng đòi cũng là 403', async () => {
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);

      // Có mọi quyền TRỪ `payments.record` — đúng key mà dòng `duCoc` đòi.
      const thieuMotKey = new Set(
        Object.values(PERM).filter((key) => key !== PERM.paymentsRecord),
      );
      const err = await bat(
        service.chuyenTrangThaiTuDong({
          orderId: DON_DA_CHOT.id,
          event: SU_KIEN.duCoc,
          actorAccountId: ACTOR,
          actorPermissions: thieuMotKey,
        }),
      );

      expect(err.getStatus()).toBe(403);
    });

    it('tất toán trên đơn `dachot` KHÔNG cờ Thiết bị ⇒ 409 phạm vi (đơn thi công không đi tắt)', async () => {
      orderRepo.findUnique.mockResolvedValue({
        ...DON_DA_CHOT,
        scopeThietBi: false,
        scopeThiCong: true,
      });

      const err = await bat(
        service.chuyenTrangThaiTuDong({
          orderId: DON_DA_CHOT.id,
          event: SU_KIEN.hoanThanh,
          actorAccountId: ACTOR,
          actorPermissions: TOAN_QUYEN,
        }),
      );

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe('Bước này không thuộc phạm vi của đơn.');
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
    });

    it('tất toán trên đơn `dachot` CÓ cờ Thiết bị ⇒ đi được thẳng tới hoanthanh', async () => {
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);

      await service.chuyenTrangThaiTuDong({
        orderId: DON_DA_CHOT.id,
        event: SU_KIEN.hoanThanh,
        actorAccountId: ACTOR,
        actorPermissions: TOAN_QUYEN,
      });

      expect(txOrderRepo.updateMany).toHaveBeenCalledWith({
        where: { id: DON_DA_CHOT.id, status: 'dachot' },
        data: { status: 'hoanthanh' },
      });
    });

    it('sự kiện ngoài bảng từ trạng thái hiện tại (duCoc khi đang baogia) ⇒ 409, không ghi status', async () => {
      orderRepo.findUnique.mockResolvedValue(DON_BAOGIA);

      const err = await bat(
        service.chuyenTrangThaiTuDong({
          orderId: DON_BAOGIA.id,
          event: SU_KIEN.duCoc,
          actorAccountId: ACTOR,
          actorPermissions: TOAN_QUYEN,
        }),
      );

      expect(err.getStatus()).toBe(409);
      expect(err.message).toBe(
        'Không chuyển được trạng thái đơn từ trạng thái hiện tại.',
      );
      expect(txOrderRepo.updateMany).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("AD-18: thứ tự ['write','publish'] — StatusChanged rời khỏi đây SAU commit", async () => {
      // Publish BÊN TRONG tx thì một rollback sau đó để lại event nói về một transition chưa
      // từng xảy ra: audit ghi đơn đã cọc trong khi DB vẫn `dachot`. Không lane nào khác quan
      // sát được thứ tự này — mock `$transaction` gọi callback đồng bộ nên "trong" và "ngoài"
      // cho ra cùng kết quả ở mọi assertion khác.
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);
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

      await service.chuyenTrangThaiTuDong({
        orderId: DON_DA_CHOT.id,
        event: SU_KIEN.duCoc,
        actorAccountId: ACTOR,
        actorPermissions: TOAN_QUYEN,
      });

      expect(thuTu).toEqual(['write', 'publish']);
    });

    it('KHOÁ DÒNG là op ĐẦU TIÊN chạm DB, trước cổng atomic', async () => {
      orderRepo.findUnique.mockResolvedValue(DON_DA_CHOT);
      const thuTu: string[] = [];
      queryRaw.mockImplementation(async () => {
        thuTu.push('lock');
        return [{ id: DON_DA_CHOT.id }];
      });
      txOrderRepo.updateMany.mockImplementation(async () => {
        thuTu.push('updateMany');
        return { count: 1 };
      });

      await service.chuyenTrangThaiTuDong({
        orderId: DON_DA_CHOT.id,
        event: SU_KIEN.duCoc,
        actorAccountId: ACTOR,
        actorPermissions: TOAN_QUYEN,
      });

      expect(thuTu).toEqual(['lock', 'updateMany']);
    });
  });

  /** Task 6: mutator nội dung cũng phải lấy CÙNG khoá — khoá một phía là false-green. */
  describe('mutator nội dung — khoá dòng đơn + đọc lại status TRONG tx', () => {
    it.each([
      [
        'addLine',
        () =>
          service.addLine(
            ACTOR,
            DON_BAOGIA.id,
            { productId: PIN_580W.id, qty: 2 },
            true,
            TOAN_QUYEN,
          ),
      ],
      [
        'updateLine',
        () =>
          service.updateLine(
            ACTOR,
            DON_BAOGIA.id,
            DONG_CATALOG.id,
            { qty: 3 },
            true,
            TOAN_QUYEN,
          ),
      ],
      [
        'removeLine',
        () =>
          service.removeLine(ACTOR, DON_BAOGIA.id, DONG_CATALOG.id, TOAN_QUYEN),
      ],
      [
        'update (PATCH đơn)',
        () =>
          service.update(
            ACTOR,
            DON_BAOGIA.id,
            { scopeThiCong: true },
            true,
            TOAN_QUYEN,
          ),
      ],
    ])('%s lấy khoá FOR UPDATE trước khi ghi', async (_ten, goi) => {
      const thuTu: string[] = [];
      queryRaw.mockImplementation(async () => {
        thuTu.push('lock');
        return [{ id: DON_BAOGIA.id }];
      });
      for (const [ten, mock] of [
        ['line.create', lineRepo.create],
        ['line.update', lineRepo.update],
        ['line.delete', lineRepo.delete],
        ['order.update', orderRepo.update],
      ] as const) {
        mock.mockImplementation(async () => {
          thuTu.push(ten);
          return ten === 'order.update' ? DON_BAOGIA : DONG_CATALOG;
        });
      }

      await goi();

      expect(thuTu[0]).toBe('lock');
      expect(thuTu.length).toBeGreaterThan(1);
    });

    it('status đổi GIỮA CHỪNG (đọc lại trong tx thấy dachot) ⇒ 409, KHÔNG ghi dòng nào', async () => {
      // Ngoài tx đơn còn `baogia` (fast-path lọt), trong tx đã thành `dachot`.
      orderRepo.findUnique
        .mockResolvedValueOnce(DON_BAOGIA)
        .mockResolvedValue({ ...DON_BAOGIA, status: 'dachot' });

      const err = await bat(
        service.addLine(
          ACTOR,
          DON_BAOGIA.id,
          { productId: PIN_580W.id, qty: 2 },
          true,
          TOAN_QUYEN,
        ),
      );

      expect(err.errorCode).toBe(ErrorCode.CONFLICT);
      expect(err.getStatus()).toBe(409);
      expect(lineRepo.create).not.toHaveBeenCalled();
    });

    /**
     * Nợ L-1 giao lại từ review 5.1. `assertMutable` đọc lại trong tx CHƯA đủ: một cặp
     * `chot` + `mo_lai` chen vào cửa sổ đưa status VỀ LẠI `baogia` (nên `assertMutable` vẫn
     * qua) nhưng đã repoint con trỏ sang bản MỚI. `lineId` được validate theo con trỏ đọc
     * NGOÀI tx sẽ trỏ vào dòng của bản ĐÃ CHẾT — thao tác ghi thành công vào dữ liệu mồ côi,
     * không một lỗi nào nổi lên.
     */
    describe('L-1: con trỏ bản hiệu lực cũng phải đọc LẠI trong tx', () => {
      /** Ngoài tx: bản cũ. Trong tx: đã repoint sang bản mới ⇒ dòng cũ không còn thuộc bản. */
      function repointGiuaChung(): void {
        orderRepo.findUnique
          .mockResolvedValueOnce(DON_BAOGIA)
          .mockResolvedValue({ ...DON_BAOGIA, currentVersionId: 'ver-2' });
      }

      it('updateLine: dòng thuộc bản ĐÃ CHẾT ⇒ 404, KHÔNG lệnh ghi nào', async () => {
        repointGiuaChung();

        const err = await bat(
          service.updateLine(
            ACTOR,
            DON_BAOGIA.id,
            DONG_CATALOG.id,
            { qty: 3 },
            true,
            TOAN_QUYEN,
          ),
        );

        expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
        expect(err.getStatus()).toBe(404);
        expect(lineRepo.update).not.toHaveBeenCalled();
        expect(eventBus.publish).not.toHaveBeenCalled();
      });

      it('removeLine: dòng thuộc bản ĐÃ CHẾT ⇒ 404, KHÔNG xoá gì', async () => {
        repointGiuaChung();

        const err = await bat(
          service.removeLine(ACTOR, DON_BAOGIA.id, DONG_CATALOG.id, TOAN_QUYEN),
        );

        expect(err.errorCode).toBe(ErrorCode.NOT_FOUND);
        expect(err.getStatus()).toBe(404);
        expect(lineRepo.delete).not.toHaveBeenCalled();
        expect(eventBus.publish).not.toHaveBeenCalled();
      });

      it('con trỏ KHÔNG đổi ⇒ cả hai vẫn đi bình thường (guard không chặn đường lành)', async () => {
        lineRepo.update.mockResolvedValue({ ...DONG_CATALOG, qty: 3 });

        await service.updateLine(
          ACTOR,
          DON_BAOGIA.id,
          DONG_CATALOG.id,
          { qty: 3 },
          true,
          TOAN_QUYEN,
        );
        await service.removeLine(
          ACTOR,
          DON_BAOGIA.id,
          DONG_CATALOG.id,
          TOAN_QUYEN,
        );

        expect(lineRepo.update).toHaveBeenCalled();
        expect(lineRepo.delete).toHaveBeenCalled();
      });
    });
  });
});
