// hand-authored — web app-screen (Story 4.7). Duyệt chiết khấu: danh sách đơn
// chờ duyệt → chọn item → panel chi tiết với biên ước tính per-line → Đồng ý /
// Từ chối (kèm lý do) qua OrdersPort, composed entirely from shipped
// design-system components (AD-13).
//
// THE CLIENT DOES NO MONEY MATH (AD-10/16). Giá gốc / Chiết khấu / Sau chiết
// khấu / Biên ước tính đều là CON SỐ PORT TRẢ — backend tính, màn hiển thị
// nguyên văn ("X%" hoặc "—" khi null; null = dòng tự do, giá 0, hoặc người xem
// thiếu costs.view — FR-37).
//
// A network failure NEVER wipes the list or the selection: the error path only
// sets a Banner/ErrorState — it never resets state (bất biến k).
import { useCallback, useEffect, useState } from 'react';

import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Money,
  Skeleton,
  StatusChip,
  Table,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import { ORDER_STATUS_CHODUYET } from '../../design-system/session/orders-port';
import type {
  DiscountPendingItem,
  OrderPortError,
  OrdersPort,
} from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';

import './discount-approval.css';

export interface DiscountApprovalScreenProps {
  ordersPort: OrdersPort;
}

type LoadState = 'loading' | 'ready' | 'error';

