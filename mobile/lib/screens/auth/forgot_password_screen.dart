// hand-authored — Flutter app-screen (Story 2.8). Mobile twin of the web
// ForgotPasswordScreen: composed from shipped design-system widgets
// (AppStepper/AppField/AppButton/AppCard/AppBanner) + tokens (AD-13).
//
// Auth screen ⇒ no bottom-nav: wrapped in AppPhoneFrame with an AppTopbar (back
// → login) and NEVER AppMobileShell/AppBottomNav (UX-DR-15).
//
// Transport goes through the injected [PasswordPort] — no dio/http here, and no
// router. The two-step flow lives in widget state.
//
// VALIDATION HERE IS UX ONLY (AD-4). The backend owns every real rule: attempt
// ceiling, single-use, expiry, and the neutral response that hides whether an
// email exists. Never branch this UI on "does this account exist".

import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/password_port.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';

final RegExp _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
final RegExp _codeRe = RegExp(r'^[0-9]{6}$');
// Mirror of the backend policy (`IsPasswordPolicy`): ≥8 chars, at least one
// letter and one digit. Presentational only — the backend rejects regardless.
final RegExp _passwordRe = RegExp(r'^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$');

/// `nguyen.van.a@domain.vn` → `ng•••@domain.vn`. Masking is CLIENT-side cosmetics.
String maskEmail(String email) {
  final parts = email.split('@');
  final user = parts.first;
  final head = user.length >= 2 ? user.substring(0, 2) : user;
  return '$head•••@${parts.last}';
}

/// Seconds → `MM:SS` for the resend countdown.
String formatCountdown(int seconds) {
  final mm = (seconds ~/ 60).toString().padLeft(2, '0');
  final ss = (seconds % 60).toString().padLeft(2, '0');
  return '$mm:$ss';
}

enum _Step { request, verify }

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    required this.port,
    this.onBackToLogin,
  });

  final PasswordPort port;

  /// Emits "go back to the login screen". No router here (AD-1/2).
  final VoidCallback? onBackToLogin;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final TextEditingController _email = TextEditingController();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  _Step _step = _Step.request;
  String? _error;
  int _remaining = 0;
  Timer? _timer;

  @override
  void dispose() {
    // Not optional: a surviving Timer keeps calling setState after the widget is
    // gone (and `flutter test` fails on the pending timer).
    _timer?.cancel();
    _email.dispose();
    _code.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  void _startCountdown(int seconds) {
    _timer?.cancel();
    _remaining = seconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      // Stop at zero — a perpetual periodic timer keeps firing setState forever
      // and leaves a pending timer that outlives the screen.
      if (_remaining <= 0) {
        timer.cancel();
        return;
      }
      setState(() => _remaining -= 1);
    });
  }

  Future<void> _submitRequest() async {
    final String email = _email.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Nhập email đã đăng ký.');
      return;
    }
    if (!_emailRe.hasMatch(email)) {
      setState(() => _error = 'Email không hợp lệ.');
      return;
    }
    setState(() => _error = null);
    try {
      final int expiresInSeconds = await widget.port.requestResetCode(email);
      if (!mounted) return;
      setState(() => _step = _Step.verify);
      _startCountdown(expiresInSeconds);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Không gửi được mã. Thử lại sau.');
    }
  }

  Future<void> _submitReset() async {
    final String code = _code.text.trim();
    final String password = _password.text;
    if (!_codeRe.hasMatch(code)) {
      setState(() => _error = 'Mã xác thực gồm đúng 6 chữ số.');
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
      await widget.port.resetPassword(
        email: _email.text.trim(),
        code: code,
        newPassword: password,
      );
      if (!mounted) return;
      widget.onBackToLogin?.call();
    } catch (_) {
      if (!mounted) return;
      // ONE message for every backend failure — the API deliberately does not say
      // which branch failed, and neither do we.
      setState(() => _error = 'Không thể đặt lại mật khẩu. Kiểm tra lại mã và thử lại.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: Column(
        children: [
          AppTopbar(
            title: 'Quên mật khẩu',
            onBack: widget.onBackToLogin,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding:
                  const EdgeInsets.symmetric(horizontal: 13.0, vertical: 12.0),
              child: AppCard(
                padding: const EdgeInsets.all(AppTokens.space16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(child: _stepper()),
                    const SizedBox(height: AppTokens.space16),
                    if (_error != null) ...[
                      AppBanner(
                        tone: AppBannerTone.danger,
                        icon: 'ic-alert',
                        message: _error!,
                      ),
                      const SizedBox(height: AppTokens.space12),
                    ],
                    if (_step == _Step.request) ..._requestStep() else ..._verifyStep(),
                    const SizedBox(height: AppTokens.space16),
                    Center(
                      child: AppButton(
                        variant: AppButtonVariant.ghost,
                        label: 'Quay lại đăng nhập',
                        onPressed: widget.onBackToLogin,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepper() {
    return AppStepper(
      steps: [
        AppStepItem(
          label: 'Gửi mã',
          state: _step == _Step.request
              ? AppStepState.current
              : AppStepState.done,
        ),
        AppStepItem(
          label: 'Mã & mật khẩu mới',
          state: _step == _Step.verify
              ? AppStepState.current
              : AppStepState.upcoming,
        ),
      ],
    );
  }

  List<Widget> _requestStep() {
    return [
      AppField(
        label: 'Email đã đăng ký',
        size: AppFieldSize.large,
        controller: _email,
        placeholder: 'Nhập email đã đăng ký',
        keyboardType: TextInputType.emailAddress,
      ),
      const SizedBox(height: AppTokens.space16),
      AppButton(
        variant: AppButtonVariant.primary,
        wide: true,
        label: 'Gửi mã',
        onPressed: _submitRequest,
      ),
    ];
  }

  List<Widget> _verifyStep() {
    return [
      AppBanner(
        tone: AppBannerTone.info,
        message:
            'Đã gửi mã 6 số đến ${maskEmail(_email.text.trim())}. Mã có hiệu lực 5 phút.',
      ),
      const SizedBox(height: AppTokens.space12),
      AppField(
        label: 'Mã xác thực',
        size: AppFieldSize.large,
        controller: _code,
        placeholder: '000000',
        keyboardType: TextInputType.number,
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
      const SizedBox(height: AppTokens.space16),
      AppButton(
        variant: AppButtonVariant.primary,
        wide: true,
        label: 'Đặt lại mật khẩu',
        onPressed: _submitReset,
      ),
      const SizedBox(height: AppTokens.space12),
      Center(
        child: Text(
          'Gửi lại mã sau ${formatCountdown(_remaining)}',
          style: const TextStyle(
            color: AppTokens.muted,
            fontFamily: AppTokens.fontFamily,
            fontSize: 12.0,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    ];
  }
}
