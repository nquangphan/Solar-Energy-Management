// hand-authored — Flutter app-screen (Story 2.8). Mobile twin of the web
// ProfileScreen: read-only identity + self-service đổi mật khẩu, composed from
// shipped design-system widgets (AppCard/AppFrame/AppField/AppButton/AppBanner/
// AppIcon) + tokens (AD-13).
//
// Office screen ⇒ it lives INSIDE the app shell: AppMobileShell with the locked
// 5-tab AppBottomNav (Menu tab active), unlike the auth screens (UX-DR-15).
//
// Identity comes from the session PermissionsScope, which ALREADY fetched `/me` —
// this screen does not call `/me` a second time.
//
// The mockup's `Tài khoản` / `Vai trò` / `SĐT` / `Đăng nhập gần nhất` rows are NOT
// rendered: none of those columns exist, and Role is a preset applied at creation,
// not stored truth (AD-8) — so "Vai trò" cannot be displayed honestly. Only real
// `/me` fields render. The rest is Epic 8.

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/icons/app_icons.dart';
import '../../design_system/session/app_session.dart';
import '../../design_system/session/password_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';

/// Index of the locked bottom-nav `Menu` tab — the Hồ sơ screen is reached from it.
const int _menuTabIndex = 4;

// Mirror of the backend policy (`IsPasswordPolicy`): ≥8 chars, at least one letter
// and one digit. Presentational only — the backend rejects regardless (AD-4).
final RegExp _passwordRe = RegExp(r'^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$');

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.port});

  final PasswordPort port;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final TextEditingController _current = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  String? _error;
  bool _done = false;

  @override
  void dispose() {
    _current.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _reset() {
    _current.clear();
    _password.clear();
    _confirm.clear();
    setState(() => _error = null);
  }

  Future<void> _submit() async {
    // Clear a prior success banner so a later validation error can't render the
    // green "changed" banner alongside the red one.
    if (_done) setState(() => _done = false);
    final String current = _current.text.trim();
    final String password = _password.text;
    if (current.isEmpty) {
      setState(() => _error = 'Nhập mật khẩu hiện tại.');
      return;
    }
    if (!_passwordRe.hasMatch(password)) {
      setState(() => _error = 'Mật khẩu tối thiểu 8 ký tự, có chữ và số.');
      return;
    }
    if (password != _confirm.text) {
      setState(() => _error = 'Xác nhận mật khẩu không khớp.');
      return;
    }
    setState(() => _error = null);
    try {
      await widget.port.changePassword(
        currentPassword: current,
        newPassword: password,
      );
      if (!mounted) return;
      _reset();
      setState(() => _done = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = PermissionsScope.of(context);
    final me = scope.me;

    // Until /me resolves, identity is unknown — show a loading/error state rather
    // than an identity card full of empty strings.
    final Widget body;
    if (scope.status == SessionStatus.loading) {
      body = const Center(child: AppSkeleton(width: 200.0));
    } else if (scope.status == SessionStatus.error) {
      body = const AppErrorState(message: 'Không tải được hồ sơ');
    } else {
      body = SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _identity(me?.displayName ?? '', me?.email ?? ''),
            const SizedBox(height: AppTokens.space16),
            _changePassword(),
          ],
        ),
      );
    }

    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'TÀI KHOẢN', title: 'Hồ sơ'),
        bottomNav: const AppBottomNav(activeIndex: _menuTabIndex),
        body: body,
      ),
    );
  }

  Widget _identity(String displayName, String email) {
    return AppCard(
      variant: AppCardVariant.teal,
      padding: const EdgeInsets.all(AppTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44.0,
            height: 44.0,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              border: Border.all(
                  color: AppTokens.teal, width: AppTokens.borderWidth),
              borderRadius: BorderRadius.circular(AppTokens.radiusLg),
            ),
            child: const AppIcon('ic-user', size: 22.0, color: AppTokens.teal),
          ),
          const SizedBox(height: AppTokens.space8),
          Text(
            displayName,
            style: const TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 17.0,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.01 * 17.0,
            ),
          ),
          const SizedBox(height: AppTokens.space16),
          _row('Tên hiển thị', displayName),
          const SizedBox(height: AppTokens.space8),
          _row('Email', email),
          const SizedBox(height: AppTokens.space8),
          // A live session proves the account is active: the guard re-checks
          // `isActive` on EVERY request (Story 2.5).
          _row('Trạng thái', 'Đang hoạt động'),
        ],
      ),
    );
  }

  /// The mockup's `kv` row, composed from text + tokens rather than a new
  /// design-system component (that would pull in SSOT + parity guards).
  Widget _row(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120.0,
          child: Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 10.0,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.08 * 10.0,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _changePassword() {
    return AppFrame(
      label: 'Đổi mật khẩu',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_done) ...[
            const AppBanner(
              tone: AppBannerTone.info,
              message: 'Đã đổi mật khẩu. Bạn cần đăng nhập lại.',
            ),
            const SizedBox(height: AppTokens.space12),
          ],
          if (_error != null) ...[
            AppBanner(
              tone: AppBannerTone.danger,
              icon: 'ic-alert',
              message: _error!,
            ),
            const SizedBox(height: AppTokens.space12),
          ],
          AppField(
            label: 'Mật khẩu hiện tại',
            size: AppFieldSize.large,
            controller: _current,
            placeholder: 'Nhập mật khẩu hiện tại',
            obscureText: true,
          ),
          const SizedBox(height: AppTokens.space12),
          AppField(
            label: 'Mật khẩu mới',
            size: AppFieldSize.large,
            controller: _password,
            placeholder: 'Nhập mật khẩu mới',
            obscureText: true,
          ),
          const SizedBox(height: AppTokens.space12),
          AppField(
            label: 'Xác nhận mật khẩu mới',
            size: AppFieldSize.large,
            controller: _confirm,
            placeholder: 'Nhập lại mật khẩu mới',
            obscureText: true,
          ),
          const SizedBox(height: AppTokens.space12),
          const AppBanner(
            tone: AppBannerTone.info,
            message:
                'Tối thiểu 8 ký tự, có chữ và số. Đổi mật khẩu sẽ ghi vào Audit log.',
          ),
          const SizedBox(height: AppTokens.space16),
          // Stacked full-width actions — the primary label ("Cập nhật mật khẩu")
          // does not fit beside "Huỷ" on a narrow phone frame.
          AppButton(
            variant: AppButtonVariant.primary,
            label: 'Cập nhật mật khẩu',
            wide: true,
            onPressed: _submit,
          ),
          const SizedBox(height: AppTokens.space8),
          AppButton(
            variant: AppButtonVariant.ghost,
            label: 'Huỷ',
            wide: true,
            onPressed: _reset,
          ),
        ],
      ),
    );
  }
}