export function DiscountApprovalScreen({ ordersPort }: DiscountApprovalScreenProps) {
  const { perms } = usePermissions();

  const [items, setItems] = useState<DiscountPendingItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  // Item đang xem chi tiết — null = chưa chọn (chỉ thấy danh sách).
  const [selected, setSelected] = useState<DiscountPendingItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Lý do duyệt/từ chối — BẮT BUỘC khi từ chối, chặn client-side (không gọi port).
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  // Dialog hệ quả cho từng quyết định (UX-DR-20) + busy trong lúc chờ port.
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [resolveBusy, setResolveBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const fresh = await ordersPort.listPendingDiscounts();
      setItems(fresh);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [ordersPort]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Quyết định duyệt/từ chối (FR-18): port gọi backend — backend đổi status,
   * ghi hồ sơ, publish event; màn chỉ reload danh sách + bỏ chọn. KHÔNG toast —
   * item biến khỏi danh sách là tín hiệu. Lỗi → Banner + danh sách + lựa chọn
   * NGUYÊN VẸN (bất biến k).
   */
  async function handleResolve(approve: boolean) {
    if (selected === null) return;
    setApproveDialogOpen(false);
    setRejectDialogOpen(false);
    setResolveBusy(true);
    try {
      await ordersPort.resolveDiscount(selected.orderId, {
        approve,
        reason: reason === '' ? undefined : reason,
      });
      setSelected(null);
      setReason('');
      setReasonError(null);
      setError(null);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setResolveBusy(false);
    }
  }

  /** Từ chối thiếu lý do bị chặn TẠI CHỖ — fieldError hiển thị, KHÔNG gọi port. */
  function handleRejectClick() {
    if (reason.trim() === '') {
      setReasonError('Lý do là bắt buộc khi từ chối chiết khấu.');
      return;
    }
    setReasonError(null);
    setRejectDialogOpen(true);
  }

  return (
    <WebShell
      url="app.phuongnamsolar.vn/don-hang/duyet-chiet-khau"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />}
      topbar={<Topbar eyebrow="ĐƠN HÀNG" title="Duyệt chiết khấu" />}
    >
      <div className="discount-wrap">
        {error !== null && <Banner tone="danger">{error}</Banner>}

        {state === 'loading' &&
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)}

        {state === 'error' && (
          <ErrorState
            message="Không tải được danh sách chờ duyệt."
            onRetry={() => void load()}
          />
        )}

        {state === 'ready' && items.length === 0 && (
          <EmptyState
            icon="ic-orders"
            title="Không có chiết khấu nào đang chờ duyệt."
          />
        )}

        {state === 'ready' && items.length > 0 && (
          <Frame label="Chờ duyệt chiết khấu">
            <Table>
              <thead>
                <tr>
                  <th>Đơn·Khách</th>
                  <th className="num">Mức giảm</th>
                  <th>Người đề xuất</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.orderId}
                    className="discount-list-row"
                    onClick={() => {
                      setSelected(item);
                      setReason('');
                      setReasonError(null);
                    }}
                  >
                    <td>
                      <span className="strong">{item.orderId}</span>{' '}
                      <span className="micro muted mono">{item.customerSdt}</span>
                    </td>
                    <td className="num mono">
                      <Money value={item.amount} />
                    </td>
                    <td>{item.requestedByDisplayName}</td>
                    <td>
                      <StatusChip status={ORDER_STATUS_CHODUYET} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Frame>
        )}

        {selected !== null && (
          <Frame label={`Chi tiết ${selected.orderId}`}>
            {/* 3 con số backend (AD-16) — màn hiển thị nguyên văn, canh phải. */}
            <dl className="discount-summary">
              <dt>Giá gốc</dt>
              <dd className="num mono">
                <Money value={selected.subtotal} />
              </dd>
              <dt>Chiết khấu</dt>
              <dd className="num mono">
                <Money value={selected.amount} />
              </dd>
              <dt>Sau chiết khấu</dt>
              <dd className="num mono strong">
                <Money value={selected.afterDiscount} />
              </dd>
            </dl>

            <Table>
              <thead>
                <tr>
                  <th>Món</th>
                  <th className="num">SL</th>
                  <th className="num">Đơn giá</th>
                  <th className="num">Biên ước tính</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((line, index) => (
                  <tr key={`${selected.orderId}-${index}`}>
                    <td>{line.name}</td>
                    <td className="num mono">{String(line.qty)}</td>
                    <td className="num mono">
                      <Money value={line.unitPrice} />
                    </td>
                    {/* Biên là SỐ PORT TRẢ (integer %) — null = "—" (FR-37). */}
                    <td className="num mono">
                      {line.estimatedMarginPct === null
                        ? '—'
                        : `${line.estimatedMarginPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="micro muted">
              {'Ước tính theo giá vốn hiện tại — chưa xuất kho.'}
            </p>

            {selected.requestNote !== null && (
              <p className="micro">
                <span className="muted">Lý do đề xuất</span>{' '}
                {selected.requestNote}
              </p>
            )}

            <div className="discount-decision">
              <Field
                label="Lý do duyệt / từ chối (bắt buộc khi từ chối)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {reasonError !== null && <Banner tone="danger">{reasonError}</Banner>}
              <div className="discount-decision-buttons">
                <Button
                  variant="danger"
                  type="button"
                  disabled={resolveBusy}
                  onClick={() => handleRejectClick()}
                >
                  Từ chối
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  disabled={resolveBusy}
                  onClick={() => setApproveDialogOpen(true)}
                >
                  Đồng ý chiết khấu
                </Button>
              </div>
            </div>
          </Frame>
        )}
      </div>

      {/* Huỷ = đóng dialog, KHÔNG gọi port — hồ sơ ở nguyên chờ duyệt. */}
      <ConfirmDialog
        open={approveDialogOpen}
        title="Đồng ý chiết khấu"
        consequence="Đồng ý chiết khấu cho phép chốt đơn với giá đã giảm; thao tác được ghi Audit log."
        onConfirm={() => void handleResolve(true)}
        onCancel={() => setApproveDialogOpen(false)}
      />

      <ConfirmDialog
        open={rejectDialogOpen}
        title="Từ chối"
        tone="danger"
        consequence="Từ chối sẽ trả đơn về Báo giá; lý do từ chối được ghi Audit log."
        onConfirm={() => void handleResolve(false)}
        onCancel={() => setRejectDialogOpen(false)}
      />
    </WebShell>
  );
}

/**
 * The message the BACKEND sent (AD-5), verbatim. The generic line is only for a
 * transport failure, which carries no envelope.
 */
function messageOf(err: unknown): string {
  const envelope = err as Partial<OrderPortError>;
  return envelope?.message ?? 'Không thực hiện được. Thử lại.';
}
