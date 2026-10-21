// hand-authored — web app-screen (Story 7.4). Hoá đơn bán hàng: creates the internal
// sales invoice from the current order version and lists the invoices already created.
// Each created invoice opens its document (Xem hoá đơn) when the caller wires a route.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Whether the order can be invoiced,
// the total and the invoice number are the backend's answer.
//
// Issuing an invoice is an irreversible money document, so "Tạo hoá đơn" goes through a
// ConfirmDialog. The dialog closes BEFORE the call (a refusal has nowhere to show inside
// it, and a closed dialog has no button left to double-click); a ref closes the window
// between two fast confirms. A refusal (400 / 409) is shown verbatim, then the overview
// is reloaded; a failed reload keeps the last good view.
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Frame,
  Money,
  Skeleton,
} from "../../design-system/components";
import { filterNav } from "../../design-system/gating/permissions";
import type {
  InvoicesOverview,
  InvoicesPort,
} from "../../design-system/session/invoices-port";
import { usePermissions } from "../../design-system/session/use-permissions";
import {
  Sidebar,
  SIDEBAR_NAV,
  Topbar,
  WebShell,
} from "../../design-system/shell";

import "./invoices.css";

export interface InvoicesScreenProps {
  port: InvoicesPort;
  orderId: string;
  onBack?: () => void;
  /** Opens one created invoice. Without it the list has no "Xem" button. */
  onOpenInvoice?: (invoiceId: string) => void;
}

type LoadState = "loading" | "ready" | "error";

const UNKNOWN_ERROR = "Không tạo được hoá đơn. Vui lòng thử lại.";

/** ISO-8601 UTC ⇒ `dd/MM/yyyy` in Vietnam time (UTC+7), independent of the device timezone. */
function vnDate(iso: string): string {
  const d = new Date(
    new Date(iso).getTime() + 7 * 60 * 60 * 1000,
  ).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/**
 * The port's AD-5 envelope (a plain object) carries the server's Vietnamese message; a
 * thrown JS/DOM error carries English text, so it gets the fallback.
 */
function messageOf(e: unknown, fallback: string): string {
  if (
    typeof e === "object" &&
    e !== null &&
    !(e instanceof Error) &&
    !(typeof DOMException !== "undefined" && e instanceof DOMException) &&
    typeof (e as { message?: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return fallback;
}

export function InvoicesScreen({
  port,
  orderId,
  onBack,
  onOpenInvoice,
}: InvoicesScreenProps) {
  const { perms } = usePermissions();
  const [state, setState] = useState<LoadState>("loading");
  const [overview, setOverview] = useState<InvoicesOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      setOverview(await port.getOverview(orderId));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [port, orderId]);

  useEffect(() => {
    setState("loading");
    void load();
  }, [load]);

  // Reload after an action: a failure keeps the last good view (and its banner).
  const refresh = async (): Promise<InvoicesOverview | null> => {
    try {
      const next = await port.getOverview(orderId);
      setOverview(next);
      return next;
    } catch {
      // The banner already says what happened; the view stays as it was.
      return null;
    }
  };

  const create = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirming(false);
    setBusy(true);
    setError(null);
    let failure: string | null = null;
    try {
      await port.createInvoice(orderId);
    } catch (e) {
      failure = messageOf(e, UNKNOWN_ERROR);
      setError(failure);
    } finally {
      const next = await refresh();
      // A lost response (fallback, not a server refusal) whose invoice was in fact created:
      // the reload shows it, so the "could not create" banner would contradict the screen.
      if (failure === UNKNOWN_ERROR && next?.currentInvoiceId != null) {
        setError(null);
      }
      inFlight.current = false;
      setBusy(false);
    }
  };

  const currentInvoiceNo =
    overview?.currentInvoiceId != null
      ? (overview.invoices.find((i) => i.id === overview.currentInvoiceId)
          ?.invoiceNo ?? null)
      : null;

  return (
    <WebShell
      url={`app.phuongnamsolar.vn/don-hang/${orderId}/hoa-don`}
      sidebar={
        <Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />
      }
      topbar={
        <Topbar eyebrow="HOÁ ĐƠN" title="Hoá đơn bán hàng" onBack={onBack} />
      }
    >
      <div className="iv-wrap">
        {state === "loading" && (
          <div className="iv-state">
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {state === "error" && (
          <ErrorState
            message="Không tải được thông tin hoá đơn."
            onRetry={() => {
              setState("loading");
              void load();
            }}
            retryLabel="Thử lại"
          />
        )}

        {state === "ready" && overview !== null && (
          <>
            {error !== null && (
              <Banner tone="danger" icon="ic-alert" role="alert">
                {error}
              </Banner>
            )}
            <Frame label="Tạo hoá đơn từ đơn">
              <dl className="iv-rows">
                <div className="iv-row">
                  <dt className="micro muted">Nguồn</dt>
                  <dd>{`Bản ${overview.versionNo} (snapshot)`}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Khách hàng</dt>
                  <dd>{overview.customerName}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">MST khách</dt>
                  <dd>{overview.customerTaxCode ?? "Không có MST"}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Tổng tiền</dt>
                  <dd>
                    <Money value={overview.orderTotal} />
                  </dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Số HĐ nội bộ</dt>
                  <dd>Tự cấp khi tạo</dd>
                </div>
              </dl>
            </Frame>

            <Banner tone="info">
              {
                "Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau)."
              }
            </Banner>

            {!overview.creatable && overview.blockedReason !== null && (
              <Banner tone="warn" icon="ic-alert">
                {overview.blockedReason}
              </Banner>
            )}

            {overview.currentInvoiceId !== null && (
              <Banner tone="info">
                {`Bản đơn hiện hành đã có hoá đơn ${currentInvoiceNo ?? ""}.`}
              </Banner>
            )}

            {overview.creatable && overview.currentInvoiceId === null && (
              <div className="iv-actions">
                <Button
                  variant="primary"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(true)}
                >
                  Tạo hoá đơn
                </Button>
              </div>
            )}

            <Frame label="Hoá đơn đã tạo">
              {overview.invoices.length === 0 ? (
                <EmptyState title="Chưa tạo hoá đơn nào." />
              ) : (
                <ul className="iv-list">
                  {overview.invoices.map((inv) => (
                    <li key={inv.id} className="iv-item">
                      <span className="iv-item-text">
                        {`${inv.invoiceNo} · Bản ${inv.versionNo} · ${vnDate(inv.issuedAt)}`}
                      </span>
                      <Money value={inv.total} />
                      {onOpenInvoice !== undefined && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onOpenInvoice(inv.id)}
                        >
                          Xem
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Frame>

            <ConfirmDialog
              open={confirming}
              title="Tạo hoá đơn?"
              consequence={`Hoá đơn chụp lại bản ${overview.versionNo} của đơn và không sửa được sau khi tạo.`}
              confirmLabel="Tạo hoá đơn"
              cancelLabel="Huỷ"
              onConfirm={() => void create()}
              onCancel={() => setConfirming(false)}
            />
          </>
        )}
      </div>
    </WebShell>
  );
}
