// hand-authored — web app-screen (Story 4.1). Tạo báo giá kiểu giỏ hàng: chọn
// khách qua tra SĐT (tái dùng TRỌN màn Story 3.4) → thêm/sửa/xoá dòng qua
// OrdersPort, composed entirely from shipped design-system components (AD-13).
//
// THE CLIENT DOES NO MONEY MATH (AD-10/16). Every `unitPrice`/`amount` on this
// screen is a number the BACKEND computed and the port carried in. A qty edit
// goes OUT through `updateLine`; the fresh numbers come BACK in the response.
// The totals (Tổng trước VAT / Tiền VAT / Tổng sau VAT) come from the stateless
// `previewTotal` port call — the screen echoes the displayed lines out and
// renders the backend's three integers as-is; "—" is the not-yet/failed state.
//
// A network failure NEVER wipes entered lines (EXPERIENCE Flow 1): the error
// path only sets a Banner/ErrorState — it never resets `order`.
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  Banner,
  Button,
  Card,
  CartLineRow,
  Checkbox,
  ConfirmDialog,
  CustomerTypeChip,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  ScopeFlag,
  Sheet,
  Table,
} from '../../design-system/components';
import { Gate, PERM } from '../../design-system/gating';
import { filterNav } from '../../design-system/gating/permissions';
import type {
  CatalogGroup,
  CatalogGroupDetail,
  CatalogPort,
  CatalogProduct,
} from '../../design-system/session/catalog-port';
import type {
  Customer,
  CustomersPort,
} from '../../design-system/session/customers-port';
import type {
  Order,
  OrderPortError,
  OrdersPort,
  OrderTotals,
  UpdateOrderMetaInput,
  UpdateScopeFlagsInput,
} from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';
import { CustomerPickScreen, typeLabel } from '../customers/CustomerPickScreen';

import './orders.css';

export interface CreateQuoteScreenProps {
  ordersPort: OrdersPort;
  catalogPort: CatalogPort;
  customersPort: CustomersPort;
  /** Called after the order is confirmed ("Chốt", Story 4.5) with the frozen order. */
  onDone?: (order: Order) => void;
}

type PickerKind = 'none' | 'catalog' | 'group' | 'free';

/** Cờ hiển thị của dòng "linh động/dự kiến" — copy byte-identical web ↔ mobile. */
const FLAG_LINH_DONG = 'Linh động/dự kiến';

