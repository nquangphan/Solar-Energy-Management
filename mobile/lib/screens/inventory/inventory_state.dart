// hand-authored — Tồn kho state (Story 11.4), held by InventoryCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/inventory_port.dart';

/// Three phases that render nothing in common: the stock list is shown only
/// once it has arrived, never behind a skeleton or an error.
sealed class InventoryState extends Equatable {
  const InventoryState();

  @override
  List<Object?> get props => const [];
}

final class InventoryLoading extends InventoryState {
  const InventoryLoading();
}

final class InventoryReady extends InventoryState {
  const InventoryReady(this.data);

  /// Every number arrives computed by the backend (AD-2).
  final StockList data;

  @override
  List<Object?> get props => [data];
}

final class InventoryError extends InventoryState {
  const InventoryError();
}
