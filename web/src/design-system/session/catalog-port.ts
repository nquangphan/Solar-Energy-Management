// hand-authored — web catalog read port (Story 4.1, mirror Flutter
// mobile/lib/design_system/session/catalog_port.dart). The seam between the
// quote screen's pickers ("Chọn từ danh mục" / "Chọn gói vật tư") and the
// read-only `/products` + `/product-groups` endpoints (gated `catalog.view`).
//
// READ-ONLY on purpose: quote-building only picks from the catalogue; managing
// it is Story 3.1/3.6's screens behind `catalog.manage`. And there is NO
// `costPrice` anywhere in these shapes — the backend strips it for callers
// without `costs.view`, and the picker has no business rendering it anyway.
//
// Every data type below is a projection (`Pick`) of the GENERATED contract type
// (AD-12) — the adapter builds each object field by field so `costPrice` never
// leaves it.

import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];

/**
 * A pickable product — projection of the backend `ProductResponseDto` the picker
 * needs. `price` is DISPLAY ONLY (the real line price is auto-filled server-side).
 */
export type CatalogProduct = Pick<
  Schemas['ProductResponseDto'],
  'id' | 'name' | 'sku' | 'unit' | 'price' | 'priceEditable' | 'warrantyMonths' | 'isActive'
>;

/** A group row for the group list (`GET /product-groups`). */
export type CatalogGroup = Pick<Schemas['ProductGroupResponseDto'], 'id' | 'name' | 'description' | 'isActive'>;

/**
 * One item on a group's checklist (`GET /product-groups/:id`). `isActive` is the
 * PRODUCT's flag — a product can be deactivated after joining a group, and the
 * picker must render that item disabled (Story 3.6 contract).
 */
export type CatalogGroupItem = Schemas['ProductGroupItemResponseDto'];

/** A group + its checklist, ordered by `displayOrder`. */
export type CatalogGroupDetail = Pick<
  Schemas['ProductGroupDetailResponseDto'],
  'id' | 'name' | 'description' | 'isActive' | 'items'
>;

/**
 * Injectable read-only transport for the quote pickers. A PORT, NOT an HTTP
 * client (see orders-port.ts). The real adapter is
 * `web/src/api/http-catalog-port.ts`; `FakeCatalogPort` drives the guards and demos.
 */
export interface CatalogPort {
  /** Active products, optionally filtered by a name/SKU search string. */
  listProducts(search?: string): Promise<CatalogProduct[]>;

  /** Active groups for the "Chọn gói vật tư" sheet. */
  listGroups(): Promise<CatalogGroup[]>;

  /** One group + its checklist (each item carries the product's `isActive`). */
  getGroup(id: string): Promise<CatalogGroupDetail>;
}
