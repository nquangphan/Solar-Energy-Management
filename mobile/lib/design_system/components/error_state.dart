// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// ErrorState.tsx). Reuses AppBanner(danger) + an optional retry button — it does
// NOT rebuild a banner from scratch (DRY).

import 'package:flutter/widgets.dart';

import 'banner.dart';
import 'button.dart';

class AppErrorState extends StatelessWidget {
  const AppErrorState({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Thử lại',
  });

  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppBanner(
          message: message,
          icon: 'ic-alert',
          tone: AppBannerTone.danger,
        ),
        if (onRetry != null) ...[
          const SizedBox(height: 8.0),
          AppButton(
            label: retryLabel,
            icon: 'ic-refresh',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.sm,
            onPressed: onRetry,
          ),
        ],
      ],
    );
  }
}
