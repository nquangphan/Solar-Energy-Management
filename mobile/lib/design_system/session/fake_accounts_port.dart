// hand-authored — TEST/DEMO-ONLY fake port (Story 8.2, mirror web
// web/src/design-system/session/fake-accounts-port.ts).
//
// NOT a real backend: fixed answers so the Phân quyền screens render without a
// network. It decides nothing — `grantable`/`editable` are fixed literals. Each
// read answers NEW instances, so a state that equals the previous one is never
// a coincidence of identical replies.

import '../gating/app_permission_keys.g.dart';
import 'accounts_port.dart';

const String kDemoWorkerId = '22222222-2222-4222-8222-222222222222';
const String kDemoSelfId = '11111111-1111-4111-8111-111111111111';

const List<PermissionOption> kDemoPermissionOptions = <PermissionOption>[
  PermissionOption(
    key: AppPermissionKeys.quotesCreateEdit,
    label: 'Tạo/sửa báo giá',
    group: 'quotes',
    requires: <String>[
      AppPermissionKeys.customersManage,
      AppPermissionKeys.catalogView,
    ],
    grantable: true,
  ),
  PermissionOption(
    key: AppPermissionKeys.customersManage,
    label: 'Quản lý khách hàng',
    group: 'customers',
    requires: <String>[],
    grantable: true,
  ),
  PermissionOption(
    key: AppPermissionKeys.catalogView,
    label: 'Xem danh mục vật tư',
    group: 'catalog',
    requires: <String>[],
    grantable: true,
  ),
  PermissionOption(
    key: AppPermissionKeys.settingsManage,
    label: 'Cấu hình hệ thống',
    group: 'settings',
    requires: <String>[AppPermissionKeys.customersManage],
    grantable: true,
  ),
  PermissionOption(
    key: AppPermissionKeys.auditRead,
    label: 'Xem Audit log (Super Admin)',
    group: 'audit',
    requires: <String>[],
    grantable: false,
  ),
];

const List<RolePresetOption> kDemoPresets = <RolePresetOption>[
  RolePresetOption(
    key: RolePreset.thoKs,
    label: 'Thợ khảo sát',
    permissions: <String>[
      AppPermissionKeys.quotesCreateEdit,
      AppPermissionKeys.customersManage,
      AppPermissionKeys.catalogView,
    ],
  ),
  RolePresetOption(
    key: RolePreset.keToan,
    label: 'Kế toán',
    permissions: <String>[
      AppPermissionKeys.customersManage,
      AppPermissionKeys.catalogView,
    ],
  ),
];

AccountPermissionSummary demoAccount({
  String id = kDemoWorkerId,
  String displayName = 'Bình Thợ',
  String? phone = '+84900000002',
  bool isActive = true,
  List<String> permissions = const <String>[
    AppPermissionKeys.catalogView,
    AppPermissionKeys.customersManage,
    AppPermissionKeys.quotesCreateEdit,
  ],
  RolePreset? matchingPreset = RolePreset.thoKs,
  String? matchingPresetLabel = 'Thợ khảo sát',
  bool editable = true,
  String? readOnlyReason,
}) => AccountPermissionSummary(
  id: id,
  displayName: displayName,
  phone: phone,
  email: '$id@example.com',
  isActive: isActive,
  permissions: permissions,
  matchingPreset: matchingPreset,
  matchingPresetLabel: matchingPresetLabel,
  editable: editable,
  readOnlyReason: readOnlyReason,
);

class FakeAccountsPort implements AccountsPort {
  FakeAccountsPort({
    List<AccountPermissionSummary>? accounts,
    PermissionOptions? options,
  }) : accounts =
           accounts ??
           <AccountPermissionSummary>[
             demoAccount(),
             demoAccount(
               id: kDemoSelfId,
               displayName: 'An Admin',
               matchingPreset: null,
               matchingPresetLabel: null,
               editable: false,
               readOnlyReason: 'Đây là tài khoản của bạn.',
             ),
           ],
       options =
           options ??
           const PermissionOptions(
             permissions: kDemoPermissionOptions,
             presets: kDemoPresets,
           );

