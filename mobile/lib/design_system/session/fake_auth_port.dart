// hand-authored — TEST/DEMO-ONLY fake port (Story 10.6, mirror web
// web/src/design-system/session/fake-auth-port.ts).
//
// NOT a real sign-in: it resolves (or throws) in memory so the Đăng nhập screen
// is testable WITHOUT a backend or network. It enforces NO security rule — the
// backend owns every one of them (AD-4).

import 'auth_port.dart';

/// An [AuthPort] that signs in by default — TEST/DEMO ONLY. Pass [throwWith] to
/// model a backend refusal (wrong credentials) and drive the screen's danger
/// banner; [restored] is what [restoreSession] answers.
class FakeAuthPort implements AuthPort {
  const FakeAuthPort({this.throwWith, this.restored = false});

  final Object? throwWith;
  final bool restored;

  @override
  Future<void> login({required String email, required String password}) async {
    if (throwWith != null) throw throwWith!;
  }

  @override
  Future<bool> restoreSession() async => restored;

  @override
  Future<void> logout() async {}
}
