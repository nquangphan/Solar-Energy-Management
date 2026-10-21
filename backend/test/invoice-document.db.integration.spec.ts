import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PERM } from '../src/accounts/domain/permission-registry';
import { AuditService } from '../src/audit/audit.service';
import { AuditSubscriber } from '../src/audit/audit.subscriber';
import type { AppException } from '../src/common/errors/app.exception';
import { InProcessEventBus } from '../src/events/in-process-event-bus';
import { StockItemsService } from '../src/inventory/stock-items.service';
import { StockVouchersService } from '../src/inventory/stock-vouchers.service';
import {
  INVOICE_NOT_FOUND_MESSAGE,
  INVOICE_PDF_NOT_EXPORTED_MESSAGE,
  InvoiceDocumentService,
} from '../src/invoices/invoice-document.service';
import { InvoicesService } from '../src/invoices/invoices.service';
import { quoteNumberOf } from '../src/orders/domain/quote-number';
import { OrdersService } from '../src/orders/orders.service';
import type { QuoteRendererPort } from '../src/orders/quote/quote-renderer.port';
import type { PrismaService } from '../src/prisma/prisma.service';
import { LEGAL_ENTITY_FIELDS } from '../src/settings/domain/company-legal-entity';
import { SettingsService } from '../src/settings/settings.service';
import { fakeStorage, type FakeStorage } from './util/fake-storage';

