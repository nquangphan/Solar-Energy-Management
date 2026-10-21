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
    this.orderId,
    required this.createdAt,
    required this.nguoiTao,
    required this.soDong,
    required this.tongSoLuong,
    this.returnOfVoucherId,
  });

  final String id;

  /// Display code, e.g. `PK-N-0119` — built by the backend.
  final String ma;

  /// `nhap` = stock in · `xuat` = stock out (free-standing, or bound to an
  /// order via [orderId]).
  final String type;

  /// The order this stock-out belongs to (one order, one stock-out).
  /// NULL on a free-standing voucher (field absent).
  final String? orderId;

  /// ISO-8601 UTC.
  final String createdAt;
  final StockVoucherCreator nguoiTao;
  final int soDong;

  /// Sum of line quantities — always positive; the direction comes from [type].
  final int tongSoLuong;

  /// Set only on a return voucher (`Nhập trả`): the stock-out it returns.
  final String? returnOfVoucherId;
}

/// Mirrors `returnOf` on `StockVoucherDetailDto` (return voucher only).
class StockVoucherReturnOf {
  const StockVoucherReturnOf({
    required this.id,
    required this.ma,
    required this.orderId,
  });

  final String id;
  final String ma;
  final String orderId;
}

/// Mirrors `returnVoucher` on `StockVoucherDetailDto` (a stock-out that has one).
class StockVoucherReturnRef {
  const StockVoucherReturnRef({required this.id, required this.ma});

  final String id;
  final String ma;
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
    super.orderId,
    required super.createdAt,
    required super.nguoiTao,
    required super.soDong,
    required super.tongSoLuong,
    super.returnOfVoucherId,
    required this.note,
    required this.lines,
    this.returnOf,
    this.returnVoucher,
    this.canReturn = false,
  });

  final String? note;
  final List<StockVoucherLine> lines;

  /// Return voucher only: the stock-out it returns and that stock-out's order.
  final StockVoucherReturnOf? returnOf;

  /// Order-bound stock-out that already has a return voucher.
  final StockVoucherReturnRef? returnVoucher;

  /// Decided by the backend; the client never derives it.
  final bool canReturn;
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

/// One line of `CreateReturnVoucherRequestDto`.
class CreateReturnVoucherLineInput {
  const CreateReturnVoucherLineInput({
    required this.productId,
    required this.qty,
  });

  final String productId;
  final int qty;
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
  /// [type] = `nhap` | `xuat`; null ⇒ every type. [isReturn] filters return
  /// vouchers in (true) or out (false); null ⇒ no filter.
  Future<StockVoucherList> listVouchers({String? type, bool? isReturn});

  Future<StockVoucherDetail> getVoucher(String id);

  /// Throws [StockVoucherPortException] on 400 / 404 / 409.
  Future<StockVoucherDetail> createVoucher(CreateStockVoucherInput input);

  /// `POST /stock-vouchers/:originVoucherId/return`. Throws
  /// [StockVoucherPortException] whose `fieldErrors` index (`lines.{i}.…`) is the
  /// position in the SUBMITTED [lines].
  Future<StockVoucherDetail> createReturnVoucher(
    String originVoucherId, {
    String? note,
    required List<CreateReturnVoucherLineInput> lines,
  });
}
