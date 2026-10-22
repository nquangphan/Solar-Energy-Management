// Behaviour of the order-bound stock issue on JSDOM — what the smoke
// render does not measure: the "Đã giao" step shows the preview table and
// relabels its button; an issued order shows its voucher code; a 409 shows the
// backend's message + the row error under EXACTLY the row it names; the detail
// screen's "Xuất kho" button is double-submit safe; the voucher screen's
// order-bound detail.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_KEYS } from '../design-system/gating/permission-keys.generated';
import {
  DEMO_ME,
  FakeInventoryPort,
  FakeMePort,
  FakeOrdersPort,
  FakeStockVouchersPort,
  PermissionsProvider,
} from '../design-system/session';
import {
  FAKE_CLOSE_BEFORE_ISSUE_ERROR,
  FAKE_ORDER_ISSUED,
  FAKE_ORDER_SHORT_STOCK,
  FAKE_STOCK_ISSUE_SHORT_ERROR,
} from '../design-system/session/fake-orders-port';
import type {
  OrderLifecycle,
  OrderStockIssueResult,
  OrderStockIssueView,
  StatusChangeResult,
} from '../design-system/session/orders-port';
import { StockVouchersScreen } from '../screens/inventory/StockVouchersScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { OrderStatusChangeScreen } from '../screens/orders/OrderStatusChangeScreen';

const ALL_PERMS = Object.values(PERMISSION_KEYS).sort();
const LONGEST_NAME = 'Inverter Hybrid Solplanet ASW10K-LT-G2 Pro 3 pha';

function renderScreen(node: ReactNode, permissions: string[] = ALL_PERMS) {
  const me = new FakeMePort({ ...DEMO_ME, permissions });
  return render(<PermissionsProvider port={me}>{node}</PermissionsProvider>);
}

/** Fake order at `danggiao`: the only next step is "Đã giao" (preselected). */
class InDeliveryPort extends FakeOrdersPort {
  override getLifecycle(): Promise<OrderLifecycle> {
    return Promise.resolve({
      steps: [
        { status: 'danggiao', progress: 'current' },
        { status: 'dagiao', progress: 'upcoming' },
      ],
      nextSteps: [{ event: 'xong_giao', to: 'dagiao', requires: 'delivery.confirm' }],
      canCancel: false,
    });
  }
}

afterEach(() => cleanup());

/**
 * The race the server still guards: the FIRST preview read saw enough stock
 * (stale), the click then hits a 409. Later reads are the real (blocked) ones.
 */
async function stalePreviewThenReal(port: FakeOrdersPort, orderId: string) {
  const real = await port.getStockIssue(orderId);
  const stale: OrderStockIssueView = {
    ...real,
    blocked: false,
    lines: real.lines.map((l) => ({ ...l, shortfall: 0 })),
  };
  return vi.spyOn(port, 'getStockIssue').mockResolvedValueOnce(stale).mockResolvedValue(real);
}

const BLOCKED_SENTENCE =
  'CHẶN xuất kho — Battery LiFePO4 10kWh không đủ tồn thật (cần 2, còn 0). Đơn này đã được chốt dù thiếu hàng; chặn chỉ nằm ở đây. Nhập hàng trước khi xuất.';

