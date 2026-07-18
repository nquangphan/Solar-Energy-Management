// Barrel for the mobile app-shell module (Story 1.8). Exports the shell
// widgets only — tokens/icons/components are imported directly (same policy as
// components.dart, Story 1.7).
//
// Parity note: the web shell (Story 1.9 — AppTopbar/AppBottomNav/WebFrame in
// React) will mirror these exact canonical constants (topbar border-bottom ink
// 1.5px, botnav border-top ink 1.5px + locked 5 tabs, FAB 46/ -22 / ring
// teal-700 1.5px, phone 330 / radius 40 / glass 700 / radius 32 / notch
// 116×22), enforced by the shared mockup-anchored parity guard.

export 'app_bottom_nav.dart';
export 'app_mobile_shell.dart';
export 'app_phone_frame.dart';
export 'app_tabs.dart';
export 'app_topbar.dart';
