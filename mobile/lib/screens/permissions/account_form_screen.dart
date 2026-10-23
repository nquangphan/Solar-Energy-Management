// hand-authored — Flutter app-screen (Story 8.3, mockup all-screens.html
// #s-account-form phone; twin of the web AccountFormScreen). Create: name,
// sign-in phone, email, initial password, role preset, active flag. Edit: the
// same profile fields, no password and no preset (permissions are edited in the
// matrix).
//
// AccountFormCubit reads and saves through the injected [AccountsPort]; the
// screen keeps the typed text in its controllers, renders the cubit's state and
// forwards taps. Only blank fields are checked here — the phone goes out raw.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/accounts_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'account_form_cubit.dart';
import 'account_form_state.dart';
import 'account_list_screen.dart';

class AccountFormScreen extends StatefulWidget {
  const AccountFormScreen({
    super.key,
    required this.port,
    this.accountId,
    this.onDone,
    this.onBack,
  });

  final AccountsPort port;

  /// Absent ⇒ create; present ⇒ edit that account.
  final String? accountId;

  /// After a successful save, with the saved account's id.
  final ValueChanged<String>? onDone;
  final VoidCallback? onBack;

  @override
  State<AccountFormScreen> createState() => _AccountFormScreenState();
}

class _AccountFormScreenState extends State<AccountFormScreen> {
  // A field: the preset sheet (an overlay) and the save reply (after an await) reach it.
  late final AccountFormCubit _cubit = AccountFormCubit(
    widget.port,
    widget.accountId,
  )..load();

  final TextEditingController _displayName = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  bool get _editing => widget.accountId != null;

  @override
  void initState() {
    super.initState();
    // Lưu follows the blank check of every field.
    for (final TextEditingController c in _controllers) {
      c.addListener(_onTyped);
    }
  }

  List<TextEditingController> get _controllers => [
    _displayName,
    _phone,
    _email,
    _password,
  ];

  void _onTyped() => setState(() {});

  @override
  void dispose() {
    for (final TextEditingController c in _controllers) {
      c.dispose();
    }
    _cubit.close();
    super.dispose();
  }

  bool _filled() =>
      _displayName.text.trim().isNotEmpty &&
      _phone.text.trim().isNotEmpty &&
      _email.text.trim().isNotEmpty &&
      (_editing || _password.text.isNotEmpty);

  Future<void> _save() async {
    final String? id = await _cubit.save(
      displayName: _displayName.text,
      phone: _phone.text,
      email: _email.text,
      password: _password.text,
    );
    if (id != null && mounted) widget.onDone?.call(id);
  }

