// hand-authored — Flutter design-system component (Story 1.7, mirror Story 1.4
// StatusChip.tsx — `.chip--*` in components.css lines 51-60).
//
// The 10 hex triplets below are CANONICAL COMPONENT CONSTANTS copied verbatim
// from the web CSS ON PURPOSE — NOT tokens (adding them to AppTokens would be
// Story 1.1 scope-creep). design-system/components/parity.test.mjs asserts each
// triplet is byte-identical on web (CSS) and mobile (this file) so a colour
// change on one platform can never drift from the other (UX-DR-27).

import 'package:flutter/widgets.dart';

import 'chip.dart';

/// The 10 canonical order states (= `.chip--*` suffix). The enum blocks ad-hoc
/// statuses at the type level. Key ↔ backend Order.status enum is deferred to
/// Epic 4/5 — here the key is only the class suffix, not a guessed enum.
enum StatusKey {
  baogia,
  choduyet,
  dachot,
  dacoc,
  thicong,
  nghiemthu,
  danggiao,
  dagiao,
  hoanthanh,
  huy,
}

/// Reverse lookup for the backend's `String` status. Ports mirror the backend
/// DTO (a string), this chip takes the strict [StatusKey] enum — every screen
/// showing a status needs this bridge, so it lives HERE, next to the enum, not
/// re-typed privately in each screen (the second copy is where drift starts).
///
/// Returns null for an unknown value so a caller can render plain text instead
/// of crashing the screen.
StatusKey? statusKeyOf(String raw) {
  for (final StatusKey key in StatusKey.values) {
    if (key.name == raw) return key;
  }
  return null;
}

/// Canonical Vietnamese labels, verbatim from web STATUS_LABELS / DESIGN.md.
const Map<StatusKey, String> kStatusLabels = {
  StatusKey.baogia: 'Báo giá',
  StatusKey.choduyet: 'Chờ duyệt',
  StatusKey.dachot: 'Đã chốt',
  StatusKey.dacoc: 'Đã cọc',
  StatusKey.thicong: 'Đang thi công',
  StatusKey.nghiemthu: 'Nghiệm thu',
  StatusKey.danggiao: 'Đang giao',
  StatusKey.dagiao: 'Đã giao',
  StatusKey.hoanthanh: 'Hoàn thành',
  StatusKey.huy: 'Huỷ',
};

/// {background, foreground, border} for each status. Verbatim mirror of
/// components.css `.chip--*` — keep byte-identical with the web hex.
const Map<StatusKey, StatusChipColors> kStatusColors = {
  StatusKey.baogia:
      StatusChipColors(Color(0xFFEAF3F1), Color(0xFF3A5450), Color(0xFFCFE5E0)),
  StatusKey.choduyet:
      StatusChipColors(Color(0xFFFBF0DA), Color(0xFF8A5C08), Color(0xFFEFD9A8)),
  StatusKey.dachot:
      StatusChipColors(Color(0xFFDCF3EF), Color(0xFF0B7264), Color(0xFFB7E5DD)),
  StatusKey.dacoc:
      StatusChipColors(Color(0xFFE7F5D9), Color(0xFF4B7A15), Color(0xFFCDE9AC)),
  StatusKey.thicong:
      StatusChipColors(Color(0xFFFCEAD4), Color(0xFF985B08), Color(0xFFF2D3A6)),
  StatusKey.nghiemthu:
      StatusChipColors(Color(0xFFE4EEFA), Color(0xFF345C9C), Color(0xFFC4D8F0)),
  StatusKey.danggiao:
      StatusChipColors(Color(0xFFDEF1F6), Color(0xFF0C6B84), Color(0xFFB7E0EB)),
  StatusKey.dagiao:
      StatusChipColors(Color(0xFFDDF3EA), Color(0xFF0F7657), Color(0xFFB7E5D4)),
  StatusKey.hoanthanh:
      StatusChipColors(Color(0xFFDEF3E6), Color(0xFF137A4C), Color(0xFFB7E5CA)),
  StatusKey.huy:
      StatusChipColors(Color(0xFFFAE6E6), Color(0xFFB22C2C), Color(0xFFF0C7C7)),
};

/// Read-only status chip (UX-DR-23). Renders a static pill with a same-colour
/// dot + label — NEVER a control. Tapping it does NOT change the status;
/// transitions happen on a dedicated screen (Epic 5).
class AppStatusChip extends StatelessWidget {
  const AppStatusChip({super.key, required this.status, this.label});

  final StatusKey status;

  /// Override the displayed label; defaults to the canonical [kStatusLabels].
  final String? label;

  @override
  Widget build(BuildContext context) {
    final c = kStatusColors[status]!;
    return AppChip(
      label: label ?? kStatusLabels[status]!,
      background: c.background,
      foreground: c.foreground,
      border: c.border,
      showDot: true,
    );
  }
}

class StatusChipColors {
  const StatusChipColors(this.background, this.foreground, this.border);
  final Color background;
  final Color foreground;
  final Color border;
}
