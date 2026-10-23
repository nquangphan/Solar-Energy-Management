// CreateQuoteCubit (Story 11.3): the cart, totals, stock hint, metadata and the
// confirm/reopen/discount/share actions CreateQuoteScreen used to hold in its State.
import 'dart:convert';
import 'dart:typed_data';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pns_mobile/design_system/components/share_button.dart';
import 'package:pns_mobile/design_system/session/catalog_port.dart';
import 'package:pns_mobile/design_system/session/customers_port.dart';
import 'package:pns_mobile/design_system/session/fake_catalog_port.dart';
import 'package:pns_mobile/design_system/session/fake_customers_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/create_quote_cubit.dart';
import 'package:pns_mobile/screens/orders/create_quote_state.dart';

import 'recording_orders_port.dart';

final Customer _customer = kDemoCustomers.first;

/// The calls one re-read of the cart makes, in order.
const List<String> _reread = ['get', 'getStockCheck', 'previewTotal'];

/// [order] with [patch] applied, through its JSON (generated DTOs have no copyWith).
Order _with(Order order, Map<String, Object?> patch) =>
    Order.fromJson(jsonDecode(jsonEncode({...order.toJson(), ...patch})) as Map<String, Object?>);

Map<String, Object?> _discount(String status) =>
    {'amount': 500000, 'status': status, 'requestedAt': '2026-10-23T00:00:00.000Z'};

OrderTotals _totals(int total) =>
    OrderTotals(subtotal: total, discountAmount: 0, vatAmount: 0, total: total, vatRate: 8, applyVat: true);

OrderStockCheck _stock(String productId) => OrderStockCheck(lines: [
      OrderStockCheckLine(
        productId: productId,
        name: 'x',
        unit: 'x',
        qty: 1,
        onHand: 1,
        reserved: 0,
        available: 1,
        shortfall: 0,
        status: OrderStockCheckLineDtoStatus.enough,
      ),
    ]);

CreateQuoteCubit _cubit(RecordingOrdersPort port, {CatalogPort? catalog}) =>
    CreateQuoteCubit(ordersPort: port, catalogPort: catalog ?? FakeCatalogPort());

/// A cubit past step 1 with one catalogue line, and a clean log.
Future<CreateQuoteCubit> _withCart(RecordingOrdersPort port, {CatalogPort? catalog}) async {
  final cubit = _cubit(port, catalog: catalog);
  await cubit.createOrder(_customer);
  await cubit.addCatalogLine('prod-pin-580', 2);
  await pumpEventQueue();
  port.log.clear();
  port.args.clear();
  return cubit;
}

class _FailingCatalog implements CatalogPort {
  final List<String?> searches = [];

  @override
  Future<List<CatalogProduct>> listProducts({String? search}) async {
    searches.add(search);
    throw StateError('offline');
  }

  @override
  Future<List<CatalogGroup>> listGroups() async => throw const OrderPortException('Không đọc được gói.');

  @override
  Future<CatalogGroupDetail> getGroup(String id) async => throw StateError('offline');
}

const OrderPortException _refused = OrderPortException(
  'Đơn không còn ở Báo giá.',
  code: 'CONFLICT',
  fieldErrors: {'qty': 'Số lượng phải ≥ 1.'},
);

