// hand-authored — Flutter app-screen (Story 4.1). Mobile twin of the web
// CreateQuoteScreen: tạo báo giá kiểu giỏ hàng — chọn khách qua tra SĐT (tái
// dùng TRỌN màn Story 3.4) → thêm/sửa/xoá dòng qua OrdersPort, composed from
// shipped widgets (AppCard/AppFrame/AppCartLineRow/AppCheckbox/AppSheet/
// AppButton/AppField/AppErrorState/AppEmptyState) + tokens (AD-13).
//
// THE CLIENT DOES NO MONEY MATH (AD-10/16). Every `unitPrice`/`amount` on this
// screen is a number the BACKEND computed and the port carried in. A qty edit
// goes OUT through `updateLine`; the fresh numbers come BACK in the response.
// The totals (Tổng trước VAT / Tiền VAT / Tổng sau VAT) come from the stateless
// `previewTotal` port call — the screen echoes the displayed lines out and
// renders the backend's three integers as-is; "—" is the not-yet/failed state.
//
// A network failure NEVER wipes entered lines (EXPERIENCE Flow 1): the error
// path only sets an error banner — it never resets `_order`.
//
// STOCK IS A HINT HERE, NEVER A GATE. After each load/line change the screen
// reads the backend's stock warning (`getStockCheck`) and only renders it: a
// per-line label picked from `status`, and one warn banner for short products.
// A failed read hides the hints — no error banner, the cart is untouched — and
// "Chốt" never depends on stock (blocking lives at the stock-out step).
//
// CreateQuoteCubit makes every port call (Story 11.3); the screen keeps the text
// controllers and the group sheet's own bookkeeping, and renders the cubit's state.

import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../design_system/components/components.dart';
import '../../design_system/gating/gating.dart';
import '../../design_system/session/catalog_port.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../customers/customer_pick_screen.dart';
import 'create_quote_cubit.dart';
import 'create_quote_state.dart';

/// Index of the locked bottom-nav `Tạo` tab (UX-DR-15) — this IS the create flow.
const int kCreateTabIndex = 2;

/// Cờ hiển thị của dòng "linh động/dự kiến" — copy byte-identical web ↔ mobile.
const String kFlagLinhDong = 'Linh động/dự kiến';

class CreateQuoteScreen extends StatefulWidget {
  const CreateQuoteScreen({
    super.key,
    required this.ordersPort,
    required this.catalogPort,
    required this.customersPort,
    this.perms = const <PermissionKey>{},
    this.onDone,
    this.shareImpl,
  });

  final OrdersPort ordersPort;
  final CatalogPort catalogPort;
  final CustomersPort customersPort;

  /// Effective permission set of the signed-in user (twin of the web screen's
  /// `usePermissions()` — mobile has no permissions context yet, so the host
  /// injects it). Default `{}` = every gated control hidden — fail-closed
  /// (Story 4.5 gates the Chốt button on `orders.confirm`).
  final Set<PermissionKey> perms;

  /// Called after the order is confirmed ("Chốt", Story 4.5) with the frozen order.
  final void Function(Order order)? onDone;

  /// The share implementation for "Chia sẻ báo giá" (Story 4.8) — injected in
  /// tests so no real platform channel is hit on the test VM (the injectable
  /// seam of AppShareButton); defaults to [platformShareXFiles] in production.
  final AppShareFn? shareImpl;

  @override
  State<CreateQuoteScreen> createState() => _CreateQuoteScreenState();
}

class _CreateQuoteScreenState extends State<CreateQuoteScreen> {
  // Created here rather than by BlocProvider(create:): the sheets and dialogs call
  // it after an await, from routes outside this screen's provider.
  late final CreateQuoteCubit _cubit =
      CreateQuoteCubit(ordersPort: widget.ordersPort, catalogPort: widget.catalogPort);

  // Render reads the cubit state; the names are kept because design-system guards pin them.
  Order? get _order => _cubit.state.order;
  Customer? get _customer => _cubit.state.customer;

  /// null = chưa có/preview lỗi → khu tổng hiển thị "—" (không hiển thị số cũ đã sai).
  OrderTotals? get _totals => _cubit.state.totals;

  /// Backend stock warning of the current lines; null = not loaded / failed ⇒ no hints.
  OrderStockCheck? get _stockCheck => _cubit.state.stockCheck;
  String? get _error => _cubit.state.error;
  Map<String, String> get _fieldErrors => _cubit.state.fieldErrors;

