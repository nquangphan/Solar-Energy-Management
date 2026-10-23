// hand-authored — the Menu screen's "signing out" flag (Story 11.1). The screen
// calls no port; the flag is a sending flag, so it lives here. Cubit<bool> is
// enough: one flag needs no state class.

import 'package:flutter_bloc/flutter_bloc.dart';

/// `true` while [onLogout] runs; the Đăng xuất button stays disabled until then.
class MenuCubit extends Cubit<bool> {
  MenuCubit(this.onLogout) : super(false);

  final Future<void> Function()? onLogout;

  Future<void> logout() async {
    // Offline, the logout call waits out the connect timeout: a second tap must not send a second one.
    if (state || onLogout == null) return;
    emit(true);
    try {
      await onLogout!();
    } finally {
      if (!isClosed) emit(false);
    }
  }
}
