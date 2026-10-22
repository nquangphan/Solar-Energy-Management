// Native Flutter widget tests for the Ảnh tab of Chi tiết đơn (Story 5.6).
// Mirrors mobile/test/screens/orders/order_detail_screen_test.dart.
//
// These exist because mobile CAN run them. The web twin is guarded only by text
// (no tsc/bundler/JSDOM yet, TD-1), so a text-guard cannot tell a rendered tab
// from a screen that throws on build. What is asserted here is exactly what
// reading the source cannot prove:
//  - the three states of the tab render their exact copy;
//  - the delete button is ABSENT (not greyed) when the backend says canDelete
//    is false — the ONE place that rule is enforced client-side is the flag,
//    and the flag comes from the backend;
//  - deleting goes through the confirm dialog: cancelling calls NOTHING;
//  - photos are loaded LAZILY — opening the screen must not fetch them.

import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/fake_orders_port.dart';
import 'package:pns_mobile/design_system/session/orders_port.dart';
import 'package:pns_mobile/screens/orders/order_detail_screen.dart';

const String _kOrderId = 'ord-anh-1';

/// The fixture status is deliberately SHORT. A long chip label ("Đang thi
/// công") overflows the Trạng thái row of the Thông tin tab at phone width —
/// a pre-existing Story 5.4 layout bug this story does not touch. Using a long
/// status here would fail every test in this file for a reason that has nothing
/// to do with the Ảnh tab.
Order _order() => Order(
      id: _kOrderId,
      status: 'baogia',
      customerPhone: '+84903176968',
      currentVersionId: 'ver-1',
      ownerAccountId: 'acc-1',
      sourceId: 'src-facebook',
      custType: 'CA_NHAN',
      scopeEquipment: true,
      scopeConstruction: true,
      scopeDelivery: true,
      vatMode: OrderResponseDtoVatMode.coVat,
      lineItems: <OrderLine>[],
      createdAt: DateTime.utc(2026, 7, 18),
      updatedAt: DateTime.utc(2026, 7, 18),
    );

AttachmentItem _anh({
  required String id,
  required bool canDelete,
  String? statusFrom,
  String? statusTo,
  String uploadedBy = 'Trần Thợ',
}) =>
    AttachmentItem(
      id: id,
      fileName: '$id.jpg',
      contentType: 'image/jpeg',
      size: 2048,
      createdAt: DateTime.utc(2026, 7, 18, 3),
      uploadedBy: uploadedBy,
      statusFrom: statusFrom,
      statusTo: statusTo,
      canDelete: canDelete,
    );

/// A port answering a fixed order + a caller-chosen photo list, recording every
/// write so a test can prove a write did NOT happen.
class _AnhPort extends FakeOrdersPort {
  _AnhPort({this.anh = const <AttachmentItem>[], this.loiList = false});

  final List<AttachmentItem> anh;
  final bool loiList;

  int listCalls = 0;
  final List<String> daXoa = <String>[];
  final List<int> daThem = <int>[];

  @override
  Future<Order> get(String id) async => _order();

  @override
  Future<OrderLifecycle> getLifecycle(String orderId) async =>
      const OrderLifecycle(
        steps: <OrderLifecycleStep>[
          OrderLifecycleStep(
            status: OrderLifecycleStepDtoStatus.thicong,
            progress: OrderLifecycleStepDtoProgress.current,
          ),
        ],
        nextSteps: <OrderNextStep>[],
        canCancel: false,
      );

  @override
  Future<List<OrderVersionItem>> listVersions(String orderId) async =>
      const <OrderVersionItem>[];

  @override
  Future<List<AttachmentItem>> listAttachments(String orderId) async {
    listCalls += 1;
    if (loiList) throw StateError('network down');
    return anh;
  }

  @override
  Future<Uint8List> attachmentBytes(String orderId, String attachmentId) async =>
      throw StateError('no bytes in test — the placeholder glyph stands in');

  @override
  Future<void> removeAttachment(String orderId, String attachmentId) async {
    daXoa.add(attachmentId);
  }

  @override
  Future<void> addAttachments(String orderId, List<XFile> files) async {
    daThem.add(files.length);
  }
}

Widget _host(OrdersPort port, {ImagePickFn? pick}) => MaterialApp(
      home: Scaffold(
        body: OrderDetailScreen(port: port, orderId: _kOrderId, pick: pick),
      ),
    );

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Open the screen at phone width and switch to the Ảnh tab.
Future<void> _moTabAnh(WidgetTester tester, _AnhPort port) async {
  tester.view.physicalSize = const Size(1080, 2340); // ~360dp at dpr 3
  tester.view.devicePixelRatio = 3.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(_host(port));
  await tester.pumpAndSettle();
  await _tap(tester, find.text('Ảnh'));
}

