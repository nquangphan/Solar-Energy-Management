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

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/gating/app_permissions.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'discount_approval_screen.dart' show kOrdersTabIndex;

const String _kAll = 'ALL';
const String _kFollowUp = 'FOLLOW_UP';

enum _LoadState { loading, ready, error }

class OrderListScreen extends StatefulWidget {
  const OrderListScreen({
    super.key,
    required this.port,
    required this.perms,
    this.onOpen,
    this.onAdd,
  });

  final OrdersPort port;

  /// Effective permission set, passed as a CONSTRUCTOR PROP (the convention this
  /// codebase already uses for screens) rather than read from an InheritedWidget
  /// — one style per screen, never a mix.
  final Set<PermissionKey> perms;

  final void Function(String id)? onOpen;
  final VoidCallback? onAdd;

  @override
  State<OrderListScreen> createState() => _OrderListScreenState();
}

class _OrderListScreenState extends State<OrderListScreen> {
  String _filter = _kAll;
  List<OrderListItem> _items = const [];
  // The backend owns the count and the slicing (AD-1): the screen holds only the
  // page it asked for and the total it was told, and never counts rows itself.
  int _page = 1;
  int _total = 0;
  int _pageSize = 20;
  _LoadState _state = _LoadState.loading;

  /// Answers do not necessarily come back in the order they were asked. Without
  /// this ticket, a slow reply to an earlier filter can land AFTER the reply to
  /// the current one and repaint the list with rows the user already moved past
  /// — they would simply be wrong, silently.
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
      // `followUp` and `status` are mutually exclusive — the filter row picks
      // exactly one of the three shapes, so the two never travel together.
      final OrderPage page = await widget.port.list(
        followUp: _filter == _kFollowUp ? true : null,
        status: (_filter == _kAll || _filter == _kFollowUp) ? null : _filter,
        page: _page,
      );
      if (!mounted || ticket != _latest) return;
      setState(() {
        _items = page.items;
        _total = page.total;
        _pageSize = page.pageSize;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted || ticket != _latest) return;
      setState(() => _state = _LoadState.error);
    }
  }

  /// Any filter change invalidates the page number — page 3 of the old result set
  /// is meaningless against the new one, so every change returns to page 1.
  void _reloadFromFirstPage() {
    _page = 1;
    _load();
  }

  void _goToPage(int p) {
    _page = p;
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'ĐƠN HÀNG', title: 'Đơn hàng'),
        bottomNav: const AppBottomNav(activeIndex: kOrdersTabIndex),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _filters(),
            const SizedBox(height: AppTokens.space8),
            AppButton(
              variant: AppButtonVariant.primary,
              label: '+ Tạo đơn',
              wide: true,
              onPressed: widget.onAdd,
            ),
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
      const [_kAll, 'Tất cả'],
      const [_kFollowUp, 'Follow-up'],
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
            onPressed: () {
              setState(() => _filter = option[0]);
              _reloadFromFirstPage();
            },
          ),
      ],
    );
  }

  /// Prev/next pager, byte-identical copy with the web twin. Only exists when
  /// there IS a second page; the buttons disable at the ends via null onPressed.
  Widget _pager() {
    if (_state != _LoadState.ready || _items.isEmpty) {
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
            onPressed: _page <= 1 ? null : () => _goToPage(_page - 1),
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
            onPressed: _page >= totalPages ? null : () => _goToPage(_page + 1),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    switch (_state) {
      case _LoadState.loading:
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
      case _LoadState.error:
        return AppErrorState(
          message: 'Không tải được danh sách đơn.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        if (_items.isEmpty) {
          // A filtered view that comes back empty is NOT the same as an empty
          // book: the fix is to change the filter, not to create the first order.
          if (_filter != _kAll) {
            return const AppEmptyState(
              title: 'Không có đơn phù hợp',
              message: 'Thử đổi bộ lọc.',
            );
          }
          return AppEmptyState(
            title: 'Chưa có đơn nào',
            message: 'Bấm ➕Tạo để bắt đầu.',
            action: AppButton(
              variant: AppButtonVariant.primary,
              label: '+ Tạo đơn',
              onPressed: widget.onAdd,
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
    final StatusKey? key = statusKeyOf(order.status);
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
                  order.customerSdt,
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
          if (key != null) AppStatusChip(status: key) else Text(order.status),
          const SizedBox(width: AppTokens.space8),
          AppButton(
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.sm,
            label: 'Xem',
            onPressed: () => widget.onOpen?.call(order.id),
          ),
        ],
      ),
    );
  }
}
