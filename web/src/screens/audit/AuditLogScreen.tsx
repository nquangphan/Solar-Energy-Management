// hand-authored — web app-screen (Story 8.5). Audit log: who · action · target ·
// before → after · when, newest first, with a target-type filter, a Vietnam-day
// range and paging, composed from shipped components (Table/Seg/Field/Banner/
// Skeleton/EmptyState/ErrorState/Button/Money formatter).
//
// READ ONLY (AD-8): no edit, no delete, no export. The action label and the flat
// before → after rows arrive computed by the backend (AD-2); this screen only
// picks how to print a value (money formatter, status label, raw text).
//
// Gated on the `audit.read` PERMISSION by the route and the sidebar; the backend
// enforces every request (AD-4).
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Skeleton,
  Table,
  formatVnd,
} from '../../design-system/components';
import { STATUS_LABELS, type StatusKey } from '../../design-system/components/StatusChip';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  AuditChange,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogsPort,
} from '../../design-system/session/audit-logs-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Toolbar, Topbar, WebShell } from '../../design-system/shell';
import { ngayGio } from '../inventory/format-gio';

import './audit.css';

export interface AuditLogScreenProps {
  port: AuditLogsPort;
}

type TargetType = NonNullable<AuditLogQuery['targetType']>;

/** Vietnamese label of every target type the backend publishes (mobile twin: kAuditTargetLabels). */
export const AUDIT_TARGET_LABELS: Record<TargetType, string> = {
  Order: 'Đơn hàng',
  Account: 'Account',
  Product: 'Sản phẩm',
  ProductGroup: 'Nhóm sản phẩm',
  Customer: 'Khách hàng',
  CustomerSource: 'Nguồn khách',
  StockVoucher: 'Phiếu kho',
  FeatureFlag: 'Cờ tính năng',
  SystemSetting: 'Cấu hình',
};

const ALL = 'ALL';

const FILTER_OPTIONS = [
  { key: ALL, label: 'Tất cả' },
  ...(Object.keys(AUDIT_TARGET_LABELS) as TargetType[]).map((key) => ({
    key,
    label: AUDIT_TARGET_LABELS[key],
  })),
];

type LoadState = 'loading' | 'ready' | 'error';

const INTEGER = /^-?\d+$/;
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAY = '9999-12-31';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isStatusKey(value: string): value is StatusKey {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

function isTargetType(value: string): value is TargetType {
  return Object.prototype.hasOwnProperty.call(AUDIT_TARGET_LABELS, value);
}

/** A UUID is cut to its first 8 characters; anything else (a phone key) is shown whole. */
function shortId(id: string): string {
  return UUID.test(id) ? id.slice(0, 8) : id;
}

/** Prints one side of a change: money through the formatter, a status through its label, else as sent. */
function renderValue(change: AuditChange, value: string | null): string {
  if (value === null) return '—';
  if (change.isMoney && INTEGER.test(value) && Number.isSafeInteger(Number(value))) {
    return formatVnd(Number(value));
  }
  if (change.field === 'status' && isStatusKey(value)) return STATUS_LABELS[value];
  return value;
}

function actorText(entry: AuditLogEntry): string {
  if (entry.actorAccountId === null) return 'Hệ thống';
  return entry.actorDisplayName ?? shortId(entry.actorAccountId);
}

export function AuditLogScreen({ port }: AuditLogScreenProps) {
  const { perms } = usePermissions();

  const [filter, setFilter] = useState<string>(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  // The backend owns the count and the slicing (AD-1).
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // A slow reply to an earlier query must not repaint the table after the current one.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      const result = await port.listAuditLogs({
        targetType: isTargetType(filter) ? filter : undefined,
        from: PLAIN_DATE.test(from) ? from : undefined,
        to: PLAIN_DATE.test(to) ? to : undefined,
        page,
      });
      if (ticket !== latest.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPageSize(result.pageSize);
      setState('ready');
    } catch (err) {
      if (ticket !== latest.current) return;
      const message = (err as { message?: unknown } | null)?.message;
      setErrorMessage(typeof message === 'string' && message !== '' ? message : 'Không tải được nhật ký Audit.');
      setState('error');
    }
  }, [port, filter, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any filter change returns to page 1 — page 3 of the old result set means nothing.
  const onFilter = (key: string) => {
    setFilter(key);
    setPage(1);
  };
  const onFrom = (value: string) => {
    setFrom(value);
    setPage(1);
  };
  const onTo = (value: string) => {
    setTo(value);
    setPage(1);
  };

  const filtering = filter !== ALL || from !== '' || to !== '';
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <WebShell
      url="app.phuongnamsolar.vn/audit"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="audit" />}
      topbar={<Topbar eyebrow="QUẢN TRỊ" title="Audit log" />}
    >
      <div className="aud-wrap">
        <Banner tone="info" icon="ic-audit">
          Bản ghi bất biến — chỉ đọc, không sửa/xoá.
        </Banner>

        <Toolbar>
          <Seg options={FILTER_OPTIONS} activeKey={filter} onSelect={onFilter} />
        </Toolbar>
        <div className="aud-range">
          {/* The picker cannot cross the other end, nor reach a 5-digit year the query would drop. */}
          <Field
            label="Từ ngày"
            type="date"
            value={from}
            max={to || MAX_DAY}
            onChange={(e) => onFrom(e.target.value)}
          />
          <Field
            label="Đến ngày"
            type="date"
            value={to}
            min={from || undefined}
            max={MAX_DAY}
            onChange={(e) => onTo(e.target.value)}
          />
        </div>

        {state === 'loading' && (
          <div className="aud-state">
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <div className="aud-state-msg">Đang tải nhật ký…</div>
          </div>
        )}

        {state === 'error' && <ErrorState message={errorMessage} onRetry={load} retryLabel="Thử lại" />}

        {state === 'ready' && items.length === 0 && filtering && (
          <EmptyState title="Không có bản ghi phù hợp" message="Thử đổi bộ lọc." />
        )}

        {state === 'ready' && items.length === 0 && !filtering && <EmptyState title="Chưa có bản ghi nào" />}

        {state === 'ready' && items.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>Ai</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Trước → Sau</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td className="aud-strong">{actorText(entry)}</td>
                  <td>{entry.eventLabel}</td>
                  <td>
                    {entry.targetType === null ? (
                      '—'
                    ) : (
                      <>
                        {isTargetType(entry.targetType) ? AUDIT_TARGET_LABELS[entry.targetType] : entry.targetType}
                        {entry.targetId !== null && <span className="aud-mono"> {shortId(entry.targetId)}</span>}
                      </>
                    )}
                  </td>
                  <td>
                    {entry.changes.length === 0
                      ? '—'
                      : entry.changes.map((change, i) => (
                          <div key={`${change.field}-${i}`} className="aud-change">
                            {change.field !== '' && <span className="aud-muted">{change.field}: </span>}
                            {renderValue(change, change.before)} → {renderValue(change, change.after)}
                          </div>
                        ))}
                  </td>
                  <td className="aud-mono">{ngayGio(entry.occurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {state === 'ready' && items.length > 0 && totalPages > 1 && (
          <div className="aud-pager">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </Button>
            <span className="aud-pager-label">
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
