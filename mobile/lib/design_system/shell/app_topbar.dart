// hand-authored — Flutter app-shell widget (Story 1.8, mirror mockup
// all-screens.html `.topbar` CSS 232-244). Flat: surface fill + a 1.5px ink
// border-bottom, no elevation (Viền nét) — built with a plain Container, NOT a
// Material AppBar (which forces a shadow + navigation behaviour).
//
// Pure presentation: `onBack`/`onAction` only EMIT intent — the widget never
// pops a route or navigates (AD-1/2). The eyebrow is shown verbatim (the mockup
// passes it already uppercased) so web parity is byte-for-byte — NO implicit
// `.toUpperCase()` here.

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';

/// Canonical screen top bar (`.topbar`): optional back button, a 1-line
/// ellipsised title with an optional micro-uppercase eyebrow above it, and an
/// optional right-hand action slot (typically a teal `Text` 12/w800 or an
/// `AppIcon` 15).
class AppTopbar extends StatelessWidget {
  const AppTopbar({
    super.key,
    required this.title,
    this.eyebrow,
    this.onBack,
    this.action,
    this.onAction,
  });

  final String title;

  /// Micro-uppercase label above the title. Shown verbatim (already uppercased
  /// by the caller) to keep web parity — no implicit case change.
  final String? eyebrow;

  /// Fired when the back button is tapped. When null, no back button renders.
  final VoidCallback? onBack;

  /// Right-hand action content (a `Text` or `AppIcon`). When null, nothing
  /// renders on the right.
  final Widget? action;

  /// Fired when [action] is tapped.
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final bar = Container(
      padding: const EdgeInsets.symmetric(horizontal: 13.0, vertical: 10.0),
      decoration: const BoxDecoration(
        color: AppTokens.surface,
        border: Border(
          bottom: BorderSide(color: AppTokens.ink, width: AppTokens.borderWidth),
        ),
      ),
      child: Row(
        children: [
          if (onBack != null) ...[
            // Back button — DRAWN at 28×28 in flow (mockup-verbatim), so the
            // topbar height stays 28 + 2·10 padding = 48 (web parity). Its ≥48dp
            // touch target is added OUT OF FLOW by the overlay below, mirroring
            // the web `.topbar-back::after` technique — hit area only, the bar
            // never grows.
            Container(
              width: 28.0,
              height: 28.0,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppTokens.surface,
                border: Border.all(
                    color: AppTokens.line, width: AppTokens.borderWidth),
                borderRadius: BorderRadius.circular(AppTokens.radiusSm),
              ),
              child: const AppIcon('ic-chevron-left',
                  size: 18.0, color: AppTokens.teal700),
            ),
            const SizedBox(width: 10.0),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (eyebrow != null)
                  Text(
                    eyebrow!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppTokens.teal,
                      fontFamily: AppTokens.fontFamily,
                      fontSize: 10.0,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.1 * 10.0,
                      height: 1.2,
                    ),
                  ),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 15.0,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.01 * 15.0,
                  ),
                ),
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: 10.0),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onAction,
              child: DefaultTextStyle.merge(
                style: const TextStyle(
                  color: AppTokens.teal700,
                  fontFamily: AppTokens.fontFamily,
                  fontSize: 12.0,
                  fontWeight: FontWeight.w800,
                ),
                child: IconTheme.merge(
                  data: const IconThemeData(color: AppTokens.teal700),
                  child: action!,
                ),
              ),
            ),
          ],
        ],
      ),
    );

    if (onBack == null) return bar;

    // A11y floor (Story 1.10, UX-DR-26): an OUT-OF-FLOW ≥48dp touch target laid
    // over the back button — `top/bottom: 0` spans the full 48dp bar height,
    // `width: tapTargetMin` spans 48dp across (the 28×28 box sits inside it).
    // Stack-overlaid like the web `::after`, so it expands the HIT AREA without
    // changing any drawn size or the bar's height.
    return Stack(
      children: [
        bar,
        Positioned(
          left: 0.0,
          top: 0.0,
          bottom: 0.0,
          child: Semantics(
            button: true,
            label: 'Quay lại',
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onBack,
              child: const SizedBox(width: AppTokens.tapTargetMin),
            ),
          ),
        ),
      ],
    );
  }
}
