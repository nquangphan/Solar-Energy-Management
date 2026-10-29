// hand-authored — TEST/DEMO-ONLY fake port (Story 8.2, mirror Flutter
// mobile/lib/design_system/session/fake_accounts_port.dart).
//
// NOT a real backend: fixed answers so the Phân quyền screen renders without a
// network. It enforces nothing — `grantable`/`editable` are fixed literals.

import { PERMISSION_KEYS as K } from '../gating/permission-keys.generated';

import type {
  AccountPermissionSummary,
  AccountsPort,
  CreateAccountInput,
  PermissionOptions,
  UpdateAccountInput,
} from './accounts-port';

const THO_KS = [
  K.quotesCreateEdit,
  K.ordersConfirm,
  K.discountsApply,
  K.contractsGenerate,
  K.customersManage,
  K.catalogView,
  K.ordersViewOwn,
];

export const DEMO_PERMISSION_OPTIONS: PermissionOptions = {
  permissions: [
    {
      key: K.ordersViewAll,
      label: 'Xem tất cả đơn',
      group: 'orders',
      requires: [],
      requiresAnyOf: [],
      grantable: true,
      transitions: [],
    },
    {
      key: K.ordersViewOwn,
      label: 'Chỉ xem đơn của mình',
      group: 'orders',
      requires: [],
      requiresAnyOf: [],
      grantable: true,
      transitions: [],
    },
    {
      key: K.ordersConfirm,
      label: 'Chốt đơn',
      group: 'orders',
      requires: [],
      requiresAnyOf: [K.ordersViewAll, K.ordersViewOwn],
      grantable: true,
      transitions: [
        { event: 'chot', from: 'baogia', to: 'dachot' },
        { event: 'chot', from: 'choduyet', to: 'dachot' },
      ],
    },
    {
      key: K.auditRead,
      label: 'Xem Audit log',
      group: 'audit',
      requires: [],
      requiresAnyOf: [],
      grantable: false,
      transitions: [],
    },
    {
      key: K.quotesCreateEdit,
      label: 'Tạo/sửa báo giá',
      group: 'quotes',
      requires: [K.customersManage, K.catalogView],
      requiresAnyOf: [K.ordersViewAll, K.ordersViewOwn],
      grantable: true,
      transitions: [
        { event: 'mo_lai', from: 'dachot', to: 'baogia' },
        { event: 'huy', from: 'baogia', to: 'huy' },
        { event: 'huy', from: 'dachot', to: 'huy' },
        { event: 'huy', from: 'dacoc', to: 'huy' },
      ],
    },
    {
      key: K.discountsApply,
      label: 'Áp chiết khấu',
      group: 'discounts',
      requires: [],
      requiresAnyOf: [K.ordersViewAll, K.ordersViewOwn],
      grantable: true,
      transitions: [{ event: 'ap_chiet_khau', from: 'baogia', to: 'choduyet' }],
    },
    {
      key: K.contractsGenerate,
      label: 'Sinh hợp đồng',
      group: 'contracts',
      requires: [],
      requiresAnyOf: [K.ordersViewAll, K.ordersViewOwn],
      grantable: true,
      transitions: [],
    },
    {
      key: K.customersManage,
      label: 'Quản lý khách hàng',
      group: 'customers',
      requires: [],
      requiresAnyOf: [],
      grantable: true,
      transitions: [],
    },
    {
      key: K.settingsManage,
      label: 'Cấu hình hệ thống',
      group: 'settings',
      requires: [K.customersManage],
      requiresAnyOf: [],
      grantable: true,
      transitions: [],
    },
    {
      key: K.catalogView,
      label: 'Xem danh mục vật tư',
      group: 'catalog',
      requires: [],
      requiresAnyOf: [],
      grantable: true,
      transitions: [],
    },
    {
      key: K.paymentsRecord,
      label: 'Ghi nhận thanh toán',
      group: 'payments',
      requires: [],
      requiresAnyOf: [K.ordersViewAll, K.ordersViewOwn],
      grantable: true,
      transitions: [
        { event: 'du_coc', from: 'dachot', to: 'dacoc' },
        { event: 'hoan_thanh', from: 'dachot', to: 'hoanthanh' },
      ],
    },
  ],
  presets: [
    { key: 'THO_KS', label: 'Thợ khảo sát', permissions: THO_KS },
    {
      key: 'KE_TOAN',
      label: 'Kế toán',
      permissions: [K.paymentsRecord, K.catalogView, K.customersManage, K.ordersViewAll],
    },
  ],
};

