// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// Sheet.tsx — `.sheet`/`.sheet-grab` in components.css lines 160-161).
//
// Bottom sheet for QUICK CHOICES / native share only (UX-DR-20). Consequential
// money/data actions MUST use AppDialog, not a Sheet. The bottom-sheet is the
// native mobile surface (this is where UX-DR-20 lands on mobile, unlike web).
// Floats via a 1.5px ink border on an ink@.32 barrier — NO drop-shadow.

import 'package:flutter/material.dart' show showModalBottomSheet;
import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';
import 'button.dart';

/// Top-corner radius for the sheet — a sanctioned constant (DESIGN.md 226).
const double _sheetTopRadius = 18.0;

/// Shows an [AppSheet] anchored to the bottom edge on a dimmed ink@.32 barrier.
/// showModalBottomSheet is forced flat (elevation 0, transparent background) so
/// the only depth cue is the ink border (Viền nét).
Future<T?> showAppSheet<T>({
  required BuildContext context,
  required Widget child,
}) {
  return showModalBottomSheet<T>(
    context: context,
    elevation: 0,
    backgroundColor: const Color(0x00000000),
    barrierColor: AppTokens.ink.withValues(alpha: 0.32),
    builder: (_) => child,
  );
}

/// The sheet card (`.sheet`): `#fff`, 1.5px ink border, top corners 18px, with a
/// grab handle pill. Optional [title] renders a head row like the dialog.
class AppSheet extends StatelessWidget {
  const AppSheet({
    super.key,
    required this.body,
    this.title,
    this.onClose,
  });

  final Widget body;
  final String? title;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: AppTokens.surface,
          border: Border(
            top: BorderSide(color: AppTokens.ink, width: AppTokens.borderWidth),
            left:
                BorderSide(color: AppTokens.ink, width: AppTokens.borderWidth),
            right:
                BorderSide(color: AppTokens.ink, width: AppTokens.borderWidth),
          ),
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(_sheetTopRadius),
            topRight: Radius.circular(_sheetTopRadius),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38.0,
              height: 4.0,
              margin: const EdgeInsets.only(top: 9.0, bottom: 4.0),
              decoration: BoxDecoration(
                color: AppTokens.line,
                borderRadius: BorderRadius.circular(AppTokens.radiusFull),
              ),
            ),
            if (title != null) _head(context),
            // Flexible (loose): during the open/close ANIMATION the modal hands
            // the sheet shrinking constraints — a fixed-height body would
            // overflow on every intermediate frame. Loose fit keeps the settled
            // layout identical for small bodies and lets tall bodies (a
            // scrollable picker) shrink instead of overflowing.
            Flexible(
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.space16),
                child: body,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _head(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 13.0),
      decoration: const BoxDecoration(
        border: Border(
          bottom:
              BorderSide(color: AppTokens.line, width: AppTokens.borderWidth),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title!,
              style: const TextStyle(
                color: AppTokens.ink,
                fontFamily: AppTokens.fontFamily,
                fontSize: 14.0,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          AppButton(
            icon: 'ic-close',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.sm,
            onPressed: onClose ?? () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}
