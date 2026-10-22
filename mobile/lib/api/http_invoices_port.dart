// hand-authored — the real InvoicesPort over the generated client (Story 10.8,
// mirror web/src/api/http-invoices-port.ts).
//
// The PDF download arrives as a header-less byte stream, so its file name comes
// from the invoice's stored PDF metadata (`pdf.fileName`, with extension); the
// web reads the same name off Content-Disposition. A download before the first
// export is the backend's 404 envelope, surfaced verbatim.
import '../design_system/session/invoices_port.dart';
import 'api_error.dart';
import 'bytes.dart';
import 'generated/pns_api_client.dart';
import 'transport.dart';

class HttpInvoicesPort implements InvoicesPort {
  HttpInvoicesPort(this._client, this._transport);

  final PnsApiClient _client;
  final Transport _transport;

  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await _transport.call(request);
    } on ApiError catch (e) {
      throw InvoicesPortError(status: e.status ?? 0, message: e.message);
    }
  }

  @override
  Future<InvoicesOverview> getOverview(String orderId) =>
      _call(() => _client.invoices.invoicesControllerOverview(id: Uri.encodeComponent(orderId)));

  @override
  Future<InvoiceSummary> createInvoice(String orderId) =>
      _call(() => _client.invoices.invoicesControllerCreate(id: Uri.encodeComponent(orderId)));

  @override
  Future<InvoiceDetail> getInvoice(String orderId, String invoiceId) => _call(
    () => _client.invoices.invoicesControllerDetail(
      id: Uri.encodeComponent(orderId),
      invoiceId: Uri.encodeComponent(invoiceId),
    ),
  );

  @override
  Future<InvoicePdfInfo> exportInvoicePdf(String orderId, String invoiceId) => _call(
    () => _client.invoices.invoicesControllerExportPdf(
      id: Uri.encodeComponent(orderId),
      invoiceId: Uri.encodeComponent(invoiceId),
    ),
  );

  @override
  Future<InvoicePdfFile> downloadInvoicePdf(String orderId, String invoiceId) async {
    final detail = await getInvoice(orderId, invoiceId);
    final bytes = await _call(
      () => collectBytes(
        _client.invoices.invoicesControllerDownloadPdf(
          id: Uri.encodeComponent(orderId),
          invoiceId: Uri.encodeComponent(invoiceId),
        ),
      ),
    );
    return InvoicePdfFile(bytes: bytes, fileName: detail.pdf?.fileName ?? '$invoiceId.pdf');
  }
}
