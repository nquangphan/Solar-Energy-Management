// hand-authored — Flutter app-screen (Story 8.2, mockup all-screens.html
// #s-permissions phone; twin of the web PermissionsScreen's right card). One
// account's permission checklist: "Áp preset role" loads a preset into the
// draft only, ticks change the draft, Lưu sends the whole set.
//
// Who may grant what (`grantable`), whether this account may be edited
// (`editable`, `readOnlyReason`) and the presets offered all come from the
// backend (AD-2); the dependency banner displays the `requires` data it sends,
// and Lưu stays disabled while a gap is left — the backend refuses it too.
//
// "Sửa account" opens the account form (Story 8.3) for an editable account; the
// matrix reads again, without a skeleton, when it closes.
//
// AccountPermissionsCubit reads and saves through the injected [AccountsPort];
// the screen only renders its state and forwards taps.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/accounts_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'account_list_screen.dart';
import 'account_permissions_cubit.dart';
import 'account_permissions_state.dart';

class AccountPermissionsScreen extends StatefulWidget {
  const AccountPermissionsScreen({
    super.key,
    required this.port,
    required this.accountId,
    this.onBack,
    this.onEdit,
  });

  final AccountsPort port;
  final String accountId;
  final VoidCallback? onBack;

  /// Opens the account form; the matrix reads again when it completes.
  final Future<void> Function()? onEdit;

  @override
  State<AccountPermissionsScreen> createState() =>
      _AccountPermissionsScreenState();
}

class _AccountPermissionsScreenState extends State<AccountPermissionsScreen> {
  // A field: the preset sheet (an overlay) applies its choice to it.
  late final AccountPermissionsCubit _cubit = AccountPermissionsCubit(
    widget.port,
    widget.accountId,
  )..load();

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  Future<void> _edit() async {
    await widget.onEdit?.call();
    if (mounted) _cubit.load(silent: true);
  }

  Future<void> _pickPreset(List<RolePresetOption> presets) async {
    final RolePresetOption? preset = await showAppSheet<RolePresetOption>(
      context: context,
      child: AppSheet(
        title: 'Áp preset role',
        body: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final RolePresetOption p in presets) ...[
              Builder(
                builder: (sheetContext) => AppButton(
                  label: p.label,
                  wide: true,
                  onPressed: () => Navigator.of(sheetContext).pop(p),
                ),
              ),
              const SizedBox(height: AppTokens.space8),
            ],
          ],
        ),
      ),
    );
    if (preset != null && mounted) _cubit.applyPreset(preset);
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<AccountPermissionsCubit, AccountPermissionsState>(
        builder: _view,
      ),
    );
  }

  Widget _view(BuildContext context, AccountPermissionsState state) {
    final AccountPermissionSummary? account = state.account;
    final bool canSave = state.canSave;
    // Leaving mid-save would reload the list before the save commits (stale preset
    // label) — back is blocked until the save settles.
    return PopScope(
      canPop: !state.saving,
      child: AppPhoneFrame(
        child: AppMobileShell(
          topbar: AppTopbar(
            eyebrow: 'QUẢN TRỊ',
            title: account == null ? 'Quyền' : 'Quyền · ${account.displayName}',
            onBack: widget.onBack == null
                ? null
                : () {
                    if (!state.saving) widget.onBack!();
                  },
            action: account == null
                ? null
                : Text(
                    'Lưu',
                    style: TextStyle(
                      color: canSave ? AppTokens.teal700 : AppTokens.muted,
                    ),
                  ),
            onAction: canSave ? _cubit.save : null,
          ),
          bottomNav: const AppBottomNav(activeIndex: kPermissionsTabIndex),
          body: _body(state),
        ),
      ),
    );
  }

  Widget _body(AccountPermissionsState state) {
    switch (state.status) {
      case AccountPermissionsStatus.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 240.0),
          ],
        );
      case AccountPermissionsStatus.error:
        return AppErrorState(
          message: state.errorMessage ?? kAccountPermissionsLoadError,
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case AccountPermissionsStatus.ready:
        return _matrix(state);
    }
  }

  Widget _matrix(AccountPermissionsState state) {
    final AccountPermissionSummary account = state.account!;
    final PermissionOptions options = state.options!;
    final bool editable = state.editable;
    final List<String> gaps = state.dependencyGaps;
    const SizedBox gap = SizedBox(height: AppTokens.space8);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          padding: const EdgeInsets.all(AppTokens.space12),
          child: Row(
            children: [
              Flexible(
                child: Text(
                  account.displayName,
                  style: const TextStyle(
                    color: AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 13.0,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: AppTokens.space8),
              AppCustomerTypeChip(
                label: account.matchingPresetLabel ?? kCustomPresetLabel,
              ),
            ],
          ),
        ),
        gap,
        if (editable && widget.onEdit != null) ...[
          AppButton(
            variant: AppButtonVariant.ghost,
            label: 'Sửa account',
            wide: true,
            onPressed: state.saving ? null : _edit,
          ),
          gap,
        ],
        if (editable && options.presets.isNotEmpty) ...[
          AppButton(
            variant: AppButtonVariant.accent,
            label: 'Áp preset role',
            wide: true,
            onPressed: state.saving ? null : () => _pickPreset(options.presets),
          ),
          gap,
        ],
        const AppBanner(
          tone: AppBannerTone.info,
          message: 'Preset chỉ nạp mặc định; tick/bỏ từng quyền bên dưới.',
        ),
        gap,
        if (!editable && account.readOnlyReason != null) ...[
          AppBanner(message: account.readOnlyReason!),
          gap,
        ],
        if (gaps.isNotEmpty) ...[
          AppBanner(
            key: const ValueKey<String>('dependency-gaps'),
            message: gaps.join(' '),
          ),
          gap,
        ],
        if (state.saveError != null) ...[
          AppBanner(tone: AppBannerTone.danger, message: state.saveError!),
          gap,
        ],
        if (state.saved) ...[
          const AppBanner(tone: AppBannerTone.info, message: 'Đã lưu quyền.'),
          gap,
        ],
        for (final PermissionOption p in options.permissions) ...[
          AppCard(
            key: ValueKey<String>('perm-${p.key}'),
            padding: const EdgeInsets.symmetric(horizontal: AppTokens.space12),
            child: AppCheckbox(
              label: p.label,
              checked: state.draft.contains(p.key),
              disabled: !editable || !p.grantable || state.saving,
              onChanged: (checked) => _cubit.toggle(p.key, checked),
            ),
          ),
          gap,
        ],
      ],
    );
  }
}
