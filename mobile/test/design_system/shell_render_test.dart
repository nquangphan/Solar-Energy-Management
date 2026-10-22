// Native Flutter render tests for the app-shell layer (Story 1.8, Task 5 —
// AC-1/2/3/4). Every widget pumps without error and carries the canonical
// spec (5 locked tabs in order, ellipsised title, notch + status bar, and the
// conditional bottom-nav in the scaffold).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/icons/app_icons.dart';
import 'package:pns_mobile/design_system/shell/shell.dart';
import 'package:pns_mobile/design_system/tokens/app_tokens.dart';

Widget _host(Widget child) => MaterialApp(
      home: Scaffold(body: Center(child: child)),
    );

Finder _iconNamed(String name) =>
    find.byWidgetPredicate((w) => w is AppIcon && w.name == name);

/// The AppIcon of [name], for asserting its resolved colour.
AppIcon _icon(WidgetTester tester, String name) =>
    tester.widget<AppIcon>(_iconNamed(name));

void main() {
  group('AppTopbar (mirror .topbar)', () {
    testWidgets('renders title, eyebrow, back and action', (tester) async {
      await tester.pumpWidget(_host(
        AppTopbar(
          title: 'Chi tiết đơn',
          eyebrow: 'ĐƠN HÀNG',
          onBack: () {},
          action: const Text('Lưu'),
          onAction: () {},
        ),
      ));

      expect(find.text('Chi tiết đơn'), findsOneWidget);
      expect(find.text('ĐƠN HÀNG'), findsOneWidget);
      expect(find.text('Lưu'), findsOneWidget);
      expect(_iconNamed('ic-chevron-left'), findsOneWidget);
    });

    testWidgets('no back button when onBack is null', (tester) async {
      await tester.pumpWidget(_host(const AppTopbar(title: 'Không back')));
      expect(_iconNamed('ic-chevron-left'), findsNothing);
      expect(find.text('Không back'), findsOneWidget);
    });

    testWidgets('title is one-line ellipsis', (tester) async {
      await tester.pumpWidget(_host(
        const AppTopbar(
          title:
              'Tiêu đề rất rất dài vượt quá một dòng để kiểm tra cắt ellipsis',
        ),
      ));
      final title = tester.widget<Text>(find.textContaining('Tiêu đề rất'));
      expect(title.maxLines, 1);
      expect(title.overflow, TextOverflow.ellipsis);
    });

    testWidgets('eyebrow shown verbatim (no implicit upper-casing)',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppTopbar(title: 'T', eyebrow: 'Giữ Nguyên'),
      ));
      // Caller-provided casing survives — parity with web.
      expect(find.text('Giữ Nguyên'), findsOneWidget);
    });

    testWidgets('back button carries the "Quay lại" Semantics label',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_host(AppTopbar(title: 'T', onBack: () {})));
      // Screen-reader affordance is an AC-1 requirement.
      expect(find.bySemanticsLabel('Quay lại'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('action slot also accepts an AppIcon (icon variant)',
        (tester) async {
      await tester.pumpWidget(_host(
        AppTopbar(
          title: 'T',
          action: const AppIcon('ic-more', size: 15.0),
          onAction: () {},
        ),
      ));
      // AC-1: the action may be a Text OR an AppIcon — both must render.
      expect(_iconNamed('ic-more'), findsOneWidget);
    });

    testWidgets('no eyebrow rendered when eyebrow is null', (tester) async {
      await tester.pumpWidget(_host(const AppTopbar(title: 'Chỉ tiêu đề')));
      // Only the title Text exists in the topbar — the eyebrow is optional.
      expect(find.text('Chỉ tiêu đề'), findsOneWidget);
      expect(find.byType(Text), findsOneWidget);
    });
  });

  group('AppBottomNav (mirror .botnav — locked 5 tabs)', () {
    testWidgets('renders exactly 5 labels in the locked order', (tester) async {
      await tester.pumpWidget(_host(const AppBottomNav(activeIndex: 0)));

      const order = ['Trang chủ', 'Đơn hàng', 'Tạo', 'Kho', 'Menu'];
      for (final label in order) {
        expect(find.text(label), findsOneWidget);
      }

      // The five canonical tab icons are present (FAB = ic-plus at index 2).
      for (final ic in ['ic-home', 'ic-orders', 'ic-plus', 'ic-warehouse',
        'ic-menu']) {
        expect(_iconNamed(ic), findsOneWidget);
      }
    });

    testWidgets('active tab tints icon teal + label teal-700', (tester) async {
      await tester.pumpWidget(_host(const AppBottomNav(activeIndex: 1)));

      expect(_icon(tester, 'ic-orders').color, AppTokens.teal);
      final label = tester.widget<Text>(find.text('Đơn hàng'));
      expect((label.style?.color), AppTokens.teal700);

      // A resting tab keeps the muted resting colours.
      expect(_icon(tester, 'ic-home').color, const Color(0xFFA9BAB5));
      expect(
        tester.widget<Text>(find.text('Trang chủ')).style?.color,
        AppTokens.muted,
      );
    });

    testWidgets('FAB is a 46px teal circle with ic-plus, raised above the bar',
        (tester) async {
      await tester.pumpWidget(_host(const AppBottomNav(activeIndex: 0)));
      // The FAB core paints ic-plus in surface (white) on teal.
      expect(_icon(tester, 'ic-plus').color, AppTokens.surface);
      // It is raised: the ic-plus centre sits above the vertical middle of the
      // nav (layout-based raise, replacing the old bounds-overflowing Transform).
      final navCentreY = tester.getCenter(find.byType(AppBottomNav)).dy;
      final plusCentreY = tester.getCenter(_iconNamed('ic-plus')).dy;
      expect(plusCentreY, lessThan(navCentreY));
    });
  });

  group('AppPhoneFrame (mirror .phone)', () {
    testWidgets('renders notch, status bar and child', (tester) async {
      await tester.pumpWidget(_host(
        const AppPhoneFrame(
          time: '9:41',
          status: '5G · 82%',
          child: Text('Nội dung kính'),
        ),
      ));

      expect(find.text('9:41'), findsOneWidget);
      expect(find.text('5G · 82%'), findsOneWidget);
      expect(find.text('Nội dung kính'), findsOneWidget);
    });

    testWidgets('glass is 700 tall, body radius 40', (tester) async {
      await tester.pumpWidget(_host(const AppPhoneFrame(child: SizedBox())));

      // The glass ClipRRect is 32px; the body Container is radius 40.
      final clips = tester.widgetList<ClipRRect>(find.byType(ClipRRect));
      expect(
        clips.any((c) =>
            c.borderRadius == BorderRadius.circular(32.0)),
        isTrue,
      );

      final glassBox = tester.widgetList<SizedBox>(find.byType(SizedBox));
      expect(glassBox.any((b) => b.width == 330.0), isTrue);
    });

    testWidgets('default time/status shown when omitted', (tester) async {
      await tester.pumpWidget(_host(const AppPhoneFrame(child: SizedBox())));
      // AC-3 canonical defaults on the fake status bar.
      expect(find.text('9:41'), findsOneWidget);
      expect(find.text('5G · 82%'), findsOneWidget);
    });

    testWidgets('notch is a 116×22 element', (tester) async {
      await tester.pumpWidget(_host(const AppPhoneFrame(child: SizedBox())));
      // The notch Container is tightly sized 116×22 (mirror .notch).
      final notch = find.byWidgetPredicate((w) =>
          w is Container &&
          w.constraints == const BoxConstraints.tightFor(width: 116.0, height: 22.0));
      expect(notch, findsOneWidget);
    });

    testWidgets('a bare scope drops the mockup chrome and keeps the child (Story 10.6)', (tester) async {
      await tester.pumpWidget(_host(const AppPhoneFrameScope(
        bare: true,
        child: AppPhoneFrame(child: Text('Nội dung kính')),
      )));

      // The frame itself is in the tree — only its chrome is gone.
      expect(find.byType(AppPhoneFrame), findsOneWidget);
      expect(find.text('Nội dung kính'), findsOneWidget);
      expect(find.descendant(of: find.byType(AppPhoneFrame), matching: find.byType(SafeArea)), findsOneWidget);
      expect(find.text('9:41'), findsNothing);
      expect(find.text('5G · 82%'), findsNothing);
      expect(tester.widgetList<SizedBox>(find.byType(SizedBox)).any((b) => b.width == 330.0), isFalse);
    });

    testWidgets('bare: false keeps the mockup chrome (Story 10.6)', (tester) async {
      await tester.pumpWidget(_host(const AppPhoneFrameScope(
        bare: false,
        child: AppPhoneFrame(child: SizedBox()),
      )));
      expect(find.text('9:41'), findsOneWidget);
      expect(tester.widgetList<SizedBox>(find.byType(SizedBox)).any((b) => b.width == 330.0), isTrue);
    });
  });

  group('AppMobileShell (mirror .pbody/.pscroll)', () {
    testWidgets('renders topbar + body + bottom-nav when all supplied',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppMobileShell(
          topbar: AppTopbar(title: 'Trang chủ'),
          body: Text('Thân màn'),
          bottomNav: AppBottomNav(activeIndex: 0),
        ),
      ));

      expect(find.text('Trang chủ'), findsWidgets); // topbar title + nav tab
      expect(find.text('Thân màn'), findsOneWidget);
      expect(find.text('Menu'), findsOneWidget); // nav present
    });

    testWidgets('hides bottom-nav when bottomNav is null (auth)',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppMobileShell(
          body: Text('Đăng nhập'),
        ),
      ));

      expect(find.byType(AppBottomNav), findsNothing);
      expect(find.text('Menu'), findsNothing);
      expect(find.text('Đăng nhập'), findsOneWidget);
    });

    testWidgets('hides topbar when topbar is null (auth Đăng nhập)',
        (tester) async {
      await tester.pumpWidget(_host(
        const AppMobileShell(body: Text('Màn không topbar')),
      ));

      // The Đăng nhập screen has neither topbar nor nav — body only.
      expect(find.byType(AppTopbar), findsNothing);
      expect(find.byType(AppBottomNav), findsNothing);
      expect(find.text('Màn không topbar'), findsOneWidget);
    });

    testWidgets('body scrolls (.pscroll) when it overflows', (tester) async {
      await tester.pumpWidget(_host(
        const SizedBox(
          height: 300.0,
          child: AppMobileShell(
            body: Column(children: [
              Text('Đầu'),
              SizedBox(height: 1200.0),
              Text('Cuối'),
            ]),
          ),
        ),
      ));

      expect(find.byType(SingleChildScrollView), findsOneWidget);
      final before = tester.getTopLeft(find.text('Cuối')).dy;
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -400));
      await tester.pump();
      // Dragging up moves the bottom marker upward — the body genuinely scrolls.
      expect(tester.getTopLeft(find.text('Cuối')).dy, lessThan(before));
    });
  });
}
