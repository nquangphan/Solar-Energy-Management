// Behaviour of the Sinh hợp đồng screen on JSDOM: the six dynamic fields, the type
// label, the missing-party and blocked banners, generate -> download wiring, the
// double-click guard, a refusal shown verbatim, the generated list and its
// download, empty/loading/error states; the "Hợp đồng" entry on the order detail
// screen; and the legal-entity Frame of the Cấu hình screen.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PERMISSION_KEYS } from '../design-system/gating/permission-keys.generated';
import {
  DEMO_CONTRACT_SUMMARY,
  DEMO_ME,
  FakeContractsPort,
  FakeCustomerSourcesPort,
  FakeMePort,
  FakeOrdersPort,
  FakeSettingsPort,
  PermissionsProvider,
} from '../design-system/session';
import type { ContractsPort } from '../design-system/session/contracts-port';
import { ContractsScreen } from '../screens/contracts/ContractsScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { CustomerSourceConfigScreen } from '../screens/settings/CustomerSourceConfigScreen';

const ALL_PERMS = Object.values(PERMISSION_KEYS).sort();

function renderScreen(node: ReactNode) {
  const me = new FakeMePort({ ...DEMO_ME, permissions: ALL_PERMS });
  return render(<PermissionsProvider port={me}>{node}</PermissionsProvider>);
}

const renderContracts = (port: ContractsPort) =>
  renderScreen(<ContractsScreen port={port} orderId="DH-2048" />);

const pageText = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');

/** shareFiles falls back to an object-URL download in JSDOM; stub the URL calls. */
function stubDownload() {
  const create = vi.fn(() => 'blob:fake');
  const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return create;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ContractsScreen — dynamic fields', () => {
  it('shows the six rows with the total through Money', async () => {
    renderContracts(new FakeContractsPort());
    expect(await screen.findByText('Trường động đưa vào HĐ')).toBeTruthy();
    for (const label of ['Loại HĐ', 'Hai bên', 'Vật tư', 'Tổng tiền', 'Lịch TT', 'Số BG']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const text = pageText();
    expect(text).toContain('A: Nguyễn Văn An · B: Phương Nam');
    expect(text).toContain('6 dòng · snapshot đơn');
    expect(text).toContain('83.010.960');
    expect(text).toContain('20/70/10');
    expect(text).toContain('BG-2048');
    expect(screen.getByText('Điều khoản là template tĩnh; sinh HĐ ghi Audit log.')).toBeTruthy();
    expect(screen.getByText('Sinh hợp đồng')).toBeTruthy();
    expect(screen.getByText('HỢP ĐỒNG')).toBeTruthy();
  });

  it('labels a construction contract "HĐ Thi công"', async () => {
    renderContracts(new FakeContractsPort({ contractType: 'construction' }));
    expect(await screen.findByText('HĐ Thi công')).toBeTruthy();
    expect(screen.queryByText('HĐ Mua bán')).toBeNull();
  });

  it('labels a sale contract "HĐ Mua bán"', async () => {
    renderContracts(new FakeContractsPort({ contractType: 'sale' }));
    expect(await screen.findByText('HĐ Mua bán')).toBeTruthy();
    expect(screen.queryByText('HĐ Thi công')).toBeNull();
  });

  it('warns about missing party fields and still shows the button', async () => {
    renderContracts(new FakeContractsPort({ missingPartyFields: ['Mã số thuế', 'Địa chỉ'] }));
    expect(
      await screen.findByText(
        'Thông tin pháp nhân chưa cấu hình: Mã số thuế, Địa chỉ. Hợp đồng vẫn xuất được — các ô này in “Chưa cấu hình”.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xuất PDF hợp đồng' })).toBeTruthy();
  });

  it('shows no party warning when nothing is missing', async () => {
    renderContracts(new FakeContractsPort());
    await screen.findByText('Trường động đưa vào HĐ');
    expect(pageText()).not.toContain('Thông tin pháp nhân chưa cấu hình');
  });

  it('shows the blocked reason and hides the button when not generatable', async () => {
    renderContracts(
      new FakeContractsPort({ generatable: false, blockedReason: 'Đơn chưa chốt giá.' }),
    );
    expect(await screen.findByText('Đơn chưa chốt giá.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xuất PDF hợp đồng' })).toBeNull();
  });
});

