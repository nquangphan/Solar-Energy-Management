// Source-level invariant guards for the app-shell layer (Story 1.8, Task 5 —
// AC-5). These read each shell file AS TEXT and assert the forbidden patterns
// never appear — the same anti-drift approach as Story 1.4/1.7.
//
// Comments and string literals are stripped BEFORE scanning so a banned word in
// a doc comment (e.g. "no BoxShadow") can never cause a false failure.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const _dir = 'lib/design_system/shell';

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

List<String> _shellFiles() => Directory(_dir)
    .listSync()
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'))
    .map((f) => f.path.split('/').last)
    .toList();

void main() {
  group('Viền nét — flat, no decorative depth (AC-5a)', () {
    // The ring FAB is the ONE sanctioned exception, but it is built from nested
    // Containers with 0 blur — so even it must NOT use a BoxShadow.
    final banned = RegExp(
      r'BoxShadow|elevation:\s*[1-9]|Shadow\(|LinearGradient|RadialGradient',
    );

    test('no shell file uses a shadow/gradient/positive elevation', () {
      for (final file in _shellFiles()) {
        final match = banned.firstMatch(_code(file));
        expect(match, isNull,
            reason: '$file introduced a decorative depth effect: '
                '${match?.group(0)}');
      }
    });

    test('no Material AppBar/BottomNavigationBar/Scaffold in the shell', () {
      final material = RegExp(r'\bAppBar\b|BottomNavigationBar|\bScaffold\b');
      for (final file in _shellFiles()) {
        expect(material.hasMatch(_code(file)), isFalse,
            reason: '$file leaked a Material chrome widget (adds elevation)');
      }
    });
  });

  group('Bottom-nav locked to 5 tabs (AC-2, AC-5)', () {
    late String code;
    setUp(() => code = File('$_dir/app_bottom_nav.dart').readAsStringSync());

    test('declares an assert on exactly 5 tabs', () {
      expect(RegExp(r'assert\(\s*_tabs\.length\s*==\s*5').hasMatch(code), isTrue,
          reason: 'the 5-tab lock must be asserted');
    });

    test('the 5 canonical labels are present in order', () {
      const order = ['Trang chủ', 'Đơn hàng', 'Tạo', 'Kho', 'Menu'];
      var cursor = 0;
      for (final label in order) {
        final at = code.indexOf(label, cursor);
        expect(at, greaterThanOrEqualTo(0),
            reason: 'missing locked tab label "$label"');
        cursor = at + label.length;
      }
    });

    test('no constructor accepts a tabs list (cannot be overridden)', () {
      final stripped = _code('app_bottom_nav.dart');
      expect(RegExp(r'List<[^>]*>\s+tabs').hasMatch(stripped), isFalse,
          reason: 'tabs must stay an internal const, never a prop');
    });
  });

  group('Pure presentation — no network / no router (AC-5c)', () {
    test('no shell file imports io/http/dio/a router', () {
      final banned = RegExp(
        r'''import\s+['"](dart:io|package:http/|package:dio/|package:go_router/|package:auto_route/)''',
      );
      for (final file in _shellFiles()) {
        // imports live outside strings after stripping bodies only, so scan raw.
        final raw = File('$_dir/$file').readAsStringSync();
        expect(banned.hasMatch(raw), isFalse,
            reason: '$file imported a network/navigation package');
      }
    });

    test('no navigation or network calls in shell code', () {
      final banned = RegExp(
        r'Navigator\.|\.push\(|\.pop\(|HttpClient|\.get\(|\.post\(',
      );
      for (final file in _shellFiles()) {
        final match = banned.firstMatch(_code(file));
        expect(match, isNull,
            reason: '$file performs navigation/network: ${match?.group(0)}');
      }
    });
  });

  group('No ad-hoc hex — tokens or canonical shell literals only (AC-5b)', () {
    // The only raw Color literals allowed in the shell are the two canonical
    // mockup values absent from AppTokens.
    const allowed = {'0xFF0C1512', '0xFFA9BAB5'};

    test('every raw 0xFF colour literal is an approved shell constant', () {
      final hex = RegExp(r'0x[Ff][Ff][0-9A-Fa-f]{6}');
      for (final file in _shellFiles()) {
        for (final m in hex.allMatches(_code(file))) {
          expect(allowed.contains(m.group(0)), isTrue,
              reason: '$file uses an ad-hoc hex ${m.group(0)} — '
                  'use AppTokens or an approved shell literal');
        }
      }
    });
  });
}
