// hand-authored — Lịch thanh toán (Story 11.4, moved out of PaymentScheduleScreen's State).
// Every read and write goes through the injected [PaymentsPort]. THE CLIENT
// COMPUTES NO MONEY: amounts, totals and verdicts are the backend's; the inputs
// arrive built by the screen from what the user typed.
//
// The idempotency key of a payment is generated ONCE when its form opens and
// re-sent on every retry; a new key only after a success, a close, or another
// installment's form (NFR-1).

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/session/payments_port.dart';
import 'payment_schedule_state.dart';

const String _kRecordError = 'Không ghi nhận được thanh toán. Vui lòng thử lại.';
const String _kSaveError = 'Không lưu được lịch thanh toán. Vui lòng thử lại.';

final RegExp _rowFieldPath =
    RegExp(r'^installments\.(\d+)\.(percent|amount|conditionNote)$');

class PaymentScheduleCubit extends Cubit<PaymentScheduleState> {
  PaymentScheduleCubit({
    required PaymentsPort port,
    required String orderId,
    required String Function() newKey,
  })  : _port = port,
        _orderId = orderId,
        _newKey = newKey,
        super(const PaymentScheduleState());

  final PaymentsPort _port;
  final String _orderId;

  /// Idempotency-key source.
  final String Function() _newKey;

  int _ticket = 0;

  /// Closes both forms. The outcome of the last payment, the key and the failed
  /// attempt flag survive: a replay after a lost response still reports the status.
  Future<void> load() async {
    final int ticket = ++_ticket;
    emit(state.copyWith(
      status: PaymentScheduleStatus.loading,
      editing: false,
      conflict: null,
      formError: null,
      rowErrors: const {},
      recordFor: null,
      recordFieldErrors: const {},
      recordError: null,
      recordConflict: null,
    ));
    try {
      final PaymentSchedule s = await _port.getSchedule(_orderId);
      if (isClosed || ticket != _ticket) return;
      emit(state.copyWith(schedule: s, status: PaymentScheduleStatus.ready));
    } catch (_) {
      if (isClosed || ticket != _ticket) return;
      emit(state.copyWith(status: PaymentScheduleStatus.error));
    }
  }

  // ---- record a payment ------------------------------------------------------

  /// A NEW key per opened form. Pressing "Ghi nhận" again on the installment whose
  /// form is already open keeps that form and its key: after a lost response a
  /// fresh key would let the same payment be recorded twice. False = nothing
  /// changed (the screen keeps its fields as typed).
  bool openRecord(Installment i) {
    if (state.recordFor?.id == i.id) return false;
    emit(state.copyWith(
      recordFor: i,
      recordKey: _newKey(),
      recordFailedAttempt: false,
      outcome: null,
      recordFieldErrors: const {},
      recordError: null,
      recordConflict: null,
    ));
    return true;
  }

  void closeRecord() {
    emit(state.copyWith(
      recordFor: null,
      recordFieldErrors: const {},
      recordError: null,
      recordConflict: null,
    ));
  }

  /// Sends the open form under its key. Returns the order status to report —
  /// when the payment moved the order, or when it may be the replay of an earlier
  /// attempt whose response was lost (a replay carries no autoTransition) — else
  /// null. A blank amount travels as null: the adapter refuses it as a field error
  /// before any request.
  Future<String?> submitRecord({
    required String amountText,
    required String paidOn,
    required String method,
    required String note,
  }) async {
    final Installment? recordFor = state.recordFor;
    if (state.recording || recordFor == null) return null;
    final String trimmedNote = note.trim();
    final RecordPaymentInput input = RecordPaymentInput(
      idempotencyKey: state.recordKey,
      installmentId: recordFor.id,
      amount: int.tryParse(amountText),
      paidOn: paidOn.trim(),
      method: method,
      note: trimmedNote.isEmpty ? null : trimmedNote,
    );
    final bool replayPossible = state.recordFailedAttempt;
    emit(state.copyWith(
      recording: true,
      recordFieldErrors: const {},
      recordError: null,
      recordConflict: null,
    ));
    try {
      final RecordPaymentResult r = await _port.recordPayment(_orderId, input);
      if (isClosed) return null;
      emit(state.copyWith(
        recording: false,
        schedule: r.schedule,
        recordFor: null,
        outcome: r.autoTransition,
        outcomeStatus: r.orderStatus,
      ));
      return r.autoTransition?.outcome.json == 'applied' || replayPossible ? r.orderStatus : null;
    } on PaymentsPortError catch (e) {
      if (isClosed) return null;
      emit(_withRecordError(state.copyWith(recording: false, recordFailedAttempt: true), e));
      return null;
    } catch (_) {
      if (isClosed) return null;
      emit(state.copyWith(recording: false, recordFailedAttempt: true, recordError: _kRecordError));
      return null;
    }
  }

