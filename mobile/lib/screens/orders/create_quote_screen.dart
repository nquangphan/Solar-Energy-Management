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

import 'package:flutter/widgets.dart';

import '../../design_system/components/components.dart';
import '../../design_system/session/catalog_port.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/session/orders_port.dart';
import '../../design_system/shell/app_bottom_nav.dart';
import '../../design_system/shell/app_mobile_shell.dart';
import '../../design_system/shell/app_phone_frame.dart';
import '../../design_system/shell/app_topbar.dart';
import '../../design_system/tokens/app_tokens.dart';
import '../customers/customer_pick_screen.dart';

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
    this.onDone,
  });

  final OrdersPort ordersPort;
  final CatalogPort catalogPort;
  final CustomersPort customersPort;

  /// Called when the user finishes building (Story 4.5 owns Chốt — nothing here).
  final void Function(Order order)? onDone;

  @override
  State<CreateQuoteScreen> createState() => _CreateQuoteScreenState();
}

class _CreateQuoteScreenState extends State<CreateQuoteScreen> {
  Order? _order;
  Customer? _customer;

  /// null = chưa có/preview lỗi → khu tổng hiển thị "—" (không hiển thị số cũ đã sai).
  OrderTotals? _totals;

  /// Preview là call THỨ HAI sau mỗi mutation và có thể về trễ/đè: mutation liên
  /// tiếp không được cho tổng cũ đè tổng mới (pattern `_latest` của CustomerListScreen).
  int _latestTotals = 0;

