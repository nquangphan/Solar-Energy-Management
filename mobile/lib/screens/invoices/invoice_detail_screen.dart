// hand-authored — Flutter app-screen (Story 7.5, mobile twin of web
// web/src/screens/invoices/InvoiceDetailScreen.tsx). Xem hoá đơn: one created
// invoice in full (number, date, seller, customer, lines, VAT, totals, linked
// order) and "Xuất PDF".
//
// THE CLIENT COMPUTES NO MONEY. Every figure is the snapshot the backend stored
// when the invoice was issued; amounts render only through `MoneyText`.
//
// "Xuất PDF" renders the PDF on the backend the first time and returns the SAME
// stored file afterwards, so repeating it is harmless: no confirm dialog. One call
// at a time; a server refusal is shown verbatim, anything else gets the fallback.
//
// Lines follow the mockup's two columns (`name ×qty` | amount) so a long name
// wraps on a 320 px phone instead of squeezing the amount; there is no table
// header on mobile.
//
// LABELS are byte-identical with the web twin.

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/invoices_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../orders/discount_approval_screen.dart' show kOrdersTabIndex;

const TextStyle _micro = TextStyle(
  color: AppTokens.muted,
  fontFamily: AppTokens.fontFamily,
  fontSize: 11.5,
  fontWeight: FontWeight.w600,
);
const TextStyle _strong = TextStyle(
  color: AppTokens.ink,
  fontFamily: AppTokens.fontFamily,
  fontSize: 12.5,
  fontWeight: FontWeight.w800,
);

const String _kExportError = 'Không xuất được PDF hoá đơn. Vui lòng thử lại.';
const String _kNotConfigured = 'Chưa cấu hình';

/// UTC instant ⇒ `dd/MM/yyyy` in Vietnam (UTC+7).
String _vnDate(DateTime instant) {
  final DateTime d = instant.toUtc().add(const Duration(hours: 7));
  String pad(int n) => n.toString().padLeft(2, '0');
  return '${pad(d.day)}/${pad(d.month)}/${d.year}';
}

/// A seller field left empty when the invoice was issued.
String _orNotConfigured(String value) =>
    value.trim().isEmpty ? _kNotConfigured : value;

enum _LoadState { loading, ready, error }

class InvoiceDetailScreen extends StatefulWidget {
  const InvoiceDetailScreen({
    super.key,
    required this.port,
    required this.orderId,
    required this.invoiceId,
    this.onBack,
    this.shareImpl,
  });

  final InvoicesPort port;
  final String orderId;
  final String invoiceId;
  final VoidCallback? onBack;

  /// Share seam; tests inject one so no platform channel is hit.
  final AppShareFn? shareImpl;

  @override
  State<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends State<InvoiceDetailScreen> {
  _LoadState _state = _LoadState.loading;
  InvoiceDetail? _invoice;
  int _ticket = 0;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant InvoiceDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Another invoice on the same screen instance: read it (the ticket drops
    // the previous invoice's late response).
    if (oldWidget.port != widget.port ||
        oldWidget.orderId != widget.orderId ||
        oldWidget.invoiceId != widget.invoiceId) {
      _invoice = null;
      _load();
    }
  }

  Future<void> _load({bool showSkeleton = true}) async {
    final int ticket = ++_ticket;
    if (showSkeleton) setState(() => _state = _LoadState.loading);
    try {
      final InvoiceDetail i =
          await widget.port.getInvoice(widget.orderId, widget.invoiceId);
      if (!mounted || ticket != _ticket) return;
      setState(() {
        _invoice = i;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted || ticket != _ticket) return;
      // A failed silent refresh keeps the last good view.
      if (showSkeleton || _invoice == null) {
        setState(() => _state = _LoadState.error);
      }
    }
  }

  /// Export → download → share, one call at a time; then the detail is reloaded
  /// so the PDF status is the server's.
  Future<void> _exportPdf() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.port.exportInvoicePdf(widget.orderId, widget.invoiceId);
      final InvoicePdfFile file = await widget.port
          .downloadInvoicePdf(widget.orderId, widget.invoiceId);
      final AppShareFn share = widget.shareImpl ?? platformShareXFiles;
      await share(
        <XFile>[
          XFile.fromData(
            file.bytes,
            mimeType: 'application/pdf',
            name: file.fileName,
          ),
        ],
        title: file.fileName,
      );
    } catch (e) {
      if (mounted) {
        setState(
            () => _error = e is InvoicesPortError ? e.message : _kExportError);
      }
    } finally {
      await _load(showSkeleton: false);
      if (mounted) setState(() => _busy = false);
    }
  }

