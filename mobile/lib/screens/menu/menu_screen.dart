// hand-authored — Flutter app-screen (Story 10.7, mockup all-screens.html#s-menu).
// The mobile navigation hub: the signed-in identity, one row per destination the
// account may open, and Đăng xuất. On the web the same entries live in the left
// sidebar (SIDEBAR_NAV).
//
// The screen neither filters nor navigates: it renders the sections it is handed
// (already filtered by permission) and emits the key of the row tapped. The
// router owns where a key leads (AD-1/2).
//
// The identity card shows only real `/me` fields (displayName, email). The
// mockup's role and phone line are not rendered: `/me` carries neither, and a
// role is a preset applied at creation, not stored truth (AD-8).

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/gating/app_permissions.dart';
import '../../design_system/icons/app_icons.dart';
import '../../design_system/session/app_session.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';

/// Index of the locked bottom-nav `Menu` tab — this screen IS that tab.
const int _menuTabIndex = 4;

class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key, required this.sections, required this.onOpen, required this.onLogout});

  /// The menu entries the account may open (already filtered by permission).
  final List<AppNavSection> sections;

  /// Emits the key of the row tapped.
  final ValueChanged<String> onOpen;

  /// Signs out; the button stays disabled until it completes.
  final Future<void> Function()? onLogout;

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  bool _loggingOut = false;

  Future<void> _logout() async {
    // Offline, the logout call waits out the connect timeout: a second tap must not send a second one.
    setState(() => _loggingOut = true);
    try {
      await widget.onLogout!();
    } finally {
      if (mounted) setState(() => _loggingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = PermissionsScope.of(context).me;
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'ĐIỀU HƯỚNG', title: 'Menu'),
        bottomNav: const AppBottomNav(activeIndex: _menuTabIndex),
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _identity(me?.displayName ?? '', me?.email ?? ''),
              const SizedBox(height: AppTokens.space16),
              for (final section in widget.sections)
                for (final link in section.links) ...[_row(link), const SizedBox(height: AppTokens.space8)],
              const SizedBox(height: AppTokens.space8),
              AppButton(
                variant: AppButtonVariant.danger,
                label: 'Đăng xuất',
                wide: true,
                onPressed: widget.onLogout == null || _loggingOut ? null : _logout,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _identity(String displayName, String email) {
    return AppCard(
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Row(
        children: [
          _thumb('ic-user', size: 44.0, color: AppTokens.teal),
          const SizedBox(width: AppTokens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(displayName, style: _title(14.0)),
                const SizedBox(height: 2.0),
                Text(email, style: _muted),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(AppNavLink link) {
    return Semantics(
      button: true,
      label: link.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => widget.onOpen(link.key),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppTokens.tapTargetMin),
          child: AppCard(
            padding: const EdgeInsets.all(AppTokens.space12),
            child: Row(
              children: [
                _thumb(link.icon ?? 'ic-menu', size: 36.0, color: AppTokens.ink),
                const SizedBox(width: AppTokens.space12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(link.label, style: _title(13.0)),
                      if (link.subtitle != null) ...[const SizedBox(height: 2.0), Text(link.subtitle!, style: _muted)],
                    ],
                  ),
                ),
                const AppIcon('ic-chevron-right', size: 16.0, color: AppTokens.muted),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// The mockup's `.thumb`: an icon in a bordered square.
  Widget _thumb(String icon, {required double size, required Color color}) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        border: Border.all(color: AppTokens.line, width: AppTokens.borderWidth),
        borderRadius: BorderRadius.circular(AppTokens.radiusLg),
      ),
      child: AppIcon(icon, size: size / 2, color: color),
    );
  }

  static TextStyle _title(double fontSize) => TextStyle(
    color: AppTokens.ink,
    fontFamily: AppTokens.fontFamily,
    fontSize: fontSize,
    fontWeight: FontWeight.w800,
  );

  static const TextStyle _muted = TextStyle(
    color: AppTokens.muted,
    fontFamily: AppTokens.fontFamily,
    fontSize: 11.5,
    fontWeight: FontWeight.w600,
  );
}
