// hand-authored — Flutter app-screen (Story 5.4). Mobile twin of the web
// OrderDetailScreen: lifecycle stepper + two tabs (facts / update history),
// composed from shipped widgets.
//
// THE STEP SEQUENCE IS NOT COMPUTED HERE. Which steps this order has, and which
// one it stands on, come from `getLifecycle()` — the backend derives them from
// the one transition table (AD-2/AD-11). A second copy of that logic on the
// client would drift the first time Epic 6 changes the real one.
//
// Steps blocked by a scope flag are ABSENT from the response, so nothing is
// filtered here and nothing renders dimmed (UX-DR-11).
//
// The status chip is READ-ONLY (UX-DR-23): changing status is its own screen
// (Story 5.5), reached by the one action button here. "Huỷ đơn" (5.7) and
// "Share báo giá" still lead to screens that do not exist — they stay absent.
//
// THE BUTTON'S VISIBILITY IS NOT A PERMISSION CALCULATION. It shows exactly when
// the backend returned a non-empty `buocKeTiep`, and is ABSENT otherwise — not
// greyed (UX-DR-22). The branches need DIFFERENT permission keys, so an any-of
// expression here would be a third copy of the rule and it would drift
// (AD-2/AD-4).
//
// LABELS are byte-identical with the web twin (UX-DR-27) — including the tab and
// frame labels. The mockup shortens them on mobile ("Lịch sử", "Vòng đời"); this
// screen deliberately does not follow it, because the two platforms differ in
// frame and navigation, not in wording.
//
// No money math (AD-10/16): every number shown is one the backend computed.

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_tabs.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'discount_approval_screen.dart' show kOrdersTabIndex;

/// `notFound` is its own state, NOT a flavour of `error`: "this order does not
/// exist, or is not yours" is an answer, and pressing "Thử lại" on an answer
/// just asks the same question again (UX-DR-19).
enum _LoadState { loading, ready, error, notFound }

const String _kTabThongTin = 'thong-tin';
const String _kTabLichSu = 'lich-su';

