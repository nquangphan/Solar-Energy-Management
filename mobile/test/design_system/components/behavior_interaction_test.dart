// Native Flutter interaction guard for the behaviour layer (Story 1.7, Task 7 —
// AC-2). Exercises the invariants at RUNTIME (not just source): the cart never
// derives the amount, the picker only emits files, share only calls the sheet,
// and overlays only emit intent.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';
import 'package:pns_mobile/design_system/icons/app_icons.dart';

Finder _iconNamed(String name) =>
    find.byWidgetPredicate((w) => w is AppIcon && w.name == name);

Widget _host(Widget child) =>
    MaterialApp(home: Scaffold(body: Center(child: child)));

/// Hosts a cart line and removes it once onDelete fires, mirroring how a real
/// screen drops the swiped line — so the Dismissible test never trips the
/// "dismissed widget still in the tree" assertion.
class _DismissHost extends StatefulWidget {
  const _DismissHost({required this.onDeleted});
  final VoidCallback onDeleted;
  @override
  State<_DismissHost> createState() => _DismissHostState();
}

class _DismissHostState extends State<_DismissHost> {
  bool _gone = false;
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: _gone
              ? const SizedBox.shrink()
              : AppCartLineRow(
                  name: 'Tấm pin',
                  qty: 1,
                  unitPrice: 100,
                  amount: 100,
                  onDelete: () {
                    widget.onDeleted();
                    setState(() => _gone = true);
                  },
                ),
        ),
      ),
    );
  }
}

