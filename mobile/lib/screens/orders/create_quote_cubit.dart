// hand-authored — Tạo báo giá (Story 11.3, moved out of CreateQuoteScreen's State).
// THE CLIENT DOES NO MONEY MATH (AD-10/16): every unit price and amount is a
// number the BACKEND computed; a qty edit goes OUT through `updateLine` and the
// fresh numbers come BACK. The totals come from the stateless `previewTotal`
// call, which echoes the lines the backend just returned.
//
// A network failure NEVER wipes entered lines (EXPERIENCE Flow 1): the error
// path only sets the message — it never resets the order.
//
// The stock warning is a hint, never a gate: a failed read only hides it.

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart' show XFile;

import '../../design_system/components/share_button.dart' show AppShareFn;
import '../../design_system/session/catalog_port.dart';
import '../../design_system/session/customers_port.dart';
import '../../design_system/session/orders_port.dart';
import 'create_quote_state.dart';

class CreateQuoteCubit extends Cubit<CreateQuoteState> {
  CreateQuoteCubit({required OrdersPort ordersPort, required CatalogPort catalogPort})
      : _ordersPort = ordersPort,
        _catalogPort = catalogPort,
        super(const CreateQuoteState());

  final OrdersPort _ordersPort;
  final CatalogPort _catalogPort;

  /// The preview is the SECOND call after every mutation and can come back late:
  /// back-to-back mutations must not let an older total overwrite a newer one.
  int _latestTotals = 0;

  /// Same ticket for the stock warning: an answer for older lines never wins.
  int _latestStock = 0;

  /// The message the BACKEND sent (AD-5), verbatim — the generic line is only
  /// for a transport failure, which carries no envelope.
  void _fail(Object err) {
    if (isClosed) return;
    emit(state.copyWith(
      error: err is OrderPortException ? err.message : 'Không thực hiện được. Thử lại.',
      fieldErrors: err is OrderPortException ? err.fieldErrors : const <String, String>{},
    ));
  }

  /// A failure the screen hit after a cubit call returned (a sheet repaint, the
  /// caller's callback) shows the same banner the screen showed before the move.
  void reportError(Object err) => _fail(err);

  /// Asks the screen to rewrite the two metadata inputs from [source].
  void _syncMeta(Order source) {
    if (isClosed) return;
    emit(state.copyWith(metaSyncSeq: state.metaSyncSeq + 1, metaSyncFrom: source));
  }

  /// Backend stock warning of the lines; a failed read only hides the hints.
  Future<void> _refreshStockCheck(String orderId) async {
    final int ticket = ++_latestStock;
    try {
      final OrderStockCheck fresh = await _ordersPort.getStockCheck(orderId);
      if (isClosed || ticket != _latestStock) return;
      emit(state.copyWith(stockCheck: fresh));
    } catch (_) {
      if (isClosed || ticket != _latestStock) return;
      emit(state.copyWith(stockCheck: null));
    }
  }

  /// THE one path to the totals: echo the lines the backend just returned through
  /// `previewTotal`. A failed preview ⇒ "—" + the message; the cart stays.
  Future<void> _refreshTotals(Order fetched) async {
    // Every path that re-reads lines comes through here — the stock hint follows them.
    _refreshStockCheck(fetched.id);
    final int ticket = ++_latestTotals;
    // The discount is IN EFFECT while the order awaits approval or was confirmed
    // with an approval `cho_duyet`/`dong_y`. A 'baogia' order echoes none: after a
    // rejection or a reopen, the version being edited carries no discount.
    final OrderDiscount? discount = fetched.discount;
    final bool discountActive = discount != null &&
        fetched.status != 'baogia' &&
        (discount.status == kDiscountChoDuyet || discount.status == kDiscountDongY);
    try {
      final OrderTotals fresh = await _ordersPort.previewTotal(
        PreviewTotalInput(
          lines: fetched.lineItems.map((OrderLine l) => PreviewTotalLine(unitPrice: l.unitPrice, qty: l.qty)).toList(),
          // Echo the order's VAT tick; an old order with no vatMode leaves the
          // field out (the backend reads it as VAT). A value this build does not
          // know is left out too: echoing it would be a 400.
          vatMode: fetched.vatMode?.json == null ? null : PreviewTotalRequestDtoVatMode.fromJson(fetched.vatMode!.json!),
          // Echo the order's discount — the backend's number.
          discountAmount: discountActive ? discount.amount : null,
        ),
      );
      if (isClosed || ticket != _latestTotals) return;
      emit(state.copyWith(totals: fresh));
    } catch (err) {
      if (isClosed || ticket != _latestTotals) return;
      emit(state.copyWith(totals: null));
      _fail(err);
    }
  }

  /// Re-reads the order — the retry path; NEVER resets entered lines on failure.
  Future<void> refresh() async {
    final Order? order = state.order;
    if (order == null) return;
    try {
      final Order fresh = await _ordersPort.get(order.id);
      if (isClosed) return;
      emit(state.copyWith(order: fresh, error: null));
      await _refreshTotals(fresh);
    } catch (err) {
      _fail(err);
    }
  }

