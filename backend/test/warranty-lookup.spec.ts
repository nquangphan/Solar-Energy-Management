import type { Prisma } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';
import { EventBus } from '../src/events/event-bus';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersService } from '../src/orders/orders.service';
import { fakeStorage } from './util/fake-storage';

/**
 * `OrdersService.traCuuBaoHanh` — hermetic, Prisma mock. Lane này chứng minh HÌNH DẠNG query
 * (mệnh đề phạm vi, lọc dòng, bản hiệu lực) và phép map qua domain; mã HTTP + envelope là
 * việc của lane e2e.
 */
describe('OrdersService.traCuuBaoHanh', () => {
  const CALLER = 'acc-caller';
  const SDT = '+84903176968';
  const NOW = new Date('2026-07-18T09:00:00.000Z');

  const khach = {
    sdt: SDT,
    name: 'Anh Tuấn',
    custType: 'CA_NHAN',
    cccd: '079…',
  };

  interface DonGia {
    readonly id: string;
    readonly currentVersionId: string | null;
    readonly status?: string;
    readonly chotAt?: Date | null;
  }

  interface DongGia {
    readonly id: string;
    readonly orderVersionId: string;
    readonly name?: string;
    readonly qty?: number;
    readonly unit?: string;
    readonly warrantyMonths: number | null;
    readonly warrantyStartAt: Date | null;
  }

  function dungService(opts: {
    customer?: unknown;
    orders?: readonly DonGia[];
    lines?: readonly DongGia[];
  }) {
    const batDuoc: {
      customerWhere?: unknown;
      orderWhere?: Prisma.OrderWhereInput;
      lineWhere?: Prisma.OrderLineItemWhereInput;
    } = {};
    const prisma = {
      customer: {
        findUnique: (args: { where: unknown }) => {
          batDuoc.customerWhere = args.where;
          return opts.customer === undefined ? khach : opts.customer;
        },
      },
      order: {
        findMany: (args: Prisma.OrderFindManyArgs) => {
          batDuoc.orderWhere = args.where;
          return (opts.orders ?? []).map((o) => ({
            status: 'nghiem_thu',
            ...o,
            currentVersion:
              o.currentVersionId === null
                ? null
                : { id: o.currentVersionId, chotAt: o.chotAt ?? null },
          }));
        },
      },
      orderLineItem: {
        findMany: (args: Prisma.OrderLineItemFindManyArgs) => {
          batDuoc.lineWhere = args.where;
          return (opts.lines ?? []).map((l) => ({
            name: 'Tấm pin 550W',
            qty: 10,
            unit: 'tấm',
            ...l,
          }));
        },
      },
    } as unknown as PrismaService;

    const service = new OrdersService(
      prisma,
      {} as unknown as EventBus,
      fakeStorage(),
    );
    return { service, batDuoc };
  }

  it('SĐT rác ⇒ AppException 400 với fieldErrors trỏ đúng `sdt`', async () => {
    const { service } = dungService({});
    expect.assertions(4);
    try {
      await service.traCuuBaoHanh(CALLER, new Set([PERM.ordersViewAll]), 'abc');
    } catch (e) {
      const err = e as AppException;
      expect(err).toBeInstanceOf(AppException);
      expect(err.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(err.getStatus()).toBe(400);
      expect(err.fieldErrors?.[0].field).toBe('sdt');
    }
  });

  it.each([
    ['0903176968'],
    ['+84903176968'],
    ['84903176968'],
    ['0903.176.968'],
  ])('%s chuẩn hoá về cùng một khoá tra', async (tho) => {
    const { service, batDuoc } = dungService({ orders: [] });
    const kq = await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      tho,
      NOW,
    );
    expect(batDuoc.customerWhere).toEqual({ sdt: SDT });
    expect(kq.sdt).toBe(SDT);
  });

  it('không có khách ⇒ found:false, orders rỗng, KHÔNG ném lỗi', async () => {
    const { service } = dungService({ customer: null });
    const kq = await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      '0903176968',
      NOW,
    );
    expect(kq).toEqual({
      found: false,
      sdt: SDT,
      customer: null,
      orders: [],
    });
  });

  it('view_all ⇒ KHÔNG mệnh đề phạm vi nào ngoài SĐT khách', async () => {
    const { service, batDuoc } = dungService({ orders: [] });
    await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      SDT,
      NOW,
    );
    expect(batDuoc.orderWhere).toEqual({ customerSdt: SDT, AND: [] });
  });

  it('chỉ view_own ⇒ where.AND thu hẹp về đơn mình owner HOẶC assignee', async () => {
    const { service, batDuoc } = dungService({ orders: [] });
    await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewOwn]),
      SDT,
      NOW,
    );
    expect(batDuoc.orderWhere).toEqual({
      customerSdt: SDT,
      AND: [
        {
          OR: [{ ownerAccountId: CALLER }, { assigneeAccountId: CALLER }],
        },
      ],
    });
  });

  it('chỉ đọc dòng của BẢN HIỆU LỰC, và chỉ dòng có đủ hai field bảo hành', async () => {
    const { service, batDuoc } = dungService({
      orders: [
        { id: 'don-1', currentVersionId: 'ver-2' },
        // Đơn chưa chốt: không có bản hiệu lực ⇒ không được để `undefined` lọt vào `in`.
        { id: 'don-2', currentVersionId: null },
      ],
      lines: [],
    });
    await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      SDT,
      NOW,
    );
    expect(batDuoc.lineWhere).toEqual({
      orderVersionId: { in: ['ver-2'] },
      warrantyMonths: { not: null },
      warrantyStartAt: { not: null },
    });
  });

  it('dòng của version CŨ không gom được vào đơn nào', async () => {
    // Đơn 2 bản: `ver-1` là bản cũ, con trỏ `currentVersionId` trỏ `ver-2`. Nếu phép gom
    // đọc theo đơn thay vì theo con trỏ, dòng cũ sẽ hiện lại trong kết quả.
    const { service } = dungService({
      orders: [{ id: 'don-1', currentVersionId: 'ver-2' }],
      lines: [
        {
          id: 'dong-ban-cu',
          orderVersionId: 'ver-1',
          warrantyMonths: 60,
          warrantyStartAt: new Date('2025-01-15T00:00:00.000Z'),
        },
        {
          id: 'dong-ban-hien-luc',
          orderVersionId: 'ver-2',
          warrantyMonths: 60,
          warrantyStartAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      ],
    });
    const kq = await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      SDT,
      NOW,
    );
    expect(kq.orders[0].lineItems.map((l) => l.id)).toEqual([
      'dong-ban-hien-luc',
    ]);
  });

  it('bỏ hẳn đơn không còn dòng bảo hành nào', async () => {
    const { service } = dungService({
      orders: [
        { id: 'don-1', currentVersionId: 'ver-1' },
        { id: 'don-2', currentVersionId: 'ver-2' },
      ],
      lines: [
        {
          id: 'dong-1',
          orderVersionId: 'ver-1',
          warrantyMonths: 60,
          warrantyStartAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      ],
    });
    const kq = await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      SDT,
      NOW,
    );
    expect(kq.orders.map((o) => o.id)).toEqual(['don-1']);
  });

  it('hai dòng cùng đơn khác warrantyStartAt ⇒ hai warrantyEndAt khác nhau (mốc theo DÒNG)', async () => {
    const { service } = dungService({
      orders: [{ id: 'don-1', currentVersionId: 'ver-2' }],
      lines: [
        {
          id: 'dong-cu',
          orderVersionId: 'ver-2',
          name: 'Tấm pin 550W',
          warrantyMonths: 60,
          warrantyStartAt: new Date('2026-01-15T00:00:00.000Z'),
        },
        {
          id: 'dong-them-sau',
          orderVersionId: 'ver-2',
          name: 'Inverter 5kW',
          warrantyMonths: 60,
          warrantyStartAt: new Date('2026-04-20T00:00:00.000Z'),
        },
      ],
    });
    const kq = await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      SDT,
      NOW,
    );
    const [cu, sau] = kq.orders[0].lineItems;
    expect(cu.warrantyEndAt.toISOString()).toBe('2031-01-15T00:00:00.000Z');
    expect(sau.warrantyEndAt.toISOString()).toBe('2031-04-20T00:00:00.000Z');
    expect(cu.warrantyEndAt).not.toEqual(sau.warrantyEndAt);
  });

  it('mọi dòng so cùng MỘT mốc `now`, và trạng thái đi theo số ngày còn lại', async () => {
    const { service } = dungService({
      orders: [{ id: 'don-1', currentVersionId: 'ver-1', chotAt: null }],
      lines: [
        {
          id: 'con-han',
          orderVersionId: 'ver-1',
          warrantyMonths: 12,
          warrantyStartAt: new Date('2026-06-01T00:00:00.000Z'),
        },
        {
          id: 'sap-het',
          orderVersionId: 'ver-1',
          warrantyMonths: 12,
          // Hết hạn 2026-08-01 — còn 14 ngày so với NOW.
          warrantyStartAt: new Date('2025-08-01T00:00:00.000Z'),
        },
        {
          id: 'het-han',
          orderVersionId: 'ver-1',
          warrantyMonths: 12,
          warrantyStartAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      ],
    });
    const kq = await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      SDT,
      NOW,
    );
    const theoId = Object.fromEntries(
      kq.orders[0].lineItems.map((l) => [l.id, l]),
    );
    expect(theoId['con-han'].warrantyStatus).toBe('con_han');
    expect(theoId['sap-het'].warrantyStatus).toBe('sap_het');
    expect(theoId['sap-het'].remainingDays).toBe(14);
    expect(theoId['het-han'].warrantyStatus).toBe('het_han');
    expect(theoId['het-han'].remainingDays).toBeLessThan(0);
    // Nhánh hết hạn không đưa số âm qua formatter hiển thị.
    expect(theoId['het-han'].remainingMonths).toBe(0);
  });

  it('trả đủ các field hiển thị của một dòng', async () => {
    const { service } = dungService({
      orders: [
        {
          id: 'don-1',
          currentVersionId: 'ver-1',
          status: 'nghiem_thu',
          chotAt: new Date('2026-01-15T03:00:00.000Z'),
        },
      ],
      lines: [
        {
          id: 'dong-1',
          orderVersionId: 'ver-1',
          name: 'Tấm pin 550W',
          qty: 10,
          unit: 'tấm',
          warrantyMonths: 60,
          warrantyStartAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      ],
    });
    const kq = await service.traCuuBaoHanh(
      CALLER,
      new Set([PERM.ordersViewAll]),
      SDT,
      NOW,
    );
    expect(kq.found).toBe(true);
    expect(kq.customer).toEqual({
      sdt: SDT,
      name: 'Anh Tuấn',
      custType: 'CA_NHAN',
    });
    expect(kq.orders[0]).toEqual({
      id: 'don-1',
      status: 'nghiem_thu',
      chotAt: new Date('2026-01-15T03:00:00.000Z'),
      lineItems: [
        {
          id: 'dong-1',
          name: 'Tấm pin 550W',
          qty: 10,
          unit: 'tấm',
          warrantyMonths: 60,
          warrantyStartAt: new Date('2026-01-15T00:00:00.000Z'),
          warrantyEndAt: new Date('2031-01-15T00:00:00.000Z'),
          remainingDays: 1642,
          remainingMonths: 53,
          warrantyStatus: 'con_han',
        },
      ],
    });
  });
});
