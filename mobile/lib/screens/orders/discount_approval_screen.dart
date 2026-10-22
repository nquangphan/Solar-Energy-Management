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

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';

/// Index of the bottom-nav `Đơn hàng` tab — duyệt chiết khấu là việc của đơn.
const int kOrdersTabIndex = 1;

class DiscountApprovalScreen extends StatefulWidget {
  const DiscountApprovalScreen({super.key, required this.ordersPort});

  final OrdersPort ordersPort;

  @override
  State<DiscountApprovalScreen> createState() => _DiscountApprovalScreenState();
}

enum _LoadState { loading, ready, error }

class _DiscountApprovalScreenState extends State<DiscountApprovalScreen> {
  List<DiscountPendingItem> _items = const <DiscountPendingItem>[];
  _LoadState _state = _LoadState.loading;

  /// Item đang xem chi tiết — null = chưa chọn (chỉ thấy danh sách).
  DiscountPendingItem? _selected;
  String? _error;

  /// Lý do duyệt/từ chối — BẮT BUỘC khi từ chối, chặn client-side (không gọi port).
  final TextEditingController _reasonCtl = TextEditingController();
  String? _reasonError;
  bool _resolveBusy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reasonCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _state = _LoadState.loading);
    try {
      final List<DiscountPendingItem> fresh =
          await widget.ordersPort.listPendingDiscounts();
      if (!mounted) return;
      setState(() {
        _items = fresh;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _state = _LoadState.error);
    }
  }

  /// Quyết định duyệt/từ chối (FR-18): port gọi backend — backend đổi status,
  /// ghi hồ sơ, publish event; màn chỉ reload danh sách + bỏ chọn. KHÔNG toast
  /// — item biến khỏi danh sách là tín hiệu. Lỗi → banner + danh sách + lựa
  /// chọn NGUYÊN VẸN (bất biến k).
  Future<void> _resolve(bool approve) async {
    final DiscountPendingItem? selected = _selected;
    if (selected == null) return;
    setState(() => _resolveBusy = true);
    try {
      await widget.ordersPort.resolveDiscount(
        selected.orderId,
        ResolveDiscountInput(
          approve: approve,
          reason: _reasonCtl.text.isNotEmpty ? _reasonCtl.text : null,
        ),
      );
      if (!mounted) return;
      setState(() {
        _selected = null;
        _reasonError = null;
        _error = null;
      });
      _reasonCtl.clear();
      await _load();
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err is OrderPortException
            ? err.message
            : 'Không thực hiện được. Thử lại.';
      });
    } finally {
      if (mounted) setState(() => _resolveBusy = false);
    }
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
        onConfirm: () => _resolve(true),
      ),
    );
  }

  /// Từ chối thiếu lý do bị chặn TẠI CHỖ — fieldError hiển thị, KHÔNG gọi port;
  /// có lý do mới mở dialog hệ quả (tone danger — default của AppConfirmDialog).
  Future<void> _openRejectDialog() async {
    if (_reasonCtl.text.trim().isEmpty) {
      setState(() {
        _reasonError = 'Lý do là bắt buộc khi từ chối chiết khấu.';
      });
      return;
    }
    setState(() => _reasonError = null);
    await showAppDialog<void>(
      context: context,
      child: AppConfirmDialog(
        title: 'Từ chối',
        consequence:
            'Từ chối sẽ trả đơn về Báo giá; lý do từ chối được ghi Audit log.',
        onConfirm: () => _resolve(false),
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
            if (_state == _LoadState.loading) ...[
              const AppSkeleton(),
              const SizedBox(height: AppTokens.space8),
              const AppSkeleton(),
              const SizedBox(height: AppTokens.space8),
              const AppSkeleton(),
            ],
            if (_state == _LoadState.error)
              AppErrorState(
                message: 'Không tải được danh sách chờ duyệt.',
                onRetry: _load,
              ),
            if (_state == _LoadState.ready && _items.isEmpty)
              const AppEmptyState(
                icon: 'ic-orders',
                title: 'Không có chiết khấu nào đang chờ duyệt.',
              ),
            if (_state == _LoadState.ready && _items.isNotEmpty)
              AppFrame(
                label: 'Chờ duyệt chiết khấu',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: _items
                      .map(
                        (DiscountPendingItem item) => GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => setState(() {
                            _selected = item;
                            _reasonError = null;
                            _reasonCtl.clear();
                          }),
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
