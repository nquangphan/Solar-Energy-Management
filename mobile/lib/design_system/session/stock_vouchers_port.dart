// hand-authored — mobile stock-vouchers port (Story 6.3, mirror web
// web/src/design-system/session/stock-vouchers-port.ts). The seam between the
// Phiếu kho screen and `/stock-vouchers`.
//
// A SEPARATE port from `InventoryPort` on purpose: the Tồn kho screen is read-only
// and its port carries no write verb. Vouchers are the one thing that moves
// `onHand`, so the write lives here.
//
// THE CLIENT COMPUTES NOTHING (AD-2). The voucher code (`ma`), `soDong`,
// `tongSoLuong`, the weighted-average cost and the "not enough stock" decision are
// all the backend's. `unitCost` is ABSENT (null here) when the caller lacks
// `costs.view` — the screen shows a cost only when the field is there.

/// Mirrors `StockVoucherCreatorDto`.
class StockVoucherCreator {
  const StockVoucherCreator({required this.id, required this.displayName});

  final String id;
  final String displayName;
}

/// Mirrors `StockVoucherSummaryDto` field for field.
class StockVoucherSummary {
  const StockVoucherSummary({
    required this.id,
    required this.ma,
    required this.type,
    required this.createdAt,
    required this.nguoiTao,
    required this.soDong,
    required this.tongSoLuong,
  });

  final String id;

  /// Display code, e.g. `PK-N-0119` — built by the backend.
  final String ma;

  /// `nhap` = stock in · `xuat` = stock out with no order attached.
  final String type;

  /// ISO-8601 UTC.
  final String createdAt;
  final StockVoucherCreator nguoiTao;
  final int soDong;

  /// Sum of line quantities — always positive; the direction comes from [type].
  final int tongSoLuong;
}

/// Mirrors `StockVoucherLineResponseDto`.
class StockVoucherLine {
  const StockVoucherLine({
    required this.productId,
    required this.ten,
    required this.sku,
    required this.donVi,
    required this.qty,
    this.unitCost,
  });

  final String productId;
  final String ten;
  final String sku;
  final String donVi;

  /// Always positive; the direction comes from the voucher type.
  final int qty;

  /// Unit cost in đồng. NULL when the caller lacks `costs.view` (field absent).
  final int? unitCost;
}

/// Mirrors `StockVoucherDetailDto`.
class StockVoucherDetail extends StockVoucherSummary {
  const StockVoucherDetail({
    required super.id,
    required super.ma,
    required super.type,
    required super.createdAt,
    required super.nguoiTao,
    required super.soDong,
    required super.tongSoLuong,
    required this.note,
    required this.lines,
  });

  final String? note;
  final List<StockVoucherLine> lines;
}

/// Mirrors `StockVoucherListResponseDto`.
class StockVoucherList {
  const StockVoucherList({required this.items});

  final List<StockVoucherSummary> items;
}

/// One line of `CreateStockVoucherRequestDto`.
class CreateStockVoucherLineInput {
  const CreateStockVoucherLineInput({
    required this.productId,
    required this.qty,
    this.unitCost,
  });

  final String productId;
  final int qty;

  /// REQUIRED on `nhap`; must be NULL (omitted) on `xuat` — the server snapshots it.
  final int? unitCost;
}

/// Mirrors `CreateStockVoucherRequestDto`.
class CreateStockVoucherInput {
  const CreateStockVoucherInput({
    required this.type,
    this.note,
    required this.lines,
  });

  final String type;
  final String? note;
  final List<CreateStockVoucherLineInput> lines;
}

/// One `fieldErrors[]` entry. [field] is the backend's path, e.g. `lines.0.qty`.
class StockVoucherFieldError {
  const StockVoucherFieldError({
    required this.field,
    required this.code,
    required this.message,
  });

  final String field;
  final String code;
  final String message;
}

/// The AD-5 error envelope a [StockVouchersPort] throws (400 validation, 404
/// unknown product, 409 not enough stock / product not stockable). The screen
/// renders [message] verbatim.
class StockVoucherPortException implements Exception {
  const StockVoucherPortException(
    this.message, {
    this.fieldErrors = const <StockVoucherFieldError>[],
  });

  final String message;
  final List<StockVoucherFieldError> fieldErrors;

  @override
  String toString() => 'StockVoucherPortException: $message';
}

/// Injectable transport for the Phiếu kho screen. A PORT, NOT an HTTP client.
///
/// TODO(app-runtime/login-network): the real implementation attaches the bearer
/// token and parses the AD-5 envelope into [StockVoucherPortException].
abstract class StockVouchersPort {
  /// [type] = `nhap` | `xuat`; null ⇒ every type.
  Future<StockVoucherList> listVouchers({String? type});

  Future<StockVoucherDetail> getVoucher(String id);

  /// Throws [StockVoucherPortException] on 400 / 404 / 409.
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input);
}
