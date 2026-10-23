// hand-authored — Xem hoá đơn (Story 11.4, moved out of InvoiceDetailScreen's State).
// Every read and the export go through the injected [InvoicesPort]; the share
// seam comes from the screen. Nothing here computes money — every figure is the
// snapshot the backend stored.

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/invoices_port.dart';
import 'invoice_detail_state.dart';

const String _kExportError = 'Không xuất được PDF hoá đơn. Vui lòng thử lại.';

class InvoiceDetailCubit extends Cubit<InvoiceDetailState> {
  InvoiceDetailCubit(this._port, this._orderId, this._invoiceId)
      : super(const InvoiceDetailState());

  // Not final: [retarget] points the same cubit at another invoice.
  InvoicesPort _port;
  String _orderId;
  String _invoiceId;

  int _ticket = 0;

  /// [showSkeleton] false = a refresh behind the invoice already on screen: a
  /// failure keeps the last good view.
  Future<void> load({bool showSkeleton = true}) async {
    final int ticket = ++_ticket;
    if (showSkeleton) emit(state.copyWith(status: InvoiceDetailStatus.loading));
    try {
      final InvoiceDetail i = await _port.getInvoice(_orderId, _invoiceId);
      if (isClosed || ticket != _ticket) return;
      emit(state.copyWith(invoice: i, status: InvoiceDetailStatus.ready));
    } catch (_) {
      if (isClosed || ticket != _ticket) return;
      // A failed silent refresh keeps the last good view.
      if (showSkeleton || state.invoice == null) {
        emit(state.copyWith(status: InvoiceDetailStatus.error));
      }
    }
  }

  /// Another invoice on the same screen: read it. The ticket drops the previous
  /// invoice's late answer; a running export keeps busy and re-reads the NEW one.
  void retarget(InvoicesPort port, String orderId, String invoiceId) {
    _port = port;
    _orderId = orderId;
    _invoiceId = invoiceId;
    emit(state.copyWith(invoice: null));
    load();
  }

  /// Export → download → share, one call at a time; then the detail is reloaded
  /// so the PDF status is the server's.
  Future<void> exportPdf(AppShareFn share) async {
    if (state.busy) return;
    emit(state.copyWith(busy: true, error: null));
    try {
      await _port.exportInvoicePdf(_orderId, _invoiceId);
      final InvoicePdfFile file = await _port.downloadInvoicePdf(_orderId, _invoiceId);
      if (isClosed) return;
      await share(
        <XFile>[
          XFile.fromData(
            file.bytes,
            mimeType: 'application/pdf',
            name: file.fileName,
          ),
        ],
        title: file.fileName,
        fileNames: <String>[file.fileName],
      );
    } catch (e) {
      if (!isClosed) {
        emit(state.copyWith(error: e is InvoicesPortError ? e.message : _kExportError));
      }
    } finally {
      if (!isClosed) await load(showSkeleton: false);
      if (!isClosed) emit(state.copyWith(busy: false));
    }
  }
}
