// hand-authored — the real CatalogPort over the generated client (Story 10.4).
//
// Every result is built field by field: `ProductResponseDto` carries `costPrice`
// for callers with `costs.view`, and the picker state must never hold it.
import type {
  CatalogGroup,
  CatalogGroupDetail,
  CatalogPort,
  CatalogProduct,
} from '../design-system/session/catalog-port';

import { ApiError, GENERIC_ERROR_MESSAGE } from './api-error';
import type { ApiClient } from './client';

export class HttpCatalogPort implements CatalogPort {
  constructor(private readonly client: ApiClient) {}

  async listProducts(search?: string): Promise<CatalogProduct[]> {
    const { data } = await this.client.GET('/products');
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    const products = data.map(
      (p): CatalogProduct => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        price: p.price,
        priceEditable: p.priceEditable,
        warrantyMonths: p.warrantyMonths ?? null,
        isActive: p.isActive,
      }),
    );
    // `GET /products` has no search parameter: narrow the returned list for display,
    // the same name/SKU match the fake port does. A catalogue of a few hundred rows.
    const needle = search?.trim().toLowerCase() ?? '';
    if (needle === '') return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle),
    );
  }

  async listGroups(): Promise<CatalogGroup[]> {
    const { data } = await this.client.GET('/product-groups');
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return data.map((g) => ({ id: g.id, name: g.name, description: g.description, isActive: g.isActive }));
  }

  async getGroup(id: string): Promise<CatalogGroupDetail> {
    const { data } = await this.client.GET('/product-groups/{id}', { params: { path: { id } } });
    if (!data) throw new ApiError(GENERIC_ERROR_MESSAGE);
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      items: data.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        price: item.price,
        isActive: item.isActive,
        displayOrder: item.displayOrder,
      })),
    };
  }
}