  /// A failure keeps step 1 on screen with the backend's message.
  Future<void> createOrder(Customer picked) async {
    try {
      final Order created = await _ordersPort.create(CreateOrderInput(customerPhone: picked.phone));
      if (isClosed) return;
      emit(state.copyWith(customer: picked, order: created, error: null));
      _syncMeta(created);
      await _refreshTotals(created);
    } catch (err) {
      _fail(err);
    }
  }

  /// PATCH of the metadata group: VAT tick / kWp / validity. The VAT tick CHANGES
  /// MONEY ⇒ an accepted PATCH re-previews with the NEW order. A refusal keeps
  /// the cart and rewrites the inputs from the old order (invariant k).
  Future<void> updateMeta(UpdateOrderMetaInput input) async {
    final Order? order = state.order;
    if (order == null) return;
    emit(state.copyWith(metaBusy: true));
    try {
      final Order updated = await _ordersPort.updateOrderMeta(order.id, input);
      if (isClosed) return;
      emit(state.copyWith(order: updated, error: null));
      _syncMeta(updated);
      await _refreshTotals(updated);
    } catch (err) {
      _fail(err);
      _syncMeta(order);
    } finally {
      if (!isClosed) emit(state.copyWith(metaBusy: false));
    }
  }

  /// kWp on blur: "8,82"/"8.82" → 8.82 — INPUT CONVERSION, not money math; empty
  /// → null (clear); unparseable → a field error and no request; unchanged → no request.
  void commitKWp(String text) {
    final Order? order = state.order;
    if (order == null) return;
    final String raw = text.trim();
    if (raw.isEmpty) {
      if (order.kWp != null) updateMeta(const UpdateOrderMetaInput(kWp: null));
      return;
    }
    final double? parsed = double.tryParse(raw.replaceAll(',', '.'));
    if (parsed == null) {
      emit(state.copyWith(fieldErrors: <String, String>{...state.fieldErrors, 'kWp': 'Công suất phải là số (vd 8,82).'}));
      return;
    }
    emit(state.copyWith(fieldErrors: Map<String, String>.of(state.fieldErrors)..remove('kWp')));
    if (parsed == order.kWp) return;
    updateMeta(UpdateOrderMetaInput(kWp: parsed));
  }

  /// Validity on blur — empty → null (clear); a PATCH only when it changed.
  void commitValidityNote(String text) {
    final Order? order = state.order;
    if (order == null) return;
    final String raw = text.trim();
    final String? next = raw.isEmpty ? null : raw;
    if (next == order.validityNote) return;
    updateMeta(UpdateOrderMetaInput(validityNote: next));
  }

  /// The id of the line the backend added, or null when it refused.
  Future<String?> addCatalogLine(String productId, int qty) async {
    final Order? order = state.order;
    if (order == null) return null;
    try {
      final OrderLine line = await _ordersPort.addLine(order.id, AddOrderLineInput(productId: productId, qty: qty));
      await refresh();
      return line.id;
    } catch (err) {
      _fail(err);
      return null;
    }
  }

  /// True when the line landed. Earlier field errors go first; [onAccepted] runs
  /// as soon as the backend took the line, before the cart is read again.
  Future<bool> addFreeLine({
    required String name,
    required String unit,
    required String qtyText,
    required String unitPriceText,
    required String note,
    void Function()? onAccepted,
  }) async {
    final Order? order = state.order;
    if (order == null) return false;
    emit(state.copyWith(fieldErrors: const <String, String>{}));
    try {
      await _ordersPort.addLine(
        order.id,
        AddOrderLineInput(
          name: name,
          unit: unit,
          qty: int.tryParse(qtyText) ?? 0,
          unitPrice: int.tryParse(unitPriceText) ?? 0,
          note: note.isNotEmpty ? note : null,
        ),
      );
      if (!isClosed) onAccepted?.call();
      await refresh();
      return true;
    } catch (err) {
      _fail(err);
      return false;
    }
  }

  Future<void> updateQty(String lineId, num qty) async {
    final Order? order = state.order;
    if (order == null || qty < 1) return;
    try {
      await _ordersPort.updateLine(order.id, lineId, UpdateOrderLineInput(qty: qty.toInt()));
      await refresh();
    } catch (err) {
      _fail(err);
    }
  }

  Future<void> updateUnitPrice(String lineId, num unitPrice) async {
    final Order? order = state.order;
    if (order == null || unitPrice < 0) return;
    try {
      await _ordersPort.updateLine(order.id, lineId, UpdateOrderLineInput(unitPrice: unitPrice.toInt()));
      await refresh();
    } catch (err) {
      _fail(err);
    }
  }

  /// `warrantyMonths` sent explicitly — a number, or null to drop the warranty.
  Future<void> updateWarranty(String lineId, int? warrantyMonths) async {
    final Order? order = state.order;
    if (order == null) return;
    try {
      await _ordersPort.updateLine(order.id, lineId, UpdateOrderLineInput(warrantyMonths: warrantyMonths));
      await refresh();
    } catch (err) {
      _fail(err);
    }
  }

