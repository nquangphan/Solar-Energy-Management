// hand-authored — Phân quyền account list state (Story 8.2), held by AccountListCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/accounts_port.dart';

enum AccountListStatus { loading, ready, error }

final class AccountListState extends Equatable {
  const AccountListState({
    this.status = AccountListStatus.loading,
    this.accounts = const <AccountPermissionSummary>[],
    this.errorMessage,
  });

  final AccountListStatus status;

  /// In the backend's order (by name); kept while a reload runs.
  final List<AccountPermissionSummary> accounts;

  /// The backend's sentence when the list could not be read (e.g. 403).
  final String? errorMessage;

  @override
  List<Object?> get props => [status, accounts, errorMessage];
}
