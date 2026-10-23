// hand-authored — Flutter app-screen (Story 5.3). Mobile twin of the web
// OrdersListScreen: status filter + follow-up + the three REAL port states
// (loading / empty / error), composed from shipped widgets.
//
// A phone is not a spreadsheet: the rows are `list-row` style, not AppTable. The
// LABELS stay byte-identical with web (UX-DR-27) — the frame differs, the
// business surface does not.
//
// SCOPE IS NOT A FILTER. "Xem tất cả đơn" vs "chỉ đơn của mình" is a PERMISSION
// the backend resolves (FR-18, AD-4) — this screen sends no scope parameter and
// offers no "Của tôi / Tất cả" toggle.
//
// The Đơn hàng TAB IS NOT HIDDEN here, by design. The bottom nav is a locked
// 5-tab contract (UX-DR-15) that no caller may filter, so an account holding
// neither order-view key still reaches this screen — and gets the error state
// from the backend's 403. That is correct under AD-4: the backend enforces every
// request; hiding UI is only a convenience.
//
// Follow-up is not a column, a reminder or a job: it is orders still at 'baogia'
// (FR-10), i.e. a derived filter over the same list.
//
// No money math here (AD-10/16) and no totals column.
//
// OrderListCubit sends every query through the injected [OrdersPort] (Story
// 11.3); the screen wires the reload signal and the navigation callbacks to it
// and renders its state.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/gating/app_permissions.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'discount_approval_screen.dart' show kOrdersTabIndex;
import 'order_list_cubit.dart';
import 'order_list_state.dart';

class OrderListScreen extends StatefulWidget {
  const OrderListScreen({
    super.key,
    required this.port,
    required this.perms,
    this.onOpen,
    this.onAdd,
    this.onOpenDiscountApprovals,
    this.reloadSignal,
  });

  final OrdersPort port;

  /// Notified when the list must read again although nothing it opened reported
  /// back: its tab was tapped over screens that wrote, or an order opened from
  /// elsewhere (a confirmed quote) closed.
  final Listenable? reloadSignal;

  /// Effective permission set, passed as a CONSTRUCTOR PROP (the convention this
  /// codebase already uses for screens) rather than read from an InheritedWidget
  /// — one style per screen, never a mix.
  final Set<PermissionKey> perms;

  /// Opens one order; the list reads again once that screen closes (its status
  /// may have moved there).
  final Future<void> Function(String id)? onOpen;

  /// Opens the quote form; given only to an account that may create quotes
  /// (null ⇒ no "+ Tạo đơn" button). The list reads again once the form closes.
  final Future<void> Function()? onAdd;

  /// Opens Duyệt chiết khấu; given only to an account that may approve
  /// discounts (null ⇒ no button). The list reads again on return.
  final Future<void> Function()? onOpenDiscountApprovals;

  @override
  State<OrderListScreen> createState() => _OrderListScreenState();
}

class _OrderListScreenState extends State<OrderListScreen> {
  // Created here rather than by BlocProvider(create:): the reload signal needs the
  // same instance from initState to dispose, and the navigation callbacks reload
  // it after an await.
  late final OrderListCubit _cubit = OrderListCubit(widget.port);

  // Render reads the cubit state; the names are kept because design-system guards pin them.
  String get _filter => _cubit.state.filter;
  List<OrderListItem> get _items => _cubit.state.items;
  int get _page => _cubit.state.page;
  int get _total => _cubit.state.total;
  int get _pageSize => _cubit.state.pageSize;
  OrderListStatus get _state => _cubit.state.status;

  @override
  void initState() {
    super.initState();
    widget.reloadSignal?.addListener(_cubit.load);
    _cubit.load();
  }

  @override
  void didUpdateWidget(OrderListScreen oldWidget) {
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

  /// Runs a navigation that may change orders, then reads the page again — a
  /// screen pushed on top keeps this one alive with its old rows.
  Future<void> _openThenReload(Future<void> Function() open) async {
    await open();
    if (mounted) _cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<OrderListCubit, OrderListState>(
        builder: (BuildContext context, OrderListState _) => _view(),
      ),
    );
  }

