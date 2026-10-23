// hand-authored — Lịch thanh toán state (Story 11.4), held by PaymentScheduleCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/payments_port.dart';

enum PaymentScheduleStatus { loading, ready, error }

/// The backend's refusal of one installment row, as displayed under it.
final class PaymentRowErrors extends Equatable {
  const PaymentRowErrors({this.number, this.note});

  /// The percent or the amount, whichever the row holds.
  final String? number;
  final String? note;

  @override
  List<Object?> get props => [number, note];
}

/// "Leave this field as it is" for the nullable fields of [PaymentScheduleState.copyWith].
const Object _keep = Object();

/// One class for every phase: the outcome of the last payment and the open
/// form's idempotency key outlive a reload.
final class PaymentScheduleState extends Equatable {
  const PaymentScheduleState({
    this.status = PaymentScheduleStatus.loading,
    this.schedule,
    this.editing = false,
    this.saving = false,
    this.rowErrors = const {},
    this.formError,
    this.conflict,
    this.recordFor,
    this.recordKey = '',
    this.recordFailedAttempt = false,
    this.recording = false,
    this.recordFieldErrors = const {},
    this.recordError,
    this.recordConflict,
    this.outcome,
    this.outcomeStatus = '',
  });

  final PaymentScheduleStatus status;

  /// Amounts, totals and verdicts as the backend computed them.
  final PaymentSchedule? schedule;

  // ---- edit-the-schedule form ----------------------------------------------
  final bool editing;
  final bool saving;

  /// Displayed row ⇒ the backend's refusal of it; a fresh map on every change.
  final Map<int, PaymentRowErrors> rowErrors;
  final String? formError;
  final String? conflict;

  // ---- record-a-payment form -------------------------------------------------
  /// The installment whose form is open; null = no form.
  final Installment? recordFor;

  /// Generated ONCE when the form opens and re-sent on every retry.
  final String recordKey;

  /// An attempt of this form already failed — its payment may have been recorded anyway.
  final bool recordFailedAttempt;
  final bool recording;

  /// `amount` / `paidOn` ⇒ the backend's message for that field.
  final Map<String, String> recordFieldErrors;
  final String? recordError;
  final String? recordConflict;

  /// The automatic status change of the last recorded payment, and the order
  /// status the backend reported with it.
  final AutoTransitionResult? outcome;
  final String outcomeStatus;

  PaymentScheduleState copyWith({
    PaymentScheduleStatus? status,
    PaymentSchedule? schedule,
    bool? editing,
    bool? saving,
    Map<int, PaymentRowErrors>? rowErrors,
    Object? formError = _keep,
    Object? conflict = _keep,
    Object? recordFor = _keep,
    String? recordKey,
    bool? recordFailedAttempt,
    bool? recording,
    Map<String, String>? recordFieldErrors,
    Object? recordError = _keep,
    Object? recordConflict = _keep,
    Object? outcome = _keep,
    String? outcomeStatus,
  }) =>
      PaymentScheduleState(
        status: status ?? this.status,
        schedule: schedule ?? this.schedule,
        editing: editing ?? this.editing,
        saving: saving ?? this.saving,
        rowErrors: rowErrors ?? this.rowErrors,
        formError: identical(formError, _keep) ? this.formError : formError as String?,
        conflict: identical(conflict, _keep) ? this.conflict : conflict as String?,
        recordFor: identical(recordFor, _keep) ? this.recordFor : recordFor as Installment?,
        recordKey: recordKey ?? this.recordKey,
        recordFailedAttempt: recordFailedAttempt ?? this.recordFailedAttempt,
        recording: recording ?? this.recording,
        recordFieldErrors: recordFieldErrors ?? this.recordFieldErrors,
        recordError: identical(recordError, _keep) ? this.recordError : recordError as String?,
        recordConflict: identical(recordConflict, _keep) ? this.recordConflict : recordConflict as String?,
        outcome: identical(outcome, _keep) ? this.outcome : outcome as AutoTransitionResult?,
        outcomeStatus: outcomeStatus ?? this.outcomeStatus,
      );

  @override
  List<Object?> get props => [
        status,
        schedule,
        editing,
        saving,
        rowErrors,
        formError,
        conflict,
        recordFor,
        recordKey,
        recordFailedAttempt,
        recording,
        recordFieldErrors,
        recordError,
        recordConflict,
        outcome,
        outcomeStatus,
      ];
}
