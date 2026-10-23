// hand-authored — Flutter app-screen (Story 4.7). Mobile twin of the web
// DiscountApprovalScreen: duyệt chiết khấu — danh sách đơn chờ duyệt → chọn
// item → chi tiết với biên ước tính per-line → Đồng ý / Từ chối (kèm lý do)
// qua OrdersPort, composed from shipped widgets (AppFrame/AppTable/AppField/
// AppButton/AppStatusChip/AppEmptyState/AppErrorState/AppSkeleton) + tokens
// (AD-13).
//
// THE CLIENT DOES NO MONEY MATH (AD-10/16). Giá gốc / Chiết khấu / Sau chiết
// khấu / Biên ước tính đều là CON SỐ PORT TRẢ — backend tính, màn hiển thị
// nguyên văn ("X%" hoặc "—" khi null; null = dòng tự do, giá 0, hoặc người xem
// thiếu costs.view — FR-37).
//
// A network failure NEVER wipes the list or the selection: the error path only
// sets a banner — it never resets state (bất biến k).
//
// DiscountApprovalCubit sends the list and the decision through the injected
// [OrdersPort] (Story 11.3); the screen keeps the reason field and renders the
// cubit's state.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'discount_approval_cubit.dart';
import 'discount_approval_state.dart';

/// Index of the bottom-nav `Đơn hàng` tab — duyệt chiết khấu là việc của đơn.
const int kOrdersTabIndex = 1;

class DiscountApprovalScreen extends StatefulWidget {
  const DiscountApprovalScreen({super.key, required this.ordersPort});

  final OrdersPort ordersPort;

  @override
  State<DiscountApprovalScreen> createState() => _DiscountApprovalScreenState();
}

class _DiscountApprovalScreenState extends State<DiscountApprovalScreen> {
  /// Lý do duyệt/từ chối — BẮT BUỘC khi từ chối, chặn client-side (không gọi port).
  final TextEditingController _reasonCtl = TextEditingController();

  // Created here rather than by BlocProvider(create:): the dialogs call it after
  // an await, from a route outside this screen's provider.
  late final DiscountApprovalCubit _cubit = DiscountApprovalCubit(widget.ordersPort);

  // Render reads the cubit state; the names are kept because design-system guards pin them.
  List<DiscountPendingItem> get _items => _cubit.state.items;
  DiscountApprovalStatus get _state => _cubit.state.status;
  DiscountPendingItem? get _selected => _cubit.state.selected;
  String? get _error => _cubit.state.error;
  String? get _reasonError => _cubit.state.reasonError;
  bool get _resolveBusy => _cubit.state.resolveBusy;

  @override
  void initState() {
    super.initState();
    _cubit.load();
  }

  @override
  void dispose() {
    _reasonCtl.dispose();
    _cubit.close();
    super.dispose();
  }

  /// Approve/reject decision (FR-18): the cubit sends it, drops the selection and
  /// reloads the list. No toast — the item leaving the list is the signal. A
  /// failure only sets the banner; the list, the selection and the typed reason stay.
  Future<void> _decide(bool approve) async {
    if (await _cubit.resolve(approve, _reasonCtl.text) && mounted) _reasonCtl.clear();
  }

  /// Dialog hệ quả Đồng ý (UX-DR-20) — Huỷ (nút, X, barrier, back) = đóng,
  /// KHÔNG gọi port.
  Future<void> _openApproveDialog() async {
    await showAppDialog<void>(
      context: context,
      child: AppConfirmDialog(
        title: 'Đồng ý chiết khấu',
        consequence:
            'Đồng ý chiết khấu cho phép chốt đơn với giá đã giảm; thao tác được ghi Audit log.',
        confirmTone: AppButtonVariant.primary,
        onConfirm: () => _decide(true),
      ),
    );
  }

  /// Từ chối thiếu lý do bị chặn TẠI CHỖ — fieldError hiển thị, KHÔNG gọi port;
  /// có lý do mới mở dialog hệ quả (tone danger — default của AppConfirmDialog).
  Future<void> _openRejectDialog() async {
    if (_reasonCtl.text.trim().isEmpty) {
      _cubit.requireReason();
      return;
    }
    _cubit.clearReasonError();
    await showAppDialog<void>(
      context: context,
      child: AppConfirmDialog(
        title: 'Từ chối',
        consequence:
            'Từ chối sẽ trả đơn về Báo giá; lý do từ chối được ghi Audit log.',
        onConfirm: () => _decide(false),
      ),
    );
  }

  static const TextStyle _strong = TextStyle(
    color: AppTokens.ink,
    fontFamily: AppTokens.fontFamily,
    fontSize: 12.5,
    fontWeight: FontWeight.w800,
  );

  static const TextStyle _microMuted = TextStyle(
    color: AppTokens.muted,
    fontFamily: AppTokens.fontFamily,
    fontSize: 10.0,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle _mono = TextStyle(
    color: AppTokens.ink,
    fontFamily: AppTokens.fontFamily,
    fontSize: 12.5,
    fontWeight: FontWeight.w400,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<DiscountApprovalCubit, DiscountApprovalState>(
        builder: (BuildContext context, DiscountApprovalState _) => _page(),
      ),
    );
  }

