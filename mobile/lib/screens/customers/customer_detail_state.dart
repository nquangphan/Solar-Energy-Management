// hand-authored — Chi tiết khách state (Story 11.2), held by CustomerDetailCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/customers_port.dart';

enum CustomerDetailStatus { loading, ready, error }

/// One class rather than sealed phases: the topbar reads [customer] in EVERY phase,
/// so a Thử lại after a first load keeps showing that customer's name and type.
final class CustomerDetailState extends Equatable {
  const CustomerDetailState({
    this.status = CustomerDetailStatus.loading,
    this.customer,
    this.sources = const [],
  });

  final CustomerDetailStatus status;
  final Customer? customer;

  /// The source catalogue, so the fact list can name the customer's source.
  final List<CustomerSource> sources;

  CustomerDetailState withStatus(CustomerDetailStatus status) =>
      CustomerDetailState(status: status, customer: customer, sources: sources);

  @override
  List<Object?> get props => [status, customer, sources];
}
