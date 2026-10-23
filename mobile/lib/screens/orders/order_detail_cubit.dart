// hand-authored — Chi tiết đơn (Story 11.3, moved out of OrderDetailScreen's State).
// THE STEP SEQUENCE IS NOT COMPUTED HERE: the lifecycle comes from the backend's
// one transition table (AD-2/AD-11). Every read and write goes through the
// injected [OrdersPort]; photo bytes come through its authenticated proxy (AD-3).
// The cancel dialog and the stock-out sheet keep their own in-flight flags (their
// PopScope needs them); the cubit only forwards their port calls.

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart' show XFile;

import '../../design_system/session/orders_port.dart';
import 'order_detail_state.dart';

class OrderDetailCubit extends Cubit<OrderDetailState> {
  /// [loadsStockIssue]: the caller holds a key that reads the stock-out (UX only —
  /// the backend gates the read too).
  OrderDetailCubit(this._port, this._orderId, {required bool loadsStockIssue})
      : _loadsStockIssue = loadsStockIssue,
        super(const OrderDetailState());

  final OrdersPort _port;
  final String _orderId;
  final bool _loadsStockIssue;

  /// Three requests, ONE ticket for the whole batch: they are one screenful of
  /// one order, so a stale batch must be discarded as a batch.
  int _latest = 0;

  int _photosLatest = 0;
  int _stockIssueLatest = 0;

  /// The Ảnh tab was opened at least once — from then on a re-read includes it.
  bool _photosOpened = false;

  /// [showSkeleton] false = a refresh behind the order already on screen: no
  /// skeleton flash, and a failed refresh keeps the last good view.
  Future<void> load({bool showSkeleton = true}) async {
    final int ticket = ++_latest;
    final bool silent = !showSkeleton && state.status == OrderDetailStatus.ready;
    if (!silent) emit(state.copyWith(status: OrderDetailStatus.loading));
    try {
      final List<Object> results = await Future.wait(<Future<Object>>[
        _port.get(_orderId),
        _port.getLifecycle(_orderId),
        _port.listVersions(_orderId),
      ]);
      if (isClosed || ticket != _latest) return;
      final OrderLifecycle lifecycle = results[1] as OrderLifecycle;
      emit(state.copyWith(
        order: results[0] as Order,
        steps: lifecycle.steps,
        nextSteps: lifecycle.nextSteps,
        canCancel: lifecycle.canCancel,
        versions: results[2] as List<OrderVersionItem>,
        status: OrderDetailStatus.ready,
      ));
    } catch (error) {
      if (isClosed || ticket != _latest || silent) return;
      // Branch on the envelope CODE, never on the message text (AD-5).
      final bool notFound = error is OrderPortException && error.code == 'NOT_FOUND';
      emit(state.copyWith(status: notFound ? OrderDetailStatus.notFound : OrderDetailStatus.error));
    }
  }

  /// After a writing screen closes: reads everything it may have changed — the
  /// order and lifecycle (silently), the stock-out ("Đã giao" issues it) and,
  /// once opened, the photos (a transition can attach some).
  void reloadAfterReturn() {
    load(showSkeleton: false);
    if (_loadsStockIssue) loadStockIssue();
    if (_photosOpened) loadPhotos();
  }

  /// A failed read leaves the frame out rather than blanking the screen: the
  /// stock-out is one panel of the order, not the order.
  Future<void> loadStockIssue() async {
    final int ticket = ++_stockIssueLatest;
    try {
      final OrderStockIssueView view = await _port.getStockIssue(_orderId);
      if (isClosed || ticket != _stockIssueLatest) return;
      emit(state.copyWith(stockIssue: view));
    } catch (_) {
      if (isClosed || ticket != _stockIssueLatest) return;
      emit(state.copyWith(stockIssue: null));
    }
  }

  /// Photos load LAZILY, on the first open of the tab: they are the heaviest
  /// thing on this screen and most visits never open it.
  void openPhotos() {
    if (_photosOpened) return;
    _photosOpened = true;
    loadPhotos();
  }

  Future<void> loadPhotos() async {
    if (isClosed) return;
    final int ticket = ++_photosLatest;
    // The previous batch is dead the moment a reload starts. Keeping it means a
    // deleted photo's bytes stay resident for the life of the screen — at 10 MB
    // a photo that adds up on a phone.
    emit(state.copyWith(photosStatus: OrderDetailStatus.loading, photoBytes: const <String, Uint8List>{}));
    try {
      final List<AttachmentItem> photos = await _port.listAttachments(_orderId);
      if (isClosed || ticket != _photosLatest) return;
      emit(state.copyWith(photos: photos, photosStatus: OrderDetailStatus.ready));
      // Bytes come through the authenticated proxy, ONE call per photo, one after
      // the other. A photo whose bytes fail simply keeps the placeholder glyph —
      // one broken image must not blank the tab.
      for (final AttachmentItem item in photos) {
        try {
          final Uint8List bytes = await _port.attachmentBytes(_orderId, item.id);
          if (isClosed || ticket != _photosLatest) return;
          emit(state.copyWith(photoBytes: <String, Uint8List>{...state.photoBytes, item.id: bytes}));
        } catch (_) {
          // placeholder glyph stands in
        }
      }
    } catch (_) {
      if (isClosed || ticket != _photosLatest) return;
      emit(state.copyWith(photosStatus: OrderDetailStatus.error));
    }
  }

  /// True once the backend took [files]; the tab then reloads in the background.
  Future<bool> addPhotos(List<XFile> files) async {
    try {
      await _port.addAttachments(_orderId, files);
      if (isClosed) return false;
      unawaited(loadPhotos());
      return true;
    } catch (_) {
      if (isClosed) return false;
      emit(state.copyWith(photosStatus: OrderDetailStatus.error));
      return false;
    }
  }

  Future<void> removePhoto(String attachmentId) async {
    try {
      await _port.removeAttachment(_orderId, attachmentId);
      await loadPhotos();
    } catch (_) {
      if (isClosed) return;
      emit(state.copyWith(photosStatus: OrderDetailStatus.error));
    }
  }

  /// The cancel dialog's send — the port's error reaches the dialog untouched.
  Future<void> cancel(String reason) => _port.cancel(_orderId, reason);

  /// The stock-out sheet's send — the port's error reaches the sheet untouched.
  Future<OrderStockIssueResult> issueStock() => _port.issueStock(_orderId);

  /// The stock-out sheet's re-read after a refusal; null = keep the one on screen.
  Future<OrderStockIssueView?> stockIssueForSheet() async {
    try {
      return await _port.getStockIssue(_orderId);
    } catch (_) {
      return null;
    }
  }
}
