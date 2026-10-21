// hand-authored — Flutter app-screen (Story 7.3, mobile twin of web
// web/src/screens/contracts/ContractsScreen.tsx). Sinh hợp đồng: shows what goes
// into the contract of one order, generates a NEW contract PDF on every press and
// lists the ones already generated.
//
// THE CLIENT COMPUTES NO MONEY. The total, the schedule label, the contract number
// and whether generation is possible are the backend's; the total renders only
// through `MoneyText`.
//
// "Xuất PDF hợp đồng" is hidden (not greyed out) when the backend says the order is
// not `generatable`; missing legal-entity fields only warn — the button stays.
// There is no confirm dialog: generating a document is not a money action.
//
// LABELS are byte-identical with the web twin.

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/contracts_port.dart';
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

const String _kUnknownError = 'Không xuất được hợp đồng. Vui lòng thử lại.';
const String _kDownloadError =
    'Không tải được file hợp đồng. Vui lòng thử lại.';

/// The contract exists now, so a retry of "Xuất PDF hợp đồng" would make a SECOND
/// one: point at "Tải PDF" in the refreshed list instead.
String _generatedButNotDownloaded(String contractNo) =>
    'Đã sinh hợp đồng $contractNo nhưng chưa tải được — bấm “Tải PDF” trong danh sách.';

/// Presentation-only label of a backend `contractType`.
String contractTypeLabel(String contractType) =>
    contractType == 'construction' ? 'HĐ Thi công' : 'HĐ Mua bán';

/// ISO-8601 UTC ⇒ `dd/MM/yyyy` in Vietnam (UTC+7).
String _vnDate(String iso) {
  final DateTime d = DateTime.parse(iso).toUtc().add(const Duration(hours: 7));
  String pad(int n) => n.toString().padLeft(2, '0');
  return '${pad(d.day)}/${pad(d.month)}/${d.year}';
}

enum _LoadState { loading, ready, error }

class ContractsScreen extends StatefulWidget {
  const ContractsScreen({
    super.key,
    required this.port,
    required this.orderId,
    this.onBack,
    this.shareImpl,
  });

  final ContractsPort port;
  final String orderId;
  final VoidCallback? onBack;

  /// Share seam; tests inject one so no platform channel is hit.
  final AppShareFn? shareImpl;

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> {
  _LoadState _state = _LoadState.loading;
  ContractsOverview? _overview;
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
      final ContractsOverview o = await widget.port.getOverview(widget.orderId);
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

  Future<void> _share(String contractId) async {
    final ContractPdfFile file =
        await widget.port.downloadContractPdf(widget.orderId, contractId);
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
  }

  /// Runs [action] once at a time; a failure becomes a banner with the server
  /// message verbatim, then the overview is reloaded.
  Future<void> _run(Future<void> Function() action,
      {String fallback = _kUnknownError}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) {
        setState(() => _error = e is ContractsPortError ? e.message : fallback);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    await _load(showSkeleton: false);
  }

  Future<void> _generate() => _run(() async {
        final ContractSummary created =
            await widget.port.generateContract(widget.orderId);
        try {
          await _share(created.id);
        } catch (_) {
          if (mounted) {
            setState(
                () => _error = _generatedButNotDownloaded(created.contractNo));
          }
        }
      });

  Future<void> _download(String contractId) =>
      _run(() => _share(contractId), fallback: _kDownloadError);

  // ---- view ----------------------------------------------------------------

  Widget _field(String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.space4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(width: 72, child: Text(label, style: _micro)),
            const SizedBox(width: AppTokens.space8),
            Expanded(
                child: Align(alignment: Alignment.centerLeft, child: value)),
          ],
        ),
      );

  Widget _text(String value) => Text(value, style: _strong);

  Widget _fieldsFrame(ContractsOverview o) => AppFrame(
        label: 'Trường động đưa vào HĐ',
        onBg: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _field('Loại HĐ', _text(contractTypeLabel(o.contractType))),
            _field('Hai bên', _text('A: ${o.customerName} · B: Phương Nam')),
            _field('Vật tư', _text('${o.lineCount} dòng · snapshot đơn')),
            _field('Tổng tiền', MoneyText(o.orderTotal)),
            _field('Lịch TT', _text(o.scheduleLabel ?? '—')),
            _field('Số BG', _text(o.quoteNo)),
          ],
        ),
      );

  Widget _historyItem(ContractSummary c) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppTokens.space8),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                '${c.contractNo} · ${contractTypeLabel(c.contractType)} · '
                'Bản ${c.versionNo} · ${_vnDate(c.createdAt)}',
                style: _strong,
              ),
            ),
            const SizedBox(width: AppTokens.space8),
            AppButton(
              label: 'Tải PDF',
              size: AppButtonSize.sm,
              onPressed: _busy ? null : () => _download(c.id),
            ),
          ],
        ),
      );

  Widget _history(ContractsOverview o) => AppFrame(
        label: 'Hợp đồng đã sinh',
        onBg: true,
        child: o.contracts.isEmpty
            ? const AppEmptyState(title: 'Chưa sinh hợp đồng nào.')
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  for (final ContractSummary c in o.contracts) _historyItem(c),
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
          message: 'Không tải được thông tin hợp đồng.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        final ContractsOverview o = _overview!;
        const SizedBox gap = SizedBox(height: AppTokens.space12);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _fieldsFrame(o),
            gap,
            const AppBanner(
              tone: AppBannerTone.info,
              message: 'Điều khoản là template tĩnh; sinh HĐ ghi Audit log.',
            ),
            if (o.missingPartyFields.isNotEmpty) ...<Widget>[
              gap,
              AppBanner(
                tone: AppBannerTone.warn,
                message:
                    'Thông tin pháp nhân chưa cấu hình: ${o.missingPartyFields.join(', ')}. '
                    'Hợp đồng vẫn xuất được — các ô này in “Chưa cấu hình”.',
              ),
            ],
            if (!o.generatable) ...<Widget>[
              gap,
              AppBanner(
                tone: AppBannerTone.warn,
                message: o.blockedReason ?? '',
              ),
            ],
            if (_error != null) ...<Widget>[
              gap,
              AppBanner(tone: AppBannerTone.danger, message: _error),
            ],
            if (o.generatable) ...<Widget>[
              gap,
              Align(
                alignment: Alignment.centerLeft,
                child: AppButton(
                  label: 'Xuất PDF hợp đồng',
                  variant: AppButtonVariant.primary,
                  onPressed: _busy ? null : _generate,
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
          eyebrow: 'HỢP ĐỒNG',
          title: 'Sinh hợp đồng',
          onBack: widget.onBack,
        ),
        bottomNav: const AppBottomNav(activeIndex: kOrdersTabIndex),
        body: SingleChildScrollView(child: _body()),
      ),
    );
  }
}
