// An OrdersPort for the order cubit tests (Story 11.3): the in-memory
// FakeOrdersPort underneath, plus a log of every call in order with its
// arguments. A method named in [held] waits on a completer in [pending] until the
// test answers it — in any order, with a value (null ⇒ the fake's own answer) or
// an error. A method named in [errors] throws that error after it is logged; one
// named in [answers] returns that value instead of the fake's own answer (any
// value, for a method returning void).
import 'dart:async';
import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';

class RecordingOrdersPort extends FakeOrdersPort {
  RecordingOrdersPort({Set<String>? held, Map<String, Object>? errors, Map<String, Object>? answers})
      : held = held ?? <String>{},
        errors = errors ?? <String, Object>{},
        answers = answers ?? <String, Object>{};

  /// Methods whose answer waits on [pending]. Mutable mid-test.
  final Set<String> held;

  /// Method → what it throws. Mutable mid-test.
  final Map<String, Object> errors;

  /// Method → what it returns. Mutable mid-test.
  final Map<String, Object> answers;

  /// Method names in call order, e.g. `['get', 'getLifecycle', 'listVersions']`.
  final List<String> log = <String>[];

  /// The arguments of each call, parallel to [log].
  final List<List<Object?>> args = <List<Object?>>[];

  /// Method → the completers of its held calls, in call order.
  final Map<String, List<Completer<Object?>>> pending = <String, List<Completer<Object?>>>{};

  /// The arguments of every call to [method], in order.
  List<List<Object?>> argsOf(String method) => [
        for (var i = 0; i < log.length; i++)
          if (log[i] == method) args[i],
      ];

  /// The completer of the [n]-th held call to [method].
  Completer<Object?> pendingOf(String method, [int n = 0]) => pending[method]![n];

  Future<T> _call<T>(String method, List<Object?> callArgs, Future<T> Function() real) async {
    log.add(method);
    args.add(callArgs);
    if (held.contains(method)) {
      final Completer<Object?> reply = Completer<Object?>();
      (pending[method] ??= <Completer<Object?>>[]).add(reply);
      final Object? value = await reply.future;
      if (value != null) return value as T;
    }
    final Object? error = errors[method];
    if (error != null) throw error;
    if (answers.containsKey(method)) return answers[method] as T;
    return real();
  }

  @override
  Future<Order> create(CreateOrderInput input) => _call('create', [input], () => super.create(input));

  @override
  Future<Order> get(String id) => _call('get', [id], () => super.get(id));

  @override
  Future<OrderPage> list({String? status, bool? followUp, int? page, int? pageSize}) => _call(
        'list',
        [status, followUp, page, pageSize],
        () => super.list(status: status, followUp: followUp, page: page, pageSize: pageSize),
      );

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) =>
      _call('getLifecycle', [orderId], () => super.getLifecycle(orderId));

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) =>
      _call('listVersions', [orderId], () => super.listVersions(orderId));

  @override
  Future<OrderLine> addLine(String orderId, AddOrderLineInput input) =>
      _call('addLine', [orderId, input], () => super.addLine(orderId, input));

  @override
  Future<OrderLine> updateLine(String orderId, String lineId, UpdateOrderLineInput input) =>
      _call('updateLine', [orderId, lineId, input], () => super.updateLine(orderId, lineId, input));

  @override
  Future<void> removeLine(String orderId, String lineId) =>
      _call('removeLine', [orderId, lineId], () => super.removeLine(orderId, lineId));

  @override
  Future<Order> updateScopeFlags(String orderId, UpdateScopeFlagsInput input) =>
      _call('updateScopeFlags', [orderId, input], () => super.updateScopeFlags(orderId, input));

  @override
  Future<Order> updateOrderMeta(String orderId, UpdateOrderMetaInput input) =>
      _call('updateOrderMeta', [orderId, input], () => super.updateOrderMeta(orderId, input));

  @override
  Future<OrderTotals> previewTotal(PreviewTotalInput input) =>
      _call('previewTotal', [input], () => super.previewTotal(input));

  @override
  Future<Order> confirmOrder(String orderId) => _call('confirmOrder', [orderId], () => super.confirmOrder(orderId));

  @override
  Future<Order> reviseOrder(String orderId) => _call('reviseOrder', [orderId], () => super.reviseOrder(orderId));

  @override
  Future<Order> applyDiscount(String orderId, ApplyDiscountInput input) =>
      _call('applyDiscount', [orderId, input], () => super.applyDiscount(orderId, input));

  @override
  Future<Order> resolveDiscount(String orderId, ResolveDiscountInput input) =>
      _call('resolveDiscount', [orderId, input], () => super.resolveDiscount(orderId, input));

  @override
  Future<List<DiscountPendingItem>> listPendingDiscounts() =>
      _call('listPendingDiscounts', [], () => super.listPendingDiscounts());

  @override
  Future<QuoteExportFiles> exportQuote(String orderId) => _call('exportQuote', [orderId], () => super.exportQuote(orderId));

  @override
  Future<StatusChangeResult> transition(String orderId, String event, List<XFile> files) =>
      _call('transition', [orderId, event, files], () => super.transition(orderId, event, files));

  @override
  Future<void> cancel(String orderId, String reason) =>
      _call('cancel', [orderId, reason], () => super.cancel(orderId, reason));

  @override
  Future<List<AttachmentItem>> listAttachments(String orderId) =>
      _call('listAttachments', [orderId], () => super.listAttachments(orderId));

  @override
  Future<void> addAttachments(String orderId, List<XFile> files) =>
      _call('addAttachments', [orderId, files], () => super.addAttachments(orderId, files));

  @override
  Future<void> removeAttachment(String orderId, String attachmentId) =>
      _call('removeAttachment', [orderId, attachmentId], () => super.removeAttachment(orderId, attachmentId));

  @override
  Future<Uint8List> attachmentBytes(String orderId, String attachmentId) =>
      _call('attachmentBytes', [orderId, attachmentId], () => super.attachmentBytes(orderId, attachmentId));

  @override
  Future<OrderStockIssueView> getStockIssue(String orderId) =>
      _call('getStockIssue', [orderId], () => super.getStockIssue(orderId));

  @override
  Future<OrderStockIssueResult> issueStock(String orderId) => _call('issueStock', [orderId], () => super.issueStock(orderId));

  @override
  Future<OrderStockCheck> getStockCheck(String orderId) =>
      _call('getStockCheck', [orderId], () => super.getStockCheck(orderId));
}