  Widget _page() {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'ĐƠN HÀNG', title: 'Duyệt chiết khấu'),
        bottomNav: const AppBottomNav(activeIndex: kOrdersTabIndex),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              AppBanner(tone: AppBannerTone.danger, message: _error!),
              const SizedBox(height: AppTokens.space8),
            ],
            if (_state == DiscountApprovalStatus.loading) ...[
              const AppSkeleton(),
              const SizedBox(height: AppTokens.space8),
              const AppSkeleton(),
              const SizedBox(height: AppTokens.space8),
              const AppSkeleton(),
            ],
            if (_state == DiscountApprovalStatus.error)
              AppErrorState(
                message: 'Không tải được danh sách chờ duyệt.',
                onRetry: _cubit.load,
              ),
            if (_state == DiscountApprovalStatus.ready && _items.isEmpty)
              const AppEmptyState(
                icon: 'ic-orders',
                title: 'Không có chiết khấu nào đang chờ duyệt.',
              ),
            if (_state == DiscountApprovalStatus.ready && _items.isNotEmpty)
              AppFrame(
                label: 'Chờ duyệt chiết khấu',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: _items
                      .map(
                        (DiscountPendingItem item) => GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            _cubit.select(item);
                            _reasonCtl.clear();
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                vertical: AppTokens.space8),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(item.orderId, style: _strong),
                                      Text(item.customerPhone,
                                          style: _microMuted),
                                      Text(item.requestedByDisplayName,
                                          style: _microMuted),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: AppTokens.space8),
                                // Amount stacked above the chip so the full
                                // "1.000.000 đ" fits a phone row (never clipped).
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    MoneyText(item.amount.toInt(), style: _mono),
                                    const SizedBox(height: AppTokens.space4),
                                    // Chip enum key `choduyet` — label canonical
                                    // "Chờ duyệt", KHÔNG override ad-hoc.
                                    const AppStatusChip(
                                        status: StatusKey.choduyet),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            if (_selected != null) ...[
              const SizedBox(height: AppTokens.space12),
              _detail(_selected!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detail(DiscountPendingItem selected) {
    return AppFrame(
      label: 'Chi tiết ${selected.orderId}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 3 con số backend (AD-16) — màn hiển thị qua formatVnd, canh phải.
          _SummaryRow(label: 'Giá gốc', value: formatVnd(selected.subtotal.toInt())),
          _SummaryRow(label: 'Chiết khấu', value: formatVnd(selected.amount.toInt())),
          _SummaryRow(
            label: 'Sau chiết khấu',
            value: formatVnd(selected.afterDiscount.toInt()),
            strong: true,
          ),
          const SizedBox(height: AppTokens.space8),
          AppTable(
            columns: const [
              AppTableColumn('Món', flex: 3),
              AppTableColumn('SL', numeric: true),
              AppTableColumn('Đơn giá', numeric: true, flex: 2),
              AppTableColumn('Biên ước tính', numeric: true, flex: 2),
            ],
            rows: selected.lines
                .asMap()
                .entries
                .map(
                  (MapEntry<int, DiscountPendingLine> entry) => AppTableRow(
                    <Widget>[
                      AppTableCellText(entry.value.name),
                      AppTableCellText('${entry.value.qty}'),
                      AppTableCellText(formatVnd(entry.value.unitPrice.toInt())),
                      // Biên là SỐ PORT TRẢ (integer %) — null = "—" (FR-37).
                      AppTableCellText(
                        entry.value.estimatedMarginPct == null
                            ? '—'
                            : '${entry.value.estimatedMarginPct}%',
                      ),
                    ],
                    zebra: entry.key.isOdd,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: AppTokens.space8),
          const Text(
            'Ước tính theo giá vốn hiện tại — chưa xuất kho.',
            style: _microMuted,
          ),
          if (selected.requestNote != null) ...[
            const SizedBox(height: AppTokens.space8),
            const Text('Lý do đề xuất', style: _microMuted),
            Text(selected.requestNote!, style: _strong),
          ],
          const SizedBox(height: AppTokens.space12),
          AppField(
            label: 'Lý do duyệt / từ chối (bắt buộc khi từ chối)',
            controller: _reasonCtl,
          ),
          if (_reasonError != null) ...[
            const SizedBox(height: AppTokens.space8),
            AppBanner(tone: AppBannerTone.danger, message: _reasonError!),
          ],
          const SizedBox(height: AppTokens.space12),
          // Wrap thay Row: khung điện thoại hẹp — 2 nút xuống dòng thay vì
          // tràn ngang (overflow là lỗi render thật mà widget test bắt được).
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8.0,
            runSpacing: 8.0,
            children: [
              AppButton(
                label: 'Từ chối',
                variant: AppButtonVariant.danger,
                onPressed: _resolveBusy ? null : _openRejectDialog,
              ),
              AppButton(
                label: 'Đồng ý chiết khấu',
                variant: AppButtonVariant.primary,
                onPressed: _resolveBusy ? null : _openApproveDialog,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// One summary row — the value is a backend number, rendered verbatim.
class _SummaryRow extends StatelessWidget {
  const _SummaryRow(
      {required this.label, required this.value, this.strong = false});

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.0),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 12.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: AppTokens.ink,
              fontFamily: AppTokens.fontFamily,
              fontSize: 12.5,
              fontWeight: strong ? FontWeight.w800 : FontWeight.w400,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
