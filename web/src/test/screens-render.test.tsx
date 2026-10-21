// Smoke RENDER mọi màn trong web/src/screens trên JSDOM (lane mà text-guard không
// có: text-guard đọc .tsx như chuỗi nên "xanh" cả với màn không render nổi).
//
// Dữ liệu CHỈ đến từ fake port có sẵn trong design-system/session (không bịa API).
// Bật mọi điều kiện bao ngoài: phiên mang TOÀN BỘ khoá quyền, để không màn nào
// "xanh" chỉ vì một Gate đã giấu nội dung (bài học widget-test 5.7).
//
// Mỗi màn phải: render không throw; hiện text tiếng Việt chủ chốt SAU khi dữ liệu
// từ port về (chứng minh nhánh đã-tải render, không chỉ khung loading); không ghi
// console.error (React báo lỗi lồng thẻ, thiếu key, update ngoài act…); không lồng
// <button> trong <button>.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { PERMISSION_KEYS } from '../design-system/gating/permission-keys.generated';
import {
  DEMO_ME,
  FakeCatalogPort,
  FakeCustomerSourcesPort,
  FakeCustomersPort,
  FakeInventoryPort,
  FakeMePort,
  FakeOrdersPort,
  FakePasswordPort,
  FakePaymentsPort,
  FakeContractsPort,
  DEMO_PAYMENT_SCHEDULE,
  FakeSettingsPort,
  FakeStockVouchersPort,
  FakeWarrantyPort,
  PermissionsProvider,
} from '../design-system/session';
import { ProfileScreen } from '../screens/account/ProfileScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { CustomerDetailScreen } from '../screens/customers/CustomerDetailScreen';
import { CustomerListScreen } from '../screens/customers/CustomerListScreen';
import { CustomerPickScreen } from '../screens/customers/CustomerPickScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { StockVouchersScreen } from '../screens/inventory/StockVouchersScreen';
import { ContractsScreen } from '../screens/contracts/ContractsScreen';
import { CreateQuoteScreen } from '../screens/orders/CreateQuoteScreen';
import { DiscountApprovalScreen } from '../screens/orders/DiscountApprovalScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { OrderStatusChangeScreen } from '../screens/orders/OrderStatusChangeScreen';
import { OrdersListScreen } from '../screens/orders/OrdersListScreen';
import { PaymentScheduleScreen } from '../screens/payments/PaymentScheduleScreen';
import { CustomerSourceConfigScreen } from '../screens/settings/CustomerSourceConfigScreen';
import { WarrantyLookupScreen } from '../screens/warranty/WarrantyLookupScreen';

const SDT_KHACH_DEMO = '+84903176968';

const ALL_PERMS_ME = new FakeMePort({
  ...DEMO_ME,
  permissions: Object.values(PERMISSION_KEYS).sort(),
});

function renderScreen(node: ReactNode) {
  return render(<PermissionsProvider port={ALL_PERMS_ME}>{node}</PermissionsProvider>);
}

/** Đơn baogia của khách demo — có một dòng danh mục để các nhánh có dữ liệu render. */
async function seededOrder(port: FakeOrdersPort) {
  const order = await port.create({ customerSdt: SDT_KHACH_DEMO });
  await port.addLine(order.id, { productId: 'prod-pin-580', qty: 2 });
  return order;
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  const nested = document.querySelectorAll('button button');
  const errors = consoleError.mock.calls.map((args) => args.map(String).join(' '));
  consoleError.mockRestore();
  cleanup();
  expect(nested.length, 'không lồng <button> trong <button>').toBe(0);
  expect(errors, 'không có console.error trong lúc render').toEqual([]);
});

