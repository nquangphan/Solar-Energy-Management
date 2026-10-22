// hand-authored — mobile catalog read port (Story 4.1, mirror web
// web/src/design-system/session/catalog-port.ts). The seam between the quote
// screen's pickers ("Chọn từ danh mục" / "Chọn gói vật tư") and the read-only
// `/products` + `/product-groups` endpoints (gated `catalog.view`).
//
// READ-ONLY on purpose: quote-building only picks from the catalogue; managing
// it is Story 3.1/3.6's screens behind `catalog.manage`. And there is NO
// `costPrice` anywhere in these shapes — the backend strips it for callers
// without `costs.view`, and the picker has no business rendering it anyway.
//
// [CatalogProduct], [CatalogGroup] and [CatalogGroupDetail] are PROJECTIONS of
// the generated DTOs, not hand copies of them: Dart has no `Pick<>`, and these
// narrow classes are what keeps `costPrice` out of the picker state (the adapter
// builds them field by field). Every field must exist on the DTO it projects
// (design-system guard). [CatalogGroupItem] carries no cost, so it IS the DTO.

import '../../api/generated/models/product_group_item_response_dto.dart';

/// A pickable product — projection of the backend `ProductResponseDto` the picker needs.
class CatalogProduct {
  const CatalogProduct({
    required this.id,
    required this.name,
    required this.sku,
    required this.unit,
    required this.price,
    required this.priceEditable,
    this.warrantyMonths,
    required this.isActive,
  });

  final String id;
  final String name;
  final String sku;
  final String unit;

  /// Catalogue price — backend number, DISPLAY ONLY (the real line price is
  /// auto-filled server-side).
  final int price;
  final bool priceEditable;
  final int? warrantyMonths;
  final bool isActive;
}

/// A group row for the group list (`GET /product-groups`).
class CatalogGroup {
  const CatalogGroup({
    required this.id,
    required this.name,
    this.description,
    required this.isActive,
  });

  final String id;
  final String name;
  final String? description;
  final bool isActive;
}

/// One item on a group's checklist (`GET /product-groups/:id`) — the generated
/// `ProductGroupItemResponseDto`. `isActive` is the PRODUCT's flag — a product can
/// be deactivated after joining a group, and the picker must render that item
/// disabled (Story 3.6 contract).
typedef CatalogGroupItem = ProductGroupItemResponseDto;

/// A group + its checklist, ordered by `displayOrder`.
class CatalogGroupDetail extends CatalogGroup {
  const CatalogGroupDetail({
    required super.id,
    required super.name,
    super.description,
    required super.isActive,
    required this.items,
  });

  final List<CatalogGroupItem> items;
}

/// Injectable read-only transport for the quote pickers. A PORT, NOT an HTTP
/// client (see orders_port.dart). The real implementation is `HttpCatalogPort`
/// (lib/api/http_catalog_port.dart); [FakeCatalogPort] drives tests and demos.
abstract class CatalogPort {
  /// Active products, optionally filtered by a name/SKU search string.
  Future<List<CatalogProduct>> listProducts({String? search});

  /// Active groups for the "Chọn gói vật tư" sheet.
  Future<List<CatalogGroup>> listGroups();

  /// One group + its checklist (each item carries the product's `isActive`).
  Future<CatalogGroupDetail> getGroup(String id);
}
