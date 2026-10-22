// hand-authored — the real InventoryPort over the generated client (Story 10.5).
import type {
  InventoryPort,
  StockList,
  StockListQuery,
} from '../design-system/session/inventory-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpInventoryPort implements InventoryPort {
  constructor(private readonly client: ApiClient) {}

  async listStock(query: StockListQuery = {}): Promise<StockList> {
    const { data } = await this.client.GET('/stock-items', { params: { query } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data;
  }
}