  Future<void> _pickPreset(List<RolePresetOption> presets) async {
    final RolePresetOption? preset = await showAppSheet<RolePresetOption>(
      context: context,
      child: AppSheet(
        title: 'Role preset',
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
    if (preset != null && mounted) _cubit.choosePreset(preset);
  }

  /// Edit mode: the loaded account fills the fields once.
  void _onState(BuildContext context, AccountFormState state) {
    final AccountPermissionSummary? account = state.account;
    if (account == null) return;
    _displayName.text = account.displayName;
    _phone.text = account.phone ?? '';
    _email.text = account.email;
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocListener<AccountFormCubit, AccountFormState>(
        listenWhen: (previous, current) =>
            previous.status != AccountFormStatus.ready &&
            current.status == AccountFormStatus.ready,
        listener: _onState,
        child: BlocBuilder<AccountFormCubit, AccountFormState>(builder: _view),
      ),
    );
  }

  Widget _view(BuildContext context, AccountFormState state) {
    final bool canSave = state.canSave && _filled();
    // Leaving mid-save would drop its reply (the new account's id, or its errors).
    return PopScope(
      canPop: !state.saving,
      child: AppPhoneFrame(
        child: AppMobileShell(
          topbar: AppTopbar(
            eyebrow: 'ACCOUNT',
            title: _editing ? 'Sửa tài khoản' : 'Tạo tài khoản',
            onBack: widget.onBack == null
                ? null
                : () {
                    if (!state.saving) widget.onBack!();
                  },
            action: state.status == AccountFormStatus.ready
                ? Text(
                    'Lưu',
                    style: TextStyle(
                      color: canSave ? AppTokens.teal700 : AppTokens.muted,
                    ),
                  )
                : null,
            onAction: canSave ? _save : null,
          ),
          bottomNav: const AppBottomNav(activeIndex: kPermissionsTabIndex),
          body: _body(state, canSave),
        ),
      ),
    );
  }

  Widget _body(AccountFormState state, bool canSave) {
    switch (state.status) {
      case AccountFormStatus.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSkeleton(width: 220.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 180.0),
          ],
        );
      case AccountFormStatus.error:
        return AppErrorState(
          message: state.errorMessage ?? kAccountFormLoadError,
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case AccountFormStatus.unavailable:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppErrorState(message: 'Không sửa được tài khoản này.'),
            if (state.errorMessage != null) ...[
              const SizedBox(height: AppTokens.space8),
              AppBanner(message: state.errorMessage!),
            ],
          ],
        );
      case AccountFormStatus.ready:
        return _form(state, canSave);
    }
  }

  /// A backend field error, pinned under the input it names (AD-5).
  Widget _fieldError(AccountFormState state, String field) {
    final String? message = state.fieldErrors[field];
    if (message == null) return const SizedBox.shrink();
    return Padding(
      key: ValueKey<String>('field-error-$field'),
      padding: const EdgeInsets.only(top: AppTokens.space8),
      child: AppBanner(tone: AppBannerTone.danger, message: message),
    );
  }

  Widget _flag(AccountFormState state, {required bool active}) {
    final bool on = state.isActive == active;
    final String label = active ? 'Kích hoạt' : 'Tạm khoá';
    // AppScopeFlag only displays; the screen owns the choice (UX-DR-7).
    return Semantics(
      button: true,
      selected: on,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        key: ValueKey<String>('active-$active'),
        behavior: HitTestBehavior.opaque,
        onTap: () => _cubit.setActive(active),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppTokens.tapTargetMin),
          child: Center(
            child: AppScopeFlag(label: on ? '● $label' : label, on: on),
          ),
        ),
      ),
    );
  }

  Widget _form(AccountFormState state, bool canSave) {
    const SizedBox gap = SizedBox(height: AppTokens.space12);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (state.formError != null) ...[
          AppBanner(tone: AppBannerTone.danger, message: state.formError!),
          gap,
        ],
        AppField(label: 'Họ tên', controller: _displayName),
        _fieldError(state, 'displayName'),
        gap,
        AppField(
          label: 'Số điện thoại',
          controller: _phone,
          keyboardType: TextInputType.phone,
        ),
        _fieldError(state, 'phone'),
        gap,
        AppField(
          label: 'Email',
          controller: _email,
          keyboardType: TextInputType.emailAddress,
        ),
        _fieldError(state, 'email'),
        gap,
        if (!_editing) ...[
          AppField(
            label: 'Mật khẩu ban đầu',
            controller: _password,
            obscureText: true,
            placeholder: 'Tối thiểu 8 ký tự, có chữ và số.',
          ),
          _fieldError(state, 'password'),
          gap,
          const Text('Role preset', style: _label),
          const SizedBox(height: AppTokens.space4),
          if (state.presets.isEmpty)
            const AppEmptyState(
              title: 'Không có preset',
              message: 'Bạn không cấp được preset nào.',
            )
          else
            AppButton(
              key: const ValueKey<String>('preset-picker'),
              label: state.preset?.label ?? 'Chọn preset',
              wide: true,
              onPressed: state.saving ? null : () => _pickPreset(state.presets),
            ),
          _fieldError(state, 'preset'),
          gap,
        ],
        const Text('Trạng thái', style: _label),
        const SizedBox(height: AppTokens.space4),
        Row(
          children: [
            _flag(state, active: true),
            const SizedBox(width: AppTokens.space8),
            _flag(state, active: false),
          ],
        ),
        gap,
        const AppBanner(
          tone: AppBannerTone.info,
          message: 'Preset nạp quyền mặc định; chỉnh thêm ở màn Phân quyền.',
        ),
        gap,
        AppButton(
          variant: AppButtonVariant.primary,
          label: 'Lưu account',
          wide: true,
          onPressed: canSave ? _save : null,
        ),
      ],
    );
  }
}

const TextStyle _label = TextStyle(
  color: AppTokens.muted,
  fontFamily: AppTokens.fontFamily,
  fontSize: 12.0,
  fontWeight: FontWeight.w700,
);
