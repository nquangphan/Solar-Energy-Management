// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/add_line_item_request_dto.dart';
import '../models/apply_discount_request_dto.dart';
import '../models/attachment_list_response_dto.dart';
import '../models/attachment_upload_response_dto.dart';
import '../models/cancel_order_request_dto.dart';
import '../models/cancel_order_response_dto.dart';
import '../models/create_order_request_dto.dart';
import '../models/discount_pending_item_dto.dart';
import '../models/enum0.dart';
import '../models/order_lifecycle_response_dto.dart';
import '../models/order_line_item_response_dto.dart';
import '../models/order_list_response_dto.dart';
import '../models/order_response_dto.dart';
import '../models/order_stock_check_dto.dart';
import '../models/order_stock_issue_result_dto.dart';
import '../models/order_stock_issue_view_dto.dart';
import '../models/order_versions_response_dto.dart';
import '../models/preview_total_request_dto.dart';
import '../models/preview_total_response_dto.dart';
import '../models/quote_export_response_dto.dart';
import '../models/resolve_discount_request_dto.dart';
import '../models/status.dart';
import '../models/status_change_response_dto.dart';
import '../models/update_line_item_request_dto.dart';
import '../models/update_order_request_dto.dart';
import '../models/warranty_lookup_response_dto.dart';

part 'orders_client.g.dart';

@RestApi()
abstract class OrdersClient {
  factory OrdersClient(Dio dio, {String? baseUrl}) = _OrdersClient;

  @POST('/orders')
  Future<OrderResponseDto> ordersControllerCreate({
    @Body() required CreateOrderRequestDto body,
  });

  /// [status] - Lọc theo trạng thái đơn. Bỏ trống ⇒ lấy mọi trạng thái.
  ///
  /// [followUp] - Chỉ lấy đơn CHƯA CHỐT để follow-up (trạng thái 'baogia', FR-10). Không dùng chung với `status`.
  ///
  /// [page] - Trang, bắt đầu từ 1.
  ///
  /// [pageSize] - Số bản ghi mỗi trang — tối đa 100.
  @GET('/orders')
  Future<OrderListResponseDto> ordersControllerList({
    @Query('page') num? page = 1,
    @Query('pageSize') num? pageSize = 20,
    @Query('status') Status? status,
    @Query('followUp') bool? followUp,
  });

  @POST('/orders/preview-total')
  Future<PreviewTotalResponseDto> ordersControllerPreviewTotal({
    @Body() required PreviewTotalRequestDto body,
  });

  @GET('/orders/pending-discount-approvals')
  Future<List<DiscountPendingItemDto>> ordersControllerListPendingDiscounts();

  /// [phone] - SĐT dạng THÔ — backend chuẩn hoá về E.164 rồi mới tra.
  @GET('/orders/warranty-lookup')
  Future<WarrantyLookupResponseDto> ordersControllerWarrantyLookup({
    @Query('phone') required String phone,
  });

  @GET('/orders/{id}')
  Future<OrderResponseDto> ordersControllerFindOne({
    @Path('id') required String id,
  });

  @PATCH('/orders/{id}')
  Future<OrderResponseDto> ordersControllerUpdate({
    @Path('id') required String id,
    @Body() required UpdateOrderRequestDto body,
  });

  @GET('/orders/{id}/lifecycle')
  Future<OrderLifecycleResponseDto> ordersControllerLifecycle({
    @Path('id') required String id,
  });

  @GET('/orders/{id}/versions')
  Future<OrderVersionsResponseDto> ordersControllerListVersions({
    @Path('id') required String id,
  });

  @POST('/orders/{id}/confirm')
  Future<OrderResponseDto> ordersControllerConfirm({
    @Path('id') required String id,
  });

  @POST('/orders/{id}/reopen')
  Future<OrderResponseDto> ordersControllerRevise({
    @Path('id') required String id,
  });

  @POST('/orders/{id}/apply-discount')
  Future<OrderResponseDto> ordersControllerApplyDiscount({
    @Path('id') required String id,
    @Body() required ApplyDiscountRequestDto body,
  });

