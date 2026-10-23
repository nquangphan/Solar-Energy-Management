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
// CustomerListCubit holds the query, the page and the answer (Story 11.2); the
// screen keeps the search controller and renders the cubit's state.
//
// There is NO "Số đơn" column: `Order` does not exist until Story 4.1 (AC-7).

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'customer_list_cubit.dart';
import 'customer_list_state.dart';
import 'customer_pick_screen.dart';

class CustomerListScreen extends StatefulWidget {
  const CustomerListScreen({
    super.key,
    required this.port,
    this.onOpen,
    this.onAdd,
  });

  final CustomersPort port;
  final void Function(String sdt)? onOpen;

  /// Opens the create flow; the list reloads when it completes (a customer may
  /// have been added while this screen sat underneath).
  final Future<void> Function()? onAdd;

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  final TextEditingController _q = TextEditingController();

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _add(CustomerListCubit cubit) async {
    await widget.onAdd!();
    if (mounted) cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => CustomerListCubit(widget.port)..load(),
      child: BlocBuilder<CustomerListCubit, CustomerListState>(builder: _view),
    );
  }

  Widget _view(BuildContext context, CustomerListState state) {
    final CustomerListCubit cubit = context.read<CustomerListCubit>();
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
              onChanged: (_) => cubit.search(_q.text),
            ),
            const SizedBox(height: AppTokens.space8),
            _filters(cubit, state),
            const SizedBox(height: AppTokens.space8),
            AppButton(
              variant: AppButtonVariant.primary,
              label: '+ Thêm khách',
              wide: true,
              onPressed: widget.onAdd == null ? null : () => _add(cubit),
            ),
            const SizedBox(height: AppTokens.space16),
            // NOT Expanded: AppMobileShell already hands the body to a
            // SingleChildScrollView, so the height here is unbounded and a flex child
            // has nothing to divide — it throws instead of rendering.
            _body(cubit, state),
            _pager(cubit, state),
          ],
        ),
      ),
    );
  }

  /// Prev/next pager, byte-identical copy with the web twin. Only exists when there
  /// IS a second page; the buttons disable at the ends by passing a null onPressed.
  Widget _pager(CustomerListCubit cubit, CustomerListState state) {
    if (state.status != CustomerListStatus.ready || state.items.isEmpty) return const SizedBox.shrink();
    final int page = state.page;
    final int totalPages = state.total <= 0 ? 1 : (state.total + state.pageSize - 1) ~/ state.pageSize;
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
            onPressed: page <= 1 ? null : () => cubit.goToPage(page - 1),
          ),
          const SizedBox(width: AppTokens.space8),
          Text(
            'Trang $page/$totalPages',
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
            onPressed: page >= totalPages ? null : () => cubit.goToPage(page + 1),
          ),
        ],
      ),
    );
  }

  /// Segmented filter, COMPOSED from AppButton (no segmented widget ships on mobile).
  Widget _filters(CustomerListCubit cubit, CustomerListState state) {
    const List<List<String>> options = [
      [kAllCustTypes, 'Tất cả'],
      [kCaNhan, 'Cá nhân'],
      [kThuongMai, 'Thương mại'],
    ];
    return Row(
      children: [
        for (final List<String> option in options) ...[
          Expanded(
            child: AppButton(
              variant: state.custType == option[0]
                  ? AppButtonVariant.primary
                  : AppButtonVariant.outline,
              label: option[1],
              onPressed: () => cubit.setCustType(option[0]),
            ),
          ),
          if (option[0] != kThuongMai) const SizedBox(width: AppTokens.space8),
        ],
      ],
    );
  }

  Widget _body(CustomerListCubit cubit, CustomerListState state) {
    switch (state.status) {
      case CustomerListStatus.loading:
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
      case CustomerListStatus.error:
        return AppErrorState(
          message: 'Không tải được danh sách khách hàng.',
          retryLabel: 'Thử lại',
          onRetry: cubit.load,
        );
      case CustomerListStatus.ready:
        if (state.items.isEmpty) {
          // A filtered view that comes back empty is NOT the same as an empty book:
          // the fix is to change the search, not to add the first customer.
          if (state.searching) {
            return const AppEmptyState(
              title: 'Không có khách phù hợp',
              message: 'Thử đổi từ khoá hoặc bỏ bớt bộ lọc.',
            );
          }
          return AppEmptyState(
            title: 'Chưa có khách hàng nào',
            message: 'Thêm khách đầu tiên để bắt đầu tạo báo giá.',
            action: AppButton(
              variant: AppButtonVariant.primary,
              label: '+ Thêm khách',
              onPressed: widget.onAdd == null ? null : () => _add(cubit),
            ),
          );
        }
        // The shell owns the scrolling (see build); this list only lays its rows out.
        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: state.items.length,
          separatorBuilder: (_, __) => const SizedBox(height: AppTokens.space8),
          itemBuilder: (BuildContext context, int i) => _row(state.items[i]),
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
                  customer.phone,
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
            onPressed: () => widget.onOpen?.call(customer.phone),
          ),
        ],
      ),
    );
  }
}
