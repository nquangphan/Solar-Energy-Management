// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/create_product_group_request_dto.dart';
import '../models/create_product_request_dto.dart';
import '../models/product_group_detail_response_dto.dart';
import '../models/product_group_response_dto.dart';
import '../models/product_price_response_dto.dart';
import '../models/product_response_dto.dart';
import '../models/replace_product_group_items_request_dto.dart';
import '../models/replace_product_prices_request_dto.dart';
import '../models/update_product_group_request_dto.dart';
import '../models/update_product_request_dto.dart';

part 'catalog_client.g.dart';

@RestApi()
abstract class CatalogClient {
  factory CatalogClient(Dio dio, {String? baseUrl}) = _CatalogClient;

  @POST('/products')
  Future<ProductResponseDto> productsControllerCreate({
    @Body() required CreateProductRequestDto body,
  });

  /// [includeInactive] - true = trả cả sản phẩm đã ẩn (soft-delete). Mặc định chỉ sản phẩm còn hiệu lực.
  @GET('/products')
  Future<List<ProductResponseDto>> productsControllerFindAll({
    @Query('includeInactive') bool? includeInactive,
  });

  @GET('/products/{id}')
  Future<ProductResponseDto> productsControllerFindOne({
    @Path('id') required String id,
  });

  @PATCH('/products/{id}')
  Future<ProductResponseDto> productsControllerUpdate({
    @Path('id') required String id,
    @Body() required UpdateProductRequestDto body,
  });

  @DELETE('/products/{id}')
  Future<void> productsControllerRemove({
    @Path('id') required String id,
  });

  @GET('/products/{productId}/prices')
  Future<List<ProductPriceResponseDto>> productPricesControllerFindByProduct({
    @Path('productId') required String productId,
  });

  @PUT('/products/{productId}/prices')
  Future<List<ProductPriceResponseDto>> productPricesControllerReplace({
    @Path('productId') required String productId,
    @Body() required ReplaceProductPricesRequestDto body,
  });

  /// [includeInactive] - true = trả cả gói đã rút khỏi picker. Mặc định chỉ gói còn hiệu lực.
  @GET('/product-groups')
  Future<List<ProductGroupResponseDto>> productGroupsControllerFindAll({
    @Query('includeInactive') bool? includeInactive,
  });

  @POST('/product-groups')
  Future<ProductGroupResponseDto> productGroupsControllerCreate({
    @Body() required CreateProductGroupRequestDto body,
  });

  /// [id] - Id gói vật tư.
  @POST('/product-groups/{id}/reactivate')
  Future<ProductGroupResponseDto> productGroupsControllerReactivate({
    @Path('id') required String id,
  });

  /// [id] - Id gói vật tư.
  @PUT('/product-groups/{id}/items')
  Future<ProductGroupDetailResponseDto> productGroupsControllerReplaceItems({
    @Path('id') required String id,
    @Body() required ReplaceProductGroupItemsRequestDto body,
  });

  /// [id] - Id gói vật tư.
  @GET('/product-groups/{id}')
  Future<ProductGroupDetailResponseDto> productGroupsControllerFindOne({
    @Path('id') required String id,
  });

  /// [id] - Id gói vật tư.
  @PATCH('/product-groups/{id}')
  Future<ProductGroupResponseDto> productGroupsControllerUpdate({
    @Path('id') required String id,
    @Body() required UpdateProductGroupRequestDto body,
  });

  /// [id] - Id gói vật tư.
  @DELETE('/product-groups/{id}')
  Future<void> productGroupsControllerRemove({
    @Path('id') required String id,
  });
}
