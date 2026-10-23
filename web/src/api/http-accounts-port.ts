// hand-authored — the real AccountsPort over the generated client (Story 8.2).
import type {
  AccountPermissionSummary,
  AccountsPort,
  CreateAccountInput,
  PermissionOptions,
  UpdateAccountInput,
} from '../design-system/session/accounts-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpAccountsPort implements AccountsPort {
  constructor(private readonly client: ApiClient) {}

  async listAccounts(): Promise<AccountPermissionSummary[]> {
    const { data } = await this.client.GET('/accounts');
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async getPermissionOptions(): Promise<PermissionOptions> {
    const { data } = await this.client.GET('/accounts/permission-options');
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async updatePermissions(id: string, permissions: string[]): Promise<AccountPermissionSummary> {
    const { data } = await this.client.PUT('/accounts/{id}/permissions', {
      params: { path: { id } },
      body: { permissions },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async createAccount(input: CreateAccountInput): Promise<AccountPermissionSummary> {
    const { data } = await this.client.POST('/accounts', { body: input });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<AccountPermissionSummary> {
    const { data } = await this.client.PUT('/accounts/{id}', {
      params: { path: { id } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
