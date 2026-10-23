// hand-authored — Chi tiết đơn state (Story 11.3), held by OrderDetailCubit.

import 'dart:typed_data';

import 'package:equatable/equatable.dart';

import '../../design_system/session/orders_port.dart';

/// `notFound` is its own state, NOT a flavour of `error`: "this order does not
/// exist, or is not yours" is an answer, and pressing "Thử lại" on an answer
/// just asks the same question again (UX-DR-19).
enum OrderDetailStatus { loading, ready, error, notFound }

/// "Leave this field as it is" for the nullable fields of [OrderDetailState.copyWith].
const Object _keep = Object();

/// One class for every phase: a silent re-read on return keeps the order on
/// screen through a failure, so the data outlives the phase.
final class OrderDetailState extends Equatable {
  const OrderDetailState({
    this.status = OrderDetailStatus.loading,
    this.order,
    this.steps = const [],
    this.nextSteps = const [],
    this.canCancel = false,
    this.versions = const [],
    this.stockIssue,
    this.photosStatus = OrderDetailStatus.loading,
    this.photos = const [],
    this.photoBytes = const {},
  });

  final OrderDetailStatus status;
  final Order? order;

  /// The stepper, as the backend derived it (AD-2/AD-11).
  final List<OrderLifecycleStep> steps;

  /// The steps THIS caller may take now — empty hides "Chuyển trạng thái".
  final List<OrderNextStep> nextSteps;

  /// Backend-computed off the transition table (AD-2/AD-4).
  final bool canCancel;

  final List<OrderVersionItem> versions;

  /// The order's one stock-out; null when it failed to load or is not read.
  final OrderStockIssueView? stockIssue;

  /// The Ảnh tab — loaded lazily, on its first open.
  final OrderDetailStatus photosStatus;
  final List<AttachmentItem> photos;

  /// Photo id → bytes, fetched one by one; a fresh map on every change.
  final Map<String, Uint8List> photoBytes;

  OrderDetailState copyWith({
    OrderDetailStatus? status,
    Order? order,
    List<OrderLifecycleStep>? steps,
    List<OrderNextStep>? nextSteps,
    bool? canCancel,
    List<OrderVersionItem>? versions,
    Object? stockIssue = _keep,
    OrderDetailStatus? photosStatus,
    List<AttachmentItem>? photos,
    Map<String, Uint8List>? photoBytes,
  }) =>
      OrderDetailState(
        status: status ?? this.status,
        order: order ?? this.order,
        steps: steps ?? this.steps,
        nextSteps: nextSteps ?? this.nextSteps,
        canCancel: canCancel ?? this.canCancel,
        versions: versions ?? this.versions,
        stockIssue: identical(stockIssue, _keep) ? this.stockIssue : stockIssue as OrderStockIssueView?,
        photosStatus: photosStatus ?? this.photosStatus,
        photos: photos ?? this.photos,
        photoBytes: photoBytes ?? this.photoBytes,
      );

  @override
  List<Object?> get props =>
      [status, order, steps, nextSteps, canCancel, versions, stockIssue, photosStatus, photos, photoBytes];
}
