// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/create_return_voucher_request_dto.dart';
import '../models/create_stock_voucher_request_dto.dart';
import '../models/stock_list_response_dto.dart';
import '../models/stock_voucher_detail_dto.dart';
import '../models/stock_voucher_list_response_dto.dart';
import '../models/type.dart';

part 'inventory_client.g.dart';

@RestApi()
abstract class InventoryClient {
  factory InventoryClient(Dio dio, {String? baseUrl}) = _InventoryClient;

  /// [q] - Tìm theo TÊN hoặc SKU (chứa chuỗi, không phân biệt hoa thường).
  ///
  /// [productIds] - Chỉ lấy các sản phẩm này — danh sách UUID ngăn cách bằng dấu phẩy.
  @GET('/stock-items')
  Future<StockListResponseDto> stockItemsControllerList({
    @Query('q') String? q,
    @Query('productIds') String? productIds,
  });

  @POST('/stock-vouchers')
  Future<StockVoucherDetailDto> stockVouchersControllerCreate({
    @Body() required CreateStockVoucherRequestDto body,
  });

  /// [isReturn] - true ⇒ chỉ phiếu nhập trả; false ⇒ không có phiếu nhập trả; vắng ⇒ mọi phiếu.
  @GET('/stock-vouchers')
  Future<StockVoucherListResponseDto> stockVouchersControllerList({
    @Query('type') Type? type,
    @Query('isReturn') bool? isReturn,
  });

  @POST('/stock-vouchers/{id}/return')
  Future<StockVoucherDetailDto> stockVouchersControllerCreateReturn({
    @Path('id') required String id,
    @Body() required CreateReturnVoucherRequestDto body,
  });

  @GET('/stock-vouchers/{id}')
  Future<StockVoucherDetailDto> stockVouchersControllerFindOne({
    @Path('id') required String id,
  });
}
