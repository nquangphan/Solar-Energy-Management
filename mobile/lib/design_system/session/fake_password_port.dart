// hand-authored — TEST/DEMO-ONLY fake port (Story 2.8, mirror web
// web/src/design-system/session/fake-password-port.ts).
//
// NOT a real password flow: it resolves (or throws) in memory so the Quên mật
// khẩu / Hồ sơ screens are testable WITHOUT an app-runtime or network. It
// enforces NO security rule — the backend owns every one of them (AD-4).

import 'password_port.dart';

/// Code lifetime the demo backend reports (matches the 5-minute default TTL).
const int kDemoExpiresInSeconds = 300;

/// A [PasswordPort] that resolves by default — TEST/DEMO ONLY. Pass [throwWith]
/// to model a backend failure (wrong code, wrong current password) and drive the
/// screens' danger banner.
class FakePasswordPort implements PasswordPort {
  const FakePasswordPort({
    this.throwWith,
    this.expiresInSeconds = kDemoExpiresInSeconds,
  });

  final Object? throwWith;
  final int expiresInSeconds;

  @override
  Future<int> requestResetCode(String email) async {
    // The real forgot-password endpoint ALWAYS returns 200 (anti-enumeration),
    // so this never surfaces a failure — [throwWith] only models a reset/change
    // rejection, letting a test reach step 2 and then fail the submit.
    return expiresInSeconds;
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    if (throwWith != null) throw throwWith!;
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (throwWith != null) throw throwWith!;
  }
}
