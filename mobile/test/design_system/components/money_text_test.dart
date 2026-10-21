// Flutter half of the money-format parity lane: the Dart formatVnd must produce
// exactly the strings in the shared fixture ../design-system/money/vnd-format-cases.json
// (the web formatVnd is checked against the same file by
// design-system/money/format-vnd.test.mjs). Plus MoneyText applies the formatter
// and the `mono` token (tabular figures, right-aligned) and never clips.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/components/components.dart';

// `flutter test` runs with mobile/ as the working directory.
const _fixture = '../design-system/money/vnd-format-cases.json';

List<Map<String, dynamic>> _cases() {
  final Map<String, dynamic> json =
      jsonDecode(File(_fixture).readAsStringSync()) as Map<String, dynamic>;
  return (json['cases'] as List<dynamic>).cast<Map<String, dynamic>>();
}

Widget _host(Widget child) => Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: child),
    );

void main() {
  group('formatVnd — shared fixture parity', () {
    test('the fixture is not empty', () {
      expect(_cases().length, greaterThanOrEqualTo(9));
    });

    test('matches every fixture case byte-for-byte', () {
      for (final Map<String, dynamic> c in _cases()) {
        final int input = c['input'] as int;
        expect(formatVnd(input), c['expected'] as String,
            reason: 'formatVnd($input)');
      }
    });
  });

  group('MoneyText', () {
    testWidgets('displays the formatted value, not the raw integer',
        (tester) async {
      await tester.pumpWidget(_host(const MoneyText(83010960)));
      expect(find.text('83.010.960 đ'), findsOneWidget);
      expect(find.text('83010960'), findsNothing);
    });

    testWidgets('applies tabular figures + right alignment and never clips',
        (tester) async {
      await tester.pumpWidget(_host(const MoneyText(
        -1500000,
        style: TextStyle(fontWeight: FontWeight.w800),
      )));
      final Text text = tester.widget<Text>(find.text('-1.500.000 đ'));
      expect(text.textAlign, TextAlign.right);
      expect(text.style!.fontFeatures,
          contains(const FontFeature.tabularFigures()));
      // A caller style keeps its own weight; the mono token is layered on top.
      expect(text.style!.fontWeight, FontWeight.w800);
      expect(text.maxLines, isNull);
      expect(text.overflow, isNull);
    });
  });
}
