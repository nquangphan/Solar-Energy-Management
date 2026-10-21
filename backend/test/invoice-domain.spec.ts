import {
  INVOICE_BLOCKED_MESSAGE,
  INVOICE_ORDER_STATUSES,
  invoiceBlocker,
} from '../src/invoices/domain/invoice-eligibility';
import { InvoiceCreated } from '../src/invoices/domain/invoice-events';
import { formatInvoiceNo } from '../src/invoices/domain/invoice-number';
import { buildInvoiceSnapshot } from '../src/invoices/domain/invoice-snapshot';
import { lineAmount } from '../src/orders/domain/line-amount';
import {
  ORDER_STATUS_KEYS,
  TRANG_THAI_BAO_GIA,
  TRANG_THAI_CHO_DUYET,
  TRANG_THAI_DANG_GIAO,
  TRANG_THAI_DA_CHOT,
  TRANG_THAI_DA_COC,
  TRANG_THAI_DA_GIAO,
  TRANG_THAI_HOAN_THANH,
  TRANG_THAI_HUY,
  TRANG_THAI_NGHIEM_THU,
  TRANG_THAI_THI_CONG,
} from '../src/orders/domain/order-status';
import { resolveOrderTotals } from '../src/orders/domain/order-totals';

const SELLER = {
  legalName: 'Công ty TNHH Phương Nam Solar',
  taxCode: '0312345678',
  address: '12 Nguyễn Huệ, Q.1',
  representative: 'Trần Văn A',
  representativeTitle: 'Giám đốc',
  phone: '0281234567',
  bankAccount: '0071000123456 Vietcombank',
};

/** The mockup order: 4 lines, subtotal 76.862.000 (amounts from the ONE line formula). */
const MOCKUP_LINES = [
  { name: 'Tấm pin 580W', unit: 'Tấm', qty: 18, unitPrice: 2_650_000 },
  { name: 'Biến tần 10kW', unit: 'Bộ', qty: 1, unitPrice: 18_500_000 },
  { name: 'Khung nhôm', unit: 'Bộ', qty: 1, unitPrice: 6_862_000 },
  { name: 'Nhân công lắp đặt', unit: 'Gói', qty: 1, unitPrice: 3_800_000 },
].map((line, index) => ({
  ...line,
  displayOrder: index,
  amount: lineAmount(line.unitPrice, line.qty),
}));

function resolvedFor(
  lines: ReadonlyArray<{ unitPrice: number; qty: number }>,
  version: {
    vatRate: number | null;
    vatMode: string | null;
    discountAmount: number | null;
  },
) {
  return resolveOrderTotals({
    lines,
    version,
    order: { status: TRANG_THAI_DA_CHOT, vatMode: null, discount: null },
    fallbackVatRate: 10,
  });
}

const CUSTOMER = {
  sdt: '+84901234567',
  name: 'VP Công Chứng Lê Đình Thao',
  taxCode: '0316552018',
  address: '45 Lê Lợi',
};

