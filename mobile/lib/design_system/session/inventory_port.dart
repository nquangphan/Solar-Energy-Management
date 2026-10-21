// hand-authored — mobile inventory port (Story 6.2, mirror web
// web/src/design-system/session/inventory-port.ts). The seam between the
// Tồn kho screen and `GET /stock-items`.
//
// THE CLIENT COMPUTES NO STOCK NUMBER (AD-2). `khaDung`, `canNhap`, `tinhTrang`
// and the whole `danhSachCanMua` arrive computed by the backend's single
// implementation of "on hand minus promised". The screen only joins those
// numbers into a sentence and branches on `tinhTrang`.

/// Mirrors the backend `StockItemViewDto` field for field. No cost price, ever.
class StockItemView {
  const StockItemView({
    required this.productId,
    required this.ten,
    required this.sku,
    required this.donVi,
    required this.onHand,
    required this.reserved,
    required this.khaDung,
    required this.canNhap,
    required this.tinhTrang,
  });

  final String productId;
  final String ten;
  final String sku;
  final String donVi;
  final int onHand;
  final int reserved;

  /// `onHand − reserved` — MAY BE NEGATIVE; the screen never shows it bare when it is.
  final int khaDung;

  /// What must be bought in; 0 unless [tinhTrang] is `am`.
  final int canNhap;

  /// One of `du` (still available) | `het` (exactly 0) | `am` (promised beyond stock).
  final String tinhTrang;
}

/// Mirrors `CanMuaViewDto` — one line of the purchase list.
class CanMuaView {
  const CanMuaView({
    required this.productId,
    required this.ten,
    required this.donVi,
    required this.canNhap,
  });

  final String productId;
  final String ten;
  final String donVi;
  final int canNhap;
}

/// Mirrors `StockListResponseDto`.
class StockList {
  const StockList({required this.items, required this.danhSachCanMua});

  final List<StockItemView> items;
  final List<CanMuaView> danhSachCanMua;
}

/// Injectable transport for the Tồn kho screen. READ-ONLY on purpose: stock
/// vouchers (the only thing allowed to move `onHand`) are a later story, and a
/// port method the backend cannot serve is a button the UI would have to fake.
abstract class InventoryPort {
  /// [q] = name/SKU search, sent as typed — the backend matches case-insensitively.
  Future<StockList> listStock({String? q});
}
