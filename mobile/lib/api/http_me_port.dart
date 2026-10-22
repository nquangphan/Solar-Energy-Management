// hand-authored — the real MePort over the generated client (Story 10.7,
// mirror web/src/api/http-me-port.ts).
//
// `/me` has no error type of its own: a failure surfaces as the transport's
// ApiError and PermissionsProvider shows its error state.
import '../design_system/session/me_port.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpMePort implements MePort {
  HttpMePort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  @override
  Future<MeResponse> fetchMe() => _transport.call(() => _client.auth.meControllerMe());
}
