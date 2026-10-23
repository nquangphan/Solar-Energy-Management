// An InvoicesPort for the invoice cubit tests (Story 11.4): FakeInvoicesPort
// underneath, every call logged in order (see RecordingPortCalls).
import 'package:pns_mobile/design_system/session/fake_invoices_port.dart';
import 'package:pns_mobile/design_system/session/invoices_port.dart';

import '../recording_port_calls.dart';

class RecordingInvoicesPort extends FakeInvoicesPort with RecordingPortCalls {
  RecordingInvoicesPort({super.details});

  @override
  Future<InvoicesOverview> getOverview(String orderId) =>
      record('getOverview', [orderId], () => super.getOverview(orderId));

  @override
  Future<InvoiceSummary> createInvoice(String orderId) =>
      record('createInvoice', [orderId], () => super.createInvoice(orderId));

  @override
  Future<InvoiceDetail> getInvoice(String orderId, String invoiceId) =>
      record('getInvoice', [orderId, invoiceId], () => super.getInvoice(orderId, invoiceId));

  @override
  Future<InvoicePdfInfo> exportInvoicePdf(String orderId, String invoiceId) =>
      record('exportInvoicePdf', [orderId, invoiceId], () => super.exportInvoicePdf(orderId, invoiceId));

  @override
  Future<InvoicePdfFile> downloadInvoicePdf(String orderId, String invoiceId) =>
      record('downloadInvoicePdf', [orderId, invoiceId], () => super.downloadInvoicePdf(orderId, invoiceId));
}
