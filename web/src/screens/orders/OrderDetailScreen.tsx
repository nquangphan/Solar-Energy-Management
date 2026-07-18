// hand-authored — web app-screen (Story 5.4). Chi tiết đơn: lifecycle stepper +
// two tabs (facts / update history), composed from shipped components
// (Stepper/Tabs/StatusChip/Table/Frame/Skeleton/EmptyState/ErrorState).
//
// THE STEP SEQUENCE IS NOT COMPUTED HERE. Which steps this order has, and which
// one it is standing on, come from `getLifecycle()` — the backend derives them
// from the one transition table (AD-2/AD-11). A second copy of that logic on the
// client would drift the first time Epic 6 changes the real one, and the screen
// would keep drawing the old lifecycle confidently.
//
// Steps blocked by a scope flag are ABSENT from the response, so nothing is
// filtered here and nothing renders dimmed (UX-DR-11).
//
// The status chip is READ-ONLY (UX-DR-23): changing status is its own screen
// (Story 5.5). No action buttons at all here — "Chuyển trạng thái" (5.5), "Huỷ
// đơn" (5.7) and "Share báo giá" all lead to screens that do not exist yet, and
// a button to nowhere is worse than no button.
//
// No money math (AD-10/16): every number shown is one the backend computed.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EmptyState,
  ErrorState,
  Frame,
  ScopeFlag,
  Skeleton,
  StatusChip,
  Stepper,
  Table,
} from '../../design-system/components';
import type { StepItem } from '../../design-system/components/Stepper';
import { STATUS_LABELS, type StatusKey } from '../../design-system/components/StatusChip';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  Order,
  OrderLifecycleStep,
  OrdersPort,
  OrderVersionItem,
} from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Tabs, Topbar, WebShell } from '../../design-system/shell';

import './order-detail.css';

export interface OrderDetailScreenProps {
  port: OrdersPort;
  orderId: string;
  onBack?: () => void;
}

// 'notfound' is its own state, NOT a flavour of 'error': "this order does not
// exist, or is not yours" is an answer, and pressing "Thử lại" on an answer just
// asks the same question again (UX-DR-19, AC-13).
type LoadState = 'loading' | 'ready' | 'error' | 'notfound';

const TAB_THONG_TIN = 'thong-tin';
const TAB_LICH_SU = 'lich-su';

// Exactly two tabs. Thanh toán + Hợp đồng/Hoá đơn are Epic 7 and Ảnh is Story
// 5.6 — rendering an empty tab for a feature that does not exist promises the
// user something nobody built.
const TABS = [
  { key: TAB_THONG_TIN, label: 'Thông tin' },
  { key: TAB_LICH_SU, label: 'Lịch sử update' },
];

/**
 * Narrow the port's `string` status to the chip's strict union. The port mirrors
 * the backend DTO (`string`); an unchecked cast would fail SILENTLY here because
 * web has no tsc yet (TD-1).
 */
