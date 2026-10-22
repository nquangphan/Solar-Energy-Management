// hand-authored — mobile stock-vouchers port (Story 6.3, mirror web
// web/src/design-system/session/stock-vouchers-port.ts). The seam between the
// Phiếu kho screen and `/stock-vouchers`.
//
// A SEPARATE port from `InventoryPort` on purpose: the Tồn kho screen is read-only
// and its port carries no write verb. Vouchers are the one thing that moves
// `onHand`, so the write lives here.
//
// THE CLIENT COMPUTES NOTHING (AD-2). The voucher `code`, `lineCount`,
// `totalQty`, the weighted-average cost and the "not enough stock" decision are
// all the backend's. `unitCost` is ABSENT (null here) when the caller lacks
// `costs.view` — the screen shows a cost only when the field is there.

import '../../api/generated/models/create_stock_voucher_request_dto.dart';
import '../../api/generated/models/return_voucher_line_request_dto.dart';
import '../../api/generated/models/stock_voucher_creator_dto.dart';
import '../../api/generated/models/stock_voucher_detail_dto.dart';
import '../../api/generated/models/stock_voucher_line_request_dto.dart';
import '../../api/generated/models/stock_voucher_line_response_dto.dart';
import '../../api/generated/models/stock_voucher_list_response_dto.dart';
import '../../api/generated/models/stock_voucher_return_of_dto.dart';
import '../../api/generated/models/stock_voucher_return_ref_dto.dart';
import '../../api/generated/models/stock_voucher_summary_dto.dart';

export '../../api/generated/models/create_stock_voucher_request_dto_type.dart';
export '../../api/generated/models/stock_voucher_detail_dto_type.dart';
export '../../api/generated/models/stock_voucher_summary_dto_type.dart';

/// `StockVoucherCreatorDto` (generated, Story 10.8).
typedef StockVoucherCreator = StockVoucherCreatorDto;

/// `StockVoucherSummaryDto`. `code` is the display code (`PK-N-0119`) built by
/// the backend; `type` is `nhap` | `xuat`; `orderId` is null on a free-standing
/// voucher; `totalQty` is always positive (the direction comes from `type`);
/// `returnOfVoucherId` is set only on a return voucher.
typedef StockVoucherSummary = StockVoucherSummaryDto;

/// `returnOf` on `StockVoucherDetailDto` (return voucher only).
typedef StockVoucherReturnOf = StockVoucherReturnOfDto;

/// `returnVoucher` on `StockVoucherDetailDto` (a stock-out that has one).
typedef StockVoucherReturnRef = StockVoucherReturnRefDto;

/// `StockVoucherLineResponseDto`. `qty` is always positive; `unitCost` is NULL
/// when the caller lacks `costs.view`.
typedef StockVoucherLine = StockVoucherLineResponseDto;

/// `StockVoucherDetailDto` — the summary fields plus `note`, `lines`,
/// `returnOf`, `returnVoucher` and `canReturn` (decided by the backend). Not a
/// subtype of [StockVoucherSummary]: code that renders either reads the shared
/// fields at the point of use.
typedef StockVoucherDetail = StockVoucherDetailDto;

/// `StockVoucherListResponseDto`.
typedef StockVoucherList = StockVoucherListResponseDto;

/// One line of `CreateStockVoucherRequestDto` — `unitCost` REQUIRED on `nhap`,
/// omitted on `xuat` (the server snapshots it).
typedef CreateStockVoucherLineInput = StockVoucherLineRequestDto;

/// `CreateStockVoucherRequestDto`.
typedef CreateStockVoucherInput = CreateStockVoucherRequestDto;

/// One line of `CreateReturnVoucherRequestDto`.
typedef CreateReturnVoucherLineInput = ReturnVoucherLineRequestDto;

/// One `fieldErrors[]` entry. [field] is the backend's path, e.g. `lines.0.qty`.
/// Hand-kept: the payload of [StockVoucherPortException], not a response type.
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
/// The real implementation is `HttpStockVouchersPort`, which turns the AD-5
/// envelope into a [StockVoucherPortException].
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
