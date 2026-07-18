// hand-authored — Flutter app-shell widget (Story 5.4, mirror web
// `shell/Tabs.tsx` — `.tabs` CSS 307-308). Underline tab row, active item
// underlined teal.
//
// NOT Material's TabBar/DefaultTabController: the design system is the SSOT for
// what a control looks like, and Material ships ripple + elevation defaults that
// "Viền nét" forbids (UX-DR-4, AD-13). Screens must not style tabs ad hoc either
// — that is how two screens end up with two different tab rows.
//
// Pure presentation: tapping only EMITS `onSelect(key)`; it never changes state
// itself (AD-1/2), exactly like the web twin.

import 'package:flutter/widgets.dart';

import '../tokens/app_tokens.dart';

/// One tab: the [key] the caller switches on, and the [label] shown.
class AppTabItem {
  const AppTabItem({required this.key, required this.label});
  final String key;
  final String label;
}

class AppTabs extends StatelessWidget {
  const AppTabs({super.key, required this.tabs, this.activeKey, this.onSelect});

  final List<AppTabItem> tabs;
  final String? activeKey;
  final void Function(String key)? onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: AppTokens.line,
            width: AppTokens.borderWidth,
          ),
        ),
      ),
      // The tab row scrolls on its own axis rather than truncating: the labels
      // are byte-identical with web (UX-DR-27), and two full Vietnamese labels
      // already exceed a phone width. Shortening them here would break parity;
      // an unscrollable Row would just overflow.
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final AppTabItem tab in tabs) _tab(tab, tab.key == activeKey),
          ],
        ),
      ),
    );
  }

  Widget _tab(AppTabItem tab, bool active) {
    return Semantics(
      button: true,
      selected: active,
      label: tab.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onSelect == null ? null : () => onSelect!(tab.key),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTokens.space12,
            vertical: AppTokens.space8,
          ),
          decoration: BoxDecoration(
            border: Border(
              // The active marker is the underline, drawn 1.5px like every other
              // line in the system. The inactive tab keeps a transparent border
              // of the same width so switching tabs does not shift the row.
              bottom: BorderSide(
                color: active ? AppTokens.teal : const Color(0x00000000),
                width: AppTokens.borderWidth,
              ),
            ),
          ),
          child: Text(
            tab.label,
            style: TextStyle(
              color: active ? AppTokens.teal700 : AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 13.0,
              fontWeight: active ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
