// hand-authored — the real StockVouchersPort over the generated client (Story 10.5).
import type {
  CreateReturnVoucherInput,
  CreateStockVoucherInput,
  StockVoucherDetail,
  StockVoucherList,
  StockVoucherListQuery,
  StockVouchersPort,
} from '../design-system/session/stock-vouchers-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpStockVouchersPort implements StockVouchersPort {
  constructor(private readonly client: ApiClient) {}

  async listVouchers(query: StockVoucherListQuery = {}): Promise<StockVoucherList> {
    const { data } = await this.client.GET('/stock-vouchers', { params: { query } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async getVoucher(id: string): Promise<StockVoucherDetail> {
    const { data } = await this.client.GET('/stock-vouchers/{id}', { params: { path: { id } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async createVoucher(input: CreateStockVoucherInput): Promise<StockVoucherDetail> {
    const { data } = await this.client.POST('/stock-vouchers', { body: input });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }

  async createReturnVoucher(
    originVoucherId: string,
    input: CreateReturnVoucherInput,
  ): Promise<StockVoucherDetail> {
    const { data } = await this.client.POST('/stock-vouchers/{id}/return', {
      params: { path: { id: originVoucherId } },
      body: input,
    });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
