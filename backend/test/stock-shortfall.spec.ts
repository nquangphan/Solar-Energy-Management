import {
  issueShortfall,
  quoteStockLine,
} from '../src/inventory/domain/stock-shortfall';
import { StockOutBlocked } from '../src/inventory/domain/stock-out-blocked-event';

describe('issueShortfall', () => {
  it('is 0 exactly at the boundary qty === onHand', () => {
    expect(issueShortfall(5, 5)).toBe(0);
  });

  it('is qty − onHand when issuing beyond on-hand', () => {
    expect(issueShortfall(8, 5)).toBe(3);
  });

  it('is the whole qty when on-hand is 0', () => {
    expect(issueShortfall(4, 0)).toBe(4);
  });

  it('is never negative', () => {
    expect(issueShortfall(1, 10)).toBe(0);
  });
});

describe('quoteStockLine', () => {
  it('enough exactly at the boundary qty === available', () => {
    expect(quoteStockLine({ qty: 5, onHand: 7, reserved: 2 })).toEqual({
      available: 5,
      shortfall: 0,
      status: 'enough',
    });
  });

  it('short by qty − available', () => {
    expect(quoteStockLine({ qty: 6, onHand: 7, reserved: 2 })).toEqual({
      available: 5,
      shortfall: 1,
      status: 'short',
    });
  });

  it('on-hand 0 ⇒ the whole qty is short', () => {
    expect(quoteStockLine({ qty: 3, onHand: 0, reserved: 0 })).toEqual({
      available: 0,
      shortfall: 3,
      status: 'short',
    });
  });

  it('reserved beyond on-hand ⇒ negative available, shortfall = qty − available', () => {
    expect(quoteStockLine({ qty: 2, onHand: 1, reserved: 4 })).toEqual({
      available: -3,
      shortfall: 5,
      status: 'short',
    });
  });

  it('shortfall is never negative', () => {
    expect(quoteStockLine({ qty: 1, onHand: 50, reserved: 0 }).shortfall).toBe(
      0,
    );
  });
});

describe('StockOutBlocked', () => {
  const at = new Date('2026-10-21T00:00:00.000Z');

  it('order-bound: target is the order, after carries order + version + short lines', () => {
    const event = new StockOutBlocked(
      'acc-1',
      {
        orderId: 'ord-1',
        orderVersionId: 'ver-1',
        lines: [{ productId: 'p-1', qty: 5, onHand: 2 }],
      },
      at,
    );
    expect(event.type).toBe('StockOutBlocked');
    expect(event.actorAccountId).toBe('acc-1');
    expect(event.target).toEqual({ type: 'Order', id: 'ord-1' });
    expect(event.after).toEqual({
      orderId: 'ord-1',
      orderVersionId: 'ver-1',
      lines: [{ productId: 'p-1', qty: 5, onHand: 2 }],
    });
    expect(event.occurredAt).toBe(at);
  });

  it('free-standing voucher: no target, no orderId key', () => {
    const event = new StockOutBlocked(
      'acc-1',
      { lines: [{ productId: 'p-1', qty: 5, onHand: 2 }] },
      at,
    );
    expect(event.target).toBeUndefined();
    expect('orderId' in event.after).toBe(false);
  });
});
