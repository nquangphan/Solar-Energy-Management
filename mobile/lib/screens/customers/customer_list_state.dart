// hand-authored — Danh sách khách state (Story 11.2), held by CustomerListCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/customers_port.dart';

/// The "Tất cả" filter: no `custType` goes to the backend.
const String kAllCustTypes = 'ALL';

enum CustomerListStatus { loading, ready, error }

final class CustomerListState extends Equatable {
  const CustomerListState({
    this.status = CustomerListStatus.loading,
    this.items = const [],
    this.page = 1,
    this.total = 0,
    this.pageSize = 20,
    this.custType = kAllCustTypes,
    this.searching = false,
  });

  final CustomerListStatus status;

  // The backend owns the count and the slicing (AD-1): the state holds only the
  // page that was asked for and the total it was told, and never counts rows itself.
  final List<Customer> items;
  final int page;
  final int total;
  final int pageSize;

  /// The selected type filter — [kAllCustTypes], `kCaNhan` or `kThuongMai`.
  final String custType;

  /// A keyword or a type filter is applied: an empty answer means "no match",
  /// not "no customers yet".
  final bool searching;

  @override
  List<Object?> get props => [status, items, page, total, pageSize, custType, searching];
}
