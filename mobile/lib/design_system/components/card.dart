// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.3
// Card.tsx / Frame.tsx — `.card`/`.frame` in components.css). Flat containers:
// a 1.5px border + surface, no elevation (Viền nét).

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

/// Card border colour variants (= `.card--ink` / `.card--teal`). `warn`/`danger`
/// flag a card whose row needs attention (Tồn kho: hết khả dụng / khả dụng âm).
enum AppCardVariant { line, ink, teal, warn, danger }

/// Surface card: `surface` fill, 1.5px border, `radiusLg`. The border colour
/// steps up for the `ink`/`teal` variants (mirror `.card--ink/--teal`).
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.variant = AppCardVariant.line,
    this.padding,
  });

  final Widget child;
  final AppCardVariant variant;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppTokens.surface,
        border: Border.all(color: _borderColor, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusLg),
      ),
      child: child,
    );
  }

  Color get _borderColor {
    switch (variant) {
      case AppCardVariant.line:
        return AppTokens.line;
      case AppCardVariant.ink:
        return AppTokens.ink;
      case AppCardVariant.teal:
        return AppTokens.teal;
      case AppCardVariant.warn:
        return AppTokens.warn;
      case AppCardVariant.danger:
        return AppTokens.danger;
    }
  }
}

/// Blueprint frame: `ink` 1.5px border, `radiusLg`, with a micro-uppercase
/// [label] straddling the top border at `top:-8, left:14` on a `surface`
/// background (mirror `.frame > .frame-label`). Built with a Stack + Positioned.
class AppFrame extends StatelessWidget {
  const AppFrame({
    super.key,
    required this.child,
    this.label,
    this.onBg = false,
    this.padding = const EdgeInsets.all(AppTokens.space16),
  });

  final Widget child;

  /// Label text painted over the top border. Micro-uppercase, weight 800.
  final String? label;

  /// When the frame sits on `bg` (not `surface`), the label background matches
  /// so it still cuts the border cleanly (mirror `.frame.on-bg > .frame-label`).
  final bool onBg;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final frame = Container(
      margin: const EdgeInsets.only(top: 8.0),
      padding: padding,
      decoration: BoxDecoration(
        color: AppTokens.surface,
        border: Border.all(color: AppTokens.ink, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusLg),
      ),
      child: child,
    );

    if (label == null) return frame;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        frame,
        Positioned(
          top: 0.0,
          left: 14.0,
          child: Container(
            color: onBg ? AppTokens.bg : AppTokens.surface,
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: Text(
              label!.toUpperCase(),
              style: const TextStyle(
                color: AppTokens.ink,
                fontFamily: AppTokens.fontFamily,
                fontSize: 10.0,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.08 * 10.0,
                height: 1.0,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
