// hand-authored — Flutter app-screen (Story 3.4). Mobile twin of the web
// CustomerListScreen: search + type filter + the three REAL port states
// (loading / empty / error), composed from shipped widgets.
//
// A phone is not a spreadsheet: the rows are `list-row` style, not AppTable. The
// LABELS stay byte-identical with web (UX-DR-27) — the frame differs, the
// business surface does not.
//
// The mockup omits the Cá nhân/Thương mại filter on mobile. It is here anyway:
// UX-DR-27 asks for the same business surface on both platforms, and a mockup is
// a drawing, not a contract.
//
// Search is submitted to the BACKEND (AD-1/AD-2): the client does not filter,
// sort, count or paginate in memory, and it never inspects the phone string the
// user typed.
//
// There is NO "Số đơn" column: `Order` does not exist until Story 4.1 (AC-7).

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'customer_pick_screen.dart';

const String _kAll = 'ALL';

enum _LoadState { loading, ready, error }

class CustomerListScreen extends StatefulWidget {
  const CustomerListScreen({
    super.key,
    required this.port,
    this.onOpen,
    this.onAdd,
  });

  final CustomersPort port;
  final void Function(String sdt)? onOpen;
  final VoidCallback? onAdd;

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  final TextEditingController _q = TextEditingController();

  String _custType = _kAll;
  List<Customer> _items = const [];
  _LoadState _state = _LoadState.loading;

  /// Every keystroke starts a query, and the answers do not necessarily come back in
  /// the order they were asked. Without this ticket, a slow reply to `090` can land
  /// AFTER the reply to `0903` and repaint the list with results for a query the user
  /// has already moved past — the rows would simply be wrong, silently.
  int _latest = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final int ticket = ++_latest;
    setState(() => _state = _LoadState.loading);
    try {
      // The query goes to the backend untouched — `0903` is matched there against the
      // E.164 key, which is a thing only the backend knows how to do (AD-9).
      final CustomerPage page = await widget.port.list(
        q: _q.text.isEmpty ? null : _q.text,
        custType: _custType == _kAll ? null : _custType,
      );
      if (!mounted || ticket != _latest) return;
      setState(() {
        _items = page.items;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted || ticket != _latest) return;
      setState(() => _state = _LoadState.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'KHÁCH HÀNG', title: 'Khách hàng'),
        bottomNav: const AppBottomNav(activeIndex: kMenuTabIndex),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppField(
              controller: _q,
              size: AppFieldSize.large,
              placeholder: 'Tìm theo SĐT hoặc tên khách…',
              onChanged: (_) => _load(),
            ),
            const SizedBox(height: AppTokens.space8),
            _filters(),
            const SizedBox(height: AppTokens.space8),
            AppButton(
              variant: AppButtonVariant.primary,
              label: '+ Thêm khách',
              wide: true,
              onPressed: widget.onAdd,
            ),
            const SizedBox(height: AppTokens.space16),
            // NOT Expanded: AppMobileShell already hands the body to a
            // SingleChildScrollView, so the height here is unbounded and a flex child
            // has nothing to divide — it throws instead of rendering.
            _body(),
          ],
        ),
      ),
    );
  }

  /// Segmented filter, COMPOSED from AppButton (no segmented widget ships on mobile).
  Widget _filters() {
    const List<List<String>> options = [
      [_kAll, 'Tất cả'],
      [kCaNhan, 'Cá nhân'],
      [kThuongMai, 'Thương mại'],
    ];
    return Row(
      children: [
        for (final List<String> option in options) ...[
          Expanded(
            child: AppButton(
              variant: _custType == option[0]
                  ? AppButtonVariant.primary
                  : AppButtonVariant.outline,
              label: option[1],
              onPressed: () {
                setState(() => _custType = option[0]);
                _load();
              },
            ),
          ),
          if (option[0] != kThuongMai) const SizedBox(width: AppTokens.space8),
        ],
      ],
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
            Text(
              'Đang tải danh sách khách hàng…',
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
          message: 'Không tải được danh sách khách hàng.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        if (_items.isEmpty) {
          return AppEmptyState(
            title: 'Chưa có khách hàng nào',
            message: 'Thêm khách đầu tiên để bắt đầu tạo báo giá.',
            action: AppButton(
              variant: AppButtonVariant.primary,
              label: '+ Thêm khách',
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

  /// One customer row. The web twin renders the same three facts as table columns:
  /// `Tên khách` · `SĐT` · `Loại khách`, plus the `Xem` action.
  Widget _row(Customer customer) {
    return AppCard(
      padding: const EdgeInsets.all(AppTokens.space12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customer.name,
                  style: const TextStyle(
                    color: AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 14.0,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppTokens.space4),
                // The phone key is data read digit by digit. No mono token ships in
                // AppTokens, and `tabular-nums` is what actually matters here: the
                // digits align, so a mistyped number is visible at a glance.
                Text(
                  customer.sdt,
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
          AppCustomerTypeChip(label: customerTypeLabel(customer.custType)),
          const SizedBox(width: AppTokens.space8),
          AppButton(
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.sm,
            label: 'Xem',
            onPressed: () => widget.onOpen?.call(customer.sdt),
          ),
        ],
      ),
    );
  }
}
