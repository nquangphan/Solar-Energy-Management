// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.4
// — `.chip`/`.ktype`/`.scope-flag` in components.css). Pills: radiusFull, 1.5px
// border, flat (Viền nét).

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

/// Base pill chip (`.chip`): optional leading dot + label. Colours are supplied
/// by the caller (StatusChip passes the canonical status triplet). Purely
/// presentational — no tap handler (a chip is never a control here, UX-DR-23).
class AppChip extends StatelessWidget {
  const AppChip({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    required this.border,
    this.showDot = false,
    this.strikeThrough = false,
    this.fontSize = 11.0,
    this.fontWeight = FontWeight.w700,
  });

  final String label;
  final Color background;
  final Color foreground;
  final Color border;

  /// The `.dot`: a 6px `currentColor` circle at .85 opacity.
  final bool showDot;
  final bool strikeThrough;
  final double fontSize;
  final FontWeight fontWeight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9.0, vertical: 3.0),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDot) ...[
            Container(
              width: 6.0,
              height: 6.0,
              decoration: BoxDecoration(
                color: foreground.withValues(alpha: 0.85),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 5.0),
          ],
          Text(
            label,
            style: TextStyle(
              color: foreground,
              fontFamily: AppTokens.fontFamily,
              fontSize: fontSize,
              fontWeight: fontWeight,
              height: 1.0,
              decoration: strikeThrough
                  ? TextDecoration.lineThrough
                  : TextDecoration.none,
              decorationColor: foreground,
            ),
          ),
        ],
      ),
    );
  }
}

/// Customer-type chip (`.ktype`): lime border on lime050, ink text, 10.5px/w800.
class AppCustomerTypeChip extends StatelessWidget {
  const AppCustomerTypeChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 3.0),
      decoration: BoxDecoration(
        color: AppTokens.lime050,
        border: Border.all(color: AppTokens.lime, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusFull),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppTokens.ink,
          fontFamily: AppTokens.fontFamily,
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          height: 1.0,
        ),
      ),
    );
  }
}

/// Scope flag (`.scope-flag`): `on` = teal border/teal700 text; `off` = line
/// border, muted grey text with a line-through (mirror `.scope-flag.off`).
class AppScopeFlag extends StatelessWidget {
  const AppScopeFlag({super.key, required this.label, required this.on});

  final String label;
  final bool on;

  @override
  Widget build(BuildContext context) {
    final color = on ? AppTokens.teal700 : const Color(0xFF9FB2AD);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 3.0),
      decoration: BoxDecoration(
        color: AppTokens.surface,
        border: Border.all(
          color: on ? AppTokens.teal : AppTokens.line,
          width: AppTokens.borderWidth,
        ),
        borderRadius: BorderRadius.circular(AppTokens.radiusFull),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontFamily: AppTokens.fontFamily,
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          height: 1.0,
          decoration: on ? TextDecoration.none : TextDecoration.lineThrough,
          decorationColor: color,
        ),
      ),
    );
  }
}
