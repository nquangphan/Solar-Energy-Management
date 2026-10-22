// hand-authored — request bodies that carry ONLY the keys the caller set (Story 10.8).
//
// json_serializable writes every field of a generated DTO, null included, and
// the retrofit client sends `body.toJson()` as is. The backend reads an ABSENT
// key and a `null` one differently:
//   - `kWp: null` / `validityNote: null` / `warrantyMonths: null` CLEAR the value;
//   - a not-null field (`IsOptionalNotNull`: the scope flags, `vatMode`, `qty`,
//     `unitPrice`, `productId`, `discountAmount`…) answers 400 to an explicit
//     null, and a stock-out line must carry NO `unitCost` key at all.
// So toggling one scope flag with a plain generated body would also clear the
// order's kWp. Each body below is a private subclass of its generated DTO whose
// toJson keeps only the keys the port input says are present; the generated
// files and types stay untouched.
import '../design_system/session/orders_port.dart';
import '../design_system/session/stock_vouchers_port.dart';
import 'generated/models/add_line_item_request_dto.dart';
import 'generated/models/create_stock_voucher_request_dto.dart';
import 'generated/models/preview_total_request_dto.dart';
import 'generated/models/update_line_item_request_dto.dart';
import 'generated/models/update_order_request_dto.dart';
import 'generated/models/update_order_request_dto_vat_mode.dart';

/// [json] with every key outside [present] removed.
Map<String, Object?> _only(Map<String, Object?> json, Set<String> present) =>
    json..removeWhere((key, _) => !present.contains(key));

/// [value] as plain JSON with every null map entry dropped, nested DTOs included
/// (json_serializable leaves nested objects for the encoder to `toJson`).
Object? _withoutNulls(Object? value) {
  if (value is Map) {
    return <String, Object?>{
      for (final MapEntry(:key, :value) in value.entries)
        if (value != null) key as String: _withoutNulls(value),
    };
  }
  if (value is List) return [for (final item in value) _withoutNulls(item)];
  if (value == null || value is num || value is String || value is bool) return value;
  return _withoutNulls((value as dynamic).toJson());
}

class _SparseUpdateOrder extends UpdateOrderRequestDto {
  const _SparseUpdateOrder(
    this._present, {
    super.scopeConstruction,
    super.scopeDelivery,
    super.vatMode,
    super.kWp,
    super.validityNote,
  });

  final Set<String> _present;

  @override
  Map<String, Object?> toJson() => _only(super.toJson(), _present);
}

class _SparseUpdateLine extends UpdateLineItemRequestDto {
  const _SparseUpdateLine(
    this._present, {
    super.qty,
    super.unitPrice,
    super.note,
    super.isFlexible,
    super.warrantyMonths,
  });

  final Set<String> _present;

  @override
  Map<String, Object?> toJson() => _only(super.toJson(), _present);
}

class _NoNullAddLine extends AddLineItemRequestDto {
  _NoNullAddLine(AddLineItemRequestDto input)
    : super(
        qty: input.qty,
        isFlexible: input.isFlexible,
        productId: input.productId,
        unitPrice: input.unitPrice,
        name: input.name,
        unit: input.unit,
        note: input.note,
      );

  @override
  Map<String, Object?> toJson() => _withoutNulls(super.toJson())! as Map<String, Object?>;
}

class _NoNullPreviewTotal extends PreviewTotalRequestDto {
  _NoNullPreviewTotal(PreviewTotalRequestDto input)
    : super(lines: input.lines, vatMode: input.vatMode, discountAmount: input.discountAmount);

  @override
  Map<String, Object?> toJson() => _withoutNulls(super.toJson())! as Map<String, Object?>;
}

class _NoNullStockVoucher extends CreateStockVoucherRequestDto {
  _NoNullStockVoucher(CreateStockVoucherRequestDto input)
    : super(type: input.type, note: input.note, lines: input.lines);

  @override
  Map<String, Object?> toJson() => _withoutNulls(super.toJson())! as Map<String, Object?>;
}

/// `PATCH /orders/:id` toggling the scope flags: only the flags the input sets.
UpdateOrderRequestDto scopeFlagsBody(UpdateScopeFlagsInput input) => _SparseUpdateOrder(
  {if (input.scopeConstruction != null) 'scopeConstruction', if (input.scopeDelivery != null) 'scopeDelivery'},
  scopeConstruction: input.scopeConstruction,
  scopeDelivery: input.scopeDelivery,
);

/// `PATCH /orders/:id` for the metadata group: `vatMode` when set, `kWp` /
/// `validityNote` when the input says present — `null` then means clear.
UpdateOrderRequestDto orderMetaBody(UpdateOrderMetaInput input) => _SparseUpdateOrder(
  {if (input.vatMode != null) 'vatMode', if (input.hasKWp) 'kWp', if (input.hasValidityNote) 'validityNote'},
  vatMode: input.vatMode == null ? null : UpdateOrderRequestDtoVatMode.fromJson(input.vatMode!),
  kWp: input.kWp,
  validityNote: input.validityNote,
);

/// `PATCH /orders/:id/line-items/:lineId`: the set fields, plus `warrantyMonths`
/// when the input says present (`null` = no warranty).
UpdateLineItemRequestDto lineUpdateBody(UpdateOrderLineInput input) => _SparseUpdateLine(
  {
    if (input.qty != null) 'qty',
    if (input.unitPrice != null) 'unitPrice',
    if (input.note != null) 'note',
    if (input.isFlexible != null) 'isFlexible',
    if (input.hasWarrantyMonths) 'warrantyMonths',
  },
  qty: input.qty,
  unitPrice: input.unitPrice,
  note: input.note,
  isFlexible: input.isFlexible,
  warrantyMonths: input.warrantyMonths,
);

/// `POST /orders/:id/line-items`: a catalogue line carries no name/unit/price
/// keys unless the screen set them.
AddLineItemRequestDto addLineBody(AddOrderLineInput input) => _NoNullAddLine(input);

/// `POST /orders/preview-total`: `vatMode` / `discountAmount` only when echoed.
PreviewTotalRequestDto previewTotalBody(PreviewTotalInput input) => _NoNullPreviewTotal(input);

/// `POST /stock-vouchers`: a stock-out line carries no `unitCost` key (the server
/// snapshots the cost), and an empty note is absent.
CreateStockVoucherRequestDto stockVoucherBody(CreateStockVoucherInput input) => _NoNullStockVoucher(input);
