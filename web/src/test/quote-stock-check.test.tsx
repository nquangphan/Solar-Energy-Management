// Behaviour of the quote screen's early stock warning on JSDOM: per-line hint
// labels picked from the backend's `status`, one warn banner sentence per short
// product, "Chốt" never gated by stock, a failed read only hides the hints, and
// an answer for older lines never overwrites a newer one.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_KEYS } from '../design-system/gating/permission-keys.generated';
import {
  DEMO_ME,
  FakeCatalogPort,
  FakeCustomersPort,
  FakeMePort,
  FakeOrdersPort,
  PermissionsProvider,
} from '../design-system/session';
import type { Order, OrderStockCheck } from '../design-system/session/orders-port';
import { CreateQuoteScreen } from '../screens/orders/CreateQuoteScreen';

const ME = new FakeMePort({ ...DEMO_ME, permissions: Object.values(PERMISSION_KEYS).sort() });
const SHORT_SENTENCE =
  'Inverter Hybrid 8kW — Còn 1 · Đã hứa 1 · Cần nhập 1. Vẫn chốt đơn được; chặn nằm ở khâu xuất kho.';

afterEach(() => cleanup());

/** A draft quote: one enough product, one short product, one free-text line. */
async function seeded(port: FakeOrdersPort): Promise<Order> {
  const order = await port.create({ customerPhone: '+84903176968' });
  await port.addLine(order.id, { productId: 'prod-pin-580', qty: 2 });
  await port.addLine(order.id, { productId: 'prod-inverter-8k', qty: 1 });
  await port.addLine(order.id, { name: 'Phí khảo sát', unit: 'lần', qty: 1, unitPrice: 500_000 });
  const fetched = await port.get(order.id);
  // The screen creates its order from the customer pick — hand it the seeded one.
  vi.spyOn(port, 'create').mockResolvedValue(fetched);
  return fetched;
}