export function CreateQuoteScreen({
  ordersPort,
  catalogPort,
  customersPort,
  onDone,
}: CreateQuoteScreenProps) {
  const { perms } = usePermissions();

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  // null = chưa có/preview lỗi → khu tổng hiển thị "—" (không hiển thị số cũ đã sai).
  const [totals, setTotals] = useState<OrderTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<PickerKind>('none');
  // Đang chờ PATCH cờ phạm vi — disable 2 control toggle để tap nhanh không đua
  // response (cờ không ảnh hưởng tiền nên không cần ticket như preview).
  const [scopeBusy, setScopeBusy] = useState(false);
  // Đang chờ PATCH metadata (tick VAT / kWp / hạn hiệu lực, Story 4.4) — cùng
  // pattern scopeBusy; tick VAT ảnh hưởng tiền nên sau PATCH phải refreshTotals.
  const [metaBusy, setMetaBusy] = useState(false);
  // Text đang gõ của 2 input metadata — commit-on-blur, prefill từ order; lỗi
  // port thì revert về giá trị order cũ (bất biến k).
  const [kWpText, setKWpText] = useState('');
  const [validityText, setValidityText] = useState('');
  // Dialog xác nhận Chốt (Story 4.5) + busy trong lúc chờ port — cùng khuôn
  // scopeBusy/metaBusy; thành công thì `editable` tự tắt vì status đổi.
  const [chotDialogOpen, setChotDialogOpen] = useState(false);
  const [chotBusy, setChotBusy] = useState(false);

  // Preview là call THỨ HAI sau mỗi mutation và có thể về trễ/đè: mutation liên
  // tiếp không được cho tổng cũ đè tổng mới (pattern `latest` của CustomerListScreen).
  const latestTotals = useRef(0);

  // Catalog picker state.
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  // Group picker state. `addedByProduct` maps productId → the line it created in
  // THIS sheet session, so unticking removes exactly that line. Never persisted —
  // a group leaves no trace on the order (§2).
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [groupDetail, setGroupDetail] = useState<CatalogGroupDetail | null>(null);
  const [addedByProduct, setAddedByProduct] = useState<Record<string, string>>({});

  // Free-line form state.
  const [freeName, setFreeName] = useState('');
  const [freeUnit, setFreeUnit] = useState('');
  const [freeQty, setFreeQty] = useState(1);
  const [freeUnitPrice, setFreeUnitPrice] = useState(0);
  const [freeNote, setFreeNote] = useState('');

  useEffect(() => {
    if (picker !== 'catalog') return;
    catalogPort.listProducts(search === '' ? undefined : search).then(
      setProducts,
      () => setProducts([]),
    );
  }, [picker, search, catalogPort]);

  useEffect(() => {
    if (picker !== 'group') return;
    catalogPort.listGroups().then(setGroups, () => setGroups([]));
  }, [picker, catalogPort]);

  /**
   * MỘT đường code duy nhất cho tổng: echo các dòng backend vừa trả qua
   * `previewTotal` — KHÔNG phép tính nào trong màn (AD-16). Lỗi preview → totals
   * về "—" + message; KHÔNG xoá giỏ, KHÔNG chặn sửa dòng tiếp (bất biến k).
   */
  async function refreshTotals(fetched: Order) {
    const ticket = ++latestTotals.current;
    try {
      const fresh = await ordersPort.previewTotal({
        lines: fetched.lineItems.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })),
        // Echo tick VAT của Đơn (Story 4.4) — như đã echo unitPrice; đơn cũ
        // vatMode null thì bỏ qua field (backend coi như có VAT).
        vatMode: fetched.vatMode ?? undefined,
      });
      if (ticket !== latestTotals.current) return;
      setTotals(fresh);
    } catch (err) {
      if (ticket !== latestTotals.current) return;
      setTotals(null);
      setError(messageOf(err));
    }
  }

  /** Re-read the order — the retry path after a failed refresh; NEVER resets state on failure. */
  async function refresh() {
    if (order === null) return;
    try {
      const fetched = await ordersPort.get(order.id);
      setOrder(fetched);
      setError(null);
      await refreshTotals(fetched);
    } catch (err) {
      setError(messageOf(err));
    }
  }

  // BƯỚC 1 — chọn khách: màn pick TỰ HOST shell riêng, nên khi chưa có đơn nó LÀ
  // toàn bộ view (không bọc trong shell của màn này — tránh shell-lồng-shell).
  // Riêng lỗi tạo đơn phải CÓ CHỖ hiện ngay tại bước này — ErrorState của bước 2
  // chưa tồn tại, thiếu Banner ở đây là user bấm chọn khách mà màn im lặng tuyệt đối.
  if (order === null) {
    return (
      <>
        {error !== null && <Banner tone="danger">{error}</Banner>}
        <CustomerPickScreen
          port={customersPort}
          onSelect={async (picked) => {
            try {
              const created = await ordersPort.create({ customerSdt: picked.sdt });
              setCustomer(picked);
              setOrder(created);
              syncMetaTexts(created);
              setError(null);
              await refreshTotals(created);
            } catch (err) {
              // Đơn chưa tạo được — ở lại màn pick; message backend nguyên văn.
              setError(messageOf(err));
            }
          }}
        />
      </>
    );
  }

  async function addCatalogLine(productId: string, qty: number): Promise<string | null> {
    try {
      const line = await ordersPort.addLine(order!.id, { productId, qty });
      await refresh();
      return line.id;
    } catch (err) {
      setError(messageOf(err));
      return null;
    }
  }

  async function handleFreeLineSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    try {
      await ordersPort.addLine(order!.id, {
        name: freeName,
        unit: freeUnit,
        qty: freeQty,
        unitPrice: freeUnitPrice,
        note: freeNote === '' ? undefined : freeNote,
      });
      setFreeName('');
      setFreeUnit('');
      setFreeQty(1);
      setFreeUnitPrice(0);
      setFreeNote('');
      setPicker('none');
      await refresh();
    } catch (err) {
      setError(messageOf(err));
      setFieldErrors(fieldErrorsOf(err));
    }
  }

  async function handleQtyChange(lineId: string, qty: number) {
    if (qty < 1) return;
    try {
      await ordersPort.updateLine(order!.id, lineId, { qty });
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function handleUnitPriceChange(lineId: string, unitPrice: number) {
    if (unitPrice < 0) return;
    try {
      await ordersPort.updateLine(order!.id, lineId, { unitPrice });
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  /**
   * Toggle cờ Thi công/Vận chuyển (Story 4.3): PATCH qua port → thay order bằng
   * response. KHÔNG gọi previewTotal — cờ không ảnh hưởng tiền (AD-16 nguyên vẹn).
   * Lỗi → Banner qua ErrorState, GIỮ nguyên giỏ + state cờ cũ (bất biến k).
   */
  async function handleScopeToggle(input: UpdateScopeFlagsInput) {
    setScopeBusy(true);
    try {
      const updated = await ordersPort.updateScopeFlags(order!.id, input);
      setOrder(updated);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setScopeBusy(false);
    }
  }

  /** Đồng bộ text 2 input metadata từ Đơn — lúc tạo đơn, sau commit, và khi revert lỗi. */
  function syncMetaTexts(source: Order) {
    setKWpText(source.kWp === null ? '' : String(source.kWp));
    setValidityText(source.validityNote ?? '');
  }

  /**
   * PATCH nhóm metadata (Story 4.4): tick VAT / kWp / hạn hiệu lực. Tick VAT ĐỔI
   * TIỀN ⇒ sau khi PATCH thành công phải refreshTotals với order MỚI (echo
   * vatMode mới — 3 số tổng đổi tức thì, EXPERIENCE §Realtime). Lỗi → Banner,
   * GIỮ nguyên giỏ + revert input về giá trị order cũ (bất biến k).
   */
  async function handleMetaUpdate(input: UpdateOrderMetaInput) {
    setMetaBusy(true);
    try {
      const updated = await ordersPort.updateOrderMeta(order!.id, input);
      setOrder(updated);
      syncMetaTexts(updated);
      setError(null);
      await refreshTotals(updated);
    } catch (err) {
      setError(messageOf(err));
      syncMetaTexts(order!);
    } finally {
      setMetaBusy(false);
    }
  }

  /**
   * Commit kWp on blur: "8,82"/"8.82" → 8.82 — CHUYỂN ĐỔI INPUT, không phải số
   * học tiền; rỗng → null (xoá); parse NaN → giữ nguyên + báo lỗi field, KHÔNG
   * gọi port.
   */
  function commitKWp() {
    const raw = kWpText.trim();
    const current = order!.kWp;
    if (raw === '') {
      if (current !== null) void handleMetaUpdate({ kWp: null });
      return;
    }
    const parsed = Number(raw.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setFieldErrors((prev) => ({
        ...prev,
        kWp: 'Công suất phải là số (vd 8,82).',
      }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.kWp;
      return next;
    });
    if (parsed === current) return;
    void handleMetaUpdate({ kWp: parsed });
  }

  /** Commit hạn hiệu lực on blur — rỗng → null (xoá); chỉ PATCH khi giá trị đổi. */
  function commitValidityNote() {
    const raw = validityText.trim();
    const next = raw === '' ? null : raw;
    if (next === order!.validityNote) return;
    void handleMetaUpdate({ validityNote: next });
  }

  /**
   * Chốt Đơn (Story 4.5, FR-5): BACKEND đóng băng giá bằng snapshot và đổi
   * status — màn chỉ render Order trả về (`editable` tự tắt, nút Chốt biến
   * mất). KHÔNG toast hô hào (voice EXPERIENCE) — chip trạng thái đổi là đủ.
   * Lỗi → Banner + giỏ + state cũ NGUYÊN VẸN (bất biến k).
   */
  async function handleConfirmOrder() {
    setChotDialogOpen(false);
    setChotBusy(true);
    try {
      const confirmed = await ordersPort.confirmOrder(order!.id);
      setOrder(confirmed);
      setError(null);
      onDone?.(confirmed);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setChotBusy(false);
    }
  }

  async function handleDelete(lineId: string) {
    try {
      await ordersPort.removeLine(order!.id, lineId);
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  /** Tick = thêm một dòng THƯỜNG trỏ Product thật; untick = gỡ đúng dòng vừa thêm. */
  async function handleGroupTick(productId: string, checked: boolean) {
    if (checked) {
      const lineId = await addCatalogLine(productId, 1);
      if (lineId !== null) {
        setAddedByProduct((prev) => ({ ...prev, [productId]: lineId }));
      }
      return;
    }
    const lineId = addedByProduct[productId];
    if (lineId === undefined) return;
    await handleDelete(lineId);
    setAddedByProduct((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  const editable = order.status === 'baogia';
  const lines = order.lineItems;

  // BƯỚC 2 — giỏ hàng (shell của màn này chỉ render từ đây).
  return (
    <WebShell
      url="app.phuongnamsolar.vn/bao-gia/tao-moi"
      sidebar={<Sidebar sections={filterNav(SIDEBAR_NAV, perms)} activeKey="orders" />}
      topbar={<Topbar eyebrow="ĐƠN HÀNG" title="Tạo báo giá" />}
    >
      <div className="quote-wrap">
        <Card className="quote-customer">
          <div className="quote-customer-row">
            <div>
              <div className="micro muted">Khách hàng</div>
              <div className="quote-customer-name">{customer?.name ?? order.customerSdt}</div>
              <div className="micro muted quote-mono">{order.customerSdt}</div>
            </div>
            <CustomerTypeChip>{typeLabel(order.custType)}</CustomerTypeChip>
          </div>
          {/* Cờ phạm vi (Story 4.3): chip CHỈ hiển thị (ScopeFlag là span tĩnh,
              màn sở hữu quyết định on/off); toggle qua 2 Checkbox riêng —
              "Thiết bị" luôn bật nên KHÔNG có control tắt. */}
          <div className="quote-scope-row">
            <div className="micro muted">Phạm vi</div>
            <div className="quote-scope-flags">
              <ScopeFlag on={order.scopeThietBi}>Thiết bị</ScopeFlag>
              <ScopeFlag on={order.scopeThiCong}>Thi công</ScopeFlag>
              <ScopeFlag on={order.scopeVanChuyen}>Vận chuyển</ScopeFlag>
            </div>
            <div className="quote-scope-toggles">
              <Checkbox
                label="Thi công"
                checked={order.scopeThiCong}
                disabled={!editable || scopeBusy}
                onChange={(checked) => void handleScopeToggle({ scopeThiCong: checked })}
              />
              <Checkbox
                label="Vận chuyển"
                checked={order.scopeVanChuyen}
                disabled={!editable || scopeBusy}
                onChange={(checked) => void handleScopeToggle({ scopeVanChuyen: checked })}
              />
            </div>
          </div>
          {/* Metadata Đơn (Story 4.4): commit-on-blur → PATCH; lỗi → Banner +
              input revert giá trị cũ (bất biến k). kWp là CHUYỂN ĐỔI input
              ("8,82" → 8.82), không phải số học tiền. */}
          <div className="quote-meta-row">
            <Field
              label="Công suất (kWp)"
              inputMode="decimal"
              value={kWpText}
              disabled={!editable || metaBusy}
              onChange={(e) => setKWpText(e.target.value)}
              onBlur={() => commitKWp()}
            />
            <Field
              label="Hiệu lực báo giá"
              value={validityText}
              disabled={!editable || metaBusy}
              onChange={(e) => setValidityText(e.target.value)}
              onBlur={() => commitValidityNote()}
            />
          </div>
          {fieldErrors.kWp && <Banner tone="danger">{fieldErrors.kWp}</Banner>}
        </Card>

        {error !== null && (
          <ErrorState message={error} onRetry={() => void refresh()} />
        )}

        <Frame label="Giỏ hàng">
          {lines.length === 0 ? (
            <EmptyState
              icon="ic-orders"
              title="Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Món</th>
                  <th className="num">SL</th>
                  <th className="num">Đơn giá</th>
                  <th className="num">Thành tiền</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <CartLineRow
                    key={line.id}
                    name={line.name}
                    meta={line.note ?? undefined}
                    qty={line.qty}
                    unitPrice={line.unitPrice}
                    amount={line.amount}
                    editable={editable}
                    priceEditable={editable && line.priceEditable}
                    flag={line.isFlexible ? FLAG_LINH_DONG : undefined}
                    zebra={index % 2 === 1}
                    onQtyChange={(qty) => void handleQtyChange(line.id, qty)}
                    onUnitPriceChange={(price) => void handleUnitPriceChange(line.id, price)}
                    onDelete={() => void handleDelete(line.id)}
                  />
                ))}
              </tbody>
            </Table>
          )}

          <div className="quote-add-row">
            <Button variant="accent" size="sm" type="button" onClick={() => setPicker('catalog')}>
              Chọn từ danh mục
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setPicker('group')}>
              Chọn gói vật tư
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setPicker('free')}>
              Dòng tự do
            </Button>
          </div>
        </Frame>

        {/* Khu tổng tiền: 3 số backend trả qua preview-total, integer thô (cùng
            convention `amount` của CartLineRow). "—" = chưa có/preview lỗi.
            Client CẤM số học tiền. Tick VAT (Story 4.4) phản ánh order.vatMode;
            thuế suất % là GIÁ TRỊ BACKEND từ totals.vatRate — không nhãn tĩnh. */}
        <Frame label="Tổng kết">
          <div className="quote-vat-toggle">
            <Checkbox
              label="Tính VAT"
              checked={order.vatMode !== 'khong_vat'}
              disabled={!editable || metaBusy}
              onChange={(checked) =>
                void handleMetaUpdate({ vatMode: checked ? 'co_vat' : 'khong_vat' })
              }
            />
            <span className="micro muted">{totals ? `${totals.vatRate}%` : '—'}</span>
          </div>
          <dl className="quote-totals">
            <dt>Tổng trước VAT</dt>
            <dd className="num mono">{totals ? String(totals.subtotal) : '—'}</dd>
            <dt>Tiền VAT</dt>
            <dd className="num mono">{totals ? String(totals.vatAmount) : '—'}</dd>
            <dt>Tổng sau VAT</dt>
            <dd className="num mono strong">{totals ? String(totals.total) : '—'}</dd>
          </dl>
        </Frame>

        {/* Chốt (Story 4.5): quyền riêng `orders.confirm` — thiếu quyền thì nút
            BIẾN MẤT (Gate, UX-DR-22), không disabled xám; backend vẫn enforce
            (AD-4). Bấm mở dialog nêu hệ quả — Chốt là hành động có hệ quả. */}
        {editable && (
          <Gate perms={perms} requires={PERM.ordersConfirm}>
            <div className="quote-chot-row">
              <Button
                variant="primary"
                type="button"
                disabled={chotBusy}
                onClick={() => setChotDialogOpen(true)}
              >
                Chốt báo giá
              </Button>
            </div>
          </Gate>
        )}
      </div>

      {/* Picker: lựa chọn nhanh ⇒ Sheet (UX-DR-20); chồng tối đa 1 cấp. */}
      <Sheet open={picker === 'catalog'} onClose={() => setPicker('none')} title="Chọn từ danh mục">
        <div className="quote-picker">
          <Field
            label="Tìm theo tên hoặc SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="quote-product-list">
            {products.map((product) => (
              <li key={product.id}>
                <div className="quote-product-info">
                  <span className="strong">{product.name}</span>
                  <span className="micro muted">
                    {product.sku} · {product.unit} · <span className="mono">{product.price}</span>
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  type="button"
                  onClick={() => void addCatalogLine(product.id, 1)}
                >
                  Thêm
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" type="button" onClick={() => setPicker('none')}>
            Đóng
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={picker === 'group'}
        onClose={() => {
          setPicker('none');
          setGroupDetail(null);
          setAddedByProduct({});
        }}
        title="Chọn gói vật tư"
      >
        <div className="quote-picker">
          {groupDetail === null ? (
            <ul className="quote-product-list">
              {groups.map((group) => (
                <li key={group.id}>
                  <div className="quote-product-info">
                    <span className="strong">{group.name}</span>
                    {group.description !== null && (
                      <span className="micro muted">{group.description}</span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={() =>
                      void catalogPort.getGroup(group.id).then(setGroupDetail, (err) => setError(messageOf(err)))
                    }
                  >
                    Mở checklist
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <div className="strong quote-group-title">{groupDetail.name}</div>
              {/* Checklist: mỗi item tick thành MỘT dòng thường trỏ Product thật.
                  KHÔNG lưu vết gói/groupName lên đơn (§2). Item ngừng bán = disabled. */}
              <ul className="quote-checklist">
                {groupDetail.items.map((item) => (
                  <li key={item.productId}>
                    <Checkbox
                      label={`${item.name} · ${item.unit}`}
                      checked={addedByProduct[item.productId] !== undefined}
                      disabled={!item.isActive}
                      onChange={(checked) => void handleGroupTick(item.productId, checked)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setPicker('none');
              setGroupDetail(null);
              setAddedByProduct({});
            }}
          >
            Đóng
          </Button>
        </div>
      </Sheet>

      {/* Huỷ = đóng dialog, KHÔNG gọi port — đơn ở nguyên baogia. */}
      <ConfirmDialog
        open={chotDialogOpen}
        title="Chốt báo giá"
        consequence="Chốt sẽ đóng băng giá của mọi dòng theo danh mục hiện tại — sửa giá sau này cần tạo bản mới."
        onConfirm={() => void handleConfirmOrder()}
        onCancel={() => setChotDialogOpen(false)}
      />

      <Sheet open={picker === 'free'} onClose={() => setPicker('none')} title="Dòng tự do">
        <form onSubmit={handleFreeLineSubmit} noValidate className="quote-picker">
          {/* Tên nhiều dòng được (UX-DR-24) — Field multiline của design-system. */}
          <Field
            label="Tên dòng"
            multiline
            rows={2}
            value={freeName}
            onChange={(e) => setFreeName(e.target.value)}
          />
          {fieldErrors.name && <Banner tone="danger">{fieldErrors.name}</Banner>}
          <Field label="Đơn vị" value={freeUnit} onChange={(e) => setFreeUnit(e.target.value)} />
          {fieldErrors.unit && <Banner tone="danger">{fieldErrors.unit}</Banner>}
          <Field
            label="Số lượng"
            inputMode="numeric"
            value={freeQty}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setFreeQty(n);
            }}
          />
          {fieldErrors.qty && <Banner tone="danger">{fieldErrors.qty}</Banner>}
          <Field
            label="Đơn giá"
            inputMode="numeric"
            value={freeUnitPrice}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setFreeUnitPrice(n);
            }}
          />
          {fieldErrors.unitPrice && <Banner tone="danger">{fieldErrors.unitPrice}</Banner>}
          <Field label="Diễn giải" value={freeNote} onChange={(e) => setFreeNote(e.target.value)} />
          {fieldErrors.note && <Banner tone="danger">{fieldErrors.note}</Banner>}
          <div className="quote-add-row">
            <Button variant="ghost" type="button" onClick={() => setPicker('none')}>
              Đóng
            </Button>
            <Button variant="primary" type="submit">
              Thêm dòng
            </Button>
          </div>
        </form>
      </Sheet>
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

/** `fieldErrors` from the AD-5 envelope, flattened onto the field they belong to. */
function fieldErrorsOf(err: unknown): Record<string, string> {
  const envelope = err as Partial<OrderPortError>;
  const out: Record<string, string> = {};
  for (const item of envelope?.fieldErrors ?? []) {
    out[item.field] = item.message;
  }
  return out;
}