describe('Status change — "Đã giao" issues stock', () => {
  it('shows the preview (LONGEST name, Đơn cần, Tồn thật), the untracked row and the notecard; relabels the button', async () => {
    renderScreen(<OrderStatusChangeScreen port={new InDeliveryPort()} orderId="ord-x" />);

    expect(await screen.findByText(LONGEST_NAME)).toBeTruthy();
    expect(screen.getByText('Đơn cần')).toBeTruthy();
    expect(screen.getByText('Tồn thật')).toBeTruthy();
    expect(screen.getByText('Công lắp đặt')).toBeTruthy();
    expect(screen.getByText('Không theo kho — không có trong phiếu xuất')).toBeTruthy();
    expect(screen.getByText('lần duy nhất')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Xác nhận xuất kho & chuyển Đã giao' }),
    ).toBeTruthy();
  });

  it('issued order ⇒ "Đã xuất kho · code", no table, button keeps "Xác nhận chuyển"', async () => {
    renderScreen(<OrderStatusChangeScreen port={new InDeliveryPort()} orderId={FAKE_ORDER_ISSUED} />);

    expect(await screen.findByText('Đã xuất kho · PK-X-0095')).toBeTruthy();
    expect(screen.queryByText('Đơn cần')).toBeNull();
    expect(screen.getByRole('button', { name: 'Xác nhận chuyển' })).toBeTruthy();
  });

  it('preview blocked ⇒ the CHẶN banner (one sentence per short line), "Thiếu N unit" under that row only, the confirm button LOCKED and never reaching the port', async () => {
    const port = new InDeliveryPort();
    const transition = vi.spyOn(port, 'transition');
    renderScreen(<OrderStatusChangeScreen port={port} orderId={FAKE_ORDER_SHORT_STOCK} />);

    const button = (await screen.findByRole('button', {
      name: 'Xác nhận xuất kho & chuyển Đã giao',
    })) as HTMLButtonElement;
    expect(screen.getByText(BLOCKED_SENTENCE)).toBeTruthy();
    expect(screen.getAllByText(/^CHẶN xuất kho/)).toHaveLength(1);
    const shortRow = screen.getByText('Battery LiFePO4 10kWh').closest('tr')!;
    expect(shortRow.nextElementSibling?.textContent).toBe('Thiếu 2 bình');
    const otherRow = screen.getByText(LONGEST_NAME).closest('tr')!;
    expect(otherRow.nextElementSibling?.textContent ?? '').not.toContain('Thiếu');
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(transition).not.toHaveBeenCalled();
  });

  it('preview not blocked ⇒ no CHẶN banner, no "Thiếu" row, button usable', async () => {
    renderScreen(<OrderStatusChangeScreen port={new InDeliveryPort()} orderId="ord-x" />);

    const button = (await screen.findByRole('button', {
      name: 'Xác nhận xuất kho & chuyển Đã giao',
    })) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(screen.queryByText(/CHẶN xuất kho/)).toBeNull();
    expect(screen.queryByText(/^Thiếu /)).toBeNull();
  });

  it('409 short stock ⇒ banner with the backend message + error right under row `lines.0`', async () => {
    const port = new InDeliveryPort();
    await stalePreviewThenReal(port, FAKE_ORDER_SHORT_STOCK);
    vi.spyOn(port, 'transition').mockRejectedValue(FAKE_STOCK_ISSUE_SHORT_ERROR);
    renderScreen(<OrderStatusChangeScreen port={port} orderId={FAKE_ORDER_SHORT_STOCK} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Xác nhận xuất kho & chuyển Đã giao' }),
    );

    expect(
      await screen.findByText('Không đủ tồn — không thể xuất quá số tồn hiện có.'),
    ).toBeTruthy();
    const shortRow = screen.getByText('Battery LiFePO4 10kWh').closest('tr')!;
    expect(shortRow.nextElementSibling?.textContent).toBe('Còn 0 bình, không xuất được 2.');
    const otherRow = screen.getByText(LONGEST_NAME).closest('tr')!;
    expect(otherRow.nextElementSibling?.textContent).not.toContain('không xuất được');
  });

  it('a successful confirm goes through transition — the screen never calls issueStock itself', async () => {
    const port = new InDeliveryPort();
    const transition = vi
      .spyOn(port, 'transition')
      .mockResolvedValue({ status: 'dagiao', occurredAt: '', savedAttachmentCount: 0 } as StatusChangeResult);
    const issue = vi.spyOn(port, 'issueStock');
    const onDone = vi.fn();
    renderScreen(<OrderStatusChangeScreen port={port} orderId="ord-x" onDone={onDone} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Xác nhận xuất kho & chuyển Đã giao' }),
    );

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('dagiao'));
    expect(transition).toHaveBeenCalledTimes(1);
    expect(issue).not.toHaveBeenCalled();
  });
});

