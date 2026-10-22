// hand-authored — the real AuthPort over the generated client (Story 10.6,
// mirror web/src/api/http-auth-port.ts).
//
// Tokens go straight into the session store; the screen never holds one.
// Renewal is NOT re-implemented here: restoreSession reuses the transport's
// single-flight refresh, so the transport stays the one place that refreshes.
import '../design_system/session/auth_port.dart';
import 'generated/models/login_request_dto.dart';
import 'generated/models/logout_request_dto.dart';
import 'generated/pns_api_client.dart';
import 'session_store.dart';
import 'transport.dart';

class HttpAuthPort implements AuthPort {
  HttpAuthPort(this._client, this._session, this._transport);

  final PnsApiClient _client;
  final SessionStore _session;
  final Transport _transport;

  @override
  Future<void> login({required String phone, required String password}) async {
    final tokens = await _transport.call(
      () => _client.auth.authControllerLogin(body: LoginRequestDto(phone: phone, password: password)),
    );
    await _session.setTokens(accessToken: tokens.accessToken, refreshToken: tokens.refreshToken);
  }

  @override
  Future<bool> restoreSession() async {
    if (await _session.readRefreshToken() == null) return false;
    return _transport.refreshSession();
  }

  @override
  Future<void> logout() async {
    final refreshToken = await _session.readRefreshToken();
    // Signed out locally FIRST: a renewal still in flight then sees the session gone and
    // revokes the token it was issued, instead of storing it while this call is on the wire.
    await _session.clear();
    if (refreshToken == null) return;
    try {
      await _transport.call(
        () => _client.auth.authControllerLogout(body: LogoutRequestDto(refreshToken: refreshToken)),
      );
    } catch (_) {
      // Logout is idempotent server-side and the token expires anyway: signing out locally is what matters.
    }
  }
}
