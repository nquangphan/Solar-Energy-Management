// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.5
// Banner.tsx — `.banner*` in components.css lines 89-94). Flat callout: 1.5px
// tone border + tinted fill (Viền nét). The three tone hex pairs are canonical
// component constants copied verbatim from web (parity-guarded), NOT tokens.

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';

/// Banner tones (= `.banner` base / `.banner--info` / `.banner--danger`).
enum AppBannerTone { warn, info, danger }

class AppBanner extends StatelessWidget {
  const AppBanner({
    super.key,
    this.message,
    this.child,
    this.icon,
    this.tone = AppBannerTone.warn,
  });

  /// Plain text body. Ignored when [child] is supplied.
  final String? message;

  /// Rich body (e.g. Text.rich with bold spans) overriding [message].
  final Widget? child;

  /// Optional leading icon name, rendered at 16px in the tone colour.
  final String? icon;
  final AppBannerTone tone;

  @override
  Widget build(BuildContext context) {
    final c = _colors(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
      decoration: BoxDecoration(
        color: c.background,
        border: Border.all(color: c.border, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusDefault),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Padding(
              padding: const EdgeInsets.only(top: 1.0),
              child: AppIcon(icon!, size: 16.0, color: c.foreground),
            ),
            const SizedBox(width: 9.0),
          ],
          Flexible(
            child: DefaultTextStyle(
              style: TextStyle(
                color: c.foreground,
                fontFamily: AppTokens.fontFamily,
                fontSize: 12.0,
                fontWeight: FontWeight.w600,
              ),
              child: child ?? Text(message ?? ''),
            ),
          ),
        ],
      ),
    );
  }

  _BannerColors _colors(AppBannerTone t) {
    switch (t) {
      case AppBannerTone.warn:
        return const _BannerColors(
            Color(0xFFFBF0DA), Color(0xFF8A5C08), AppTokens.warn);
      case AppBannerTone.info:
        return const _BannerColors(
            Color(0xFFDEF1F6), Color(0xFF0C6B84), AppTokens.info);
      case AppBannerTone.danger:
        return const _BannerColors(
            Color(0xFFFAE6E6), Color(0xFFB22C2C), AppTokens.danger);
    }
  }
}

class _BannerColors {
  const _BannerColors(this.background, this.foreground, this.border);
  final Color background;
  final Color foreground;
  final Color border;
}
