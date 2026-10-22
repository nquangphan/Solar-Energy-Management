// hand-authored — the real OrdersPort over the generated client (Story 10.8,
// mirror web/src/api/http-orders-port.ts).
//
// Three things the generated client does not do on its own:
//   - PATCH/POST bodies go through sparse_bodies.dart: a generated body writes
//     every key, and an explicit null clears kWp/warranty or is a 400;
//   - photos are uploaded as byte parts built by the transport. The backend accepts
//     a photo by the content type declared on its part: the picker's MIME type when
//     it reports one (a content URI may have no extension), else the transport's
//     part infers it from the file extension (`a.jpg` ⇒ image/jpeg);
//   - downloads arrive as `Stream<Uint8List>` without headers: the bytes are
//     gathered inside `transport.call`, and the quote's file names come from the
//     export metadata.
//
// Screens read a backend rejection off OrderPortException (`code` drives the
// "order not found" state), so every ApiError is converted in [_call].
import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

import '../design_system/session/orders_port.dart';
import 'api_error.dart';
import 'bytes.dart';
import 'generated/models/cancel_order_request_dto.dart';
import 'generated/models/enum0.dart';
import 'generated/models/status.dart';
import 'generated/orders/orders_client.dart';
import 'generated/pns_api_client.dart';
import 'sparse_bodies.dart';
import 'transport.dart';

/// The routes' `@ApiProduces` types.
const String _kQuoteImageType = 'image/png';
const String _kQuotePdfType = 'application/pdf';

/// One upload part per photo, built by [part] (the transport) — typed by the
/// caller, so this file never names a `package:dio` type.
Future<List<P>> _photoParts<P>(
  List<XFile> files,
  P Function(Uint8List bytes, {required String fileName, String? contentType}) part,
) async => [for (final file in files) part(await file.readAsBytes(), fileName: file.name, contentType: file.mimeType)];

/// An id as ONE path segment (the generated client interpolates it raw).
String _seg(String id) => Uri.encodeComponent(id);

