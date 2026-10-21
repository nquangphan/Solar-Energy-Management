// hand-authored — web app-screen (Story 6.3). Phiếu kho: the list of stock-in /
// stock-out vouchers, one voucher's detail, and the form that creates one.
//
// THE CLIENT COMPUTES NOTHING (AD-2). The voucher code, line count, total
// quantity, the weighted-average cost and the "not enough stock" refusal are the
// backend's. The screen never multiplies a quantity by a cost, never compares a
// quantity with what is on hand — it shows "Còn N" from the stock list and lets
// the backend say no. The `+N` / `−N` sign is glued on as TEXT from the voucher
// type, never by arithmetic.
//
// `unitCost` is absent when the caller lacks `costs.view`: no column, no "0".
//
// Deliberately absent (later stories): the "Nhập trả" tab and chip, and the
// "gắn đơn" details of an order-bound stock-out.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Sheet,
  Skeleton,
  Table,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import { Icon } from '../../design-system/icons/Icon';
import type { InventoryPort, StockItemView } from '../../design-system/session/inventory-port';
import type {
  LoaiPhieu,
  StockVoucherDetail,
  StockVoucherPortError,
  StockVouchersPort,
  StockVoucherSummary,
} from '../../design-system/session/stock-vouchers-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Seg, Sidebar, SIDEBAR_NAV, Toolbar, Topbar, WebShell } from '../../design-system/shell';

import { ngayGio, ngayNgan } from './format-gio';
import './stock-vouchers.css';

