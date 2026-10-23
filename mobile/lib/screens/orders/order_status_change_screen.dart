// hand-authored — Flutter app-screen (Story 5.5). Mobile twin of the web
// OrderStatusChangeScreen: pick the next step, optionally attach evidence
// photos, submit.
//
// A SCREEN, NOT A DIALOG. UX-DR-20 wants a Dialog for consequential actions, but
// AppImageUpload opens its OWN AppSheet — a Dialog here would stack two overlay
// layers, and UX-DR-20 also caps overlays at one. The UX inventory already lists
// this as a screen (`s-status-change`). This is the constraint that decided it,
// and it is why web follows mobile here rather than the other way round.
//
// WHICH STEPS EXIST IS NOT COMPUTED HERE. `buocKeTiep` arrives from the backend
// already filtered by the order's status, its scope flags and the caller's real
// permissions (AD-2/AD-4). The branches require DIFFERENT permission keys, so an
// any-of expression on the client would be a third copy of the rule and it would
// drift. An empty list is a real answer: this caller has no legal step.
//
// The screen NEVER touches R2. It collects XFile[] and hands them to the port;
// upload, object keys and the transaction all belong to the backend (AD-3).
//
// "Đã giao" ISSUES THE ORDER'S STOCK when it was not issued yet, in
// the same commit as the status change. Picking that step loads the backend's
// stock-out preview; the button says what will happen. Whether the stock is
// enough is the backend's 409, placed under the row it names.
//
// LABELS are byte-identical with the web twin (UX-DR-27).
//
// OrderStatusChangeCubit reads the steps, the preview and sends the transition
// through the injected [OrdersPort] (Story 11.3); the screen keeps the picked
// photos and renders the cubit's state.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'discount_approval_screen.dart' show kOrdersTabIndex;
import 'order_status_change_cubit.dart';
import 'order_status_change_state.dart';
import 'stock_issue_preview.dart';

/// The photo ceiling the backend enforces. Mirrored here only to stop the picker
/// offering an eleventh tile — the refusal itself stays server-side.
const int _kSoAnhToiDa = 10;

/// One picked photo held in TWO shapes at once: the [XFile] that gets posted,
/// and the [AppUploadItem] the shipped widget draws a thumbnail from. They are
/// kept side by side under one temporary id so removing a thumbnail removes the
/// right file — matching them by name or index would break on two photos taken
/// in the same second.
class _AnhDaChon {
  const _AnhDaChon({required this.id, required this.file, required this.item});

  final String id;
  final XFile file;
  final AppUploadItem item;
}

class OrderStatusChangeScreen extends StatefulWidget {
  const OrderStatusChangeScreen({
    super.key,
    required this.port,
    required this.orderId,
    this.onBack,
    this.onDone,
    this.pick,
  });

  final OrdersPort port;
  final String orderId;
  final VoidCallback? onBack;

  /// Called after the transition committed — the caller navigates back and
  /// refetches.
  final ValueChanged<String>? onDone;

  /// Injectable picker, forwarded to [AppImageUpload]. Widget tests pass a fake
  /// so no platform channel is needed on the test VM.
  final ImagePickFn? pick;

  @override
  State<OrderStatusChangeScreen> createState() =>
      _OrderStatusChangeScreenState();
}

class _OrderStatusChangeScreenState extends State<OrderStatusChangeScreen> {
  final List<_AnhDaChon> _anh = <_AnhDaChon>[];
  int _seq = 0;

  // Created here rather than by BlocProvider(create:): `_gui` reads its answer
  // after an await and then calls back into the router.
  late final OrderStatusChangeCubit _cubit = OrderStatusChangeCubit(widget.port, widget.orderId);

  // Render reads the cubit state; the names are kept because design-system guards pin them.
  OrderStatusChangeStatus get _state => _cubit.state.status;
  List<OrderNextStep> get _steps => _cubit.state.steps;
  String? get _chon => _cubit.state.selected;
  bool get _dangGui => _cubit.state.sending;
  String? get _loiGui => _cubit.state.sendError;
  Map<int, String> get _lineErrors => _cubit.state.lineErrors;
  OrderStockIssueView? get _stockIssue => _cubit.state.stockIssue;

  /// The "Đã giao" preview's own load state (null = no preview for this step).
  OrderStatusChangeStatus? get _previewState => _cubit.state.previewStatus;

  bool get _willIssue {
    final OrderStockIssueView? v = _stockIssue;
    return v != null && !v.issued && v.lines.isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _cubit.load();
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  void _addPhotos(List<XFile> files) {
    setState(() {
      for (final XFile file in files) {
        _seq += 1;
        final String id = 'anh-$_seq';
        _anh.add(
          _AnhDaChon(
            id: id,
            file: file,
            // The path is a LOCAL preview only; the bytes posted are the XFile.
            item: AppUploadItem(id: id, path: file.path, name: file.name),
          ),
        );
      }
    });
  }

  void _boAnh(String id) {
    setState(() => _anh.removeWhere((_AnhDaChon a) => a.id == id));
  }

  Future<void> _gui() async {
    final String? status = await _cubit.submit(_anh.map((_AnhDaChon a) => a.file).toList());
    if (status != null && mounted) widget.onDone?.call(status);
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<OrderStatusChangeCubit, OrderStatusChangeState>(
        builder: (BuildContext context, OrderStatusChangeState _) => _view(),
      ),
    );
  }