  /// Đang chờ PATCH cờ phạm vi — disable 2 control toggle để tap nhanh không đua response.
  bool get _scopeBusy => _cubit.state.scopeBusy;

  /// Đang chờ PATCH metadata (tick VAT / kWp / hạn hiệu lực, Story 4.4).
  bool get _metaBusy => _cubit.state.metaBusy;

  /// Đang chờ port Chốt (Story 4.5).
  bool get _chotBusy => _cubit.state.confirmBusy;

  /// Đang chờ port Mở lại (Story 4.6).
  bool get _moLaiBusy => _cubit.state.reviseBusy;

  /// Đang chờ port Áp chiết khấu (Story 4.7).
  bool get _discountBusy => _cubit.state.discountBusy;

  /// Đang chờ exportQuote + share (Story 4.8).
  bool get _shareBusy => _cubit.state.shareBusy;

  // Dialog Áp chiết khấu (Story 4.7): amount là số nguyên đồng nhập tay
  // (CHUYỂN ĐỔI input — pattern _freeUnitPrice, không phải số học tiền) + lý
  // do đề xuất optional.
  final TextEditingController _discountAmountCtl = TextEditingController();
  final TextEditingController _discountNoteCtl = TextEditingController();

  // Text đang gõ của 2 input metadata — commit khi mất focus, prefill từ order;
  // lỗi port thì revert về giá trị order cũ (bất biến k).
  final TextEditingController _kWpCtl = TextEditingController();
  final TextEditingController _validityCtl = TextEditingController();

  // Free-line form state.
  final TextEditingController _freeName = TextEditingController();
  final TextEditingController _freeUnit = TextEditingController();
  final TextEditingController _freeQty = TextEditingController(text: '1');
  final TextEditingController _freeUnitPrice = TextEditingController(text: '0');
  final TextEditingController _freeNote = TextEditingController();

  // Group picker: productId → the line it created in THIS sheet session, so
  // unticking removes exactly that line. Never persisted — a group leaves no
  // trace on the order (§2).
  final Map<String, String> _addedByProduct = <String, String>{};

  /// The checklist currently open inside the group sheet (null = group list).
  CatalogGroupDetail? _sheetGroupDetail;

  @override
  void dispose() {
    _freeName.dispose();
    _freeUnit.dispose();
    _freeQty.dispose();
    _freeUnitPrice.dispose();
    _freeNote.dispose();
    _kWpCtl.dispose();
    _validityCtl.dispose();
    _discountAmountCtl.dispose();
    _discountNoteCtl.dispose();
    _cubit.close();
    super.dispose();
  }

  /// Products the backend reports short — one warn sentence each.
  List<OrderStockCheckLine> get _shortStock => <OrderStockCheckLine>[
        for (final OrderStockCheckLine s
            in _stockCheck?.lines ?? const <OrderStockCheckLine>[])
          if (s.status.json == kStockCheckShort) s,
      ];

  /// Wording picked from the backend's `status`; the numbers are its numbers.
  AppCartLineStockHint? _stockHintOf(String? productId) {
    for (final OrderStockCheckLine s
        in _stockCheck?.lines ?? const <OrderStockCheckLine>[]) {
      if (s.productId != productId) continue;
      return s.status.json == kStockCheckShort
          ? AppCartLineStockHint(label: 'Cần nhập ${s.shortfall}', short: true)
          : AppCartLineStockHint(label: 'Kho còn ${s.available}', short: false);
    }
    return null;
  }

  /// Đồng bộ text 2 input metadata từ Đơn — lúc tạo đơn, sau commit, và khi
  /// revert lỗi (KHÔNG setState: controller tự thông báo cho TextField).
  void _syncMetaTexts(Order source) {
    _kWpCtl.text = source.kWp == null ? '' : '${source.kWp}';
    _validityCtl.text = source.validityNote ?? '';
  }

  void _resetFreeLineForm() {
    _freeName.clear();
    _freeUnit.clear();
    _freeQty.text = '1';
    _freeUnitPrice.text = '0';
    _freeNote.clear();
  }

