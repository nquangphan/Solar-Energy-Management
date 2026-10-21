// hand-authored — the order's stock-out preview, shared by the
// status-change screen (step "Đã giao") and the order detail screen ("Phiếu
// xuất"). Not a screen: one block, two hosts, one wording.
//
// THE CLIENT DECIDES NOTHING (AD-2). Rows arrive already summed per product and
// in the backend's canonical order; "Tồn thật" is shown for counting, never
// compared with "Đơn cần" here — whether the stock is enough is the backend's
// answer (409 with `lines.{i}.qty`), which this block places under row `i`.
import { Fragment } from 'react';

import { Banner, Table } from '../../design-system/components';
import type { OrderStockIssueView } from '../../design-system/session/orders-port';

import './stock-issue.css';

/** Row index → the backend's message, from `fieldErrors[].field = lines.{i}.qty`. */
export type RowErrors = Record<number, string>;

export function rowErrors(err: unknown): RowErrors {
  const fieldErrors =
    (err as { fieldErrors?: { field: string; message: string }[] } | null)?.fieldErrors ?? [];
  const result: RowErrors = {};
  for (const fe of fieldErrors) {
    const match = /^lines\.(\d+)\.qty$/.exec(fe.field);
    if (match !== null) result[Number(match[1])] = fe.message;
  }
  return result;
}

export function StockIssuePreview({
  view,
  errors = {},
}: {
  view: OrderStockIssueView;
  errors?: RowErrors;
}) {
  return (
    <div className="si-preview">
      <Banner tone="info">
        Đây là <strong>lần duy nhất</strong> đơn này trừ tồn kho. Một Đơn — một phiếu xuất.
        Đếm hàng thực tế trước khi xác nhận.
      </Banner>
      <Table>
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th className="num">Đơn cần</th>
            <th className="num">Tồn thật</th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map((line, i) => (
            <Fragment key={line.productId}>
              <tr>
                <td>{line.name}</td>
                <td className="num mono">{line.qty}</td>
                <td className="num mono">{line.onHand}</td>
              </tr>
              {errors[i] !== undefined && (
                <tr>
                  <td colSpan={3} className="si-row-error">
                    {errors[i]}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {view.untrackedItems.map((name, i) => (
            <tr key={`untracked-${i}`}>
              <td>{name}</td>
              <td colSpan={2} className="si-muted">
                Không theo kho — không có trong phiếu xuất
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
