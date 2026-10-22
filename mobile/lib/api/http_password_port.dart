// hand-authored — the real PasswordPort over the generated client (Story 10.7,
// mirror web/src/api/http-password-port.ts).
//
// The reset code only ever goes OUT: forgot-password answers with the code
// lifetime alone. A wrong current password on change-password is a 401 the
// transport replays once and then surfaces as ApiError, keeping the session.
import '../design_system/session/password_port.dart';
import 'generated/models/change_password_request_dto.dart';
import 'generated/models/forgot_password_request_dto.dart';
import 'generated/models/reset_password_request_dto.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpPasswordPort implements PasswordPort {
  HttpPasswordPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<int> requestResetCode(String email) async {
    final response = await _transport.call(
      () => _client.auth.authControllerForgotPassword(body: ForgotPasswordRequestDto(email: email)),
    );
    return response.expiresInSeconds.toInt();
  }

  @override
  Future<void> resetPassword({required String email, required String code, required String newPassword}) =>
      _transport.call(
        () => _client.auth.authControllerResetPassword(
          body: ResetPasswordRequestDto(email: email, code: code, newPassword: newPassword),
        ),
      );

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) => _transport.call(
    () => _client.auth.changePasswordControllerChangePassword(
      body: ChangePasswordRequestDto(currentPassword: currentPassword, newPassword: newPassword),
    ),
  );
}