async function openQuote(port: FakeOrdersPort) {
  render(
    <PermissionsProvider port={ME}>
      <CreateQuoteScreen
        ordersPort={port}
        catalogPort={new FakeCatalogPort()}
        customersPort={new FakeCustomersPort()}
      />
    </PermissionsProvider>,
  );
  fireEvent.change(await screen.findByLabelText('SĐT'), { target: { value: '0903176968' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
  fireEvent.click(await screen.findByText('Dùng khách này'));
  await screen.findByText('Phí khảo sát');
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr')!;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('Quote — early stock warning', () => {
  it('labels: enough ⇒ "Kho còn {available}", short ⇒ "Cần nhập {shortfall}", free-text line ⇒ no label; one warn sentence per short product', async () => {
    const port = new FakeOrdersPort();
    await seeded(port);
    await openQuote(port);

    expect(await within(rowOf('Tấm pin JA Solar 580W')).findByText('Kho còn 42')).toBeTruthy();
    const shortLabel = within(rowOf('Inverter Hybrid 8kW')).getByText('Cần nhập 1');
    expect(shortLabel.className).toContain('stock-hint--short');
    expect(rowOf('Phí khảo sát').textContent).not.toMatch(/Kho còn|Cần nhập/);
    expect(screen.getByText(SHORT_SENTENCE)).toBeTruthy();
    expect(screen.getAllByText(/Vẫn chốt đơn được/)).toHaveLength(1);
  });

  it('"Chốt báo giá" stays enabled while a product is short and goes through confirmOrder', async () => {
    const port = new FakeOrdersPort();
    await seeded(port);
    const confirm = vi.spyOn(port, 'confirmOrder');
    await openQuote(port);
    await screen.findByText(SHORT_SENTENCE);

    const chot = screen.getByRole('button', { name: 'Chốt báo giá' }) as HTMLButtonElement;
    expect(chot.disabled).toBe(false);
    fireEvent.click(chot);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận' }));

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  });

  it('stock read fails ⇒ no hints, no warn banner, NO error banner; the cart is untouched', async () => {
    const port = new FakeOrdersPort();
    await seeded(port);
    vi.spyOn(port, 'getStockCheck').mockRejectedValue({ code: 'FORBIDDEN', message: 'Không có quyền.' });
    await openQuote(port);

    await vi.waitFor(() => expect(port.getStockCheck).toHaveBeenCalled());
    expect(screen.queryByText(/Kho còn|Cần nhập/)).toBeNull();
    expect(screen.queryByText(/Vẫn chốt đơn được/)).toBeNull();
    expect(screen.queryByText('Không có quyền.')).toBeNull();
    expect(screen.getByText('Tấm pin JA Solar 580W')).toBeTruthy();
    expect(screen.getByText('Inverter Hybrid 8kW')).toBeTruthy();
    expect(screen.getByText('Phí khảo sát')).toBeTruthy();
  });

  it('removing the short line re-reads stock ⇒ its label and the warn banner go away, the enough label stays', async () => {
    const port = new FakeOrdersPort();
    await seeded(port);
    const check = vi.spyOn(port, 'getStockCheck');
    await openQuote(port);
    await screen.findByText(SHORT_SENTENCE);
    const callsBefore = check.mock.calls.length;

    fireEvent.click(within(rowOf('Inverter Hybrid 8kW')).getByRole('button', { name: 'Xoá dòng' }));

    await vi.waitFor(() => expect(screen.queryByText('Inverter Hybrid 8kW')).toBeNull());
    await vi.waitFor(() => expect(check.mock.calls.length).toBeGreaterThan(callsBefore));
    await vi.waitFor(() => expect(screen.queryByText(/Vẫn chốt đơn được/)).toBeNull());
    expect(screen.queryByText(/Cần nhập/)).toBeNull();
    expect(within(rowOf('Tấm pin JA Solar 580W')).getByText('Kho còn 42')).toBeTruthy();
  });

  it('an answer for older lines is dropped when the lines changed meanwhile', async () => {
    const port = new FakeOrdersPort();
    await seeded(port);
    const older = deferred<OrderStockCheck>();
    const newer = deferred<OrderStockCheck>();
    vi.spyOn(port, 'getStockCheck')
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await openQuote(port);

    // A qty edit re-reads the lines ⇒ a second stock read.
    const qty = within(rowOf('Tấm pin JA Solar 580W')).getByLabelText('Số lượng');
    fireEvent.change(qty, { target: { value: '3' } });
    await vi.waitFor(() => expect(port.getStockCheck).toHaveBeenCalledTimes(2));

    newer.resolve({
      lines: [
        {
          productId: 'prod-pin-580',
          name: 'Tấm pin JA Solar 580W',
          unit: 'tấm',
          qty: 3,
          onHand: 7,
          reserved: 0,
          available: 7,
          shortfall: 0,
          status: 'enough',
        },
      ],
    });
    expect(await screen.findByText('Kho còn 7')).toBeTruthy();
    older.resolve({
      lines: [
        {
          productId: 'prod-pin-580',
          name: 'Tấm pin JA Solar 580W',
          unit: 'tấm',
          qty: 2,
          onHand: 0,
          reserved: 0,
          available: 0,
          shortfall: 2,
          status: 'short',
        },
      ],
    });
    await older.promise;
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText('Kho còn 7')).toBeTruthy();
    expect(screen.queryByText('Cần nhập 2')).toBeNull();
  });
});

describe('Quote — field errors', () => {
  it('two messages on the same field: the FIRST one shows under it (same rule as mobile)', async () => {
    const port = new FakeOrdersPort();
    await seeded(port);
    await openQuote(port);
    vi.spyOn(port, 'addLine').mockRejectedValue({
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ',
      fieldErrors: [
        { field: 'unit', message: 'Đơn vị không được để trống.' },
        { field: 'unit', message: 'Tối đa 20 ký tự.' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dòng tự do' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dòng' }));
    expect(await screen.findByText('Đơn vị không được để trống.')).toBeTruthy();
    expect(screen.queryByText('Tối đa 20 ký tự.')).toBeNull();
  });
});
