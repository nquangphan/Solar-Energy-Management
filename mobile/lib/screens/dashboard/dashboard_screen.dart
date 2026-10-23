// hand-authored — Flutter app-screen (Story 8.1, mobile twin of web
// web/src/screens/dashboard/DashboardScreen.tsx). Trang chủ: the operations
// dashboard for the chosen period — money collected, new orders, and orders per
// status.
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2). The screen never adds, compares or scales
// money; the chart scales counts only. Whether Doanh thu shows is decided by the
// backend: a caller without the finance permission gets `revenue: null` and the
// KPI is not rendered at all (AD-4).
//
// LABELS are byte-identical with the web twin. DashboardCubit reads through the
// injected [DashboardPort]; the screen only renders its state and forwards taps.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/dashboard_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_tabs.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'dashboard_cubit.dart';
import 'dashboard_state.dart';

const int kHomeTabIndex = 0;

const List<AppTabItem> _kPeriodTabs = <AppTabItem>[
  AppTabItem(key: 'day', label: 'Ngày'),
  AppTabItem(key: 'week', label: 'Tuần'),
  AppTabItem(key: 'month', label: 'Tháng này'),
];

/// Suffix of the KPI labels. TWIN of `PERIOD_NOUN` in the web screen.
const Map<Period, String> kPeriodNoun = <Period, String>{
  Period.day: 'hôm nay',
  Period.week: 'tuần này',
  Period.month: 'tháng này',
};

/// `YYYY-MM-DD` → `DD/MM/YYYY`: reorders the backend's day, no date arithmetic.
String _viDate(String day) => day.split('-').reversed.join('/');

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.port, this.reloadSignal});

  final DashboardPort port;

  /// Notified when the Trang chủ tab is tapped again: the figures read again.
  final Listenable? reloadSignal;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  // Created here rather than by BlocProvider(create:): the reload signal needs the
  // same instance from initState to dispose.
  late final DashboardCubit _cubit = DashboardCubit(widget.port);

  @override
  void initState() {
    super.initState();
    widget.reloadSignal?.addListener(_cubit.load);
    _cubit.load();
  }

  @override
  void didUpdateWidget(DashboardScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reloadSignal != widget.reloadSignal) {
      oldWidget.reloadSignal?.removeListener(_cubit.load);
      widget.reloadSignal?.addListener(_cubit.load);
    }
  }

  @override
  void dispose() {
    widget.reloadSignal?.removeListener(_cubit.load);
    _cubit.close();
    super.dispose();
  }

  Widget _figures(DashboardState state, DashboardSummary summary) {
    final String noun = kPeriodNoun[state.period] ?? '';
    final List<DashboardStatusCount>? byStatus = summary.ordersByStatus;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          '${_viDate(summary.from)} – ${_viDate(summary.to)}',
          style: const TextStyle(
            color: AppTokens.muted,
            fontFamily: AppTokens.fontFamily,
            fontSize: AppTokens.microFontSize,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppTokens.space12),
        if (summary.revenue != null) ...<Widget>[
          AppKpi(
            label: 'Doanh thu $noun',
            value: formatVnd(summary.revenue!),
            accent: true,
          ),
          const SizedBox(height: AppTokens.space8),
        ],
        if (summary.newOrderCount != null) ...<Widget>[
          AppKpi(label: 'Đơn mới $noun', value: '${summary.newOrderCount}'),
          const SizedBox(height: AppTokens.space12),
        ],
        if (byStatus != null)
          AppFrame(
            label: 'Đơn theo trạng thái',
            padding: const EdgeInsets.fromLTRB(
              AppTokens.space12,
              20.0,
              AppTokens.space12,
              AppTokens.space12,
            ),
            child: AppBarChart(
              items: <AppBarChartItem>[
                for (final DashboardStatusCount s in byStatus)
                  AppBarChartItem(
                    label:
                        kStatusLabels[statusKeyOf(s.status.json ?? '')] ?? '—',
                    value: s.count,
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _body(DashboardState state) {
    switch (state.status) {
      case DashboardStatus.loading:
        return const Column(
          children: <Widget>[
            AppSkeleton(height: 86),
            SizedBox(height: AppTokens.space12),
            AppSkeleton(height: 160),
          ],
        );
      case DashboardStatus.error:
        return AppErrorState(
          message: 'Không tải được số liệu.',
          onRetry: _cubit.load,
        );
      case DashboardStatus.forbidden:
        return const AppEmptyState(title: 'Không có số liệu cho tài khoản này');
      case DashboardStatus.ready:
        final DashboardSummary? summary = state.summary;
        if (summary == null) return const SizedBox.shrink();
        return _figures(state, summary);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<DashboardCubit, DashboardState>(
        builder: (BuildContext context, DashboardState state) => AppPhoneFrame(
          child: AppMobileShell(
            topbar: const AppTopbar(
              eyebrow: 'TRANG CHỦ',
              title: 'Tổng quan vận hành',
            ),
            bottomNav: const AppBottomNav(activeIndex: kHomeTabIndex),
            body: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  AppTabs(
                    tabs: _kPeriodTabs,
                    activeKey: state.period.json,
                    onSelect: (String key) =>
                        _cubit.selectPeriod(Period.fromJson(key)),
                  ),
                  const SizedBox(height: AppTokens.space12),
                  _body(state),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
