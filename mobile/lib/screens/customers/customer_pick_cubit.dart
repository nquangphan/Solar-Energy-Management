// hand-authored — Tra SĐT chọn/tạo khách (Story 11.2, moved out of CustomerPickScreen's State).
// THE CLIENT NEVER TOUCHES A PHONE NUMBER (AD-9): the raw string the user typed goes
// straight to the injected [CustomersPort], for the lookup and for the create. The
// message shown is the one the backend sent (AD-5). No in-flight flag: a second
// tap sends a second request, as before.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/customers_port.dart';
import 'customer_pick_state.dart';

class CustomerPickCubit extends Cubit<CustomerPickState> {
  CustomerPickCubit(this._port) : super(const CustomerPickState());

  final CustomersPort _port;

  /// A failed catalogue is an empty one — the create form simply offers no source.
  Future<void> loadSources() async {
    List<CustomerSource> sources;
    try {
      sources = await _port.listSources();
    } catch (_) {
      sources = const [];
    }
    if (isClosed) return;
    emit(CustomerPickState(
      sources: sources,
      result: state.result,
      error: state.error,
      fieldErrors: state.fieldErrors,
      creating: state.creating,
    ));
  }

  Future<void> lookup(String phone) async {
    emit(CustomerPickState(sources: state.sources, result: state.result));
    try {
      // The RAW string, exactly as typed. The backend owns every judgement about it.
      final CustomerLookup found = await _port.lookup(phone);
      if (isClosed) return;
      emit(CustomerPickState(
        sources: state.sources,
        result: found,
        error: state.error,
        fieldErrors: state.fieldErrors,
        creating: state.creating,
      ));
    } catch (err) {
      if (isClosed) return;
      final (String message, Map<String, String> fieldErrors) = _messagesOf(err);
      emit(CustomerPickState(
        sources: state.sources,
        error: message,
        fieldErrors: fieldErrors,
        creating: state.creating,
      ));
    }
  }

  void startCreate() => _setCreating(true);

  void cancelCreate() => _setCreating(false);

  void _setCreating(bool creating) => emit(CustomerPickState(
        sources: state.sources,
        result: state.result,
        error: state.error,
        fieldErrors: state.fieldErrors,
        creating: creating,
      ));

  /// The created customer, or null when the backend refused it (its messages are
  /// then in the state) or the screen is already gone.
  ///
  /// Each type carries its OWN fields: the other type's inputs are dropped even when
  /// typed, and an empty input is absent.
  Future<Customer?> create({
    required String phone,
    required String custType,
    required String name,
    required String nationalId,
    required String taxCode,
    required String address,
    required String bankAccount,
    required String sourceId,
    required String sourceNote,
  }) async {
    emit(CustomerPickState(sources: state.sources, result: state.result, creating: state.creating));
    // Compared as the generated enum, so this cubit needs no constant from its screen file.
    final CreateCustomerRequestDtoCustType type = CreateCustomerRequestDtoCustType.fromJson(custType);
    final bool personal = type == CreateCustomerRequestDtoCustType.caNhan;
    final bool commercial = type == CreateCustomerRequestDtoCustType.thuongMai;
    try {
      final Customer created = await _port.create(
        CreateCustomerInput(
          // Still the raw string — the backend re-normalises it into the key it stores.
          phone: phone,
          custType: type,
          name: name,
          nationalId: personal && nationalId.isNotEmpty ? nationalId : null,
          taxCode: commercial && taxCode.isNotEmpty ? taxCode : null,
          address: address.isNotEmpty ? address : null,
          bankAccount: commercial && bankAccount.isNotEmpty ? bankAccount : null,
          sourceId: sourceId,
          sourceNote: sourceNote.isNotEmpty ? sourceNote : null,
        ),
      );
      if (isClosed) return null;
      return created;
    } catch (err) {
      if (isClosed) return null;
      final (String message, Map<String, String> fieldErrors) = _messagesOf(err);
      emit(CustomerPickState(
        sources: state.sources,
        result: state.result,
        error: message,
        fieldErrors: fieldErrors,
        creating: state.creating,
      ));
      return null;
    }
  }

  /// The message the BACKEND sent (AD-5) — never one invented here. An invalid phone
  /// is judged on the server (AD-9), so the sentence explaining it comes from there
  /// too; the generic line is only for a transport failure, which carries no envelope.
  (String, Map<String, String>) _messagesOf(Object err) => err is CustomerPortException
      ? (err.message, err.fieldErrors)
      : ('Không thực hiện được. Thử lại.', const <String, String>{});
}
