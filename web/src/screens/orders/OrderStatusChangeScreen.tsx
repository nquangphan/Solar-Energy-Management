// hand-authored — web app-screen (Story 5.5). Chuyển trạng thái: pick the next
// step, optionally attach evidence photos, submit.
//
// A SCREEN, NOT A DIALOG. UX-DR-20 wants a Dialog for consequential actions, but
// the shipped ImageUpload's mobile twin opens its own AppSheet — a Dialog here
// would stack two overlay layers, and UX-DR-20 also caps overlays at one. The UX
// inventory already lists this as a screen (`s-status-change`).
//
// WHICH STEPS EXIST IS NOT COMPUTED HERE. `buocKeTiep` arrives from the backend
// already filtered by the order's status, its scope flags and the caller's real
// permissions (AD-2/AD-4). The branches require DIFFERENT permission keys, so an
// any-of expression on the client would be a third copy of the rule and it would
// drift. An empty array is a real answer: this caller has no legal step.
//
// The screen NEVER touches R2. It collects File[] and hands them to the port;
// upload, object keys and the transaction all belong to the backend (AD-3).
import { useCallback, useEffect, useRef, useState } from 'react';

import {
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
import type { OrderNextStep, OrdersPort } from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './order-status-change.css';

export interface OrderStatusChangeScreenProps {
  port: OrdersPort;
  orderId: string;
  onBack?: () => void;
  /** Called after the transition committed — the caller navigates back and refetches. */
  onDone?: (status: string) => void;
}

type LoadState = 'loading' | 'ready' | 'error';

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

  const latest = useRef(0);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      const vongDoi = await port.getLifecycle(orderId);
      if (ticket !== latest.current) return;
      setSteps(vongDoi.buocKeTiep);
      // Preselect only when there is exactly one choice: with two open branches
      // (thi công / giao hàng) a default would make a consequential decision for
      // the user, and both branches are one click from committing.
      setChon(vongDoi.buocKeTiep.length === 1 ? vongDoi.buocKeTiep[0].event : null);
      setState('ready');
    } catch {
      if (ticket !== latest.current) return;
      setState('error');
    }
  }, [port, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const themAnh = useCallback((files: File[]) => {
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
    try {
      const ketQua = await port.chuyenTrangThai(
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
    } finally {
      setDangGui(false);
    }
  }, [port, orderId, chon, anh, onDone]);

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
                onAdd={themAnh}
                onRemove={boAnh}
                max={SO_ANH_TOI_DA}
              />
            </Frame>

            {loiGui !== null && <p className="sc-err">{loiGui}</p>}

            <div className="sc-actions">
              <Button variant="primary" disabled={chon === null || dangGui} onClick={gui}>
                Xác nhận chuyển
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