/**
 * INTEGRATION lane on REAL Postgres for viewing and exporting an invoice — facts a mock cannot
 * prove:
 *  - the migration's CHECK (`pdf_size > 0`) and the one-PDF-per-invoice unique stand on their own;
 *  - the detail is the stored snapshot: it equals the `invoices`/`invoice_lines` rows, and changing
 *    the customer, the company legal entity, the order's VAT and its lines afterwards changes
 *    nothing; an invoice above INT4 reads back as an exact number;
 *  - an export writes ONE `invoice_pdfs` row and ONE `InvoicePdfExported` audit row; a repeat
 *    replays; a cancelled order still exports;
 *  - export runs under the INVOICE row lock: two concurrent exports render once; a holder that
 *    WRITES the `invoice_pdfs` row under that lock makes the export WAIT, then replay it.
 *
 * R2 and Chromium are in-memory fakes (no real upload). SKIPS itself without `DATABASE_URL`.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

describeDb('Invoice view + PDF export on REAL Postgres', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let settings: SettingsService;
  let invoices: InvoicesService;
  let documents: InvoiceDocumentService;
  let storage: FakeStorage;
  let renderPdf: jest.Mock;

  const ACTOR = 'acc-invoices-75';
  const OUTSIDER = 'acc-invoices-75-outsider';
  const PHONE = '+84900000750';
  const ALL = new Set<string>(Object.values(PERM));
  const VIEW_OWN = new Set<string>([PERM.invoicesManage, PERM.ordersViewOwn]);
  const PDF = Buffer.from('%PDF-1.4 invoice db lane');
  const LEGAL_KEYS = LEGAL_ENTITY_FIELDS.map(({ key }) => key);
  let sourceId: string;
  let savedLegalRows: { key: string; value: string }[];

  async function cleanUp(): Promise<void> {
    const found = await prisma.order.findMany({
      where: { customerSdt: PHONE },
      select: { id: true },
    });
    const orderIds = found.map((o) => o.id);
    await prisma.invoicePdf.deleteMany({
      where: { invoice: { orderId: { in: orderIds } } },
    });
    await prisma.invoiceLine.deleteMany({
      where: { invoice: { orderId: { in: orderIds } } },
    });
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.auditLog.deleteMany({ where: { actorAccountId: ACTOR } });
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { currentVersionId: null },
    });
    await prisma.orderLineItem.deleteMany({
      where: { orderVersion: { orderId: { in: orderIds } } },
    });
    await prisma.orderVersion.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.customer.deleteMany({ where: { sdt: PHONE } });
    await prisma.account.deleteMany({ where: { id: ACTOR } });
  }

  /** The mockup order: 4 lines, 76.862.000 before VAT. */
  const MOCKUP = [
    { name: 'Tấm pin AE 630W', unit: 'Tấm', qty: 14, unitPrice: 2_583_000 },
    {
      name: 'Inverter Solplanet ASW8000-S',
      unit: 'Bộ',
      qty: 1,
      unitPrice: 18_500_000,
    },
    { name: 'Vật tư (gói)', unit: 'Gói', qty: 1, unitPrice: 12_400_000 },
    { name: 'Công lắp đặt', unit: 'Gói', qty: 1, unitPrice: 9_800_000 },
  ];

  /** A confirmed order (through the real `confirm`) with an invoice (through the real `create`). */
  async function invoicedOrder(
    lines = MOCKUP,
  ): Promise<{ orderId: string; invoiceId: string }> {
    const created = await prisma.order.create({
      data: {
        status: 'baogia',
        customerSdt: PHONE,
        ownerAccountId: ACTOR,
        sourceId,
        custType: 'THUONG_MAI',
        scopeThietBi: true,
        scopeThiCong: true,
        scopeVanChuyen: false,
        vatMode: 'co_vat',
      },
    });
    const version = await prisma.orderVersion.create({
      data: { orderId: created.id, versionNo: 1 },
    });
    await prisma.orderLineItem.createMany({
      data: lines.map((line, index) => ({
        orderVersionId: version.id,
        productId: null,
        name: line.name,
        unit: line.unit,
        qty: line.qty,
        unitPrice: line.unitPrice,
        priceEditable: true,
        displayOrder: index,
      })),
    });
    await prisma.order.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });
    await orders.confirm(ACTOR, created.id, 8, false, ALL);
    const invoice = await invoices.create(ACTOR, ALL, created.id, 8, false);
    return { orderId: created.id, invoiceId: invoice.id };
  }

  const exportPdf = (orderId: string, invoiceId: string) =>
    documents.exportPdf(ACTOR, ALL, orderId, invoiceId);

  const pdfAudits = (orderId: string) =>
    prisma.auditLog.count({
      where: {
        actorAccountId: ACTOR,
        eventType: 'InvoicePdfExported',
        targetId: orderId,
      },
    });

  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function rejection(p: Promise<unknown>): Promise<Error> {
    try {
      await p;
    } catch (e) {
      return e as Error;
    }
    throw new Error('Expected an error, got none.');
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await prisma.$connect();
    const bus = new InProcessEventBus();
    new AuditSubscriber(
      bus,
      new AuditService(prisma as unknown as PrismaService),
    ).onModuleInit();
    orders = new OrdersService(
      prisma as unknown as PrismaService,
      bus,
      fakeStorage(),
      new StockVouchersService(prisma as unknown as PrismaService, bus),
      new StockItemsService(prisma as unknown as PrismaService),
    );
    settings = new SettingsService(prisma as unknown as PrismaService, bus);
    invoices = new InvoicesService(
      orders,
      prisma as unknown as PrismaService,
      bus,
      settings,
    );
    storage = fakeStorage();
    renderPdf = jest.fn(() => Promise.resolve(PDF));
    documents = new InvoiceDocumentService(
      orders,
      prisma as unknown as PrismaService,
      bus,
      storage,
      { renderPdf, render: jest.fn() } as unknown as QuoteRendererPort,
    );
    const facebook = await prisma.customerSource.findUnique({
      where: { name: 'Facebook' },
    });
    if (facebook === null) {
      throw new Error('CustomerSource not seeded — run `npx prisma db seed`.');
    }
    sourceId = facebook.id;
    savedLegalRows = await prisma.systemSetting.findMany({
      where: { key: { in: LEGAL_KEYS } },
      select: { key: true, value: true },
    });
    await cleanUp();
    await prisma.account.create({
      data: {
        id: ACTOR,
        email: 'invoices-75@example.com',
        passwordHash: 'x',
        displayName: 'Test 7.5',
      },
    });
    await prisma.customer.create({
      data: {
        sdt: PHONE,
        custType: 'THUONG_MAI',
        name: 'VP Công Chứng Lê Đình Thao',
        taxCode: '0316552018',
        address: '122 Trần Não, TP. Thủ Đức',
        sourceId,
      },
    });
  });

  afterAll(async () => {
    await cleanUp();
    // The company legal entity is global: put back exactly what was there before this file.
    await prisma.systemSetting.deleteMany({
      where: { key: { in: LEGAL_KEYS } },
    });
    if (savedLegalRows.length > 0) {
      await prisma.systemSetting.createMany({ data: savedLegalRows });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    renderPdf.mockClear();
    storage.objects.clear();
  });

  describe('constraints stand on their own', () => {
    it('pdf_size 0 ⇒ invoice_pdfs_size_positive', async () => {
      const { invoiceId } = await invoicedOrder();
      const error = await rejection(
        prisma.$executeRaw`INSERT INTO invoice_pdfs (id, invoice_id, pdf_key, pdf_size, file_name, created_by_account_id) VALUES (gen_random_uuid()::text, ${invoiceId}, 'k', 0, 'f', ${ACTOR})`,
      );
      expect(error.message).toContain('invoice_pdfs_size_positive');
    });

    it('a second PDF row for one invoice ⇒ unique invoice_id (the last net)', async () => {
      const { orderId, invoiceId } = await invoicedOrder();
      await exportPdf(orderId, invoiceId);
      const error = await rejection(
        prisma.invoicePdf.create({
          data: {
            invoiceId,
            pdfKey: 'k',
            pdfSize: 1,
            fileName: 'f',
            createdByAccountId: ACTOR,
          },
        }),
      );
      expect(error.message).toMatch(/invoice_id|Unique constraint/);
    });
  });

  it('detail = the stored rows (never hand-typed), linked to its order, pdf null', async () => {
    // Seven DISTINCT seller values, so a mapping that swaps two seller fields cannot pass.
    const legalEntity = {
      legalName: 'CÔNG TY NLMT PHƯƠNG NAM',
      taxCode: '0312998771',
      address: '12 Nguyễn Văn Bảo, Gò Vấp',
      representative: 'Nguyễn Văn An',
      representativeTitle: 'Giám đốc',
      phone: '028 3899 1234',
      bankAccount: '0071001234567 Vietcombank',
    };
    await settings.updateCompanyLegalEntity(ACTOR, legalEntity);
    const { orderId, invoiceId } = await invoicedOrder();

    const detail = await documents.detail(ACTOR, ALL, orderId, invoiceId);

    const row = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { displayOrder: 'asc' } },
        orderVersion: true,
      },
    });
    expect(detail).toMatchObject({
      id: row.id,
      invoiceNo: row.invoiceNo,
      issuedAt: row.issuedAt,
      orderId,
      quoteNo: quoteNumberOf(orderId),
      versionNo: row.orderVersion.versionNo,
      customerName: row.customerName,
      customerSdt: row.customerSdt,
      customerTaxCode: row.customerTaxCode,
      customerAddress: row.customerAddress,
      vatRate: row.vatRate,
      applyVat: row.applyVat,
      subtotal: Number(row.subtotal),
      discountAmount: Number(row.discountAmount),
      vatAmount: Number(row.vatAmount),
      total: Number(row.total),
      lineCount: 4,
      pdf: null,
    });
    expect(detail.seller).toEqual({
      legalName: row.sellerLegalName,
      taxCode: row.sellerTaxCode,
      address: row.sellerAddress,
      representative: row.sellerRepresentative,
      representativeTitle: row.sellerRepresentativeTitle,
      phone: row.sellerPhone,
      bankAccount: row.sellerBankAccount,
    });
    expect(detail.seller).toEqual(legalEntity);
    expect(detail.lines).toEqual(
      row.lines.map((line) => ({
        displayOrder: line.displayOrder,
        name: line.name,
        unit: line.unit,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: Number(line.amount),
      })),
    );
    expect(detail.lines.map((line) => line.name)).toEqual(
      MOCKUP.map((line) => line.name),
    );
    // The invoice of the mockup order carries the order's own scoped total.
    const orderTotal = await orders.getScopedTotal(
      ACTOR,
      ALL,
      orderId,
      8,
      false,
    );
    expect(detail.total).toBe(orderTotal.total);
  });

  it('a snapshot: changing the customer, the legal entity, the VAT and the lines afterwards changes nothing', async () => {
    const { orderId, invoiceId } = await invoicedOrder();
    const before = await documents.detail(ACTOR, ALL, orderId, invoiceId);
    const version = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { currentVersionId: true },
    });

    await prisma.customer.update({
      where: { sdt: PHONE },
      data: { name: 'Tên mới', taxCode: '9999999999', address: 'Nơi khác' },
    });
    await settings.updateCompanyLegalEntity(ACTOR, {
      legalName: 'TÊN ĐÃ ĐỔI',
      taxCode: '1111111111',
      address: 'Địa chỉ mới',
      representative: 'Người khác',
      representativeTitle: 'Phó giám đốc',
      phone: '0909',
      bankAccount: '123',
    });
    await prisma.orderVersion.update({
      where: { id: version.currentVersionId! },
      data: { vatRate: 10 },
    });
    await prisma.orderLineItem.updateMany({
      where: { orderVersionId: version.currentVersionId! },
      data: { unitPrice: 1 },
    });
    try {
      const after = await documents.detail(ACTOR, ALL, orderId, invoiceId);
      expect(after).toEqual(before);

      await exportPdf(orderId, invoiceId);
      const html = renderPdf.mock.calls[0][0] as string;
      expect(html).toContain('VP Công Chứng Lê Đình Thao');
      expect(html).not.toContain('Tên mới');
      expect(html).not.toContain('TÊN ĐÃ ĐỔI');
    } finally {
      await prisma.customer.update({
        where: { sdt: PHONE },
        data: {
          name: 'VP Công Chứng Lê Đình Thao',
          taxCode: '0316552018',
          address: '122 Trần Não, TP. Thủ Đức',
        },
      });
    }
  });

  it('an invoice above INT4 ⇒ detail reads back exact numbers and serialises', async () => {
    const { orderId, invoiceId } = await invoicedOrder([
      { name: 'Trạm biến áp', unit: 'Bộ', qty: 2, unitPrice: 1_500_000_000 },
    ]);

    const detail = await documents.detail(ACTOR, ALL, orderId, invoiceId);

    const row = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    expect(detail.total).toBeGreaterThan(2_147_483_647);
    expect(detail.total).toBe(Number(row.total));
    expect(detail.lines[0].amount).toBe(3_000_000_000);
    expect(() => JSON.stringify(detail)).not.toThrow();
  });

  it('first export ⇒ one invoice_pdfs row, bytes at the deterministic key, one audit row; detail shows it', async () => {
    const { orderId, invoiceId } = await invoicedOrder();

    const result = await exportPdf(orderId, invoiceId);

    const rows = await prisma.invoicePdf.findMany({ where: { invoiceId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pdfKey: `invoices/${orderId}/${invoiceId}.pdf`,
      pdfSize: PDF.length,
      createdByAccountId: ACTOR,
    });
    expect(result).toEqual({
      fileName: `${rows[0].fileName}.pdf`,
      pdfSize: PDF.length,
      exportedAt: rows[0].createdAt,
    });
    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(storage.objects.get(rows[0].pdfKey)?.body).toBe(PDF);
    expect(await pdfAudits(orderId)).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { eventType: 'InvoicePdfExported', targetId: orderId },
    });
    expect(audit.targetType).toBe('Order');
    expect(audit.occurredAt).toEqual(rows[0].createdAt);

    const detail = await documents.detail(ACTOR, ALL, orderId, invoiceId);
    expect(detail.pdf).toEqual(result);
    const file = await documents.getPdf(ACTOR, ALL, orderId, invoiceId);
    expect(file.body).toBe(PDF);
  });

  it('a repeat export ⇒ the same file, no render, still one row and one audit row', async () => {
    const { orderId, invoiceId } = await invoicedOrder();
    const first = await exportPdf(orderId, invoiceId);
    renderPdf.mockClear();

    const second = await exportPdf(orderId, invoiceId);

    expect(second).toEqual(first);
    expect(renderPdf).toHaveBeenCalledTimes(0);
    expect(await prisma.invoicePdf.count({ where: { invoiceId } })).toBe(1);
    expect(await pdfAudits(orderId)).toBe(1);
  });

  it.each(['huy', 'hoanthanh', 'baogia'])(
    'an order moved to %s after its invoice ⇒ still viewable and exportable',
    async (status) => {
      const { orderId, invoiceId } = await invoicedOrder();
      await prisma.order.update({
        where: { id: orderId },
        data: { status },
      });

      await expect(
        documents.detail(ACTOR, ALL, orderId, invoiceId),
      ).resolves.toMatchObject({ id: invoiceId });
      await expect(exportPdf(orderId, invoiceId)).resolves.toMatchObject({
        pdfSize: PDF.length,
      });
    },
  );

  it('getPdf before export ⇒ 404 "Hoá đơn này chưa xuất PDF."', async () => {
    const { orderId, invoiceId } = await invoicedOrder();
    const error = (await rejection(
      documents.getPdf(ACTOR, ALL, orderId, invoiceId),
    )) as AppException;
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe(INVOICE_PDF_NOT_EXPORTED_MESSAGE);
  });

  it("another order's invoice through this order ⇒ 404 on all three, nothing written", async () => {
    const a = await invoicedOrder();
    const b = await invoicedOrder();
    await exportPdf(b.orderId, b.invoiceId);
    renderPdf.mockClear();

    for (const call of [
      () => documents.detail(ACTOR, ALL, a.orderId, b.invoiceId),
      () => exportPdf(a.orderId, b.invoiceId),
      () => documents.getPdf(ACTOR, ALL, a.orderId, b.invoiceId),
    ]) {
      const error = (await rejection(call())) as AppException;
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe(INVOICE_NOT_FOUND_MESSAGE);
    }
    expect(renderPdf).toHaveBeenCalledTimes(0);
    expect(
      await prisma.invoicePdf.count({ where: { invoiceId: b.invoiceId } }),
    ).toBe(1);
    expect(await pdfAudits(a.orderId)).toBe(0);
  });

  it('a view_own caller who is neither owner nor assignee ⇒ 404 like a missing order, even with a stored PDF', async () => {
    const { orderId, invoiceId } = await invoicedOrder();
    await exportPdf(orderId, invoiceId);

    for (const call of [
      () => documents.detail(OUTSIDER, VIEW_OWN, orderId, invoiceId),
      () => documents.exportPdf(OUTSIDER, VIEW_OWN, orderId, invoiceId),
      () => documents.getPdf(OUTSIDER, VIEW_OWN, orderId, invoiceId),
    ]) {
      const error = (await rejection(call())) as AppException;
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe(`Không tìm thấy đơn hàng: ${orderId}`);
    }
  });

  describe('🔴 FOR UPDATE on invoices', () => {
    it('two concurrent exports of one invoice ⇒ one render, one row, the same file, one audit row, no error', async () => {
      const { orderId, invoiceId } = await invoicedOrder();

      const [a, b] = await Promise.all([
        exportPdf(orderId, invoiceId),
        exportPdf(orderId, invoiceId),
      ]);

      expect(a).toEqual(b);
      expect(renderPdf).toHaveBeenCalledTimes(1);
      expect(await prisma.invoicePdf.count({ where: { invoiceId } })).toBe(1);
      expect(await pdfAudits(orderId)).toBe(1);
    });

    it('a holder that locks the invoice and WRITES its invoice_pdfs row ⇒ export waits, then replays it (no render)', async () => {
      const { orderId, invoiceId } = await invoicedOrder();
      let release!: () => void;
      const holding = new Promise<void>((resolve) => {
        release = resolve;
      });
      let holderRow!: { createdAt: Date; fileName: string };
      const holder = prisma.$transaction(
        async (t) => {
          await t.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
          holderRow = await t.invoicePdf.create({
            data: {
              invoiceId,
              pdfKey: `invoices/${orderId}/${invoiceId}.pdf`,
              pdfSize: 7,
              fileName: 'hoa-don-holder',
              createdByAccountId: ACTOR,
            },
          });
          await holding;
        },
        { timeout: 10_000 },
      );
      await wait(150);
      let settled = false;
      const running = exportPdf(orderId, invoiceId).finally(() => {
        settled = true;
      });
      await wait(300);
      expect(settled).toBe(false);
      release();
      await holder;

      const result = await running;
      expect(result).toEqual({
        fileName: 'hoa-don-holder.pdf',
        pdfSize: 7,
        exportedAt: holderRow.createdAt,
      });
      expect(renderPdf).toHaveBeenCalledTimes(0);
      expect(await prisma.invoicePdf.count({ where: { invoiceId } })).toBe(1);
      expect(await pdfAudits(orderId)).toBe(0);
    });
  });
});
