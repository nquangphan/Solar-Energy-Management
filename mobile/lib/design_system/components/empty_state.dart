// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// EmptyState.tsx). A centred empty block for BOTH empty lists ("Chưa có đơn
// nào…") and phone-search-empty ("SĐT chưa có trong hệ thống." + "Tạo khách
// hàng mới"). ALL copy comes from props — never hard-coded here (UX-DR-19,
// i18n-friendly).

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon,
    this.action,
  });

  /// Optional large faded icon name.
  final String? icon;
  final String title;
  final String? message;

  /// Optional action slot, typically an [AppButton].
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (icon != null) ...[
            AppIcon(icon!, size: 36.0, color: AppTokens.line),
            const SizedBox(height: 12.0),
          ],
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 13.0,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: 4.0),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 12.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: 12.0),
            action!,
          ],
        ],
      ),
    );
  }
}
