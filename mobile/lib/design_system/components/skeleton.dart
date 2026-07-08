// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.6
// Skeleton.tsx — `.skel` in components.css line 171). A static loading bar:
// surface2 fill + 6px radius. NO shimmer/gradient (Viền nét). Screens compose
// several to match a layout. The 6px radius is a canonical skeleton constant.

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

class AppSkeleton extends StatelessWidget {
  const AppSkeleton({
    super.key,
    this.width,
    this.height = 12.0,
    this.radius = 6.0,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppTokens.surface2,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
