// hand-authored — Flutter design-system component (Story 4.1, mirror
// Checkbox.tsx). A real checkbox control for the group-picker checklist,
// replacing the mockup's static tick span.
//
// Flat 1.5px-bordered box (Viền nét — no shadow/glow) that fills teal when
// checked. The whole row is the hit area, floored at >=48dp (AppTokens
// .tapTargetMin — Material floor; web uses 44px, dp != px on purpose).
// Controlled: state lives in the SCREEN, this control only emits onChanged.

import 'package:flutter/widgets.dart';

import '../icons/app_icons.dart';
import '../tokens/app_tokens.dart';

class AppCheckbox extends StatelessWidget {
  const AppCheckbox({
    super.key,
    required this.label,
    required this.checked,
    this.onChanged,
    this.disabled = false,
  });

  /// The visible, readable label — REQUIRED (doubles as the Semantics name).
  final String label;
  final bool checked;
  final ValueChanged<bool>? onChanged;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18.0,
          height: 18.0,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: checked ? AppTokens.teal : AppTokens.surface,
            border: Border.all(
              color: checked ? AppTokens.teal : AppTokens.line,
              width: AppTokens.borderWidth,
            ),
            borderRadius: BorderRadius.circular(AppTokens.radiusSm),
          ),
          child: checked
              ? const AppIcon('ic-check', size: 12.0, color: AppTokens.surface)
              : null,
        ),
        const SizedBox(width: 9.0),
        Flexible(
          child: Text(
            label,
            style: TextStyle(
              color: disabled ? AppTokens.muted : AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );

    return Semantics(
      // Screen-reader contract mirrors the web <input type="checkbox">: a named,
      // toggleable control that reports its checked state.
      label: label,
      checked: checked,
      enabled: !disabled,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: disabled ? null : () => onChanged?.call(!checked),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppTokens.tapTargetMin),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Opacity(opacity: disabled ? 0.45 : 1.0, child: row),
          ),
        ),
      ),
    );
  }
}