  // ---- view ----------------------------------------------------------------

  Widget _field(String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.space4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(width: 96, child: Text(label, style: _micro)),
            const SizedBox(width: AppTokens.space8),
            Expanded(
                child: Align(alignment: Alignment.centerLeft, child: value)),
          ],
        ),
      );

  Widget _text(String value) => Text(value, style: _strong);

  Widget _subhead(String label) => Padding(
        padding: const EdgeInsets.only(
            top: AppTokens.space12, bottom: AppTokens.space4),
        child: Text(label, style: _micro),
      );

  Widget _line(InvoiceLine line) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.space4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(child: Text('${line.name} ×${line.qty}', style: _strong)),
            const SizedBox(width: AppTokens.space8),
            MoneyText(line.amount),
          ],
        ),
      );

  Widget _document(InvoiceDetail i) => AppFrame(
        label: 'HOÁ ĐƠN BÁN HÀNG',
        onBg: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _field('Số HĐ', Text(i.invoiceNo, style: _strong)),
            _field('Ngày lập', _text(_vnDate(i.issuedAt))),
            _field('Gắn đơn', _text('${i.quoteNo} · Bản ${i.versionNo}')),
            _subhead('Người bán'),
            _field('Tên công ty', _text(_orNotConfigured(i.seller.legalName))),
            _field('MST', _text(_orNotConfigured(i.seller.taxCode))),
            _field('Địa chỉ', _text(_orNotConfigured(i.seller.address))),
            _field('Điện thoại', _text(_orNotConfigured(i.seller.phone))),
            _field('Tài khoản ngân hàng',
                _text(_orNotConfigured(i.seller.bankAccount))),
            _subhead('Khách hàng'),
            _field('Khách hàng', _text(i.customerName)),
            _field('MST khách', _text(i.customerTaxCode ?? 'Không có MST')),
            if (i.customerAddress != null)
              _field('Địa chỉ', _text(i.customerAddress!)),
            const SizedBox(height: AppTokens.space8),
            for (final InvoiceLine line in i.lines) _line(line),
            const SizedBox(height: AppTokens.space8),
            _field('Tổng trước VAT', MoneyText(i.subtotal)),
            if (i.discountAmount > 0)
              _field('Chiết khấu', MoneyText(i.discountAmount)),
            _field(i.applyVat ? 'VAT ${i.vatRate}%' : 'Không áp VAT',
                MoneyText(i.vatAmount)),
            _field('Tổng thanh toán', MoneyText(i.total)),
          ],
        ),
      );

  Widget _body() {
    switch (_state) {
      case _LoadState.loading:
        return const Column(
          children: <Widget>[AppSkeleton(), AppSkeleton(), AppSkeleton()],
        );
      case _LoadState.error:
        return AppErrorState(
          message: 'Không tải được hoá đơn.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        final InvoiceDetail i = _invoice!;
        const SizedBox gap = SizedBox(height: AppTokens.space12);
        final InvoicePdfInfo? pdf = i.pdf;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (_error != null) ...<Widget>[
              AppBanner(tone: AppBannerTone.danger, message: _error),
              gap,
            ],
            const AppBanner(
              tone: AppBannerTone.info,
              message:
                  'Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).',
            ),
            gap,
            _document(i),
            gap,
            Text(
              pdf == null
                  ? 'Chưa xuất PDF'
                  : 'Đã xuất PDF · ${_vnDate(pdf.exportedAt)}',
              style: _micro,
            ),
            const SizedBox(height: AppTokens.space8),
            AppButton(
              label: 'Xuất PDF',
              icon: 'ic-download',
              variant: AppButtonVariant.primary,
              wide: true,
              onPressed: _busy ? null : _exportPdf,
            ),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: AppTopbar(
          eyebrow: 'HOÁ ĐƠN',
          title: 'Hoá đơn bán hàng',
          onBack: widget.onBack,
        ),
        bottomNav: const AppBottomNav(activeIndex: kOrdersTabIndex),
        body: SingleChildScrollView(child: _body()),
      ),
    );
  }
}
