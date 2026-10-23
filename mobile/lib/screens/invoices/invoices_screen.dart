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
//
// InvoicesCubit reads and creates through the injected [InvoicesPort] (Story
// 11.4); the screen opens the confirm dialog and renders its state.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/invoices_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../orders/discount_approval_screen.dart' show kOrdersTabIndex;
import 'invoices_cubit.dart';
import 'invoices_state.dart';

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

/// UTC instant ⇒ `dd/MM/yyyy` in Vietnam (UTC+7).
String _vnDate(DateTime instant) {
  final DateTime d = instant.toUtc().add(const Duration(hours: 7));
  String pad(int n) => n.toString().padLeft(2, '0');
  return '${pad(d.day)}/${pad(d.month)}/${d.year}';
}

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
  // Created here rather than by BlocProvider(create:): the confirm dialog calls it
  // after the dialog's await, from a route outside this screen's context.
  late final InvoicesCubit _cubit = InvoicesCubit(widget.port, widget.orderId);

  // Render reads the cubit state; the names are kept because design-system guards pin them.
  InvoicesStatus get _state => _cubit.state.status;
  InvoicesOverview? get _overview => _cubit.state.overview;
  bool get _busy => _cubit.state.busy;
  String? get _error => _cubit.state.error;

  @override
  void initState() {
    super.initState();
    _cubit.load();
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
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
        onConfirm: _cubit.create,
      ),
    );
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
      case InvoicesStatus.loading:
        return const Column(
          children: <Widget>[AppSkeleton(), AppSkeleton(), AppSkeleton()],
        );
      case InvoicesStatus.error:
        return AppErrorState(
          message: 'Không tải được thông tin hoá đơn.',
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case InvoicesStatus.ready:
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
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<InvoicesCubit, InvoicesState>(
        builder: (BuildContext context, InvoicesState _) => _view(),
      ),
    );
  }

  Widget _view() {
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
