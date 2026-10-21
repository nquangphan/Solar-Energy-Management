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
// (Story 5.5), reached by one action button here. "Huỷ đơn" (5.7) is the second
// one, and it opens a DIALOG rather than a screen — it collects one line of text
// and nothing else (UX-DR-19/20). "Share báo giá" still leads to a screen that
// does not exist — it stays absent.
//
// THE BUTTONS' VISIBILITY IS NOT A PERMISSION CALCULATION. Each shows exactly
// when the backend said this caller can do it, and is ABSENT otherwise — not
// greyed (UX-DR-22). The branches need DIFFERENT permission keys, so an any-of
// expression here would be a third copy of the rule and it would drift
// (AD-2/AD-4).
//
// AND THE TWO ARE GATED SEPARATELY. Cancelling is not part of the manual lane,
// so `buocKeTiep` is EMPTY at 'baogia' — the status orders are cancelled from
// most often. One shared `_buocKeTiep.isNotEmpty` would hide the cancel button
// exactly where it is needed.
//
// LABELS are byte-identical with the web twin (UX-DR-27) — including the tab and
// frame labels. The mockup shortens them on mobile ("Lịch sử", "Vòng đời"); this
// screen deliberately does not follow it, because the two platforms differ in
// frame and navigation, not in wording.
//
// No money math (AD-10/16): every number shown is one the backend computed.
//
// "Phiếu xuất": the order's ONE stock-out. Whether it can be issued
// now (`canIssue`) is the backend's answer; the frame only shows for callers who
// hold a key that reads it (UX only — the backend gates the read too).

import 'dart:typed_data';

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/gating/app_permission_keys.g.dart';
import '../../design_system/gating/app_permissions.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/session/stock_vouchers_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_tabs.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../inventory/stock_vouchers_screen.dart' show ngayGio;
import 'discount_approval_screen.dart' show kOrdersTabIndex;
import 'stock_issue_preview.dart';

/// `notFound` is its own state, NOT a flavour of `error`: "this order does not
/// exist, or is not yours" is an answer, and pressing "Thử lại" on an answer
/// just asks the same question again (UX-DR-19).
enum _LoadState { loading, ready, error, notFound }

const String _kTabThongTin = 'thong-tin';
const String _kTabLichSu = 'lich-su';
const String _kTabAnh = 'anh';

/// Exactly three tabs. A full Thanh toán tab needs recording payments too
/// (story 7.2); until then the payment schedule is one optional action button
/// ("Thanh toán"), not an empty tab promising something nobody built. Ảnh shipped in Story 5.6.
const List<AppTabItem> _kTabs = <AppTabItem>[
  AppTabItem(key: _kTabThongTin, label: 'Thông tin'),
  AppTabItem(key: _kTabLichSu, label: 'Lịch sử update'),
  AppTabItem(key: _kTabAnh, label: 'Ảnh'),
];

