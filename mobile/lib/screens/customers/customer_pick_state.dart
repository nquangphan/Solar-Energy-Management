// hand-authored — Tra SĐT chọn/tạo khách state (Story 11.2), held by CustomerPickCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/customers_port.dart';

/// Every emit builds the whole state, so a message is cleared by leaving it out.
final class CustomerPickState extends Equatable {
  const CustomerPickState({
    this.sources = const [],
    this.result,
    this.error,
    this.fieldErrors = const {},
    this.creating = false,
  });

  /// The source catalogue — empty when it failed to load (no message for that).
  final List<CustomerSource> sources;

  /// The last lookup answer: a match (`found`) or a miss that offers creation.
  final CustomerLookup? result;

  /// The backend's message (AD-5), shown in the danger AppBanner.
  final String? error;

  /// Backend field errors, each pinned under the input it names.
  final Map<String, String> fieldErrors;

  /// The create form is open.
  final bool creating;

  @override
  List<Object?> get props => [sources, result, error, fieldErrors, creating];
}