/** Fake order at `dacoc` without Vận chuyển: two open steps, nothing preselected. */
class TwoStepPort extends FakeOrdersPort {
  override getLifecycle(): Promise<OrderLifecycle> {
    return Promise.resolve({
      steps: [],
      nextSteps: [
        { event: 'bat_dau_thi_cong', to: 'thicong', requires: 'construction.transition' },
        { event: 'xong_giao', to: 'dagiao', requires: 'delivery.confirm' },
      ],
      canCancel: false,
    });
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Status change — the "Đã giao" preview gates the button', () => {
  it('button disabled while the preview loads, then relabelled and enabled', async () => {
    const port = new InDeliveryPort();
    const real = await port.getStockIssue('ord-x');
    const pending = deferred<OrderStockIssueView>();
    vi.spyOn(port, 'getStockIssue').mockReturnValue(pending.promise);
    renderScreen(<OrderStatusChangeScreen port={port} orderId="ord-x" />);

    const button = (await screen.findByRole('button', {
      name: 'Xác nhận chuyển',
    })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    pending.resolve(real);
    const relabelled = (await screen.findByRole('button', {
      name: 'Xác nhận xuất kho & chuyển Đã giao',
    })) as HTMLButtonElement;
    expect(relabelled.disabled).toBe(false);
  });

  it('preview read fails ⇒ an error with "Thử lại", button stays disabled; retry loads it', async () => {
    const port = new InDeliveryPort();
    const real = await port.getStockIssue('ord-x');
    const read = vi
      .spyOn(port, 'getStockIssue')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(real);
    renderScreen(<OrderStatusChangeScreen port={port} orderId="ord-x" />);

    expect(await screen.findByText('Không tải được phiếu xuất kho.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Xác nhận chuyển' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }));

    expect(await screen.findByText(LONGEST_NAME)).toBeTruthy();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('a late preview for a step the user already left is dropped', async () => {
    const port = new TwoStepPort();
    const real = await port.getStockIssue('ord-x');
    const pending = deferred<OrderStockIssueView>();
    vi.spyOn(port, 'getStockIssue').mockReturnValue(pending.promise);
    renderScreen(<OrderStatusChangeScreen port={port} orderId="ord-x" />);

    fireEvent.click(await screen.findByDisplayValue('xong_giao'));
    fireEvent.click(screen.getByDisplayValue('bat_dau_thi_cong'));
    pending.resolve(real);
    await pending.promise;

    await vi.waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Xác nhận chuyển' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.queryByText(LONGEST_NAME)).toBeNull();
    expect(screen.queryByText('Đơn cần')).toBeNull();
  });

  it('a 409 re-reads the preview (current numbers next to the row messages); a new step clears the banner', async () => {
    const port = new TwoStepPort();
    vi.spyOn(port, 'transition').mockRejectedValue(FAKE_STOCK_ISSUE_SHORT_ERROR);
    const read = await stalePreviewThenReal(port, FAKE_ORDER_SHORT_STOCK);
    renderScreen(<OrderStatusChangeScreen port={port} orderId={FAKE_ORDER_SHORT_STOCK} />);

    fireEvent.click(await screen.findByDisplayValue('xong_giao'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xác nhận xuất kho & chuyển Đã giao' }),
    );

    expect(await screen.findByRole('alert')).toBeTruthy();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Còn 0 bình, không xuất được 2.')).toBeTruthy();

    fireEvent.click(screen.getByDisplayValue('bat_dau_thi_cong'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Order detail — Phiếu xuất', () => {
  /** A confirmed order — a status the backend issues stock from. */
  async function seeded(port: FakeOrdersPort) {
    const order = await port.create({ customerPhone: '+84903176968' });
    await port.addLine(order.id, { productId: 'prod-pin-580', qty: 2 });
    await port.confirmOrder(order.id);
    return order;
  }

  it('not issued + canIssue ⇒ "Xuất kho" opens the preview Sheet; a double tap reaches the port once; success shows the voucher code', async () => {
    const port = new FakeOrdersPort();
    const order = await seeded(port);
    let release!: (r: OrderStockIssueResult) => void;
    const original = port.issueStock.bind(port);
    const spy = vi.spyOn(port, 'issueStock').mockImplementation(
      (id) =>
        new Promise((resolve) => {
          release = resolve;
          void original(id);
        }),
    );
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xuất kho' }));
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText(LONGEST_NAME)).toBeTruthy();
    const confirm = sheet.getByRole('button', { name: 'Xác nhận xuất kho' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    release({ voucher: (await port.getStockIssue(order.id)).voucher! });
    expect(await screen.findByText('PK-X-0097')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xuất kho' })).toBeNull();
  });

  it('409 short stock in the Sheet ⇒ backend message + row error under the row it names; button usable again', async () => {
    const port = new FakeOrdersPort();
    const order = await seeded(port);
    const spy = vi.spyOn(port, 'issueStock').mockRejectedValue(FAKE_STOCK_ISSUE_SHORT_ERROR);
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xuất kho' }));
    const sheet = within(await screen.findByRole('dialog'));
    fireEvent.click(sheet.getByRole('button', { name: 'Xác nhận xuất kho' }));

    expect(await sheet.findByText(FAKE_STOCK_ISSUE_SHORT_ERROR.message)).toBeTruthy();
    // `lines.0` is the FIRST row of the preview the backend sent (LONGEST name).
    const named = sheet.getByText(LONGEST_NAME).closest('tr')!;
    expect(named.nextElementSibling?.textContent).toBe('Còn 0 bình, không xuất được 2.');
    const other = sheet.getByText('Tấm pin AE 630W').closest('tr')!;
    expect(other.nextElementSibling?.textContent ?? '').not.toContain('không xuất được');
    const confirm = sheet.getByRole('button', { name: 'Xác nhận xuất kho' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it('preview blocked ⇒ the Sheet shows the CHẶN banner and a LOCKED "Xuất kho (bị chặn)"; the port is never called', async () => {
    const port = new FakeOrdersPort();
    const order = await seeded(port);
    const real = await port.getStockIssue(FAKE_ORDER_SHORT_STOCK);
    vi.spyOn(port, 'getStockIssue').mockResolvedValue(real);
    const issue = vi.spyOn(port, 'issueStock');
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xuất kho' }));
    const sheet = within(await screen.findByRole('dialog'));
    expect(sheet.getByText(BLOCKED_SENTENCE)).toBeTruthy();
    expect(sheet.queryByRole('button', { name: 'Xác nhận xuất kho' })).toBeNull();
    const locked = sheet.getByRole('button', {
      name: 'Xuất kho (bị chặn)',
    }) as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    fireEvent.click(locked);
    expect(issue).not.toHaveBeenCalled();
  });

  it('the Sheet cannot be dismissed while the issue is in flight', async () => {
    const port = new FakeOrdersPort();
    const order = await seeded(port);
    const pending = deferred<OrderStockIssueResult>();
    vi.spyOn(port, 'issueStock').mockReturnValue(pending.promise);
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xuất kho' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận xuất kho' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('dialog')).toBeTruthy();
    pending.reject(FAKE_STOCK_ISSUE_SHORT_ERROR);
    expect(await screen.findByText(FAKE_STOCK_ISSUE_SHORT_ERROR.message)).toBeTruthy();
  });

  it('issued ⇒ code + confirmer; voucher without unitCost ⇒ no cost column', async () => {
    const port = new FakeOrdersPort();
    const order = await seeded(port);
    await port.issueStock(order.id);
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);

    expect(await screen.findByText('PK-X-0097')).toBeTruthy();
    expect(screen.getByText(/Kho\/Giao hàng \(Bình\)/)).toBeTruthy();
    expect(screen.queryByText('Giá vốn / đv')).toBeNull();
  });

  it('cannot issue ⇒ one "Chưa xuất kho." line, no button', async () => {
    const port = new FakeOrdersPort();
    const order = await seeded(port);
    vi.spyOn(port, 'getStockIssue').mockResolvedValue({
      issued: false,
      canIssue: false,
      blocked: false,
      lines: [],
      untrackedItems: [],
    });
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);

    expect(await screen.findByText('Chưa xuất kho.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xuất kho' })).toBeNull();
  });

  it('neither inventory.manage nor delivery.confirm ⇒ no frame, no read', async () => {
    const port = new FakeOrdersPort();
    const order = await seeded(port);
    const read = vi.spyOn(port, 'getStockIssue');
    renderScreen(
      <OrderDetailScreen port={port} orderId={order.id} />,
      ALL_PERMS.filter(
        (k) => k !== PERMISSION_KEYS.inventoryManage && k !== PERMISSION_KEYS.deliveryConfirm,
      ),
    );

    expect(await screen.findByText('Vòng đời đơn')).toBeTruthy();
    expect(screen.queryByText('Phiếu xuất')).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});

describe('Equipment-only order at dachot — issue before the direct close', () => {
  async function confirmed(port: FakeOrdersPort) {
    const order = await port.create({ customerPhone: '+84903176968' });
    await port.addLine(order.id, { productId: 'prod-pin-580', qty: 2 });
    await port.confirmOrder(order.id);
    return order;
  }

  it('detail screen of a dachot order offers "Xuất kho" (the backend says canIssue)', async () => {
    const port = new FakeOrdersPort();
    const order = await confirmed(port);
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);

    expect(await screen.findByRole('button', { name: 'Xuất kho' })).toBeTruthy();
  });

  it('direct close before the stock-out ⇒ the backend message in a danger banner, onDone not called', async () => {
    const port = new FakeOrdersPort();
    const order = await confirmed(port);
    const onDone = vi.fn();
    renderScreen(<OrderStatusChangeScreen port={port} orderId={order.id} onDone={onDone} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận chuyển' }));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toBe(FAKE_CLOSE_BEFORE_ISSUE_ERROR.message);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('after the stock-out the same close goes through', async () => {
    const port = new FakeOrdersPort();
    const order = await confirmed(port);
    await port.issueStock(order.id);
    const onDone = vi.fn();
    renderScreen(<OrderStatusChangeScreen port={port} orderId={order.id} onDone={onDone} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận chuyển' }));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('hoanthanh'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Phiếu kho — order-bound voucher detail', () => {
  function openVoucher(code: string) {
    renderScreen(
      <StockVouchersScreen port={new FakeStockVouchersPort()} inventoryPort={new FakeInventoryPort()} />,
    );
    return screen.findByText(code).then((el) => fireEvent.click(el));
  }

  it('order-bound ⇒ "Xuất kho · gắn đơn", a Gắn đơn row, the Người xác nhận label, the one-order notecard', async () => {
    await openVoucher('PK-X-0095');

    expect(await screen.findByText('Xuất kho · gắn đơn')).toBeTruthy();
    expect(screen.getByText('Gắn đơn')).toBeTruthy();
    expect(screen.getByText(FAKE_ORDER_ISSUED)).toBeTruthy();
    expect(screen.getByText('Người xác nhận')).toBeTruthy();
    expect(screen.queryByText('Người tạo')).toBeNull();
    expect(screen.getByText('Một Đơn — một phiếu xuất.')).toBeTruthy();
  });

  it('free-standing ⇒ "Xuất kho · không gắn đơn", Người tạo, no Gắn đơn row', async () => {
    await openVoucher('PK-X-0096');

    expect(await screen.findByText('Xuất kho · không gắn đơn')).toBeTruthy();
    expect(screen.getByText('Người tạo')).toBeTruthy();
    expect(screen.queryByText('Gắn đơn')).toBeNull();
    expect(screen.queryByText('Người xác nhận')).toBeNull();
  });
});
