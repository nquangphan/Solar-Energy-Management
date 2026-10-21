// hand-authored — web app-screen (Story 6.2). Tồn kho: per product, the two
// independent numbers — Tồn thật (`onHand`, only stock vouchers move it) and Đã
// hứa (`reserved`, promised to finalised orders) — plus Khả dụng, the number a
// sale promises from, and the purchase list of everything promised beyond stock.
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2). Khả dụng, Cần nhập, the status and the
// purchase list all come from the backend's single `tinhTonKho`. The screen
// joins them into sentences and branches on `tinhTrang` — it never subtracts,
// never compares a number against zero, never builds the purchase list itself.
//
// A negative Khả dụng is never shown bare: it reads "Cần nhập N" — a number to
// act on, not a number to panic about.
//
// READ-ONLY: stock moves only through vouchers, which live on their own screen
// (Phiếu kho). The optional `onOpenVouchers` callback is the way there — shown
// only to callers holding `inventory.manage`; the backend enforces it anyway.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Skeleton,
  Table,
} from '../../design-system/components';
import { can, filterNav, PERM } from '../../design-system/gating/permissions';
import type {
  InventoryPort,
  StockItemView,
  StockList,
} from '../../design-system/session/inventory-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Toolbar, Topbar, WebShell } from '../../design-system/shell';

import './inventory.css';

export interface InventoryScreenProps {
  port: InventoryPort;
  /** Opens the Phiếu kho screen. No router yet ⇒ a callback; absent ⇒ no entry point. */
  onOpenVouchers?: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

/** Chip label + colour token per status. TWIN of `_nhanTinhTrang()` in the Flutter screen. */
function nhanTinhTrang(item: StockItemView): { label: string; mau: string } {
  switch (item.tinhTrang) {
    case 'am':
      return { label: 'Âm', mau: 'var(--danger)' };
    case 'het':
      return { label: 'Hết khả dụng', mau: 'var(--warn)' };
    case 'du':
    default:
      return { label: 'Đủ', mau: 'var(--ok)' };
  }
}

/** The one-line summary under the product name. TWIN of `_tomTat()` in the Flutter screen. */
function tomTat(item: StockItemView): string {
  const dau = `Còn ${item.onHand} · Đã hứa ${item.reserved}`;
  if (item.tinhTrang === 'am') return `${dau} · Cần nhập ${item.canNhap} ${item.donVi}`;
  return `${dau} · Khả dụng ${item.khaDung} ${item.donVi}`;
}

export function InventoryScreen({ port, onOpenVouchers }: InventoryScreenProps) {
  const { perms } = usePermissions();

  const [q, setQ] = useState('');
  const [data, setData] = useState<StockList | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  // The search box fires on every keystroke and replies need not come back in
  // order: without this ticket a slow answer to "in" can land after the answer
  // to "inverter" and repaint the table with rows the user already typed past.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setState('loading');
    try {
      const result = await port.listStock({ q });
      if (ticket !== latest.current) return;
      setData(result);
      setState('ready');
    } catch {
      if (ticket !== latest.current) return;
      setState('error');
    }
  }, [port, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];
  const canMua = data?.danhSachCanMua ?? [];
  const dangTim = q.trim() !== '';

  return (
    <WebShell
      url="app.phuongnamsolar.vn/ton-kho"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="inventory" />}
      topbar={
        onOpenVouchers && can(perms, PERM.inventoryManage) ? (
          <Topbar
            eyebrow="KHO · 1 KHO"
            title="Tồn kho"
            action="Phiếu kho"
            actionLabel="Phiếu kho"
            onAction={onOpenVouchers}
          />
        ) : (
          <Topbar eyebrow="KHO · 1 KHO" title="Tồn kho" />
        )
      }
    >
      <div className="tk-wrap">
        <Toolbar>
          <Field
            aria-label="Tìm sản phẩm trong kho"
            placeholder="Tìm sản phẩm trong kho…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Toolbar>

        {state === 'loading' && (
          <div className="tk-state">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {state === 'error' && (
          <ErrorState message="Không tải được tồn kho." onRetry={load} retryLabel="Thử lại" />
        )}

        {/* A search that finds nothing is not an empty warehouse: the fix is to
            change the search, so the two truths get two different sentences. */}
        {state === 'ready' && items.length === 0 && dangTim && (
          <EmptyState icon="ic-warehouse" title="Không có sản phẩm khớp tìm kiếm." />
        )}

        {state === 'ready' && items.length === 0 && !dangTim && (
          <EmptyState icon="ic-warehouse" title="Chưa có sản phẩm nào theo dõi tồn kho." />
        )}

        {state === 'ready' && items.length > 0 && (
          <Frame label="Tồn kho · Tồn thật / Đã hứa / Khả dụng">
            <Table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="num">Tồn thật</th>
                  <th className="num">Đã hứa</th>
                  <th className="num">Khả dụng</th>
                  <th>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const nhan = nhanTinhTrang(item);
                  return (
                    <tr key={item.productId}>
                      <td>
                        <div className="strong">{item.ten}</div>
                        <div className="micro muted">{tomTat(item)}</div>
                      </td>
                      <td className="num mono">{item.onHand}</td>
                      <td className="num mono">{item.reserved}</td>
                      {item.tinhTrang === 'am' ? (
                        <td className="num mono strong" style={{ color: 'var(--danger)' }}>
                          Cần nhập {item.canNhap}
                        </td>
                      ) : (
                        <td className="num mono strong">{item.khaDung}</td>
                      )}
                      <td>
                        <span className="chip tk-chip" style={{ color: nhan.mau }}>
                          {nhan.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Frame>
        )}

        {state === 'ready' && canMua.length > 0 && (
          <Frame label="Danh sách cần mua · gộp mọi khả dụng âm" className="tk-can-mua">
            <Table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="num">Cần nhập</th>
                </tr>
              </thead>
              <tbody>
                {canMua.map((c) => (
                  <tr key={c.productId}>
                    <td className="strong">{c.ten}</td>
                    <td className="num mono strong" style={{ color: 'var(--danger)' }}>
                      {c.canNhap} {c.donVi}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Frame>
        )}
      </div>
    </WebShell>
  );
}
