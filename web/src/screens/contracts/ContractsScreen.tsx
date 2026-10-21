// hand-authored — web app-screen (Story 7.3). Sinh hợp đồng: shows the dynamic
// fields that go into the contract of an order, generates the PDF and lists the
// contracts already generated.
//
// THE CLIENT COMPUTES NOTHING (AD-2/AD-10/AD-16). The contract type, the total, the
// schedule label, whether the order can be turned into a contract and which company
// fields are unset are the backend's answer. The type label below is presentation.
//
// Every click on "Xuất PDF hợp đồng" creates ONE new contract, so the button is
// disabled while a call is in flight. No ConfirmDialog: generating a document is not
// an irreversible money action. A refusal (400 / 409) is shown verbatim, then the
// overview is reloaded because the order may have changed under us. A download/share
// failure AFTER a successful generation must not invite a second click (that would be
// a second contract): it points at "Tải PDF" in the refreshed list instead.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  Frame,
  Money,
  Skeleton,
  shareFiles,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  ContractSummary,
  ContractType,
  ContractsOverview,
  ContractsPort,
} from '../../design-system/session/contracts-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './contracts.css';

export interface ContractsScreenProps {
  port: ContractsPort;
  orderId: string;
  onBack?: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

const UNKNOWN_ERROR = 'Không xuất được hợp đồng. Vui lòng thử lại.';
const DOWNLOAD_ERROR = 'Không tải được file hợp đồng. Vui lòng thử lại.';

function generatedButNotDownloaded(contractNo: string): string {
  return `Đã sinh hợp đồng ${contractNo} nhưng chưa tải được — bấm “Tải PDF” trong danh sách.`;
}

const TYPE_LABELS: Record<ContractType, string> = {
  construction: 'HĐ Thi công',
  sale: 'HĐ Mua bán',
};

/** ISO-8601 UTC ⇒ `dd/MM/yyyy` in Vietnam time (UTC+7), independent of the device timezone. */
function vnDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/**
 * The port's AD-5 envelope (a plain object) carries the server's Vietnamese message; a
 * thrown JS/DOM error (e.g. a refused share) carries English text, so it gets the fallback.
 */
function messageOf(e: unknown, fallback: string): string {
  if (
    typeof e === 'object' &&
    e !== null &&
    !(e instanceof Error) &&
    !(typeof DOMException !== 'undefined' && e instanceof DOMException) &&
    typeof (e as { message?: unknown }).message === 'string'
  ) {
    return (e as { message: string }).message;
  }
  return fallback;
}

export function ContractsScreen({ port, orderId, onBack }: ContractsScreenProps) {
  const { perms } = usePermissions();
  const [state, setState] = useState<LoadState>('loading');
  const [overview, setOverview] = useState<ContractsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // State updates are async; the ref closes the window between two fast clicks.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      setOverview(await port.getOverview(orderId));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [port, orderId]);

  useEffect(() => {
    setState('loading');
    void load();
  }, [load]);

  // Reload after an action: a failure keeps the last good view (and its banner).
  const refresh = async () => {
    try {
      setOverview(await port.getOverview(orderId));
    } catch {
      // The banner already says what happened; the list stays as it was.
    }
  };

  const download = async (contractId: string) => {
    const pdf = await port.downloadContractPdf(orderId, contractId);
    await shareFiles({ files: [pdf], title: pdf.name, fallbackDownload: true });
  };

  const generate = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const created = await port.generateContract(orderId);
      try {
        await download(created.id);
      } catch {
        setError(generatedButNotDownloaded(created.contractNo));
      }
    } catch (e) {
      setError(messageOf(e, UNKNOWN_ERROR));
    } finally {
      await refresh();
      inFlight.current = false;
      setBusy(false);
    }
  };

  const downloadExisting = async (contract: ContractSummary) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await download(contract.id);
    } catch (e) {
      setError(messageOf(e, DOWNLOAD_ERROR));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <WebShell
      url={`app.phuongnamsolar.vn/don-hang/${orderId}/hop-dong`}
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />}
      topbar={<Topbar eyebrow="HỢP ĐỒNG" title="Sinh hợp đồng" onBack={onBack} />}
    >
      <div className="ct-wrap">
        {state === 'loading' && (
          <div className="ct-state">
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {state === 'error' && (
          <ErrorState
            message="Không tải được thông tin hợp đồng."
            onRetry={() => {
              setState('loading');
              void load();
            }}
            retryLabel="Thử lại"
          />
        )}

        {state === 'ready' && overview !== null && (
          <>
            {error !== null && (
              <Banner tone="danger" icon="ic-alert" role="alert">
                {error}
              </Banner>
            )}
            <Frame label="Trường động đưa vào HĐ">
              <dl className="ct-rows">
                <div className="ct-row">
                  <dt className="micro muted">Loại HĐ</dt>
                  <dd>{TYPE_LABELS[overview.contractType]}</dd>
                </div>
                <div className="ct-row">
                  <dt className="micro muted">Hai bên</dt>
                  <dd>{`A: ${overview.customerName} · B: Phương Nam`}</dd>
                </div>
                <div className="ct-row">
                  <dt className="micro muted">Vật tư</dt>
                  <dd>{`${overview.lineCount} dòng · snapshot đơn`}</dd>
                </div>
                <div className="ct-row">
                  <dt className="micro muted">Tổng tiền</dt>
                  <dd>
                    <Money value={overview.orderTotal} />
                  </dd>
                </div>
                <div className="ct-row">
                  <dt className="micro muted">Lịch TT</dt>
                  <dd>{overview.scheduleLabel ?? '—'}</dd>
                </div>
                <div className="ct-row">
                  <dt className="micro muted">Số BG</dt>
                  <dd>{overview.quoteNo}</dd>
                </div>
              </dl>
            </Frame>

            <Banner tone="info">Điều khoản là template tĩnh; sinh HĐ ghi Audit log.</Banner>

            {overview.missingPartyFields.length > 0 && (
              <Banner tone="warn" icon="ic-alert">
                {`Thông tin pháp nhân chưa cấu hình: ${overview.missingPartyFields.join(', ')}. Hợp đồng vẫn xuất được — các ô này in “Chưa cấu hình”.`}
              </Banner>
            )}

            {!overview.generatable && (
              <Banner tone="warn" icon="ic-alert">
                {overview.blockedReason ?? ''}
              </Banner>
            )}

            {overview.generatable && (
              <div className="ct-actions">
                <Button
                  variant="primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void generate()}
                >
                  Xuất PDF hợp đồng
                </Button>
              </div>
            )}

            <Frame label="Hợp đồng đã sinh">
              {overview.contracts.length === 0 ? (
                <EmptyState title="Chưa sinh hợp đồng nào." />
              ) : (
                <ul className="ct-list">
                  {overview.contracts.map((c) => (
                    <li key={c.id} className="ct-item">
                      <span className="ct-item-text">
                        {`${c.contractNo} · ${TYPE_LABELS[c.contractType]} · Bản ${c.versionNo} · ${vnDate(c.createdAt)}`}
                      </span>
                      <Button
                        size="sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void downloadExisting(c)}
                      >
                        Tải PDF
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Frame>
          </>
        )}
      </div>
    </WebShell>
  );
}
