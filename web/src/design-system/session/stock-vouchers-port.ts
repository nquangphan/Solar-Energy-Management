// hand-authored — web stock-vouchers port (Story 6.3, mirror Flutter
// mobile/lib/design_system/session/stock_vouchers_port.dart). The seam between
// the Phiếu kho screen and `/stock-vouchers`.
//
// A SEPARATE port from `InventoryPort` on purpose: the Tồn kho screen is read-only
// and its port carries no write verb. Vouchers are the one thing that moves
// `onHand`, so the write lives here.
//
// THE CLIENT COMPUTES NOTHING (AD-2). The voucher code (`ma`), `soDong`,
// `tongSoLuong`, the weighted-average cost and the "not enough stock" decision are
// all the backend's. `unitCost` is ABSENT (not 0, not null) when the caller lacks
// `costs.view` — the screen renders a cost column only when the field is there.

/** `nhap` = stock in · `xuat` = stock out (free-standing, or bound to an order via `orderId`). */
export type LoaiPhieu = 'nhap' | 'xuat';

/** Mirrors `StockVoucherCreatorDto`. */
export interface StockVoucherCreator {
  id: string;
  displayName: string;
}

/** Mirrors `StockVoucherSummaryDto` field for field. */
export interface StockVoucherSummary {
  id: string;
  /** Display code, e.g. `PK-N-0119` — built by the backend. */
  ma: string;
  type: LoaiPhieu;
  /**
   * The order this stock-out belongs to (one order, one stock-out).
   * ABSENT on a free-standing voucher, not null.
   */
  orderId?: string;
  /** ISO-8601 UTC. */
  createdAt: string;
  nguoiTao: StockVoucherCreator;
  soDong: number;
  /** Sum of line quantities — always positive; the direction comes from `type`. */
  tongSoLuong: number;
}

/** Mirrors `StockVoucherLineResponseDto`. */
export interface StockVoucherLine {
  productId: string;
  ten: string;
  sku: string;
  donVi: string;
  /** Always positive; the direction comes from the voucher `type`. */
  qty: number;
  /** Unit cost in đồng. ABSENT when the caller lacks `costs.view`. */
  unitCost?: number;
}

/** Mirrors `StockVoucherDetailDto`. */
export interface StockVoucherDetail extends StockVoucherSummary {
  note: string | null;
  lines: StockVoucherLine[];
}

/** Mirrors `StockVoucherListResponseDto`. */
export interface StockVoucherList {
  items: StockVoucherSummary[];
}

export interface StockVoucherListQuery {
  type?: LoaiPhieu;
}

/** One line of `CreateStockVoucherRequestDto`. */
export interface CreateStockVoucherLineInput {
  productId: string;
  qty: number;
  /** REQUIRED on `nhap`; must be OMITTED on `xuat` (the server snapshots it). */
  unitCost?: number;
}

/** Mirrors `CreateStockVoucherRequestDto`. */
export interface CreateStockVoucherInput {
  type: LoaiPhieu;
  note?: string;
  lines: CreateStockVoucherLineInput[];
}

/**
 * The AD-5 error envelope this port rejects with (400 validation, 404 unknown
 * product, 409 not enough stock / product not stockable). `field` is the
 * backend's path, e.g. `lines.0.qty`. The screen renders `message` verbatim.
 */
export interface StockVoucherPortError {
  message: string;
  fieldErrors?: { field: string; code: string; message: string }[];
}

/**
 * Injectable transport for the Phiếu kho screen. A PORT, NOT an HTTP client.
 *
 * TODO(app-runtime/login-network): the real implementation attaches the bearer
 * token and parses the AD-5 envelope into `StockVoucherPortError`.
 */
export interface StockVouchersPort {
  listVouchers(query?: StockVoucherListQuery): Promise<StockVoucherList>;
  getVoucher(id: string): Promise<StockVoucherDetail>;
  /** Rejects with `StockVoucherPortError` on 400 / 404 / 409. */
  createVoucher(input: CreateStockVoucherInput): Promise<StockVoucherDetail>;
}
