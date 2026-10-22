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
//
// STOCK IS A HINT HERE, NEVER A GATE. After each load/line change the screen
// reads the backend's stock warning (`getStockCheck`) and only renders it: a
// per-line label picked from `status`, and one warn banner for short products.
// A failed read hides the hints — no error banner, the cart is untouched — and
// "Chốt" never depends on stock (blocking lives at the stock-out step).
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
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Frame,
  Money,
  ScopeFlag,
  Sheet,
  Table,
  shareFiles,
} from '../../design-system/components';
// PERMISSION_KEYS (generated, đủ 21 khoá) chứ KHÔNG phải PERM (hand-block 7 khoá
// nav): 4.5 tham chiếu PERM.ordersConfirm = undefined → Gate fail-closed → nút
// Chốt không bao giờ render (bug 4.5, fix ở 4.6).
import { Gate, PERMISSION_KEYS } from '../../design-system/gating';
import { filterNav } from '../../design-system/gating/permissions';
import {
  DISCOUNT_CHO_DUYET,
  DISCOUNT_DONG_Y,
  DISCOUNT_TU_CHOI,
  ORDER_STATUS_CHODUYET,
  ORDER_STATUS_DACHOT,
} from '../../design-system/session/orders-port';
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
  OrderStockCheck,
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
  // Dialog xác nhận Mở lại (Story 4.6) + busy — nghịch đảo nút Chốt: hiện khi
  // 'dachot', thành công thì `editable` tự bật lại vì status về 'baogia'.
  const [moLaiDialogOpen, setMoLaiDialogOpen] = useState(false);
  const [moLaiBusy, setMoLaiBusy] = useState(false);
  // Dialog Áp chiết khấu (Story 4.7) + busy — cùng khuôn chotBusy; thành công
  // thì màn tự khoá sửa vì status sang 'choduyet'. Amount là số nguyên đồng
  // nhập tay (pattern freeUnitPrice — chuyển đổi input, không phải số học tiền).
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountBusy, setDiscountBusy] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountNote, setDiscountNote] = useState('');
  // Đang chờ exportQuote + share (Story 4.8) — cùng khuôn chotBusy; dùng chung
  // cho cả hai nút (Chia sẻ / Tải PDF) vì cùng một pipeline export phía sau.
  const [shareBusy, setShareBusy] = useState(false);

  // Preview là call THỨ HAI sau mỗi mutation và có thể về trễ/đè: mutation liên
  // tiếp không được cho tổng cũ đè tổng mới (pattern `latest` của CustomerListScreen).
  const latestTotals = useRef(0);
  // Backend stock warning of the current lines; null = not loaded / failed ⇒ no hints.
  const [stockCheck, setStockCheck] = useState<OrderStockCheck | null>(null);
  // Same ticket pattern: an answer for older lines never overwrites a newer one.
  const latestStock = useRef(0);

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

  /** Backend stock warning of the lines; a failed read only hides the hints. */
  async function refreshStockCheck(orderId: string) {
    const ticket = ++latestStock.current;
    try {
      const fresh = await ordersPort.getStockCheck(orderId);
      if (ticket === latestStock.current) setStockCheck(fresh);
    } catch {
      if (ticket === latestStock.current) setStockCheck(null);
    }
  }

  /**
   * MỘT đường code duy nhất cho tổng: echo các dòng backend vừa trả qua
   * `previewTotal` — KHÔNG phép tính nào trong màn (AD-16). Lỗi preview → totals
   * về "—" + message; KHÔNG xoá giỏ, KHÔNG chặn sửa dòng tiếp (bất biến k).
   */
  async function refreshTotals(fetched: Order) {
    // Every path that re-reads lines comes through here — the stock hint follows them.
    void refreshStockCheck(fetched.id);
    const ticket = ++latestTotals.current;
    // Chiết khấu HIỆU LỰC (Story 4.7): đơn đang chờ duyệt hoặc đã chốt với
    // approval cho_duyet/dong_y. Đơn 'baogia' KHÔNG echo — sau từ chối hoặc sau
    // mở-lại, bản đang sửa không mang chiết khấu (muốn giảm phải áp + duyệt lại).
    const discountActive =
      fetched.discount != null &&
      fetched.status !== 'baogia' &&
      (fetched.discount.status === DISCOUNT_CHO_DUYET ||
        fetched.discount.status === DISCOUNT_DONG_Y);
    try {
      const fresh = await ordersPort.previewTotal({
        lines: fetched.lineItems.map((l) => ({ unitPrice: l.unitPrice, qty: l.qty })),
        // Echo tick VAT của Đơn (Story 4.4) — như đã echo unitPrice; đơn cũ
        // vatMode null thì bỏ qua field (backend coi như có VAT).
        vatMode: fetched.vatMode ?? undefined,
        // Echo chiết khấu của Đơn (Story 4.7) — con số backend đã trả, không tự tính.
        discountAmount: discountActive ? fetched.discount!.amount : undefined,
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
              const created = await ordersPort.create({ customerPhone: picked.phone });
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
   * Sửa bảo hành theo dòng (Story 4.9): PATCH `warrantyMonths` (số tháng hoặc
   * `null` = bỏ bảo hành). Lỗi → Banner, GIỮ nguyên giỏ (bất biến k) — KHÔNG
   * refresh nên input hoàn về giá trị Đơn hiện tại. Không ảnh hưởng tiền.
   */
  async function handleWarrantyChange(lineId: string, warrantyMonths: number | null) {
    try {
      await ordersPort.updateLine(order!.id, lineId, { warrantyMonths });
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
    setKWpText(source.kWp == null ? '' : String(source.kWp));
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

  /**
   * Mở lại Đơn đã chốt (Story 4.6, FR-6): BACKEND sinh bản update mới (bản cũ
   * nằm nguyên trong lịch sử) và đưa status về 'baogia' — màn chỉ render Order
   * trả về (`editable` tự bật lại, nút Chốt hiện lại thế chỗ). KHÔNG toast.
   * Lỗi → Banner + giỏ + state cũ NGUYÊN VẸN (bất biến k).
   */
  async function handleReviseOrder() {
    setMoLaiDialogOpen(false);
    setMoLaiBusy(true);
    try {
      const revised = await ordersPort.reviseOrder(order!.id);
      setOrder(revised);
      syncMetaTexts(revised);
      setError(null);
      await refreshTotals(revised);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setMoLaiBusy(false);
    }
  }

  /**
   * Áp chiết khấu + gửi duyệt (Story 4.7, FR-18): BACKEND chuyển đơn sang
   * 'choduyet' và ghi hồ sơ duyệt — màn chỉ render Order trả về (`editable` tự
   * tắt, banner chờ duyệt hiện). KHÔNG toast. Lỗi → Banner + giỏ + state cũ
   * NGUYÊN VẸN (bất biến k).
   */
  async function handleApplyDiscount() {
    setDiscountDialogOpen(false);
    setDiscountBusy(true);
    // Reset lỗi field của lần gửi trước (khuôn handleFreeLineSubmit) — không
    // reset thì banner lỗi amount cũ hiện lại khi mở dialog ở lần áp sau.
    setFieldErrors({});
    try {
      const applied = await ordersPort.applyDiscount(order!.id, {
        amount: discountAmount,
        note: discountNote === '' ? undefined : discountNote,
      });
      setOrder(applied);
      setError(null);
      await refreshTotals(applied);
    } catch (err) {
      setError(messageOf(err));
      setFieldErrors(fieldErrorsOf(err));
    } finally {
      setDiscountBusy(false);
    }
  }

  /**
   * Chia sẻ báo giá (Story 4.8, FR-21): exportQuote qua port → dựng File ×2 →
   * native share [ảnh, pdf] — ảnh đứng TRƯỚC (UX-DR-21 ưu tiên ảnh; trình duyệt
   * không share file được thì shareFiles tự tải ảnh). KHÔNG dialog xác nhận —
   * share không đổi dữ liệu đơn (UX-DR-20 native share đi thẳng). Lỗi port →
   * Banner, GIỮ nguyên giỏ (bất biến k); user huỷ share sheet KHÔNG phải lỗi
   * (share.ts đã nuốt AbortError).
   */
  async function handleShareQuote() {
    setShareBusy(true);
    try {
      const files = await ordersPort.exportQuote(order!.id);
      const image = new File([files.image.bytes], files.image.fileName, {
        type: files.image.mimeType,
      });
      const pdf = new File([files.pdf.bytes], files.pdf.fileName, {
        type: files.pdf.mimeType,
      });
      await shareFiles({
        files: [image, pdf],
        title: files.image.fileName,
        fallbackDownload: true,
      });
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setShareBusy(false);
    }
  }

  /**
   * Tải PDF (web-only, Story 4.8): cùng pipeline export nhưng chỉ đưa PDF vào
   * share — desktop không share file được thì shareFiles tự tải PDF về.
   */
  async function handleDownloadPdf() {
    setShareBusy(true);
    try {
      const files = await ordersPort.exportQuote(order!.id);
      const pdf = new File([files.pdf.bytes], files.pdf.fileName, {
        type: files.pdf.mimeType,
      });
      await shareFiles({ files: [pdf], fallbackDownload: true });
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setShareBusy(false);
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
  // Wording picked from the backend's `status`; the numbers are its numbers.
  const stockLines = stockCheck?.lines ?? [];
  const shortStock = stockLines.filter((s) => s.status === 'short');
  const stockHintOf = (productId: string | null | undefined) => {
    const s = stockLines.find((x) => x.productId === productId);
    if (s === undefined) return undefined;
    return s.status === 'short'
      ? { label: `Cần nhập ${s.shortfall}`, short: true }
      : { label: `Kho còn ${s.available}`, short: false };
  };

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
              <div className="quote-customer-name">{customer?.name ?? order.customerPhone}</div>
              <div className="micro muted quote-mono">{order.customerPhone}</div>
            </div>
            <CustomerTypeChip>{typeLabel(order.custType)}</CustomerTypeChip>
          </div>
          {/* Cờ phạm vi (Story 4.3): chip CHỈ hiển thị (ScopeFlag là span tĩnh,
              màn sở hữu quyết định on/off); toggle qua 2 Checkbox riêng —
              "Thiết bị" luôn bật nên KHÔNG có control tắt. */}
          <div className="quote-scope-row">
            <div className="micro muted">Phạm vi</div>
            <div className="quote-scope-flags">
              <ScopeFlag on={order.scopeEquipment}>Thiết bị</ScopeFlag>
              <ScopeFlag on={order.scopeConstruction}>Thi công</ScopeFlag>
              <ScopeFlag on={order.scopeDelivery}>Vận chuyển</ScopeFlag>
            </div>
            <div className="quote-scope-toggles">
              <Checkbox
                label="Thi công"
                checked={order.scopeConstruction}
                disabled={!editable || scopeBusy}
                onChange={(checked) => void handleScopeToggle({ scopeConstruction: checked })}
              />
              <Checkbox
                label="Vận chuyển"
                checked={order.scopeDelivery}
                disabled={!editable || scopeBusy}
                onChange={(checked) => void handleScopeToggle({ scopeDelivery: checked })}
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

        {/* Banner trạng thái chiết khấu (Story 4.7): trong 'choduyet' màn
            read-only (editable tắt) — banner nói rõ đang chờ ai; sau từ chối
            đơn về 'baogia' sửa được, banner mang lý do từ backend. */}
        {order.status === ORDER_STATUS_CHODUYET &&
          order.discount?.status === DISCOUNT_CHO_DUYET && (
            <Banner tone="warn">
              {'Chờ duyệt chiết khấu — chiết khấu đang chờ người có quyền duyệt.'}
            </Banner>
          )}
        {order.status === ORDER_STATUS_CHODUYET &&
          order.discount?.status === DISCOUNT_DONG_Y && (
            <Banner tone="info">Chiết khấu đã được duyệt — có thể chốt đơn.</Banner>
          )}
        {editable && order.discount?.status === DISCOUNT_TU_CHOI && (
          <Banner tone="warn">
            {`Chiết khấu bị từ chối — ${order.discount.resolveNote ?? ''}`}
          </Banner>
        )}

        {shortStock.length > 0 && (
          <Banner tone="warn">
            {shortStock.map((s) => (
              <p className="quote-stock-line" key={s.productId}>
                {`${s.name} — Còn ${s.onHand} · Đã hứa ${s.reserved} · Cần nhập ${s.shortfall}. Vẫn chốt đơn được; chặn nằm ở khâu xuất kho.`}
              </p>
            ))}
          </Banner>
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
                  <th className="num">Bảo hành</th>
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
                    warrantyMonths={line.warrantyMonths}
                    // Install/labour catalogue line (productId set + priceEditable) → no
                    // warranty; free line without one yet → the "+ Thêm bảo hành" link;
                    // everything else → the input. Free lines carry priceEditable=true too,
                    // so the 'none' test MUST also require productId != null.
                    warrantyMode={
                      line.productId != null && line.priceEditable
                        ? 'none'
                        : line.productId == null && line.warrantyMonths == null
                          ? 'link'
                          : 'input'
                    }
                    warrantyEditable={editable}
                    onWarrantyChange={(months) => void handleWarrantyChange(line.id, months)}
                    flag={line.isFlexible ? FLAG_LINH_DONG : undefined}
                    stockHint={stockHintOf(line.productId)}
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

        {/* Khu tổng tiền: 3 số backend trả qua preview-total, hiển thị qua <Money>
            (cùng convention `amount` của CartLineRow). "—" = chưa có/preview lỗi.
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
            <dd className="num mono">{totals ? <Money value={totals.subtotal} /> : '—'}</dd>
            {/* Dòng chiết khấu (Story 4.7): CHỈ hiện khi có — số backend echo. */}
            {totals !== null && totals.discountAmount > 0 && (
              <>
                <dt>Chiết khấu</dt>
                <dd className="num mono">
                  <Money value={totals.discountAmount} />
                </dd>
              </>
            )}
            <dt>Tiền VAT</dt>
            <dd className="num mono">{totals ? <Money value={totals.vatAmount} /> : '—'}</dd>
            <dt>Tổng sau VAT</dt>
            <dd className="num mono strong">{totals ? <Money value={totals.total} /> : '—'}</dd>
          </dl>
        </Frame>

        {/* Chốt (Story 4.5) + Áp chiết khấu (Story 4.7): mỗi nút Gate quyền
            RIÊNG — thiếu quyền thì nút BIẾN MẤT (Gate, UX-DR-22), không
            disabled xám; backend vẫn enforce (AD-4). Bấm mở dialog nêu hệ quả. */}
        {editable && (
          <div className="quote-chot-row">
            <Gate perms={perms} requires={PERMISSION_KEYS.discountsApply}>
              <Button
                variant="ghost"
                type="button"
                disabled={discountBusy}
                onClick={() => setDiscountDialogOpen(true)}
              >
                Áp chiết khấu
              </Button>
            </Gate>
            <Gate perms={perms} requires={PERMISSION_KEYS.ordersConfirm}>
              <Button
                variant="primary"
                type="button"
                disabled={chotBusy}
                onClick={() => setChotDialogOpen(true)}
              >
                Chốt báo giá
              </Button>
            </Gate>
          </div>
        )}

        {/* Chốt SAU DUYỆT (Story 4.7): đơn 'choduyet' với chiết khấu đã đồng ý
            — nút Chốt hiện lại (spine ChoDuyet→DaChot "duyệt then Chốt"); vẫn
            quyền orders.confirm, vẫn dialog hệ quả. */}
        {order.status === ORDER_STATUS_CHODUYET &&
          order.discount?.status === DISCOUNT_DONG_Y && (
            <Gate perms={perms} requires={PERMISSION_KEYS.ordersConfirm}>
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

        {/* Mở lại (Story 4.6): nghịch đảo nút Chốt — hiện khi đơn đã chốt (so
            bằng HẰNG import từ port, không literal), quyền quotes.create_edit
            (người khởi động việc sửa chính là người sẽ sửa); thiếu quyền thì
            nút BIẾN MẤT (Gate, UX-DR-22); backend vẫn enforce (AD-4). */}
        {order.status === ORDER_STATUS_DACHOT && (
          <Gate perms={perms} requires={PERMISSION_KEYS.quotesCreateEdit}>
            <div className="quote-chot-row">
              <Button
                variant="primary"
                type="button"
                disabled={moLaiBusy}
                onClick={() => setMoLaiDialogOpen(true)}
              >
                Mở lại để sửa
              </Button>
            </div>
          </Gate>
        )}

        {/* Chia sẻ báo giá + Tải PDF (Story 4.8, FR-21): hiện MỌI trạng thái
            khi có ≥1 dòng (FR-21 "sau Chốt và khi cần" — báo giá nháp vẫn đưa
            khách xem; 0 dòng vô nghĩa, backend vẫn 400 làm hàng rào thật,
            AD-4). KHÔNG ConfirmDialog — share không phải hành động hệ quả
            tiền (UX-DR-20). Tải PDF là nút web-only. */}
        {order.lineItems.length > 0 && (
          <Gate perms={perms} requires={PERMISSION_KEYS.quotesCreateEdit}>
            <div className="quote-chot-row">
              <Button
                variant="ghost"
                type="button"
                disabled={shareBusy}
                onClick={handleShareQuote}
              >
                Chia sẻ báo giá
              </Button>
              <Button
                type="button"
                disabled={shareBusy}
                onClick={handleDownloadPdf}
              >
                Tải PDF
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
                    {product.sku} · {product.unit} · <Money value={product.price} />
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

      {/* Áp chiết khấu (Story 4.7): MỘT dialog duy nhất (không chồng 2 tầng
          overlay — UX-DR-20) gồm 2 Field + câu hệ quả + Gửi duyệt/Huỷ. Huỷ =
          đóng, KHÔNG gọi port — đơn ở nguyên baogia. */}
      <Dialog
        open={discountDialogOpen}
        title="Áp chiết khấu"
        onClose={() => setDiscountDialogOpen(false)}
        footer={
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setDiscountDialogOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={discountBusy}
              onClick={() => void handleApplyDiscount()}
            >
              Gửi duyệt
            </Button>
          </>
        }
      >
        <div className="quote-picker">
          <Field
            label="Mức chiết khấu (đ)"
            inputMode="numeric"
            value={discountAmount}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setDiscountAmount(n);
            }}
          />
          {fieldErrors.amount && <Banner tone="danger">{fieldErrors.amount}</Banner>}
          <Field
            label="Lý do đề xuất"
            value={discountNote}
            onChange={(e) => setDiscountNote(e.target.value)}
          />
          <p className="micro muted">
            {'Gửi duyệt sẽ chuyển đơn sang Chờ duyệt chiết khấu — đơn khoá sửa cho tới khi được duyệt hoặc bị từ chối.'}
          </p>
        </div>
      </Dialog>

      {/* Huỷ = đóng dialog, KHÔNG gọi port — đơn ở nguyên baogia. */}
      <ConfirmDialog
        open={chotDialogOpen}
        title="Chốt báo giá"
        consequence="Chốt sẽ đóng băng giá của mọi dòng theo danh mục hiện tại — sửa giá sau này cần tạo bản mới."
        onConfirm={() => void handleConfirmOrder()}
        onCancel={() => setChotDialogOpen(false)}
      />

      {/* Huỷ = đóng dialog, KHÔNG gọi port — đơn ở nguyên dachot. Tone mặc định
          (primary), KHÔNG destructive: không mất gì, bản cũ còn nguyên lịch sử. */}
      <ConfirmDialog
        open={moLaiDialogOpen}
        title="Mở lại để sửa"
        consequence="Mở lại sẽ tạo bản cập nhật mới — giá các dòng tính lại theo danh mục hiện tại cho tới khi chốt lại; bản đã chốt vẫn nằm trong lịch sử."
        onConfirm={() => void handleReviseOrder()}
        onCancel={() => setMoLaiDialogOpen(false)}
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