describe('smoke render — mọi màn web/src/screens', () => {
  it('chống guard rỗng: số màn được kiểm khớp số file *Screen.tsx', () => {
    const files = Object.keys(import.meta.glob('../screens/**/*Screen.tsx'));
    expect(files.length).toBe(SCREEN_COUNT);
  });

  it('LoginScreen', async () => {
    renderScreen(<LoginScreen />);
    expect(await screen.findByText('Phương Nam Solar')).toBeTruthy();
    expect(screen.getByText('App quản lý nội bộ · Phase 1')).toBeTruthy();
  });

  it('ForgotPasswordScreen', async () => {
    renderScreen(<ForgotPasswordScreen port={new FakePasswordPort()} />);
    expect(await screen.findByText('Quên mật khẩu')).toBeTruthy();
    expect(screen.getByText('Email đã đăng ký')).toBeTruthy();
  });

  it('ProfileScreen', async () => {
    renderScreen(<ProfileScreen port={new FakePasswordPort()} />);
    expect(await screen.findByText('Đang hoạt động')).toBeTruthy();
    expect(screen.getByText('demo@phuongnam.solar')).toBeTruthy();
  });

  it('CustomerListScreen', async () => {
    renderScreen(<CustomerListScreen port={new FakeCustomersPort()} />);
    expect(await screen.findByText('Công ty TNHH Hoà Phát')).toBeTruthy();
    expect(screen.getByText('Tên khách')).toBeTruthy();
  });

  it('CustomerDetailScreen', async () => {
    renderScreen(<CustomerDetailScreen port={new FakeCustomersPort()} sdt={SDT_KHACH_DEMO} />);
    expect(await screen.findByText('12 Nguyễn Huệ, Quận 1, TP.HCM')).toBeTruthy();
    expect(screen.getByText('Thông tin khách')).toBeTruthy();
  });

  it('CustomerPickScreen — tra cứu ra khách cũ', async () => {
    renderScreen(<CustomerPickScreen port={new FakeCustomersPort()} />);
    fireEvent.change(await screen.findByLabelText('SĐT'), { target: { value: '0903176968' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText('Khách cũ — trùng khớp')).toBeTruthy();
    expect(screen.getByText('Dùng khách này')).toBeTruthy();
  });

  it('CreateQuoteScreen — chọn khách ⇒ vào màn báo giá', async () => {
    renderScreen(
      <CreateQuoteScreen
        ordersPort={new FakeOrdersPort()}
        catalogPort={new FakeCatalogPort()}
        customersPort={new FakeCustomersPort()}
      />,
    );
    fireEvent.change(await screen.findByLabelText('SĐT'), { target: { value: '0903176968' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    fireEvent.click(await screen.findByText('Dùng khách này'));
    expect(await screen.findByText('Tạo báo giá')).toBeTruthy();
    expect(
      await screen.findByText('Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu.'),
    ).toBeTruthy();
  });

  it('DiscountApprovalScreen — có một đề xuất chờ duyệt', async () => {
    const port = new FakeOrdersPort();
    const order = await seededOrder(port);
    await port.applyDiscount(order.id, { amount: 100000, note: 'Khách quen' });
    renderScreen(<DiscountApprovalScreen ordersPort={port} />);
    expect(await screen.findByText('Chờ duyệt chiết khấu')).toBeTruthy();
    expect(screen.getByText('Nhân viên demo')).toBeTruthy();
  });

  it('OrdersListScreen', async () => {
    renderScreen(<OrdersListScreen port={new FakeOrdersPort()} />);
    expect(await screen.findByText('Đang thi công', { selector: 'td *, td' })).toBeTruthy();
    expect(screen.getAllByText('Công ty TNHH Hoà Phát').length).toBeGreaterThan(0);
  });

  it('OrderDetailScreen', async () => {
    const port = new FakeOrdersPort();
    const order = await seededOrder(port);
    renderScreen(<OrderDetailScreen port={port} orderId={order.id} />);
    expect(await screen.findByText('Vòng đời đơn')).toBeTruthy();
    expect(await screen.findByText(order.id)).toBeTruthy();
  });

  it('OrderStatusChangeScreen — câu trả lời đã tải từ port', async () => {
    // Fake chỉ mở bước kế tiếp từ dacoc trở đi, mà không API công khai nào của fake
    // đưa đơn tới dacoc (đợt cọc thuộc Epic 7) ⇒ nhánh đã-tải kiểm được là "không có bước".
    const port = new FakeOrdersPort();
    const order = await seededOrder(port);
    renderScreen(<OrderStatusChangeScreen port={port} orderId={order.id} />);
    expect(await screen.findByText('Chuyển trạng thái')).toBeTruthy();
    expect(await screen.findByText('Không có bước nào để chuyển.')).toBeTruthy();
  });

  it('CustomerSourceConfigScreen', async () => {
    renderScreen(
      <CustomerSourceConfigScreen
        port={new FakeCustomerSourcesPort()}
        settingsPort={new FakeSettingsPort()}
      />,
    );
    expect(await screen.findByText('Facebook')).toBeTruthy();
    expect(screen.getByText('Nguồn khách hàng')).toBeTruthy();
  });

  it('WarrantyLookupScreen — tra cứu SĐT ra kết quả', async () => {
    renderScreen(<WarrantyLookupScreen port={new FakeWarrantyPort()} />);
    // Fake so khớp ĐUÔI chữ số với '+84903176968' (chuẩn hoá là việc của backend) ⇒ nhập E.164.
    fireEvent.change(await screen.findByLabelText('SĐT khách'), {
      target: { value: SDT_KHACH_DEMO },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText(/Đơn ord-2026-014/)).toBeTruthy();
  });

  it('InventoryScreen — khả dụng âm hiện "Cần nhập", không hiện số âm', async () => {
    renderScreen(<InventoryScreen port={new FakeInventoryPort()} />);
    expect(await screen.findByText('Tồn kho · Tồn thật / Đã hứa / Khả dụng')).toBeTruthy();
    expect(screen.getByText('Cần nhập 15')).toBeTruthy();
    expect(screen.getByText('Còn 5 · Đã hứa 20 · Cần nhập 15 bộ')).toBeTruthy();
    expect(screen.getByText('Hết khả dụng')).toBeTruthy();
    expect(screen.getByText('Danh sách cần mua · gộp mọi khả dụng âm')).toBeTruthy();
    expect(document.body.textContent).not.toContain('-15');
  });

  it('StockVouchersScreen — danh sách phiếu, bấm dòng hiện chi tiết', async () => {
    renderScreen(
      <StockVouchersScreen
        port={new FakeStockVouchersPort()}
        inventoryPort={new FakeInventoryPort()}
      />,
    );
    expect(await screen.findByText('PK-N-0119')).toBeTruthy();
    expect(screen.getByText('Danh sách phiếu')).toBeTruthy();
    fireEvent.click(screen.getByText('PK-N-0119'));
    expect(await screen.findByText('06/07/2026 · 08:05')).toBeTruthy();
    expect(screen.getByText('+40')).toBeTruthy();
  });

  it('PaymentScheduleScreen — lịch 20/70/10 đã tải từ port', async () => {
    renderScreen(
      <PaymentScheduleScreen port={new FakePaymentsPort(DEMO_PAYMENT_SCHEDULE)} orderId="DH-2048" />,
    );
    expect(await screen.findByText('Các đợt thanh toán')).toBeTruthy();
    expect(screen.getByText('Đợt 1 · Cọc')).toBeTruthy();
    expect(screen.getByText('Đợt 3 · Tất toán')).toBeTruthy();
    expect(screen.getByText('Tổng đơn (sau VAT)')).toBeTruthy();
  });

  it('ContractsScreen — trường động của hợp đồng đã tải từ port', async () => {
    renderScreen(<ContractsScreen port={new FakeContractsPort()} orderId="DH-2048" />);
    expect(await screen.findByText('Trường động đưa vào HĐ')).toBeTruthy();
    expect(screen.getByText('Xuất PDF hợp đồng')).toBeTruthy();
  });
});

/** Số `it` render màn ở trên — thêm màn mới mà quên thêm test thì guard rỗng đỏ. */
const SCREEN_COUNT = 17;