  List<AccountPermissionSummary> accounts;
  PermissionOptions options;

  int listCalls = 0;
  int optionsCalls = 0;
  final List<(String, List<String>)> updateCalls = <(String, List<String>)>[];

  /// When set, the next [updatePermissions] throws it.
  Object? updateError;

  final List<CreateAccountInput> createCalls = <CreateAccountInput>[];
  final List<(String, UpdateAccountInput)> updateAccountCalls =
      <(String, UpdateAccountInput)>[];

  /// When set, the next [createAccount] / [updateAccount] throws it.
  Object? accountError;

  @override
  Future<List<AccountPermissionSummary>> listAccounts() async {
    listCalls++;
    // Fresh instances every call: generated DTOs compare by identity.
    return <AccountPermissionSummary>[
      for (final AccountPermissionSummary a in accounts)
        AccountPermissionSummary.fromJson(a.toJson()),
    ];
  }

  @override
  Future<PermissionOptions> getPermissionOptions() async {
    optionsCalls++;
    return PermissionOptions(
      permissions: <PermissionOption>[
        for (final PermissionOption o in options.permissions)
          PermissionOption.fromJson(o.toJson()),
      ],
      presets: <RolePresetOption>[
        for (final RolePresetOption p in options.presets)
          RolePresetOption.fromJson(p.toJson()),
      ],
    );
  }

  @override
  Future<AccountPermissionSummary> updatePermissions(
    String id,
    List<String> permissions,
  ) async {
    updateCalls.add((id, permissions));
    final Object? error = updateError;
    if (error != null) {
      updateError = null;
      throw error;
    }
    final AccountPermissionSummary current = accounts.firstWhere(
      (a) => a.id == id,
    );
    final AccountPermissionSummary saved = demoAccount(
      id: id,
      displayName: current.displayName,
      phone: current.phone,
      isActive: current.isActive,
      permissions: <String>[...permissions]..sort(),
      matchingPreset: null,
      matchingPresetLabel: null,
    );
    accounts = <AccountPermissionSummary>[
      for (final AccountPermissionSummary a in accounts) a.id == id ? saved : a,
    ];
    return saved;
  }

  @override
  Future<AccountPermissionSummary> createAccount(
    CreateAccountInput input,
  ) async {
    createCalls.add(input);
    final Object? error = accountError;
    if (error != null) {
      accountError = null;
      throw error;
    }
    final RolePresetOption? preset = options.presets
        .where((p) => p.key == input.preset)
        .firstOrNull;
    // A fresh id per call, so two creates are distinguishable.
    final AccountPermissionSummary created = demoAccount(
      id: 'new-${createCalls.length}',
      displayName: input.displayName,
      phone: input.phone,
      isActive: input.isActive,
      permissions: <String>[...?preset?.permissions]..sort(),
      matchingPreset: preset?.key,
      matchingPresetLabel: preset?.label,
    );
    accounts = <AccountPermissionSummary>[...accounts, created];
    return created;
  }

  @override
  Future<AccountPermissionSummary> updateAccount(
    String id,
    UpdateAccountInput input,
  ) async {
    updateAccountCalls.add((id, input));
    final Object? error = accountError;
    if (error != null) {
      accountError = null;
      throw error;
    }
    final AccountPermissionSummary current = accounts.firstWhere(
      (a) => a.id == id,
    );
    final AccountPermissionSummary saved = demoAccount(
      id: id,
      displayName: input.displayName,
      phone: input.phone,
      isActive: input.isActive,
      permissions: current.permissions,
      matchingPreset: current.matchingPreset,
      matchingPresetLabel: current.matchingPresetLabel,
    );
    accounts = <AccountPermissionSummary>[
      for (final AccountPermissionSummary a in accounts) a.id == id ? saved : a,
    ];
    return saved;
  }
}
