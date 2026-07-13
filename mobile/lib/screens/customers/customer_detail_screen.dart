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
// There is NO order history and NO "+ Tạo đơn mới": `Order` lands in Story 4.1,
// and a screen may not show a number no table can back (AC-7).

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'customer_pick_screen.dart';

enum _LoadState { loading, ready, error }

class CustomerDetailScreen extends StatefulWidget {
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
  State<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends State<CustomerDetailScreen> {
  Customer? _customer;
  List<CustomerSource> _sources = const [];
  _LoadState _state = _LoadState.loading;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _state = _LoadState.loading);
    try {
      final Customer found = await widget.port.get(widget.sdt);
      final List<CustomerSource> catalogue = await widget.port.listSources();
      if (!mounted) return;
      setState(() {
        _customer = found;
        _sources = catalogue;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _state = _LoadState.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Customer? customer = _customer;
    final String eyebrow = customer?.custType == kThuongMai
        ? 'KHÁCH · THƯƠNG MẠI'
        : 'KHÁCH · CÁ NHÂN';

    final Widget body;
    switch (_state) {
      case _LoadState.loading:
        body = const Center(child: AppSkeleton(width: 200.0));
      case _LoadState.error:
        body = AppErrorState(
          message: 'Không tải được danh sách khách hàng.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
        body = SingleChildScrollView(
          child: AppFrame(
            label: 'Thông tin khách',
            child: AppCard(
              padding: const EdgeInsets.all(AppTokens.space16),
              child: CustomerFacts(customer: customer!, sources: _sources),
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
          onAction: () => widget.onEdit?.call(widget.sdt),
        ),
        bottomNav: const AppBottomNav(activeIndex: kMenuTabIndex),
        body: body,
      ),
    );
  }
}
