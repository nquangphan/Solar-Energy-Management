// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.5
// Kpi.tsx — `.kpi*` in components.css lines 127-131). A single line-bordered KPI
// card. The 4→2 responsive grid is app-shell scope (Story 1.8/1.9), NOT here.

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

class AppKpi extends StatelessWidget {
  const AppKpi({
    super.key,
    required this.label,
    required this.value,
    this.delta,
    this.accent = false,
  });

  final String label;
  final String value;

  /// Optional delta line, always rendered in the `ok` colour (mirror `.k-d`).
  final String? delta;

  /// `.kpi.accent`: teal border on teal050.
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: accent ? AppTokens.teal050 : null,
        border: Border.all(
          color: accent ? AppTokens.teal : AppTokens.line,
          width: AppTokens.borderWidth,
        ),
        borderRadius: BorderRadius.circular(AppTokens.radiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              color: AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 10.0,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.06 * 10.0,
            ),
          ),
          const SizedBox(height: 5.0),
          Text(
            value,
            style: const TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 23.0,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.02 * 23.0,
            ),
          ),
          if (delta != null) ...[
            const SizedBox(height: 2.0),
            Text(
              delta!,
              style: const TextStyle(
                color: AppTokens.ok,
                fontFamily: AppTokens.fontFamily,
                fontSize: 11.0,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