  /// Chốt Đơn (Story 4.5, FR-5): the cubit sends it; the frozen order goes to the
  /// caller. A failure only sets the banner; the cart and the old state stay intact.
  Future<void> _confirmThenLeave() async {
    final Order? confirmed = await _cubit.confirmOrder();
    if (confirmed == null || !mounted) return;
    try {
      widget.onDone?.call(confirmed);
    } catch (err) {
      _cubit.reportError(err);
    }
  }

  /// Dialog xác nhận Chốt — Chốt là hành động có hệ quả (UX-DR-19). Huỷ (nút,
  /// X, barrier, back) = đóng dialog, KHÔNG gọi port — đơn ở nguyên baogia.
  Future<void> _openChotDialog() async {
    await showAppDialog<void>(
      context: context,
      child: AppConfirmDialog(
        title: 'Chốt báo giá',
        consequence:
            'Chốt sẽ đóng băng giá của mọi dòng theo danh mục hiện tại — sửa giá sau này cần tạo bản mới.',
        confirmTone: AppButtonVariant.primary,
        onConfirm: _confirmThenLeave,
      ),
    );
  }

  /// Dialog xác nhận Mở lại — hành động có hệ quả (UX-DR-20), tone primary
  /// (KHÔNG destructive: không mất gì, bản cũ còn nguyên lịch sử). Huỷ (nút, X,
  /// barrier, back) = đóng dialog, KHÔNG gọi port — đơn ở nguyên dachot.
  Future<void> _openMoLaiDialog() async {
    await showAppDialog<void>(
      context: context,
      child: AppConfirmDialog(
        title: 'Mở lại để sửa',
        consequence:
            'Mở lại sẽ tạo bản cập nhật mới — giá các dòng tính lại theo danh mục hiện tại cho tới khi chốt lại; bản đã chốt vẫn nằm trong lịch sử.',
        confirmTone: AppButtonVariant.primary,
        onConfirm: _cubit.reviseOrder,
      ),
    );
  }

