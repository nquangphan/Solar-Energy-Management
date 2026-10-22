// Customer screens over fake ports, for behaviour the smoke render does not reach: a
// switched-off source keeps naming the customers who came from it but takes no new one,
// and a field error on the phone shows under the SĐT input.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEMO_CUSTOMERS,
  DEMO_CUSTOMER_SOURCES,
  FakeCustomersPort,
  FakeMePort,
  PermissionsProvider,
} from '../design-system/session';
import type { CustomerSource } from '../design-system/session';
import { CustomerDetailScreen } from '../screens/customers/CustomerDetailScreen';
import { CustomerPickScreen } from '../screens/customers/CustomerPickScreen';

afterEach(cleanup);

const FAIR: CustomerSource = {
  id: 'src-fair',
  name: 'Hội chợ 2025',
  description: null,
  active: false,
  isOther: false,
  sortOrder: 50,
};
const SOURCES = [...DEMO_CUSTOMER_SOURCES, FAIR];
const CUSTOMER = { ...DEMO_CUSTOMERS[0], sourceId: FAIR.id };

const ME = new FakeMePort({ id: 'acc-1', email: 'a@pns.vn', displayName: 'A', permissions: ['customers.manage'] });

function port() {
  return new FakeCustomersPort([CUSTOMER], SOURCES);
}

describe('switched-off customer source', () => {
  it('the detail still shows the source name of a customer on it', async () => {
    render(
      <PermissionsProvider port={ME}>
        <CustomerDetailScreen port={port()} sdt={CUSTOMER.phone} />
      </PermissionsProvider>,
    );
    expect(await screen.findByText('Hội chợ 2025')).toBeTruthy();
  });

  it('the lookup hit shows it too, but the create select offers only active sources', async () => {
    render(
      <PermissionsProvider port={ME}>
        <CustomerPickScreen port={port()} />
      </PermissionsProvider>,
    );
    fireEvent.change(await screen.findByLabelText('SĐT'), { target: { value: CUSTOMER.phone } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText('Hội chợ 2025')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Không phải khách này? Tạo khách hàng mới →' }));
    const options = Array.from(document.querySelectorAll('.cust-select option')).map((o) => o.textContent);
    expect(options).toEqual(['— Chọn nguồn —', ...DEMO_CUSTOMER_SOURCES.map((s) => s.name)]);
  });
});

describe('create customer: phone field error', () => {
  it('a fieldErrors.phone from the envelope shows under SĐT', async () => {
    const customers = port();
    vi.spyOn(customers, 'create').mockRejectedValue({
      message: 'Dữ liệu không hợp lệ',
      fieldErrors: [{ field: 'phone', message: 'Tối đa 32 ký tự.' }],
    });
    render(
      <PermissionsProvider port={ME}>
        <CustomerPickScreen port={customers} />
      </PermissionsProvider>,
    );
    fireEvent.change(await screen.findByLabelText('SĐT'), { target: { value: '0900 000 999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo khách hàng mới' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu khách hàng' }));
    expect(await screen.findByText('Tối đa 32 ký tự.')).toBeTruthy();
    expect(customers.create).toHaveBeenCalledTimes(1);
  });

  it('two messages on the same field: the FIRST one shows (same rule as mobile)', async () => {
    const customers = port();
    vi.spyOn(customers, 'create').mockRejectedValue({
      message: 'Dữ liệu không hợp lệ',
      fieldErrors: [
        { field: 'phone', message: 'Số điện thoại không hợp lệ.' },
        { field: 'phone', message: 'Tối đa 32 ký tự.' },
      ],
    });
    render(
      <PermissionsProvider port={ME}>
        <CustomerPickScreen port={customers} />
      </PermissionsProvider>,
    );
    fireEvent.change(await screen.findByLabelText('SĐT'), { target: { value: '0900 000 999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo khách hàng mới' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu khách hàng' }));
    expect(await screen.findByText('Số điện thoại không hợp lệ.')).toBeTruthy();
    expect(screen.queryByText('Tối đa 32 ký tự.')).toBeNull();
  });
});