  PaymentScheduleState _withRecordError(PaymentScheduleState s, PaymentsPortError e) {
    if (e.code == 'CONFLICT') return s.copyWith(recordConflict: e.message);
    final Map<String, String> fieldErrors = <String, String>{};
    final List<String> general = <String>[e.message];
    for (final FieldError f in e.fieldErrors ?? const <FieldError>[]) {
      if (f.field == 'amount' || f.field == 'paidOn') {
        fieldErrors.putIfAbsent(f.field, () => f.message);
      } else {
        general.add(f.message);
      }
    }
    return s.copyWith(recordFieldErrors: fieldErrors, recordError: general.join('\n'));
  }

  // ---- edit the schedule -----------------------------------------------------

  void startEdit() {
    emit(state.copyWith(editing: true, formError: null, conflict: null, rowErrors: const {}));
  }

  void cancelEdit() {
    emit(state.copyWith(editing: false, formError: null, conflict: null, rowErrors: const {}));
  }

  /// The rows changed under the errors: a template also clears the form banner.
  void clearRowErrors({bool formError = false}) {
    emit(formError
        ? state.copyWith(rowErrors: const {}, formError: null)
        : state.copyWith(rowErrors: const {}));
  }

  /// [rowCount] reads the rows on screen when the answer arrives: the rows can be
  /// added or removed while the save is in flight, and an error index beyond them
  /// must reach the form banner instead of a row that is no longer displayed.
  Future<void> save(ReplacePaymentScheduleInput input, {required int Function() rowCount}) async {
    if (state.saving) return;
    emit(state.copyWith(saving: true, formError: null, conflict: null, rowErrors: const {}));
    try {
      final PaymentSchedule s = await _port.replaceSchedule(_orderId, input);
      if (isClosed) return;
      emit(state.copyWith(saving: false, schedule: s, editing: false));
    } on PaymentsPortError catch (e) {
      if (isClosed) return;
      emit(_withSaveError(state.copyWith(saving: false), e, rowCount()));
    } catch (_) {
      if (isClosed) return;
      emit(state.copyWith(saving: false, formError: _kSaveError));
    }
  }

  /// [rowCount] = the rows displayed; an index beyond them is a general error.
  PaymentScheduleState _withSaveError(PaymentScheduleState s, PaymentsPortError e, int rowCount) {
    if (e.code == 'CONFLICT') return s.copyWith(conflict: e.message);
    final Map<int, PaymentRowErrors> rowErrors = <int, PaymentRowErrors>{};
    final List<String> general = <String>[];
    for (final FieldError f in e.fieldErrors ?? const <FieldError>[]) {
      final RegExpMatch? m = _rowFieldPath.firstMatch(f.field);
      final int? index = m == null ? null : int.parse(m.group(1)!);
      if (m == null || index! >= rowCount) {
        general.add(f.message);
        continue;
      }
      final PaymentRowErrors errors = rowErrors[index] ?? const PaymentRowErrors();
      rowErrors[index] = m.group(2) == 'conditionNote'
          ? PaymentRowErrors(number: errors.number, note: errors.note ?? f.message)
          : PaymentRowErrors(number: errors.number ?? f.message, note: errors.note);
    }
    if (general.isNotEmpty) {
      return s.copyWith(rowErrors: rowErrors, formError: general.join('\n'));
    }
    if (rowErrors.isEmpty) return s.copyWith(formError: e.message);
    return s.copyWith(rowErrors: rowErrors);
  }
}
