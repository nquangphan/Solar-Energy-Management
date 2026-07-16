// hand-authored — web catalog read port (Story 4.1, mirror Flutter
// mobile/lib/design_system/session/catalog_port.dart). The seam between the
// quote screen's pickers ("Chọn từ danh mục" / "Chọn gói vật tư") and the
// read-only `/products` + `/product-groups` endpoints (gated `catalog.view`).
//
// READ-ONLY on purpose: quote-building only picks from the catalogue; managing
// it is Story 3.1/3.6's screens behind `catalog.manage`. And there is NO
// `costPrice` anywhere in these shapes — the backend strips it for callers
// without `costs.view`, and the picker has no business rendering it anyway.

/** A pickable product — projection of the backend `ProductResponseDto` the picker needs. */
export interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  unit: string;
  /** Catalogue price — backend number, DISPLAY ONLY (the real line price is auto-filled server-side). */
  price: number;
  priceEditable: boolean;
  warrantyMonths: number | null;
  isActive: boolean;
}

/** A group row for the group list (`GET /product-groups`). */
export interface CatalogGroup {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

/**
 * One item on a group's checklist (`GET /product-groups/:id`). `isActive` is the
 * PRODUCT's flag — a product can be deactivated after joining a group, and the
 * picker must render that item disabled (Story 3.6 contract).
 */
export interface CatalogGroupItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
}

/** A group + its checklist, ordered by `displayOrder`. */
export interface CatalogGroupDetail extends CatalogGroup {
  items: CatalogGroupItem[];
}

/**
 * Injectable read-only transport for the quote pickers. A PORT, NOT an HTTP
 * client (see orders-port.ts).
 *
 * TODO(app-runtime): real impl calls `GET /products` / `GET /product-groups` /
 * `GET /product-groups/:id` with the bearer token. Until then `FakeCatalogPort`
 * drives the guards/demo.
 */
export interface CatalogPort {
  /** Active products, optionally filtered by a name/SKU search string. */
  listProducts(search?: string): Promise<CatalogProduct[]>;

  /** Active groups for the "Chọn gói vật tư" sheet. */
  listGroups(): Promise<CatalogGroup[]>;

  /** One group + its checklist (each item carries the product's `isActive`). */
  getGroup(id: string): Promise<CatalogGroupDetail>;
}
