// hand-authored — Flutter app-screen (mobile twin of web
// web/src/screens/reports/ProfitReportScreen.tsx). Báo cáo lợi nhuận, opened
// from Menu: the issued orders' gross profit on materials, grouped four ways by
// a tab row (order / month / assignee / customer source), over this month, this
// year or a custom Vietnam-day range.
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2): revenue, cost, gross profit, margin and
// the row labels come from the backend; the screen never adds, subtracts or
// divides money — it only picks how to print a value.
//
// LABELS are byte-identical with the web twin. ProfitReportCubit reads through
// the injected [ProfitReportPort]; the screen only renders its state and
// forwards taps. The two date controllers stay here, in the State: a custom day
// applies only once it is a real `YYYY-MM-DD` (the web twin's native date input
// never exposes a half-typed value).

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/profit_report_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_tabs.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../customers/customer_pick_screen.dart' show kMenuTabIndex;
import 'profit_report_cubit.dart';
import 'profit_report_state.dart';

/// The mandatory scope label (§4) — shown word for word on web and mobile.
const String kProfitScopeLabel =
    'Lợi nhuận gộp trên vật tư. Chưa trừ nhân công, vận chuyển, chi phí chung.';
const String kProfitNotIssuedNote = 'Đơn chưa xuất kho không có trong báo cáo.';

/// Ways to group, in tab order. TWIN of `PROFIT_GROUP_OPTIONS` in the web screen
/// (the tabs are shorter on a phone, as in the mockup).
const List<AppTabItem> kProfitGroupTabs = <AppTabItem>[
  AppTabItem(key: 'order', label: 'Đơn'),
  AppTabItem(key: 'month', label: 'Tháng'),
  AppTabItem(key: 'assignee', label: 'Sale'),
  AppTabItem(key: 'source', label: 'Nguồn'),
];

const List<AppTabItem> _kPeriodTabs = <AppTabItem>[
  AppTabItem(key: 'month', label: 'Tháng này'),
  AppTabItem(key: 'year', label: 'Năm nay'),
  AppTabItem(key: 'custom', label: 'Tuỳ chọn'),
];

/// `YYYY-MM-DD` → `DD/MM/YYYY`: reorders the backend's day, no date arithmetic.
String _viDate(String day) => day.split('-').reversed.join('/');

/// Whole percent from the backend; `null` (no revenue) prints a dash.
String _marginText(int? marginPct) => marginPct == null ? '—' : '$marginPct%';

class ProfitReportScreen extends StatefulWidget {
  const ProfitReportScreen({super.key, required this.port});

  final ProfitReportPort port;

  @override
  State<ProfitReportScreen> createState() => _ProfitReportScreenState();
}