  Widget _view() {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'ĐƠN HÀNG', title: 'Đơn hàng'),
        bottomNav: const AppBottomNav(activeIndex: kOrdersTabIndex),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _filters(),
            if (widget.onOpenDiscountApprovals != null) ...[
              const SizedBox(height: AppTokens.space8),
              AppButton(
                variant: AppButtonVariant.ghost,
                label: 'Duyệt chiết khấu',
                wide: true,
                onPressed: () => _openThenReload(widget.onOpenDiscountApprovals!),
              ),
            ],
            if (widget.onAdd != null) ...[
              const SizedBox(height: AppTokens.space8),
              AppButton(
                variant: AppButtonVariant.primary,
                label: '+ Tạo đơn',
                wide: true,
                onPressed: () => _openThenReload(widget.onAdd!),
              ),
            ],
            const SizedBox(height: AppTokens.space16),
            // NOT Expanded: AppMobileShell already hands the body to a
            // SingleChildScrollView, so the height here is unbounded and a flex
            // child has nothing to divide — it throws instead of rendering.
            _body(),
            _pager(),
          ],
        ),
      ),
    );
  }

  /// Segmented filter, COMPOSED from AppButton (no segmented widget ships on
  /// mobile). The option set mirrors the web twin exactly — the two derived
  /// views plus all 10 statuses — and the labels come from [kStatusLabels], so a
  /// chip and its filter button can never drift apart.
  ///
  /// Wrap, not Row: twelve buttons do not fit one phone-width line, and a Row
  /// would overflow rather than reflow.
  Widget _filters() {
    final List<List<String>> options = [
      const [kOrderFilterAll, 'Tất cả'],
      const [kOrderFilterFollowUp, 'Follow-up'],
      for (final StatusKey key in StatusKey.values)
        [key.name, kStatusLabels[key]!],
    ];
    return Wrap(
      spacing: AppTokens.space8,
      runSpacing: AppTokens.space8,
      children: [
        for (final List<String> option in options)
          AppButton(
            variant: _filter == option[0]
                ? AppButtonVariant.primary
                : AppButtonVariant.outline,
            size: AppButtonSize.sm,
            label: option[1],
            onPressed: () => _cubit.setFilter(option[0]),
          ),
      ],
    );
  }

  /// Prev/next pager, byte-identical copy with the web twin. Only exists when
  /// there IS a second page; the buttons disable at the ends via null onPressed.
  Widget _pager() {
    if (_state != OrderListStatus.ready || _items.isEmpty) {
      return const SizedBox.shrink();
    }
    final int totalPages =
        _total <= 0 ? 1 : (_total + _pageSize - 1) ~/ _pageSize;
    if (totalPages <= 1) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppTokens.space16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AppButton(
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.sm,
            label: 'Trước',
            onPressed: _page <= 1 ? null : () => _cubit.goToPage(_page - 1),
          ),
          const SizedBox(width: AppTokens.space8),
          Text(
            'Trang $_page/$totalPages',
            style: const TextStyle(
              color: AppTokens.muted,
              fontFamily: AppTokens.fontFamily,
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(width: AppTokens.space8),
          AppButton(
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.sm,
            label: 'Sau',
            onPressed: _page >= totalPages ? null : () => _cubit.goToPage(_page + 1),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    switch (_state) {
      case OrderListStatus.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            Text(
              'Đang tải danh sách đơn…',
              style: TextStyle(
                color: AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        );
      case OrderListStatus.error:
        return AppErrorState(
          message: 'Không tải được danh sách đơn.',
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case OrderListStatus.ready:
        if (_items.isEmpty) {
          // A filtered view that comes back empty is NOT the same as an empty
          // book: the fix is to change the filter, not to create the first order.
          if (_filter != kOrderFilterAll) {
            return const AppEmptyState(
              title: 'Không có đơn phù hợp',
              message: 'Thử đổi bộ lọc.',
            );
          }
          // An account that may not create quotes is not told to press one.
          return AppEmptyState(
            title: 'Chưa có đơn nào',
            message: widget.onAdd == null ? null : 'Bấm ➕Tạo để bắt đầu.',
            action: widget.onAdd == null
                ? null
                : AppButton(
                    variant: AppButtonVariant.primary,
                    label: '+ Tạo đơn',
                    onPressed: () => _openThenReload(widget.onAdd!),
                  ),
          );
        }
        // The shell owns the scrolling (see build); this list only lays its rows out.
        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _items.length,
          separatorBuilder: (_, __) => const SizedBox(height: AppTokens.space8),
          itemBuilder: (BuildContext context, int i) => _row(_items[i]),
        );
    }
  }

  /// One order row. The web twin renders the same three facts as table columns:
  /// `Khách hàng` · `SĐT` · `Trạng thái`, plus the `Xem` action.
  Widget _row(OrderListItem order) {
    final StatusKey? key = statusKeyOf(order.status.json ?? '');
    return AppCard(
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.customerName,
                  style: const TextStyle(
                    color: AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 14.0,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppTokens.space4),
                // The phone key is data read digit by digit: tabular figures make
                // the digits align, so a mistyped number is visible at a glance.
                Text(
                  order.customerPhone,
                  style: const TextStyle(
                    color: AppTokens.muted,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 12.0,
                    fontWeight: FontWeight.w600,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          if (key != null) AppStatusChip(status: key) else Text(order.status.json ?? '—'),
          const SizedBox(width: AppTokens.space8),
          AppButton(
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.sm,
            label: 'Xem',
            onPressed: () {
              final open = widget.onOpen;
              if (open != null) _openThenReload(() => open(order.id));
            },
          ),
        ],
      ),
    );
  }
}