describe('invoice domain', () => {
  describe('invoiceBlocker — the overview and the POST share it', () => {
    it('the status set is built from the TRANG_THAI_* constants: confirmed and not cancelled', () => {
      expect([...INVOICE_ORDER_STATUSES].sort()).toEqual(
        [
          TRANG_THAI_DA_CHOT,
          TRANG_THAI_DA_COC,
          TRANG_THAI_THI_CONG,
          TRANG_THAI_NGHIEM_THU,
          TRANG_THAI_DANG_GIAO,
          TRANG_THAI_DA_GIAO,
          TRANG_THAI_HOAN_THANH,
        ].sort(),
      );
      // Every status is either invoiceable or one of the three live/cancelled ones.
      const refused = ORDER_STATUS_KEYS.filter(
        (s) => !INVOICE_ORDER_STATUSES.has(s),
      );
      expect([...refused].sort()).toEqual(
        [TRANG_THAI_BAO_GIA, TRANG_THAI_CHO_DUYET, TRANG_THAI_HUY].sort(),
      );
    });

    it.each([TRANG_THAI_BAO_GIA, TRANG_THAI_CHO_DUYET, TRANG_THAI_HUY])(
      '%s ⇒ 409 status message',
      (status) => {
        expect(invoiceBlocker({ status, lineCount: 4 })).toEqual({
          status: 409,
          message: INVOICE_BLOCKED_MESSAGE.status,
        });
      },
    );

    it('confirmed with 0 lines ⇒ 400 no-lines message', () => {
      expect(
        invoiceBlocker({ status: TRANG_THAI_DA_CHOT, lineCount: 0 }),
      ).toEqual({ status: 400, message: INVOICE_BLOCKED_MESSAGE.noLines });
    });

    it('status is checked BEFORE lines: a quote with 0 lines is a 409', () => {
      expect(
        invoiceBlocker({ status: TRANG_THAI_BAO_GIA, lineCount: 0 })?.status,
      ).toBe(409);
    });

    it.each([...INVOICE_ORDER_STATUSES])(
      '%s with lines ⇒ creatable',
      (status) => {
        expect(invoiceBlocker({ status, lineCount: 1 })).toBeNull();
      },
    );

    it('messages are the exact Vietnamese strings the clients show', () => {
      expect(INVOICE_BLOCKED_MESSAGE).toEqual({
        status: 'Chỉ tạo hoá đơn khi đơn đã chốt và chưa huỷ.',
        noLines: 'Đơn chưa có dòng vật tư — không tạo hoá đơn được.',
      });
    });
  });

  describe('formatInvoiceNo — HD-yyyy-NNNN, year in UTC+7', () => {
    it('mockup number', () => {
      expect(formatInvoiceNo(731, new Date('2026-07-06T03:00:00Z'))).toBe(
        'HD-2026-0731',
      );
    });

    it('31/12 17:30 UTC is already next year in Vietnam', () => {
      expect(formatInvoiceNo(7, new Date('2026-12-31T17:30:00Z'))).toBe(
        'HD-2027-0007',
      );
    });

    it('31/12 16:59:59 UTC is still this year', () => {
      expect(formatInvoiceNo(7, new Date('2026-12-31T16:59:59Z'))).toBe(
        'HD-2026-0007',
      );
    });

    it('padding is a minimum, not a width limit', () => {
      expect(formatInvoiceNo(12345, new Date('2026-07-06T03:00:00Z'))).toBe(
        'HD-2026-12345',
      );
      expect(formatInvoiceNo(1, new Date('2026-07-06T03:00:00Z'))).toMatch(
        /^HD-\d{4}-\d{4,}$/,
      );
    });
  });

  describe('buildInvoiceSnapshot — copies, never recomputes', () => {
    it('mockup order: totals are exactly the resolver output, lines exactly the order lines', () => {
      const resolved = resolvedFor(MOCKUP_LINES, {
        vatRate: 8,
        vatMode: 'co_vat',
        discountAmount: null,
      });

      const snapshot = buildInvoiceSnapshot({
        customer: CUSTOMER,
        seller: SELLER,
        lines: MOCKUP_LINES,
        resolved,
      });

      expect(snapshot).toEqual({
        customerSdt: CUSTOMER.sdt,
        customerName: CUSTOMER.name,
        customerTaxCode: CUSTOMER.taxCode,
        customerAddress: CUSTOMER.address,
        seller: SELLER,
        vatRate: 8,
        applyVat: true,
        subtotal: resolved.totals.subtotal,
        discountAmount: resolved.totals.discountAmount,
        vatAmount: resolved.totals.vatAmount,
        total: resolved.totals.total,
        lines: MOCKUP_LINES.map((line) => ({
          displayOrder: line.displayOrder,
          name: line.name,
          unit: line.unit,
          qty: line.qty,
          unitPrice: line.unitPrice,
          amount: line.amount,
        })),
      });
      // The resolver, run for real, gives the mockup numbers.
      expect(snapshot.subtotal).toBe(76_862_000);
      expect(snapshot.vatAmount).toBe(6_148_960);
      expect(snapshot.total).toBe(83_010_960);
    });

    it('approved discount: discountAmount is the version snapshot and total = subtotal − discount + VAT', () => {
      const resolved = resolvedFor(MOCKUP_LINES, {
        vatRate: 8,
        vatMode: 'co_vat',
        discountAmount: 2_000_000,
      });

      const snapshot = buildInvoiceSnapshot({
        customer: CUSTOMER,
        seller: SELLER,
        lines: MOCKUP_LINES,
        resolved,
      });

      expect(snapshot.discountAmount).toBe(2_000_000);
      expect(snapshot.total).toBe(resolved.totals.total);
      expect(snapshot.total).toBe(
        snapshot.subtotal - snapshot.discountAmount + snapshot.vatAmount,
      );
    });

    it('no VAT: vatAmount 0, the rate is still stored for the printed label', () => {
      const resolved = resolvedFor(MOCKUP_LINES, {
        vatRate: 8,
        vatMode: 'khong_vat',
        discountAmount: null,
      });

      const snapshot = buildInvoiceSnapshot({
        customer: { ...CUSTOMER, taxCode: null, address: null },
        seller: SELLER,
        lines: MOCKUP_LINES,
        resolved,
      });

      expect(snapshot.applyVat).toBe(false);
      expect(snapshot.vatAmount).toBe(0);
      expect(snapshot.vatRate).toBe(8);
      expect(snapshot.total).toBe(snapshot.subtotal);
      expect(snapshot.customerTaxCode).toBeNull();
    });

    it('lines that do not add up to the subtotal ⇒ throws (a pricing bug is never stored)', () => {
      const resolved = resolvedFor(MOCKUP_LINES, {
        vatRate: 8,
        vatMode: 'co_vat',
        discountAmount: null,
      });
      const lines = MOCKUP_LINES.map((line, index) =>
        index === 0 ? { ...line, amount: line.amount + 1 } : line,
      );

      expect(() =>
        buildInvoiceSnapshot({
          customer: CUSTOMER,
          seller: SELLER,
          lines,
          resolved,
        }),
      ).toThrow(/add up/);
    });

    it('renumbers displayOrder 0..n-1 in display order, even with gaps', () => {
      const lines = [
        { ...MOCKUP_LINES[1], displayOrder: 7 },
        { ...MOCKUP_LINES[0], displayOrder: 2 },
      ];
      const resolved = resolvedFor(lines, {
        vatRate: 8,
        vatMode: 'co_vat',
        discountAmount: null,
      });

      const snapshot = buildInvoiceSnapshot({
        customer: CUSTOMER,
        seller: SELLER,
        lines,
        resolved,
      });

      expect(snapshot.lines.map((l) => [l.displayOrder, l.name])).toEqual([
        [0, MOCKUP_LINES[0].name],
        [1, MOCKUP_LINES[1].name],
      ]);
    });

    it('the seller is a copy: changing the source afterwards does not change the snapshot', () => {
      const seller = { ...SELLER };
      const snapshot = buildInvoiceSnapshot({
        customer: CUSTOMER,
        seller,
        lines: MOCKUP_LINES,
        resolved: resolvedFor(MOCKUP_LINES, {
          vatRate: 8,
          vatMode: 'co_vat',
          discountAmount: null,
        }),
      });
      (seller as { legalName: string }).legalName = 'Đổi tên';

      expect(snapshot.seller.legalName).toBe(SELLER.legalName);
    });
  });

  describe('InvoiceCreated', () => {
    it('targets the order, carries only document identifiers and a number total', () => {
      const at = new Date('2026-10-22T03:00:00Z');
      const event = new InvoiceCreated(
        'acc-1',
        'order-1',
        {
          invoiceId: 'inv-1',
          invoiceNo: 'HD-2026-0001',
          orderVersionId: 'v-1',
          total: 83_010_960,
        },
        at,
      );

      expect(event.type).toBe('InvoiceCreated');
      expect(event.target).toEqual({ type: 'Order', id: 'order-1' });
      expect(event.actorAccountId).toBe('acc-1');
      expect(event.occurredAt).toBe(at);
      expect(event.after).toEqual({
        invoiceId: 'inv-1',
        invoiceNo: 'HD-2026-0001',
        orderVersionId: 'v-1',
        total: 83_010_960,
      });
      expect(() => JSON.stringify(event)).not.toThrow();
    });
  });
});
