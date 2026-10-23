// hand-authored — Trang chủ state (Story 8.1), held by DashboardCubit.

import 'package:equatable/equatable.dart';

import '../../design_system/session/dashboard_port.dart';

enum DashboardStatus { loading, ready, error, forbidden }

/// One class for every phase: the chosen period outlives a load or a failure.
final class DashboardState extends Equatable {
  const DashboardState({
    this.period = Period.month,
    this.status = DashboardStatus.loading,
    this.summary,
  });

  /// The period the screen shows (or is loading).
  final DashboardPeriod period;

  final DashboardStatus status;

  /// The backend's figures for [period]; every number arrives computed (AD-2).
  final DashboardSummary? summary;

  @override
  List<Object?> get props => [period, status, summary];
}