/// The photo ceiling the backend enforces per upload. Mirrored here only to stop
/// the picker offering an eleventh tile — the refusal itself stays server-side.
const int _kSoAnhToiDa = 10;

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({
    super.key,
    required this.port,
    required this.orderId,
    this.onBack,
    this.onChangeStatus,
    this.onOpenPaymentSchedule,
    this.pick,
    this.perms = const <PermissionKey>{},
  });

  final OrdersPort port;
  final String orderId;
  final VoidCallback? onBack;

  /// Opens the status-change screen (Story 5.5). Null = the button never renders.
  final VoidCallback? onChangeStatus;

  /// Opens the payment-schedule screen (Story 7.1). Null = the button never renders.
  final VoidCallback? onOpenPaymentSchedule;

  /// Injectable picker for the Ảnh tab (Story 5.6) — widget tests run without a
  /// platform channel, so the seam has to reach the shipped picker.
  final ImagePickFn? pick;

  /// The caller's effective permissions — gates the "Phiếu xuất" frame (UX only).
  final Set<PermissionKey> perms;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Order? _order;
  List<OrderLifecycleStep> _steps = const <OrderLifecycleStep>[];
  List<OrderNextStep> _buocKeTiep = const <OrderNextStep>[];

  /// Backend-computed (AD-2/AD-4). The screen never asks "is the status one of
  /// these three" — that rule lives in the transition table.
  bool _coTheHuy = false;
  List<OrderVersionItem> _versions = const <OrderVersionItem>[];
  _LoadState _state = _LoadState.loading;
  String _tab = _kTabThongTin;

  /// Three requests, ONE ticket for the whole batch: they are one screenful of
  /// one order, so a stale batch must be discarded as a batch.
  int _latest = 0;

  // ---- Tab Ảnh (Story 5.6) -------------------------------------------------
  // Loaded LAZILY, on first open of the tab: photos are the heaviest thing on
  // this screen and most visits never open it. Folding them into [_load] would
  // make every detail view pay for a panel nobody asked for.
  List<AttachmentItem> _anh = const <AttachmentItem>[];
  final Map<String, Uint8List> _anhBytes = <String, Uint8List>{};
  _LoadState _anhState = _LoadState.loading;
  bool _anhDaMo = false;
  List<XFile> _anhDaChon = const <XFile>[];
  int _anhLatest = 0;

  Future<void> _loadAnh() async {
    final int ticket = ++_anhLatest;
    setState(() {
      _anhState = _LoadState.loading;
      // The previous batch is dead the moment a reload starts. Keeping it means
      // a deleted photo's bytes stay resident for the life of the screen — at
      // 10 MB a photo that adds up on a phone.
      _anhBytes.clear();
    });
    try {
      final List<AttachmentItem> danhSach =
          await widget.port.listAnh(widget.orderId);
      if (!mounted || ticket != _anhLatest) return;
      setState(() {
        _anh = danhSach;
        _anhState = _LoadState.ready;
      });
      // Bytes come through the authenticated proxy, ONE call per photo; the
      // gallery widget never fetches (AD-3). A photo whose bytes fail simply
      // keeps the placeholder glyph — one broken image must not blank the tab.
      for (final AttachmentItem item in danhSach) {
        try {
          final Uint8List bytes =
              await widget.port.anhBytes(widget.orderId, item.id);
          if (!mounted || ticket != _anhLatest) return;
          setState(() => _anhBytes[item.id] = bytes);
        } catch (_) {
          // placeholder glyph stands in
        }
      }
    } catch (_) {
      if (!mounted || ticket != _anhLatest) return;
      setState(() => _anhState = _LoadState.error);
    }
  }

  void _moTab(String key) {
    setState(() => _tab = key);
    if (key == _kTabAnh && !_anhDaMo) {
      _anhDaMo = true;
      _loadAnh();
    }
  }

  Future<void> _guiAnh() async {
    if (_anhDaChon.isEmpty) return;
    final List<XFile> gui = _anhDaChon;
    try {
      await widget.port.themAnh(widget.orderId, gui);
      if (!mounted) return;
      setState(() => _anhDaChon = const <XFile>[]);
      await _loadAnh();
    } catch (_) {
      if (!mounted) return;
      setState(() => _anhState = _LoadState.error);
    }
  }

  /// Delete goes through a Dialog stating the consequence (UX-DR-20) — never
  /// straight off the tap, and never while the picker's sheet is open: the two
  /// flows are separate, so overlays stack at most one deep.
  Future<void> _hoiXoaAnh(String attachmentId) async {
    // AppConfirmDialog pops its OWN route and then calls back, so the action
    // hangs off `onConfirm` — popping again here would close the screen behind
    // the dialog. Cancel (button, X, barrier, back) simply never calls back.
    await showAppDialog<void>(
      context: context,
      child: AppConfirmDialog(
        title: 'Xoá ảnh',
        consequence: 'Ảnh sẽ bị xoá vĩnh viễn và không khôi phục được.',
        onConfirm: () => _xoaAnh(attachmentId),
      ),
    );
  }

  /// Huỷ đơn (Story 5.7) goes through a Dialog stating the consequence and
  /// carrying the mandatory reason field (UX-DR-19/20) — not a screen: one line
  /// of text does not need one, and there is no photo picker here to open a
  /// second overlay (which is exactly why 5.5 had to be a screen).
  ///
  /// [AppDialog] — NOT [AppConfirmDialog], which has no input slot. AppDialog
  /// does not pop itself either, so the dialog below owns its own pop.
  Future<void> _hoiHuyDon() async {
    final bool? daHuy = await showAppDialog<bool>(
      context: context,
      child: _HuyDonDialog(
        onConfirm: (String lyDo) => widget.port.huyDon(widget.orderId, lyDo),
      ),
    );
    if (daHuy != true || !mounted) return;
    // Status, `cancelReason` and the lifecycle all changed — reload rather than
    // patch local state, so the screen keeps showing one truth.
    await _load();
  }

  Future<void> _xoaAnh(String attachmentId) async {
    try {
      await widget.port.xoaAnh(widget.orderId, attachmentId);
      await _loadAnh();
    } catch (_) {
      if (!mounted) return;
      setState(() => _anhState = _LoadState.error);
    }
  }

  // ---- Phiếu xuất ---------------------------------------------
  OrderStockIssueView? _stockIssue;
  int _stockIssueLatest = 0;

  bool get _canSeeStockIssue =>
      widget.perms.contains(AppPermissionKeys.inventoryManage) ||
      widget.perms.contains(AppPermissionKeys.deliveryConfirm);

  /// A failed read leaves the frame out rather than blanking the screen: the
  /// stock-out is one panel of the order, not the order.
  Future<void> _loadStockIssue() async {
    final int ticket = ++_stockIssueLatest;
    try {
      final OrderStockIssueView view =
          await widget.port.getStockIssue(widget.orderId);
      if (!mounted || ticket != _stockIssueLatest) return;
      setState(() => _stockIssue = view);
    } catch (_) {
      if (!mounted || ticket != _stockIssueLatest) return;
      setState(() => _stockIssue = null);
    }
  }

  Future<void> _openIssueSheet() async {
    final OrderStockIssueView? view = _stockIssue;
    if (view == null) return;
    final bool? issued = await showAppSheet<bool>(
      context: context,
      child: _StockIssueSheet(
        view: view,
        onConfirm: () => widget.port.issueStock(widget.orderId),
        onReload: () async {
          try {
            return await widget.port.getStockIssue(widget.orderId);
          } catch (_) {
            return null;
          }
        },
      ),
    );
    if (issued != true || !mounted) return;
    await _loadStockIssue();
  }

  @override
  void initState() {
    super.initState();
    _load();
    if (_canSeeStockIssue) _loadStockIssue();
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
        _coTheHuy = vongDoi.coTheHuy;
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
            if ((_buocKeTiep.isNotEmpty && widget.onChangeStatus != null) ||
                _coTheHuy ||
                widget.onOpenPaymentSchedule != null) ...<Widget>[
              const SizedBox(height: AppTokens.space12),
              // `Wrap`, not `Row`: the two labels together overflow the phone
              // frame at large text scales, and a RenderFlex overflow is the
              // bug this screen already carries once (5.4) — not twice.
              Wrap(
                spacing: AppTokens.space8,
                runSpacing: AppTokens.space8,
                children: <Widget>[
                  if (_buocKeTiep.isNotEmpty && widget.onChangeStatus != null)
                    AppButton(
                      label: 'Chuyển trạng thái',
                      variant: AppButtonVariant.primary,
                      onPressed: widget.onChangeStatus,
                    ),
                  if (widget.onOpenPaymentSchedule != null)
                    AppButton(
                      label: 'Thanh toán',
                      onPressed: widget.onOpenPaymentSchedule,
                    ),
                  if (_coTheHuy)
                    AppButton(
                      label: 'Huỷ đơn',
                      variant: AppButtonVariant.danger,
                      onPressed: _hoiHuyDon,
                    ),
                ],
              ),
            ],
            if (_canSeeStockIssue && _stockIssue != null) ...<Widget>[
              const SizedBox(height: AppTokens.space16),
              _stockIssueFrame(_stockIssue!),
            ],
            const SizedBox(height: AppTokens.space16),
            AppTabs(
              tabs: _kTabs,
              activeKey: _tab,
              onSelect: _moTab,
            ),
            const SizedBox(height: AppTokens.space16),
            if (_tab == _kTabThongTin)
              _facts(order)
            else if (_tab == _kTabLichSu)
              _history()
            else
              _anhTab(),
          ],
        );
    }
  }

  Widget _stockIssueFrame(OrderStockIssueView v) {
    const TextStyle muted = TextStyle(
      color: AppTokens.muted,
      fontFamily: AppTokens.fontFamily,
      fontSize: 13.0,
      fontWeight: FontWeight.w600,
    );
    final StockVoucherDetail? voucher = v.voucher;
    final Widget content;
    if (v.issued && voucher != null) {
      final bool hasCost =
          voucher.lines.any((StockVoucherLine l) => l.unitCost != null);
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            '${voucher.ma} · ${ngayGio(voucher.createdAt)} · ${voucher.nguoiTao.displayName}',
            style: muted,
          ),
          const SizedBox(height: AppTokens.space8),
          AppTable(
            columns: <AppTableColumn>[
              const AppTableColumn('Sản phẩm', flex: 3),
              const AppTableColumn('SL', numeric: true, flex: 1),
              if (hasCost)
                const AppTableColumn('Giá vốn / đv', numeric: true, flex: 2),
            ],
            rows: <AppTableRow>[
              for (final StockVoucherLine l in voucher.lines)
                AppTableRow(<Widget>[
                  AppTableCellText(l.ten),
                  AppTableCellText('${l.qty}'),
                  if (hasCost)
                    AppTableCellText(
                        l.unitCost != null ? formatVnd(l.unitCost!) : ''),
                ]),
            ],
          ),
        ],
      );
    } else if (v.canIssue) {
      content = Align(
        alignment: Alignment.centerLeft,
        child: AppButton(
          label: 'Xuất kho',
          variant: AppButtonVariant.primary,
          onPressed: _openIssueSheet,
        ),
      );
    } else {
      content = const Text('Chưa xuất kho.', style: muted);
    }
    return AppFrame(label: 'Phiếu xuất', onBg: true, child: content);
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
              // The chip never wraps or truncates, so on a narrow phone the
              // longest label is scaled down to the room left rather than
              // overflowing; at normal widths it renders at natural size.
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: key != null
                        ? AppStatusChip(status: key)
                        : Text(order.status),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (order.cancelReason != null) _kv('Lý do huỷ', order.cancelReason!),
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
                  _mono(formatVnd(line.amount)),
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

  /// Status key → its shipped Vietnamese label; unknown keys render verbatim.
  /// The step badge reuses the ONE label table — a third copy would drift.
  String _nhanTrangThai(String value) {
    final StatusKey? key = statusKeyOf(value);
    return key == null ? value : kStatusLabels[key]!;
  }

  Widget _anhTab() {
    switch (_anhState) {
      case _LoadState.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            AppSkeleton(),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(),
          ],
        );
      case _LoadState.error:
      case _LoadState.notFound:
        return AppErrorState(
          message: 'Không tải được ảnh của đơn.',
          retryLabel: 'Thử lại',
          onRetry: _loadAnh,
        );
      case _LoadState.ready:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            AppAttachmentGallery(
              items: <AppAttachmentItem>[
                for (final AttachmentItem item in _anh)
                  AppAttachmentItem(
                    id: item.id,
                    fileName: item.fileName,
                    nguoiTaiLen: item.nguoiTaiLen,
                    createdAt: item.createdAt,
                    statusTo: item.statusTo,
                    buocLabel: item.statusFrom != null && item.statusTo != null
                        ? 'Bước: ${_nhanTrangThai(item.statusFrom!)} → ${_nhanTrangThai(item.statusTo!)}'
                        : null,
                    bytes: _anhBytes[item.id],
                    // Backend-computed (AD-2) — rendered, never rebuilt.
                    coTheXoa: item.coTheXoa,
                  ),
              ],
              onDelete: _hoiXoaAnh,
              emptyLabel: 'Chưa có ảnh nào.',
            ),
            const SizedBox(height: AppTokens.space16),
            const Text(
              'Thêm ảnh bổ sung',
              style: TextStyle(
                color: AppTokens.ink,
                fontFamily: AppTokens.fontFamily,
                fontSize: 13.0,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppTokens.space8),
            // The shipped picker holds LOCAL files only; posting them is this
            // screen's job (AD-3). `pick` stays injectable so widget tests run
            // without a platform channel.
            AppImageUpload(
              images: <AppUploadItem>[
                for (int i = 0; i < _anhDaChon.length; i++)
                  AppUploadItem(
                    id: 'anh-moi-$i',
                    path: _anhDaChon[i].path,
                    name: _anhDaChon[i].name,
                  ),
              ],
              max: _kSoAnhToiDa,
              pick: widget.pick,
              onAdd: (List<XFile> files) => setState(
                () => _anhDaChon = <XFile>[..._anhDaChon, ...files],
              ),
              onRemove: (String id) {
                final int i = int.parse(id.split('-').last);
                setState(
                  () => _anhDaChon = <XFile>[
                    for (int j = 0; j < _anhDaChon.length; j++)
                      if (j != i) _anhDaChon[j],
                  ],
                );
              },
            ),
            if (_anhDaChon.isNotEmpty) ...<Widget>[
              const SizedBox(height: AppTokens.space8),
              AppButton(
                label: 'Thêm ảnh',
                variant: AppButtonVariant.primary,
                onPressed: _guiAnh,
              ),
            ],
          ],
        );
    }
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

