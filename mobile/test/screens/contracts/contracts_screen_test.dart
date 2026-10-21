// hand-authored — widget test for the Sinh hợp đồng screen (Story 7.3).
//
// Everything goes through the REAL screen with the fake port: the six dynamic
// fields, the type label, the legal-entity and blocked banners, generate ⇒ share,
// the double-press guard, the server-message banner, the history list and the
// load states, plus the longest labels at 320/360px.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/session/contracts_port.dart';
import 'package:pns_mobile/design_system/session/fake_contracts_port.dart';
import 'package:pns_mobile/screens/contracts/contracts_screen.dart';

const String _kOrderId = 'DH-2048';
const String _kLongBlocked =
    'Tổng các đợt thanh toán lệch tổng đơn — sửa lịch trước khi sinh hợp đồng.';

const ContractSummary _existing = ContractSummary(
  id: 'c-old',
  contractNo: 'HĐMB-123456/2026',
  contractType: 'sale',
  versionNo: 2,
  fileName: 'hop-dong-old',
  pdfSize: 2048,
  // 2026-10-21 18:30 UTC is already 22/10 in Vietnam.
  createdAt: '2026-10-21T18:30:00.000Z',
);

class _GatedPort extends FakeContractsPort {
  final Completer<void> gate = Completer<void>();

  @override
  Future<ContractSummary> generateContract(String orderId) async {
    generateCalls.add(orderId);
    await gate.future;
    return const ContractSummary(
      id: 'c-gated',
      contractNo: 'HĐMB-1/2026',
      contractType: 'sale',
      versionNo: 1,
      fileName: 'g',
      pdfSize: 1,
      createdAt: '2026-10-22T03:00:00.000Z',
    );
  }
}

class _Shared {
  final List<String?> titles = <String?>[];
  int calls = 0;

  Future<AppShareResult> call(List<XFile> files,
      {String? title, String? text}) async {
    calls += 1;
    titles.add(title);
    expect(files.length, 1);
    return AppShareResult.shared;
  }
}

