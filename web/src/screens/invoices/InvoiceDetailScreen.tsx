// hand-authored — web app-screen (Story 7.5). Xem hoá đơn: one created invoice in full
// (number, date, seller, customer, lines, VAT, totals, linked order) and "Xuất PDF".
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). Every figure is the snapshot the
// backend stored when the invoice was issued; the screen only renders it.
//
// "Xuất PDF" renders the PDF on the backend the first time and returns the SAME stored
// file afterwards, so repeating it is harmless: no ConfirmDialog. The button is disabled
// while a call is in flight and a ref closes the window between two fast clicks. A
// server refusal is shown verbatim; a thrown JS/DOM error (a refused share) gets the
// fallback — clicking again simply hands over the stored file.
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Banner,
  Button,
  ErrorState,
  Frame,
  Money,
  Skeleton,
  Table,
  shareFiles,
} from "../../design-system/components";
import { filterNav } from "../../design-system/gating/permissions";
import { Icon } from "../../design-system/icons/Icon";
import type {
  InvoiceDetail,
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

export interface InvoiceDetailScreenProps {
  port: InvoicesPort;
  orderId: string;
  invoiceId: string;
  onBack?: () => void;
}

type LoadState = "loading" | "ready" | "error";

const EXPORT_ERROR = "Không xuất được PDF hoá đơn. Vui lòng thử lại.";
const NOT_CONFIGURED = "Chưa cấu hình";

/** ISO-8601 UTC ⇒ `dd/MM/yyyy` in Vietnam time (UTC+7), independent of the device timezone. */
function vnDate(iso: string): string {
  const d = new Date(
    new Date(iso).getTime() + 7 * 60 * 60 * 1000,
  ).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** A seller field left empty when the invoice was issued. */
function orNotConfigured(value: string): string {
  return value.trim() === "" ? NOT_CONFIGURED : value;
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

export function InvoiceDetailScreen({
  port,
  orderId,
  invoiceId,
  onBack,
}: InvoiceDetailScreenProps) {
  const { perms } = usePermissions();
  const [state, setState] = useState<LoadState>("loading");
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // Only the latest read may land: a response for a previous invoice is dropped.
  const ticket = useRef(0);

  const load = useCallback(async () => {
    const mine = ++ticket.current;
    try {
      const next = await port.getInvoice(orderId, invoiceId);
      if (mine !== ticket.current) return;
      setInvoice(next);
      setState("ready");
    } catch {
      if (mine === ticket.current) setState("error");
    }
  }, [port, orderId, invoiceId]);

  useEffect(() => {
    setState("loading");
    void load();
  }, [load]);

  // Reload after an export: a failure keeps the last good view (and its banner).
  const refresh = async () => {
    const mine = ++ticket.current;
    try {
      const next = await port.getInvoice(orderId, invoiceId);
      if (mine === ticket.current) setInvoice(next);
    } catch {
      // The banner already says what happened; the view stays as it was.
    }
  };

  const exportPdf = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await port.exportInvoicePdf(orderId, invoiceId);
      const pdf = await port.downloadInvoicePdf(orderId, invoiceId);
      await shareFiles({ files: [pdf], title: pdf.name, fallbackDownload: true });
    } catch (e) {
      setError(messageOf(e, EXPORT_ERROR));
    } finally {
      await refresh();
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <WebShell
      url={`app.phuongnamsolar.vn/don-hang/${orderId}/hoa-don/${invoiceId}`}
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
            message="Không tải được hoá đơn."
            onRetry={() => {
              setState("loading");
              void load();
            }}
            retryLabel="Thử lại"
          />
        )}

        {state === "ready" && invoice !== null && (
          <>
            {error !== null && (
              <Banner tone="danger" icon="ic-alert" role="alert">
                {error}
              </Banner>
            )}

            <Banner tone="info">
              {
                "Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau)."
              }
            </Banner>

            <Frame label="HOÁ ĐƠN BÁN HÀNG">
              <dl className="iv-rows">
                <div className="iv-row">
                  <dt className="micro muted">Số HĐ</dt>
                  <dd>{invoice.invoiceNo}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Ngày lập</dt>
                  <dd>{vnDate(invoice.issuedAt)}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Gắn đơn</dt>
                  <dd>{`${invoice.quoteNo} · Bản ${invoice.versionNo}`}</dd>
                </div>
              </dl>

              <div className="iv-subhead micro muted">Người bán</div>
              <dl className="iv-rows">
                <div className="iv-row">
                  <dt className="micro muted">Tên công ty</dt>
                  <dd>{orNotConfigured(invoice.seller.legalName)}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">MST</dt>
                  <dd>{orNotConfigured(invoice.seller.taxCode)}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Địa chỉ</dt>
                  <dd>{orNotConfigured(invoice.seller.address)}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Điện thoại</dt>
                  <dd>{orNotConfigured(invoice.seller.phone)}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Tài khoản ngân hàng</dt>
                  <dd>{orNotConfigured(invoice.seller.bankAccount)}</dd>
                </div>
              </dl>

              <div className="iv-subhead micro muted">Khách hàng</div>
              <dl className="iv-rows">
                <div className="iv-row">
                  <dt className="micro muted">Khách hàng</dt>
                  <dd>{invoice.customerName}</dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">MST khách</dt>
                  <dd>{invoice.customerTaxCode ?? "Không có MST"}</dd>
                </div>
                {invoice.customerAddress !== null && (
                  <div className="iv-row">
                    <dt className="micro muted">Địa chỉ</dt>
                    <dd>{invoice.customerAddress}</dd>
                  </div>
                )}
              </dl>

              <Table>
                <thead>
                  <tr>
                    <th>Hạng mục</th>
                    <th className="num">SL</th>
                    <th className="num">Đơn giá</th>
                    <th className="num">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.displayOrder}>
                      <td className="iv-line-name">{line.name}</td>
                      <td className="num">{line.qty}</td>
                      <td className="num">
                        <Money value={line.unitPrice} />
                      </td>
                      <td className="num">
                        <Money value={line.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <dl className="iv-rows iv-totals">
                <div className="iv-row">
                  <dt className="micro muted">Tổng trước VAT</dt>
                  <dd>
                    <Money value={invoice.subtotal} />
                  </dd>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="iv-row">
                    <dt className="micro muted">Chiết khấu</dt>
                    <dd>
                      <Money value={invoice.discountAmount} />
                    </dd>
                  </div>
                )}
                <div className="iv-row">
                  <dt className="micro muted">
                    {invoice.applyVat ? `VAT ${invoice.vatRate}%` : "Không áp VAT"}
                  </dt>
                  <dd>
                    <Money value={invoice.vatAmount} />
                  </dd>
                </div>
                <div className="iv-row">
                  <dt className="micro muted">Tổng thanh toán</dt>
                  <dd>
                    <Money value={invoice.total} />
                  </dd>
                </div>
              </dl>
            </Frame>

            <div className="iv-actions">
              <span className="iv-file micro muted">
                {invoice.pdf === null
                  ? "Chưa xuất PDF"
                  : `Đã xuất PDF · ${vnDate(invoice.pdf.exportedAt)}`}
              </span>
              <Button
                variant="primary"
                type="button"
                disabled={busy}
                onClick={() => void exportPdf()}
              >
                <Icon name="ic-download" /> Xuất PDF
              </Button>
            </div>
          </>
        )}
      </div>
    </WebShell>
  );
}