function isStatusKey(value: string): value is StatusKey {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

/**
 * Lifecycle step → `StepItem`. `upcoming` maps to NO `state` (the component's
 * default). `gate` is deliberately never used: in this system a gated step is
 * hidden entirely, so the dashed-border state has no valid case on this screen.
 */
function toStepItems(steps: OrderLifecycleStep[]): StepItem[] {
  return steps.map((step) => ({
    label: isStatusKey(step.status) ? STATUS_LABELS[step.status] : step.status,
    state: step.trangThai === 'done' || step.trangThai === 'current' ? step.trangThai : undefined,
  }));
}

/** One version's change set as a short Vietnamese summary; "Bản gốc" for the first. */
function summarise(version: OrderVersionItem): string {
  if (version.versionNo === 1) return 'Bản gốc';
  const parts: string[] = [];
  if (version.thayDoi.them.length > 0) parts.push(`thêm ${version.thayDoi.them.length} dòng`);
  if (version.thayDoi.xoa.length > 0) parts.push(`xoá ${version.thayDoi.xoa.length} dòng`);
  if (version.thayDoi.doiSoLuong.length > 0) {
    parts.push(`đổi SL ${version.thayDoi.doiSoLuong.length} dòng`);
  }
  return parts.length === 0 ? 'Không đổi dòng nào' : parts.join(' · ');
}

export function OrderDetailScreen({ port, orderId, onBack }: OrderDetailScreenProps) {
  const { perms } = usePermissions();

  const [order, setOrder] = useState<Order | null>(null);
  const [steps, setSteps] = useState<OrderLifecycleStep[]>([]);
  const [versions, setVersions] = useState<OrderVersionItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [tab, setTab] = useState(TAB_THONG_TIN);

  // Three requests, ONE ticket for the whole batch: they are one screenful of
  // one order, so a stale batch must be discarded as a batch. Three separate
  // tickets would let a slow reply from a previous order repaint one panel of
  // the current one.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      const [don, buoc, banUpdate] = await Promise.all([
        port.get(orderId),
        port.getLifecycle(orderId),
        port.listVersions(orderId),
      ]);
      if (ticket !== latest.current) return;
      setOrder(don);
      setSteps(buoc);
      setVersions(banUpdate);
      setState('ready');
    } catch (err) {
      if (ticket !== latest.current) return;
      const code = (err as { code?: string } | null)?.code;
      setState(code === 'NOT_FOUND' ? 'notfound' : 'error');
    }
  }, [port, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WebShell
      url="app.phuongnamsolar.vn/don-hang"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />}
      // `Topbar` already renders back as an icon-only <button> carrying
      // aria-label="Quay lại" (UX-DR-26) — a second one here would be a second
      // contract to keep in sync with mobile.
      topbar={<Topbar eyebrow="ĐƠN HÀNG" title="Chi tiết đơn" onBack={onBack} />}
    >
      <div className="od-wrap">
        {state === 'loading' && (
          <div className="od-state">
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <div className="od-state-msg">Đang tải chi tiết đơn…</div>
          </div>
        )}

        {state === 'error' && (
          <ErrorState message="Không tải được chi tiết đơn." retryLabel="Thử lại" onRetry={load} />
        )}

        {state === 'notfound' && (
          <ErrorState message="Không tìm thấy đơn này." retryLabel="Thử lại" onRetry={load} />
        )}

        {state === 'ready' && order !== null && (
          <>
            <Frame label="Vòng đời đơn" onBg>
              <Stepper steps={toStepItems(steps)} />
            </Frame>

            <Tabs tabs={TABS} activeKey={tab} onSelect={setTab} />

            {tab === TAB_THONG_TIN && (
              <div className="od-facts">
                <div className="od-kv">
                  <span className="od-k">Mã đơn</span>
                  <span className="od-v od-mono">{order.id}</span>
                </div>
                <div className="od-kv">
                  <span className="od-k">SĐT khách</span>
                  <span className="od-v od-mono">{order.customerSdt}</span>
                </div>
                <div className="od-kv">
                  <span className="od-k">Trạng thái</span>
                  <span className="od-v">
                    {isStatusKey(order.status) ? (
                      <StatusChip status={order.status} />
                    ) : (
                      order.status
                    )}
                  </span>
                </div>
                <div className="od-kv">
                  <span className="od-k">Công suất</span>
                  <span className="od-v">{order.kWp === null ? '—' : `${order.kWp} kWp`}</span>
                </div>
                <div className="od-kv">
                  <span className="od-k">Người phụ trách</span>
                  <span className="od-v">{order.assigneeAccountId ?? '—'}</span>
                </div>
                <div className="od-kv">
                  <span className="od-k">Phạm vi</span>
                  {/* All three flags always render: the shipped ScopeFlag strikes
                      the off ones through, so "Thi công is off" reads differently
                      from "the screen forgot to draw it". */}
                  <span className="od-v od-scope">
                    <ScopeFlag on={order.scopeThietBi}>Thiết bị</ScopeFlag>
                    <ScopeFlag on={order.scopeThiCong}>Thi công</ScopeFlag>
                    <ScopeFlag on={order.scopeVanChuyen}>Vận chuyển</ScopeFlag>
                  </span>
                </div>

                <Table>
                  <thead>
                    <tr>
                      <th>Hạng mục</th>
                      <th>ĐVT</th>
                      <th>SL</th>
                      <th>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lineItems.map((line) => (
                      <tr key={line.id}>
                        <td>{line.name}</td>
                        <td>{line.unit}</td>
                        <td>{line.qty}</td>
                        {/* Backend-computed number, rendered as given (AD-10). */}
                        <td className="od-mono">{line.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {tab === TAB_LICH_SU && versions.length === 0 && (
              <EmptyState title="Chưa có bản update nào" message="Đơn vẫn ở bản gốc." />
            )}

            {tab === TAB_LICH_SU && versions.length > 0 && (
              <ul className="od-versions">
                {versions.map((version) => (
                  <li className="od-version" key={version.id}>
                    <div className="od-version-head">
                      <span className="od-version-no">Bản {version.versionNo}</span>
                      {version.laBanHienLuc && <span className="od-badge">Bản hiệu lực</span>}
                    </div>
                    <div className="od-version-meta">
                      {/* No invented name: a version created before the actor
                          column existed simply has no author. */}
                      <span>{version.createdByDisplayName ?? '—'}</span>
                      <span className="od-mono">{version.createdAt}</span>
                      <span>{version.soDong} dòng</span>
                    </div>
                    <div className="od-version-diff">{summarise(version)}</div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </WebShell>
  );
}
