// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/create_customer_request_dto.dart';
import '../models/create_customer_source_request_dto.dart';
import '../models/cust_type.dart';
import '../models/customer_list_response_dto.dart';
import '../models/customer_lookup_response_dto.dart';
import '../models/customer_response_dto.dart';
import '../models/customer_source_response_dto.dart';
import '../models/update_customer_request_dto.dart';
import '../models/update_customer_source_request_dto.dart';

part 'customers_client.g.dart';

@RestApi()
abstract class CustomersClient {
  factory CustomersClient(Dio dio, {String? baseUrl}) = _CustomersClient;

  @POST('/customers')
  Future<CustomerResponseDto> customersControllerCreate({
    @Body() required CreateCustomerRequestDto body,
  });

  /// [q] - Tìm theo TÊN hoặc SĐT. SĐT gõ ở dạng người dùng quen (`0903`) — backend tự dựng chuỗi tra tương ứng với PK E.164.
  ///
  /// [custType] - Lọc theo loại khách. Bỏ trống ⇒ lấy cả hai loại.
  ///
  /// [page] - Trang, bắt đầu từ 1.
  ///
  /// [pageSize] - Số bản ghi mỗi trang — tối đa 100.
  @GET('/customers')
  Future<CustomerListResponseDto> customersControllerList({
    @Query('page') num? page = 1,
    @Query('pageSize') num? pageSize = 20,
    @Query('q') String? q,
    @Query('custType') CustType? custType,
  });

  /// [phone] - SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.
  @GET('/customers/lookup')
  Future<CustomerLookupResponseDto> customersControllerLookup({
    @Query('phone') required String phone,
  });

  /// [phone] - SĐT — thô hay E.164 đều được; backend chuẩn hoá trước khi tra (AD-9).
  @GET('/customers/{phone}')
  Future<CustomerResponseDto> customersControllerFindOne({
    @Path('phone') required String phone,
  });

  @PATCH('/customers/{phone}')
  Future<CustomerResponseDto> customersControllerUpdate({
    @Path('phone') required String phone,
    @Body() required UpdateCustomerRequestDto body,
  });

  /// [includeInactive] - true = trả cả nguồn đã ngừng dùng. Mặc định chỉ nguồn còn hiệu lực (dropdown khách mới).
  @GET('/customer-sources')
  Future<List<CustomerSourceResponseDto>> customerSourcesControllerFindAll({
    @Query('includeInactive') bool? includeInactive,
  });

  @POST('/customer-sources')
  Future<CustomerSourceResponseDto> customerSourcesControllerCreate({
    @Body() required CreateCustomerSourceRequestDto body,
  });

  /// [id] - Id nguồn khách.
  @PATCH('/customer-sources/{id}')
  Future<CustomerSourceResponseDto> customerSourcesControllerUpdate({
    @Path('id') required String id,
    @Body() required UpdateCustomerSourceRequestDto body,
  });

  /// [id] - Id nguồn khách.
  @DELETE('/customer-sources/{id}')
  Future<void> customerSourcesControllerDeactivate({
    @Path('id') required String id,
  });

  /// [id] - Id nguồn khách.
  @POST('/customer-sources/{id}/reactivate')
  Future<CustomerSourceResponseDto> customerSourcesControllerReactivate({
    @Path('id') required String id,
  });
}