/// Exactly two tabs. Thanh toán + Hợp đồng/Hoá đơn are Epic 7 and Ảnh is Story
/// 5.6 — an empty tab promises the user something nobody built.
const List<AppTabItem> _kTabs = <AppTabItem>[
  AppTabItem(key: _kTabThongTin, label: 'Thông tin'),
  AppTabItem(key: _kTabLichSu, label: 'Lịch sử update'),
];

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({
    super.key,
    required this.port,
    required this.orderId,
    this.onBack,
    this.onChangeStatus,
  });

  final OrdersPort port;
  final String orderId;
  final VoidCallback? onBack;

  /// Opens the status-change screen (Story 5.5). Null = the button never renders.
  final VoidCallback? onChangeStatus;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Order? _order;
  List<OrderLifecycleStep> _steps = const <OrderLifecycleStep>[];
  List<OrderNextStep> _buocKeTiep = const <OrderNextStep>[];
  List<OrderVersionItem> _versions = const <OrderVersionItem>[];
  _LoadState _state = _LoadState.loading;
  String _tab = _kTabThongTin;

  /// Three requests, ONE ticket for the whole batch: they are one screenful of
  /// one order, so a stale batch must be discarded as a batch.
  int _latest = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final int ticket = ++_latest;
    setState(() => _state = _LoadState.loading);
    try {
      final List<Object> results = await Future.wait(<Future<Object>>[
        widget.port.get(widget.orderId),
        widget.port.getLifecycle(widget.orderId),
        widget.port.listVersions(widget.orderId),
      ]);
      if (!mounted || ticket != _latest) return;
      setState(() {
        _order = results[0] as Order;
        final OrderLifecycle vongDoi = results[1] as OrderLifecycle;
        _steps = vongDoi.buoc;
        _buocKeTiep = vongDoi.buocKeTiep;
        _versions = results[2] as List<OrderVersionItem>;
        _state = _LoadState.ready;
      });
    } catch (error) {
      if (!mounted || ticket != _latest) return;
      // Branch on the envelope CODE, never on the message text (AD-5).
      final bool khongThay =
          error is OrderPortException && error.code == 'NOT_FOUND';
      setState(
        () => _state = khongThay ? _LoadState.notFound : _LoadState.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: AppTopbar(
          eyebrow: 'ĐƠN HÀNG',
          title: 'Chi tiết đơn',
          onBack: widget.onBack,
        ),
        bottomNav: const AppBottomNav(activeIndex: kOrdersTabIndex),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[_body()],
        ),
      ),
    );
  }

  Widget _body() {
    switch (_state) {
      case _LoadState.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            Text(
              'Đang tải chi tiết đơn…',
              style: TextStyle(
                color: AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        );
      case _LoadState.error:
        return AppErrorState(
          message: 'Không tải được chi tiết đơn.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.notFound:
        return AppErrorState(
          message: 'Không tìm thấy đơn này.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        final Order? order = _order;
        if (order == null) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _stepper(),
            if (_buocKeTiep.isNotEmpty && widget.onChangeStatus != null) ...<Widget>[
              const SizedBox(height: AppTokens.space12),
              Align(
                alignment: Alignment.centerLeft,
                child: AppButton(
                  label: 'Chuyển trạng thái',
                  variant: AppButtonVariant.primary,
                  onPressed: widget.onChangeStatus,
                ),
              ),
            ],
            const SizedBox(height: AppTokens.space16),
            AppTabs(
              tabs: _kTabs,
              activeKey: _tab,
              onSelect: (String key) => setState(() => _tab = key),
            ),
            const SizedBox(height: AppTokens.space16),
            if (_tab == _kTabThongTin) _facts(order) else _history(),
          ],
        );
    }
  }

  /// The stepper in its frame.
  ///
  /// ⚠️ HORIZONTAL SCROLL IS LOAD-BEARING. `AppStepper` lays its nodes out in a
  /// Row that does not wrap: 64px per node + 26px per bar, so a seven-step order
  /// needs 604px and overflows every phone. The only shipped caller so far
  /// (forgot-password) has three steps and never hit it; web does not hit it
  /// either because `.stepper` wraps in CSS.
  ///
  /// Scrolling is fixed HERE rather than in the widget: `AppStepper` has shipped
  /// with render tests, and changing its layout changes the three-step caller
  /// that works fine today. A horizontal scroller nested in the shell's vertical
  /// one is fine — different axes.
  Widget _stepper() {
    return AppFrame(
      label: 'Vòng đời đơn',
      onBg: true,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: AppStepper(
          steps: <AppStepItem>[
            for (final OrderLifecycleStep step in _steps)
              AppStepItem(
                label: kStatusLabels[statusKeyOf(step.status)] ?? step.status,
                // `gate` (dashed) is deliberately never used: a step blocked by
                // a scope flag is absent, so the dashed state has no valid case
                // on this screen.
                state: step.trangThai == 'done'
                    ? AppStepState.done
                    : step.trangThai == 'current'
                        ? AppStepState.current
                        : AppStepState.upcoming,
              ),
          ],
        ),
      ),
    );
  }

  Widget _facts(Order order) {
    final StatusKey? key = statusKeyOf(order.status);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _kv('Mã đơn', order.id, mono: true),
        _kv('SĐT khách', order.customerSdt, mono: true),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppTokens.space4),
          child: Row(
            children: <Widget>[
              SizedBox(width: 120.0, child: _label('Trạng thái')),
              if (key != null)
                AppStatusChip(status: key)
              else
                Text(order.status),
            ],
          ),
        ),
        _kv('Công suất', order.kWp == null ? '—' : '${order.kWp} kWp'),
        _kv('Người phụ trách', order.assigneeAccountId ?? '—'),
        // All three flags always render: AppScopeFlag strikes the off ones
        // through, so "Thi công is off" reads differently from "the screen
        // forgot to draw it". Which STEPS exist is a separate question and the
        // backend already answered it — these chips never feed the stepper.
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppTokens.space4),
          child: Row(
            children: <Widget>[
              SizedBox(width: 120.0, child: _label('Phạm vi')),
              Expanded(
                child: Wrap(
                  spacing: AppTokens.space4,
                  runSpacing: AppTokens.space4,
                  children: <Widget>[
                    AppScopeFlag(label: 'Thiết bị', on: order.scopeThietBi),
                    AppScopeFlag(label: 'Thi công', on: order.scopeThiCong),
                    AppScopeFlag(
                      label: 'Vận chuyển',
                      on: order.scopeVanChuyen,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppTokens.space8),
        // The lines of the current version. `amount` is the backend's number,
        // rendered as given — no arithmetic on this screen (AD-10).
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: order.lineItems.length,
          separatorBuilder: (_, __) => const SizedBox(height: AppTokens.space8),
          itemBuilder: (BuildContext context, int i) {
            final OrderLine line = order.lineItems[i];
            return AppCard(
              padding: const EdgeInsets.all(AppTokens.space12),
              child: Row(
                children: <Widget>[
                  Expanded(child: _value(line.name)),
                  _label('${line.qty} ${line.unit}'),
                  const SizedBox(width: AppTokens.space8),
                  _mono('${line.amount}'),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _history() {
    if (_versions.isEmpty) {
      return const AppEmptyState(
        title: 'Chưa có bản update nào',
        message: 'Đơn vẫn ở bản gốc.',
      );
    }
    // The shell owns the scrolling; this list only lays its rows out.
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _versions.length,
      separatorBuilder: (_, __) => const SizedBox(height: AppTokens.space8),
      itemBuilder: (BuildContext context, int i) => _versionRow(_versions[i]),
    );
  }

  Widget _versionRow(OrderVersionItem version) {
    return AppCard(
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              _value('Bản ${version.versionNo}'),
              const SizedBox(width: AppTokens.space8),
              if (version.laBanHienLuc)
                // The effective-version marker reuses the canonical `dachot`
                // triplet — teal answers "which one counts", the same question
                // the current step answers on the stepper.
                AppChip(
                  label: 'Bản hiệu lực',
                  background: kStatusColors[StatusKey.dachot]!.background,
                  foreground: kStatusColors[StatusKey.dachot]!.foreground,
                  border: kStatusColors[StatusKey.dachot]!.border,
                ),
            ],
          ),
          const SizedBox(height: AppTokens.space4),
          // No invented name: a version created before the actor column existed
          // simply has no author.
          _label(
            '${version.createdByDisplayName ?? '—'} · ${version.createdAt} · ${version.soDong} dòng',
          ),
          const SizedBox(height: AppTokens.space4),
          _label(_summarise(version)),
        ],
      ),
    );
  }

  /// One version's change set as a short Vietnamese summary; "Bản gốc" for the
  /// first one. Byte-identical wording with the web twin.
  String _summarise(OrderVersionItem version) {
    if (version.versionNo == 1) return 'Bản gốc';
    final List<String> parts = <String>[
      if (version.thayDoi.them.isNotEmpty)
        'thêm ${version.thayDoi.them.length} dòng',
      if (version.thayDoi.xoa.isNotEmpty)
        'xoá ${version.thayDoi.xoa.length} dòng',
      if (version.thayDoi.doiSoLuong.isNotEmpty)
        'đổi SL ${version.thayDoi.doiSoLuong.length} dòng',
    ];
    return parts.isEmpty ? 'Không đổi dòng nào' : parts.join(' · ');
  }

  Widget _kv(String label, String value, {bool mono = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppTokens.space4),
      child: Row(
        children: <Widget>[
          SizedBox(width: 120.0, child: _label(label)),
          Expanded(child: mono ? _mono(value) : _value(value)),
        ],
      ),
    );
  }

  Widget _label(String text) => Text(
        text,
        style: const TextStyle(
          color: AppTokens.muted,
          fontFamily: AppTokens.fontFamily,
          fontSize: 12.0,
          fontWeight: FontWeight.w600,
        ),
      );

  Widget _value(String text) => Text(
        text,
        style: const TextStyle(
          color: AppTokens.ink,
          fontFamily: AppTokens.fontFamily,
          fontSize: 13.0,
          fontWeight: FontWeight.w800,
        ),
      );

  /// Ids, phones and money are read digit by digit: tabular figures line them up.
  Widget _mono(String text) => Text(
        text,
        style: const TextStyle(
          color: AppTokens.ink,
          fontFamily: AppTokens.fontFamily,
          fontSize: 13.0,
          fontWeight: FontWeight.w600,
          fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
        ),
      );
}
