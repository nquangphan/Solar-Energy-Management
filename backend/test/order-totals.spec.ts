import { lineAmount } from '../src/orders/domain/line-amount';
import {
  VAT_RATE_MAC_DINH,
  computeOrderTotals,
} from '../src/orders/domain/order-totals';

/**
 * Unit test hàm pricing DUY NHẤT (AD-16) — thuần domain, không mock gì.
 *
 * Bất biến đắt nhất: (1) subtotal đi qua `lineAmount()` từng dòng rồi CỘNG; (2) VAT
 * round-half-up THUẦN INTEGER tại ĐÚNG MỘT điểm — grand-subtotal, không per-line;
 * (3) `applyVat=false` tắt sạch VAT. Số kỳ vọng tính TAY, không gọi lại hàm trong
 * assert (test tự chứng minh, không tautology).
 */
describe('computeOrderTotals (AD-10/AD-16)', () => {
  it('mảng rỗng ⇒ {0,0,0} — giỏ vừa xoá sạch vẫn có tổng hợp lệ', () => {
    expect(
      computeOrderTotals({ lines: [], vatRate: 8, applyVat: true }),
    ).toEqual({ subtotal: 0, vatAmount: 0, total: 0 });
  });

  it('nhiều dòng cộng dồn đúng qua lineAmount: 2_450_000×8 + 500_000×1, VAT 8%', () => {
    const result = computeOrderTotals({
      lines: [
        { unitPrice: 2_450_000, qty: 8 },
        { unitPrice: 500_000, qty: 1 },
      ],
      vatRate: 8,
      applyVat: true,
    });

    // 19_600_000 + 500_000 = 20_100_000; VAT 8% = 1_608_000 (chẵn, không làm tròn).
    expect(result).toEqual({
      subtotal: 20_100_000,
      vatAmount: 1_608_000,
      total: 21_708_000,
    });
    // subtotal của một dòng đơn lẻ phải trùng đúng lineAmount() — cùng seed 4.1.
    expect(
      computeOrderTotals({
        lines: [{ unitPrice: 2_450_000, qty: 8 }],
        vatRate: 8,
        applyVat: false,
      }).subtotal,
    ).toBe(lineAmount(2_450_000, 8));
  });

  it("half-up boundary: subtotal=1010, vatRate=5 ⇒ 50.5 làm tròn LÊN 51 (không banker's)", () => {
    // vatRate lẻ vì hàm nhận tham số — với rate 8 tích subtotal×8 luôn chẵn, không có
    // case .5 nào tồn tại để thử.
    const result = computeOrderTotals({
      lines: [{ unitPrice: 1010, qty: 1 }],
      vatRate: 5,
      applyVat: true,
    });

    expect(result.vatAmount).toBe(51);
    expect(result.total).toBe(1061);
  });

  it('half-up boundary DƯỚI: subtotal=1009, vatRate=5 ⇒ 50.45 làm tròn XUỐNG 50 (không ceiling)', () => {
    // Nửa còn lại của half-up: mọi case hiện hữu hoặc rơi ĐÚNG .5 hoặc tròn/chẵn,
    // nên mutant biến công thức thành CEILING (vd `+ 50` → `+ 99`) vẫn xanh hết —
    // case dưới-.5-phải-XUỐNG này là chốt chặn duy nhất của hướng đó.
    const result = computeOrderTotals({
      lines: [{ unitPrice: 1009, qty: 1 }],
      vatRate: 5,
      applyVat: true,
    });

    expect(result.vatAmount).toBe(50);
    expect(result.total).toBe(1059);
  });

  it('applyVat=false ⇒ vatAmount 0, total = subtotal', () => {
    const result = computeOrderTotals({
      lines: [{ unitPrice: 1010, qty: 3 }],
      vatRate: 5,
      applyVat: false,
    });

    expect(result).toEqual({ subtotal: 3030, vatAmount: 0, total: 3030 });
  });

  it('MỘT điểm làm tròn — VAT tính trên GRAND-SUBTOTAL, không per-line', () => {
    // 3 dòng 333 + 333 + 333 = 999, rate 7:
    //   grand:    floor((999×7  + 50)/100) = floor(70.43) = 70
    //   per-line: 3 × floor((333×7 + 50)/100) = 3 × floor(23.81) = 3 × 23 = 69
    // Mutant đổi công thức sang per-line phải RED ở đây.
    const result = computeOrderTotals({
      lines: [
        { unitPrice: 333, qty: 1 },
        { unitPrice: 333, qty: 1 },
        { unitPrice: 333, qty: 1 },
      ],
      vatRate: 7,
      applyVat: true,
    });

    expect(result.subtotal).toBe(999);
    expect(result.vatAmount).toBe(70);
    expect(result.total).toBe(1069);
  });

  it('VAT_RATE_MAC_DINH = 8 (PRD FR-3 — thuế suất mặc định 8%)', () => {
    expect(VAT_RATE_MAC_DINH).toBe(8);
  });
});
