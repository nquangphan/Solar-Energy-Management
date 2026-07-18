// hand-authored — web app-screen (Story 5.3). Danh sách đơn: status filter +
// follow-up + the three REAL port states (loading / empty / error), composed
// from shipped components (Table/Seg/Button/StatusChip/EmptyState/ErrorState/
// Skeleton).
//
// SCOPE IS NOT A FILTER. "Xem tất cả đơn" vs "chỉ đơn của mình" is a PERMISSION
// the backend resolves (FR-18, AD-4) — this screen sends no scope parameter and
// offers no "Của tôi / Tất cả" toggle. Whatever the backend returns IS the
// caller's scope.
//
// Follow-up is not a column, a reminder or a job: it is orders still at 'baogia'
// (FR-10), i.e. a derived filter over the same list.
//
// No money math here (AD-10/16) and no totals column: a list total would need
// the version + pricing join, and a wrong number on a row is a money regression.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusChip,
  Table,
} from '../../design-system/components';
import { STATUS_LABELS, type StatusKey } from '../../design-system/components/StatusChip';
import { filterNav } from '../../design-system/gating/permissions';
import type { OrderListItem, OrdersPort } from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Toolbar, Topbar, WebShell } from '../../design-system/shell';

import './orders-list.css';

export interface OrdersListScreenProps {
  port: OrdersPort;
  onOpen?: (id: string) => void;
  onAdd?: () => void;
}

const ALL = 'ALL';
const FOLLOW_UP = 'FOLLOW_UP';

// The filter keys are the 10 canonical status keys plus two derived views. The
// labels come from STATUS_LABELS so a chip and its filter button can never drift
// apart.
const FILTER_OPTIONS = [
  { key: ALL, label: 'Tất cả' },
  { key: FOLLOW_UP, label: 'Follow-up' },
  ...(Object.keys(STATUS_LABELS) as StatusKey[]).map((key) => ({
    key,
    label: STATUS_LABELS[key],
  })),
];

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Narrow the port's `string` status to the chip's strict union before rendering.
 * The port mirrors the backend DTO (`string`), the chip accepts only the 10 keys
 * — widening the chip would break its contract for every other screen, and an
 * unchecked cast would fail SILENTLY here because web has no tsc yet (TD-1).
 */
function isStatusKey(value: string): value is StatusKey {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

export function OrdersListScreen({ port, onOpen, onAdd }: OrdersListScreenProps) {
  const { perms } = usePermissions();

  const [filter, setFilter] = useState<string>(ALL);
  const [items, setItems] = useState<OrderListItem[]>([]);
  // The backend owns the count and the slicing (AD-1): the screen holds only the
  // page it asked for and the total it was told, and never counts rows itself.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [state, setState] = useState<LoadState>('loading');

  // Answers do not necessarily come back in the order they were asked. Without
  // this ticket, a slow reply to an earlier filter can land AFTER the reply to
  // the current one and repaint the table with rows the user already moved past
  // — the list would simply be wrong, silently.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      // `followUp` and `status` are mutually exclusive — the Seg picks exactly
      // one of the three shapes, so the two never travel together.
      const result = await port.list({
        followUp: filter === FOLLOW_UP ? true : undefined,
        status: filter === ALL || filter === FOLLOW_UP ? undefined : filter,
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
  }, [port, filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any filter change invalidates the page number — page 3 of the old result set
  // is meaningless against the new one, so every change returns to page 1.
  const onFilter = (key: string) => {
    setFilter(key);
    setPage(1);
  };

  const filtering = filter !== ALL;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <WebShell
      url="app.phuongnamsolar.vn/don-hang"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />}
      topbar={<Topbar eyebrow="ĐƠN HÀNG" title="Đơn hàng" />}
    >
      <div className="ord-wrap">
        <Toolbar>
          <Seg options={FILTER_OPTIONS} activeKey={filter} onSelect={onFilter} />
          <Button variant="primary" type="button" onClick={onAdd}>
            + Tạo đơn
          </Button>
        </Toolbar>

        {state === 'loading' && (
          <div className="ord-state">
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <div className="ord-state-msg">Đang tải danh sách đơn…</div>
          </div>
        )}

        {state === 'error' && (
          <ErrorState message="Không tải được danh sách đơn." onRetry={load} retryLabel="Thử lại" />
        )}

        {/* A filtered view that comes back empty is NOT the same as an empty
            book: the fix is to change the filter, not to create the first
            order. Two different truths ⇒ two different empty states. */}
        {state === 'ready' && items.length === 0 && filtering && (
          <EmptyState title="Không có đơn phù hợp" message="Thử đổi bộ lọc." />
        )}

        {state === 'ready' && items.length === 0 && !filtering && (
          <EmptyState
            title="Chưa có đơn nào"
            message="Bấm ➕Tạo để bắt đầu."
            action={
              <Button variant="primary" type="button" onClick={onAdd}>
                + Tạo đơn
              </Button>
            }
          />
        )}

        {state === 'ready' && items.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>SĐT</th>
                <th>Trạng thái</th>
                <th aria-label="Hành động" />
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id}>
                  <td>{order.customerName}</td>
                  <td className="ord-mono">{order.customerSdt}</td>
                  <td>
                    {isStatusKey(order.status) ? (
                      <StatusChip status={order.status} />
                    ) : (
                      order.status
                    )}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" type="button" onClick={() => onOpen?.(order.id)}>
                      Xem
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {/* The pager only exists when there IS a second page. Prev/Sau disable
            at the ends; the backend caps pageSize so `totalPages` is honest. */}
        {state === 'ready' && items.length > 0 && totalPages > 1 && (
          <div className="ord-pager">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </Button>
            <span className="ord-pager-label">
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
