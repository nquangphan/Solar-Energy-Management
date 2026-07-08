// hand-authored — Flutter app-shell scaffold (Story 1.8, mirror mockup
// all-screens.html `.pbody`/`.pscroll` CSS 264-265). Assembles the three shell
// pieces INSIDE the glass: a fixed [topbar], a scrolling [body], and a fixed
// [bottomNav]. This is the glass content only — the caller wraps it in an
// AppPhoneFrame:
//
//   AppPhoneFrame(child: AppMobileShell(topbar: ..., body: ..., bottomNav: ...))
//
// The shell NEVER decides when to hide the nav. Auth screens (Đăng nhập / Quên
// mật khẩu) pass `bottomNav: null` to drop it (UX-DR-15); the topbar stays
// optional. Pure presentation — no router, no side effects (AD-1/2).

import 'package:flutter/widgets.dart';

import 'app_bottom_nav.dart';
import 'app_topbar.dart';

/// Glass-content scaffold: fixed topbar (optional) → scrolling body → fixed
/// bottom nav (optional). Wrap in an `AppPhoneFrame` to render the device.
class AppMobileShell extends StatelessWidget {
  const AppMobileShell({
    super.key,
    this.topbar,
    required this.body,
    this.bottomNav,
    this.bodyPadding =
        const EdgeInsets.symmetric(horizontal: 13.0, vertical: 12.0),
  });

  /// Fixed top bar. Null on auth's Đăng nhập screen.
  final AppTopbar? topbar;

  /// Scrolling screen content (`.pscroll`).
  final Widget body;

  /// Fixed bottom nav. Null on auth screens → no nav renders (UX-DR-15).
  final AppBottomNav? bottomNav;

  final EdgeInsets bodyPadding;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (topbar != null) topbar!,
        Expanded(
          child: SingleChildScrollView(
            padding: bodyPadding,
            child: body,
          ),
        ),
        if (bottomNav != null) bottomNav!,
      ],
    );
  }
}
