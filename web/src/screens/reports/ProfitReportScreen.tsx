// hand-authored — web app-screen. Gross profit report: ONE table of the
// issued orders' gross profit on materials, grouped four ways by a seg (order /
// month / assignee / customer source), over this month, this year or a custom
// Vietnam-day range. Composed from shipped components (Kpi/Banner/Seg/Field/
// Table/Money/Skeleton/EmptyState/ErrorState).
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2): revenue, cost, gross profit, margin and
// the row labels come from the backend; the screen never adds, subtracts or
// divides money — it only picks how to print a value.
//
// Gated on the `costs.view` PERMISSION by the route and the sidebar; the backend
// enforces every request (AD-4).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Banner,
  EmptyState,
  ErrorState,
  Field,
  Kpi,
  Money,
  Skeleton,
  Table,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  ProfitGroupBy,
  ProfitPeriod,
  ProfitReport,
  ProfitReportPort,
  ProfitReportRow,
} from '../../design-system/session/profit-report-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Toolbar, Topbar, WebShell } from '../../design-system/shell';
import { formatPlainDay, ngayNgan } from '../inventory/format-gio';

import './reports.css';

export interface ProfitReportScreenProps {
  port: ProfitReportPort;
}

/** The mandatory scope label (§4) — shown word for word on web and mobile. */
export const PROFIT_SCOPE_LABEL = 'Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung.';
export const PROFIT_NOT_ISSUED_NOTE = 'Đơn chưa xuất kho không có trong báo cáo.';

/** Ways to group, in seg order (mobile twin: kProfitGroupOptions). */
export const PROFIT_GROUP_OPTIONS: { key: ProfitGroupBy; label: string }[] = [
  { key: 'order', label: 'Theo đơn' },
  { key: 'month', label: 'Theo tháng' },
  { key: 'assignee', label: 'Theo sale' },
  { key: 'source', label: 'Theo nguồn khách' },
];

const PERIOD_OPTIONS: { key: ProfitPeriod; label: string }[] = [
  { key: 'month', label: 'Tháng này' },
  { key: 'year', label: 'Năm nay' },
  { key: 'custom', label: 'Tuỳ chọn' },
];

/** Header of the label column per grouping. */
const LABEL_HEADER: Record<ProfitGroupBy, string> = {
  order: 'Đơn',
  month: 'Tháng',
  assignee: 'Sale',
  source: 'Nguồn khách',
};

type LoadState = 'loading' | 'ready' | 'error' | 'awaitingDates' | 'reversedDates';

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Same sentence as the backend's `fieldErrors.to` for this case. */
const REVERSED_DATES_MESSAGE = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
const MAX_DAY = '9999-12-31';

/** Whole percent from the backend; `null` (no revenue) prints a dash. */
function marginText(marginPct: number | null): string {
  return marginPct === null ? '—' : `${marginPct}%`;
}

function isGroupBy(key: string): key is ProfitGroupBy {
  return PROFIT_GROUP_OPTIONS.some((o) => o.key === key);
}

function isPeriod(key: string): key is ProfitPeriod {
  return PERIOD_OPTIONS.some((o) => o.key === key);
}

/** The cells after the label: order rows carry customer/assignee/source/date, the others the order count. */
function detailCells(groupBy: ProfitGroupBy, row: ProfitReportRow): ReactNode {
  if (groupBy !== 'order') return <td className="num mono">{row.orderCount}</td>;
  return (
    <>
      <td>{row.customerName ?? '—'}</td>
      <td>{row.assigneeDisplayName ?? '—'}</td>
      <td>{row.sourceName ?? '—'}</td>
      <td className="mono">{row.issuedAt === null ? '—' : ngayNgan(row.issuedAt)}</td>
    </>
  );
}

