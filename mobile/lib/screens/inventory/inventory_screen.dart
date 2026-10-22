// hand-authored — Flutter app-screen (Story 6.2, mobile twin of web
// web/src/screens/inventory/InventoryScreen.tsx). Tồn kho: per product, Tồn
// thật (`onHand`), Đã hứa (`reserved`) and Khả dụng — plus the purchase list of
// everything promised beyond stock.
//
// EVERY NUMBER ARRIVES COMPUTED (AD-2). Khả dụng, Cần nhập, the status and the
// purchase list all come from the backend's single `tinhTonKho`. The screen
// joins them into sentences and branches on `tinhTrang` — it never subtracts,
// never compares a number against zero, never builds the purchase list itself.
//
// A negative Khả dụng is never shown bare: it reads "Cần nhập N".
//
// Stock moves only through vouchers (Phiếu kho screen). The optional
// `onOpenVouchers` callback is the way there — shown only when [perms] holds
// `inventory.manage`; the backend enforces it anyway.
//
// LABELS are byte-identical with the web twin (UX-DR-27).

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/gating/app_permission_keys.g.dart';
import '../../design_system/gating/app_permissions.dart';
import '../../design_system/session/inventory_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';

/// Index of the `Kho` tab in the LOCKED 5-tab bottom nav (UX-DR-15).
const int kInventoryTabIndex = 3;

enum _LoadState { loading, ready, error }

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({
    super.key,
    required this.port,
    this.onOpenVouchers,
    this.perms = const <PermissionKey>{},
    this.reloadSignal,
  });

  final InventoryPort port;

  /// Notified when the stock must read again although Phiếu kho did not report
  /// back: the Kho tab was tapped over it.
  final Listenable? reloadSignal;

  /// Opens the Phiếu kho screen; null ⇒ no entry point. Its future completes when
  /// that screen closes, and the stock is read again — a voucher moves `onHand`.
  final Future<void> Function()? onOpenVouchers;

  /// Effective permission set (mobile has no permissions context yet, so the
  /// host injects it). Default `{}` = the Phiếu kho entry hidden — fail-closed.
  final Set<PermissionKey> perms;

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  _LoadState _state = _LoadState.loading;
  StockList? _data;

  @override
  void initState() {
    super.initState();
    widget.reloadSignal?.addListener(_tai);
    _tai();
  }

  @override
  void didUpdateWidget(InventoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reloadSignal != widget.reloadSignal) {
      oldWidget.reloadSignal?.removeListener(_tai);
      widget.reloadSignal?.addListener(_tai);
    }
  }

  @override
  void dispose() {
    widget.reloadSignal?.removeListener(_tai);
    super.dispose();
  }

  Future<void> _openVouchers() async {
    await widget.onOpenVouchers!();
    if (mounted) _tai();
  }

  Future<void> _tai() async {
    setState(() => _state = _LoadState.loading);
    try {
      final StockList kq = await widget.port.listStock();
      if (!mounted) return;
      setState(() {
        _data = kq;
        _state = _LoadState.ready;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _state = _LoadState.error);
    }
  }

  /// TWIN of `nhanTinhTrang()` in the web screen.
  Widget _chipTinhTrang(StockItemView item) {
    late final String label;
    late final Color mau;
    switch (item.stockStatus.json) {
      case 'am':
        label = 'Âm';
        mau = AppTokens.danger;
      case 'het':
        label = 'Hết khả dụng';
        mau = AppTokens.warn;
      case 'du':
        label = 'Đủ';
        mau = AppTokens.ok;
      default:
        // A status this build does not know yet: neutral, never "Đủ".
        label = '—';
        mau = AppTokens.muted;
    }
    return AppChip(
      label: label,
      background: AppTokens.surface,
      foreground: mau,
      border: mau,
    );
  }

  /// The card border follows the status the backend sent — never the numbers.
  AppCardVariant _vien(StockItemView item) {
    switch (item.stockStatus.json) {
      case 'am':
        return AppCardVariant.danger;
      case 'het':
        return AppCardVariant.warn;
      default:
        return AppCardVariant.line;
    }
  }

  /// TWIN of `tomTat()` in the web screen — byte-identical wording.
  String _tomTat(StockItemView item) {
    final String dau = 'Còn ${item.onHand} · Đã hứa ${item.reserved}';
    if (item.stockStatus.json == 'am') {
      return '$dau · Cần nhập ${item.toPurchase} ${item.unit}';
    }
    return '$dau · Khả dụng ${item.available} ${item.unit}';
  }

  Widget _theSanPham(StockItemView item) {
    final bool am = item.stockStatus.json == 'am';
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.space8),
      child: AppCard(
        variant: _vien(item),
        padding: const EdgeInsets.all(AppTokens.space12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Text(
                    item.name,
                    style: const TextStyle(
                      color: AppTokens.ink,
                      fontFamily: AppTokens.fontFamily,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: AppTokens.space8),
                Text(
                  am ? 'Cần nhập ${item.toPurchase}' : '${item.available}',
                  style: TextStyle(
                    color: am ? AppTokens.danger : AppTokens.ink,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppTokens.space6),
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    _tomTat(item),
                    style: const TextStyle(
                      color: AppTokens.muted,
                      fontFamily: AppTokens.fontFamily,
                      fontSize: AppTokens.microFontSize,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: AppTokens.space8),
                _chipTinhTrang(item),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _danhSachCanMua(List<PurchaseNeedView> canMua) {
    return Padding(
      padding: const EdgeInsets.only(top: AppTokens.space12),
      child: AppFrame(
        label: 'Danh sách cần mua · gộp mọi khả dụng âm',
        child: AppTable(
          columns: const <AppTableColumn>[
            AppTableColumn('Sản phẩm', flex: 3),
            AppTableColumn('Cần nhập', numeric: true, flex: 2),
          ],
          rows: <AppTableRow>[
            for (final PurchaseNeedView c in canMua)
              AppTableRow(<Widget>[
                AppTableCellText(c.name, strong: true),
                AppTableCellText('${c.toPurchase} ${c.unit}', strong: true),
              ]),
          ],
        ),
      ),
    );
  }

  Widget _than() {
    final StockList? data = _data;
    switch (_state) {
      case _LoadState.loading:
        return const Column(
          children: <Widget>[AppSkeleton(), AppSkeleton(), AppSkeleton()],
        );
      case _LoadState.error:
        return AppErrorState(
          message: 'Không tải được tồn kho.',
          onRetry: _tai,
        );
      case _LoadState.ready:
        if (data == null || data.items.isEmpty) {
          return const AppEmptyState(
            icon: 'ic-warehouse',
            title: 'Chưa có sản phẩm nào theo dõi tồn kho.',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (final StockItemView item in data.items) _theSanPham(item),
            if (data.purchaseList.isNotEmpty)
              _danhSachCanMua(data.purchaseList),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: widget.onOpenVouchers != null &&
                widget.perms.contains(AppPermissionKeys.inventoryManage)
            ? AppTopbar(
                eyebrow: 'KHO · 1 KHO',
                title: 'Tồn kho',
                action: const Text(
                  'Phiếu kho',
                  style: TextStyle(
                    color: AppTokens.teal,
                    fontFamily: AppTokens.fontFamily,
                    fontSize: 12.0,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                onAction: _openVouchers,
              )
            : const AppTopbar(eyebrow: 'KHO · 1 KHO', title: 'Tồn kho'),
        bottomNav: const AppBottomNav(activeIndex: kInventoryTabIndex),
        body: SingleChildScrollView(child: _than()),
      ),
    );
  }
}
