// hand-authored — web app-screen (Story 3.4). Danh sách khách: search + type
// filter + the three REAL port states (loading / empty / error), composed from
// shipped components (Table/SearchField/Seg/Button/EmptyState/ErrorState/Skeleton).
//
// The three states are the three states of the PORT, not three hand-built
// variants: whatever the backend does, the screen shows the truth about it.
//
// Search is submitted to the BACKEND (AD-1/AD-2): the client does not filter,
// sort, count or paginate in memory, and it never inspects the phone string the
// user typed — `q` travels raw and the backend decides how to match it.
//
// There is NO "Số đơn" column: `Order` does not exist until Story 4.1, and no
// table can back that number today (AC-7).
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  CustomerTypeChip,
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type { Customer, CustomersPort } from '../../design-system/session/customers-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import {
  SearchField,
  Seg,
  Sidebar,
  SIDEBAR_NAV,
  Toolbar,
  Topbar,
  WebShell,
} from '../../design-system/shell';
import { typeLabel } from './CustomerPickScreen';

import './customers.css';

export interface CustomerListScreenProps {
  port: CustomersPort;
  onOpen?: (sdt: string) => void;
  onAdd?: () => void;
}

const ALL = 'ALL';

const FILTER_OPTIONS = [
  { key: ALL, label: 'Tất cả' },
  { key: 'CA_NHAN', label: 'Cá nhân' },
  { key: 'THUONG_MAI', label: 'Thương mại' },
];

type LoadState = 'loading' | 'ready' | 'error';

export function CustomerListScreen({ port, onOpen, onAdd }: CustomerListScreenProps) {
  const { perms } = usePermissions();

  const [q, setQ] = useState('');
  const [custType, setCustType] = useState<string>(ALL);
  const [items, setItems] = useState<Customer[]>([]);
  // The backend owns the count and the slicing (AD-1): the screen holds only the
  // page it asked for and the total it was told, and never counts rows itself.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [state, setState] = useState<LoadState>('loading');

  // Every keystroke starts a query, and the answers do not necessarily come back in
  // the order they were asked. Without this ticket, a slow reply to `090` can land
  // AFTER the reply to `0903` and repaint the table with results for a query the user
  // has already moved past — the rows would simply be wrong, silently.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      // The query goes to the backend untouched — `0903` is matched there against
      // the E.164 key, which is a thing only the backend knows how to do (AD-9).
      const result = await port.list({
        q: q === '' ? undefined : q,
        custType: custType === 'CA_NHAN' || custType === 'THUONG_MAI' ? custType : undefined,
        page,
      });
      if (ticket !== latest.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPageSize(result.pageSize);
      setState('ready');
    } catch {
      if (ticket !== latest.current) return;
      setState('error');
    }
  }, [port, q, custType, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any change to the query or filter invalidates the page number — page 3 of the
  // old result set is meaningless against the new one, so every filter change
  // returns to page 1.
  const onSearch = (value: string) => {
    setQ(value);
    setPage(1);
  };
  const onFilter = (key: string) => {
    setCustType(key);
    setPage(1);
  };

  const searching = q !== '' || custType !== ALL;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <WebShell
      url="app.phuongnamsolar.vn/khach-hang"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="customers" />}
      topbar={<Topbar eyebrow="KHÁCH HÀNG" title="Khách hàng" />}
    >
      <div className="cust-wrap">
        <Toolbar>
          <SearchField
            placeholder="Tìm theo SĐT hoặc tên khách…"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
          <Seg options={FILTER_OPTIONS} activeKey={custType} onSelect={onFilter} />
          <Button variant="primary" type="button" onClick={onAdd}>
            + Thêm khách
          </Button>
        </Toolbar>

        {state === 'loading' && (
          <div className="cust-state">
            <Skeleton />
            <div className="cust-state-msg">Đang tải danh sách khách hàng…</div>
          </div>
        )}

        {state === 'error' && (
          <ErrorState message="Không tải được danh sách khách hàng." onRetry={load} retryLabel="Thử lại" />
        )}

        {/* A filtered view that comes back empty is NOT the same as an empty book:
            the fix is to change the search, not to add the first customer. Two
            different truths ⇒ two different empty states. */}
        {state === 'ready' && items.length === 0 && searching && (
          <EmptyState
            title="Không có khách phù hợp"
            message="Thử đổi từ khoá hoặc bỏ bớt bộ lọc."
          />
        )}

        {state === 'ready' && items.length === 0 && !searching && (
          <EmptyState
            title="Chưa có khách hàng nào"
            message="Thêm khách đầu tiên để bắt đầu tạo báo giá."
            action={
              <Button variant="primary" type="button" onClick={onAdd}>
                + Thêm khách
              </Button>
            }
          />
        )}

        {state === 'ready' && items.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>Tên khách</th>
                <th>SĐT</th>
                <th>Loại khách</th>
                <th aria-label="Hành động" />
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr key={customer.phone}>
                  <td>{customer.name}</td>
                  <td className="cust-mono">{customer.phone}</td>
                  <td>
                    <CustomerTypeChip>{typeLabel(customer.custType)}</CustomerTypeChip>
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" type="button" onClick={() => onOpen?.(customer.phone)}>
                      Xem
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {/* The pager only exists when there IS a second page — one page of results
            needs no controls. Prev/Sau disable at the ends; the backend caps
            pageSize so `totalPages` is always honest. */}
        {state === 'ready' && items.length > 0 && totalPages > 1 && (
          <div className="cust-pager">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </Button>
            <span className="cust-pager-label">
              Trang {page}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sau
            </Button>
          </div>
        )}
      </div>
    </WebShell>
  );
}