/// The stock-out confirmation sheet. Owns its in-flight state so a
/// second tap cannot reach the port, and refuses to close mid-request — the
/// caller must learn whether the stock-out happened.
class _StockIssueSheet extends StatefulWidget {
  const _StockIssueSheet({
    required this.view,
    required this.onConfirm,
    required this.onReload,
  });

  final OrderStockIssueView view;
  final Future<OrderStockIssueResult> Function() onConfirm;

  /// Re-reads the preview after a refusal; null = keep the one on screen.
  final Future<OrderStockIssueView?> Function() onReload;

  @override
  State<_StockIssueSheet> createState() => _StockIssueSheetState();
}

class _StockIssueSheetState extends State<_StockIssueSheet> {
  late OrderStockIssueView _view = widget.view;
  bool _sending = false;
  String? _error;
  Map<int, String> _lineErrors = const <int, String>{};

  Future<void> _confirm() async {
    if (_sending) return;
    setState(() {
      _sending = true;
      _error = null;
      _lineErrors = const <int, String>{};
    });
    try {
      await widget.onConfirm();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = error is OrderPortException
            ? error.message
            : 'Không xuất kho được.';
        _lineErrors = rowErrors(error);
      });
      // Show the current numbers next to the backend's row messages.
      final OrderStockIssueView? fresh = await widget.onReload();
      if (!mounted || fresh == null) return;
      setState(() => _view = fresh);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_sending,
      child: AppSheet(
        title: 'Phiếu xuất kho',
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            StockIssuePreview(view: _view, errors: _lineErrors),
            if (_error != null) ...<Widget>[
              const SizedBox(height: AppTokens.space8),
              AppBanner(tone: AppBannerTone.danger, message: _error),
            ],
            const SizedBox(height: AppTokens.space12),
            // Locked while the backend warns the stock is short right now.
            AppButton(
              label: _view.blocked ? 'Xuất kho (bị chặn)' : 'Xác nhận xuất kho',
              variant: AppButtonVariant.primary,
              onPressed: _sending || _view.blocked ? null : _confirm,
            ),
          ],
        ),
      ),
    );
  }
}

