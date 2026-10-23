// hand-authored — Tạo báo giá state (Story 11.3), held by CreateQuoteCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/customers_port.dart';
import '../../design_system/session/orders_port.dart';

/// "Leave this field as it is" for the nullable fields of [CreateQuoteState.copyWith].
const Object _keep = Object();

final class CreateQuoteState extends Equatable {
  const CreateQuoteState({
    this.order,
    this.customer,
    this.totals,
    this.stockCheck,
    this.error,
    this.fieldErrors = const {},
    this.scopeBusy = false,
    this.metaBusy = false,
    this.confirmBusy = false,
    this.reviseBusy = false,
    this.discountBusy = false,
    this.shareBusy = false,
    this.metaSyncSeq = 0,
    this.metaSyncFrom,
  });

  /// null ⇒ step 1 (pick a customer). Once set it is never cleared: a failure
  /// never wipes entered lines (EXPERIENCE Flow 1).
  final Order? order;
  final Customer? customer;

  /// The backend's preview of the displayed lines (AD-16); null ⇒ "—" (not yet, or failed).
  final OrderTotals? totals;

  /// The backend's stock warning of the lines; null ⇒ no hints (not loaded, or failed).
  final OrderStockCheck? stockCheck;

  /// The backend's message (AD-5), or the transport fallback.
  final String? error;

  /// Backend field errors (and the kWp parse error), each pinned under its input.
  final Map<String, String> fieldErrors;

  final bool scopeBusy;
  final bool metaBusy;
  final bool confirmBusy;
  final bool reviseBusy;
  final bool discountBusy;
  final bool shareBusy;

  /// Bumped each time the two metadata inputs (kWp, validity) must be rewritten
  /// from [metaSyncFrom] — after create, after an accepted or a refused metadata
  /// PATCH (the refused one rewrites them from the OLD order) and after reopening.
  final int metaSyncSeq;
  final Order? metaSyncFrom;

  CreateQuoteState copyWith({
    Object? order = _keep,
    Object? customer = _keep,
    Object? totals = _keep,
    Object? stockCheck = _keep,
    Object? error = _keep,
    Map<String, String>? fieldErrors,
    bool? scopeBusy,
    bool? metaBusy,
    bool? confirmBusy,
    bool? reviseBusy,
    bool? discountBusy,
    bool? shareBusy,
    int? metaSyncSeq,
    Object? metaSyncFrom = _keep,
  }) =>
      CreateQuoteState(
        order: identical(order, _keep) ? this.order : order as Order?,
        customer: identical(customer, _keep) ? this.customer : customer as Customer?,
        totals: identical(totals, _keep) ? this.totals : totals as OrderTotals?,
        stockCheck: identical(stockCheck, _keep) ? this.stockCheck : stockCheck as OrderStockCheck?,
        error: identical(error, _keep) ? this.error : error as String?,
        fieldErrors: fieldErrors ?? this.fieldErrors,
        scopeBusy: scopeBusy ?? this.scopeBusy,
        metaBusy: metaBusy ?? this.metaBusy,
        confirmBusy: confirmBusy ?? this.confirmBusy,
        reviseBusy: reviseBusy ?? this.reviseBusy,
        discountBusy: discountBusy ?? this.discountBusy,
        shareBusy: shareBusy ?? this.shareBusy,
        metaSyncSeq: metaSyncSeq ?? this.metaSyncSeq,
        metaSyncFrom: identical(metaSyncFrom, _keep) ? this.metaSyncFrom : metaSyncFrom as Order?,
      );

  @override
  List<Object?> get props => [
        order,
        customer,
        totals,
        stockCheck,
        error,
        fieldErrors,
        scopeBusy,
        metaBusy,
        confirmBusy,
        reviseBusy,
        discountBusy,
        shareBusy,
        metaSyncSeq,
        metaSyncFrom,
      ];
}
