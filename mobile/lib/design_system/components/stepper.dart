// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.5
// Stepper.tsx — `.step*` in components.css lines 110-123). 26px nodes joined by
// 1.5px bars.
//
// `current` ring: web uses `box-shadow:0 0 0 3px teal050`, a finite double
// border (0 blur), the ONE sanctioned exception to Viền nét (DESIGN.md 217).
// Flutter mirrors it as an outer teal050 Container wrapping the node — NEVER a
// BoxShadow (the source-guard would fail on one).
//
// `gate` uses a dashed border (DashedRectPainter). Inapplicable steps are NOT
// greyed — the caller drops them from `steps` entirely (UX-DR-11).

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';
import 'dashed_rect.dart';

/// Node state (= the `.step` modifier). `upcoming` is the plain default node
/// (no modifier class on web, `StepItem.state` omitted).
enum AppStepState { upcoming, done, current, gate }

/// A single step: [label] under the node, plus its [state]. [state] defaults to
/// `upcoming` — mirroring the optional `StepItem.state` on web.
class AppStepItem {
  const AppStepItem({required this.label, this.state = AppStepState.upcoming});
  final String label;
  final AppStepState state;
}

/// Canonical non-token stepper constants, verbatim from components.css.
const Color _defaultBul = Color(0xFF9FB2AD); // `.bul` text (upcoming)
const Color _gateBorder = Color(0xFFC3D3CE);
const Color _gateLabel = Color(0xFFA9BAB5);

class AppStepper extends StatelessWidget {
  const AppStepper({super.key, required this.steps});

  final List<AppStepItem> steps;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          _node(steps[i], i),
          if (i != steps.length - 1)
            Container(
              width: 26.0,
              height: 1.5,
              margin: const EdgeInsets.only(top: 12.25),
              color: AppTokens.line,
            ),
        ],
      ],
    );
  }

  Widget _node(AppStepItem step, int index) {
    return SizedBox(
      width: 64.0,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _bullet(step.state, index),
          const SizedBox(height: 5.0),
          Text(
            step.label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: step.state == AppStepState.gate
                  ? _gateLabel
                  : step.state == AppStepState.current
                      ? AppTokens.teal700
                      : step.state == AppStepState.done
                          ? AppTokens.ink2
                          : AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 9.5,
              fontWeight: step.state == AppStepState.current
                  ? FontWeight.w800
                  : FontWeight.w700,
              letterSpacing: 0.02 * 9.5,
            ),
          ),
        ],
      ),
    );
  }

  /// The `.bul` glyph: `done` shows a white check; every other state shows the
  /// 1-based step number (mirror `Stepper.tsx`: `state==='done' ? ✓ : i + 1`).
  Widget _number(int index, Color color) {
    return Text(
      '${index + 1}',
      style: TextStyle(
        color: color,
        fontFamily: AppTokens.fontFamily,
        fontSize: 12.0,
        fontWeight: FontWeight.w800,
      ),
    );
  }

  Widget _bullet(AppStepState state, int index) {
    switch (state) {
      case AppStepState.upcoming:
        return Container(
          width: 26.0,
          height: 26.0,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppTokens.surface,
            shape: BoxShape.circle,
            border:
                Border.all(color: AppTokens.line, width: AppTokens.borderWidth),
          ),
          child: _number(index, _defaultBul),
        );
      case AppStepState.done:
        return Container(
          width: 26.0,
          height: 26.0,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppTokens.teal,
            shape: BoxShape.circle,
            border:
                Border.all(color: AppTokens.teal, width: AppTokens.borderWidth),
          ),
          child:
              const AppIcon('ic-check', size: 14.0, color: AppTokens.surface),
        );
      case AppStepState.current:
        // Double border: outer teal050 ring (3px) wraps the teal-bordered node.
        return Container(
          padding: const EdgeInsets.all(3.0),
          decoration: const BoxDecoration(
            color: AppTokens.teal050,
            shape: BoxShape.circle,
          ),
          child: Container(
            width: 26.0,
            height: 26.0,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppTokens.surface,
              shape: BoxShape.circle,
              border: Border.all(
                  color: AppTokens.teal, width: AppTokens.borderWidth),
            ),
            child: _number(index, AppTokens.teal700),
          ),
        );
      case AppStepState.gate:
        return SizedBox(
          width: 26.0,
          height: 26.0,
          child: CustomPaint(
            painter: const DashedRectPainter(
              color: _gateBorder,
              strokeWidth: AppTokens.borderWidth,
              radius: 13.0,
            ),
            child: Center(child: _number(index, _gateBorder)),
          ),
        );
    }
  }
}
