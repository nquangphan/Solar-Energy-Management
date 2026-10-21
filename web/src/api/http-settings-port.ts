// hand-authored — the real SettingsPort over the generated client (Story 10.4).
import type { CompanyLegalEntity, SettingsPort } from '../design-system/session/settings-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpSettingsPort implements SettingsPort {
  constructor(private readonly client: ApiClient) {}

  async getVatRate(): Promise<number> {
    const { data } = await this.client.GET('/settings/vat-rate');
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data.ratePercent;
  }

  async updateVatRate(ratePercent: number): Promise<number> {
    const { data } = await this.client.PATCH('/settings/vat-rate', { body: { ratePercent } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data.ratePercent;
  }

  async getCompanyLegalEntity(): Promise<CompanyLegalEntity> {
    const { data } = await this.client.GET('/settings/company-legal-entity');
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async updateCompanyLegalEntity(input: CompanyLegalEntity): Promise<CompanyLegalEntity> {
    const { data } = await this.client.PUT('/settings/company-legal-entity', { body: input });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