class HttpOrdersPort implements OrdersPort {
  HttpOrdersPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  OrdersClient get _orders => _client.orders;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await _transport.call(request);
    } on ApiError catch (e) {
      throw OrderPortException(e.message, code: e.code, fieldErrors: fieldErrorMap(e));
    }
  }

  @override
  Future<Order> create(CreateOrderInput input) => _call(() => _orders.ordersControllerCreate(body: input));

  @override
  Future<Order> get(String id) => _call(() => _orders.ordersControllerFindOne(id: _seg(id)));

  @override
  Future<OrderPage> list({String? status, bool? followUp, int? page, int? pageSize}) => _call(
    () => _orders.ordersControllerList(
      status: status == null ? null : Status.fromJson(status),
      followUp: followUp,
      page: page,
      pageSize: pageSize,
    ),
  );

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) =>
      _call(() => _orders.ordersControllerLifecycle(id: _seg(orderId)));

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      (await _call(() => _orders.ordersControllerListVersions(id: _seg(orderId)))).items;

  @override
  Future<OrderLine> addLine(String orderId, AddOrderLineInput input) =>
      _call(() => _orders.ordersControllerAddLine(id: _seg(orderId), body: addLineBody(input)));

  @override
  Future<OrderLine> updateLine(String orderId, String lineId, UpdateOrderLineInput input) => _call(
    () => _orders.ordersControllerUpdateLine(id: _seg(orderId), lineId: _seg(lineId), body: lineUpdateBody(input)),
  );

  @override
  Future<void> removeLine(String orderId, String lineId) =>
      _call(() => _orders.ordersControllerRemoveLine(id: _seg(orderId), lineId: _seg(lineId)));

  @override
  Future<Order> updateScopeFlags(String orderId, UpdateScopeFlagsInput input) =>
      _call(() => _orders.ordersControllerUpdate(id: _seg(orderId), body: scopeFlagsBody(input)));

  @override
  Future<Order> updateOrderMeta(String orderId, UpdateOrderMetaInput input) =>
      _call(() => _orders.ordersControllerUpdate(id: _seg(orderId), body: orderMetaBody(input)));

  @override
  Future<OrderTotals> previewTotal(PreviewTotalInput input) =>
      _call(() => _orders.ordersControllerPreviewTotal(body: previewTotalBody(input)));

  @override
  Future<Order> confirmOrder(String orderId) => _call(() => _orders.ordersControllerConfirm(id: _seg(orderId)));

  @override
  Future<Order> reviseOrder(String orderId) => _call(() => _orders.ordersControllerRevise(id: _seg(orderId)));

  @override
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input) =>
      _call(() => _orders.ordersControllerApplyDiscount(id: _seg(orderId), body: input));

  @override
  Future<Order> resolveDiscount(String orderId, ResolveDiscountInput input) =>
      _call(() => _orders.ordersControllerResolveDiscount(id: _seg(orderId), body: input));

  @override
  Future<List<DiscountPendingItem>> listPendingDiscounts() =>
      _call(() => _orders.ordersControllerListPendingDiscounts());

  /// Export, then fetch the image, then the PDF — the order the web uses; names
  /// from the export metadata (a stream download carries no header to read).
  @override
  Future<QuoteExportFiles> exportQuote(String orderId) async {
    final id = _seg(orderId);
    final exported = await _call(() => _orders.ordersControllerExportQuote(id: id));
    final image = await _call(() => collectBytes(_orders.ordersControllerDownloadQuoteImage(id: id)));
    final pdf = await _call(() => collectBytes(_orders.ordersControllerDownloadQuotePdf(id: id)));
    return QuoteExportFiles(
      image: QuoteExportFile(fileName: exported.image.fileName, mimeType: _kQuoteImageType, bytes: image),
      pdf: QuoteExportFile(fileName: exported.pdf.fileName, mimeType: _kQuotePdfType, bytes: pdf),
    );
  }

  @override
  Future<StatusChangeResult> transition(String orderId, String event, List<XFile> files) async {
    // No photo ⇒ no `files` part at all, not an empty one (FR-23).
    final parts = files.isEmpty ? null : await _photoParts(files, _transport.uploadPart);
    return _call(
      () => _orders.ordersControllerTransition(id: _seg(orderId), event: Enum0.fromJson(event), files: parts),
    );
  }

  @override
  Future<void> cancel(String orderId, String reason) => _call(
    () => _orders.ordersControllerCancel(
      id: _seg(orderId),
      body: CancelOrderRequestDto(reason: reason),
    ),
  );

  @override
  Future<List<AttachmentItem>> listAttachments(String orderId) async =>
      (await _call(() => _orders.ordersControllerListAttachments(id: _seg(orderId)))).items;

  @override
  Future<void> addAttachments(String orderId, List<XFile> files) async {
    final parts = await _photoParts(files, _transport.uploadPart);
    await _call(() => _orders.ordersControllerAddAttachments(id: _seg(orderId), files: parts));
  }

  @override
  Future<void> removeAttachment(String orderId, String attachmentId) =>
      _call(() => _orders.ordersControllerRemoveAttachment(id: _seg(orderId), attachmentId: _seg(attachmentId)));

  @override
  Future<Uint8List> attachmentBytes(String orderId, String attachmentId) => _call(
    () => collectBytes(_orders.ordersControllerDownloadAttachment(id: _seg(orderId), attachmentId: _seg(attachmentId))),
  );

  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) =>
      _call(() => _orders.ordersControllerGetStockIssue(id: _seg(orderId)));

  @override
  Future<OrderStockIssueResult> issueStock(String orderId) =>
      _call(() => _orders.ordersControllerIssueStock(id: _seg(orderId)));

  @override
  Future<OrderStockCheck> getStockCheck(String orderId) =>
      _call(() => _orders.ordersControllerGetStockCheck(id: _seg(orderId)));
}
