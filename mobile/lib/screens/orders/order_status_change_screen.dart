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

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import 'discount_approval_screen.dart' show kOrdersTabIndex;
import 'stock_issue_preview.dart';

enum _LoadState { loading, ready, error }

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
  List<OrderNextStep> _steps = const <OrderNextStep>[];
  String? _chon;
  final List<_AnhDaChon> _anh = <_AnhDaChon>[];
  _LoadState _state = _LoadState.loading;
  bool _dangGui = false;
  String? _loiGui;
  Map<int, String> _lineErrors = const <int, String>{};
  OrderStockIssueView? _stockIssue;

  /// The "Đã giao" preview's own load state (null = no preview for this step).
  _LoadState? _previewState;

  int _latest = 0;
  int _seq = 0;
  int _stockIssueTicket = 0;

  bool get _willIssue {
    final OrderStockIssueView? v = _stockIssue;
    return v != null && !v.issued && v.lines.isNotEmpty;
  }

  /// Picks a step — everything that belonged to the previous step goes. The
  /// stock-out preview belongs to "Đã giao" only, and the button waits for it:
  /// the button says what will happen.
  void _selectStep(String? event) {
    ++_stockIssueTicket;
    setState(() {
      _chon = event;
      _stockIssue = null;
      _lineErrors = const <int, String>{};
      _loiGui = null;
      _previewState = null;
    });
    if (event == kEventDelivered) _loadPreview();
  }

  /// Loads the "Đã giao" preview; a late answer for a step the user already
  /// left is dropped (ticket). A failure offers a retry, never a silent label.
  void _loadPreview() {
    final int ticket = ++_stockIssueTicket;
    setState(() => _previewState = _LoadState.loading);
    widget.port.getStockIssue(widget.orderId).then(
      (OrderStockIssueView view) {
        if (!mounted || ticket != _stockIssueTicket) return;
        setState(() {
          _stockIssue = view;
          _previewState = _LoadState.ready;
        });
      },
      onError: (Object _) {
        if (!mounted || ticket != _stockIssueTicket) return;
        setState(() => _previewState = _LoadState.error);
      },
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final int ticket = ++_latest;
    setState(() => _state = _LoadState.loading);
    try {
      final OrderLifecycle vongDoi = await widget.port.getLifecycle(
        widget.orderId,
      );
      // `mounted` before every setState after an await (lesson from 5.4): the
      // screen can be popped while the request is in flight.
      if (!mounted || ticket != _latest) return;
      setState(() {
        _steps = vongDoi.nextSteps;
        _state = _LoadState.ready;
      });
      // Preselect only when there is exactly one choice: with two open
      // branches (thi công / giao hàng) a default would make a consequential
      // decision for the user, and both are one tap from committing.
      _selectStep(
        vongDoi.nextSteps.length == 1 ? vongDoi.nextSteps.first.event : null,
      );
    } catch (_) {
      if (!mounted || ticket != _latest) return;
      setState(() => _state = _LoadState.error);
    }
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
    final String? chon = _chon;
    if (chon == null) return;
    setState(() {
      _dangGui = true;
      _loiGui = null;
      _lineErrors = const <int, String>{};
    });
    try {
      final StatusChangeResult ketQua = await widget.port.transition(
        widget.orderId,
        chon,
        _anh.map((_AnhDaChon a) => a.file).toList(),
      );
      if (!mounted) return;
      setState(() => _dangGui = false);
      widget.onDone?.call(ketQua.status.json ?? '');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _dangGui = false;
        // The backend owns the status/permission rules, so it owns the words for
        // them: its message is rendered verbatim. Screen copy is the fallback
        // for transport failures the backend never saw.
        _loiGui = error is OrderPortException
            ? error.message
            : 'Không chuyển được trạng thái.';
        _lineErrors = rowErrors(error);
      });
      // The refusal may be about stock that moved since the preview was read —
      // show the current numbers next to the backend's row messages.
      if (chon == kEventDelivered) _loadPreview();
    }
  }

  @override
  Widget build(BuildContext context) {
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
      case _LoadState.loading:
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
      case _LoadState.error:
        return AppErrorState(
          message: 'Không chuyển được trạng thái.',
          retryLabel: 'Thử lại',
          onRetry: _load,
        );
      case _LoadState.ready:
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
            if (_previewState == _LoadState.loading &&
                _stockIssue == null) ...<Widget>[
              const SizedBox(height: AppTokens.space16),
              const AppSkeleton(width: 200.0),
            ],
            if (_previewState == _LoadState.error) ...<Widget>[
              const SizedBox(height: AppTokens.space16),
              AppErrorState(
                message: 'Không tải được phiếu xuất kho.',
                retryLabel: 'Thử lại',
                onRetry: _loadPreview,
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
        onTap: _dangGui ? null : () => _selectStep(step.event),
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
                      _previewState != _LoadState.ready) ||
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