void main() {
  testWidgets('the third tab is Ảnh and the two older labels are untouched',
      (WidgetTester tester) async {
    await tester.pumpWidget(_host(_AnhPort()));
    await tester.pumpAndSettle();

    expect(find.text('Thông tin'), findsOneWidget);
    expect(find.text('Lịch sử update'), findsOneWidget);
    expect(find.text('Ảnh'), findsOneWidget);
  });

  testWidgets('photos load LAZILY — opening the screen does not fetch them',
      (WidgetTester tester) async {
    final _AnhPort port = _AnhPort();
    await tester.pumpWidget(_host(port));
    await tester.pumpAndSettle();

    // The detail screen is fully rendered and the photo list was never asked
    // for: it is the heaviest panel and most visits never open it.
    expect(port.listCalls, 0);

    await _tap(tester, find.text('Ảnh'));
    expect(port.listCalls, 1);

    // Re-entering does not refetch — the first open owns the load.
    await _tap(tester, find.text('Thông tin'));
    await _tap(tester, find.text('Ảnh'));
    expect(port.listCalls, 1);
  });

  testWidgets('empty state shows the exact copy (UX-DR-19)',
      (WidgetTester tester) async {
    await _moTabAnh(tester, _AnhPort());

    expect(find.text('Chưa có ảnh nào.'), findsOneWidget);
    // The add block is still offered — an empty gallery is where you add.
    expect(find.text('Thêm ảnh bổ sung'), findsOneWidget);
  });

  testWidgets('error state shows the exact copy + Thử lại refetches',
      (WidgetTester tester) async {
    final _AnhPort port = _AnhPort(loiList: true);
    await _moTabAnh(tester, port);

    expect(find.text('Không tải được ảnh của đơn.'), findsOneWidget);
    expect(port.listCalls, 1);

    await _tap(tester, find.text('Thử lại'));
    expect(port.listCalls, 2);
  });

  testWidgets('ready state renders one tile per photo with its uploader',
      (WidgetTester tester) async {
    await _moTabAnh(
      tester,
      _AnhPort(
        anh: <AttachmentItem>[
          _anh(id: 'a1', canDelete: true, uploadedBy: 'Lê Kỹ Thuật'),
          _anh(
            id: 'a2',
            canDelete: true,
            statusFrom: 'dacoc',
            statusTo: 'thicong',
            uploadedBy: 'Trần Thợ',
          ),
        ],
      ),
    );

    expect(find.byType(AppAttachmentGallery), findsOneWidget);
    expect(find.text('Chưa có ảnh nào.'), findsNothing);
    expect(find.text('Lê Kỹ Thuật'), findsOneWidget);
    expect(find.text('Trần Thợ'), findsOneWidget);

    // Both coordinates null ⇒ Bổ sung; a step photo gets the step badge built
    // from the ONE shipped status label table.
    expect(find.text('Bổ sung'), findsOneWidget);
    expect(find.text('Bước: Đã cọc → Đang thi công'), findsOneWidget);
  });

  testWidgets('canDelete false ⇒ the delete button is ABSENT, not greyed (AC-14)',
      (WidgetTester tester) async {
    await _moTabAnh(
      tester,
      _AnhPort(
        anh: <AttachmentItem>[
          _anh(id: 'khong-xoa-duoc', canDelete: false),
        ],
      ),
    );

    // The tile renders; only its delete affordance is gone. A disabled control
    // still advertises a capability the caller does not have (UX-DR-22).
    expect(find.byType(AppAttachmentGallery), findsOneWidget);
    expect(
      find.bySemanticsLabel('Xoá ảnh'),
      findsNothing,
      reason: 'no delete control may render when the backend says canDelete=false',
    );
  });

  testWidgets('canDelete true ⇒ the delete button renders',
      (WidgetTester tester) async {
    await _moTabAnh(
      tester,
      _AnhPort(anh: <AttachmentItem>[_anh(id: 'xoa-duoc', canDelete: true)]),
    );

    expect(find.bySemanticsLabel('Xoá ảnh'), findsOneWidget);
  });

  testWidgets('delete asks first: Huỷ leaves the port untouched (AC-13)',
      (WidgetTester tester) async {
    final _AnhPort port =
        _AnhPort(anh: <AttachmentItem>[_anh(id: 'anh-1', canDelete: true)]);
    await _moTabAnh(tester, port);

    await _tap(tester, find.bySemanticsLabel('Xoá ảnh'));

    // The dialog states the consequence — it does not just ask "sure?".
    expect(find.text('Xoá ảnh'), findsWidgets);
    expect(
      find.text('Ảnh sẽ bị xoá vĩnh viễn và không khôi phục được.'),
      findsOneWidget,
    );

    await _tap(tester, find.text('Huỷ'));
    expect(port.daXoa, isEmpty, reason: 'cancelling must not delete anything');
  });

  testWidgets('delete confirmed: the port gets the RIGHT attachment id',
      (WidgetTester tester) async {
    final _AnhPort port = _AnhPort(
      anh: <AttachmentItem>[
        _anh(id: 'anh-dau', canDelete: true),
        _anh(id: 'anh-hai', canDelete: true),
      ],
    );
    await _moTabAnh(tester, port);

    // Delete the SECOND tile — matching by position would pass either way if the
    // screen wired the wrong id, so the assertion names the id.
    await _tap(tester, find.bySemanticsLabel('Xoá ảnh').last);
    await _tap(tester, find.text('Xác nhận'));

    expect(port.daXoa, <String>['anh-hai']);
  });

  testWidgets('adding photos through the injected picker sends them all',
      (WidgetTester tester) async {
    final _AnhPort port = _AnhPort();
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _host(
        port,
        pick: (ImageSource source) async => <XFile>[XFile('/tmp/a.jpg')],
      ),
    );
    await tester.pumpAndSettle();
    await _tap(tester, find.text('Ảnh'));

    await _tap(tester, find.bySemanticsLabel('Thêm ảnh'));
    await _tap(tester, find.text('Chọn từ thư viện'));
    await _tap(tester, find.text('Thêm ảnh').last);

    expect(port.daThem, <int>[1]);
  });
}
