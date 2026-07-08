// hand-authored — Flutter app-screen (Story 1.11). Mobile twin of the web
// LoginScreen: the Đăng nhập screen composed from shipped design-system widgets
// (AppField/AppButton/AppCard-less full-screen form/AppBanner/AppIcon) + tokens
// (AD-13). Presentational StatefulWidget only — validate rỗng/định dạng →
// AppBanner. KHÔNG BLoC/repository/mạng/router (backend + auth = Epic 2,
// Story 2.3).
//
// Auth screen ⇒ no topbar / no bottom-nav: wrapped in AppPhoneFrame DIRECTLY,
// never AppMobileShell (which adds a topbar + the locked 5-tab bottom-nav) —
// UX-DR-15.

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/icons/app_icons.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/tokens/app_tokens.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _account = TextEditingController();
  final TextEditingController _password = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _account.dispose();
    _password.dispose();
    super.dispose();
  }

  // Presentational validation only (AC-2): rỗng → AppBanner; định dạng tối thiểu
  // (SĐT chữ số hoặc email). Cùng câu Việt như web để parity nhãn. Real auth
  // wires in Epic 2 (Story 2.3) — KHÔNG mạng, KHÔNG token, KHÔNG router.
  void _submit() {
    final String account = _account.text.trim();
    final String password = _password.text.trim();
    if (account.isEmpty || password.isEmpty) {
      setState(() => _error = 'Nhập đủ tài khoản và mật khẩu.');
      return;
    }
    final bool isPhone = RegExp(r'^[0-9]{8,}$').hasMatch(account);
    final bool isEmail = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(account);
    if (!isPhone && !isEmail) {
      setState(
          () => _error = 'Tài khoản phải là số điện thoại hoặc email hợp lệ.');
      return;
    }
    setState(() => _error = null);
    // Epic 2 (Story 2.3): gọi API đăng nhập + lưu JWT ở đây.
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 22.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _brand(),
            if (_error != null) ...[
              AppBanner(
                tone: AppBannerTone.danger,
                icon: 'ic-alert',
                message: _error!,
              ),
              const SizedBox(height: AppTokens.space12),
            ],
            AppField(
              label: 'Tài khoản',
              size: AppFieldSize.large,
              controller: _account,
              placeholder: 'Số điện thoại hoặc email',
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: AppTokens.space12),
            AppField(
              label: 'Mật khẩu',
              size: AppFieldSize.large,
              controller: _password,
              placeholder: 'Nhập mật khẩu',
              obscureText: true,
            ),
            const SizedBox(height: AppTokens.space16),
            AppButton(
              variant: AppButtonVariant.primary,
              wide: true,
              label: 'Đăng nhập',
              onPressed: _submit,
            ),
            const SizedBox(height: AppTokens.space16),
            // s-forgot = Story 2.8; link presentational, chưa có router (AD-1/2).
            Center(
              child: GestureDetector(
                onTap: () {},
                child: const Text(
                  'Quên mật khẩu?',
                  style: TextStyle(
                    color: AppTokens.teal700,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _brand() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 26.0),
      child: Column(
        children: [
          Container(
            width: 56.0,
            height: 56.0,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              border: Border.all(
                  color: AppTokens.teal, width: AppTokens.borderWidth),
              borderRadius: BorderRadius.circular(14.0),
            ),
            child: const AppIcon('ic-sun', size: 30.0, color: AppTokens.teal),
          ),
          const SizedBox(height: 12.0),
          const Text(
            'Phương Nam Solar',
            style: TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 19.0,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.01 * 19.0,
            ),
          ),
          const SizedBox(height: 2.0),
          const Text(
            'Đăng nhập để bắt đầu ca làm',
            style: TextStyle(
              color: AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
