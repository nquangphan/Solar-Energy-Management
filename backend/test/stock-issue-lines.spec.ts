import { stockIssueLines } from '../src/inventory/domain/stock-issue-lines';

const PRODUCTS = new Map([
  ['p-b', { name: 'Tấm pin 550W', tracksStock: true }],
  ['p-a', { name: 'Inverter 8kW', tracksStock: true }],
  ['p-c', { name: 'Công lắp đặt', tracksStock: false }],
  ['p-d', { name: 'Inverter 8kW', tracksStock: true }],
]);

describe('stockIssueLines', () => {
  it('merges two lines of the same product into one, qty = sum', () => {
    expect(
      stockIssueLines(
        [
          { productId: 'p-b', qty: 10 },
          { productId: 'p-b', qty: 6 },
        ],
        PRODUCTS,
      ),
    ).toEqual([{ productId: 'p-b', name: 'Tấm pin 550W', qty: 16 }]);
  });

  it('drops free-text lines (productId null) and tracksStock=false products', () => {
    expect(
      stockIssueLines(
        [
          { productId: null, qty: 1 },
          { productId: 'p-c', qty: 1 },
          { productId: 'p-a', qty: 2 },
        ],
        PRODUCTS,
      ),
    ).toEqual([{ productId: 'p-a', name: 'Inverter 8kW', qty: 2 }]);
  });

  it('drops a product missing from the lookup (never guesses the flag)', () => {
    expect(stockIssueLines([{ productId: 'p-x', qty: 1 }], PRODUCTS)).toEqual(
      [],
    );
  });

  it('canonical order: name ascending, ties by productId', () => {
    expect(
      stockIssueLines(
        [
          { productId: 'p-b', qty: 1 },
          { productId: 'p-d', qty: 1 },
          { productId: 'p-a', qty: 1 },
        ],
        PRODUCTS,
      ).map((l) => l.productId),
    ).toEqual(['p-a', 'p-d', 'p-b']);
  });
});
