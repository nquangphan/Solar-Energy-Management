// hand-authored — the real AccountsPort over the generated client (Story 8.2,
// mirror web/src/api/http-accounts-port.ts). A rejection (400 key/dependency/
// field, 403 escalation/self-edit, 404, 409 phone/email taken) reaches the cubit as AccountsPortException with
// the backend's sentence — converted in [_call], the one place.
import '../design_system/session/accounts_port.dart';
import 'api_error.dart';
import 'generated/models/update_account_permissions_request_dto.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpAccountsPort implements AccountsPort {
  HttpAccountsPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await _transport.call(request);
    } on ApiError catch (e) {
      throw AccountsPortException(e.message, fieldErrors: fieldErrorMap(e));
    }
  }

  @override
  Future<List<AccountPermissionSummary>> listAccounts() =>
      _call(() => _client.accounts.accountsControllerList());

  @override
  Future<PermissionOptions> getPermissionOptions() =>
      _call(() => _client.accounts.accountsControllerPermissionOptions());

  @override
  Future<AccountPermissionSummary> updatePermissions(
    String id,
    List<String> permissions,
  ) => _call(
    () => _client.accounts.accountsControllerUpdatePermissions(
      id: id,
      body: UpdateAccountPermissionsRequestDto(permissions: permissions),
    ),
  );

  @override
  Future<AccountPermissionSummary> createAccount(CreateAccountInput input) =>
      _call(() => _client.accounts.accountsControllerCreate(body: input));

  @override
  Future<AccountPermissionSummary> updateAccount(
    String id,
    UpdateAccountInput input,
  ) => _call(
    () => _client.accounts.accountsControllerUpdate(id: id, body: input),
  );
}