  String? _error;
  Map<String, String> _fieldErrors = const <String, String>{};

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
    super.dispose();
  }

  /// The message the BACKEND sent (AD-5), verbatim — the generic line is only
  /// for a transport failure, which carries no envelope.
  void _showError(Object err) {
    if (!mounted) return;
    setState(() {
      _error = err is OrderPortException
          ? err.message
          : 'Không thực hiện được. Thử lại.';
      _fieldErrors = err is OrderPortException
          ? err.fieldErrors
          : const <String, String>{};
    });
  }

  /// MỘT đường code duy nhất cho tổng: echo các dòng backend vừa trả qua
  /// `previewTotal` — KHÔNG phép tính nào trong màn (AD-16). Lỗi preview →
  /// totals về "—" + message; KHÔNG xoá giỏ, KHÔNG chặn sửa dòng tiếp.
  Future<void> _refreshTotals(Order fetched) async {
    final int ticket = ++_latestTotals;
    try {
      final OrderTotals fresh = await widget.ordersPort.previewTotal(
        PreviewTotalInput(
          lines: fetched.lineItems
              .map((OrderLine l) =>
                  PreviewTotalLine(unitPrice: l.unitPrice, qty: l.qty))
              .toList(),
        ),
      );
      if (!mounted || ticket != _latestTotals) return;
      setState(() => _totals = fresh);
    } catch (err) {
      if (!mounted || ticket != _latestTotals) return;
      setState(() => _totals = null);
      _showError(err);
    }
  }

  /// Re-read the order — the retry path; NEVER resets entered lines on failure.
  Future<void> _refresh() async {
    final Order? order = _order;
    if (order == null) return;
    try {
      final Order fresh = await widget.ordersPort.get(order.id);
      if (!mounted) return;
      setState(() {
        _order = fresh;
        _error = null;
      });
      await _refreshTotals(fresh);
    } catch (err) {
      _showError(err);
    }
  }

  Future<void> _createOrder(Customer picked) async {
    try {
      final Order created = await widget.ordersPort
          .create(CreateOrderInput(customerSdt: picked.sdt));
      if (!mounted) return;
      setState(() {
        _customer = picked;
        _order = created;
        _error = null;
      });
      await _refreshTotals(created);
    } catch (err) {
      // Đơn chưa tạo được — ở lại màn pick; message backend nguyên văn.
      _showError(err);
    }
  }

  Future<String?> _addCatalogLine(String productId, int qty) async {
    final Order? order = _order;
    if (order == null) return null;
    try {
      final OrderLine line = await widget.ordersPort
          .addLine(order.id, AddOrderLineInput(productId: productId, qty: qty));
      await _refresh();
      return line.id;
    } catch (err) {
      _showError(err);
      return null;
    }
  }

  /// Returns true when the line landed — the sheet closes only then; a backend
  /// rejection keeps the form open with the backend's fieldErrors pinned on it.
  Future<bool> _addFreeLine() async {
    final Order? order = _order;
    if (order == null) return false;
    setState(() => _fieldErrors = const <String, String>{});
    try {
      await widget.ordersPort.addLine(
        order.id,
        AddOrderLineInput(
          name: _freeName.text,
          unit: _freeUnit.text,
          qty: int.tryParse(_freeQty.text) ?? 0,
          unitPrice: int.tryParse(_freeUnitPrice.text) ?? 0,
          note: _freeNote.text.isNotEmpty ? _freeNote.text : null,
        ),
      );
      _freeName.clear();
      _freeUnit.clear();
      _freeQty.text = '1';
      _freeUnitPrice.text = '0';
      _freeNote.clear();
      await _refresh();
      return true;
    } catch (err) {
      _showError(err);
      return false;
    }
  }

  Future<void> _updateQty(String lineId, num qty) async {
    final Order? order = _order;
    if (order == null || qty < 1) return;
    try {
      await widget.ordersPort
          .updateLine(order.id, lineId, UpdateOrderLineInput(qty: qty.toInt()));
      await _refresh();
    } catch (err) {
      _showError(err);
    }
  }

  Future<void> _updateUnitPrice(String lineId, num unitPrice) async {
    final Order? order = _order;
    if (order == null || unitPrice < 0) return;
    try {
      await widget.ordersPort.updateLine(
          order.id, lineId, UpdateOrderLineInput(unitPrice: unitPrice.toInt()));
      await _refresh();
    } catch (err) {
      _showError(err);
    }
  }

  Future<void> _removeLine(String lineId) async {
    final Order? order = _order;
    if (order == null) return;
    try {
      await widget.ordersPort.removeLine(order.id, lineId);
      await _refresh();
    } catch (err) {
      _showError(err);
    }
  }

  /// Tick = thêm một dòng THƯỜNG trỏ Product thật; untick = gỡ đúng dòng vừa thêm.
  Future<void> _tickGroupItem(String productId, bool checked) async {
    if (checked) {
      final String? lineId = await _addCatalogLine(productId, 1);
      if (lineId != null) _addedByProduct[productId] = lineId;
      return;
    }
    final String? lineId = _addedByProduct.remove(productId);
    if (lineId != null) await _removeLine(lineId);
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
    List<CatalogProduct> products;
    try {
      products = await widget.catalogPort.listProducts();
    } catch (err) {
      _showError(err);
      return;
    }
    if (!mounted) return;
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
                    widget.catalogPort
                        .listProducts(search: q.isEmpty ? null : q)
                        .then((List<CatalogProduct> fresh) {
                      setSheetState(() => products = fresh);
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
                                  '${product.sku} · ${product.unit} · ${product.price}',
                                  style: _microMuted,
                                ),
                              ],
                            ),
                          ),
                          AppButton(
                            label: 'Thêm',
                            size: AppButtonSize.sm,
                            onPressed: () => _addCatalogLine(product.id, 1),
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
    List<CatalogGroup> groups;
    try {
      groups = await widget.catalogPort.listGroups();
    } catch (err) {
      _showError(err);
      return;
    }
    if (!mounted) return;
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
                                try {
                                  final CatalogGroupDetail fresh = await widget
                                      .catalogPort
                                      .getGroup(group.id);
                                  setSheetState(
                                      () => _sheetGroupDetail = fresh);
                                } catch (err) {
                                  _showError(err);
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
                    final bool ok = await _addFreeLine();
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
    final Order? order = _order;

    // BƯỚC 1 — chọn khách: màn pick TỰ HOST shell riêng, nên khi chưa có đơn nó
    // LÀ toàn bộ view (không bọc trong shell của màn này — tránh shell-lồng-shell).
    // Riêng lỗi tạo đơn phải CÓ CHỖ hiện ngay tại bước này — AppErrorState của
    // bước 2 chưa tồn tại, thiếu banner ở đây là user chọn khách mà màn im lặng.
    if (order == null) {
      final Widget pick = CustomerPickScreen(
        port: widget.customersPort,
        onSelect: (Customer picked) => _createOrder(picked),
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
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Khách hàng', style: _microMuted),
                          Text(
                            _customer?.name ?? order.customerSdt,
                            style: _strong,
                          ),
                          Text(order.customerSdt, style: _microMuted),
                        ],
                      ),
                    ),
                    AppCustomerTypeChip(
                        label: customerTypeLabel(order.custType)),
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppTokens.space8),
              AppErrorState(message: _error!, onRetry: _refresh),
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
                          unitPrice: line.unitPrice,
                          amount: line.amount,
                          editable: editable,
                          priceEditable: editable && line.priceEditable,
                          flag: line.isFlexible ? kFlagLinhDong : null,
                          zebra: entry.key.isOdd,
                          onQtyChange: (num qty) => _updateQty(line.id, qty),
                          onUnitPriceChange: (num price) =>
                              _updateUnitPrice(line.id, price),
                          onDelete: () => _removeLine(line.id),
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
                children: [
                  _TotalRow(
                    label: 'Tổng trước VAT',
                    value: _totals == null ? '—' : '${_totals!.subtotal}',
                  ),
                  _TotalRow(
                    label: 'Tiền VAT',
                    value: _totals == null ? '—' : '${_totals!.vatAmount}',
                  ),
                  _TotalRow(
                    label: 'Tổng sau VAT',
                    value: _totals == null ? '—' : '${_totals!.total}',
                    strong: true,
                  ),
                ],
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
