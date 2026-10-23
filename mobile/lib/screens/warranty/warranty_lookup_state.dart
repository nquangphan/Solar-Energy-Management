// hand-authored — Tra cứu bảo hành state (Story 11.2), held by WarrantyLookupCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/warranty_port.dart';

/// The four phases of one lookup: nothing asked yet, waiting, an answer, a failure.
sealed class WarrantyLookupState extends Equatable {
  const WarrantyLookupState();

  @override
  List<Object?> get props => const [];
}

/// No lookup yet: the prompt to type a phone number.
final class WarrantyLookupIdle extends WarrantyLookupState {
  const WarrantyLookupIdle();
}

final class WarrantyLookupLoading extends WarrantyLookupState {
  const WarrantyLookupLoading();
}

/// The backend's answer — `found: false` is an answer too, not a failure.
final class WarrantyLookupReady extends WarrantyLookupState {
  const WarrantyLookupReady(this.result);

  final WarrantyLookup result;

  @override
  List<Object?> get props => [result];
}

/// Shown in the AppErrorState with Thử lại.
final class WarrantyLookupError extends WarrantyLookupState {
  const WarrantyLookupError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
