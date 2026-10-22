// hand-authored — web inventory port (Story 6.2, mirror Flutter
// mobile/lib/design_system/session/inventory_port.dart). The seam between the
// Tồn kho screen and `GET /stock-items`.
//
// THE CLIENT COMPUTES NO STOCK NUMBER (AD-2). `available`, `toPurchase`,
// `stockStatus` and the whole `purchaseList` arrive computed by the backend's
// single implementation of "on hand minus promised". The screen only joins those
// numbers into a sentence and branches on `stockStatus`.
//
// Every data type below is the GENERATED contract type (AD-12).

import type { components, paths } from '../../api/generated/schema';

type Schemas = components['schemas'];

/**
 * The backend `StockItemViewDto`. No cost price, ever. `available` = `onHand −
 * reserved` and MAY BE NEGATIVE (the screen never shows it bare when it is);
 * `toPurchase` is 0 unless `stockStatus === 'am'`.
 */
export type StockItemView = Schemas['StockItemViewDto'];

/** `du` = still available · `het` = exactly 0 available · `am` = promised beyond stock. */
export type StockStatus = StockItemView['stockStatus'];

/** `PurchaseNeedViewDto` — one line of the purchase list. */
export type PurchaseNeedView = Schemas['PurchaseNeedViewDto'];

/** `StockListResponseDto`. */
export type StockList = Schemas['StockListResponseDto'];

/** `q` is the name/SKU search, sent as typed — the backend matches case-insensitively. */
export type StockListQuery = NonNullable<paths['/stock-items']['get']['parameters']['query']>;

/**
 * Injectable transport for the Tồn kho screen. READ-ONLY on purpose: stock
 * vouchers (the only thing allowed to move `onHand`) live in `StockVouchersPort`.
 * The real implementation is `web/src/api/http-inventory-port.ts`.
 */
export interface InventoryPort {
  listStock(query?: StockListQuery): Promise<StockList>;
}