void _screen(WidgetTester tester, [double width = 400.0]) {
  tester.view.physicalSize = Size(width, 2400.0);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Future<void> _pump(
  WidgetTester tester,
  ContractsPort port, {
  _Shared? shared,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: ContractsScreen(
          port: port,
          orderId: _kOrderId,
          shareImpl: (shared ?? _Shared()).call,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows the six dynamic fields with the total through MoneyText',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, FakeContractsPort());

    expect(find.text('Sinh hợp đồng'), findsOneWidget);
    expect(find.text('HỢP ĐỒNG'), findsOneWidget);
    expect(find.text('Trường động đưa vào HĐ'.toUpperCase()), findsOneWidget);
    for (final String label in <String>[
      'Loại HĐ',
      'Hai bên',
      'Vật tư',
      'Tổng tiền',
      'Lịch TT',
      'Số BG',
    ]) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(find.text('A: Anh Nguyễn Văn An · B: Phương Nam'), findsOneWidget);
    expect(find.text('4 dòng · snapshot đơn'), findsOneWidget);
    expect(find.text('20/70/10'), findsOneWidget);
    expect(find.text('BG-2048'), findsOneWidget);
    final MoneyText total =
        tester.widget<MoneyText>(find.byType(MoneyText).first);
    expect(total.value, 83010960);
    expect(find.text(formatVnd(83010960)), findsOneWidget);
    expect(find.text('Điều khoản là template tĩnh; sinh HĐ ghi Audit log.'),
        findsOneWidget);
  });

  testWidgets('type label follows contractType (sale)',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, FakeContractsPort(contractType: 'sale'));
    expect(find.text('HĐ Mua bán'), findsOneWidget);
    expect(find.text('HĐ Thi công'), findsNothing);
  });

  testWidgets('type label follows contractType (construction)',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, FakeContractsPort(contractType: 'construction'));
    expect(find.text('HĐ Thi công'), findsOneWidget);
    expect(find.text('HĐ Mua bán'), findsNothing);
  });

  testWidgets('missing legal-entity fields warn but keep the button',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(
      tester,
      FakeContractsPort(
          missingPartyFields: const <String>['Mã số thuế', 'Địa chỉ']),
    );
    expect(
      find.text(
          'Thông tin pháp nhân chưa cấu hình: Mã số thuế, Địa chỉ. Hợp đồng vẫn xuất được — các ô này in “Chưa cấu hình”.'),
      findsOneWidget,
    );
    expect(find.text('Xuất PDF hợp đồng'), findsOneWidget);
  });

  testWidgets('no missing fields ⇒ no legal-entity banner',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, FakeContractsPort());
    expect(
        find.textContaining('Thông tin pháp nhân chưa cấu hình'), findsNothing);
  });

  testWidgets('generatable false ⇒ blockedReason banner and no button',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(
      tester,
      FakeContractsPort(generatable: false, blockedReason: _kLongBlocked),
    );
    expect(find.text(_kLongBlocked), findsOneWidget);
    expect(find.text('Xuất PDF hợp đồng'), findsNothing);
  });

  testWidgets('press ⇒ generate once, then download the new id and share it',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeContractsPort port = FakeContractsPort();
    final _Shared shared = _Shared();
    await _pump(tester, port, shared: shared);

    await _tap(tester, find.text('Xuất PDF hợp đồng'));

    expect(port.generateCalls, <String>[_kOrderId]);
    expect(port.downloadCalls.length, 1);
    expect(port.downloadCalls.single.contractId, 'contract-1');
    expect(port.downloadCalls.single.orderId, _kOrderId);
    expect(shared.calls, 1);
    expect(shared.titles.single, 'contract-1.pdf');
    // The list was reloaded and now shows the new contract.
    expect(find.textContaining('HĐMB-123456/2026'), findsOneWidget);
    expect(find.text('Chưa sinh hợp đồng nào.'), findsNothing);
  });

  testWidgets('double press in flight ⇒ one generate call',
      (WidgetTester tester) async {
    _screen(tester);
    final _GatedPort port = _GatedPort();
    await _pump(tester, port);

    final Finder button = find.text('Xuất PDF hợp đồng');
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pump();
    await tester.tap(button, warnIfMissed: false);
    await tester.pump();

    expect(port.generateCalls.length, 1);
    port.gate.complete();
    await tester.pumpAndSettle();
    expect(port.generateCalls.length, 1);
    expect(port.downloadCalls.length, 1);
  });

  testWidgets(
      '409 ⇒ server message verbatim, nothing downloaded, overview reloaded',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeContractsPort port = FakeContractsPort(
      generateError: const ContractsPortError(
          status: 409,
          message: 'Đơn chưa ở trạng thái cho phép sinh hợp đồng.'),
    );
    await _pump(tester, port);
    expect(port.overviewCalls.length, 1);

    await _tap(tester, find.text('Xuất PDF hợp đồng'));

    expect(find.text('Đơn chưa ở trạng thái cho phép sinh hợp đồng.'),
        findsOneWidget);
    expect(port.downloadCalls, isEmpty);
    expect(port.overviewCalls.length, 2);
    // The button is usable again.
    expect(find.text('Xuất PDF hợp đồng'), findsOneWidget);
  });

  testWidgets(
      'download fails AFTER a successful generation ⇒ points at "Tải PDF", one generate call',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeContractsPort port = FakeContractsPort(
      downloadError:
          const ContractsPortError(status: 500, message: 'Lỗi máy chủ.'),
    );
    await _pump(tester, port);

    await _tap(tester, find.text('Xuất PDF hợp đồng'));

    expect(
      find.text(
          'Đã sinh hợp đồng HĐMB-123456/2026 nhưng chưa tải được — bấm “Tải PDF” trong danh sách.'),
      findsOneWidget,
    );
    expect(port.generateCalls.length, 1);
    // The new contract is listed, ready for "Tải PDF".
    expect(find.text('Tải PDF'), findsOneWidget);
  });

  testWidgets(
      'a platform share error on "Tải PDF" ⇒ Vietnamese download fallback',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeContractsPort port =
        FakeContractsPort(initial: const <ContractSummary>[_existing]);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ContractsScreen(
            port: port,
            orderId: _kOrderId,
            shareImpl: (List<XFile> files, {String? title, String? text}) =>
                Future<AppShareResult>.error(StateError('share failed')),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await _tap(tester, find.text('Tải PDF'));

    expect(find.text('Không tải được file hợp đồng. Vui lòng thử lại.'),
        findsOneWidget);
    expect(port.generateCalls, isEmpty);
  });

  testWidgets('history keeps the port order (newest first)',
      (WidgetTester tester) async {
    _screen(tester);
    const ContractSummary newer = ContractSummary(
      id: 'c-new',
      contractNo: 'HĐMB-123457/2026',
      contractType: 'sale',
      versionNo: 3,
      fileName: 'hop-dong-mua-ban-123457',
      pdfSize: 2048,
      createdAt: '2026-10-22T03:00:00.000Z',
    );
    await _pump(
      tester,
      FakeContractsPort(initial: const <ContractSummary>[newer, _existing]),
    );
    final double newY =
        tester.getTopLeft(find.textContaining('HĐMB-123457/2026')).dy;
    final double oldY =
        tester.getTopLeft(find.textContaining('HĐMB-123456/2026')).dy;
    expect(newY, lessThan(oldY));
  });

  testWidgets('history item shows number · type · version · UTC+7 date',
      (WidgetTester tester) async {
    _screen(tester);
    await _pump(
      tester,
      FakeContractsPort(initial: const <ContractSummary>[_existing]),
    );
    expect(find.text('Hợp đồng đã sinh'.toUpperCase()), findsOneWidget);
    expect(
      find.text('HĐMB-123456/2026 · HĐ Mua bán · Bản 2 · 22/10/2026'),
      findsOneWidget,
    );
  });

  testWidgets('"Tải PDF" downloads that contract id',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeContractsPort port =
        FakeContractsPort(initial: const <ContractSummary>[_existing]);
    final _Shared shared = _Shared();
    await _pump(tester, port, shared: shared);

    await _tap(tester, find.text('Tải PDF'));

    expect(port.generateCalls, isEmpty);
    expect(port.downloadCalls.length, 1);
    expect(port.downloadCalls.single.contractId, 'c-old');
    expect(shared.calls, 1);
  });

  testWidgets('empty history ⇒ empty state', (WidgetTester tester) async {
    _screen(tester);
    await _pump(tester, FakeContractsPort());
    expect(find.text('Chưa sinh hợp đồng nào.'), findsOneWidget);
    expect(find.text('Tải PDF'), findsNothing);
  });

  testWidgets('loading ⇒ skeleton', (WidgetTester tester) async {
    _screen(tester);
    final Completer<ContractsOverview> never = Completer<ContractsOverview>();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ContractsScreen(
            port: _PendingPort(never.future),
            orderId: _kOrderId,
          ),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(AppSkeleton), findsWidgets);
    expect(find.text('Xuất PDF hợp đồng'), findsNothing);
  });

  testWidgets('load error ⇒ error state, "Thử lại" reloads',
      (WidgetTester tester) async {
    _screen(tester);
    final FakeContractsPort port =
        FakeContractsPort(overviewError: StateError('down'));
    await _pump(tester, port);
    expect(find.text('Thử lại'), findsOneWidget);
    expect(find.text('Xuất PDF hợp đồng'), findsNothing);

    port.overviewError = null;
    await _tap(tester, find.text('Thử lại'));

    expect(port.overviewCalls.length, 2);
    expect(find.text('Xuất PDF hợp đồng'), findsOneWidget);
  });

  for (final double width in <double>[320.0, 360.0]) {
    testWidgets('longest labels do not overflow at ${width.toInt()}px',
        (WidgetTester tester) async {
      _screen(tester, width);
      final FakeContractsPort port = FakeContractsPort(
        customerName: 'N' * 80,
        missingPartyFields: const <String>[
          'Tên công ty',
          'Mã số thuế',
          'Địa chỉ',
          'Người đại diện',
          'Chức danh',
          'Điện thoại',
          'Tài khoản ngân hàng',
        ],
        initial: const <ContractSummary>[_existing],
      );
      await _pump(tester, port);
      expect(tester.takeException(), isNull);

      await _tap(tester, find.text('Xuất PDF hợp đồng'));
      expect(tester.takeException(), isNull);
    });

    testWidgets('blocked reason does not overflow at ${width.toInt()}px',
        (WidgetTester tester) async {
      _screen(tester, width);
      await _pump(
        tester,
        FakeContractsPort(
          customerName: 'N' * 80,
          generatable: false,
          blockedReason: _kLongBlocked,
          initial: const <ContractSummary>[_existing],
        ),
      );
      expect(find.text(_kLongBlocked), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}

class _PendingPort extends FakeContractsPort {
  _PendingPort(this._future);

  final Future<ContractsOverview> _future;

  @override
  Future<ContractsOverview> getOverview(String orderId) => _future;
}
