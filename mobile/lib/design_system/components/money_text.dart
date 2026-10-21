// hand-authored — the ONE money formatter + display widget on Flutter. Web
// twins: `formatVnd` (web/src/design-system/components/format-vnd.ts) and
// `<Money>` (Money.tsx). Both formatters are pinned byte-for-byte to
// design-system/money/vnd-format-cases.json.

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

final RegExp _thousands = RegExp(r'\B(?=(\d{3})+(?!\d))');

/// Format an integer amount of đồng for display: `83010960` → `'83.010.960 đ'`,
/// `0` → `'0 đ'`, `-1500000` → `'-1.500.000 đ'` ("." groups thousands, then ONE
/// regular space and a lowercase "đ").
///
/// Presentation only, never arithmetic (AD-10/16): the digits come from
/// `value.toString()` and are grouped by string manipulation. `NumberFormat` /
/// intl are deliberately not used — the web twin must produce the exact same
/// bytes. The `int` parameter makes a fractional amount a compile error.
String formatVnd(int value) {
  final String raw = value.toString();
  final bool negative = raw.startsWith('-');
  final String digits = negative ? raw.substring(1) : raw;
  final String grouped = digits.replaceAll(_thousands, '.');
  return '${negative ? '-' : ''}$grouped đ';
}

/// Displays a money value as `83.010.960 đ` through [formatVnd], with the
/// `mono` token (tabular figures, right-aligned) so columns of amounts line up.
/// Every screen renders money through this widget (or [formatVnd] where a
/// widget takes a plain String) — the money-render guard in design-system/money
/// fails on a raw `'${x.amount}'` / `x.total.toString()`.
///
/// Never clips (UX-DR-26): no maxLines/overflow, the full figure always
/// renders. The text itself is what a screen reader announces.
class MoneyText extends StatelessWidget {
  const MoneyText(this.value, {super.key, this.style});

  /// Integer amount of đồng, exactly as the backend returned it.
  final int value;

  /// Colour/size/weight for the call site. Tabular figures are always applied
  /// on top, so a caller cannot drop the `mono` token by passing a style.
  final TextStyle? style;

  static const TextStyle _base = TextStyle(
    color: AppTokens.ink,
    fontFamily: AppTokens.fontFamily,
    fontSize: 12.5,
  );

  @override
  Widget build(BuildContext context) {
    return Text(
      formatVnd(value),
      textAlign: TextAlign.right,
      style: (style ?? _base).copyWith(
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}
