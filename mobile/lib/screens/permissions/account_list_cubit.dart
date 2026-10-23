// hand-authored — Phân quyền account list (Story 8.2). Reads through the injected
// [AccountsPort]; the preset label and the read-only flag arrive computed (AD-2).

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/accounts_port.dart';
import 'account_list_state.dart';

const String kAccountListLoadError = 'Không tải được danh sách tài khoản.';

class AccountListCubit extends Cubit<AccountListState> {
  AccountListCubit(this._port) : super(const AccountListState());

  final AccountsPort _port;

  /// A reload after a save can overlap the first load; only the latest may paint.
  int _ticket = 0;

  Future<void> load() async {
    final int ticket = ++_ticket;
    emit(AccountListState(accounts: state.accounts));
    try {
      final List<AccountPermissionSummary> accounts = await _port
          .listAccounts();
      if (isClosed || ticket != _ticket) return;
      emit(
        AccountListState(status: AccountListStatus.ready, accounts: accounts),
      );
    } catch (e) {
      if (isClosed || ticket != _ticket) return;
      emit(
        AccountListState(
          status: AccountListStatus.error,
          accounts: state.accounts,
          errorMessage: e is AccountsPortException
              ? e.message
              : kAccountListLoadError,
        ),
      );
    }
  }
}