  /// Dialog Áp chiết khấu (Story 4.7): MỘT dialog duy nhất (không chồng 2 tầng
  /// overlay — UX-DR-20) gồm 2 field + câu hệ quả + Gửi duyệt/Huỷ. Huỷ (nút,
  /// X, barrier, back) = đóng dialog, KHÔNG gọi port — đơn ở nguyên baogia.
  Future<void> _openDiscountDialog() async {
    await showAppDialog<void>(
      context: context,
      child: AppDialog(
        title: 'Áp chiết khấu',
        onClose: () => Navigator.of(context).pop(),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            AppField(
              label: 'Mức chiết khấu (đ)',
              controller: _discountAmountCtl,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: AppTokens.space8),
            AppField(label: 'Lý do đề xuất', controller: _discountNoteCtl),
            const SizedBox(height: AppTokens.space8),
            const Text(
              'Gửi duyệt sẽ chuyển đơn sang Chờ duyệt chiết khấu — đơn khoá sửa cho tới khi được duyệt hoặc bị từ chối.',
              style: _microMuted,
            ),
          ],
        ),
        footer: [
          AppButton(
            label: 'Huỷ',
            variant: AppButtonVariant.ghost,
            onPressed: () => Navigator.of(context).pop(),
          ),
          AppButton(
            label: 'Gửi duyệt',
            variant: AppButtonVariant.primary,
            onPressed: () {
              Navigator.of(context).pop();
              _cubit.applyDiscount(amountText: _discountAmountCtl.text, note: _discountNoteCtl.text);
            },
          ),
        ],
      ),
    );
  }

  /// Tick = thêm một dòng THƯỜNG trỏ Product thật; untick = gỡ đúng dòng vừa thêm.
  Future<void> _tickGroupItem(String productId, bool checked) async {
    if (checked) {
      final String? lineId = await _cubit.addCatalogLine(productId, 1);
      if (lineId != null) _addedByProduct[productId] = lineId;
      return;
    }
    final String? lineId = _addedByProduct.remove(productId);
    if (lineId != null) await _cubit.removeLine(lineId);
  }

  // ---------- pickers (Sheet — lựa chọn nhanh, UX-DR-20; chồng tối đa 1 cấp) ----------

  /// Sheet body = vùng CUỘN có trần chiều cao: danh mục/checklist/form dài hơn
  /// khung sheet thì cuộn, không tràn (khung điện thoại thấp — overflow là lỗi
  /// render thật mà widget test bắt được).
  Widget _sheetBody(Widget child) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 260.0),
      child: SingleChildScrollView(child: child),
    );
  }

  Future<void> _openCatalogPicker() async {
    final List<CatalogProduct>? opened = await _cubit.openCatalog();
    if (opened == null || !mounted) return;
    List<CatalogProduct> products = opened;
    await showAppSheet<void>(
      context: context,
      child: AppSheet(
        title: 'Chọn từ danh mục',
        onClose: () => Navigator.of(context).pop(),
        body: StatefulBuilder(
          builder: (BuildContext sheetContext, StateSetter setSheetState) {
            return _sheetBody(Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                AppField(
                  label: 'Tìm theo tên hoặc SKU',
                  onChanged: (String q) {
                    _cubit.searchProducts(q).then((List<CatalogProduct>? fresh) {
                      if (fresh != null) setSheetState(() => products = fresh);
                    }).catchError((Object _) {});
                  },
                ),
                const SizedBox(height: AppTokens.space8),
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: products.length,
                  itemBuilder: (BuildContext _, int index) {
                    final CatalogProduct product = products[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: AppTokens.space8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(product.name, style: _strong),
                                Text(
                                  '${product.sku} · ${product.unit} · ${formatVnd(product.price)}',
                                  style: _microMuted,
                                ),
                              ],
                            ),
                          ),
                          AppButton(
                            label: 'Thêm',
                            size: AppButtonSize.sm,
                            onPressed: () => _cubit.addCatalogLine(product.id, 1),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ));
          },
        ),
      ),
    );
  }

  Future<void> _openGroupPicker() async {
    final List<CatalogGroup>? groups = await _cubit.openGroups();
    if (groups == null || !mounted) return;
    _addedByProduct.clear();
    _sheetGroupDetail = null;
    await showAppSheet<void>(
      context: context,
      child: AppSheet(
        title: 'Chọn gói vật tư',
        onClose: () => Navigator.of(context).pop(),
        body: StatefulBuilder(
          builder: (BuildContext sheetContext, StateSetter setSheetState) {
            final CatalogGroupDetail? detail = _sheetGroupDetail;
            if (detail == null) {
              return _sheetBody(Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: groups
                    .map(
                      (CatalogGroup group) => Padding(
                        padding:
                            const EdgeInsets.only(bottom: AppTokens.space8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(group.name, style: _strong),
                            ),
                            AppButton(
                              label: 'Mở checklist',
                              size: AppButtonSize.sm,
                              onPressed: () async {
                                final CatalogGroupDetail? fresh =
                                    await _cubit.openGroup(group.id);
                                if (fresh == null) return;
                                try {
                                  setSheetState(
                                      () => _sheetGroupDetail = fresh);
                                } catch (err) {
                                  _cubit.reportError(err);
                                }
                              },
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ));
            }
            // Checklist: mỗi item tick thành MỘT dòng thường trỏ Product
            // thật. KHÔNG lưu vết gói/groupName lên đơn (§2). Item ngừng
            // bán (isActive=false) hiển thị disabled.
            return _sheetBody(Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(detail.name, style: _strong),
                const SizedBox(height: AppTokens.space8),
                ...detail.items.map(
                  (CatalogGroupItem item) => AppCheckbox(
                    label: '${item.name} · ${item.unit}',
                    checked: _addedByProduct.containsKey(item.productId),
                    disabled: !item.isActive,
                    onChanged: (bool checked) {
                      _tickGroupItem(item.productId, checked)
                          .then((_) => setSheetState(() {}));
                    },
                  ),
                ),
              ],
            ));
          },
        ),
      ),
    );
  }

  Future<void> _openFreeLineForm() async {
    await showAppSheet<void>(
      context: context,
      child: AppSheet(
        title: 'Dòng tự do',
        onClose: () => Navigator.of(context).pop(),
        body: StatefulBuilder(
          builder: (BuildContext sheetContext, StateSetter setSheetState) {
            // Lỗi cấp field của BACKEND, ghim dưới đúng ô nó gọi tên (AD-5).
            Widget fieldError(String field) {
              final String? message = _fieldErrors[field];
              if (message == null) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(top: AppTokens.space8),
                child: AppBanner(tone: AppBannerTone.danger, message: message),
              );
            }

            return _sheetBody(Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Tên nhiều dòng được (UX-DR-24).
                AppField(label: 'Tên dòng', controller: _freeName, maxLines: 2),
                fieldError('name'),
                const SizedBox(height: AppTokens.space8),
                AppField(label: 'Đơn vị', controller: _freeUnit),
                fieldError('unit'),
                const SizedBox(height: AppTokens.space8),
                AppField(
                  label: 'Số lượng',
                  controller: _freeQty,
                  keyboardType: TextInputType.number,
                ),
                fieldError('qty'),
                const SizedBox(height: AppTokens.space8),
                AppField(
                  label: 'Đơn giá',
                  controller: _freeUnitPrice,
                  keyboardType: TextInputType.number,
                ),
                fieldError('unitPrice'),
                const SizedBox(height: AppTokens.space8),
                AppField(label: 'Diễn giải', controller: _freeNote),
                fieldError('note'),
                const SizedBox(height: AppTokens.space12),
                AppButton(
                  label: 'Thêm dòng',
                  variant: AppButtonVariant.primary,
                  onPressed: () async {
                    final bool ok = await _cubit.addFreeLine(
                      name: _freeName.text,
                      unit: _freeUnit.text,
                      qtyText: _freeQty.text,
                      unitPriceText: _freeUnitPrice.text,
                      note: _freeNote.text,
                      onAccepted: _resetFreeLineForm,
                    );
                    if (!sheetContext.mounted) return;
                    if (ok) {
                      Navigator.of(sheetContext).pop();
                    } else {
                      // Giữ form + dòng đã nhập; render fieldErrors backend.
                      setSheetState(() {});
                    }
                  },
                ),
              ],
            ));
          },
        ),
      ),
    );
  }

  // ---------- build ----------

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

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      // The two metadata inputs are rewritten when the cubit says so — after the
      // order is created, after a metadata PATCH (a refused one rewrites them
      // from the old order) and after reopening.
      child: BlocListener<CreateQuoteCubit, CreateQuoteState>(
        listenWhen: (CreateQuoteState a, CreateQuoteState b) => a.metaSyncSeq != b.metaSyncSeq,
        listener: (BuildContext context, CreateQuoteState s) => _syncMetaTexts(s.metaSyncFrom!),
        child: BlocBuilder<CreateQuoteCubit, CreateQuoteState>(
          builder: (BuildContext context, CreateQuoteState _) => _view(),
        ),
      ),
    );
  }

  Widget _view() {
    final Order? order = _order;

    // BƯỚC 1 — chọn khách: màn pick TỰ HOST shell riêng, nên khi chưa có đơn nó
    // LÀ toàn bộ view (không bọc trong shell của màn này — tránh shell-lồng-shell).
    // Riêng lỗi tạo đơn phải CÓ CHỖ hiện ngay tại bước này — AppErrorState của
    // bước 2 chưa tồn tại, thiếu banner ở đây là user chọn khách mà màn im lặng.
    if (order == null) {
      final Widget pick = CustomerPickScreen(
        port: widget.customersPort,
        onSelect: (Customer picked) => _cubit.createOrder(picked),
      );
      if (_error == null) return pick;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppBanner(tone: AppBannerTone.danger, message: _error!),
          const SizedBox(height: AppTokens.space8),
          Expanded(child: pick),
        ],
      );
    }

    final bool editable = order.status == 'baogia';

    // BƯỚC 2 — giỏ hàng (shell của màn này chỉ render từ đây).
    return AppPhoneFrame(
      child: AppMobileShell(
        topbar: const AppTopbar(eyebrow: 'ĐƠN HÀNG', title: 'Tạo báo giá'),
        bottomNav: const AppBottomNav(activeIndex: kCreateTabIndex),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppCard(
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.space12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Khách hàng', style: _microMuted),
                              Text(
                                _customer?.name ?? order.customerPhone,
                                style: _strong,
                              ),
                              Text(order.customerPhone, style: _microMuted),
                            ],
                          ),
                        ),
                        AppCustomerTypeChip(
                            label: customerTypeLabel(order.custType)),
                      ],
                    ),
                    const SizedBox(height: AppTokens.space8),
                    // Cờ phạm vi (Story 4.3): chip CHỈ hiển thị (AppScopeFlag
                    // tĩnh, màn sở hữu quyết định on/off); toggle qua 2
                    // AppCheckbox riêng — "Thiết bị" luôn bật nên KHÔNG có
                    // control tắt.
                    const Text('Phạm vi', style: _microMuted),
                    const SizedBox(height: AppTokens.space8),
                    Wrap(
                      spacing: 6.0,
                      runSpacing: 6.0,
                      children: [
                        AppScopeFlag(label: 'Thiết bị', on: order.scopeEquipment),
                        AppScopeFlag(label: 'Thi công', on: order.scopeConstruction),
                        AppScopeFlag(
                            label: 'Vận chuyển', on: order.scopeDelivery),
                      ],
                    ),
                    AppCheckbox(
                      label: 'Thi công',
                      checked: order.scopeConstruction,
                      disabled: !editable || _scopeBusy,
                      onChanged: (bool checked) => _cubit.toggleScope(
                          UpdateScopeFlagsInput(scopeConstruction: checked)),
                    ),
                    AppCheckbox(
                      label: 'Vận chuyển',
                      checked: order.scopeDelivery,
                      disabled: !editable || _scopeBusy,
                      onChanged: (bool checked) => _cubit.toggleScope(
                          UpdateScopeFlagsInput(scopeDelivery: checked)),
                    ),
                    const SizedBox(height: AppTokens.space8),
                    // Metadata Đơn (Story 4.4): commit khi mất focus → PATCH;
                    // lỗi → banner + input revert giá trị cũ (bất biến k). kWp
                    // là CHUYỂN ĐỔI input ("8,82" → 8.82), không phải số học tiền.
                    Focus(
                      onFocusChange: (bool has) {
                        if (!has) _cubit.commitKWp(_kWpCtl.text);
                      },
                      child: AppField(
                        label: 'Công suất (kWp)',
                        controller: _kWpCtl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                      ),
                    ),
                    if (_fieldErrors['kWp'] != null) ...[
                      const SizedBox(height: AppTokens.space8),
                      AppBanner(
                        tone: AppBannerTone.danger,
                        message: _fieldErrors['kWp']!,
                      ),
                    ],
                    const SizedBox(height: AppTokens.space8),
                    Focus(
                      onFocusChange: (bool has) {
                        if (!has) _cubit.commitValidityNote(_validityCtl.text);
                      },
                      child: AppField(
                        label: 'Hiệu lực báo giá',
                        controller: _validityCtl,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppTokens.space8),
              AppErrorState(message: _error!, onRetry: _cubit.refresh),
            ],
            // Banner trạng thái chiết khấu (Story 4.7): trong 'choduyet' màn
            // read-only (editable tắt) — banner nói rõ đang chờ ai; sau từ
            // chối đơn về 'baogia' sửa được, banner mang lý do từ backend.
            if (order.status == kOrderStatusChoduyet &&
                order.discount?.status == kDiscountChoDuyet) ...[
              const SizedBox(height: AppTokens.space8),
              const AppBanner(
                tone: AppBannerTone.warn,
                message:
                    'Chờ duyệt chiết khấu — chiết khấu đang chờ người có quyền duyệt.',
              ),
            ],
            if (order.status == kOrderStatusChoduyet &&
                order.discount?.status == kDiscountDongY) ...[
              const SizedBox(height: AppTokens.space8),
              const AppBanner(
                tone: AppBannerTone.info,
                message: 'Chiết khấu đã được duyệt — có thể chốt đơn.',
              ),
            ],
            if (editable && order.discount?.status == kDiscountTuChoi) ...[
              const SizedBox(height: AppTokens.space8),
              AppBanner(
                tone: AppBannerTone.warn,
                message:
                    'Chiết khấu bị từ chối — ${order.discount!.resolveNote ?? ''}',
              ),
            ],
            if (_shortStock.isNotEmpty) ...<Widget>[
              const SizedBox(height: AppTokens.space8),
              AppBanner(
                tone: AppBannerTone.warn,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    for (final OrderStockCheckLine s in _shortStock)
                      Text(
                        '${s.name} — Còn ${s.onHand} · Đã hứa ${s.reserved} · Cần nhập ${s.shortfall}. Vẫn chốt đơn được; chặn nằm ở khâu xuất kho.',
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppTokens.space12),
            AppFrame(
              label: 'Giỏ hàng',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (order.lineItems.isEmpty)
                    const AppEmptyState(
                      icon: 'ic-orders',
                      title: 'Chưa có dòng nào. Thêm dòng đầu tiên để bắt đầu.',
                    )
                  else
                    ...order.lineItems.asMap().entries.map(
                      (MapEntry<int, OrderLine> entry) {
                        final OrderLine line = entry.value;
                        return AppCartLineRow(
                          id: line.id,
                          name: line.name,
                          meta: line.note,
                          qty: line.qty,
                          unitPrice: line.unitPrice.toInt(),
                          amount: line.amount.toInt(),
                          editable: editable,
                          priceEditable: editable && line.priceEditable,
                          warrantyMonths: line.warrantyMonths?.toInt(),
                          // Install/labour catalogue line (productId set +
                          // priceEditable) → no warranty; free line without one
                          // yet → "+ Thêm bảo hành" link; else → input. Free lines
                          // are priceEditable too, so 'none' MUST also check
                          // productId != null.
                          warrantyMode: line.productId != null &&
                                  line.priceEditable
                              ? AppWarrantyMode.none
                              : line.productId == null &&
                                      line.warrantyMonths == null
                                  ? AppWarrantyMode.link
                                  : AppWarrantyMode.input,
                          warrantyEditable: editable,
                          onWarrantyChange: (int? months) =>
                              _cubit.updateWarranty(line.id, months),
                          flag: line.isFlexible ? kFlagLinhDong : null,
                          stockHint: _stockHintOf(line.productId),
                          zebra: entry.key.isOdd,
                          onQtyChange: (num qty) => _cubit.updateQty(line.id, qty),
                          onUnitPriceChange: (num price) =>
                              _cubit.updateUnitPrice(line.id, price),
                          onDelete: () => _cubit.removeLine(line.id),
                        );
                      },
                    ),
                  const SizedBox(height: AppTokens.space12),
                  Wrap(
                    spacing: 8.0,
                    runSpacing: 8.0,
                    children: [
                      AppButton(
                        label: 'Chọn từ danh mục',
                        variant: AppButtonVariant.accent,
                        size: AppButtonSize.sm,
                        onPressed: _openCatalogPicker,
                      ),
                      AppButton(
                        label: 'Chọn gói vật tư',
                        variant: AppButtonVariant.ghost,
                        size: AppButtonSize.sm,
                        onPressed: _openGroupPicker,
                      ),
                      AppButton(
                        label: 'Dòng tự do',
                        variant: AppButtonVariant.ghost,
                        size: AppButtonSize.sm,
                        onPressed: _openFreeLineForm,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppTokens.space12),
            // Khu tổng tiền: 3 số backend trả qua preview-total, integer thô
            // (cùng convention `amount` của AppCartLineRow). "—" = chưa có/
            // preview lỗi. Client CẤM số học tiền.
            AppFrame(
              label: 'Tổng kết',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Tick VAT (Story 4.4) phản ánh order.vatMode; thuế suất % là
                  // GIÁ TRỊ BACKEND từ _totals.vatRate — không nhãn tĩnh.
                  Row(
                    children: [
                      Expanded(
                        child: AppCheckbox(
                          label: 'Tính VAT',
                          checked: order.vatMode?.json != 'khong_vat',
                          disabled: !editable || _metaBusy,
                          onChanged: (bool checked) => _cubit.updateMeta(
                            UpdateOrderMetaInput(
                                vatMode: checked ? 'co_vat' : 'khong_vat'),
                          ),
                        ),
                      ),
                      Text(
                        _totals == null ? '—' : '${_totals!.vatRate}%',
                        style: _microMuted,
                      ),
                    ],
                  ),
                  _TotalRow(
                    label: 'Tổng trước VAT',
                    value: _totals == null ? '—' : formatVnd(_totals!.subtotal.toInt()),
                  ),
                  // Dòng chiết khấu (Story 4.7): CHỈ hiện khi có — số backend echo.
                  if (_totals != null && _totals!.discountAmount > 0)
                    _TotalRow(
                      label: 'Chiết khấu',
                      value: formatVnd(_totals!.discountAmount.toInt()),
                    ),
                  _TotalRow(
                    label: 'Tiền VAT',
                    value:
                        _totals == null ? '—' : formatVnd(_totals!.vatAmount.toInt()),
                  ),
                  _TotalRow(
                    label: 'Tổng sau VAT',
                    value: _totals == null ? '—' : formatVnd(_totals!.total.toInt()),
                    strong: true,
                  ),
                ],
              ),
            ),
            // Áp chiết khấu (Story 4.7): quyền riêng `discounts.apply` — thiếu
            // quyền thì nút BIẾN MẤT (AppGate, UX-DR-22); backend vẫn enforce
            // (AD-4). Bấm mở dialog nhập mức + lý do kèm câu hệ quả.
            if (editable)
              AppGate(
                perms: widget.perms,
                requires: AppPermissionKeys.discountsApply,
                child: Padding(
                  padding: const EdgeInsets.only(top: AppTokens.space12),
                  child: AppButton(
                    label: 'Áp chiết khấu',
                    variant: AppButtonVariant.ghost,
                    onPressed: _discountBusy ? null : _openDiscountDialog,
                  ),
                ),
              ),
            // Chốt (Story 4.5): quyền riêng `orders.confirm` — thiếu quyền thì
            // nút BIẾN MẤT (AppGate, UX-DR-22), không disabled xám; backend vẫn
            // enforce (AD-4). Bấm mở dialog nêu hệ quả.
            if (editable)
              AppGate(
                perms: widget.perms,
                requires: AppPermissionKeys.ordersConfirm,
                child: Padding(
                  padding: const EdgeInsets.only(top: AppTokens.space12),
                  child: AppButton(
                    label: 'Chốt báo giá',
                    variant: AppButtonVariant.primary,
                    onPressed: _chotBusy ? null : _openChotDialog,
                  ),
                ),
              ),
            // Chốt SAU DUYỆT (Story 4.7): đơn 'choduyet' với chiết khấu đã
            // đồng ý — nút Chốt hiện lại (spine ChoDuyet→DaChot "duyệt then
            // Chốt"); vẫn quyền orders.confirm, vẫn dialog hệ quả.
            if (order.status == kOrderStatusChoduyet &&
                order.discount?.status == kDiscountDongY)
              AppGate(
                perms: widget.perms,
                requires: AppPermissionKeys.ordersConfirm,
                child: Padding(
                  padding: const EdgeInsets.only(top: AppTokens.space12),
                  child: AppButton(
                    label: 'Chốt báo giá',
                    variant: AppButtonVariant.primary,
                    onPressed: _chotBusy ? null : _openChotDialog,
                  ),
                ),
              ),
            // Mở lại (Story 4.6): nghịch đảo nút Chốt — hiện khi đơn đã chốt
            // (so bằng HẰNG import từ port, không literal), quyền
            // quotes.create_edit (người khởi động việc sửa chính là người sẽ
            // sửa); thiếu quyền thì nút BIẾN MẤT (AppGate, UX-DR-22); backend
            // vẫn enforce (AD-4).
            if (order.status == kOrderStatusDachot)
              AppGate(
                perms: widget.perms,
                requires: AppPermissionKeys.quotesCreateEdit,
                child: Padding(
                  padding: const EdgeInsets.only(top: AppTokens.space12),
                  child: AppButton(
                    label: 'Mở lại để sửa',
                    variant: AppButtonVariant.primary,
                    onPressed: _moLaiBusy ? null : _openMoLaiDialog,
                  ),
                ),
              ),
            // Chia sẻ báo giá (Story 4.8, FR-21): hiện MỌI trạng thái khi có
            // ≥1 dòng (FR-21 "sau Chốt và khi cần" — báo giá nháp vẫn đưa
            // khách xem; 0 dòng vô nghĩa, backend vẫn 400 làm hàng rào thật,
            // AD-4). KHÔNG ConfirmDialog — share không phải hành động hệ quả
            // tiền (UX-DR-20). KHÔNG nút tải-file riêng trên mobile (đó là nút
            // web-only) — share sheet OS có sẵn Lưu ảnh/Drive.
            if (order.lineItems.isNotEmpty)
              AppGate(
                perms: widget.perms,
                requires: AppPermissionKeys.quotesCreateEdit,
                child: Padding(
                  padding: const EdgeInsets.only(top: AppTokens.space12),
                  child: AppButton(
                    label: 'Chia sẻ báo giá',
                    variant: AppButtonVariant.ghost,
                    onPressed: _shareBusy
                        ? null
                        : () => _cubit.shareQuote(
                            widget.shareImpl ?? platformShareXFiles),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// One totals row — the value is a backend preview number, "—" until the
/// first response (or after a failed preview).
class _TotalRow extends StatelessWidget {
  const _TotalRow(
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