export function ProfitReportScreen({ port }: ProfitReportScreenProps) {
  const { perms } = usePermissions();
  const [groupBy, setGroupBy] = useState<ProfitGroupBy>('order');
  const [period, setPeriod] = useState<ProfitPeriod>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Switching quickly sends overlapping requests; only the latest may paint.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    if (period === 'custom' && !(PLAIN_DATE.test(from) && PLAIN_DATE.test(to))) {
      setState('awaitingDates');
      return;
    }
    // A typed date can bypass the pickers' min/max; the backend would only refuse it with a 400
    // that "Thử lại" cannot fix. Plain `YYYY-MM-DD` strings compare in calendar order.
    if (period === 'custom' && from > to) {
      setState('reversedDates');
      return;
    }
    setState('loading');
    try {
      const result = await port.getProfitReport(
        period === 'custom' ? { groupBy, period, from, to } : { groupBy, period },
      );
      if (ticket !== latest.current) return;
      setReport(result);
      setState('ready');
    } catch (err) {
      if (ticket !== latest.current) return;
      const message = (err as { message?: unknown } | null)?.message;
      setErrorMessage(typeof message === 'string' && message !== '' ? message : 'Không tải được báo cáo lợi nhuận.');
      setState('error');
    }
  }, [port, groupBy, period, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = report?.rows ?? [];
  // Columns follow the grouping of the report on screen, not the seg just clicked: the click
  // re-renders once with the old rows before `load` switches to loading.
  const shownGroupBy = report !== null && isGroupBy(report.groupBy) ? report.groupBy : groupBy;

  return (
    <WebShell
      url="app.phuongnamsolar.vn/reports/profit"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="profit" />}
      topbar={<Topbar eyebrow="BÁO CÁO" title="Lợi nhuận gộp" />}
    >
      <div className="pr-wrap">
        {state === 'ready' && report !== null && (
          <div className="kpis">
            <Kpi mono label="Doanh thu" value={<Money value={report.totals.revenue} />} />
            <Kpi mono label="Giá vốn" value={<Money value={report.totals.cost} />} />
            <Kpi accent mono label="Lợi nhuận gộp" value={<Money value={report.totals.grossProfit} />} />
            <Kpi mono label="Biên gộp" value={marginText(report.totals.marginPct)} />
          </div>
        )}

        <Banner tone="info" icon="ic-info">
          {PROFIT_SCOPE_LABEL}
        </Banner>

        <Toolbar>
          <span className="micro muted pr-toolbar-label">Nhóm theo:</span>
          <Seg
            options={PROFIT_GROUP_OPTIONS}
            activeKey={groupBy}
            onSelect={(key) => isGroupBy(key) && setGroupBy(key)}
          />
          <span className="pr-spacer" />
          <Seg options={PERIOD_OPTIONS} activeKey={period} onSelect={(key) => isPeriod(key) && setPeriod(key)} />
        </Toolbar>

        {period === 'custom' && (
          <div className="pr-range">
            {/* The picker cannot cross the other end, nor reach a 5-digit year the query would drop. */}
            <Field label="Từ ngày" type="date" value={from} max={to || MAX_DAY} onChange={(e) => setFrom(e.target.value)} />
            <Field
              label="Đến ngày"
              type="date"
              value={to}
              min={from || undefined}
              max={MAX_DAY}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        )}

        {state === 'ready' && report !== null && (
          <span className="micro muted">
            Xuất kho {formatPlainDay(report.from)} – {formatPlainDay(report.to)}
          </span>
        )}

        {state === 'loading' && (
          <div className="pr-state">
            <Skeleton height={86} />
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {state === 'awaitingDates' && <EmptyState title="Chọn từ ngày và đến ngày" />}

        {state === 'reversedDates' && <EmptyState title={REVERSED_DATES_MESSAGE} />}

        {state === 'error' && <ErrorState message={errorMessage} onRetry={load} retryLabel="Thử lại" />}

        {state === 'ready' && rows.length === 0 && <EmptyState title="Chưa có đơn đã xuất kho trong kỳ này." />}

        {state === 'ready' && rows.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>{LABEL_HEADER[shownGroupBy]}</th>
                {shownGroupBy === 'order' ? (
                  <>
                    <th>Khách</th>
                    <th>Sale</th>
                    <th>Nguồn</th>
                    <th>Ngày xuất</th>
                  </>
                ) : (
                  <th className="num">Số đơn</th>
                )}
                <th className="num">Doanh thu</th>
                <th className="num">Giá vốn</th>
                <th className="num">Lợi nhuận gộp</th>
                <th className="num">Biên</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key ?? 'unassigned'}>
                  <td className="strong mono">{row.label}</td>
                  {detailCells(shownGroupBy, row)}
                  <td className="num">
                    <Money value={row.revenue} />
                  </td>
                  <td className="num">
                    <Money value={row.cost} />
                  </td>
                  <td className="num strong">
                    <Money value={row.grossProfit} />
                  </td>
                  <td className="num mono">{marginText(row.marginPct)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <p className="pr-note">{PROFIT_NOT_ISSUED_NOTE}</p>
      </div>
    </WebShell>
  );
}
