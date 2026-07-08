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

  // The bar (fill + border + labels) plus the height the centre FAB rises above
  // it. Both fixed so the raised FAB lives INSIDE the widget's hit bounds: a
  // Transform-raised FAB overflows the parent box and Flutter drops taps in the
  // overflow band (rejects out-of-bounds positions before reaching the FAB).
  static const double _barHeight = 58.0;
  static const double _fabRaise = 22.0;

  @override
  Widget build(BuildContext context) {
    assert(_tabs.length == 5, 'botnav is locked to exactly 5 tabs');
    return SizedBox(
      height: _barHeight + _fabRaise,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Bar pinned to the bottom (surface fill + 1.5px ink border-top). The
          // centre cell is an empty spacer — the FAB is drawn in the raised
          // overlay so it can rise above the bar while staying hit-testable.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: _barHeight,
            child: Container(
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
                      child: i == 2 ? const SizedBox.shrink() : _item(_tabs[i], i),
                    ),
                ],
              ),
            ),
          ),
          // Raised centre FAB, centred over the middle column and fully within
          // the SizedBox bounds so the whole ring (including its top) hit-tests.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Row(
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Expanded(
                    child: i == 2
                        ? Center(child: _fab(_tabs[i]))
                        : const SizedBox.shrink(),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _item(_Tab tab, int index) {
    final active = index == activeIndex;
    return Semantics(
      button: true,
      selected: active,
      label: tab.label,
      child: GestureDetector(
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
      ),
    );
  }

  /// Centre FAB: a 46px teal circle with a 3px white band + a 1.5px teal-700
  /// ring, built as TWO nested Containers (0 blur) — the same sanctioned Viền
  /// nét exception as the AppStepper `current` ring, NOT a BoxShadow. It is
  /// raised above the bar by the overlay `Positioned` in `build` (a layout
  /// offset, not a Transform), so the whole ring stays inside the hit bounds.
  Widget _fab(_Tab tab) {
    return Semantics(
      button: true,
      label: tab.label,
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
