// hand-authored — Flutter app-shell widget (Story 1.8, mirror mockup
// all-screens.html `.botnav` CSS 246-258). Flat: surface fill + a 1.5px ink
// border-top, no elevation (Viền nét) — a plain Container/Row, NOT a Material
// BottomNavigationBar (which forces elevation + selection behaviour).
//
// LOCKED contract (UX-DR-15): exactly 5 tabs in a fixed order —
// Trang chủ · Đơn hàng · [Tạo FAB] · Kho · Menu. The list is an INTERNAL
// constant, never a prop, so no caller can add/remove/reorder tabs or inject
// navigation. Taps only EMIT intent (`onSelect`/`onCreateQuote`) — the shell
// holds no router (AD-1/2).

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';

/// A regular nav tab. The centre FAB (index 2) is handled separately, so this
/// record only describes the four ordinary tabs plus the FAB's label/icon.
class _Tab {
  const _Tab(this.icon, this.label);
  final String icon;
  final String label;
}

/// LOCKED tabs, fixed order. Index 2 (`Tạo`) is the raised FAB. This is a
/// private constant — there is deliberately NO constructor to pass tabs.
const List<_Tab> _tabs = [
  _Tab('ic-home', 'Trang chủ'),
  _Tab('ic-orders', 'Đơn hàng'),
  _Tab('ic-plus', 'Tạo'),
  _Tab('ic-warehouse', 'Kho'),
  _Tab('ic-menu', 'Menu'),
];

/// Resting icon colour for inactive tabs (`.botnav-item .icn`, `#a9bab5`). A
/// canonical shell literal absent from AppTokens — mirrors the mockup.
const Color _restIcon = Color(0xFFA9BAB5);

/// Locked 5-tab bottom nav with a raised centre FAB. [activeIndex] tints the
/// matching ordinary tab (0/1/3/4); index 2 is always the FAB.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.activeIndex,
    this.onSelect,
    this.onCreateQuote,
  });

  final int activeIndex;

  /// Fired with the tab index for the four ordinary tabs (0/1/3/4).
  final ValueChanged<int>? onSelect;

  /// Fired when the centre FAB (index 2, `Tạo`) is tapped. The FAB never emits
  /// `onSelect`.
  final VoidCallback? onCreateQuote;

  @override
  Widget build(BuildContext context) {
    assert(_tabs.length == 5, 'botnav is locked to exactly 5 tabs');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 2.0),
      decoration: const BoxDecoration(
        color: AppTokens.surface,
        border: Border(
          top: BorderSide(color: AppTokens.ink, width: AppTokens.borderWidth),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < _tabs.length; i++)
            Expanded(
              child: i == 2 ? _fab(_tabs[i]) : _item(_tabs[i], i),
            ),
        ],
      ),
    );
  }

  Widget _item(_Tab tab, int index) {
    final active = index == activeIndex;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onSelect == null ? null : () => onSelect!(index),
      child: Padding(
        padding: const EdgeInsets.only(top: 7.0, bottom: 9.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppIcon(tab.icon,
                size: 22.0, color: active ? AppTokens.teal : _restIcon),
            const SizedBox(height: 2.0),
            Text(
              tab.label,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: active ? AppTokens.teal700 : AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Centre FAB: a 46px teal circle with a 3px white band + a 1.5px teal-700
  /// ring, built as TWO nested Containers (0 blur) — the same sanctioned Viền
  /// nét exception as the AppStepper `current` ring, NOT a BoxShadow. It sits
  /// -22px above the bar via Transform.translate (a margin cannot overflow the
  /// Row bounds), which keeps hit-testing at the shifted position.
  Widget _fab(_Tab tab) {
    return Transform.translate(
      offset: const Offset(0.0, -22.0),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onCreateQuote,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ring FAB — outer teal-700 ring (1.5px) wraps the 3px white band
            // wrapping the teal core. Nested borders, 0 blur (mirror stepper).
            Container(
              padding: const EdgeInsets.all(1.5),
              decoration: const BoxDecoration(
                color: AppTokens.teal700,
                shape: BoxShape.circle,
              ),
              child: Container(
                padding: const EdgeInsets.all(3.0),
                decoration: const BoxDecoration(
                  color: AppTokens.surface,
                  shape: BoxShape.circle,
                ),
                child: Container(
                  width: 46.0,
                  height: 46.0,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: AppTokens.teal,
                    shape: BoxShape.circle,
                  ),
                  child: const AppIcon('ic-plus',
                      size: 22.0, color: AppTokens.surface),
                ),
              ),
            ),
            const SizedBox(height: 2.0),
            Text(
              tab.label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppTokens.teal700,
                fontFamily: AppTokens.fontFamily,
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