  @POST('/orders/{id}/resolve-discount')
  Future<OrderResponseDto> ordersControllerResolveDiscount({
    @Path('id') required String id,
    @Body() required ResolveDiscountRequestDto body,
  });

  @POST('/orders/{id}/line-items')
  Future<OrderLineItemResponseDto> ordersControllerAddLine({
    @Path('id') required String id,
    @Body() required AddLineItemRequestDto body,
  });

  @PATCH('/orders/{id}/line-items/{lineId}')
  Future<OrderLineItemResponseDto> ordersControllerUpdateLine({
    @Path('id') required String id,
    @Path('lineId') required String lineId,
    @Body() required UpdateLineItemRequestDto body,
  });

  @DELETE('/orders/{id}/line-items/{lineId}')
  Future<void> ordersControllerRemoveLine({
    @Path('id') required String id,
    @Path('lineId') required String lineId,
  });

  @POST('/orders/{id}/export-quote')
  Future<QuoteExportResponseDto> ordersControllerExportQuote({
    @Path('id') required String id,
  });

  @GET('/orders/{id}/quote/image')
  @DioResponseType(ResponseType.stream)
  Stream<Uint8List> ordersControllerDownloadQuoteImage({
    @Path('id') required String id,
  });

  @GET('/orders/{id}/quote/pdf')
  @DioResponseType(ResponseType.stream)
  Stream<Uint8List> ordersControllerDownloadQuotePdf({
    @Path('id') required String id,
  });

  /// [event] - Sự kiện chuyển trạng thái. CHỈ năm sự kiện của lane thủ công — `chot`/`mo_lai`/`huy`/`du_coc`/`ap_chiet_khau` có cửa riêng mang theo logic riêng và bị từ chối 409 ở đây.
  /// Name not received and was auto-generated.
  ///
  /// [files] - Ảnh bằng chứng của bước (JPEG/PNG/WebP) — optional; ngưỡng số ảnh/kích thước do backend kiểm.
  @MultiPart()
  @POST('/orders/{id}/transition')
  Future<StatusChangeResponseDto> ordersControllerTransition({
    @Path('id') required String id,
    @Part(name: 'event') required Enum0 event,
    @Part(name: 'files') List<MultipartFile>? files,
  });

  @POST('/orders/{id}/cancel')
  Future<CancelOrderResponseDto> ordersControllerCancel({
    @Path('id') required String id,
    @Body() required CancelOrderRequestDto body,
  });

  @GET('/orders/{id}/stock-issue')
  Future<OrderStockIssueViewDto> ordersControllerGetStockIssue({
    @Path('id') required String id,
  });

  @POST('/orders/{id}/stock-issue')
  Future<OrderStockIssueResultDto> ordersControllerIssueStock({
    @Path('id') required String id,
  });

  @GET('/orders/{id}/stock-check')
  Future<OrderStockCheckDto> ordersControllerGetStockCheck({
    @Path('id') required String id,
  });

  @GET('/orders/{id}/attachments')
  Future<AttachmentListResponseDto> ordersControllerListAttachments({
    @Path('id') required String id,
  });

  /// [files] - Ảnh bổ sung (JPEG/PNG/WebP). Thiếu hoặc rỗng ⇒ 400; ngưỡng số ảnh/kích thước do backend kiểm.
  @MultiPart()
  @POST('/orders/{id}/attachments')
  Future<AttachmentUploadResponseDto> ordersControllerAddAttachments({
    @Path('id') required String id,
    @Part(name: 'files') required List<MultipartFile> files,
  });

  @DELETE('/orders/{id}/attachments/{attachmentId}')
  Future<void> ordersControllerRemoveAttachment({
    @Path('id') required String id,
    @Path('attachmentId') required String attachmentId,
  });

  @GET('/orders/{id}/attachments/{attachmentId}')
  @DioResponseType(ResponseType.stream)
  Stream<Uint8List> ordersControllerDownloadAttachment({
    @Path('id') required String id,
    @Path('attachmentId') required String attachmentId,
  });
}