  Future<void> removeLine(String lineId) async {
    final Order? order = state.order;
    if (order == null) return;
    try {
      await _ordersPort.removeLine(order.id, lineId);
      await refresh();
    } catch (err) {
      _fail(err);
    }
  }

  /// Thi công/Vận chuyển flags: the order is replaced by the response. NO
  /// preview — the flags carry no money (AD-16).
  Future<void> toggleScope(UpdateScopeFlagsInput input) async {
    final Order? order = state.order;
    if (order == null) return;
    emit(state.copyWith(scopeBusy: true));
    try {
      final Order updated = await _ordersPort.updateScopeFlags(order.id, input);
      if (isClosed) return;
      emit(state.copyWith(order: updated, error: null));
    } catch (err) {
      _fail(err);
    } finally {
      if (!isClosed) emit(state.copyWith(scopeBusy: false));
    }
  }

  /// Chốt (FR-5): the BACKEND freezes the prices and moves the status. The
  /// confirmed order, or null when it refused (the message is then in the state)
  /// or the screen is already gone.
  Future<Order?> confirmOrder() async {
    final Order? order = state.order;
    if (order == null) return null;
    emit(state.copyWith(confirmBusy: true));
    try {
      final Order confirmed = await _ordersPort.confirmOrder(order.id);
      if (isClosed) return null;
      emit(state.copyWith(order: confirmed, error: null));
      return confirmed;
    } catch (err) {
      _fail(err);
      return null;
    } finally {
      if (!isClosed) emit(state.copyWith(confirmBusy: false));
    }
  }

  /// Mở lại (FR-6): the BACKEND creates a new version and returns the order to 'baogia'.
  Future<void> reviseOrder() async {
    final Order? order = state.order;
    if (order == null) return;
    emit(state.copyWith(reviseBusy: true));
    try {
      final Order revised = await _ordersPort.reviseOrder(order.id);
      if (isClosed) return;
      emit(state.copyWith(order: revised, error: null));
      _syncMeta(revised);
      await _refreshTotals(revised);
    } catch (err) {
      _fail(err);
    } finally {
      if (!isClosed) emit(state.copyWith(reviseBusy: false));
    }
  }

  /// Áp chiết khấu + gửi duyệt (FR-18): the typed amount is converted, not
  /// computed; the BACKEND moves the order to awaiting approval.
  Future<void> applyDiscount({required String amountText, required String note}) async {
    final Order? order = state.order;
    if (order == null) return;
    emit(state.copyWith(discountBusy: true));
    try {
      final Order applied = await _ordersPort.applyDiscount(
        order.id,
        ApplyDiscountInput(
          amount: int.tryParse(amountText) ?? 0,
          note: note.isNotEmpty ? note : null,
        ),
      );
      if (isClosed) return;
      emit(state.copyWith(order: applied, error: null));
      await _refreshTotals(applied);
    } catch (err) {
      _fail(err);
    } finally {
      if (!isClosed) emit(state.copyWith(discountBusy: false));
    }
  }

  /// Chia sẻ báo giá (FR-21): the backend renders both files; they go to [share]
  /// image first (UX-DR-21). A dismissed share sheet is not an error.
  Future<void> shareQuote(AppShareFn share) async {
    final Order? order = state.order;
    if (order == null) return;
    emit(state.copyWith(shareBusy: true));
    try {
      final QuoteExportFiles files = await _ordersPort.exportQuote(order.id);
      await share(
        <XFile>[
          XFile.fromData(files.image.bytes, mimeType: files.image.mimeType, name: files.image.fileName),
          XFile.fromData(files.pdf.bytes, mimeType: files.pdf.mimeType, name: files.pdf.fileName),
        ],
        title: files.image.fileName,
        fileNames: <String>[files.image.fileName, files.pdf.fileName],
      );
      if (isClosed) return;
      emit(state.copyWith(error: null));
    } catch (err) {
      _fail(err);
    } finally {
      if (!isClosed) emit(state.copyWith(shareBusy: false));
    }
  }

  /// The catalogue for the picker sheet; null (sheet stays shut) when it failed.
  Future<List<CatalogProduct>?> openCatalog() async {
    try {
      return await _catalogPort.listProducts();
    } catch (err) {
      _fail(err);
      return null;
    }
  }

  /// One search of the picker sheet; a failed one is ignored (null), no message.
  Future<List<CatalogProduct>?> searchProducts(String q) async {
    try {
      return await _catalogPort.listProducts(search: q.isEmpty ? null : q);
    } catch (_) {
      return null;
    }
  }

  /// The groups for the group sheet; null (sheet stays shut) when it failed.
  Future<List<CatalogGroup>?> openGroups() async {
    try {
      return await _catalogPort.listGroups();
    } catch (err) {
      _fail(err);
      return null;
    }
  }

  /// One group's checklist; null when it failed.
  Future<CatalogGroupDetail?> openGroup(String id) async {
    try {
      return await _catalogPort.getGroup(id);
    } catch (err) {
      _fail(err);
      return null;
    }
  }
}
