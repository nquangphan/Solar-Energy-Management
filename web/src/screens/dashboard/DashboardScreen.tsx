// hand-authored — web app-screen (Story 8.1). Trang chủ: the operations dashboard
// for the chosen period — money collected, new orders, and orders per status.
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2). The screen never adds, compares or scales
// money; the chart scales counts only. Whether Doanh thu shows is decided by the
// backend: a caller without the finance permission gets `revenue: null` and the
// KPI is not rendered at all (AD-4) — the screen holds no permission rule of its own.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BarChart,
  EmptyState,
  ErrorState,
  Frame,
  Kpi,
  Money,
  Skeleton,
  STATUS_LABELS,
} from '../../design-system/components';
import type { StatusKey } from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  DashboardPeriod,
  DashboardPort,
  DashboardSummary,
} from '../../design-system/session/dashboard-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Toolbar, Topbar, WebShell } from '../../design-system/shell';
import { formatPlainDay } from '../inventory/format-gio';

import './dashboard.css';

export interface DashboardScreenProps {
  port: DashboardPort;
}

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden';

const PERIOD_OPTIONS: { key: DashboardPeriod; label: string }[] = [
  { key: 'day', label: 'Ngày' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng này' },
];

/** Suffix of the KPI labels. TWIN of `kPeriodNoun` in the Flutter screen. */
const PERIOD_NOUN: Record<DashboardPeriod, string> = {
  day: 'hôm nay',
  week: 'tuần này',
  month: 'tháng này',
};

export function DashboardScreen({ port }: DashboardScreenProps) {
  const { perms } = usePermissions();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  // Switching period quickly sends overlapping requests; only the latest may paint.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      const result = await port.getSummary(period);
      if (ticket !== latest.current) return;
      setSummary(result);
      setState('ready');
    } catch (error) {
      if (ticket !== latest.current) return;
      // 403: the account may see no block at all — retrying cannot help.
      setState((error as { status?: number }).status === 403 ? 'forbidden' : 'error');
    }
  }, [port, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const noun = PERIOD_NOUN[period];

  return (
    <WebShell
      url="app.phuongnamsolar.vn"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="home" />}
      topbar={<Topbar eyebrow="TRANG CHỦ" title="Tổng quan vận hành" />}
    >
      <div className="db-wrap">
        <Toolbar>
          <Seg
            options={PERIOD_OPTIONS}
            activeKey={period}
            onSelect={(key) => setPeriod(key as DashboardPeriod)}
          />
          {state === 'ready' && summary && (
            <span className="micro muted db-range">
              {formatPlainDay(summary.from)} – {formatPlainDay(summary.to)}
            </span>
          )}
        </Toolbar>

        {state === 'loading' && (
          <div className="db-state">
            <Skeleton height={86} />
            <Skeleton height={180} />
          </div>
        )}

        {state === 'error' && <ErrorState message="Không tải được số liệu." onRetry={load} retryLabel="Thử lại" />}

        {state === 'forbidden' && <EmptyState title="Không có số liệu cho tài khoản này" />}

        {state === 'ready' && summary && (
          <>
            <div className="kpis db-kpis">
              {summary.revenue !== null && (
                <Kpi accent mono label={`Doanh thu ${noun}`} value={<Money value={summary.revenue} />} />
              )}
              {summary.newOrderCount !== null && (
                <Kpi mono label={`Đơn mới ${noun}`} value={summary.newOrderCount} />
              )}
            </div>
            {summary.ordersByStatus !== null && (
              <Frame label="Đơn theo trạng thái" onBg className="db-chart">
                <BarChart
                  items={summary.ordersByStatus.map((s) => ({
                    label: STATUS_LABELS[s.status as StatusKey],
                    value: s.count,
                  }))}
                />
              </Frame>
            )}
          </>
        )}
      </div>
    </WebShell>
  );
}