void main() {
  group('AppCartLineRow — money invariant (AD-10/16)', () {
    testWidgets('renders backend amount, never qty × unitPrice',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppCartLineRow(
          name: 'Tấm pin 550W',
          qty: 2,
          unitPrice: 500,
          amount: 999, // deliberately != 2 * 500
        ),
      ));
      expect(find.text('999'), findsOneWidget);
      expect(find.text('1000'), findsNothing);
    });

    testWidgets('editing qty emits the new number, amount stays put',
        (tester) async {
      num? emitted;
      await tester.pumpWidget(_host(
        AppCartLineRow(
          name: 'Tấm pin',
          qty: 2,
          unitPrice: 500,
          amount: 999,
          editable: true,
          onQtyChange: (q) => emitted = q,
        ),
      ));
      await tester.enterText(find.byType(TextField).first, '3');
      await tester.pump();
      expect(emitted, 3);
      // The displayed amount did NOT recompute — it waits for the backend.
      expect(find.text('999'), findsOneWidget);
    });

    testWidgets('editing unit price emits onUnitPriceChange, amount stays put',
        (tester) async {
      num? emitted;
      await tester.pumpWidget(_host(
        AppCartLineRow(
          name: 'Tấm pin',
          qty: 2,
          unitPrice: 500,
          amount: 999,
          editable: true,
          onUnitPriceChange: (p) => emitted = p,
        ),
      ));
      // Two editable fields: qty first, unit price second.
      await tester.enterText(find.byType(TextField).at(1), '750');
      await tester.pump();
      expect(emitted, 750);
      // Still the backend amount — the widget never recomputes qty × price.
      expect(find.text('999'), findsOneWidget);
    });

    testWidgets('delete emits intent only', (tester) async {
      var deleted = false;
      await tester.pumpWidget(_host(
        AppCartLineRow(
          name: 'Tấm pin',
          qty: 1,
          unitPrice: 100,
          amount: 100,
          onDelete: () => deleted = true,
        ),
      ));
      await tester.tap(find.byType(AppButton));
      await tester.pump();
      expect(deleted, isTrue);
    });

    testWidgets('swipe dismisses the row and emits onDelete (UX-DR-24)',
        (tester) async {
      var deleted = false;
      await tester.pumpWidget(_DismissHost(onDeleted: () => deleted = true));
      // endToStart swipe (drag left) triggers the Dismissible → onDelete.
      await tester.drag(find.byType(Dismissible), const Offset(-500, 0));
      await tester.pumpAndSettle();
      expect(deleted, isTrue);
    });
  });

  group('AppField — controlled value resync (React parity)', () {
    testWidgets('reflects a new value pushed by the parent', (tester) async {
      final value = ValueNotifier<String>('7');
      addTearDown(value.dispose);
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Center(
            child: ValueListenableBuilder<String>(
              valueListenable: value,
              builder: (_, v, __) => AppField(value: v),
            ),
          ),
        ),
      ));
      expect(find.text('7'), findsOneWidget);

      // e.g. the screen clamped qty 7 → 2 and pushed it back down.
      value.value = '2';
      await tester.pump();
      expect(find.text('2'), findsOneWidget);
      expect(find.text('7'), findsNothing);
    });
  });

  group('AppImageUpload — no-upload (AD-3)', () {
    testWidgets('add → sheet → pick emits files via onAdd, no network',
        (tester) async {
      List<XFile>? added;
      Future<List<XFile>> fakePick(ImageSource _) async =>
          [XFile('/tmp/fake.jpg')];

      await tester.pumpWidget(_host(
        AppImageUpload(
          images: const [],
          pick: fakePick,
          onAdd: (files) => added = files,
        ),
      ));

      // Tap the dashed add tile (its ic-plus glyph) → the pick sheet opens.
      await tester.tap(_iconNamed('ic-plus'));
      await tester.pumpAndSettle();
      expect(find.text('Chụp ảnh'), findsOneWidget);

      await tester.tap(find.text('Chụp ảnh'));
      await tester.pumpAndSettle();

      expect(added, isNotNull);
      expect(added!.length, 1);
    });

    testWidgets('gallery option picks from the library via onAdd',
        (tester) async {
      List<XFile>? added;
      ImageSource? usedSource;
      Future<List<XFile>> fakePick(ImageSource source) async {
        usedSource = source;
        return [XFile('/tmp/lib.jpg')];
      }

      await tester.pumpWidget(_host(
        AppImageUpload(
          images: const [],
          pick: fakePick,
          onAdd: (files) => added = files,
        ),
      ));

      await tester.tap(_iconNamed('ic-plus'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chọn từ thư viện'));
      await tester.pumpAndSettle();

      expect(usedSource, ImageSource.gallery);
      expect(added, isNotNull);
      expect(added!.length, 1);
    });

    testWidgets('remove emits the item id only', (tester) async {
      String? removed;
      await tester.pumpWidget(_host(
        AppImageUpload(
          images: const [AppUploadItem(id: 'img-1')],
          onAdd: (_) {},
          onRemove: (id) => removed = id,
        ),
      ));
      await tester.tap(_iconNamed('ic-close'));
      await tester.pump();
      expect(removed, 'img-1');
    });

    testWidgets('reaching max hides the add tile (UX-DR-25)', (tester) async {
      await tester.pumpWidget(_host(
        AppImageUpload(
          images: const [AppUploadItem(id: 'a'), AppUploadItem(id: 'b')],
          max: 2,
          onAdd: (_) {},
        ),
      ));
      // No add tile → its ic-plus glyph is absent.
      expect(_iconNamed('ic-plus'), findsNothing);
    });
  });

  group('AppShareButton', () {
    testWidgets('tap calls the injected share impl with the files',
        (tester) async {
      List<XFile>? shared;
      final files = [XFile('/tmp/a.jpg'), XFile('/tmp/b.pdf')];

      await tester.pumpWidget(_host(
        AppShareButton(
          files: files,
          shareImpl: (f, {title, text}) async {
            shared = f;
            return AppShareResult.shared;
          },
        ),
      ));
      await tester.tap(find.byType(AppButton));
      await tester.pump();
      expect(shared, isNotNull);
      expect(shared!.first.path, '/tmp/a.jpg'); // image ordered before pdf
    });

    testWidgets('a dismissed share resolves via onResult without throwing',
        (tester) async {
      AppShareResult? got;
      await tester.pumpWidget(_host(
        AppShareButton(
          files: [XFile('/tmp/a.jpg')],
          shareImpl: (f, {title, text}) async => AppShareResult.dismissed,
          onResult: (r) => got = r,
        ),
      ));
      await tester.tap(find.byType(AppButton));
      await tester.pump();
      expect(got, AppShareResult.dismissed);
    });
  });

  group('overlays — intent only (AD-11)', () {
    testWidgets('AppConfirmDialog confirm emits intent then closes',
        (tester) async {
      var confirmed = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: AppButton(
                label: 'Mở',
                onPressed: () => showAppDialog<void>(
                  context: context,
                  child: AppConfirmDialog(
                    title: 'Huỷ đơn?',
                    consequence: 'Đơn sẽ chuyển sang trạng thái Huỷ.',
                    onConfirm: () => confirmed = true,
                  ),
                ),
              ),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Mở'));
      await tester.pumpAndSettle();
      expect(find.text('Huỷ đơn?'), findsOneWidget);

      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      expect(confirmed, isTrue);
      expect(find.text('Huỷ đơn?'), findsNothing); // dialog closed
    });

    testWidgets('AppConfirmDialog cancel emits onCancel, not onConfirm, closes',
        (tester) async {
      var confirmed = false;
      var cancelled = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: AppButton(
                label: 'Mở',
                onPressed: () => showAppDialog<void>(
                  context: context,
                  child: AppConfirmDialog(
                    title: 'Huỷ đơn?',
                    consequence: 'Đơn sẽ chuyển sang trạng thái Huỷ.',
                    onConfirm: () => confirmed = true,
                    onCancel: () => cancelled = true,
                  ),
                ),
              ),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Mở'));
      await tester.pumpAndSettle();
      // The cancel button's exact label is 'Huỷ' (≠ the title 'Huỷ đơn?').
      await tester.tap(find.text('Huỷ'));
      await tester.pumpAndSettle();
      expect(cancelled, isTrue);
      expect(confirmed, isFalse);
      expect(find.text('Huỷ đơn?'), findsNothing); // dialog closed
    });

    testWidgets('barrier dismiss fires onCancel, not onConfirm (web parity)',
        (tester) async {
      var confirmed = false;
      var cancelled = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: AppButton(
                label: 'Mở',
                onPressed: () => showAppDialog<void>(
                  context: context,
                  child: AppConfirmDialog(
                    title: 'Huỷ đơn?',
                    consequence: 'Đơn sẽ chuyển sang trạng thái Huỷ.',
                    onConfirm: () => confirmed = true,
                    onCancel: () => cancelled = true,
                  ),
                ),
              ),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Mở'));
      await tester.pumpAndSettle();
      // Tap the dimmed barrier away from the dialog card.
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();
      expect(cancelled, isTrue);
      expect(confirmed, isFalse);
      expect(find.text('Huỷ đơn?'), findsNothing);
    });

    testWidgets('AppSheet opens and closes via barrier tap', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: AppButton(
                label: 'Sheet',
                onPressed: () => showAppSheet<void>(
                  context: context,
                  child: const AppSheet(
                    title: 'Chia sẻ',
                    body: Text('nội dung'),
                  ),
                ),
              ),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Sheet'));
      await tester.pumpAndSettle();
      expect(find.text('nội dung'), findsOneWidget);

      // Tap the barrier (top-left, away from the bottom sheet).
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();
      expect(find.text('nội dung'), findsNothing);
    });
  });
}
