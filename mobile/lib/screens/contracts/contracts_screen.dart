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
//
// ContractsCubit reads and writes through the injected [ContractsPort] (Story
// 11.4); the screen hands it the share seam and renders its state.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/contracts_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../orders/discount_approval_screen.dart' show kOrdersTabIndex;
import 'contracts_cubit.dart';
import 'contracts_state.dart';

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

/// Presentation-only label of a backend `contractType`; a type this build does
/// not know shows the neutral `—`, never another document's name.
String contractTypeLabel(String contractType) => switch (contractType) {
      'construction' => 'HĐ Thi công',
      'sale' => 'HĐ Mua bán',
      _ => '—',
    };

/// ISO-8601 UTC ⇒ `dd/MM/yyyy` in Vietnam (UTC+7).
String _vnDate(String iso) {
  final DateTime d = DateTime.parse(iso).toUtc().add(const Duration(hours: 7));
  String pad(int n) => n.toString().padLeft(2, '0');
  return '${pad(d.day)}/${pad(d.month)}/${d.year}';
}

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
  // Created here rather than by BlocProvider(create:): the buttons call it after
  // the share sheet's await, as the other money screens do.
  late final ContractsCubit _cubit = ContractsCubit(widget.port, widget.orderId);

  // Render reads the cubit state; the names are kept because design-system guards pin them.
  ContractsStatus get _state => _cubit.state.status;
  ContractsOverview? get _overview => _cubit.state.overview;
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

  AppShareFn get _shareFn => widget.shareImpl ?? platformShareXFiles;

  void _generate() => _cubit.generate(_shareFn);

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
            _field('Loại HĐ', _text(contractTypeLabel(o.contractType.json ?? ''))),
            _field('Hai bên', _text('A: ${o.customerName} · B: Phương Nam')),
            _field('Vật tư', _text('${o.lineCount} dòng · snapshot đơn')),
            _field('Tổng tiền', MoneyText(o.orderTotal.toInt())),
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
                '${c.contractNo} · ${contractTypeLabel(c.contractType.json ?? '')} · '
                'Bản ${c.versionNo} · ${_vnDate(c.createdAt.toUtc().toIso8601String())}',
                style: _strong,
              ),
            ),
            const SizedBox(width: AppTokens.space8),
            AppButton(
              label: 'Tải PDF',
              size: AppButtonSize.sm,
              onPressed: _busy ? null : () => _cubit.download(c.id, _shareFn),
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
      case ContractsStatus.loading:
        return const Column(
          children: <Widget>[AppSkeleton(), AppSkeleton(), AppSkeleton()],
        );
      case ContractsStatus.error:
        return AppErrorState(
          message: 'Không tải được thông tin hợp đồng.',
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case ContractsStatus.ready:
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
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<ContractsCubit, ContractsState>(
        builder: (BuildContext context, ContractsState _) => _view(),
      ),
    );
  }

  Widget _view() {
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
