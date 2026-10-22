// hand-authored — what every page of the real app sits in (Story 10.6, shared by
// PnsApp and SignedInApp since 10.7).
import 'package:flutter/material.dart';

import '../design_system/components/components.dart';
import '../design_system/shell/app_phone_frame.dart';
import '../design_system/tokens/app_tokens.dart';

const String kAppTitle = 'Phương Nam Solar';

/// The real app renders edge-to-edge (no mockup phone chrome). The Scaffold is the
/// Material ancestor TextField (AppField) needs, and it lifts the body above the
/// on-screen keyboard so a form's lower fields stay reachable.
Widget appPage(Widget body) => AppPhoneFrameScope(
  bare: true,
  child: Scaffold(backgroundColor: AppTokens.surface, body: body),
);

/// Shown while the session or its permissions are still loading.
class SessionSkeleton extends StatelessWidget {
  const SessionSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppPhoneFrame(
      child: Padding(
        padding: EdgeInsets.all(18.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSkeleton(height: 56.0),
            SizedBox(height: AppTokens.space12),
            AppSkeleton(),
            SizedBox(height: AppTokens.space12),
            AppSkeleton(),
          ],
        ),
      ),
    );
  }
}