class _ProfitReportScreenState extends State<ProfitReportScreen> {
  late final ProfitReportCubit _cubit = ProfitReportCubit(widget.port)..load();
  final TextEditingController _from = TextEditingController();
  final TextEditingController _to = TextEditingController();

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<ProfitReportCubit, ProfitReportState>(builder: _view),
    );
  }

  static const TextStyle _muted = TextStyle(
    color: AppTokens.muted,
    fontFamily: AppTokens.fontFamily,
    fontSize: 12.0,
    fontWeight: FontWeight.w600,
  );

  static const List<FontFeature> _tabular = <FontFeature>[
    FontFeature.tabularFigures(),
  ];

  Widget _view(BuildContext context, ProfitReportState state) {
    final ProfitReport? report = state.report;
    final bool ready = state.status == ProfitReportStatus.ready;
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'BÁO CÁO', title: 'Lợi nhuận gộp'),
        bottomNav: const AppBottomNav(activeIndex: kMenuTabIndex),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (ready && report != null) ...<Widget>[
              _kpis(report.totals),
              const SizedBox(height: AppTokens.space12),
            ],
            const AppBanner(
              tone: AppBannerTone.info,
              icon: 'ic-info',
              message: kProfitScopeLabel,
            ),
            const SizedBox(height: AppTokens.space12),
            AppTabs(
              tabs: kProfitGroupTabs,
              activeKey: state.groupBy.json ?? 'order',
              onSelect: (String key) =>
                  _cubit.selectGroupBy(ProfitGroupBy.fromJson(key)),
            ),
            const SizedBox(height: AppTokens.space8),
            AppTabs(
              tabs: _kPeriodTabs,
              activeKey: state.period.json ?? 'month',
              onSelect: (String key) =>
                  _cubit.selectPeriod(ProfitPeriod.fromJson(key)),
            ),
            if (state.period == ProfitPeriod.custom) ...<Widget>[
              const SizedBox(height: AppTokens.space12),
              AppField(
                label: 'Từ ngày',
                placeholder: 'YYYY-MM-DD',
                controller: _from,
                keyboardType: TextInputType.datetime,
                onChanged: _cubit.setFrom,
              ),
              const SizedBox(height: AppTokens.space8),
              AppField(
                label: 'Đến ngày',
                placeholder: 'YYYY-MM-DD',
                controller: _to,
                keyboardType: TextInputType.datetime,
                onChanged: _cubit.setTo,
              ),
            ],
            const SizedBox(height: AppTokens.space12),
            if (ready && report != null) ...<Widget>[
              Text(
                'Xuất kho ${_viDate(report.from)} – ${_viDate(report.to)}',
                style: _muted,
              ),
              const SizedBox(height: AppTokens.space8),
            ],
            _body(state),
            const SizedBox(height: AppTokens.space12),
            const AppCard(
              padding: EdgeInsets.all(AppTokens.space12),
              child: Text(kProfitNotIssuedNote, style: _muted),
            ),
          ],
        ),
      ),
    );
  }

  /// 2 × 2: revenue, cost, gross profit (accent), margin.
  Widget _kpis(ProfitFigures totals) {
    Widget pair(Widget a, Widget b) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(child: a),
        const SizedBox(width: AppTokens.space8),
        Expanded(child: b),
      ],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        pair(
          AppKpi(label: 'Doanh thu', value: formatVnd(totals.revenue)),
          AppKpi(label: 'Giá vốn', value: formatVnd(totals.cost)),
        ),
        const SizedBox(height: AppTokens.space8),
        pair(
          AppKpi(
            label: 'Lợi nhuận gộp',
            value: formatVnd(totals.grossProfit),
            accent: true,
          ),
          AppKpi(label: 'Biên gộp', value: _marginText(totals.marginPct)),
        ),
      ],
    );
  }

  Widget _body(ProfitReportState state) {
    switch (state.status) {
      case ProfitReportStatus.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppSkeleton(height: 86),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(height: 56),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(height: 56),
          ],
        );
      case ProfitReportStatus.awaitingDates:
        return const AppEmptyState(title: 'Chọn từ ngày và đến ngày');
      case ProfitReportStatus.reversedDates:
        return const AppEmptyState(title: kProfitReversedDates);
      case ProfitReportStatus.error:
        return AppErrorState(
          message: state.errorMessage ?? kProfitReportLoadError,
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case ProfitReportStatus.ready:
        final ProfitReport? report = state.report;
        if (report == null || report.rows.isEmpty) {
          return const AppEmptyState(
            title: 'Chưa có đơn đã xuất kho trong kỳ này.',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (final ProfitReportRow row in report.rows) ...<Widget>[
              _row(report.groupBy, row),
              const SizedBox(height: AppTokens.space8),
            ],
          ],
        );
    }
  }

  /// Second line: order rows show source · assignee · revenue; group rows the
  /// order count · revenue.
  String _detail(ProfitGroupBy groupBy, ProfitReportRow row) {
    final String sales = 'DT ${formatVnd(row.revenue)}';
    if (groupBy != ProfitGroupBy.order) {
      return '${row.orderCount} đơn · $sales';
    }
    return '${row.sourceName ?? '—'} · '
        '${row.assigneeDisplayName ?? '—'} · $sales';
  }

  Widget _row(ProfitGroupBy groupBy, ProfitReportRow row) {
    return AppCard(
      key: ValueKey<String>('profit-${row.key ?? 'unassigned'}'),
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  row.label,
                  style: const TextStyle(
                    color: AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 13.0,
                    fontWeight: FontWeight.w800,
                    fontFeatures: _tabular,
                  ),
                ),
                const SizedBox(height: AppTokens.space4),
                Text(_detail(groupBy, row), style: _muted),
              ],
            ),
          ),
          const SizedBox(width: AppTokens.space8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(
                formatVnd(row.grossProfit),
                style: const TextStyle(
                  color: AppTokens.ink,
                  fontFamily: AppTokens.fontFamily,
                  fontSize: 13.0,
                  fontWeight: FontWeight.w800,
                  fontFeatures: _tabular,
                ),
              ),
              const SizedBox(height: AppTokens.space4),
              Text(_marginText(row.marginPct), style: _muted),
            ],
          ),
        ],
      ),
    );
  }
}
