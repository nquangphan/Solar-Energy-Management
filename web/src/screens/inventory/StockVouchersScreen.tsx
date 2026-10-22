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
// An order-bound stock-out (`orderId` present) is read-only here: it
// is created from the order, and its author is the person who CONFIRMED it.
//
// A return voucher ("Nhập trả", `PK-NT-…`) is a stock-in born from a cancelled order's
// stock-out. Whether a stock-out can be returned (`canReturn`) is the backend's call. The
// return sheet starts each "Nhận lại" at the issued quantity, never compares it with that
// quantity (the backend answers `RETURN_EXCEEDS_ISSUED`), never turns a blank into 0, and
// leaves zero rows out of the request — so a backend `lines.{i}` index is the index in the
// SENT array and is mapped back to the displayed row.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Money,
  Sheet,
  Skeleton,
  Table,
} from '../../design-system/components';
import { filterNav } from '../../design-system/gating/permissions';
import { Icon } from '../../design-system/icons/Icon';
import type { InventoryPort, StockItemView } from '../../design-system/session/inventory-port';
import type {
  CreateReturnVoucherInput,
  VoucherType,
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
const RETURNS = 'RETURNS';
const FILTER_OPTIONS = [
  { key: ALL, label: 'Tất cả' },
  { key: 'nhap', label: 'Nhập' },
  { key: 'xuat', label: 'Xuất' },
  { key: RETURNS, label: 'Nhập trả' },
];
const LOAI_OPTIONS = [
  { key: 'nhap', label: 'Nhập' },
  { key: 'xuat', label: 'Xuất' },
];

const NOTE_NHAP =
  'Giá vốn ở đây không được bỏ trống. Hệ thống lấy nó tính bình quân gia quyền rồi cập nhật giá vốn hiện hành của sản phẩm — một chỗ gõ, không ai phải nhớ sửa hai nơi.';
const NOTE_XUAT = 'Phiếu xuất không gắn đơn (hàng hỏng, mẫu, điều chỉnh). Không sửa/xoá sau khi lưu.';
const TON_DAU_KY = 'Tồn đầu kỳ';
const NOTE_RETURN_BANNER =
  'Đơn đã huỷ sau khi xuất kho. Tồn kho không tự cộng lại — hàng chỉ về kho khi có người đếm và xác nhận phiếu này.';
const NOTE_RETURN_FEWER =
  'Nhận lại ít hơn đã xuất là chuyện bình thường (hàng đã cắt, đã lắp, hỏng). Nhập đúng số đếm được — không ép cho khớp.';
const NOTE_RETURN_FOOT =
  'Xác nhận → cộng tồn thật đúng số đếm được, Audit ghi người nhận. Không sửa/xoá sau khi lưu.';
const RETURN_BLANK_ERROR = 'Nhập số nhận lại (0 nếu không nhận lại).';
const RETURN_UNKNOWN_ERROR = 'Không lưu được phiếu nhập trả. Thử lại.';

/** A port refusal is the plain AD-5 envelope; anything else (an Error, a network fault) is unknown. */
function toReturnError(e: unknown): StockVoucherPortError {
  if (
    typeof e === 'object' &&
    e !== null &&
    !(e instanceof Error) &&
    typeof (e as { message?: unknown }).message === 'string'
  ) {
    return e as StockVoucherPortError;
  }
  return { message: RETURN_UNKNOWN_ERROR };
}

/** The list query behind each tab. "Nhập" excludes returns; "Nhập trả" is only returns. */
function listQuery(filter: string) {
  if (filter === ALL) return {};
  if (filter === RETURNS) return { isReturn: true };
  if (filter === 'nhap') return { type: 'nhap' as const, isReturn: false };
  return { type: filter as VoucherType };
}

/** Chip label + colour token per type. TWIN of `_chipLoai()` in the Flutter screen. */
function nhanLoai(type: VoucherType, isReturn: boolean): { label: string; mau: string } {
  if (isReturn) return { label: 'Nhập trả', mau: 'var(--info)' };
  return type === 'nhap'
    ? { label: 'Nhập', mau: 'var(--ok)' }
    : { label: 'Xuất', mau: 'var(--warn)' };
}

/** `+40` / `−14` — a sign glued on as text from the type. TWIN of `_soLuongCoDau()`. */
function soLuongCoDau(type: VoucherType, qty: number): string {
  return `${type === 'nhap' ? '+' : '−'}${qty}`;
}

function moTaLoai(type: VoucherType, orderBound: boolean): string {
  if (type === 'nhap') return 'Nhập kho';
  return orderBound ? 'Xuất kho · gắn đơn' : 'Xuất kho · không gắn đơn';
}

/** Keep digits only — quantities and costs are whole numbers; the backend validates ranges. */
function chiChuSo(text: string): string {
  return text.replace(/\D/g, '');
}

interface DongForm {
  productId: string;
  name: string;
  unit: string;
  onHand: number;
  qty: string;
  unitCost: string;
}

interface ReturnRow {
  productId: string;
  name: string;
  unit: string;
  issued: number;
  /** Digits as typed; '' = blank (an error, never 0). */
  qty: string;
}

function ChipLoai({ type, isReturn = false }: { type: VoucherType; isReturn?: boolean }) {
  const nhan = nhanLoai(type, isReturn);
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
      const result = await port.listVouchers(listQuery(filter));
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
  const [loai, setLoai] = useState<VoucherType>('nhap');
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
        name: sp.name,
        unit: sp.unit,
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

  // ---- Return sheet ----
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
  const [returnNote, setReturnNote] = useState('');
  const [returnBlank, setReturnBlank] = useState<Set<string>>(new Set());
  const [returnError, setReturnError] = useState<StockVoucherPortError | null>(null);
  const [returnSending, setReturnSending] = useState(false);
  /** Set synchronously: two clicks in one tick both see the state `false`. */
  const returnInFlight = useRef(false);
  /** Displayed-row productId for each index of the array last SENT (zero rows removed). */
  const [returnSentIds, setReturnSentIds] = useState<string[]>([]);

  const openReturnSheet = (origin: StockVoucherDetail) => {
    setReturnRows(
      origin.lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        unit: l.unit,
        issued: l.qty,
        qty: String(l.qty),
      })),
    );
    setReturnNote('');
    setReturnBlank(new Set());
    setReturnError(null);
    setReturnSentIds([]);
    setReturnOpen(true);
  };

  const editReturnRow = (productId: string, qty: string) => {
    setReturnRows(returnRows.map((d) => (d.productId === productId ? { ...d, qty } : d)));
    setReturnBlank(new Set([...returnBlank].filter((id) => id !== productId)));
    setReturnError(null);
  };

  const saveReturn = async () => {
    if (detail === null || returnInFlight.current) return;
    const blank = returnRows.filter((d) => d.qty === '');
    if (blank.length > 0) {
      setReturnBlank(new Set(blank.map((d) => d.productId)));
      return;
    }
    const toSend = returnRows.filter((d) => Number(d.qty) > 0);
    if (toSend.length === 0) return;
    const input: CreateReturnVoucherInput = {
      ...(returnNote.trim() === '' ? {} : { note: returnNote.trim() }),
      lines: toSend.map((d) => ({ productId: d.productId, qty: Number(d.qty) })),
    };
    setReturnSentIds(toSend.map((d) => d.productId));
    returnInFlight.current = true;
    setReturnSending(true);
    setReturnError(null);
    try {
      const created = await port.createReturnVoucher(detail.id, input);
      setReturnOpen(false);
      if (filter === ALL) await load();
      else setFilter(ALL);
      setSelectedId(created.id);
    } catch (e) {
      setReturnError(toReturnError(e));
    } finally {
      returnInFlight.current = false;
      setReturnSending(false);
    }
  };

  /** Backend `lines.{i}.…` errors, `i` = index in the sent array → the displayed row's productId. */
  const returnRowErrors = (productId: string) =>
    (returnError?.fieldErrors ?? []).filter((f) => {
      const m = /^lines\.(\d+)\./.exec(f.field);
      return m !== null && returnSentIds[Number(m[1])] === productId;
    });
  const returnGeneralErrors = (returnError?.fieldErrors ?? []).filter((f) => {
    const m = /^lines\.(\d+)\./.exec(f.field);
    return m === null || returnSentIds[Number(m[1])] === undefined;
  });
  const hasReturnRow = returnRows.some((d) => d.qty === '' || Number(d.qty) > 0);

  const loiCuaDong = (i: number) =>
    (loi?.fieldErrors ?? []).filter((f) => f.field.startsWith(`lines.${i}.`));
  const loiChung = (loi?.fieldErrors ?? []).filter((f) => !/^lines\.\d+\./.test(f.field));

  const dangLoc = filter !== ALL;
  const isReturnVoucher = detail?.returnOf !== undefined || detail?.returnOfVoucherId !== undefined;
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
                      <td className="strong mono">{p.code}</td>
                      <td>
                        <ChipLoai type={p.type} isReturn={p.returnOfVoucherId !== undefined} />
                      </td>
                      <td className="mono">{ngayNgan(p.createdAt)}</td>
                      <td>{p.createdBy.displayName}</td>
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
                    <span className="strong mono">{detail.code}</span>
                    <span className="pk-sp" />
                    <ChipLoai type={detail.type} isReturn={isReturnVoucher} />
                  </div>
                  <div className="pk-detail-body">
                    <dl className="pk-kv">
                      <dt>Loại</dt>
                      <dd>
                        {isReturnVoucher
                          ? 'Nhập trả · từ đơn huỷ'
                          : moTaLoai(detail.type, detail.orderId !== undefined)}
                      </dd>
                      {detail.orderId !== undefined && (
                        <>
                          <dt>Gắn đơn</dt>
                          <dd className="mono">{detail.orderId}</dd>
                        </>
                      )}
                      {detail.returnOf !== undefined && (
                        <>
                          <dt>Gắn đơn</dt>
                          <dd className="mono">{detail.returnOf.orderId}</dd>
                          <dt>Phiếu xuất gốc</dt>
                          <dd className="mono">{detail.returnOf.code}</dd>
                        </>
                      )}
                      {detail.returnVoucher !== undefined && (
                        <>
                          <dt>Phiếu nhập trả</dt>
                          <dd>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedId(detail.returnVoucher!.id)}
                            >
                              {detail.returnVoucher.code}
                            </Button>
                          </dd>
                        </>
                      )}
                      <dt>Ngày</dt>
                      <dd className="mono">{ngayGio(detail.createdAt)}</dd>
                      <dt>
                        {isReturnVoucher
                          ? 'Người nhận'
                          : detail.orderId !== undefined
                            ? 'Người xác nhận'
                            : 'Người tạo'}
                      </dt>
                      <dd>{detail.createdBy.displayName}</dd>
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
                            <td>{l.name}</td>
                            <td className="num mono">{soLuongCoDau(detail.type, l.qty)}</td>
                            {coGiaVon && (
                              <td className="num mono strong">
                                {l.unitCost !== undefined ? <Money value={l.unitCost} /> : ''}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    {detail.canReturn && (
                      <div>
                        <Button type="button" onClick={() => openReturnSheet(detail)}>
                          Tạo phiếu nhập trả
                        </Button>
                      </div>
                    )}
                    {isReturnVoucher ? null : detail.orderId !== undefined ? (
                      <Banner tone="info">
                        <strong>Một Đơn — một phiếu xuất.</strong> Lúc xác nhận, giá vốn được đóng
                        băng vào từng dòng đơn. Audit ghi người xác nhận. Không sửa/xoá sau khi lưu.
                      </Banner>
                    ) : (
                      <Banner tone="info">{detail.type === 'nhap' ? NOTE_NHAP : NOTE_XUAT}</Banner>
                    )}
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
            onSelect={(k) => setLoai(k as VoucherType)}
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
                  {sp.name} · Còn {sp.onHand} {sp.unit}
                </Button>
              ))}
            </div>
          )}

          {dong.map((d, i) => (
            <div key={d.productId} className="pk-dong">
              <div className="pk-dong-head">
                <span className="strong">{d.name}</span>
                <span className="micro muted">
                  Còn {d.onHand} {d.unit}
                </span>
                <span className="pk-sp" />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Bỏ dòng ${d.name}`}
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

      <Sheet open={returnOpen} onClose={() => setReturnOpen(false)} title="Tạo phiếu nhập trả">
        <div className="pk-form">
          <Banner tone="info">{NOTE_RETURN_BANNER}</Banner>
          <Table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th className="num">Đã xuất</th>
                <th className="num">Nhận lại</th>
              </tr>
            </thead>
            <tbody>
              {returnRows.map((d) => (
                <tr key={d.productId} className="pk-return-row">
                  <td>{d.name}</td>
                  <td className="num mono">
                    {d.issued} {d.unit}
                  </td>
                  <td className="num">
                    <Field
                      aria-label={`Nhận lại ${d.name}`}
                      inputMode="numeric"
                      value={d.qty}
                      onChange={(e) => editReturnRow(d.productId, chiChuSo(e.target.value))}
                    />
                    {returnBlank.has(d.productId) && (
                      <div className="micro pk-loi">{RETURN_BLANK_ERROR}</div>
                    )}
                    {returnRowErrors(d.productId).map((f) => (
                      <div key={f.field} className="micro pk-loi">
                        {f.message}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="micro muted">{NOTE_RETURN_FEWER}</div>
          <Field
            label="Ghi chú"
            value={returnNote}
            maxLength={500}
            onChange={(e) => setReturnNote(e.target.value)}
          />
          {returnError !== null && (
            <Banner tone="danger" icon="ic-alert" role="alert">
              {returnError.message}
              {returnGeneralErrors.map((f) => (
                <div key={f.field}>{f.message}</div>
              ))}
            </Banner>
          )}
          <Button
            type="button"
            variant="primary"
            disabled={returnSending || !hasReturnRow}
            onClick={() => void saveReturn()}
          >
            Xác nhận nhập trả
          </Button>
          <div className="micro muted">{NOTE_RETURN_FOOT}</div>
        </div>
      </Sheet>
    </WebShell>
  );
}
