// hand-authored — web app-screen (Story 3.4). Chi tiết khách: the fact list of
// ONE customer, rendering exactly the fields that customer's type actually has.
//
// A Cá nhân has no MST and no bank account; a Thương mại has no CCCD. Rendering
// the other type's rows — even blank — tells the user a field exists for them
// when the backend would reject it outright (400, "field lạc loại khách").
//
// A nullable field that IS theirs but empty renders `—`: the row stays, because
// "this customer has no address" is information; hiding the row is not.
//
// There is NO order history and NO "+ Tạo đơn mới": `Order` lands in Story 4.1,
// and a screen may not show a number no table can back (AC-7).
import { useCallback, useEffect, useState } from 'react';

import { Card, ErrorState, Frame, Skeleton } from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  Customer,
  CustomerSource,
  CustomersPort,
} from '../../design-system/session/customers-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';
import { CustomerFacts } from './CustomerPickScreen';

import './customers.css';

export interface CustomerDetailScreenProps {
  port: CustomersPort;
  /** RAW or E.164 — the backend normalises before it reads (AD-9). */
  sdt: string;
  onEdit?: (sdt: string) => void;
}

type LoadState = 'loading' | 'ready' | 'error';

export function CustomerDetailScreen({ port, sdt, onEdit }: CustomerDetailScreenProps) {
  const { perms } = usePermissions();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sources, setSources] = useState<CustomerSource[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  // A failed load must offer the way back — "Thử lại" without a handler is a button
  // that does nothing, and a dead end is what the error state exists to prevent.
  const load = useCallback(async () => {
    setState('loading');
    try {
      const [found, catalogue] = await Promise.all([port.get(sdt), port.listSources()]);
      setCustomer(found);
      setSources(catalogue);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [port, sdt]);

  useEffect(() => {
    void load();
  }, [load]);

  const eyebrow =
    customer?.custType === 'THUONG_MAI' ? 'KHÁCH · THƯƠNG MẠI' : 'KHÁCH · CÁ NHÂN';

  return (
    <WebShell
      url="app.phuongnamsolar.vn/khach-hang/chi-tiet"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="customers" />}
      topbar={
        <Topbar
          eyebrow={eyebrow}
          title={customer?.name ?? ''}
          // Topbar tự bọc `action` trong <button class="topbar-action"> — truyền CHỮ +
          // onAction, không truyền <Button> (button lồng button là HTML không hợp lệ).
          action="Sửa"
          onAction={() => onEdit?.(sdt)}
        />
      }
    >
      <div className="cust-wrap">
        {state === 'loading' && (
          <div className="cust-state">
            <Skeleton />
          </div>
        )}

        {state === 'error' && (
          <ErrorState
            message="Không tải được danh sách khách hàng."
            onRetry={load}
            retryLabel="Thử lại"
          />
        )}

        {state === 'ready' && customer !== null && (
          <Frame label="Thông tin khách">
            <Card>
              <CustomerFacts customer={customer} sources={sources} />
            </Card>
          </Frame>
        )}
      </div>
    </WebShell>
  );
}
