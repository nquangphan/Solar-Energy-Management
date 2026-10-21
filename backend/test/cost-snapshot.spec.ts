import { lineCostSnapshot } from '../src/orders/domain/cost-snapshot';

describe('lineCostSnapshot', () => {
  it('stock-tracked line ⇒ the product cost at issue time', () => {
    expect(lineCostSnapshot({ unitPriceSnapshot: 3_000_000 }, 2_088_000)).toBe(
      2_088_000,
    );
  });

  it('untracked line (installation, free-text, tracksStock=false) ⇒ selling price snapshot — zero margin', () => {
    expect(lineCostSnapshot({ unitPriceSnapshot: 1_500_000 }, undefined)).toBe(
      1_500_000,
    );
  });

  it('a cost of 0 is a real value, not "absent"', () => {
    expect(lineCostSnapshot({ unitPriceSnapshot: 1_500_000 }, 0)).toBe(0);
  });
});
