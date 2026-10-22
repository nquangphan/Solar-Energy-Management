// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_stock_check_line_dto_status.dart';

part 'order_stock_check_line_dto.g.dart';

@JsonSerializable()
class OrderStockCheckLineDto {
  const OrderStockCheckLineDto({
    required this.productId,
    required this.name,
    required this.unit,
    required this.qty,
    required this.onHand,
    required this.reserved,
    required this.available,
    required this.shortfall,
    required this.status,
  });
  
  factory OrderStockCheckLineDto.fromJson(Map<String, Object?> json) => _$OrderStockCheckLineDtoFromJson(json);
  
  final String productId;

  /// Product name.
  final String name;

  /// Unit of measure.
  final String unit;

  /// Quantity the order needs — sum of the current-version lines of this product.
  final num qty;

  /// Real on-hand now. No stock record ⇒ 0.
  final num onHand;

  /// Promised to OTHER orders (ledger sum) — what this order itself holds is excluded.
  final num reserved;

  /// `onHand − reserved` — may be negative.
  final num available;

  /// Units of `qty` beyond `available` (≥ 0) — what to bring in.
  final num shortfall;

  /// `short` ⇔ `shortfall > 0`.
  final OrderStockCheckLineDtoStatus status;

  Map<String, Object?> toJson() => _$OrderStockCheckLineDtoToJson(this);
}
