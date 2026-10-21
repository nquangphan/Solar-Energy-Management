// hand-authored — web inventory port (Story 6.2, mirror Flutter
// mobile/lib/design_system/session/inventory_port.dart). The seam between the
// Tồn kho screen and `GET /stock-items`.
//
// THE CLIENT COMPUTES NO STOCK NUMBER (AD-2). `khaDung`, `canNhap`, `tinhTrang`
// and the whole `danhSachCanMua` arrive computed by the backend's single
// implementation of "on hand minus promised". The screen only joins those
// numbers into a sentence and branches on `tinhTrang`.

/** `du` = still available · `het` = exactly 0 available · `am` = promised beyond stock. */
export type TinhTrangTon = 'du' | 'het' | 'am';

/** Mirrors the backend `StockItemViewDto` field for field. No cost price, ever. */
export interface StockItemView {
  productId: string;
  ten: string;
  sku: string;
  donVi: string;
  onHand: number;
  reserved: number;
  /** `onHand − reserved` — MAY BE NEGATIVE; the screen never shows it bare when it is. */
  khaDung: number;
  /** What must be bought in; 0 unless `tinhTrang === 'am'`. */
  canNhap: number;
  tinhTrang: TinhTrangTon;
}

/** Mirrors `CanMuaViewDto` — one line of the purchase list. */
export interface CanMuaView {
  productId: string;
  ten: string;
  donVi: string;
  canNhap: number;
}

/** Mirrors `StockListResponseDto`. */
export interface StockList {
  items: StockItemView[];
  danhSachCanMua: CanMuaView[];
}

export interface StockListQuery {
  /** Name/SKU search, sent as typed — the backend matches case-insensitively. */
  q?: string;
}

/**
 * Injectable transport for the Tồn kho screen. READ-ONLY on purpose: stock
 * vouchers (the only thing allowed to move `onHand`) are a later story, and a
 * port method the backend cannot serve is a button the UI would have to fake.
 */
export interface InventoryPort {
  listStock(query?: StockListQuery): Promise<StockList>;
}
