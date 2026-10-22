// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'order_stock_issue_line_dto.g.dart';

@JsonSerializable()
class OrderStockIssueLineDto {
  const OrderStockIssueLineDto({
    required this.productId,
    required this.name,
    required this.sku,
    required this.unit,
    required this.qty,
    required this.onHand,
    required this.shortfall,
  });
  
  factory OrderStockIssueLineDto.fromJson(Map<String, Object?> json) => _$OrderStockIssueLineDtoFromJson(json);
  
  final String productId;

  /// Product name.
  final String name;
  final String sku;

  /// Unit of measure.
  final String unit;

  /// Quantity the order needs — sum of the current-version lines of this product.
  final num qty;

  /// Real on-hand right now (unlocked read — for counting against only). No stock record ⇒ 0.
  final num onHand;

  /// Units of `qty` beyond `onHand` right now (≥ 0, backend-computed). A warning, not the decision — the server re-checks under the lock when issuing.
  final num shortfall;

  Map<String, Object?> toJson() => _$OrderStockIssueLineDtoToJson(this);
}