export interface StockVouchersScreenProps {
  port: StockVouchersPort;
  /** Product picker source — the same stock list the Tồn kho screen reads. */
  inventoryPort: InventoryPort;
  onBack?: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

const ALL = 'ALL';
const FILTER_OPTIONS = [
  { key: ALL, label: 'Tất cả' },
  { key: 'nhap', label: 'Nhập' },
  { key: 'xuat', label: 'Xuất' },
];
const LOAI_OPTIONS = [
  { key: 'nhap', label: 'Nhập' },
  { key: 'xuat', label: 'Xuất' },
];

const NOTE_NHAP =
  'Giá vốn ở đây không được bỏ trống. Hệ thống lấy nó tính bình quân gia quyền rồi cập nhật giá vốn hiện hành của sản phẩm — một chỗ gõ, không ai phải nhớ sửa hai nơi.';
const NOTE_XUAT = 'Phiếu xuất không gắn đơn (hàng hỏng, mẫu, điều chỉnh). Không sửa/xoá sau khi lưu.';
const TON_DAU_KY = 'Tồn đầu kỳ';

/** Chip label + colour token per type. TWIN of `_nhanLoai()` in the Flutter screen. */
function nhanLoai(type: LoaiPhieu): { label: string; mau: string } {
  return type === 'nhap'
    ? { label: 'Nhập', mau: 'var(--ok)' }
    : { label: 'Xuất', mau: 'var(--warn)' };
}

/** `+40` / `−14` — a sign glued on as text from the type. TWIN of `_soLuongCoDau()`. */
function soLuongCoDau(type: LoaiPhieu, qty: number): string {
  return `${type === 'nhap' ? '+' : '−'}${qty}`;
}

function moTaLoai(type: LoaiPhieu): string {
  return type === 'nhap' ? 'Nhập kho' : 'Xuất kho · không gắn đơn';
}

/** Keep digits only — quantities and costs are whole numbers; the backend validates ranges. */
function chiChuSo(text: string): string {
  return text.replace(/\D/g, '');
}

interface DongForm {
  productId: string;
  ten: string;
  donVi: string;
  onHand: number;
  qty: string;
  unitCost: string;
}

function ChipLoai({ type }: { type: LoaiPhieu }) {
  const nhan = nhanLoai(type);
  return (
    <span className="chip pk-chip" style={{ color: nhan.mau }}>
      {nhan.label}
    </span>
  );
}

export function StockVouchersScreen({ port, inventoryPort, onBack }: StockVouchersScreenProps) {
  const { perms } = usePermissions();

  const [filter, setFilter] = useState<string>(ALL);
  const [items, setItems] = useState<StockVoucherSummary[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const listTicket = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockVoucherDetail | null>(null);
  const [detailState, setDetailState] = useState<LoadState>('loading');
  const detailTicket = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++listTicket.current;
    setState('loading');
    try {
      const result = await port.listVouchers(
        filter === ALL ? {} : { type: filter as LoaiPhieu },
      );
      if (ticket !== listTicket.current) return;
      setItems(result.items);
      setState('ready');
    } catch {
      if (ticket !== listTicket.current) return;
      setState('error');
    }
  }, [port, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(
    async (id: string) => {
      const ticket = ++detailTicket.current;
      setDetailState('loading');
      try {
        const result = await port.getVoucher(id);
        if (ticket !== detailTicket.current) return;
        setDetail(result);
        setDetailState('ready');
      } catch {
        if (ticket !== detailTicket.current) return;
        setDetailState('error');
      }
    },
    [port],
  );

  useEffect(() => {
    if (selectedId !== null) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // ---- Form tạo phiếu ----
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loai, setLoai] = useState<LoaiPhieu>('nhap');
  const [note, setNote] = useState('');
  const [dong, setDong] = useState<DongForm[]>([]);
  const [q, setQ] = useState('');
  const [goiY, setGoiY] = useState<StockItemView[]>([]);
  const goiYTicket = useRef(0);
  const [sending, setSending] = useState(false);
  const [loi, setLoi] = useState<StockVoucherPortError | null>(null);

  useEffect(() => {
    if (!sheetOpen) return;
    const ticket = ++goiYTicket.current;
    inventoryPort.listStock({ q }).then(
      (r) => {
        if (ticket === goiYTicket.current) setGoiY(r.items);
      },
      () => {
        if (ticket === goiYTicket.current) setGoiY([]);
      },
    );
  }, [inventoryPort, q, sheetOpen]);

  const moForm = () => {
    setLoai('nhap');
    setNote('');
    setDong([]);
    setQ('');
    setLoi(null);
    setSheetOpen(true);
  };

  const themDong = (sp: StockItemView) => {
    if (dong.some((d) => d.productId === sp.productId)) return;
    setDong([
      ...dong,
      {
        productId: sp.productId,
        ten: sp.ten,
        donVi: sp.donVi,
        onHand: sp.onHand,
        qty: '',
        unitCost: '',
      },
    ]);
  };

  const suaDong = (i: number, patch: Partial<DongForm>) => {
    setDong(dong.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  };

  const luu = async () => {
    setSending(true);
    setLoi(null);
    try {
      const moi = await port.createVoucher({
        type: loai,
        ...(note.trim() === '' ? {} : { note: note.trim() }),
        lines: dong.map((d) => ({
          productId: d.productId,
          qty: Number(d.qty || '0'),
          // A blank cost is SENT AS ABSENT, never as 0: 0 is a valid cost the backend
          // would average in. Absent ⇒ the backend's "bắt buộc giá vốn" 400 under the line.
          ...(loai === 'nhap' && d.unitCost !== '' ? { unitCost: Number(d.unitCost) } : {}),
        })),
      });
      setSheetOpen(false);
      // Switching the filter reloads through the effect; reload by hand only when it stays.
      if (filter === ALL) await load();
      else setFilter(ALL);
      setSelectedId(moi.id);
    } catch (e) {
      setLoi(e as StockVoucherPortError);
    } finally {
      setSending(false);
    }
  };

  const loiCuaDong = (i: number) =>
    (loi?.fieldErrors ?? []).filter((f) => f.field.startsWith(`lines.${i}.`));
  const loiChung = (loi?.fieldErrors ?? []).filter((f) => !/^lines\.\d+\./.test(f.field));

  const dangLoc = filter !== ALL;
  const coGiaVon = detail?.lines.some((l) => l.unitCost !== undefined) ?? false;

  return (
    <WebShell
      url="app.phuongnamsolar.vn/phieu-kho"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="inventory" />}
      topbar={
        <Topbar
          eyebrow="KHO"
          title="Phiếu kho"
          onBack={onBack}
          action={
            <>
              <Icon name="ic-plus" /> Tạo phiếu
            </>
          }
          actionLabel="Tạo phiếu"
          onAction={moForm}
        />
      }
    >
      <div className="pk-wrap">
        <Toolbar>
          <Seg options={FILTER_OPTIONS} activeKey={filter} onSelect={setFilter} />
        </Toolbar>

        {state === 'loading' && (
          <div className="pk-state">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {state === 'error' && (
          <ErrorState message="Không tải được phiếu kho." onRetry={load} retryLabel="Thử lại" />
        )}

        {state === 'ready' && items.length === 0 && dangLoc && (
          <EmptyState icon="ic-warehouse" title="Không có phiếu nào thuộc loại này." />
        )}

        {state === 'ready' && items.length === 0 && !dangLoc && (
          <EmptyState
            icon="ic-warehouse"
            title="Chưa có phiếu kho nào. Bấm Tạo phiếu để bắt đầu."
          />
        )}

        {state === 'ready' && items.length > 0 && (
          <div className="pk-grid">
            <Frame label="Danh sách phiếu">
              <Table>
                <thead>
                  <tr>
                    <th>Phiếu</th>
                    <th>Loại</th>
                    <th>Ngày</th>
                    <th>Người</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr
                      key={p.id}
                      className={p.id === selectedId ? 'pk-row pk-row--active' : 'pk-row'}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <td className="strong mono">{p.ma}</td>
                      <td>
                        <ChipLoai type={p.type} />
                      </td>
                      <td className="mono">{ngayNgan(p.createdAt)}</td>
                      <td>{p.nguoiTao.displayName}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Frame>

            <div>
              {selectedId === null && (
                <EmptyState icon="ic-warehouse" title="Chọn một phiếu để xem chi tiết." />
              )}
              {selectedId !== null && detailState === 'loading' && <Skeleton />}
              {selectedId !== null && detailState === 'error' && (
                <ErrorState
                  message="Không tải được chi tiết phiếu."
                  onRetry={() => void loadDetail(selectedId)}
                  retryLabel="Thử lại"
                />
              )}
              {selectedId !== null && detailState === 'ready' && detail !== null && (
                <Card variant={detail.type === 'nhap' ? 'teal' : 'default'} className="pk-detail">
                  <div className="pk-detail-head">
                    <span className="micro">Chi tiết phiếu</span>
                    <span className="strong mono">{detail.ma}</span>
                    <span className="pk-sp" />
                    <ChipLoai type={detail.type} />
                  </div>
                  <div className="pk-detail-body">
                    <dl className="pk-kv">
                      <dt>Loại</dt>
                      <dd>{moTaLoai(detail.type)}</dd>
                      <dt>Ngày</dt>
                      <dd className="mono">{ngayGio(detail.createdAt)}</dd>
                      <dt>Người tạo</dt>
                      <dd>{detail.nguoiTao.displayName}</dd>
                      <dt>Ghi chú</dt>
                      <dd>{detail.note ?? '—'}</dd>
                    </dl>
                    <Table>
                      <thead>
                        <tr>
                          <th>Sản phẩm</th>
                          <th className="num">SL</th>
                          {coGiaVon && <th className="num">Giá vốn / đv</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lines.map((l) => (
                          <tr key={l.productId}>
                            <td>{l.ten}</td>
                            <td className="num mono">{soLuongCoDau(detail.type, l.qty)}</td>
                            {coGiaVon && (
                              <td className="num mono strong">
                                {l.unitCost !== undefined ? l.unitCost : ''}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    <Banner tone="info">{detail.type === 'nhap' ? NOTE_NHAP : NOTE_XUAT}</Banner>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Tạo phiếu kho">
        <div className="pk-form">
          <Seg
            options={LOAI_OPTIONS}
            activeKey={loai}
            onSelect={(k) => setLoai(k as LoaiPhieu)}
          />
          <Banner tone="info">{loai === 'nhap' ? NOTE_NHAP : NOTE_XUAT}</Banner>

          <Field
            label="Ghi chú"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <div>
            <Button type="button" size="sm" onClick={() => setNote(TON_DAU_KY)}>
              {TON_DAU_KY}
            </Button>
          </div>

          <Field
            aria-label="Tìm sản phẩm để thêm dòng"
            placeholder="Tìm sản phẩm để thêm dòng…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {goiY.length > 0 && (
            <div className="pk-goi-y">
              {goiY.map((sp) => (
                <Button
                  key={sp.productId}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => themDong(sp)}
                >
                  {sp.ten} · Còn {sp.onHand} {sp.donVi}
                </Button>
              ))}
            </div>
          )}

          {dong.map((d, i) => (
            <div key={d.productId} className="pk-dong">
              <div className="pk-dong-head">
                <span className="strong">{d.ten}</span>
                <span className="micro muted">
                  Còn {d.onHand} {d.donVi}
                </span>
                <span className="pk-sp" />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Bỏ dòng ${d.ten}`}
                  onClick={() => {
                    setDong(dong.filter((_, j) => j !== i));
                    // Field errors are keyed by line index (`lines.N.*`): once a line goes,
                    // they would land under the wrong product.
                    setLoi(null);
                  }}
                >
                  <Icon name="ic-trash" />
                </Button>
              </div>
              <div className="pk-dong-fields">
                <Field
                  label="SL"
                  inputMode="numeric"
                  value={d.qty}
                  onChange={(e) => suaDong(i, { qty: chiChuSo(e.target.value) })}
                />
                {loai === 'nhap' && (
                  <Field
                    label="Giá vốn / đv *"
                    inputMode="numeric"
                    value={d.unitCost}
                    onChange={(e) => suaDong(i, { unitCost: chiChuSo(e.target.value) })}
                  />
                )}
              </div>
              {loiCuaDong(i).map((f) => (
                <div key={f.field} className="micro pk-loi">
                  {f.message}
                </div>
              ))}
            </div>
          ))}

          {loi !== null && (
            <Banner tone="danger" icon="ic-alert" role="alert">
              {loi.message}
              {loiChung.map((f) => (
                <div key={f.field}>{f.message}</div>
              ))}
            </Banner>
          )}

          <Button
            type="button"
            variant="primary"
            disabled={sending || dong.length === 0}
            onClick={() => void luu()}
          >
            Lưu phiếu
          </Button>
        </div>
      </Sheet>
    </WebShell>
  );
}