  Widget _view() {
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: AppTopbar(
          eyebrow: 'ĐƠN HÀNG',
          title: 'Chuyển trạng thái',
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
      case OrderStatusChangeStatus.loading:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            AppSkeleton(width: 200.0),
            SizedBox(height: AppTokens.space8),
            Text(
              'Đang tải bước kế tiếp…',
              style: TextStyle(
                color: AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        );
      case OrderStatusChangeStatus.error:
        return AppErrorState(
          message: 'Không chuyển được trạng thái.',
          retryLabel: 'Thử lại',
          onRetry: _cubit.load,
        );
      case OrderStatusChangeStatus.ready:
        if (_steps.isEmpty) {
          return const AppFrame(
            label: 'Bước kế tiếp',
            onBg: true,
            child: Text(
              'Không có bước nào để chuyển.',
              style: TextStyle(
                color: AppTokens.muted,
                fontFamily: AppTokens.fontFamily,
                fontSize: 13.0,
                fontWeight: FontWeight.w600,
              ),
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _chonBuoc(),
            const SizedBox(height: AppTokens.space16),
            _khoiAnh(),
            if (_stockIssue != null &&
                _stockIssue!.issued &&
                _stockIssue!.voucher != null) ...<Widget>[
              const SizedBox(height: AppTokens.space8),
              Text(
                'Đã xuất kho · ${_stockIssue!.voucher!.code}',
                style: const TextStyle(
                  color: AppTokens.muted,
                  fontFamily: AppTokens.fontFamily,
                  fontSize: 13.0,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            if (_previewState == OrderStatusChangeStatus.loading &&
                _stockIssue == null) ...<Widget>[
              const SizedBox(height: AppTokens.space16),
              const AppSkeleton(width: 200.0),
            ],
            if (_previewState == OrderStatusChangeStatus.error) ...<Widget>[
              const SizedBox(height: AppTokens.space16),
              AppErrorState(
                message: 'Không tải được phiếu xuất kho.',
                retryLabel: 'Thử lại',
                onRetry: _cubit.loadPreview,
              ),
            ],
            if (_willIssue) ...<Widget>[
              const SizedBox(height: AppTokens.space16),
              AppFrame(
                label: 'Phiếu xuất kho',
                onBg: true,
                child: StockIssuePreview(
                  view: _stockIssue!,
                  errors: _lineErrors,
                ),
              ),
            ],
            if (_loiGui != null) ...<Widget>[
              const SizedBox(height: AppTokens.space8),
              AppBanner(tone: AppBannerTone.danger, message: _loiGui),
            ],
            const SizedBox(height: AppTokens.space16),
            _hanhDong(),
          ],
        );
    }
  }

  /// One row per step. A vertical list, not a row of chips: the rows are
  /// consequential choices and each needs a hit target the width of the frame.
  Widget _chonBuoc() {
    return AppFrame(
      label: 'Bước kế tiếp',
      onBg: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (final OrderNextStep step in _steps) _dongBuoc(step),
        ],
      ),
    );
  }

  Widget _dongBuoc(OrderNextStep step) {
    final StatusKey? key = statusKeyOf(step.to.json ?? '');
    final bool daChon = _chon == step.event;
    return Semantics(
      button: true,
      selected: daChon,
      child: GestureDetector(
        onTap: _dangGui ? null : () => _cubit.selectStep(step.event),
        child: Container(
          margin: const EdgeInsets.only(bottom: AppTokens.space8),
          padding: const EdgeInsets.all(AppTokens.space8),
          decoration: BoxDecoration(
            color: daChon ? AppTokens.surface2 : AppTokens.surface,
            border: Border.all(
              color: daChon ? AppTokens.teal : AppTokens.line,
              width: AppTokens.borderWidth,
            ),
            borderRadius: BorderRadius.circular(AppTokens.radiusDefault),
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: key == null
                ? Text(
                    step.to.json ?? '—',
                    style: const TextStyle(
                      color: AppTokens.ink,
                      fontFamily: AppTokens.fontFamily,
                      fontSize: 13.0,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                : AppStatusChip(status: key),
          ),
        ),
      ),
    );
  }

  Widget _khoiAnh() {
    return AppFrame(
      label: 'Ảnh bằng chứng (không bắt buộc)',
      onBg: true,
      child: AppImageUpload(
        images: _anh.map((_AnhDaChon a) => a.item).toList(),
        onAdd: _addPhotos,
        onRemove: _boAnh,
        max: _kSoAnhToiDa,
        pick: widget.pick,
      ),
    );
  }

  /// Both actions on one row. `Wrap` rather than `Row`: the two labels together
  /// exceed a narrow phone's width at large text scales, and a `Row` would
  /// overflow instead of moving the second button to its own line.
  Widget _hanhDong() {
    return Wrap(
      spacing: AppTokens.space8,
      runSpacing: AppTokens.space8,
      children: <Widget>[
        AppButton(
          label: _willIssue
              ? 'Xác nhận xuất kho & chuyển Đã giao'
              : 'Xác nhận chuyển',
          variant: AppButtonVariant.primary,
          onPressed: _chon == null ||
                  _dangGui ||
                  (_chon == kEventDelivered &&
                      _previewState != OrderStatusChangeStatus.ready) ||
                  // "Đã giao" would issue stock the backend already says is short.
                  (_willIssue && _stockIssue!.blocked)
              ? null
              : _gui,
        ),
        AppButton(
          label: 'Huỷ',
          variant: AppButtonVariant.ghost,
          onPressed: _dangGui ? null : widget.onBack,
        ),
      ],
    );
  }
}
