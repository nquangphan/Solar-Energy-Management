// hand-authored — Phiếu kho state (Story 11.4), held by StockVouchersCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/stock_vouchers_port.dart';

/// The list tabs; each maps to one backend filter (the client filters nothing).
const String kVoucherTabAll = 'all';
const String kVoucherTabStockIn = 'nhap';
const String kVoucherTabStockOut = 'xuat';
const String kVoucherTabReturn = 'nhaptra';

enum StockVouchersStatus { loading, ready, error }

/// One class for every phase: loading keeps the rows, the tab and the opened
/// voucher on screen, so the data outlives the phase.
final class StockVouchersState extends Equatable {
  const StockVouchersState({
    this.status = StockVouchersStatus.loading,
    this.items = const [],
    this.tab = kVoucherTabAll,
    this.selectedId,
    this.detailStatus = StockVouchersStatus.loading,
    this.detail,
  });

  final StockVouchersStatus status;

  /// Recent vouchers of [tab], as the backend filtered them.
  final List<StockVoucherSummary> items;

  /// One of the `kVoucherTab*` keys.
  final String tab;

  /// The voucher whose detail is open; null = none opened yet.
  final String? selectedId;
  final StockVouchersStatus detailStatus;

  /// The last detail that arrived — kept behind the skeleton of the next one.
  final StockVoucherDetail? detail;

  StockVouchersState copyWith({
    StockVouchersStatus? status,
    List<StockVoucherSummary>? items,
    String? tab,
    String? selectedId,
    StockVouchersStatus? detailStatus,
    StockVoucherDetail? detail,
  }) =>
      StockVouchersState(
        status: status ?? this.status,
        items: items ?? this.items,
        tab: tab ?? this.tab,
        selectedId: selectedId ?? this.selectedId,
        detailStatus: detailStatus ?? this.detailStatus,
        detail: detail ?? this.detail,
      );

  @override
  List<Object?> get props => [status, items, tab, selectedId, detailStatus, detail];
}
