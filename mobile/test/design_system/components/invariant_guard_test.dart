// Source-level invariant guards for the widget parity layer (Story 1.7, Task 7
// — AC-1/2). These read each component file AS TEXT and assert the forbidden
// patterns never appear — the same anti-drift approach as web Story 1.6.
//
// Comments and string literals are stripped BEFORE scanning so a banned word in
// a doc comment (e.g. "no BoxShadow") can never cause a false failure — the
// lesson carried from Stories 1.4/1.5/1.6.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const _dir = 'lib/design_system/components';

/// Removes // line comments, /* */ block comments, and '...'/"..." string
/// bodies so only executable Dart tokens remain.
String _stripCommentsAndStrings(String src) {
  final buf = StringBuffer();
  var i = 0;
  while (i < src.length) {
    final two = i + 1 < src.length ? src.substring(i, i + 2) : '';
    if (two == '//') {
      while (i < src.length && src[i] != '\n') {
        i++;
      }
    } else if (two == '/*') {
      i += 2;
      while (i + 1 < src.length && src.substring(i, i + 2) != '*/') {
        i++;
      }
      i += 2;
    } else if (src[i] == "'" || src[i] == '"') {
      final quote = src[i];
      i++;
      while (i < src.length && src[i] != quote) {
        if (src[i] == r'\') i++;
        i++;
      }
      i++;
    } else {
      buf.write(src[i]);
      i++;
    }
  }
  return buf.toString();
}

String _code(String file) =>
    _stripCommentsAndStrings(File('$_dir/$file').readAsStringSync());

List<String> _allComponentFiles() => Directory(_dir)
    .listSync()
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'))
    .map((f) => f.path.split('/').last)
    .toList();

void main() {
  group('Viền nét — no decorative depth (AC-1)', () {
    final banned = RegExp(
      r'BoxShadow|elevation:\s*[1-9]|Shadow\(|LinearGradient|RadialGradient',
    );

    test('no component file uses a shadow/gradient/positive elevation', () {
      for (final file in _allComponentFiles()) {
        final code = _code(file);
        final match = banned.firstMatch(code);
        expect(match, isNull,
            reason: '$file introduced a decorative depth effect: '
                '${match?.group(0)}');
      }
    });

    test('overlays force elevation: 0 on the Material surfaces', () {
      expect(_code('sheet.dart').contains('elevation: 0'), isTrue,
          reason: 'showModalBottomSheet must be flat (elevation: 0)');
    });
  });

  group('CartLineRow — no money arithmetic (AD-10/16)', () {
    late String code;
    setUp(() => code = _code('cart_line_row.dart'));

    test('never multiplies qty by unitPrice', () {
      final money = RegExp(
        r'qty\s*\*\s*unit|unit\w*\s*\*\s*qty|\*\s*unitPrice|qty\s*\*',
        caseSensitive: false,
      );
      expect(money.hasMatch(code), isFalse,
          reason: 'cart line must render the backend amount, never compute it');
    });

    test('renders amount and exposes the change/delete callbacks', () {
      expect(code.contains('amount'), isTrue);
      expect(code.contains('onQtyChange'), isTrue);
      expect(code.contains('onUnitPriceChange'), isTrue);
      expect(code.contains('onDelete'), isTrue);
    });
  });

  group('ImageUpload — no upload / no network (AD-3)', () {
    test('never touches the network or an upload API', () {
      final code = _code('image_upload.dart');
      final banned = RegExp(
        r'http|dio|HttpClient|R2|signed|\.upload\(|fetch',
        caseSensitive: false,
      );
      final match = banned.firstMatch(code);
      expect(match, isNull,
          reason: 'image upload leaked a network/upload call: '
              '${match?.group(0)}');
      expect(code.contains('onAdd'), isTrue);
    });
  });

  group('Overlays — intent only, no status mutation (AD-11)', () {
    test('dialog never applies a status transition', () {
      final code = _code('dialog.dart');
      final banned = RegExp(r'applyTransition|Order\.status|status\s*=',
          caseSensitive: false);
      expect(banned.hasMatch(code), isFalse,
          reason:
              'a confirm dialog only emits intent — the backend transitions');
      expect(code.contains('onConfirm'), isTrue);
    });
  });

  group('ShareButton — native share, not a hand-drawn grid', () {
    test('uses share_plus and never builds its own app grid', () {
      final code = _code('share_button.dart');
      expect(code.contains('Share.shareXFiles'), isTrue,
          reason: 'share must delegate to the OS share sheet (share_plus)');
    });
  });
}
