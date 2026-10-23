// Test port for the Phân quyền screens (Story 8.2): every call is recorded and
// waits on its own completer until the test answers it, so a test controls the
// order of replies (stale reply, tear-down while pending).
import 'dart:async';

import 'package:pns_mobile/design_system/session/accounts_port.dart';
import 'package:pns_mobile/design_system/session/fake_accounts_port.dart';

class HeldAccountsPort implements AccountsPort {
  final List<Completer<List<AccountPermissionSummary>>> lists =
      <Completer<List<AccountPermissionSummary>>>[];
  final List<Completer<PermissionOptions>> options =
      <Completer<PermissionOptions>>[];
  final List<(String, List<String>)> updateCalls = <(String, List<String>)>[];
  final List<Completer<AccountPermissionSummary>> updates =
      <Completer<AccountPermissionSummary>>[];
  final List<CreateAccountInput> createCalls = <CreateAccountInput>[];
  final List<(String, UpdateAccountInput)> updateAccountCalls =
      <(String, UpdateAccountInput)>[];

  /// One completer per create/update-account call, in call order.
  final List<Completer<AccountPermissionSummary>> accountWrites =
      <Completer<AccountPermissionSummary>>[];

  @override
  Future<List<AccountPermissionSummary>> listAccounts() {
    final c = Completer<List<AccountPermissionSummary>>();
    lists.add(c);
    return c.future;
  }

  @override
  Future<PermissionOptions> getPermissionOptions() {
    final c = Completer<PermissionOptions>();
    options.add(c);
    return c.future;
  }

  @override
  Future<AccountPermissionSummary> updatePermissions(
    String id,
    List<String> permissions,
  ) {
    updateCalls.add((id, permissions));
    final c = Completer<AccountPermissionSummary>();
    updates.add(c);
    return c.future;
  }

  @override
  Future<AccountPermissionSummary> createAccount(CreateAccountInput input) {
    createCalls.add(input);
    final c = Completer<AccountPermissionSummary>();
    accountWrites.add(c);
    return c.future;
  }

  @override
  Future<AccountPermissionSummary> updateAccount(
    String id,
    UpdateAccountInput input,
  ) {
    updateAccountCalls.add((id, input));
    final c = Completer<AccountPermissionSummary>();
    accountWrites.add(c);
    return c.future;
  }
}

/// Options with fresh instances (generated DTOs compare by identity).
PermissionOptions demoOptions({
  List<RolePresetOption> presets = kDemoPresets,
}) => PermissionOptions(
  permissions: <PermissionOption>[
    for (final PermissionOption o in kDemoPermissionOptions)
      PermissionOption.fromJson(o.toJson()),
  ],
  presets: presets,
);
