// hand-authored — web app-screen (Story 4.1). Tạo báo giá kiểu giỏ hàng: chọn
// khách qua tra SĐT (tái dùng TRỌN màn Story 3.4) → thêm/sửa/xoá dòng qua
// OrdersPort, composed entirely from shipped design-system components (AD-13).
//
// THE CLIENT DOES NO MONEY MATH (AD-10/16). Every `unitPrice`/`amount` on this
// screen is a number the BACKEND computed and the port carried in. A qty edit
// goes OUT through `updateLine`; the fresh numbers come BACK in the response.
// The totals area renders "—" until Story 4.2 wires `preview-total`.
//
// A network failure NEVER wipes entered lines (EXPERIENCE Flow 1): the error
// path only sets a Banner/ErrorState — it never resets `order`.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  Banner,
  Button,
  Card,
  CartLineRow,
  Checkbox,
  CustomerTypeChip,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Sheet,
  Table,
} from '../../design-system/components';
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
} from '../../design-system/session/orders-port';
import { usePermissions } from '../../design-system/session/use-permissions';
import { Sidebar, SIDEBAR_NAV, Topbar, WebShell } from '../../design-system/shell';
import { CustomerPickScreen, typeLabel } from '../customers/CustomerPickScreen';

import './orders.css';

export interface CreateQuoteScreenProps {
  ordersPort: OrdersPort;
  catalogPort: CatalogPort;
  customersPort: CustomersPort;
  /** Called when the user finishes building (Story 4.5 owns Chốt — nothing here). */
  onDone?: (order: Order) => void;
}

type PickerKind = 'none' | 'catalog' | 'group' | 'free';

/** Cờ hiển thị của dòng "linh động/dự kiến" — copy byte-identical web ↔ mobile. */
const FLAG_LINH_DONG = 'Linh động/dự kiến';

export function CreateQuoteScreen({
  ordersPort,
  catalogPort,
  customersPort,
  onDone: _onDone,
}: CreateQuoteScreenProps) {
  const { perms } = usePermissions();

  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<PickerKind>('none');

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

  /** Re-read the order — the retry path after a failed refresh; NEVER resets state on failure. */
  async function refresh() {
    if (order === null) return;
    try {
      setOrder(await ordersPort.get(order.id));
      setError(null);
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
              setError(null);
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

        {/* Khu tổng tiền: placeholder — Story 4.2 nối preview-total. Client CẤM số học tiền. */}
        <Frame label="Tổng kết">
          <dl className="quote-totals">
            <dt>Tổng trước VAT</dt>
            <dd className="num mono">—</dd>
            <dt>Tiền VAT</dt>
            <dd className="num mono">—</dd>
            <dt>Tổng sau VAT</dt>
            <dd className="num mono strong">—</dd>
          </dl>
        </Frame>
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
