// Behaviour of the Lịch thanh toán screen on JSDOM — what the smoke render does not
// measure: view / empty / mismatch states, the 20/70/10 template and the exact
// payload sent, blank inputs sent ABSENT (never 0) and a typed "0" sent as 0,
// field errors on the right row, 409 + reload, double-submit, the edit button
// gated by permission AND by the backend's `editable`, and the "Thanh toán"
// entry on the order detail screen.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_KEYS } from '../design-system/gating/permission-keys.generated';
import {
  DEMO_ME,
  DEMO_PAYMENT_SCHEDULE,
  DEMO_PAYMENT_SCHEDULE_EMPTY,
  DEMO_PAYMENT_SCHEDULE_MISMATCH,
  FakeMePort,
  FakeOrdersPort,
  FakePaymentsPort,
  PermissionsProvider,
} from '../design-system/session';
import type { PaymentSchedule } from '../design-system/session/payments-port';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { PaymentScheduleScreen } from '../screens/payments/PaymentScheduleScreen';

const ALL_PERMS = Object.values(PERMISSION_KEYS).sort();
const WITHOUT_PAYMENTS = ALL_PERMS.filter((k) => k !== PERMISSION_KEYS.paymentsRecord);

function renderScreen(node: ReactNode, permissions: string[] = ALL_PERMS) {
  const me = new FakeMePort({ ...DEMO_ME, permissions });
  return render(<PermissionsProvider port={me}>{node}</PermissionsProvider>);
}

function renderSchedule(port: FakePaymentsPort, permissions: string[] = ALL_PERMS) {
  return renderScreen(<PaymentScheduleScreen port={port} orderId="DH-2048" />, permissions);
}

/** All rendered text, whitespace-normalised (Money renders `83.010.960 đ` with a NBSP-free space). */
const pageText = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');

afterEach(() => cleanup());

