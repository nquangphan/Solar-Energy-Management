// hand-authored — web app-screen (Story 5.5). Chuyển trạng thái: pick the next
// step, optionally attach evidence photos, submit.
//
// A SCREEN, NOT A DIALOG. UX-DR-20 wants a Dialog for consequential actions, but
// the shipped ImageUpload's mobile twin opens its own AppSheet — a Dialog here
// would stack two overlay layers, and UX-DR-20 also caps overlays at one. The UX
// inventory already lists this as a screen (`s-status-change`).
//
// WHICH STEPS EXIST IS NOT COMPUTED HERE. `nextSteps` arrives from the backend
// already filtered by the order's status, its scope flags and the caller's real
// permissions (AD-2/AD-4). The branches require DIFFERENT permission keys, so an
// any-of expression on the client would be a third copy of the rule and it would
// drift. An empty array is a real answer: this caller has no legal step.
//
// The screen NEVER touches R2. It collects File[] and hands them to the port;
// upload, object keys and the transaction all belong to the backend (AD-3).
//
// "Đã giao" ISSUES THE ORDER'S STOCK when it was not issued yet, in
// the same commit as the status change. Picking that step loads the backend's
// stock-out preview; the button says what will happen, so it stays disabled
// until that preview is on screen (a failed read offers a retry, never a silent
// fallback label). Whether the stock is enough is the backend's 409, placed
// under the row it names, next to a re-read preview.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  ErrorState,
  Frame,
  ImageUpload,
  Skeleton,
  StatusChip,
} from '../../design-system/components';
import type { ImageUploadItem } from '../../design-system/components/ImageUpload';
import { STATUS_LABELS, type StatusKey } from '../../design-system/components/StatusChip';
import { filterNav } from '../../design-system/gating/permissions';
import {
  EVENT_DELIVERED,
  type OrderNextStep,
  type OrdersPort,
  type OrderStockIssueView,
} from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import { rowErrors, StockIssuePreview, type RowErrors } from './stock-issue-preview';
import './order-status-change.css';

export interface OrderStatusChangeScreenProps {
  port: OrdersPort;
  orderId: string;
  onBack?: () => void;
  /** Called after the transition committed — the caller navigates back and refetches. */
  onDone?: (status: string) => void;
}

type LoadState = 'loading' | 'ready' | 'error';
type PreviewState = 'idle' | LoadState;

/**
 * The photo ceiling the backend enforces. Mirrored here only to stop the picker
 * offering an eleventh tile — the refusal itself stays server-side. Named to
 * match the mobile twin's `_kSoAnhToiDa` rather than sitting inline as a 10.
 */
const SO_ANH_TOI_DA = 10;

/**
 * One picked photo held in TWO shapes at once: the `File` that gets posted, and
 * the `ImageUploadItem` the shipped component draws a thumbnail from. They are
 * kept side by side under one temporary id so removing a thumbnail removes the
 * right File — matching them by name/index would break on two photos taken in
 * the same second.
 */
interface AnhDaChon {
  id: string;
  file: File;
  item: ImageUploadItem;
}