void main() {
  test('starts at step 1: no order, no totals, nothing busy', () {
    final cubit = _cubit(RecordingOrdersPort());
    expect(cubit.state, const CreateQuoteState());
    cubit.close();
  });

  group('step 1', () {
    test('createOrder sends the picked phone RAW, then reads the stock hint and the totals', () async {
      final port = RecordingOrdersPort();
      final cubit = _cubit(port);
      await cubit.createOrder(_customer);
      await pumpEventQueue();
      expect(port.log, ['create', 'getStockCheck', 'previewTotal']);
      expect((port.argsOf('create').single.single! as CreateOrderInput).customerPhone, _customer.phone);
      final CreateQuoteState s = cubit.state;
      expect(s.customer, same(_customer));
      expect(s.order, isNotNull);
      expect(s.totals, isNotNull);
      expect(s.stockCheck, isNotNull);
      expect(s.metaSyncSeq, 1);
      expect(s.metaSyncFrom, same(s.order));
      await cubit.close();
    });

    test('createOrder refused ⇒ the backend sentence, still step 1', () async {
      final cubit = _cubit(RecordingOrdersPort(errors: {'create': _refused}));
      await cubit.createOrder(_customer);
      expect(cubit.state.order, isNull);
      expect(cubit.state.error, _refused.message);
      expect(cubit.state.fieldErrors, _refused.fieldErrors);
      await cubit.close();
    });

    test('a failure that is not the backend ⇒ the screen sentence, no field errors', () async {
      final cubit = _cubit(RecordingOrdersPort(errors: {'create': StateError('offline')}));
      await cubit.createOrder(_customer);
      expect(cubit.state.error, 'Không thực hiện được. Thử lại.');
      expect(cubit.state.fieldErrors, isEmpty);
      await cubit.close();
    });
  });

  group('every line mutation re-reads the cart, then the stock hint, then the totals', () {
    final cases = <(String, String, Future<void> Function(CreateQuoteCubit, String))>[
      ('addCatalogLine', 'addLine', (c, _) => c.addCatalogLine('prod-pin-580', 1)),
      ('updateQty', 'updateLine', (c, id) => c.updateQty(id, 3)),
      ('updateUnitPrice', 'updateLine', (c, id) => c.updateUnitPrice(id, 2000000)),
      ('updateWarranty', 'updateLine', (c, id) => c.updateWarranty(id, 12)),
      ('removeLine', 'removeLine', (c, id) => c.removeLine(id)),
    ];
    for (final (String method, String call, Future<void> Function(CreateQuoteCubit, String) act) in cases) {
      test(method, () async {
        final port = RecordingOrdersPort();
        final cubit = await _withCart(port);
        await act(cubit, cubit.state.order!.lineItems.single.id);
        await pumpEventQueue();
        expect(port.log, [call, ..._reread]);
        await cubit.close();
      });
    }

    test('updateQty below 1 and updateUnitPrice below 0 send nothing', () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      final String id = cubit.state.order!.lineItems.single.id;
      await cubit.updateQty(id, 0);
      await cubit.updateUnitPrice(id, -1);
      expect(port.log, isEmpty);
      await cubit.close();
    });

    test('updateQty, updateUnitPrice and updateWarranty send only their own field', () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      final String id = cubit.state.order!.lineItems.single.id;
      await cubit.updateQty(id, 3);
      await cubit.updateUnitPrice(id, 2000000);
      await cubit.updateWarranty(id, null);
      final inputs = [for (final a in port.argsOf('updateLine')) a[2]! as UpdateOrderLineInput];
      expect([for (final i in inputs) (i.qty, i.unitPrice, i.hasWarrantyMonths, i.warrantyMonths)], [
        (3, null, false, null),
        (null, 2000000, false, null),
        (null, null, true, null),
      ]);
      await cubit.close();
    });

    test('addCatalogLine answers the new line id; refused ⇒ null, the cart kept', () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      final String? id = await cubit.addCatalogLine('prod-pin-580', 1);
      expect(cubit.state.order!.lineItems.map((l) => l.id), contains(id));
      final Order before = cubit.state.order!;
      port.errors['addLine'] = _refused;
      expect(await cubit.addCatalogLine('prod-pin-580', 1), isNull);
      expect(cubit.state.order, same(before));
      expect(cubit.state.error, _refused.message);
      await cubit.close();
    });

    test('a refused mutation keeps the order and shows the message; refresh clears it', () async {
      final port = RecordingOrdersPort(errors: {'updateLine': _refused});
      final cubit = await _withCart(port);
      final Order before = cubit.state.order!;
      await cubit.updateQty(before.lineItems.single.id, 4);
      expect(cubit.state.order, same(before));
      expect(cubit.state.error, _refused.message);
      await cubit.refresh();
      await pumpEventQueue();
      expect(cubit.state.error, isNull);
      expect(port.log.skip(1), _reread);
      await cubit.close();
    });
  });

  test('toggleScope replaces the order and previews NOTHING — the flags carry no money', () async {
    final port = RecordingOrdersPort();
    final cubit = await _withCart(port);
    final states = <CreateQuoteState>[];
    final sub = cubit.stream.listen(states.add);
    await cubit.toggleScope(const UpdateScopeFlagsInput(scopeConstruction: false));
    await pumpEventQueue();
    expect(port.log, ['updateScopeFlags']);
    expect(cubit.state.order!.scopeConstruction, isFalse);
    expect(states.map((s) => s.scopeBusy), [true, true, false]);
    await sub.cancel();
    await cubit.close();
  });

  group('the preview echoes the displayed lines, the VAT tick and the discount IN EFFECT', () {
    test('lines and vatMode', () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      await cubit.updateMeta(const UpdateOrderMetaInput(vatMode: 'khong_vat'));
      await pumpEventQueue();
      final PreviewTotalInput input = port.argsOf('previewTotal').single.single! as PreviewTotalInput;
      final OrderLine line = cubit.state.order!.lineItems.single;
      expect([for (final l in input.lines) (l.unitPrice, l.qty)], [(line.unitPrice, line.qty)]);
      expect(input.vatMode, PreviewTotalRequestDtoVatMode.khongVat);
      expect(input.discountAmount, isNull);
      await cubit.close();
    });

    for (final (String status, String discount, bool echoed) in [
      ('baogia', 'cho_duyet', false),
      ('choduyet', 'cho_duyet', true),
      ('choduyet', 'dong_y', true),
      ('dachot', 'dong_y', true),
      ('choduyet', 'tu_choi', false),
      ('dachot', 'tu_choi', false),
    ]) {
      test('order $status with a $discount discount ⇒ ${echoed ? 'echoed' : 'not echoed'}', () async {
        final port = RecordingOrdersPort();
        final cubit = await _withCart(port);
        port.answers['get'] = _with(cubit.state.order!, {'status': status, 'discount': _discount(discount)});
        await cubit.refresh();
        await pumpEventQueue();
        final PreviewTotalInput input = port.argsOf('previewTotal').single.single! as PreviewTotalInput;
        expect(input.discountAmount, echoed ? 500000 : isNull);
        await cubit.close();
      });
    }
  });

  group('answers arriving out of order — only the newest is shown', () {
    for (final (outcome, Object? lateError) in [('answers', null), ('fails', StateError('offline'))]) {
      test('the totals: the first preview $outcome AFTER the second', () async {
        final port = RecordingOrdersPort();
        final cubit = await _withCart(port);
        port.held.add('previewTotal');
        final String id = cubit.state.order!.lineItems.single.id;
        final first = cubit.updateQty(id, 3);
        await pumpEventQueue();
        final second = cubit.updateQty(id, 4);
        await pumpEventQueue();
        final OrderTotals newest = _totals(2);
        port.pendingOf('previewTotal', 1).complete(newest);
        await second;
        expect(cubit.state.totals, same(newest));

        final reply = port.pendingOf('previewTotal');
        lateError == null ? reply.complete(_totals(1)) : reply.completeError(lateError);
        await first;
        expect(cubit.state.totals, same(newest));
        expect(cubit.state.error, isNull);
        await cubit.close();
      });

      test('the stock hint: the first read $outcome AFTER the second', () async {
        final port = RecordingOrdersPort();
        final cubit = await _withCart(port);
        port.held.add('getStockCheck');
        final String id = cubit.state.order!.lineItems.single.id;
        await cubit.updateQty(id, 3);
        await cubit.updateQty(id, 4);
        final OrderStockCheck newest = _stock('p2');
        port.pendingOf('getStockCheck', 1).complete(newest);
        await pumpEventQueue();
        expect(cubit.state.stockCheck, same(newest));

        final reply = port.pendingOf('getStockCheck');
        lateError == null ? reply.complete(_stock('p1')) : reply.completeError(lateError);
        await pumpEventQueue();
        expect(cubit.state.stockCheck, same(newest));
        await cubit.close();
      });
    }
  });

  test('a failed preview ⇒ totals "—" (null) and the message; the order stays', () async {
    final port = RecordingOrdersPort();
    final cubit = await _withCart(port);
    final Order before = cubit.state.order!;
    port.errors['previewTotal'] = _refused;
    await cubit.updateQty(before.lineItems.single.id, 3);
    await pumpEventQueue();
    expect(cubit.state.totals, isNull);
    expect(cubit.state.error, _refused.message);
    expect(cubit.state.order!.id, before.id);
    expect(cubit.state.order!.lineItems.single.qty, 3);
    await cubit.close();
  });

  test('a failed stock read ⇒ no hint and NO message; the totals stay', () async {
    final port = RecordingOrdersPort();
    final cubit = await _withCart(port);
    port.errors['getStockCheck'] = StateError('offline');
    await cubit.updateQty(cubit.state.order!.lineItems.single.id, 3);
    await pumpEventQueue();
    expect(cubit.state.stockCheck, isNull);
    expect(cubit.state.error, isNull);
    expect(cubit.state.totals, isNotNull);
    await cubit.close();
  });

  group('the metadata inputs', () {
    Future<(RecordingOrdersPort, CreateQuoteCubit)> withKWp(double? kWp) async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      if (kWp != null) {
        await cubit.updateMeta(UpdateOrderMetaInput(kWp: kWp));
        await pumpEventQueue();
        port.log.clear();
        port.args.clear();
      }
      return (port, cubit);
    }

    List<UpdateOrderMetaInput> metas(RecordingOrdersPort port) =>
        [for (final a in port.argsOf('updateOrderMeta')) a[1]! as UpdateOrderMetaInput];

    test("'8,82' ⇒ kWp 8.82, then the totals", () async {
      final (port, cubit) = await withKWp(null);
      cubit.commitKWp(' 8,82 ');
      await pumpEventQueue();
      expect(port.log, ['updateOrderMeta', 'getStockCheck', 'previewTotal']);
      expect([for (final m in metas(port)) (m.hasKWp, m.kWp, m.hasValidityNote)], [(true, 8.82, false)]);
      await cubit.close();
    });

    test("'abc' ⇒ the kWp field error, no request; a valid value then clears it", () async {
      final (port, cubit) = await withKWp(null);
      cubit.commitKWp('abc');
      expect(cubit.state.fieldErrors, {'kWp': 'Công suất phải là số (vd 8,82).'});
      expect(port.log, isEmpty);
      cubit.commitKWp('5');
      await pumpEventQueue();
      expect(cubit.state.fieldErrors, isEmpty);
      expect(port.log.first, 'updateOrderMeta');
      await cubit.close();
    });

    test('empty while there is no kWp ⇒ nothing; empty while there is one ⇒ clear it', () async {
      final (port, cubit) = await withKWp(null);
      cubit.commitKWp('  ');
      expect(port.log, isEmpty);
      await cubit.close();

      final (port2, cubit2) = await withKWp(6.5);
      cubit2.commitKWp('');
      await pumpEventQueue();
      expect([for (final m in metas(port2)) (m.hasKWp, m.kWp)], [(true, null)]);
      await cubit2.close();
    });

    test('the same value ⇒ no request', () async {
      final (port, cubit) = await withKWp(6.5);
      cubit.commitKWp('6,5');
      expect(port.log, isEmpty);
      await cubit.close();
    });

    test('validity: unchanged ⇒ nothing; typed ⇒ sent trimmed; emptied ⇒ cleared', () async {
      final (port, cubit) = await withKWp(null);
      cubit.commitValidityNote('   ');
      expect(port.log, isEmpty);
      cubit.commitValidityNote(' 15 ngày ');
      await pumpEventQueue();
      cubit.commitValidityNote('');
      await pumpEventQueue();
      expect([for (final m in metas(port)) (m.hasValidityNote, m.validityNote, m.hasKWp)],
          [(true, '15 ngày', false), (true, null, false)]);
      await cubit.close();
    });

    test('an accepted PATCH asks the inputs to show the NEW order', () async {
      final (port, cubit) = await withKWp(null);
      final int seq = cubit.state.metaSyncSeq;
      await cubit.updateMeta(const UpdateOrderMetaInput(kWp: 7.0));
      expect(cubit.state.metaSyncSeq, seq + 1);
      expect(cubit.state.metaSyncFrom, same(cubit.state.order));
      expect(cubit.state.metaSyncFrom!.kWp, 7.0);
      expect(cubit.state.metaBusy, isFalse);
      await cubit.close();
    });

    test('a refused PATCH keeps the order and asks the inputs to show the OLD order again', () async {
      final (port, cubit) = await withKWp(6.5);
      final Order before = cubit.state.order!;
      final int seq = cubit.state.metaSyncSeq;
      port.errors['updateOrderMeta'] = _refused;
      await cubit.updateMeta(const UpdateOrderMetaInput(kWp: 9.0));
      expect(cubit.state.order, same(before));
      expect(cubit.state.metaSyncSeq, seq + 1);
      expect(cubit.state.metaSyncFrom, same(before));
      expect(cubit.state.error, _refused.message);
      expect(cubit.state.metaBusy, isFalse);
      expect(port.log, ['updateOrderMeta']);
      await cubit.close();
    });
  });

  group('the free line', () {
    test('clears old field errors first, converts the typed text, resets the form before the re-read, true',
        () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      cubit.commitKWp('abc');
      final logAtAccept = <String>[];
      final states = <CreateQuoteState>[];
      final sub = cubit.stream.listen(states.add);
      final bool ok = await cubit.addFreeLine(
        name: 'Công lắp',
        unit: 'gói',
        qtyText: 'abc',
        unitPriceText: '500000',
        note: '',
        onAccepted: () => logAtAccept.addAll(port.log),
      );
      await pumpEventQueue();
      expect(ok, isTrue);
      expect(states.first.fieldErrors, isEmpty);
      expect(logAtAccept, ['addLine']);
      expect(port.log, ['addLine', ..._reread]);
      final AddOrderLineInput input = port.argsOf('addLine').single[1]! as AddOrderLineInput;
      expect((input.name, input.unit, input.qty, input.unitPrice, input.note, input.productId),
          ('Công lắp', 'gói', 0, 500000, null, null));
      await sub.cancel();
      await cubit.close();
    });

    test('refused ⇒ false, the backend field errors, the form NOT reset', () async {
      final port = RecordingOrdersPort(errors: {'addLine': _refused});
      final cubit = await _withCart(port);
      var accepted = 0;
      final bool ok = await cubit.addFreeLine(
          name: 'x', unit: 'x', qtyText: '0', unitPriceText: '1', note: 'n', onAccepted: () => accepted++);
      expect(ok, isFalse);
      expect(accepted, 0);
      expect(cubit.state.fieldErrors, _refused.fieldErrors);
      expect((port.argsOf('addLine').single[1]! as AddOrderLineInput).note, 'n');
      await cubit.close();
    });
  });

  group('confirm, reopen, discount', () {
    test('confirmOrder ⇒ the confirmed order back, busy on then off, no re-read', () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      final states = <CreateQuoteState>[];
      final sub = cubit.stream.listen(states.add);
      final Order? confirmed = await cubit.confirmOrder();
      expect(confirmed?.status, kOrderStatusDachot);
      expect(cubit.state.order, same(confirmed));
      expect(port.log, ['confirmOrder']);
      await pumpEventQueue();
      expect(states.map((s) => s.confirmBusy), [true, true, false]);
      await sub.cancel();
      await cubit.close();
    });

    test('confirmOrder refused ⇒ null, the message, the cart kept', () async {
      final port = RecordingOrdersPort(errors: {'confirmOrder': _refused});
      final cubit = await _withCart(port);
      final Order before = cubit.state.order!;
      expect(await cubit.confirmOrder(), isNull);
      expect(cubit.state.order, same(before));
      expect(cubit.state.error, _refused.message);
      expect(cubit.state.confirmBusy, isFalse);
      await cubit.close();
    });

    test('reviseOrder ⇒ the reopened order, the inputs rewritten from it, then the totals', () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      await cubit.confirmOrder();
      port.log.clear();
      final int seq = cubit.state.metaSyncSeq;
      await cubit.reviseOrder();
      await pumpEventQueue();
      expect(port.log, ['reviseOrder', 'getStockCheck', 'previewTotal']);
      expect(cubit.state.order!.status, 'baogia');
      expect(cubit.state.metaSyncSeq, seq + 1);
      expect(cubit.state.metaSyncFrom, same(cubit.state.order));
      expect(cubit.state.reviseBusy, isFalse);
      await cubit.close();
    });

    test('applyDiscount converts the typed amount (junk ⇒ 0), drops an empty note, then previews with it', () async {
      final port = RecordingOrdersPort();
      final cubit = await _withCart(port);
      await cubit.applyDiscount(amountText: '300000', note: '');
      await pumpEventQueue();
      expect(port.log, ['applyDiscount', 'getStockCheck', 'previewTotal']);
      final ApplyDiscountInput input = port.argsOf('applyDiscount').single[1]! as ApplyDiscountInput;
      expect((input.amount, input.note), (300000, null));
      expect((port.argsOf('previewTotal').single.single! as PreviewTotalInput).discountAmount, 300000);
      expect(cubit.state.discountBusy, isFalse);

      final port2 = RecordingOrdersPort(errors: {'applyDiscount': _refused});
      final cubit2 = await _withCart(port2);
      await cubit2.applyDiscount(amountText: 'abc', note: 'Khách quen');
      final ApplyDiscountInput junk = port2.argsOf('applyDiscount').single[1]! as ApplyDiscountInput;
      expect((junk.amount, junk.note), (0, 'Khách quen'));
      expect(cubit2.state.error, _refused.message);
      await cubit.close();
      await cubit2.close();
    });
  });

  group('share', () {
    test('exports, then shares [image, pdf] with their names; clears an old message', () async {
      final port = RecordingOrdersPort(errors: {'previewTotal': _refused});
      final cubit = await _withCart(port);
      expect(cubit.state.error, isNotNull);
      final shared = <(List<XFile>, String?, List<String>?)>[];
      Future<AppShareResult> share(List<XFile> files, {String? title, String? text, List<String>? fileNames}) async {
        shared.add((files, title, fileNames));
        return AppShareResult.shared;
      }

      await cubit.shareQuote(share);
      expect(port.log, ['exportQuote']);
      final (List<XFile> files, String? title, List<String>? names) = shared.single;
      expect(files.map((f) => f.mimeType), ['image/png', 'application/pdf']);
      expect(names, [title, names![1]]);
      expect(names[1], endsWith('.pdf'));
      expect(cubit.state.error, isNull);
      expect(cubit.state.shareBusy, isFalse);
      await cubit.close();
    });

    test('a failed export ⇒ the message, nothing shared', () async {
      final port = RecordingOrdersPort(errors: {'exportQuote': _refused});
      final cubit = await _withCart(port);
      var shares = 0;
      await cubit.shareQuote((List<XFile> f, {String? title, String? text, List<String>? fileNames}) async {
        shares++;
        return AppShareResult.shared;
      });
      expect(shares, 0);
      expect(cubit.state.error, _refused.message);
      expect(cubit.state.shareBusy, isFalse);
      await cubit.close();
    });

    test('a share that throws ⇒ the screen sentence', () async {
      final cubit = await _withCart(RecordingOrdersPort());
      await cubit.shareQuote((List<XFile> f, {String? title, String? text, List<String>? fileNames}) async =>
          throw StateError('no share target'));
      expect(cubit.state.error, 'Không thực hiện được. Thử lại.');
      await cubit.close();
    });
  });

  group('the catalogue sheets', () {
    test('open, search and groups answer the catalogue port', () async {
      final cubit = await _withCart(RecordingOrdersPort());
      expect(await cubit.openCatalog(), isNotEmpty);
      expect(await cubit.searchProducts('pin'), isNotEmpty);
      final groups = await cubit.openGroups();
      expect(await cubit.openGroup(groups!.first.id), isNotNull);
      expect(cubit.state.error, isNull);
      await cubit.close();
    });

    test('a failed search is ignored: null, the state untouched; an empty one sends no search', () async {
      final catalog = _FailingCatalog();
      final cubit = await _withCart(RecordingOrdersPort(), catalog: catalog);
      final CreateQuoteState before = cubit.state;
      expect(await cubit.searchProducts('pin'), isNull);
      expect(await cubit.searchProducts(''), isNull);
      expect(catalog.searches, ['pin', null]);
      expect(cubit.state, before);
      await cubit.close();
    });

    test('a failed open of the catalogue, the groups or a group ⇒ null and the message', () async {
      final cubit = await _withCart(RecordingOrdersPort(), catalog: _FailingCatalog());
      expect(await cubit.openCatalog(), isNull);
      expect(cubit.state.error, 'Không thực hiện được. Thử lại.');
      expect(await cubit.openGroups(), isNull);
      expect(cubit.state.error, 'Không đọc được gói.');
      expect(await cubit.openGroup('g1'), isNull);
      expect(cubit.state.error, 'Không thực hiện được. Thử lại.');
      await cubit.close();
    });
  });

  group('every emit keeps the fields it does not own', () {
    // Every field off its default, so dropping one from a copy is visible.
    late RecordingOrdersPort seedPort;
    late Order order;
    late CreateQuoteState seeded;
    final OrderTotals seededTotals = _totals(9);
    final OrderStockCheck seededStock = _stock('p9');
    setUp(() async {
      seedPort = RecordingOrdersPort();
      order = await seedPort.create(CreateOrderInput(customerPhone: _customer.phone));
      seedPort.log.clear();
      seedPort.args.clear();
      seeded = CreateQuoteState(
        order: order,
        customer: _customer,
        totals: seededTotals,
        stockCheck: seededStock,
        error: 'cũ',
        fieldErrors: const {'kWp': 'cũ'},
        scopeBusy: true,
        metaBusy: true,
        confirmBusy: true,
        reviseBusy: true,
        discountBusy: true,
        shareBusy: true,
        metaSyncSeq: 5,
        metaSyncFrom: order,
      );
    });

    RecordingOrdersPort failing(String method) {
      final port = RecordingOrdersPort(errors: {method: StateError('offline')});
      return port;
    }

    CreateQuoteState failed(CreateQuoteState s) =>
        s.copyWith(error: 'Không thực hiện được. Thử lại.', fieldErrors: const {});

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'toggleScope refused: only its busy flag and the message move',
      build: () => _cubit(failing('updateScopeFlags')),
      seed: () => seeded.copyWith(scopeBusy: false),
      act: (cubit) => cubit.toggleScope(const UpdateScopeFlagsInput(scopeDelivery: true)),
      expect: () => [seeded, failed(seeded), failed(seeded).copyWith(scopeBusy: false)],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'updateMeta refused: busy, message, and a re-sync from the same order',
      build: () => _cubit(failing('updateOrderMeta')),
      seed: () => seeded.copyWith(metaBusy: false),
      act: (cubit) => cubit.updateMeta(const UpdateOrderMetaInput(kWp: 1.0)),
      expect: () => [
        seeded,
        failed(seeded),
        failed(seeded).copyWith(metaSyncSeq: 6),
        failed(seeded).copyWith(metaSyncSeq: 6, metaBusy: false),
      ],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'confirmOrder refused: only its busy flag and the message move',
      build: () => _cubit(failing('confirmOrder')),
      seed: () => seeded.copyWith(confirmBusy: false),
      act: (cubit) => cubit.confirmOrder(),
      expect: () => [seeded, failed(seeded), failed(seeded).copyWith(confirmBusy: false)],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'reviseOrder refused: only its busy flag and the message move',
      build: () => _cubit(failing('reviseOrder')),
      seed: () => seeded.copyWith(reviseBusy: false),
      act: (cubit) => cubit.reviseOrder(),
      expect: () => [seeded, failed(seeded), failed(seeded).copyWith(reviseBusy: false)],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'applyDiscount refused: only its busy flag and the message move',
      build: () => _cubit(failing('applyDiscount')),
      seed: () => seeded.copyWith(discountBusy: false),
      act: (cubit) => cubit.applyDiscount(amountText: '1', note: ''),
      expect: () => [seeded, failed(seeded), failed(seeded).copyWith(discountBusy: false)],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'shareQuote refused: only its busy flag and the message move',
      build: () => _cubit(failing('exportQuote')),
      seed: () => seeded.copyWith(shareBusy: false),
      act: (cubit) => cubit.shareQuote(platformShareXFiles),
      expect: () => [seeded, failed(seeded), failed(seeded).copyWith(shareBusy: false)],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'a refused line edit: only the message moves',
      build: () => _cubit(failing('updateLine')),
      seed: () => seeded,
      act: (cubit) => cubit.updateQty('l1', 2),
      expect: () => [failed(seeded)],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'a refused free line: field errors cleared, then the message',
      build: () => _cubit(failing('addLine')),
      seed: () => seeded,
      act: (cubit) => cubit.addFreeLine(name: 'x', unit: 'x', qtyText: '1', unitPriceText: '1', note: ''),
      expect: () => [seeded.copyWith(fieldErrors: const {}), failed(seeded)],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'the kWp parse error keeps everything else',
      build: () => _cubit(RecordingOrdersPort()),
      seed: () => seeded.copyWith(fieldErrors: const {'qty': 'q'}),
      act: (cubit) => cubit.commitKWp('abc'),
      expect: () => [seeded.copyWith(fieldErrors: const {'qty': 'q', 'kWp': 'Công suất phải là số (vd 8,82).'})],
    );

    blocTest<CreateQuoteCubit, CreateQuoteState>(
      'a re-read keeps customer, busy flags, field errors and sync; a failed preview drops only the totals',
      build: () => _cubit(seedPort..held.addAll({'previewTotal', 'getStockCheck'})),
      seed: () => seeded,
      act: (cubit) async {
        final refresh = cubit.refresh();
        await pumpEventQueue();
        // The order was re-read and the banner cleared; nothing else moved yet.
        final CreateQuoteState fetched = cubit.state;
        expect(fetched.order, isNot(same(order)));
        expect(fetched, seeded.copyWith(order: fetched.order, error: null));
        seedPort.pendingOf('previewTotal').completeError(_refused);
        await refresh;
        seedPort.pendingOf('getStockCheck').completeError(StateError('offline'));
        await pumpEventQueue();
      },
      verify: (cubit) {
        expect(seedPort.log, _reread);
        final CreateQuoteState s = cubit.state;
        expect((s.totals, s.stockCheck, s.error, s.fieldErrors), (null, null, _refused.message, _refused.fieldErrors));
        expect(s.customer, same(_customer));
        expect(s.metaSyncSeq, 5);
        expect(s.metaSyncFrom, same(order));
        expect([s.scopeBusy, s.metaBusy, s.confirmBusy, s.reviseBusy, s.discountBusy, s.shareBusy], everyElement(isTrue));
      },
    );
  });

  group('the port answering after close ⇒ no throw, no emit', () {
    for (final (outcome, Object? error) in [('answers', null), ('fails', StateError('offline'))]) {
      Future<void> afterClose(String method, Future<Object?> Function(CreateQuoteCubit) act, {bool cart = true}) async {
        final port = RecordingOrdersPort();
        final cubit = cart ? await _withCart(port) : _cubit(port);
        port.held.add(method);
        final call = act(cubit);
        await pumpEventQueue();
        final states = <CreateQuoteState>[];
        final sub = cubit.stream.listen(states.add);
        await cubit.close();
        final reply = port.pendingOf(method);
        error == null ? reply.complete() : reply.completeError(error);
        final Object? result = await call;
        await pumpEventQueue();
        expect(states, isEmpty);
        expect(result, isNull);
        await sub.cancel();
      }

      test('createOrder: the port $outcome', () => afterClose('create', (c) async => c.createOrder(_customer), cart: false));
      test('refresh: the port $outcome', () => afterClose('get', (c) async => c.refresh()));
      test('confirmOrder: the port $outcome ⇒ null', () => afterClose('confirmOrder', (c) => c.confirmOrder()));
      test('the preview: the port $outcome', () => afterClose('previewTotal', (c) async => c.refresh()));
      test('updateMeta: the port $outcome', () => afterClose('updateOrderMeta', (c) async => c.updateMeta(const UpdateOrderMetaInput(kWp: 1.0))));
    }
  });

  test('share bytes reach the share sheet unchanged', () async {
    final cubit = await _withCart(RecordingOrdersPort());
    late List<XFile> files;
    await cubit.shareQuote((List<XFile> f, {String? title, String? text, List<String>? fileNames}) async {
      files = f;
      return AppShareResult.shared;
    });
    final Uint8List image = await files.first.readAsBytes();
    expect(image, isNotEmpty);
    await cubit.close();
  });
}
