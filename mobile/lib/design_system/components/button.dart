// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.3
// Button.tsx / .btn in components.css). Presentation-only StatelessWidget: it
// takes a label/icon/onPressed and nothing more. Flat "Viền nét": a 1.5px
// border + surface step, never a BoxShadow/elevation (that is why this is a
// GestureDetector + Container, not ElevatedButton/Material which add shadow).

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';

/// The 5 button variants (= `.btn--*` in components.css). `outline` is the base
/// `.btn` rule (teal border on surface); the rest override colour only.
enum AppButtonVariant { outline, primary, accent, ghost, danger }

/// Two sizes: `normal` (`.btn`) and `sm` (`.btn--sm`).
enum AppButtonSize { normal, sm }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    this.label,
    this.icon,
    this.onPressed,
    this.variant = AppButtonVariant.outline,
    this.size = AppButtonSize.normal,
    this.wide = false,
    this.child,
  });

  /// Text label. Ignored when [child] is supplied.
  final String? label;

  /// Canonical icon name (e.g. `ic-share`) rendered at 15px in the left slot.
  final String? icon;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;

  /// Full-width (`.btn--wide`).
  final bool wide;

  /// Custom content; overrides [label].
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final small = size == AppButtonSize.sm;
    final colors = _colors(variant);

    final content = DefaultTextStyle(
      style: TextStyle(
        color: colors.fg,
        fontFamily: AppTokens.fontFamily,
        fontSize: small ? 11.5 : 13.0,
        fontWeight: FontWeight.w800,
        height: 1.0,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[
            AppIcon(icon!, size: 15.0, color: colors.fg),
            const SizedBox(width: 6.0),
          ],
          if (child != null) child! else if (label != null) Text(label!),
        ],
      ),
    );

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: GestureDetector(
        onTap: onPressed,
        behavior: HitTestBehavior.opaque,
        // A11y floor (Story 1.10, UX-DR-26): floor the button height at ≥48dp
        // (tapTargetMin). The horizontal padding is unchanged; a button shorter
        // than the floor grows up to it (the whole button IS the touch target),
        // mirroring the web `.btn{min-height:44px}` rule.
        child: ConstrainedBox(
          constraints:
              const BoxConstraints(minHeight: AppTokens.tapTargetMin),
          child: Container(
            width: wide ? double.infinity : null,
            alignment: Alignment.center,
            padding: small
                ? const EdgeInsets.symmetric(horizontal: 10.0, vertical: 5.0)
                : const EdgeInsets.symmetric(horizontal: 15.0, vertical: 9.0),
            decoration: BoxDecoration(
              color: colors.bg,
              border: Border.all(
                  color: colors.border, width: AppTokens.borderWidth),
              borderRadius: BorderRadius.circular(
                small ? AppTokens.radiusSm : AppTokens.radiusDefault,
              ),
            ),
            child: content,
          ),
        ),
      ),
    );
  }

  _ButtonColors _colors(AppButtonVariant v) {
    switch (v) {
      case AppButtonVariant.outline:
        return const _ButtonColors(
            bg: AppTokens.surface,
            fg: AppTokens.teal700,
            border: AppTokens.teal);
      case AppButtonVariant.primary:
        return const _ButtonColors(
            bg: AppTokens.teal, fg: AppTokens.surface, border: AppTokens.teal);
      case AppButtonVariant.accent:
        return const _ButtonColors(
            bg: AppTokens.lime050,
            fg: AppTokens.lime600,
            border: AppTokens.lime);
      case AppButtonVariant.ghost:
        return const _ButtonColors(
            bg: AppTokens.surface, fg: AppTokens.ink2, border: AppTokens.line);
      case AppButtonVariant.danger:
        return const _ButtonColors(
            bg: AppTokens.surface,
            fg: AppTokens.danger,
            border: AppTokens.danger);
    }
  }
}

class _ButtonColors {
  const _ButtonColors(
      {required this.bg, required this.fg, required this.border});
  final Color bg;
  final Color fg;
  final Color border;
}
