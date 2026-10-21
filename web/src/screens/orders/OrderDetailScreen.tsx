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
// (Story 5.5), reached by one action button here. "Huỷ đơn" (5.7) is the second
// one, and it opens a DIALOG rather than a screen — it collects one line of text
// and nothing else, so a whole screen would be ceremony (UX-DR-19/20).
// "Share báo giá" still leads to a screen that does not exist, and a button to
// nowhere is worse than no button — it stays absent.
//
// THE TWO BUTTONS ARE GATED SEPARATELY. Cancelling is not part of the manual
// lane, so `buocKeTiep` is EMPTY at 'baogia' — the status orders are cancelled
// from most often. Wrapping both in one `buocKeTiep.length > 0` would make the
// cancel button invisible exactly where it is needed.
//
// THE BUTTON'S VISIBILITY IS NOT A PERMISSION CALCULATION. It shows exactly when
// the backend returned a non-empty `buocKeTiep`, and is ABSENT otherwise — not
// greyed (UX-DR-22). The branches need DIFFERENT permission keys, so an any-of
// expression here would be a third copy of the rule and it would drift
// (AD-2/AD-4).
//
// No money math (AD-10/16): every number shown is one the backend computed.
//
// "Phiếu xuất": the order's ONE stock-out. Whether it can be issued
// now (`canIssue`) is the backend's answer; the frame only shows for callers who
// hold a key that reads it (UX only — the backend gates the read too).
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AttachmentGallery,
  Banner,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  ImageUpload,
  Money,
  ScopeFlag,
  Sheet,
  Skeleton,
  StatusChip,
  Stepper,
  Table,
} from '../../design-system/components';
import type { AttachmentGalleryItem } from '../../design-system/components/AttachmentGallery';
import type { ImageUploadItem } from '../../design-system/components/ImageUpload';
import type { StepItem } from '../../design-system/components/Stepper';
import { STATUS_LABELS, type StatusKey } from '../../design-system/components/StatusChip';
import { PERMISSION_KEYS } from '../../design-system/gating/permission-keys.generated';
import { can, filterNav } from '../../design-system/gating/permissions';
import type {
  AttachmentItem,
  Order,
  OrderLifecycleStep,
  OrderNextStep,
  OrdersPort,
  OrderStockIssueView,
  OrderVersionItem,
} from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Tabs, Topbar, WebShell } from '../../design-system/shell';

import { ngayGio } from '../inventory/format-gio';
import { rowErrors, StockIssuePreview, type RowErrors } from './stock-issue-preview';
import './order-detail.css';

export interface OrderDetailScreenProps {
  port: OrdersPort;
  orderId: string;
  onBack?: () => void;
  /** Opens the status-change screen (Story 5.5). Absent = the button never renders. */
  onChangeStatus?: () => void;
}

// 'notfound' is its own state, NOT a flavour of 'error': "this order does not
// exist, or is not yours" is an answer, and pressing "Thử lại" on an answer just
// asks the same question again (UX-DR-19, AC-13).
type LoadState = 'loading' | 'ready' | 'error' | 'notfound';

const TAB_THONG_TIN = 'thong-tin';
const TAB_LICH_SU = 'lich-su';
const TAB_ANH = 'anh';

// Exactly three tabs. Thanh toán + Hợp đồng/Hoá đơn are Epic 7 — rendering an
// empty tab for a feature that does not exist promises the user something nobody
// built. Ảnh shipped in Story 5.6.
const TABS = [
  { key: TAB_THONG_TIN, label: 'Thông tin' },
  { key: TAB_LICH_SU, label: 'Lịch sử update' },
  { key: TAB_ANH, label: 'Ảnh' },
];

/**
 * The photo ceiling the backend enforces per upload. Mirrored here only to stop
 * the picker offering an eleventh tile — the refusal itself stays server-side.
 */
const SO_ANH_TOI_DA = 10;

/**
 * One picked photo held in TWO shapes at once: the `File` that gets posted, and
 * the `ImageUploadItem` the shipped picker draws a thumbnail from. Kept side by
 * side under one temporary id so removing a thumbnail removes the right File.
 */
