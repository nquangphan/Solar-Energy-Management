// Barrel for the mobile gating module (Story 1.10). Parallel to shell/shell.dart
// and components/components.dart. Exports the gating primitives + the stub
// permission set. Gating is UX only (AD-4); the permission registry is
// backend-owned and generated from code (AD-17) — AppPerm/demoPermissions here
// are Epic 1 placeholders, swapped for `/me` in Epic 2.

export 'app_gate.dart';
export 'app_permission_keys.g.dart';
export 'app_permissions.dart';