/// The Huỷ đơn dialog (Story 5.7). Holds its own text/error/busy state so the
/// screen behind it does not rebuild on every keystroke, and pops with `true`
/// only after the port call succeeded.
///
/// Blocking an empty reason here is UX only — the backend refuses it too (AD-4)
/// and it owns the exact rule.
class _HuyDonDialog extends StatefulWidget {
  const _HuyDonDialog({required this.onConfirm});

  final Future<void> Function(String lyDo) onConfirm;

  @override
  State<_HuyDonDialog> createState() => _HuyDonDialogState();
}

class _HuyDonDialogState extends State<_HuyDonDialog> {
  final TextEditingController _lyDo = TextEditingController();
  String? _loi;
  bool _dangGui = false;

  @override
  void dispose() {
    _lyDo.dispose();
    super.dispose();
  }

  Future<void> _gui() async {
    if (_lyDo.text.trim().isEmpty || _dangGui) return;
    setState(() {
      _dangGui = true;
      _loi = null;
    });
    try {
      await widget.onConfirm(_lyDo.text);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        // The server's message verbatim: it is the one that knows WHY.
        _loi =
            error is OrderPortException ? error.message : 'Không huỷ được đơn.';
        _dangGui = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool guiDuoc = _lyDo.text.trim().isNotEmpty && !_dangGui;
    // While the request is in flight the dialog REFUSES to close. Tapping the
    // barrier (or Back) would pop the route with `null` while `onConfirm` is
    // still running: the order gets cancelled server-side, but the caller reads
    // `daHuy != true` and skips the reload — leaving the screen showing a stale
    // "Huỷ đơn" button and no reason row for an order that is already cancelled.
    return PopScope(
      canPop: !_dangGui,
      child: AppDialog(
        title: 'Huỷ đơn',
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const AppBanner(
              tone: AppBannerTone.danger,
              message:
                  'Đơn sẽ đóng lại và không tiếp tục được. Thao tác này không hoàn tác được.',
            ),
            const SizedBox(height: AppTokens.space12),
            AppField(
              label: 'Lý do huỷ',
              controller: _lyDo,
              maxLines: 3,
              onChanged: (_) => setState(() {}),
            ),
            if (_loi != null) ...<Widget>[
              const SizedBox(height: AppTokens.space8),
              AppBanner(tone: AppBannerTone.danger, message: _loi!),
            ],
          ],
        ),
        footer: <Widget>[
          AppButton(
            label: 'Đóng',
            variant: AppButtonVariant.ghost,
            onPressed: () => Navigator.of(context).pop(false),
          ),
          AppButton(
            label: 'Xác nhận huỷ',
            variant: AppButtonVariant.danger,
            onPressed: guiDuoc ? () => _gui() : null,
          ),
        ],
      ),
    );
  }
}
