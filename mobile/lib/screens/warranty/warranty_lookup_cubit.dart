// hand-authored — Tra cứu bảo hành (Story 11.2, moved out of WarrantyLookupScreen's State).
// Looks warranty up by the RAW phone through the injected [WarrantyPort] — the
// backend owns the only normaliser (AD-9). A second tap while loading sends a
// second request and the later answer wins, as before.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/warranty_port.dart';
import 'warranty_lookup_state.dart';

class WarrantyLookupCubit extends Cubit<WarrantyLookupState> {
  WarrantyLookupCubit(this._port) : super(const WarrantyLookupIdle());

  final WarrantyPort _port;

  Future<void> lookup(String phone) async {
    emit(const WarrantyLookupLoading());
    try {
      final WarrantyLookup result = await _port.lookup(phone);
      if (isClosed) return;
      emit(WarrantyLookupReady(result));
    } catch (err) {
      if (isClosed) return;
      // The backend's own words, verbatim: the client owns no rule about what
      // a valid phone is, so it owns no wording for one either.
      emit(WarrantyLookupError(err is WarrantyPortException ? err.message : 'Không tra cứu được bảo hành.'));
    }
  }
}