/** Narrow the port's `string` status to the chip's strict union (web has no tsc, TD-1). */
function isStatusKey(value: string): value is StatusKey {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

/** The destination's Vietnamese label — from STATUS_LABELS, never a third table. */
function nhanDich(step: OrderNextStep): string {
  return isStatusKey(step.to) ? STATUS_LABELS[step.to] : step.to;
}

export function OrderStatusChangeScreen({
  port,
  orderId,
  onBack,
  onDone,
}: OrderStatusChangeScreenProps) {
  const { perms } = usePermissions();

  const [steps, setSteps] = useState<OrderNextStep[]>([]);
  const [chon, setChon] = useState<string | null>(null);
  const [anh, setAnh] = useState<AnhDaChon[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [dangGui, setDangGui] = useState(false);
  const [loiGui, setLoiGui] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<RowErrors>({});
  const [stockIssue, setStockIssue] = useState<OrderStockIssueView | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>('idle');

  const latest = useRef(0);
  const seq = useRef(0);
  const stockIssueTicket = useRef(0);

  // The stock-out preview belongs to the "Đã giao" step only. A late answer for
  // a step the user already left is dropped (ticket).
  const loadPreview = useCallback(() => {
    const ticket = ++stockIssueTicket.current;
    setPreviewState('loading');
    port.getStockIssue(orderId).then(
      (view) => {
        if (ticket !== stockIssueTicket.current) return;
        setStockIssue(view);
        setPreviewState('ready');
      },
      () => {
        if (ticket === stockIssueTicket.current) setPreviewState('error');
      },
    );
  }, [port, orderId]);

  useEffect(() => {
    // A new step drops everything that belonged to the previous one.
    setStockIssue(null);
    setLineErrors({});
    setLoiGui(null);
    if (chon !== EVENT_DELIVERED) {
      ++stockIssueTicket.current;
      setPreviewState('idle');
      return;
    }
    loadPreview();
  }, [chon, loadPreview]);

  const willIssue = stockIssue !== null && !stockIssue.issued && stockIssue.lines.length > 0;

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      const vongDoi = await port.getLifecycle(orderId);
      if (ticket !== latest.current) return;
      setSteps(vongDoi.nextSteps);
      // Preselect only when there is exactly one choice: with two open branches
      // (thi công / giao hàng) a default would make a consequential decision for
      // the user, and both branches are one click from committing.
      setChon(vongDoi.nextSteps.length === 1 ? vongDoi.nextSteps[0].event : null);
      setState('ready');
    } catch {
      if (ticket !== latest.current) return;
      setState('error');
    }
  }, [port, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addAttachments = useCallback((files: File[]) => {
    setAnh((truoc) => [
      ...truoc,
      ...files.map((file) => {
        seq.current += 1;
        const id = `anh-${seq.current}`;
        return {
          id,
          file,
          // The object URL is a PREVIEW only; the bytes posted are the File.
          item: { id, url: URL.createObjectURL(file), name: file.name },
        };
      }),
    ]);
  }, []);

  const boAnh = useCallback((id: string) => {
    setAnh((truoc) => {
      const bo = truoc.find((a) => a.id === id);
      if (bo?.item.url) URL.revokeObjectURL(bo.item.url);
      return truoc.filter((a) => a.id !== id);
    });
  }, []);

  const gui = useCallback(async () => {
    if (chon === null) return;
    setDangGui(true);
    setLoiGui(null);
    setLineErrors({});
    try {
      const ketQua = await port.transition(
        orderId,
        chon,
        anh.map((a) => a.file),
      );
      // Previews are revoked only after the post succeeded — a failed attempt
      // keeps its thumbnails so the user can retry without re-picking.
      for (const a of anh) if (a.item.url) URL.revokeObjectURL(a.item.url);
      onDone?.(ketQua.status);
    } catch (err) {
      // The backend owns the status/permission rules, so it owns the words for
      // them: its message is rendered verbatim. Screen copy is the fallback for
      // transport failures the backend never saw.
      const message = (err as { message?: string } | null)?.message;
      setLoiGui(message ?? 'Không chuyển được trạng thái.');
      setLineErrors(rowErrors(err));
      // The refusal may be about stock that moved since the preview was read —
      // show the current numbers next to the backend's row messages.
      if (chon === EVENT_DELIVERED) loadPreview();
    } finally {
      setDangGui(false);
    }
  }, [port, orderId, chon, anh, onDone, loadPreview]);

  return (
    <WebShell
      url="app.phuongnamsolar.vn/don-hang"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />}
      topbar={<Topbar eyebrow="ĐƠN HÀNG" title="Chuyển trạng thái" onBack={onBack} />}
    >
      <div className="sc-wrap">
        {state === 'loading' && (
          <div className="sc-state">
            <Skeleton />
            <Skeleton />
            <div className="sc-state-msg">Đang tải bước kế tiếp…</div>
          </div>
        )}

        {state === 'error' && (
          <ErrorState
            message="Không chuyển được trạng thái."
            retryLabel="Thử lại"
            onRetry={load}
          />
        )}

        {state === 'ready' && steps.length === 0 && (
          <Frame label="Bước kế tiếp" onBg>
            <p className="sc-empty">Không có bước nào để chuyển.</p>
          </Frame>
        )}

        {state === 'ready' && steps.length > 0 && (
          <>
            <Frame label="Bước kế tiếp" onBg>
              <ul className="sc-steps">
                {steps.map((step) => (
                  <li className="sc-step" key={step.event}>
                    <label className="sc-step-label">
                      <input
                        type="radio"
                        name="buoc-ke-tiep"
                        value={step.event}
                        checked={chon === step.event}
                        disabled={dangGui}
                        onChange={() => setChon(step.event)}
                      />
                      {isStatusKey(step.to) ? (
                        <StatusChip status={step.to} />
                      ) : (
                        <span>{nhanDich(step)}</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </Frame>

            <Frame label="Ảnh bằng chứng (không bắt buộc)" onBg>
              <ImageUpload
                images={anh.map((a) => a.item)}
                onAdd={addAttachments}
                onRemove={boAnh}
                max={SO_ANH_TOI_DA}
              />
            </Frame>

            {stockIssue !== null && stockIssue.issued && stockIssue.voucher !== undefined && (
              <p className="si-status">Đã xuất kho · {stockIssue.voucher.code}</p>
            )}

            {previewState === 'loading' && stockIssue === null && <Skeleton />}

            {previewState === 'error' && (
              <ErrorState
                message="Không tải được phiếu xuất kho."
                retryLabel="Thử lại"
                onRetry={loadPreview}
              />
            )}

            {willIssue && stockIssue !== null && (
              <Frame label="Phiếu xuất kho" onBg>
                <StockIssuePreview view={stockIssue} errors={lineErrors} />
              </Frame>
            )}

            {loiGui !== null && (
              <Banner tone="danger" role="alert">
                {loiGui}
              </Banner>
            )}

            <div className="sc-actions">
              <Button
                variant="primary"
                disabled={
                  chon === null ||
                  dangGui ||
                  (chon === EVENT_DELIVERED && previewState !== 'ready') ||
                  // "Đã giao" would issue stock the backend already says is short.
                  (willIssue && stockIssue.blocked)
                }
                onClick={gui}
              >
                {willIssue ? 'Xác nhận xuất kho & chuyển Đã giao' : 'Xác nhận chuyển'}
              </Button>
              <Button variant="ghost" disabled={dangGui} onClick={onBack}>
                Huỷ
              </Button>
            </div>
          </>
        )}
      </div>
    </WebShell>
  );
}