describe('PaymentScheduleScreen — view', () => {
  it('renders every installment with the backend amounts, milestones and both totals', async () => {
    renderSchedule(new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE));
    expect(await screen.findByText('Đợt 1 · Cọc')).toBeTruthy();
    expect(screen.getByText('Đợt 2')).toBeTruthy();
    expect(screen.getByText('Đợt 3 · Tất toán')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
    for (const label of ['Đợt', 'Điều kiện', 'Tỉ lệ', 'Số tiền', 'Tổng lịch', 'Tổng đơn (sau VAT)']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const text = pageText();
    expect(text).toContain('16.602.192 đ');
    expect(text).toContain('58.107.672 đ');
    expect(text).toContain('8.301.096 đ');
    expect(text).toContain('83.010.960 đ');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(text).not.toContain('Ghi nhận');
  });

  it('an amount-typed installment shows — in the percent column', async () => {
    const schedule: PaymentSchedule = {
      ...DEMO_PAYMENT_SCHEDULE,
      installments: [{ ...DEMO_PAYMENT_SCHEDULE.installments[0], percent: null }],
    };
    renderSchedule(new FakePaymentsPort(schedule));
    expect(await screen.findByText('—')).toBeTruthy();
  });

  it('mismatch ⇒ warning banner carrying the backend difference', async () => {
    renderSchedule(new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE_MISMATCH));
    const banner = await screen.findByRole('alert');
    expect(banner.textContent?.replace(/\s+/g, ' ')).toContain(
      'Tổng các đợt lệch tổng đơn sau VAT 8.301.096 đ',
    );
    expect(pageText()).toContain('74.709.864 đ');
  });

  it('not configured ⇒ empty state + "Cấu hình lịch"', async () => {
    renderSchedule(new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE_EMPTY));
    expect(await screen.findByText('Đơn chưa có lịch thanh toán.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Cấu hình lịch' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('edit button hidden without payments.record (editable=true)', async () => {
    renderSchedule(new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE), WITHOUT_PAYMENTS);
    expect(await screen.findByText('Đợt 1 · Cọc')).toBeTruthy();
    // Let the permission session settle before asserting absence.
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Sửa lịch' })).toBeNull();
  });

  it('edit button hidden when the backend says editable=false (all permissions)', async () => {
    renderSchedule(new FakePaymentsPort({ ...DEMO_PAYMENT_SCHEDULE, editable: false }));
    expect(await screen.findByText('Đợt 1 · Cọc')).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Sửa lịch' })).toBeNull();
  });

  it('control: edit button present with permission and editable=true', async () => {
    renderSchedule(new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE));
    expect(await screen.findByRole('button', { name: 'Sửa lịch' })).toBeTruthy();
  });

  it('load failure ⇒ error state; "Thử lại" reloads the schedule', async () => {
    const port = new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE);
    const getSpy = vi.spyOn(port, 'getSchedule').mockRejectedValueOnce(new Error('network'));
    renderSchedule(port);
    expect(await screen.findByText('Không tải được lịch thanh toán.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Đợt 1 · Cọc')).toBeTruthy();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});

describe('PaymentScheduleScreen — edit', () => {
  async function openEditor(port: FakePaymentsPort) {
    renderSchedule(port);
    fireEvent.click(await screen.findByRole('button', { name: 'Cấu hình lịch' }));
  }

  const percentInputs = () => screen.queryAllByLabelText('Tỉ lệ (%)') as HTMLInputElement[];
  const noteInputs = () => screen.getAllByLabelText('Điều kiện') as HTMLInputElement[];

  it('template 20/70/10 + save sends exactly the typed percents, then shows the returned schedule', async () => {
    const port = new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE_EMPTY, DEMO_PAYMENT_SCHEDULE);
    await openEditor(port);
    fireEvent.click(screen.getByRole('button', { name: '20/70/10' }));
    expect(percentInputs().map((i) => i.value)).toEqual(['20', '70', '10']);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));

    expect(await screen.findByText('Đợt 3 · Tất toán')).toBeTruthy();
    expect(port.replaceCalls).toEqual([
      {
        installments: [
          { percent: 20, conditionNote: 'Cọc khi ký hợp đồng' },
          { percent: 70, conditionNote: 'Khi thi công' },
          { percent: 10, conditionNote: 'Khi nghiệm thu, bàn giao' },
        ],
      },
    ]);
  });

  it('a saved schedule that mismatches comes back with the warning banner', async () => {
    const port = new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE_EMPTY, DEMO_PAYMENT_SCHEDULE_MISMATCH);
    await openEditor(port);
    fireEvent.click(screen.getByRole('button', { name: '20/70/10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));
    const banner = await screen.findByRole('alert');
    expect(banner.textContent?.replace(/\s+/g, ' ')).toContain(
      'Tổng các đợt lệch tổng đơn sau VAT 8.301.096 đ',
    );
    expect(screen.queryByRole('button', { name: 'Lưu lịch' })).toBeNull();
  });

  it('"Tuỳ chỉnh" keeps the rows being edited', async () => {
    await openEditor(new FakePaymentsPort());
    fireEvent.click(screen.getByRole('button', { name: '20/70/10' }));
    fireEvent.change(percentInputs()[1], { target: { value: '65' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tuỳ chỉnh' }));
    expect(percentInputs().map((i) => i.value)).toEqual(['20', '65', '10']);
    expect(noteInputs().map((i) => i.value)).toEqual([
      'Cọc khi ký hợp đồng',
      'Khi thi công',
      'Khi nghiệm thu, bàn giao',
    ]);
  });

  it('the applied template is the pressed one; editing a row falls back to "Tuỳ chỉnh"', async () => {
    await openEditor(new FakePaymentsPort());
    const pressed = () =>
      screen
        .getAllByRole('button', { pressed: true })
        .map((b) => b.textContent)
        .filter((t) => ['20/70/10', '100%', 'Tuỳ chỉnh'].includes(t ?? ''));
    expect(pressed()).toEqual(['Tuỳ chỉnh']);
    fireEvent.click(screen.getByRole('button', { name: '20/70/10' }));
    expect(pressed()).toEqual(['20/70/10']);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đợt' }));
    expect(pressed()).toEqual(['Tuỳ chỉnh']);
  });

  it('switching a row from % to Số tiền clears the typed number (20% is not 20 đồng)', async () => {
    const port = new FakePaymentsPort();
    await openEditor(port);
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    fireEvent.click(screen.getByRole('link', { name: 'Số tiền' }));
    const amount = screen.getByLabelText('Số tiền (đồng)') as HTMLInputElement;
    expect(amount.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));
    await waitFor(() => expect(port.replaceCalls).toHaveLength(1));
    expect(port.replaceCalls[0].installments).toEqual([{ conditionNote: 'Thanh toán toàn bộ' }]);
  });

  it('template 100% fills one row; "Thêm đợt" / "Xoá đợt" add and remove rows', async () => {
    await openEditor(new FakePaymentsPort());
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(percentInputs().map((i) => i.value)).toEqual(['100']);
    expect(noteInputs()[0].value).toBe('Thanh toán toàn bộ');
    expect((screen.getByRole('button', { name: 'Xoá đợt' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đợt' }));
    expect(percentInputs()).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Xoá đợt' })[1]);
    expect(percentInputs()).toHaveLength(1);
  });

  it('"Thêm đợt" disappears at 12 rows', async () => {
    await openEditor(new FakePaymentsPort());
    for (let n = 1; n < 12; n++) {
      fireEvent.click(screen.getByRole('button', { name: 'Thêm đợt' }));
    }
    expect(percentInputs()).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Thêm đợt' })).toBeNull();
  });

  it('a blank number is sent ABSENT, never 0', async () => {
    const port = new FakePaymentsPort();
    await openEditor(port);
    fireEvent.change(noteInputs()[0], { target: { value: 'Cọc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));
    await waitFor(() => expect(port.replaceCalls).toHaveLength(1));
    expect(port.replaceCalls[0].installments).toEqual([{ conditionNote: 'Cọc' }]);
    expect('percent' in port.replaceCalls[0].installments[0]).toBe(false);
    expect('amount' in port.replaceCalls[0].installments[0]).toBe(false);
  });

  it('a typed "0" is sent as 0; an amount row sends `amount`', async () => {
    const port = new FakePaymentsPort();
    await openEditor(port);
    fireEvent.change(percentInputs()[0], { target: { value: '0' } });
    fireEvent.change(noteInputs()[0], { target: { value: 'Cọc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm đợt' }));
    fireEvent.click(screen.getAllByText('Số tiền')[1]);
    fireEvent.change(screen.getByLabelText('Số tiền (đồng)'), { target: { value: '5.000.000đ' } });
    fireEvent.change(noteInputs()[1], { target: { value: 'Bàn giao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));
    await waitFor(() => expect(port.replaceCalls).toHaveLength(1));
    expect(port.replaceCalls[0].installments).toEqual([
      { percent: 0, conditionNote: 'Cọc' },
      { amount: 5_000_000, conditionNote: 'Bàn giao' },
    ]);
  });

  it('reopening a configured schedule prefills each row with its typed kind', async () => {
    const schedule: PaymentSchedule = {
      ...DEMO_PAYMENT_SCHEDULE,
      installments: [
        { ...DEMO_PAYMENT_SCHEDULE.installments[0], percent: null },
        DEMO_PAYMENT_SCHEDULE.installments[1],
      ],
    };
    renderSchedule(new FakePaymentsPort(schedule));
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa lịch' }));
    expect((screen.getByLabelText('Số tiền (đồng)') as HTMLInputElement).value).toBe('16602192');
    expect(percentInputs().map((i) => i.value)).toEqual(['70']);
  });

  it('400 field errors land under the row they name; a list-level error goes to the banner', async () => {
    const port = new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE_EMPTY, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Lịch thanh toán không hợp lệ.',
        fieldErrors: [
          { field: 'installments.1.amount', code: 'resolvedZero', message: 'Đợt này tính ra 0 đồng.' },
          { field: 'installments.0.conditionNote', code: 'minLength', message: 'Nhập điều kiện thu của đợt.' },
          { field: 'installments', code: 'arrayMaxSize', message: 'Lịch thanh toán tối đa 12 đợt.' },
        ],
      },
    });
    const { container } = await (async () => {
      const r = renderSchedule(port);
      fireEvent.click(await screen.findByRole('button', { name: 'Cấu hình lịch' }));
      return r;
    })();
    fireEvent.click(screen.getByRole('button', { name: '20/70/10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('Lịch thanh toán không hợp lệ.');
    expect(banner.textContent).toContain('Lịch thanh toán tối đa 12 đợt.');
    const rows = container.querySelectorAll('.ps-row');
    expect(within(rows[0] as HTMLElement).getByText('Nhập điều kiện thu của đợt.')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText('Đợt này tính ra 0 đồng.')).toBeTruthy();
    expect(within(rows[2] as HTMLElement).queryByText(/./, { selector: '.ps-error' })).toBeNull();
  });

  it('409 ⇒ server message + "Tải lại", which reloads and leaves the editor', async () => {
    const port = new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE_EMPTY, {
      error: { code: 'CONFLICT', message: 'Đơn vừa thay đổi — tải lại rồi cấu hình lại lịch.' },
    });
    const getSpy = vi.spyOn(port, 'getSchedule');
    await openEditor(port);
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }));
    expect(
      await screen.findByText('Đơn vừa thay đổi — tải lại rồi cấu hình lại lịch.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(await screen.findByText('Đơn chưa có lịch thanh toán.')).toBeTruthy();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('double-click on save ⇒ one request, button disabled while in flight', async () => {
    let resolve!: (s: PaymentSchedule) => void;
    const held = new Promise<PaymentSchedule>((r) => {
      resolve = r;
    });
    const port = new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE_EMPTY, () => held);
    await openEditor(port);
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    const save = screen.getByRole('button', { name: 'Lưu lịch' });
    fireEvent.click(save);
    fireEvent.click(save);
    const busy = (await screen.findByRole('button', { name: 'Đang lưu…' })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(port.replaceCalls).toHaveLength(1);
    await act(async () => {
      resolve(DEMO_PAYMENT_SCHEDULE);
      await held;
    });
    expect(await screen.findByText('Đợt 1 · Cọc')).toBeTruthy();
  });
});

describe('OrderDetailScreen — "Thanh toán" entry', () => {
  async function seededOrderPort() {
    const port = new FakeOrdersPort();
    const order = await port.create({ customerSdt: '+84903176968' });
    return { port, order };
  }

  it('absent without the callback', async () => {
    const { port, order } = await seededOrderPort();
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);
    expect(await screen.findByText('Vòng đời đơn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thanh toán' })).toBeNull();
  });

  it('present with the callback and calls it', async () => {
    const { port, order } = await seededOrderPort();
    const onOpen = vi.fn();
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} onOpenPaymentSchedule={onOpen} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
