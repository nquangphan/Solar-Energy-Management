// hand-authored — the real ContractsPort over the generated client (Story 10.5).
import type {
  ContractSummary,
  ContractsOverview,
  ContractsPort,
} from '../design-system/session/contracts-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';
import { downloadedFile } from './download';

export class HttpContractsPort implements ContractsPort {
  constructor(private readonly client: ApiClient) {}

  async getOverview(orderId: string): Promise<ContractsOverview> {
    const { data } = await this.client.GET('/orders/{id}/contracts', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async generateContract(orderId: string): Promise<ContractSummary> {
    const { data } = await this.client.POST('/orders/{id}/contracts', {
      params: { path: { id: orderId } },
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async downloadContractPdf(orderId: string, contractId: string): Promise<File> {
    const { data, response } = await this.client.GET('/orders/{id}/contracts/{contractId}/pdf', {
      params: { path: { id: orderId, contractId } },
      parseAs: 'blob',
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return downloadedFile(data, response, `${contractId}.pdf`);
  }
}
