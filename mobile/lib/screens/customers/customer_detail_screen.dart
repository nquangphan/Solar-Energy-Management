// hand-authored — Flutter app-screen (Story 3.4). Mobile twin of the web
// CustomerDetailScreen: the fact list of ONE customer, rendering exactly the
// fields that customer's type actually has.
//
// A Cá nhân has no MST and no bank account; a Thương mại has no CCCD. Rendering
// the other type's rows — even blank — tells the user a field exists for them
// when the backend would reject it outright (400, "field lạc loại khách"). A
// nullable field that IS theirs but empty renders `—`: the row stays, because
// "this customer has no address" is information; hiding the row is not.
//
// CustomerDetailCubit reads the customer and the source catalogue through the
// injected [CustomersPort] (Story 11.2); the screen renders its state.
//
// There is NO order history and NO "+ Tạo đơn mới": `Order` lands in Story 4.1,
// and a screen may not show a number no table can back (AC-7).

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'customer_detail_cubit.dart';
import 'customer_detail_state.dart';
import 'customer_pick_screen.dart';

class CustomerDetailScreen extends StatelessWidget {
  const CustomerDetailScreen({
    super.key,
    required this.port,
    required this.sdt,
    this.onEdit,
  });

  final CustomersPort port;

  /// RAW or E.164 — the backend normalises before it reads (AD-9).
  final String sdt;
  final void Function(String sdt)? onEdit;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => CustomerDetailCubit(port, sdt)..load(),
      child: BlocBuilder<CustomerDetailCubit, CustomerDetailState>(builder: _page),
    );
  }

  Widget _page(BuildContext context, CustomerDetailState state) {
    final Customer? customer = state.customer;
    final String eyebrow = customer?.custType == kThuongMai
        ? 'KHÁCH · THƯƠNG MẠI'
        : 'KHÁCH · CÁ NHÂN';

    final Widget body;
    switch (state.status) {
      case CustomerDetailStatus.loading:
        body = const Center(child: AppSkeleton(width: 200.0));
      case CustomerDetailStatus.error:
        body = AppErrorState(
          message: 'Không tải được danh sách khách hàng.',
          retryLabel: 'Thử lại',
          onRetry: context.read<CustomerDetailCubit>().load,
        );
      case CustomerDetailStatus.ready:
        body = SingleChildScrollView(
          child: AppFrame(
            label: 'Thông tin khách',
            child: AppCard(
              padding: const EdgeInsets.all(AppTokens.space16),
              child: CustomerFacts(customer: customer!, sources: state.sources),
            ),
          ),
        );
    }

    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: AppTopbar(
          eyebrow: eyebrow,
          title: customer?.name ?? '',
          action: const Text(
            'Sửa',
            style: TextStyle(
              color: AppTokens.teal,
              fontFamily: AppTokens.fontFamily,
              fontSize: 12.0,
              fontWeight: FontWeight.w800,
            ),
          ),
          onAction: () => onEdit?.call(sdt),
        ),
        bottomNav: const AppBottomNav(activeIndex: kMenuTabIndex),
        body: body,
      ),
    );
  }
}
