// hand-authored — Flutter app-screen (Story 8.2, mockup all-screens.html
// #s-permissions; twin of the web PermissionsScreen's left column). Menu →
// Phân quyền: every account with its preset label ("Tuỳ chỉnh" when none
// matches) and "Đã vô hiệu" for a disabled one. Tapping a row opens its
// permission matrix; the list reads again when that screen closes.
//
// AccountListCubit reads through the injected [AccountsPort]; the screen only
// renders its state and forwards taps.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/accounts_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'account_list_cubit.dart';
import 'account_list_state.dart';

/// Label of an account whose set matches no preset.
const String kCustomPresetLabel = 'Tuỳ chỉnh';

/// Phân quyền is reached from Menu, the fifth bottom-nav tab.
const int kPermissionsTabIndex = 4;

class AccountListScreen extends StatefulWidget {
  const AccountListScreen({super.key, required this.port, this.onOpen});

  final AccountsPort port;

  /// Opens one account's matrix; the list reads again when it completes.
  final Future<void> Function(String id)? onOpen;

  @override
  State<AccountListScreen> createState() => _AccountListScreenState();
}

class _AccountListScreenState extends State<AccountListScreen> {
  // A field, not BlocProvider(create:): the reload runs after an `await`.
  late final AccountListCubit _cubit = AccountListCubit(widget.port)..load();

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  Future<void> _open(String id) async {
    await widget.onOpen?.call(id);
    if (mounted) _cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<AccountListCubit, AccountListState>(builder: _view),
    );
  }

  Widget _view(BuildContext context, AccountListState state) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(
          eyebrow: 'QUẢN TRỊ',
          title: 'Phân quyền & tài khoản',
        ),
        bottomNav: const AppBottomNav(activeIndex: kPermissionsTabIndex),
        body: _body(state),
      ),
    );
  }

  Widget _body(AccountListState state) {
    switch (state.status) {
      case AccountListStatus.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 160.0),
          ],
        );
      case AccountListStatus.error:
        return AppErrorState(
          message: state.errorMessage ?? kAccountListLoadError,
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case AccountListStatus.ready:
        if (state.accounts.isEmpty) {
          return const AppEmptyState(
            title: 'Chưa có tài khoản nào',
            message: 'Danh sách tài khoản đang trống.',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final AccountPermissionSummary account in state.accounts) ...[
              _row(account),
              const SizedBox(height: AppTokens.space8),
            ],
          ],
        );
    }
  }

  Widget _row(AccountPermissionSummary account) {
    const TextStyle muted = TextStyle(
      color: AppTokens.muted,
      fontFamily: AppTokens.fontFamily,
      fontSize: 12.0,
      fontWeight: FontWeight.w600,
    );
    return GestureDetector(
      key: ValueKey<String>('account-${account.id}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(account.id),
      child: AppCard(
        padding: const EdgeInsets.all(AppTokens.space12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              account.displayName,
              style: const TextStyle(
                color: AppTokens.ink,
                fontFamily: AppTokens.fontFamily,
                fontSize: 14.0,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppTokens.space4),
            if (account.phone != null)
              Text(
                account.phone!,
                style: muted.copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            Text(
              account.matchingPresetLabel ?? kCustomPresetLabel,
              style: muted,
            ),
            if (!account.isActive) const Text('Đã vô hiệu', style: muted),
          ],
        ),
      ),
    );
  }
}
