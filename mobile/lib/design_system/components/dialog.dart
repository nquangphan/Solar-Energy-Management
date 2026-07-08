// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// Dialog.tsx / ConfirmDialog.tsx — `.modal*` in components.css lines 152-156).
//
// For CONSEQUENTIAL money/data actions (Chốt/Huỷ/Duyệt/ghi thanh toán),
// UX-DR-20. Floats via a 1.5px ink border on an ink@.32 barrier — NO drop-shadow
// (Viền nét). showDialog gives a dedicated route so it never steals focus from
// the caller, and the barrier/back-button close it natively.
//
// Intent-only (AD-11): onConfirm collects the user's intent and calls back — it
// NEVER mutates Order.status. The transition is a backend applyTransition().

import 'package:flutter/material.dart' show showDialog;
import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';
import 'banner.dart';
import 'button.dart';

/// Shows an [AppDialog] (or [AppConfirmDialog]) as a routed modal on a dimmed
/// ink@.32 barrier. Overlap ≤ 1 level — do not open a dialog over a dialog.
Future<T?> showAppDialog<T>({
  required BuildContext context,
  required Widget child,
  bool barrierDismissible = true,
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierColor: AppTokens.ink.withValues(alpha: 0.32),
    builder: (_) => Padding(
      padding: const EdgeInsets.all(AppTokens.space22),
      child: Center(child: child),
    ),
  );
}

/// The dialog card (`.modal`): 340px (clamped to the viewport), `#fff`, 1.5px
/// ink border, radiusLg, overflow hidden. Head/foot split by 1.5px line borders.
class AppDialog extends StatelessWidget {
  const AppDialog({
    super.key,
    this.title,
    required this.body,
    this.footer,
    this.onClose,
    this.closeLabel = 'Đóng',
  });

  final String? title;
  final Widget body;

  /// Footer actions laid out in a row with 8px gaps (mirror `.modal-foot`).
  final List<Widget>? footer;

  /// Defaults to popping the current route (the routed modal).
  final VoidCallback? onClose;
  final String closeLabel;

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.of(context).size.width - 2 * AppTokens.space22;
    final width = maxWidth < 340.0 ? maxWidth : 340.0;

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTokens.radiusLg),
      child: Container(
        width: width,
        decoration: BoxDecoration(
          color: AppTokens.surface,
          border:
              Border.all(color: AppTokens.ink, width: AppTokens.borderWidth),
          borderRadius: BorderRadius.circular(AppTokens.radiusLg),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (title != null) _head(context),
            Padding(
              padding: const EdgeInsets.all(AppTokens.space16),
              child: body,
            ),
            if (footer != null && footer!.isNotEmpty) _foot(),
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

  Widget _foot() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: AppTokens.line, width: AppTokens.borderWidth),
        ),
      ),
      child: Row(
        children: [
          for (var i = 0; i < footer!.length; i++) ...[
            if (i > 0) const SizedBox(width: 8.0),
            footer![i],
          ],
        ],
      ),
    );
  }
}

/// Confirm dialog: a thin wrapper over [AppDialog]. Body is an [AppBanner]
/// stating the consequence; the footer is a cancel + confirm button (Huỷ left,
/// confirm right — mirror web `ConfirmDialog`). onConfirm ONLY emits intent — it
/// never changes status or calls an API (AD-11).
///
/// Any dismissal that is NOT a confirm — the Huỷ button, the X, tapping the
/// barrier, or the system back button — fires [onCancel] exactly once (mirror
/// web where the backdrop/Esc route through `onClose = onCancel`).
///
/// Caveat: [onCancel] also runs if the route is torn down without a user action
/// (a parent programmatically pops it, or the screen unmounts while open). Keep
/// [onCancel] operating on parent/screen state — do not have it touch this
/// dialog's own context.
class AppConfirmDialog extends StatefulWidget {
  const AppConfirmDialog({
    super.key,
    required this.title,
    required this.consequence,
    required this.onConfirm,
    this.onCancel,
    this.confirmLabel = 'Xác nhận',
    this.cancelLabel = 'Huỷ',
    this.confirmTone = AppButtonVariant.danger,
  });

  final String title;

  /// The consequence text shown inside a danger/warn banner.
  final String consequence;
  final VoidCallback onConfirm;
  final VoidCallback? onCancel;
  final String confirmLabel;
  final String cancelLabel;
  final AppButtonVariant confirmTone;

  @override
  State<AppConfirmDialog> createState() => _AppConfirmDialogState();
}

class _AppConfirmDialogState extends State<AppConfirmDialog> {
  // Guards against firing more than one outcome: the buttons resolve it before
  // popping; a barrier/back dismiss leaves it false and dispose() cancels.
  bool _resolved = false;

  void _confirm() {
    if (_resolved) return;
    _resolved = true;
    Navigator.of(context).pop();
    widget.onConfirm();
  }

  void _cancel() {
    if (_resolved) return;
    _resolved = true;
    Navigator.of(context).pop();
    widget.onCancel?.call();
  }

  @override
  void dispose() {
    // Barrier tap / system back pop the route without touching a button.
    if (!_resolved) widget.onCancel?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppDialog(
      title: widget.title,
      onClose: _cancel,
      body: AppBanner(
        message: widget.consequence,
        icon: 'ic-alert',
        tone: widget.confirmTone == AppButtonVariant.danger
            ? AppBannerTone.danger
            : AppBannerTone.warn,
      ),
      footer: [
        AppButton(
          label: widget.cancelLabel,
          variant: AppButtonVariant.ghost,
          onPressed: _cancel,
        ),
        AppButton(
          label: widget.confirmLabel,
          variant: widget.confirmTone,
          onPressed: _confirm,
        ),
      ],
    );
  }
}
