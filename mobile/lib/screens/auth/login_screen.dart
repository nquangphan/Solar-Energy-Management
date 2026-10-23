// hand-authored — Flutter app-screen (Story 1.11, signs in since Story 10.6).
// Mobile twin of the web LoginScreen: the Đăng nhập screen composed from shipped
// design-system widgets (AppField/AppButton/AppCard-less full-screen form/
// AppBanner/AppIcon) + tokens (AD-13). LoginCubit validates and signs in through
// the injected [AuthPort] (Story 11.1); the screen keeps only the two text
// controllers and renders its state: the error in the AppBanner, a 400
// `fieldErrors.phone` right under the phone field. No token and no network here —
// the port's HTTP adapter owns both. No router: success is emitted via [onLoggedIn].
//
// Auth screen ⇒ no topbar / no bottom-nav: wrapped in AppPhoneFrame DIRECTLY,
// never AppMobileShell (which adds a topbar + the locked 5-tab bottom-nav) —
// UX-DR-15.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/icons/app_icons.dart';
import '../../design_system/session/auth_port.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'login_cubit.dart';
import 'login_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.port,
    required this.onLoggedIn,
    this.onForgotPassword,
  });

  final AuthPort port;

  /// Emits "signed in" once the port accepted the credentials (Story 10.6).
  final VoidCallback onLoggedIn;

  /// Emits "show the Quên mật khẩu screen" (Story 2.8). No router here (AD-1/2).
  final VoidCallback? onForgotPassword;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _password = TextEditingController();

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit(LoginCubit cubit) async {
    final bool signedIn = await cubit.submit(phone: _phone.text, password: _password.text);
    if (signedIn && mounted) widget.onLoggedIn();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => LoginCubit(widget.port),
      child: BlocBuilder<LoginCubit, LoginState>(builder: _form),
    );
  }

  Widget _form(BuildContext context, LoginState state) {
    return AppPhoneFrame(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 22.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _brand(),
            if (state.error != null) ...[
              AppBanner(
                tone: AppBannerTone.danger,
                icon: 'ic-alert',
                message: state.error!,
              ),
              const SizedBox(height: AppTokens.space12),
            ],
            AppField(
              label: 'Số điện thoại',
              size: AppFieldSize.large,
              controller: _phone,
              placeholder: 'Nhập số điện thoại',
              keyboardType: TextInputType.phone,
            ),
            if (state.phoneError != null) ...[
              const SizedBox(height: AppTokens.space8),
              AppBanner(tone: AppBannerTone.danger, message: state.phoneError!),
            ],
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
              // Busy ⇒ disabled: a second tap never sends a second request.
              onPressed: state.busy ? null : () => _submit(context.read<LoginCubit>()),
            ),
            const SizedBox(height: AppTokens.space16),
            // s-forgot landed ở Story 2.8; tap chỉ EMIT ý định (AD-1/2).
            Center(
              child: GestureDetector(
                onTap: widget.onForgotPassword,
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
