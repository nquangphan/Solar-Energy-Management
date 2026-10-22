// hand-authored — Flutter app-screen (Story 7.4, mobile twin of web
// web/src/screens/invoices/InvoicesScreen.tsx). Hoá đơn bán hàng: creates the
// internal invoice of one order (a snapshot of the current order version) and lists
// the ones already created.
//
// THE CLIENT COMPUTES NO MONEY. The total, the invoice number and whether creation
// is possible are the backend's; the total renders only through `MoneyText`.
//
// "Tạo hoá đơn" is hidden (not greyed out) when the backend says the order is not
// `creatable` or the current version already has an invoice, and asks for a confirm
// first: an invoice cannot be edited after creation. Each created invoice opens its
// document (Xem hoá đơn) when the caller wires a route.
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

const String _kUnknownError = 'Không tạo được hoá đơn. Vui lòng thử lại.';

/// UTC instant ⇒ `dd/MM/yyyy` in Vietnam (UTC+7).
String _vnDate(DateTime instant) {
  final DateTime d = instant.toUtc().add(const Duration(hours: 7));
  String pad(int n) => n.toString().padLeft(2, '0');
  return '${pad(d.day)}/${pad(d.month)}/${d.year}';
}

enum _LoadState { loading, ready, error }

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({
    super.key,
    required this.port,
    required this.orderId,
    this.onBack,
    this.onOpenInvoice,
  });

  final InvoicesPort port;
  final String orderId;
  final VoidCallback? onBack;

  /// Opens one created invoice. Without it the list has no "Xem" button.
  final ValueChanged<String>? onOpenInvoice;

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  _LoadState _state = _LoadState.loading;
  InvoicesOverview? _overview;
  int _ticket = 0;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool showSkeleton = true}) async {
    final int ticket = ++_ticket;
    if (showSkeleton) setState(() => _state = _LoadState.loading);
    try {
      final InvoicesOverview o = await widget.port.getOverview(widget.orderId);
      if (!mounted || ticket != _ticket) return;
      setState(() {
        _overview = o;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted || ticket != _ticket) return;
      // A failed silent refresh keeps the last good view.
      if (showSkeleton || _overview == null) {
        setState(() => _state = _LoadState.error);
      }
    }
  }

  Future<void> _confirmCreate(InvoicesOverview o) async {
    await showAppDialog<void>(
      context: context,
      child: AppConfirmDialog(
        title: 'Tạo hoá đơn?',
        consequence:
            'Hoá đơn chụp lại bản ${o.versionNo} của đơn và không sửa được sau khi tạo.',
        confirmLabel: 'Tạo hoá đơn',
        cancelLabel: 'Huỷ',
        confirmTone: AppButtonVariant.primary,
        onConfirm: _create,
      ),
    );
  }

  /// One call at a time; a failure becomes a banner with the server message
  /// verbatim, then the overview is reloaded.
  Future<void> _create() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.port.createInvoice(widget.orderId);
    } catch (e) {
      if (mounted) {
        setState(
            () => _error = e is InvoicesPortError ? e.message : _kUnknownError);
      }
    } finally {
      // Still busy while reloading: the button must not come back before the
      // overview says whether the version now has its invoice.
      await _load(showSkeleton: false);
      if (mounted) {
        setState(() {
          _busy = false;
          // A lost response (fallback, not a server refusal) whose invoice was
          // in fact created: the reload shows it, so the "could not create"
          // banner would contradict the screen.
          if (_error == _kUnknownError && _overview?.currentInvoiceId != null) {
            _error = null;
          }
        });
      }
    }
  }

  // ---- view ----------------------------------------------------------------

  Widget _field(String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.space4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(width: 84, child: Text(label, style: _micro)),
            const SizedBox(width: AppTokens.space8),
            Expanded(
                child: Align(alignment: Alignment.centerLeft, child: value)),
          ],
        ),
      );

  Widget _text(String value) => Text(value, style: _strong);

  Widget _sourceFrame(InvoicesOverview o) => AppFrame(
        label: 'Tạo hoá đơn từ đơn',
        onBg: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _field('Nguồn', _text('Bản ${o.versionNo} (snapshot)')),
            _field('Khách hàng', _text(o.customerName)),
            _field('MST khách', _text(o.customerTaxCode ?? 'Không có MST')),
            _field('Tổng tiền', MoneyText(o.orderTotal.toInt())),
            _field('Số HĐ nội bộ', _text('Tự cấp khi tạo')),
          ],
        ),
      );

  Widget _historyItem(InvoiceSummary i) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.space8),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                '${i.invoiceNo} · Bản ${i.versionNo} · ${_vnDate(i.issuedAt)}',
                style: _strong,
              ),
            ),
            const SizedBox(width: AppTokens.space8),
            MoneyText(i.total.toInt()),
            if (widget.onOpenInvoice != null) ...<Widget>[
              const SizedBox(width: AppTokens.space8),
              AppButton(
                label: 'Xem',
                size: AppButtonSize.sm,
                onPressed: () => widget.onOpenInvoice!(i.id),
              ),
            ],
          ],
        ),
      );

  Widget _history(InvoicesOverview o) => AppFrame(
        label: 'Hoá đơn đã tạo',
        onBg: true,
        child: o.invoices.isEmpty
            ? const AppEmptyState(title: 'Chưa tạo hoá đơn nào.')
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  for (final InvoiceSummary i in o.invoices) _historyItem(i),
                ],
              ),
      );

  String? _currentInvoiceNo(InvoicesOverview o) {
    final String? id = o.currentInvoiceId;
    if (id == null) return null;
    for (final InvoiceSummary i in o.invoices) {
      if (i.id == id) return i.invoiceNo;
    }
    return null;
  }

  Widget _body() {
    switch (_state) {
      case _LoadState.loading:
        return const Column(
          children: <Widget>[AppSkeleton(), AppSkeleton(), AppSkeleton()],
        );
      case _LoadState.error:
        return AppErrorState(
          message: 'Không tải được thông tin hoá đơn.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        final InvoicesOverview o = _overview!;
        const SizedBox gap = SizedBox(height: AppTokens.space12);
        final bool hasCurrent = o.currentInvoiceId != null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _sourceFrame(o),
            gap,
            const AppBanner(
              tone: AppBannerTone.info,
              message:
                  'Hoá đơn nội bộ — không tích hợp nhà cung cấp hoá đơn điện tử (Phase sau).',
            ),
            if (!o.creatable && o.blockedReason != null) ...<Widget>[
              gap,
              AppBanner(tone: AppBannerTone.warn, message: o.blockedReason),
            ],
            if (hasCurrent) ...<Widget>[
              gap,
              AppBanner(
                tone: AppBannerTone.info,
                message:
                    'Bản đơn hiện hành đã có hoá đơn ${_currentInvoiceNo(o) ?? ''}.',
              ),
            ],
            if (_error != null) ...<Widget>[
              gap,
              AppBanner(tone: AppBannerTone.danger, message: _error),
            ],
            if (o.creatable && !hasCurrent) ...<Widget>[
              gap,
              Align(
                alignment: Alignment.centerLeft,
                child: AppButton(
                  label: 'Tạo hoá đơn',
                  variant: AppButtonVariant.primary,
                  onPressed: _busy ? null : () => _confirmCreate(o),
                ),
              ),
            ],
            gap,
            _history(o),
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