export const DEMO_ACCOUNTS: AccountPermissionSummary[] = [
  {
    id: '6f1c2a4e-0b7d-4c1a-9d3e-2f5a8b7c9d10',
    displayName: 'Trần Văn A',
    phone: '+84901234567',
    email: 'a.tran@phuongnamsolar.vn',
    isActive: true,
    permissions: [...THO_KS].sort(),
    matchingPreset: 'THO_KS',
    matchingPresetLabel: 'Thợ khảo sát',
    editable: true,
    readOnlyReason: null,
  },
  {
    id: '7a2d3b5f-1c8e-4d2b-8e4f-3a6b9c8d0e21',
    displayName: 'Lê Thị C',
    phone: null,
    email: 'c.le@phuongnamsolar.vn',
    isActive: false,
    permissions: [K.catalogView],
    matchingPreset: null,
    matchingPresetLabel: null,
    editable: true,
    readOnlyReason: null,
  },
  {
    id: '8b3e4c6a-2d9f-4e3c-9f5a-4b7c0d9e1f32',
    displayName: 'Chủ vận hành',
    phone: '+84900000003',
    email: 'owner@phuongnamsolar.vn',
    isActive: true,
    permissions: [K.auditRead, K.permissionsManage],
    matchingPreset: null,
    matchingPresetLabel: null,
    editable: false,
    readOnlyReason: 'Tài khoản mang quyền bạn không có: Xem Audit log.',
  },
];

export class FakeAccountsPort implements AccountsPort {
  readonly saved: { id: string; permissions: string[] }[] = [];
  readonly created: CreateAccountInput[] = [];
  readonly updated: { id: string; input: UpdateAccountInput }[] = [];
  private listCalls = 0;

  constructor(
    private readonly accounts: AccountPermissionSummary[] = DEMO_ACCOUNTS,
    private readonly options: PermissionOptions = DEMO_PERMISSION_OPTIONS,
  ) {}

  listAccounts(): Promise<AccountPermissionSummary[]> {
    this.listCalls += 1;
    // A different answer each call, so a stale reply is distinguishable from a fresh one.
    return Promise.resolve(
      this.accounts.map((a) => ({
        ...a,
        email: `${this.listCalls}-${a.email}`,
      })),
    );
  }

  getPermissionOptions(): Promise<PermissionOptions> {
    return Promise.resolve(this.options);
  }

  updatePermissions(id: string, permissions: string[]): Promise<AccountPermissionSummary> {
    this.saved.push({ id, permissions });
    const account = this.accounts.find((a) => a.id === id) ?? this.accounts[0];
    return Promise.resolve({
      ...account,
      permissions: [...permissions].sort(),
      matchingPreset: null,
      matchingPresetLabel: null,
    });
  }

  createAccount(input: CreateAccountInput): Promise<AccountPermissionSummary> {
    this.created.push(input);
    const preset = this.options.presets.find((p) => p.key === input.preset);
    // A fresh id per call, so two creates are distinguishable.
    return Promise.resolve({
      id: `new-${this.created.length}`,
      displayName: input.displayName,
      phone: input.phone,
      email: input.email,
      isActive: input.isActive,
      permissions: [...(preset?.permissions ?? [])].sort(),
      matchingPreset: preset?.key ?? null,
      matchingPresetLabel: preset?.label ?? null,
      editable: true,
      readOnlyReason: null,
    });
  }

  updateAccount(id: string, input: UpdateAccountInput): Promise<AccountPermissionSummary> {
    this.updated.push({ id, input });
    const account = this.accounts.find((a) => a.id === id) ?? this.accounts[0];
    return Promise.resolve({ ...account, ...input });
  }
}