interface AnhDaChon {
  id: string;
  file: File;
  item: ImageUploadItem;
}

/**
 * Narrow the port's `string` status to the chip's strict union. The port mirrors
 * the backend DTO (`string`); an unchecked cast would fail SILENTLY here because
 * web has no tsc yet (TD-1).
 */
function isStatusKey(value: string): value is StatusKey {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

/** Status key → its shipped Vietnamese label; unknown keys render verbatim. */
function nhanTrangThai(value: string): string {
  return isStatusKey(value) ? STATUS_LABELS[value] : value;
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

export function OrderDetailScreen({
  port,
  orderId,
  onBack,
  onChangeStatus,
}: OrderDetailScreenProps) {
  const { perms } = usePermissions();

  const [order, setOrder] = useState<Order | null>(null);
  const [steps, setSteps] = useState<OrderLifecycleStep[]>([]);
  const [buocKeTiep, setBuocKeTiep] = useState<OrderNextStep[]>([]);
  // Backend-computed (AD-2/AD-4). The screen never asks "is the status one of
  // these three" — that rule lives in the transition table.
  const [coTheHuy, setCoTheHuy] = useState(false);
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
      setSteps(buoc.buoc);
      setBuocKeTiep(buoc.buocKeTiep);
      setCoTheHuy(buoc.coTheHuy);
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

  // ---- Tab Ảnh (Story 5.6) -------------------------------------------------
  // Loaded LAZILY, on first open of the tab: photos are the heaviest thing on
  // this screen and most visits never open it. Folding them into `load()` above
  // would make every detail view pay for a panel nobody asked for.
  const [anhItems, setAnhItems] = useState<AttachmentItem[]>([]);
  const [anhPreviews, setAnhPreviews] = useState<Record<string, string>>({});
  const [anhState, setAnhState] = useState<LoadState>('loading');
  const [anhDaMo, setAnhDaMo] = useState(false);
  const [anhDaChon, setAnhDaChon] = useState<AnhDaChon[]>([]);
  const [xoaId, setXoaId] = useState<string | null>(null);
  const anhLatest = useRef(0);
  const seq = useRef(0);
  // Every object URL this tab has minted, so it can hand each one back. The
  // browser holds the whole blob alive until revoke — at 10 MB a photo, a tab
  // reloaded a few times after adding and deleting would pin hundreds of MB
  // that nothing on screen still points at.
  const anhUrls = useRef<string[]>([]);

  const thuHoiAnhUrls = useCallback(() => {
    for (const url of anhUrls.current) URL.revokeObjectURL(url);
    anhUrls.current = [];
  }, []);

  // The tab can be left open when the screen goes away; the URLs outlive it.
  useEffect(() => thuHoiAnhUrls, [thuHoiAnhUrls]);

  const loadAnh = useCallback(async () => {
    const ticket = ++anhLatest.current;
    setAnhState('loading');
    // The previous batch is dead the moment a reload starts: the list is about
    // to be replaced, and a deleted photo's URL would otherwise never be freed.
    thuHoiAnhUrls();
    setAnhPreviews({});
    try {
      const danhSach = await port.listAnh(orderId);
      if (ticket !== anhLatest.current) return;
      setAnhItems(danhSach);
      setAnhState('ready');
      // Bytes come through the authenticated proxy, ONE call per photo; the
      // gallery component never fetches (AD-3). A photo whose bytes fail simply
      // keeps the placeholder glyph — one broken image must not blank the tab.
      for (const item of danhSach) {
        try {
          const blob = await port.anhBytes(orderId, item.id);
          const url = URL.createObjectURL(blob);
          // A newer load already revoked this batch — hand the URL straight
          // back instead of parking it in state nothing reads.
          if (ticket !== anhLatest.current) {
            URL.revokeObjectURL(url);
            return;
          }
          anhUrls.current.push(url);
          setAnhPreviews((truoc) => ({ ...truoc, [item.id]: url }));
        } catch {
          /* placeholder glyph stands in */
        }
      }
    } catch {
      if (ticket !== anhLatest.current) return;
      setAnhState('error');
    }
  }, [port, orderId, thuHoiAnhUrls]);

  const moTab = useCallback(
    (key: string) => {
      setTab(key);
      if (key === TAB_ANH && !anhDaMo) {
        setAnhDaMo(true);
        void loadAnh();
      }
    },
    [anhDaMo, loadAnh],
  );

  const chonAnh = useCallback((files: File[]) => {
    setAnhDaChon((truoc) => [
      ...truoc,
      ...files.map((file) => {
        seq.current += 1;
        const id = `anh-moi-${seq.current}`;
        return {
          id,
          file,
          item: { id, url: URL.createObjectURL(file), name: file.name },
        };
      }),
    ]);
  }, []);

  const boAnhDaChon = useCallback((id: string) => {
    setAnhDaChon((truoc) => {
      const bo = truoc.find((a) => a.id === id);
      if (bo?.item.url) URL.revokeObjectURL(bo.item.url);
      return truoc.filter((a) => a.id !== id);
    });
  }, []);

  const guiAnh = useCallback(async () => {
    if (anhDaChon.length === 0) return;
    try {
      await port.themAnh(orderId, anhDaChon.map((a) => a.file));
      // Previews are revoked only after the post succeeded — a failed attempt
      // keeps its thumbnails so the user can retry without re-picking.
      for (const a of anhDaChon) if (a.item.url) URL.revokeObjectURL(a.item.url);
      setAnhDaChon([]);
      await loadAnh();
    } catch {
      setAnhState('error');
    }
  }, [port, orderId, anhDaChon, loadAnh]);

  const xacNhanXoa = useCallback(async () => {
    if (xoaId === null) return;
    const id = xoaId;
    setXoaId(null);
    try {
      await port.xoaAnh(orderId, id);
      await loadAnh();
    } catch {
      setAnhState('error');
    }
  }, [port, orderId, xoaId, loadAnh]);

  // ---- Phiếu xuất ---------------------------------------------
  const canSeeStockIssue =
    can(perms, PERMISSION_KEYS.inventoryManage) || can(perms, PERMISSION_KEYS.deliveryConfirm);
  const [stockIssue, setStockIssue] = useState<OrderStockIssueView | null>(null);
  const [issueSheetOpen, setIssueSheetOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueLineErrors, setIssueLineErrors] = useState<RowErrors>({});
  const stockIssueLatest = useRef(0);

  // A failed read leaves the frame without content rather than blanking the
  // screen: the stock-out is one panel of the order, not the order.
  const loadStockIssue = useCallback(async () => {
    const ticket = ++stockIssueLatest.current;
    try {
      const view = await port.getStockIssue(orderId);
      if (ticket === stockIssueLatest.current) setStockIssue(view);
    } catch {
      if (ticket === stockIssueLatest.current) setStockIssue(null);
    }
  }, [port, orderId]);

  useEffect(() => {
    if (canSeeStockIssue) void loadStockIssue();
  }, [canSeeStockIssue, loadStockIssue]);

  const confirmIssue = useCallback(async () => {
    if (issuing) return;
    setIssuing(true);
    setIssueError(null);
    setIssueLineErrors({});
    try {
      await port.issueStock(orderId);
      setIssueSheetOpen(false);
      await loadStockIssue();
    } catch (err) {
      const message = (err as { message?: string } | null)?.message;
      setIssueError(message ?? 'Không xuất kho được.');
      setIssueLineErrors(rowErrors(err));
      // Show the current numbers next to the backend's row messages; a failed
      // re-read keeps the preview the user was looking at.
      const ticket = ++stockIssueLatest.current;
      try {
        const view = await port.getStockIssue(orderId);
        if (ticket === stockIssueLatest.current) setStockIssue(view);
      } catch {
        // keep the previous preview
      }
    } finally {
      setIssuing(false);
    }
  }, [port, orderId, issuing, loadStockIssue]);

  // ---- Huỷ đơn (Story 5.7) -------------------------------------------------
  const [moHuy, setMoHuy] = useState(false);
  const [lyDoHuy, setLyDoHuy] = useState('');
  const [loiHuy, setLoiHuy] = useState<string | null>(null);
  const [dangHuy, setDangHuy] = useState(false);

  // Opening this dialog CLOSES the delete-photo one. Overlays stack at most one
  // level (UX-DR-20), and these two live on the same screen.
  const moDialogHuy = useCallback(() => {
    setXoaId(null);
    setLyDoHuy('');
    setLoiHuy(null);
    setMoHuy(true);
  }, []);

  const xacNhanHuy = useCallback(async () => {
    // Blocking an empty reason here is UX only — the backend refuses it too
    // (AD-4), and it owns the exact rule.
    if (lyDoHuy.trim() === '' || dangHuy) return;
    setDangHuy(true);
    setLoiHuy(null);
    try {
      await port.huyDon(orderId, lyDoHuy);
      setMoHuy(false);
      // Status, `cancelReason` and the lifecycle all changed — reload rather
      // than patch local state, so the screen keeps showing one truth.
      await load();
    } catch (err) {
      // The server's message verbatim: it is the one that knows WHY.
      const message = (err as { message?: string } | null)?.message;
      setLoiHuy(message ?? 'Không huỷ được đơn.');
    } finally {
      setDangHuy(false);
    }
  }, [port, orderId, lyDoHuy, dangHuy, load]);

  /**
   * Port item → gallery item. The step badge is built from the SHIPPED status
   * label table — a third label table for the same statuses would drift.
   */
  const galleryItems: AttachmentGalleryItem[] = anhItems.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    nguoiTaiLen: item.nguoiTaiLen,
    createdAt: item.createdAt,
    statusTo: item.statusTo,
    buocLabel:
      item.statusFrom !== null && item.statusTo !== null
        ? `Bước: ${nhanTrangThai(item.statusFrom)} → ${nhanTrangThai(item.statusTo)}`
        : undefined,
    previewSrc: anhPreviews[item.id],
    // Backend-computed (AD-2) — the screen renders it, never rebuilds it.
    coTheXoa: item.coTheXoa,
  }));

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
              {((buocKeTiep.length > 0 && onChangeStatus) || coTheHuy) && (
                <div className="od-actions">
                  {buocKeTiep.length > 0 && onChangeStatus && (
                    <Button variant="primary" onClick={onChangeStatus}>
                      Chuyển trạng thái
                    </Button>
                  )}
                  {coTheHuy && (
                    <Button variant="danger" onClick={moDialogHuy}>
                      Huỷ đơn
                    </Button>
                  )}
                </div>
              )}
            </Frame>

            {canSeeStockIssue && stockIssue !== null && (
              <Frame label="Phiếu xuất" onBg>
                {stockIssue.issued && stockIssue.voucher !== undefined && (
                  <div className="si-preview">
                    <p className="si-status">
                      <span className="mono strong">{stockIssue.voucher.ma}</span> ·{' '}
                      <span className="mono">{ngayGio(stockIssue.voucher.createdAt)}</span> ·{' '}
                      {stockIssue.voucher.nguoiTao.displayName}
                    </p>
                    <Table>
                      <thead>
                        <tr>
                          <th>Sản phẩm</th>
                          <th className="num">SL</th>
                          {stockIssue.voucher.lines.some((l) => l.unitCost !== undefined) && (
                            <th className="num">Giá vốn / đv</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {stockIssue.voucher.lines.map((l) => (
                          <tr key={l.productId}>
                            <td>{l.ten}</td>
                            <td className="num mono">{l.qty}</td>
                            {stockIssue.voucher!.lines.some((x) => x.unitCost !== undefined) && (
                              <td className="num mono">
                                {l.unitCost !== undefined ? <Money value={l.unitCost} /> : ''}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
                {!stockIssue.issued && stockIssue.canIssue && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setIssueError(null);
                      setIssueLineErrors({});
                      setIssueSheetOpen(true);
                    }}
                  >
                    Xuất kho
                  </Button>
                )}
                {!stockIssue.issued && !stockIssue.canIssue && (
                  <p className="si-status">Chưa xuất kho.</p>
                )}
              </Frame>
            )}

            <Tabs tabs={TABS} activeKey={tab} onSelect={moTab} />

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
                {order.cancelReason !== null && (
                  <div className="od-kv">
                    <span className="od-k">Lý do huỷ</span>
                    <span className="od-v">{order.cancelReason}</span>
                  </div>
                )}
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
                        {/* Backend-computed number, displayed via <Money> (AD-10). */}
                        <td className="od-mono">
                          <Money value={line.amount} />
                        </td>
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

            {tab === TAB_ANH && anhState === 'loading' && (
              <div className="od-state">
                <Skeleton />
                <Skeleton />
              </div>
            )}

            {tab === TAB_ANH && anhState === 'error' && (
              <ErrorState
                message="Không tải được ảnh của đơn."
                retryLabel="Thử lại"
                onRetry={() => void loadAnh()}
              />
            )}

            {tab === TAB_ANH && anhState === 'ready' && (
              <div className="od-anh">
                <AttachmentGallery
                  items={galleryItems}
                  onDelete={setXoaId}
                  emptyLabel="Chưa có ảnh nào."
                />
                <div className="od-anh-them">
                  <h3 className="od-anh-title">Thêm ảnh bổ sung</h3>
                  {/* The shipped picker holds LOCAL files only; posting them is
                      this screen's job (AD-3). */}
                  <ImageUpload
                    images={anhDaChon.map((a) => a.item)}
                    onAdd={chonAnh}
                    onRemove={boAnhDaChon}
                    max={SO_ANH_TOI_DA}
                  />
                  {anhDaChon.length > 0 && (
                    <Button onClick={() => void guiAnh()}>Thêm ảnh</Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* The delete dialog and the picker's sheet are two SEPARATE flows: they
          never open together, so overlays stack at most one deep (UX-DR-20). */}
      <Dialog
        open={moHuy}
        title="Huỷ đơn"
        tone="danger"
        onClose={() => setMoHuy(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoHuy(false)}>
              Đóng
            </Button>
            <Button
              variant="danger"
              disabled={lyDoHuy.trim() === '' || dangHuy}
              onClick={() => void xacNhanHuy()}
            >
              Xác nhận huỷ
            </Button>
          </>
        }
      >
        <p className="od-huy-hq">
          Đơn sẽ đóng lại và không tiếp tục được. Thao tác này không hoàn tác được.
        </p>
        <Field
          label="Lý do huỷ"
          multiline
          rows={3}
          value={lyDoHuy}
          onChange={(e) => setLyDoHuy(e.target.value)}
          maxLength={500}
        />
        {loiHuy !== null && <p className="od-huy-loi">{loiHuy}</p>}
      </Dialog>

      <Sheet
        open={issueSheetOpen}
        // Not while the request is in flight: the caller must see how it ended.
        onClose={() => {
          if (!issuing) setIssueSheetOpen(false);
        }}
        title="Phiếu xuất kho"
      >
        {stockIssue !== null && (
          <div className="si-preview">
            <StockIssuePreview view={stockIssue} errors={issueLineErrors} />
            {issueError !== null && (
              <Banner tone="danger" role="alert">
                {issueError}
              </Banner>
            )}
            {/* Locked while the backend warns the stock is short right now. */}
            <Button
              variant="primary"
              disabled={issuing || stockIssue.blocked}
              onClick={() => void confirmIssue()}
            >
              {stockIssue.blocked ? 'Xuất kho (bị chặn)' : 'Xác nhận xuất kho'}
            </Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={xoaId !== null}
        title="Xoá ảnh"
        consequence="Ảnh sẽ bị xoá vĩnh viễn và không khôi phục được."
        tone="danger"
        onConfirm={() => void xacNhanXoa()}
        onCancel={() => setXoaId(null)}
      />
    </WebShell>
  );
}
