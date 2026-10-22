// HttpOrdersPort (Story 10.8): every method's route, query and body over the real
// transport (Bearer, envelope parsing, refresh), the result mapped from the
// contract JSON, and the request count. Bodies are compared WHOLE: a stray `null`
// on the shared PATCH clears kWp. Uploads are read back part by part, downloads
// byte for byte, and both survive a 401 → refresh → replay.
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pns_mobile/api/http_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';

import 'support/api_stack.dart';
import 'support/contract_json.dart';
import 'support/fake_http.dart';

Future<(ApiStack, HttpOrdersPort)> _port(FakeHandler handler) async {
  final s = await ApiStack(handler).signedIn();
  return (s, HttpOrdersPort(s.client, s.transport));
}

final Uint8List _jpeg = Uint8List.fromList(const [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/// A picked photo as image_picker hands it over on Android: a file path, no MIME
/// type. (On IO an XFile's `name` is the last segment of its path.)
XFile _photo(String name) => XFile.fromData(_jpeg, path: '/picked/$name');

void main() {
  group('reads', () {
    test('get maps the contract JSON (dates UTC, kWp fractional)', () async {
      final (s, port) = await _port((_) => jsonBody(200, orderJson()));
      final order = await port.get('o1');
      expect([s.adapter.requests.single.method, s.adapter.requests.single.path], ['GET', '/orders/o1']);
      expect(s.adapter.requests.single.authorization, 'Bearer access-1');
      expect(order.customerPhone, '+84903176968');
      expect(order.kWp, 8.82);
      expect(order.vatMode, OrderResponseDtoVatMode.coVat);
      expect(order.createdAt, DateTime.utc(2026, 7, 18));
      expect(order.lineItems.single.warrantyMonths, 12);
    });

    test('list sends no query key the caller did not set', () async {
      final (s, port) = await _port((_) => jsonBody(200, orderPageJson()));
      final page = await port.list();
      await port.list(status: 'dachot', page: 2, pageSize: 20);
      await port.list(followUp: true);
      expect(s.adapter.requests.map((r) => r.query).toList(), [
        <String, String>{},
        {'status': 'dachot', 'page': '2', 'pageSize': '20'},
        {'followUp': 'true'},
      ]);
      expect(s.adapter.requests.map((r) => r.path).toSet(), {'/orders'});
      expect(page.total, 41);
      expect(page.items.single.status, OrderListItemDtoStatus.dachot);
    });

    test('getLifecycle, listVersions (items unwrapped), listPendingDiscounts', () async {
      final (s, port) = await _port(
        routes({
          'GET /orders/o1/lifecycle': () => jsonBody(200, lifecycleJson()),
          'GET /orders/o1/versions': () => jsonBody(200, versionsJson()),
          'GET /orders/pending-discount-approvals': () => jsonBody(200, pendingDiscountsJson()),
        }),
      );
      final lifecycle = await port.getLifecycle('o1');
      expect(lifecycle.nextSteps.single.to, OrderNextStepDtoTo.dagiao);
      expect(lifecycle.canCancel, isTrue);
      expect(lifecycle.steps.last.progress, OrderLifecycleStepDtoProgress.current);
      final versions = await port.listVersions('o1');
      expect(versions.single.isCurrent, isTrue);
      expect(versions.single.lineCount, 3);
      final pending = await port.listPendingDiscounts();
      expect(pending.single.customerPhone, '+84903176968');
      expect(pending.single.lines.single.estimatedMarginPct, isNull);
      expect(s.adapter.requests, hasLength(3));
    });

    test('stock issue preview, issue (201 and 200 replay both succeed), stock check', () async {
      var issueStatus = 201;
      final (s, port) = await _port(
        routes({
          'GET /orders/o1/stock-issue': () => jsonBody(200, stockIssueJson()),
          'POST /orders/o1/stock-issue': () => jsonBody(issueStatus, {'voucher': voucherJson()}),
          'GET /orders/o1/stock-check': () => jsonBody(200, stockCheckJson()),
        }),
      );
      final view = await port.getStockIssue('o1');
      expect(view.lines.single.shortfall, 0);
      expect(view.untrackedItems, ['Công lắp đặt']);
      expect((await port.issueStock('o1')).voucher.code, 'PK-X-0097');
      issueStatus = 200;
      expect((await port.issueStock('o1')).voucher.code, 'PK-X-0097');
      final check = await port.getStockCheck('o1');
      expect(check.lines.single.status, OrderStockCheckLineDtoStatus.short);
      final issues = s.adapter.to('/orders/o1/stock-issue').where((r) => r.method == 'POST').toList();
      expect(issues, hasLength(2));
      expect(issues.every((r) => r.body.isEmpty), isTrue, reason: 'issueStock carries no body');
      expect(s.adapter.requests, hasLength(4));
    });

    test('an id travels as ONE escaped path segment', () async {
      final (s, port) = await _port((_) => jsonBody(200, orderJson()));
      await port.get('a/b');
      expect(s.adapter.requests.single.path, '/orders/a%2Fb');
    });
  });

  group('writes', () {
    test('create sends the phone exactly as typed', () async {
      final (s, port) = await _port((_) => jsonBody(201, orderJson()));
      final order = await port.create(const CreateOrderInput(customerPhone: '0903 176 968'));
      final r = s.adapter.requests.single;
      expect([r.method, r.path], ['POST', '/orders']);
      expect(r.json, {'customerPhone': '0903 176 968'});
      expect(order.id, 'o1');
    });

    test('scope flags and metadata share PATCH /orders/:id with sparse bodies', () async {
      final (s, port) = await _port((_) => jsonBody(200, orderJson()));
      await port.updateScopeFlags('o1', const UpdateScopeFlagsInput(scopeConstruction: true));
      await port.updateOrderMeta('o1', const UpdateOrderMetaInput(kWp: null));
      await port.updateOrderMeta('o1', const UpdateOrderMetaInput(validityNote: '72h'));
      expect(s.adapter.requests.map((r) => '${r.method} ${r.path}').toSet(), {'PATCH /orders/o1'});
      expect(s.adapter.requests.map((r) => r.json).toList(), [
        {'scopeConstruction': true},
        {'kWp': null},
        {'validityNote': '72h'},
      ]);
    });

    test('line items: add (catalogue, no name/unit/price keys), update (sparse), remove', () async {
      final (s, port) = await _port(
        routes({
          'POST /orders/o1/line-items': () => jsonBody(201, lineJson()),
          'PATCH /orders/o1/line-items/l1': () => jsonBody(200, lineJson(qty: 3)),
          'DELETE /orders/o1/line-items/l1': noContent,
        }),
      );
      final added = await port.addLine('o1', const AddOrderLineInput(productId: 'p-1', qty: 2));
      expect(added.amount, 4900000);
      final updated = await port.updateLine('o1', 'l1', const UpdateOrderLineInput(qty: 3));
      expect(updated.qty, 3);
      await port.updateLine('o1', 'l1', const UpdateOrderLineInput(warrantyMonths: null));
      await port.removeLine('o1', 'l1');
      expect(s.adapter.requests.map((r) => r.method).toList(), ['POST', 'PATCH', 'PATCH', 'DELETE']);
      expect(s.adapter.requests[0].json, {'productId': 'p-1', 'qty': 2, 'isFlexible': false});
      expect(s.adapter.requests[1].json, {'qty': 3});
      expect(s.adapter.requests[2].json, {'warrantyMonths': null});
    });

    test('previewTotal echoes lines and only the set extras', () async {
      final (s, port) = await _port((_) => jsonBody(200, previewTotalJson()));
      final totals = await port.previewTotal(
        const PreviewTotalInput(
          lines: [PreviewTotalLine(unitPrice: 2450000, qty: 2)],
          vatMode: PreviewTotalRequestDtoVatMode.coVat,
        ),
      );
      final r = s.adapter.requests.single;
      expect([r.method, r.path], ['POST', '/orders/preview-total']);
      expect(r.json, {
        'lines': [
          {'unitPrice': 2450000, 'qty': 2},
        ],
        'vatMode': 'co_vat',
      });
      expect(totals.total, 5292000);
    });

    test('confirm, reopen, apply and resolve a discount', () async {
      final (s, port) = await _port((_) => jsonBody(200, orderJson(status: 'dachot')));
      await port.confirmOrder('o1');
      await port.reviseOrder('o1');
      await port.applyDiscount('o1', const ApplyDiscountInput(amount: 100000, note: 'Khách quen'));
      await port.resolveDiscount('o1', const ResolveDiscountInput(approve: false, reason: 'Quá cao'));
      expect(s.adapter.requests.map((r) => '${r.method} ${r.path}').toList(), [
        'POST /orders/o1/confirm',
        'POST /orders/o1/reopen',
        'POST /orders/o1/apply-discount',
        'POST /orders/o1/resolve-discount',
      ]);
      expect(s.adapter.requests[2].json, {'amount': 100000, 'note': 'Khách quen'});
      expect(s.adapter.requests[3].json, {'approve': false, 'reason': 'Quá cao'});
    });

    test('cancel sends {"reason": …} to its own endpoint', () async {
      final (s, port) = await _port((_) => jsonBody(200, cancelJson()));
      await port.cancel('o1', 'Khách đổi ý');
      final r = s.adapter.requests.single;
      expect([r.method, r.path], ['POST', '/orders/o1/cancel']);
      expect(r.json, {'reason': 'Khách đổi ý'});
    });
  });

  group('photo uploads (multipart)', () {
    test('transition: event part + one image/jpeg part per photo, even with no picker MIME type', () async {
      final (s, port) = await _port((_) => jsonBody(201, statusChangeJson()));
      final result = await port.transition('o1', kEventDelivered, [_photo('a.jpg'), _photo('b.JPEG')]);
      expect(result.status, StatusChangeResponseDtoStatus.dagiao);
      expect(result.savedAttachmentCount, 2);
      final r = s.adapter.requests.single;
      expect([r.method, r.path], ['POST', '/orders/o1/transition']);
      expect(requestContentType(r), startsWith('multipart/form-data; boundary='));
      final parts = formParts(r);
      expect(parts.map((p) => p.name).toList(), ['event', 'files', 'files']);
      expect(parts.first.text, 'xong_giao');
      expect(parts.skip(1).map((p) => p.filename).toList(), ['a.jpg', 'b.JPEG']);
      expect(parts.skip(1).map((p) => p.contentType).toList(), ['image/jpeg', 'image/jpeg']);
      expect(parts[1].body, _jpeg);
    });

    test('the picker MIME type wins (an extensionless content URI); the extension decides otherwise', () async {
      final (s, port) = await _port((_) => jsonBody(201, statusChangeJson()));
      await port.transition('o1', 'xong_giao', [
        XFile.fromData(_jpeg, path: '/picked/1000012345', mimeType: 'image/png'),
        _photo('c.webp'),
        _photo('d.heic'),
        _photo('e.unknownext'),
      ]);
      final types = formParts(s.adapter.requests.single).skip(1).map((p) => p.contentType).toList();
      // An unknown type is sent as such and the backend answers with its own field error.
      expect(types, ['image/png', 'image/webp', 'image/heic', 'application/octet-stream']);
    });

    test('no photo ⇒ no files part at all', () async {
      final (s, port) = await _port((_) => jsonBody(201, statusChangeJson()));
      await port.transition('o1', 'xong_giao', const []);
      expect(formParts(s.adapter.requests.single).map((p) => p.name).toList(), ['event']);
    });

    test('401 → refresh → the replay carries every part again', () async {
      final (s, port) = await _port(renewingOnce((_) => jsonBody(201, statusChangeJson())));
      await port.transition('o1', 'xong_giao', [_photo('a.jpg'), _photo('b.jpg')]);
      final sent = s.adapter.to('/orders/o1/transition').toList();
      expect(sent.map((r) => r.authorization).toList(), ['Bearer access-1', 'Bearer access-2']);
      final replay = formParts(sent[1]);
      expect(replay.map((p) => p.name).toList(), ['event', 'files', 'files']);
      expect(replay.skip(1).map((p) => p.contentType).toList(), ['image/jpeg', 'image/jpeg']);
      expect(replay[2].body, _jpeg);
      expect(s.adapter.to('/auth/refresh'), hasLength(1));
    });

    test('addAttachments uploads the photos as files parts', () async {
      final (s, port) = await _port((_) => jsonBody(201, uploadJson()));
      await port.addAttachments('o1', [_photo('a.png')]);
      final r = s.adapter.requests.single;
      expect([r.method, r.path], ['POST', '/orders/o1/attachments']);
      final parts = formParts(r);
      expect(parts.map((p) => '${p.name}|${p.filename}|${p.contentType}').toList(), ['files|a.png|image/png']);
    });

    test('addAttachments: image/jpeg without a picker MIME type, and every part again on a 401 replay', () async {
      final (s, port) = await _port(renewingOnce((_) => jsonBody(201, uploadJson())));
      await port.addAttachments('o1', [_photo('a.jpg'), _photo('b.jpg')]);
      final sent = s.adapter.to('/orders/o1/attachments').toList();
      expect(sent.map((r) => r.authorization).toList(), ['Bearer access-1', 'Bearer access-2']);
      for (final r in sent) {
        expect(formParts(r).map((p) => '${p.name}|${p.filename}|${p.contentType}').toList(), [
          'files|a.jpg|image/jpeg',
          'files|b.jpg|image/jpeg',
        ]);
      }
      expect(formParts(sent[1])[1].body, _jpeg);
    });
  });

  group('attachments and downloads', () {
    test('listAttachments unwraps items; removeAttachment deletes one', () async {
      final (s, port) = await _port(
        routes({
          'GET /orders/o1/attachments': () => jsonBody(200, attachmentsJson()),
          'DELETE /orders/o1/attachments/a1': noContent,
        }),
      );
      final items = await port.listAttachments('o1');
      expect(items.single.uploadedBy, 'Trần Thợ');
      expect(items.single.canDelete, isTrue);
      await port.removeAttachment('o1', 'a1');
      expect(s.adapter.requests.map((r) => r.method).toList(), ['GET', 'DELETE']);
    });

    test('attachmentBytes returns the bytes, through a 401 replay too', () async {
      final bytes = [9, 8, 7, 6];
      final (s, port) = await _port(renewingOnce((_) => bytesBody(200, bytes, contentType: 'image/jpeg')));
      expect(await port.attachmentBytes('o1', 'a1'), bytes);
      expect(s.adapter.to('/orders/o1/attachments/a1'), hasLength(2));
    });

    test('a 404 envelope on a download is an OrderPortException with the backend message', () async {
      final (s, port) = await _port((_) => jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy ảnh đính kèm.')));
      await expectLater(
        port.attachmentBytes('o1', 'a1'),
        throwsA(
          isA<OrderPortException>()
              .having((e) => e.code, 'code', 'NOT_FOUND')
              .having((e) => e.message, 'message', 'Không tìm thấy ảnh đính kèm.'),
        ),
      );
      expect(s.adapter.requests, hasLength(1));
    });

    test('exportQuote: export, then image, then PDF — names from the metadata, types from the routes', () async {
      final (s, port) = await _port(
        routes({
          'POST /orders/o1/export-quote': () => jsonBody(201, quoteExportJson()),
          'GET /orders/o1/quote/image': () => bytesBody(200, [1, 2, 3], contentType: 'image/png'),
          'GET /orders/o1/quote/pdf': () => bytesBody(200, utf8.encode('%PDF')),
        }),
      );
      final files = await port.exportQuote('o1');
      expect(s.adapter.requests.map((r) => '${r.method} ${r.path}').toList(), [
        'POST /orders/o1/export-quote',
        'GET /orders/o1/quote/image',
        'GET /orders/o1/quote/pdf',
      ]);
      expect(
        [files.image.fileName, files.image.mimeType, files.image.bytes],
        [
          'bao-gia-BG-0001.png',
          'image/png',
          [1, 2, 3],
        ],
      );
      expect(
        [files.pdf.fileName, files.pdf.mimeType, files.pdf.bytes],
        ['bao-gia-BG-0001.pdf', 'application/pdf', utf8.encode('%PDF')],
      );
    });

    for (final failing in ['image', 'pdf']) {
      test('exportQuote: a 404 envelope on the $failing download is an OrderPortException with the message', () async {
        final (s, port) = await _port(
          routes({
            'POST /orders/o1/export-quote': () => jsonBody(201, quoteExportJson()),
            'GET /orders/o1/quote/image': () => failing == 'image'
                ? jsonBody(404, envelope('NOT_FOUND', 'Chưa có ảnh báo giá.'))
                : bytesBody(200, [1], contentType: 'image/png'),
            'GET /orders/o1/quote/pdf': () => failing == 'pdf'
                ? jsonBody(404, envelope('NOT_FOUND', 'Chưa có PDF báo giá.'))
                : bytesBody(200, [2]),
          }),
        );
        await expectLater(
          port.exportQuote('o1'),
          throwsA(
            isA<OrderPortException>()
                .having((e) => e.code, 'code', 'NOT_FOUND')
                .having((e) => e.message, 'message', failing == 'image' ? 'Chưa có ảnh báo giá.' : 'Chưa có PDF báo giá.'),
          ),
        );
        expect(s.adapter.to('/orders/o1/quote/$failing'), hasLength(1));
      });
    }
  });

  group('errors', () {
    test('get 404 NOT_FOUND ⇒ OrderPortException.code drives the not-found state', () async {
      final (_, port) = await _port((_) => jsonBody(404, envelope('NOT_FOUND', 'Không tìm thấy đơn hàng.')));
      await expectLater(
        port.get('o1'),
        throwsA(
          isA<OrderPortException>()
              .having((e) => e.code, 'code', 'NOT_FOUND')
              .having((e) => e.message, 'message', 'Không tìm thấy đơn hàng.'),
        ),
      );
    });

    test('a garbage id is the backend 400 message verbatim', () async {
      final (_, port) = await _port((_) => jsonBody(400, envelope('VALIDATION_ERROR', 'Mã định danh không hợp lệ.')));
      await expectLater(
        port.get('abc'),
        throwsA(isA<OrderPortException>().having((e) => e.message, 'message', 'Mã định danh không hợp lệ.')),
      );
    });

    test('cancel 400 ⇒ fieldErrors["reason"] lands on the reason field', () async {
      final (_, port) = await _port(
        (_) => jsonBody(
          400,
          envelope(
            'VALIDATION_ERROR',
            'Dữ liệu không hợp lệ',
            fieldErrors: [
              {'field': 'reason', 'code': 'minLength', 'message': 'Lý do huỷ tối thiểu 3 ký tự.'},
            ],
          ),
        ),
      );
      await expectLater(
        port.cancel('o1', 'x'),
        throwsA(
          isA<OrderPortException>().having((e) => e.fieldErrors, 'fieldErrors', {
            'reason': 'Lý do huỷ tối thiểu 3 ký tự.',
          }),
        ),
      );
    });
  });
}
