// hand-authored — Flutter app-screen (Story 2.8). Mobile twin of the web
// ForgotPasswordScreen: composed from shipped design-system widgets
// (AppStepper/AppField/AppButton/AppCard/AppBanner) + tokens (AD-13).
//
// Auth screen ⇒ no bottom-nav: wrapped in AppPhoneFrame with an AppTopbar (back
// → login) and NEVER AppMobileShell/AppBottomNav (UX-DR-15).
//
// Transport goes through the injected [PasswordPort] — no dio/http here, and no
// router. ForgotPasswordCubit owns the two-step flow, its validation (UX only,
// AD-4 — the backend owns every real rule) and the resend countdown (Story 11.1);
// the screen keeps the four text controllers.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/password_port.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'forgot_password_cubit.dart';
import 'forgot_password_state.dart';

/// Seconds → `MM:SS` for the resend countdown.
String formatCountdown(int seconds) {
  final mm = (seconds ~/ 60).toString().padLeft(2, '0');
  final ss = (seconds % 60).toString().padLeft(2, '0');
  return '$mm:$ss';
}

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

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submitReset(ForgotPasswordCubit cubit) async {
    final bool reset = await cubit.reset(
      phone: _phone.text,
      code: _code.text,
      password: _password.text,
      confirm: _confirm.text,
    );
    if (reset && mounted) widget.onBackToLogin?.call();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => ForgotPasswordCubit(widget.port),
      child: BlocBuilder<ForgotPasswordCubit, ForgotPasswordState>(builder: _page),
    );
  }

  Widget _page(BuildContext context, ForgotPasswordState state) {
    final cubit = context.read<ForgotPasswordCubit>();
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
                    Center(child: _stepper(state.step)),
                    const SizedBox(height: AppTokens.space16),
                    if (state.error != null) ...[
                      AppBanner(
                        tone: AppBannerTone.danger,
                        icon: 'ic-alert',
                        message: state.error!,
                      ),
                      const SizedBox(height: AppTokens.space12),
                    ],
                    if (state.step == ForgotStep.request) ..._requestStep(state, cubit) else ..._verifyStep(state, cubit),
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

  Widget _stepper(ForgotStep step) {
    return AppStepper(
      steps: [
        AppStepItem(
          label: 'Gửi mã',
          state: step == ForgotStep.request
              ? AppStepState.current
              : AppStepState.done,
        ),
        AppStepItem(
          label: 'Mã & mật khẩu mới',
          state: step == ForgotStep.verify
              ? AppStepState.current
              : AppStepState.upcoming,
        ),
      ],
    );
  }

  List<Widget> _requestStep(ForgotPasswordState state, ForgotPasswordCubit cubit) {
    return [
      AppField(
        label: 'Số điện thoại đã đăng ký',
        size: AppFieldSize.large,
        controller: _phone,
        placeholder: 'Nhập số điện thoại đã đăng ký',
        keyboardType: TextInputType.phone,
      ),
      if (state.phoneError != null) ...[
        const SizedBox(height: AppTokens.space8),
        AppBanner(tone: AppBannerTone.danger, message: state.phoneError!),
      ],
      const SizedBox(height: AppTokens.space16),
      AppButton(
        variant: AppButtonVariant.primary,
        wide: true,
        label: 'Gửi mã',
        onPressed: () => cubit.requestCode(_phone.text),
      ),
    ];
  }

  List<Widget> _verifyStep(ForgotPasswordState state, ForgotPasswordCubit cubit) {
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
        onPressed: () => _submitReset(cubit),
      ),
      const SizedBox(height: AppTokens.space12),
      Center(
        child: Text(
          'Gửi lại mã sau ${formatCountdown(state.remaining)}',
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