describe('ContractsScreen — generate', () => {
  it('generates once, then downloads the new contract id', async () => {
    stubDownload();
    const port = new FakeContractsPort();
    const generate = vi.spyOn(port, 'generateContract');
    const download = vi.spyOn(port, 'downloadContractPdf');
    renderContracts(port);
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất PDF hợp đồng' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith('DH-2048');
    expect(download).toHaveBeenCalledWith('DH-2048', 'contract-1');
    expect(await screen.findByText(/HĐTC-1\/2026 · HĐ Thi công · Bản 1 · 22\/10\/2026/)).toBeTruthy();
  });

  it('two fast clicks make one call', async () => {
    stubDownload();
    const port = new FakeContractsPort();
    const generate = vi.spyOn(port, 'generateContract');
    renderContracts(port);
    const button = await screen.findByRole('button', { name: 'Xuất PDF hợp đồng' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    await screen.findByText(/HĐTC-1\/2026/);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('shows the server message verbatim on a refusal and reloads the overview', async () => {
    const port = new FakeContractsPort({
      generateError: { message: 'Đơn đã đổi trạng thái, tải lại trang.', status: 409 },
    });
    const overview = vi.spyOn(port, 'getOverview');
    const download = vi.spyOn(port, 'downloadContractPdf');
    renderContracts(port);
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất PDF hợp đồng' }));
    expect(await screen.findByText('Đơn đã đổi trạng thái, tải lại trang.')).toBeTruthy();
    expect(download).not.toHaveBeenCalled();
    await waitFor(() => expect(overview).toHaveBeenCalledTimes(2));
  });

  it('a download failure AFTER a successful generation points at "Tải PDF", never at a second generation', async () => {
    const port = new FakeContractsPort({
      downloadError: { message: 'Mất kết nối.', status: 0 },
    });
    const generate = vi.spyOn(port, 'generateContract');
    renderContracts(port);
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất PDF hợp đồng' }));
    expect(
      await screen.findByText(
        'Đã sinh hợp đồng HĐTC-1/2026 nhưng chưa tải được — bấm “Tải PDF” trong danh sách.',
      ),
    ).toBeTruthy();
    // The new contract is listed, so it can be downloaded without generating again.
    expect(await screen.findByText(/HĐTC-1\/2026 · HĐ Thi công/)).toBeTruthy();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('a JS/DOM error while sharing shows the Vietnamese fallback, not its English text', async () => {
    const port = new FakeContractsPort({ contracts: [DEMO_CONTRACT_SUMMARY] });
    vi.spyOn(port, 'downloadContractPdf').mockRejectedValue(
      new Error('Must be handling a user gesture to perform a share request.'),
    );
    renderContracts(port);
    fireEvent.click(await screen.findByRole('button', { name: 'Tải PDF' }));
    expect(await screen.findByText('Không tải được file hợp đồng. Vui lòng thử lại.')).toBeTruthy();
    expect(pageText()).not.toContain('user gesture');
  });

  it('a refusal stays on screen when the reload after it fails too', async () => {
    const port = new FakeContractsPort({
      generateError: { message: 'Đơn chưa có lịch thanh toán.', status: 409 },
    });
    renderContracts(port);
    const button = await screen.findByRole('button', { name: 'Xuất PDF hợp đồng' });
    vi.spyOn(port, 'getOverview').mockRejectedValue({ message: 'boom' });
    fireEvent.click(button);
    expect(await screen.findByText('Đơn chưa có lịch thanh toán.')).toBeTruthy();
    expect(screen.getByText('Trường động đưa vào HĐ')).toBeTruthy();
  });
});

describe('ContractsScreen — generated list', () => {
  // 18:30Z is already the NEXT day in Vietnam (UTC+7).
  const second = {
    ...DEMO_CONTRACT_SUMMARY,
    id: 'contract-2',
    contractNo: 'HĐTC-2/2026',
    versionNo: 2,
    createdAt: '2026-10-21T18:30:00.000Z',
  };

  it('lists contracts and downloads the right one', async () => {
    stubDownload();
    const port = new FakeContractsPort({ contracts: [second, DEMO_CONTRACT_SUMMARY] });
    const download = vi.spyOn(port, 'downloadContractPdf');
    renderContracts(port);
    expect(await screen.findByText('Hợp đồng đã sinh')).toBeTruthy();
    expect(screen.getByText('HĐTC-2/2026 · HĐ Thi công · Bản 2 · 22/10/2026')).toBeTruthy();
    expect(screen.getByText('HĐTC-1/2026 · HĐ Thi công · Bản 1 · 21/10/2026')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Tải PDF' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]!);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download).toHaveBeenCalledWith('DH-2048', 'contract-1');
  });

  it('shows an empty state with no contracts', async () => {
    renderContracts(new FakeContractsPort());
    expect(await screen.findByText('Chưa sinh hợp đồng nào.')).toBeTruthy();
  });
});

describe('ContractsScreen — load states', () => {
  it('shows a skeleton while loading', () => {
    const port = new FakeContractsPort();
    vi.spyOn(port, 'getOverview').mockReturnValue(new Promise(() => {}));
    renderContracts(port);
    expect(document.querySelector('.skel')).not.toBeNull();
    expect(screen.queryByText('Trường động đưa vào HĐ')).toBeNull();
  });

  it('shows an error state and retries', async () => {
    const port = new FakeContractsPort();
    const overview = vi
      .spyOn(port, 'getOverview')
      .mockRejectedValueOnce({ message: 'boom' });
    renderContracts(port);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Trường động đưa vào HĐ')).toBeTruthy();
    expect(overview).toHaveBeenCalledTimes(2);
  });
});

describe('OrderDetailScreen — "Hợp đồng" entry', () => {
  async function seeded() {
    const port = new FakeOrdersPort();
    const order = await port.create({ customerPhone: '+84903176968' });
    // Every other condition that opens the actions block is OFF: no next step, not
    // cancellable, no payment-schedule callback — only onOpenContracts can open it.
    vi.spyOn(port, 'getLifecycle').mockResolvedValue({
      steps: [],
      nextSteps: [],
      canCancel: false,
    });
    return { port, order };
  }

  it('absent without the callback: no actions block at all', async () => {
    const { port, order } = await seeded();
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);
    expect(await screen.findByText('Vòng đời đơn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hợp đồng' })).toBeNull();
    expect(document.querySelector('.od-actions')).toBeNull();
  });

  it('absent without the callback even when the actions block is open for another reason', async () => {
    const { port, order } = await seeded();
    renderScreen(
      <OrderDetailScreen port={port} orderId={order.id} onOpenPaymentSchedule={() => {}} />,
    );
    expect(await screen.findByRole('button', { name: 'Thanh toán' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hợp đồng' })).toBeNull();
  });

  it('the callback alone opens the block and is called on click', async () => {
    const { port, order } = await seeded();
    const onOpen = vi.fn();
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} onOpenContracts={onOpen} />);
    const button = await screen.findByRole('button', { name: 'Hợp đồng' });
    const actions = document.querySelector('.od-actions') as HTMLElement;
    expect(within(actions).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('CustomerSourceConfigScreen — legal entity', () => {
  const LABELS = [
    'Tên công ty',
    'Mã số thuế',
    'Địa chỉ',
    'Người đại diện',
    'Chức danh',
    'Điện thoại',
    'Tài khoản ngân hàng',
  ];

  function renderConfig(settings: FakeSettingsPort) {
    return renderScreen(
      <CustomerSourceConfigScreen port={new FakeCustomerSourcesPort()} settingsPort={settings} />,
    );
  }

  it('loads the 7 fields from the port', async () => {
    const settings = new FakeSettingsPort();
    await settings.updateCompanyLegalEntity({
      legalName: 'Công ty Phương Nam',
      taxCode: '0312345678',
      address: '1 Nguyễn Huệ',
      representative: 'Nguyễn Văn B',
      representativeTitle: 'Giám đốc',
      phone: '0901234567',
      bankAccount: '123456 - VCB',
    });
    renderConfig(settings);
    expect(await screen.findByText('Thông tin pháp nhân (in trên hợp đồng)')).toBeTruthy();
    await waitFor(() =>
      expect((screen.getByLabelText('Tên công ty') as HTMLInputElement).value).toBe(
        'Công ty Phương Nam',
      ),
    );
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeTruthy();
    expect((screen.getByLabelText('Tài khoản ngân hàng') as HTMLInputElement).value).toBe(
      '123456 - VCB',
    );
  });

  it('saves the typed payload', async () => {
    const settings = new FakeSettingsPort();
    const update = vi.spyOn(settings, 'updateCompanyLegalEntity');
    renderConfig(settings);
    const name = (await screen.findByLabelText('Tên công ty')) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Công ty X' } });
    fireEvent.change(screen.getByLabelText('Mã số thuế'), { target: { value: '0300000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin pháp nhân' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith({
      legalName: 'Công ty X',
      taxCode: '0300000000',
      address: '',
      representative: '',
      representativeTitle: '',
      phone: '',
      bankAccount: '',
    });
  });

  it('a failed load shows an error state and no form to save (no blanking of the saved entity)', async () => {
    const settings = new FakeSettingsPort();
    const get = vi
      .spyOn(settings, 'getCompanyLegalEntity')
      .mockRejectedValueOnce({ message: 'boom' });
    const update = vi.spyOn(settings, 'updateCompanyLegalEntity');
    renderConfig(settings);
    expect(await screen.findByText('Không tải được thông tin pháp nhân.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lưu thông tin pháp nhân' })).toBeNull();
    expect(update).not.toHaveBeenCalled();
    // The customer-source table loaded fine, so this is the only retry on the page.
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('button', { name: 'Lưu thông tin pháp nhân' })).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('no save button while the entity is still loading', async () => {
    const settings = new FakeSettingsPort();
    vi.spyOn(settings, 'getCompanyLegalEntity').mockReturnValue(new Promise(() => {}));
    renderConfig(settings);
    expect(await screen.findByText('Thông tin pháp nhân (in trên hợp đồng)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lưu thông tin pháp nhân' })).toBeNull();
  });

  it('maps 400 fieldErrors under the right field', async () => {
    const settings = new FakeSettingsPort();
    vi.spyOn(settings, 'updateCompanyLegalEntity').mockRejectedValue({
      message: 'Dữ liệu không hợp lệ.',
      fieldErrors: [{ field: 'taxCode', code: 'invalid', message: 'Mã số thuế không hợp lệ.' }],
    });
    renderConfig(settings);
    await screen.findByLabelText('Mã số thuế');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin pháp nhân' }));
    const message = await screen.findByText('Mã số thuế không hợp lệ.');
    // The message sits in the same wrapper as the Mã số thuế input, not under another field.
    expect(message.parentElement?.contains(screen.getByLabelText('Mã số thuế'))).toBe(true);
    expect(screen.getByText('Dữ liệu không hợp lệ.')).toBeTruthy();
    expect(screen.queryAllByText('Mã số thuế không hợp lệ.')).toHaveLength(1);
  });
});
