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
// ceiling, single-use, expiry, phone normalization (AD-9 — the RAW number is
// sent), and the neutral response that hides whether a number is registered.
// Never branch this UI on "does this account exist" — step 2 never echoes it.

import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../api/api_error.dart';
import '../../design_system/components/components.dart';
import '../../design_system/session/password_port.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';

final RegExp _codeRe = RegExp(r'^[0-9]{6}$');
// Mirror of the backend policy (`IsPasswordPolicy`): ≥8 chars, at least one
// letter and one digit. Presentational only — the backend rejects regardless.
final RegExp _passwordRe = RegExp(r'^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$');

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
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  _Step _step = _Step.request;
  String? _error;
  String? _phoneError;
  int _remaining = 0;
  Timer? _timer;

  @override
  void dispose() {
    // Not optional: a surviving Timer keeps calling setState after the widget is
    // gone (and `flutter test` fails on the pending timer).
    _timer?.cancel();
    _phone.dispose();
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
    final String phone = _phone.text.trim();
    if (phone.isEmpty) {
      setState(() {
        _error = 'Nhập số điện thoại đã đăng ký.';
        _phoneError = null;
      });
      return;
    }
    setState(() {
      _error = null;
      _phoneError = null;
    });
    try {
      final int expiresInSeconds = await widget.port.requestResetCode(phone);
      if (!mounted) return;
      setState(() => _step = _Step.verify);
      _startCountdown(expiresInSeconds);
    } catch (e) {
      if (!mounted) return;
      // A number the backend could not parse belongs under its field; anything
      // else gets the one generic message.
      final String? fieldMessage = e is ApiError ? _phoneMessageOf(e) : null;
      setState(() {
        if (fieldMessage != null) {
          _phoneError = fieldMessage;
        } else {
          _error = 'Không gửi được mã. Thử lại sau.';
        }
      });
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
        phone: _phone.text.trim(),
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

  /// The FIRST backend message about `phone`, or null (same rule as web).
  String? _phoneMessageOf(ApiError e) {
    for (final f in e.fieldErrors ?? const []) {
      if (f.field == 'phone') return f.message;
    }
    return null;
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
        label: 'Số điện thoại đã đăng ký',
        size: AppFieldSize.large,
        controller: _phone,
        placeholder: 'Nhập số điện thoại đã đăng ký',
        keyboardType: TextInputType.phone,
      ),
      if (_phoneError != null) ...[
        const SizedBox(height: AppTokens.space8),
        AppBanner(tone: AppBannerTone.danger, message: _phoneError!),
      ],
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
      const AppBanner(
        tone: AppBannerTone.info,
        message:
            'Nếu số điện thoại đã đăng ký, mã 6 số sẽ được gửi tới số đó. Mã có hiệu lực 5 phút.',
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
