// hand-authored — mobile inventory port (Story 6.2, mirror web
// web/src/design-system/session/inventory-port.ts). The seam between the
// Tồn kho screen and `GET /stock-items`.
//
// THE CLIENT COMPUTES NO STOCK NUMBER (AD-2). `available`, `toPurchase`,
// `stockStatus` and the whole `purchaseList` arrive computed by the backend's
// single implementation of "on hand minus promised". The screen only joins those
// numbers into a sentence and branches on `stockStatus`.

import '../../api/generated/models/purchase_need_view_dto.dart';
import '../../api/generated/models/stock_item_view_dto.dart';
import '../../api/generated/models/stock_list_response_dto.dart';

export '../../api/generated/models/stock_item_view_dto_stock_status.dart';

/// The backend `StockItemViewDto` (generated, Story 10.8). No cost price, ever.
/// `available` = `onHand − reserved` — MAY BE NEGATIVE, the screen never shows
/// it bare when it is; `toPurchase` is 0 unless `stockStatus` is `am`;
/// `stockStatus` is `du` (still available) | `het` (exactly 0) | `am` (promised
/// beyond stock).
typedef StockItemView = StockItemViewDto;

/// `PurchaseNeedViewDto` — one line of the purchase list.
typedef PurchaseNeedView = PurchaseNeedViewDto;

/// `StockListResponseDto`.
typedef StockList = StockListResponseDto;

/// Injectable transport for the Tồn kho screen. READ-ONLY on purpose: stock
/// vouchers (the only thing allowed to move `onHand`) are a later story, and a
/// port method the backend cannot serve is a button the UI would have to fake.
abstract class InventoryPort {
  /// [q] = name/SKU search, sent as typed — the backend matches case-insensitively.
  Future<StockList> listStock({String? q});
}
