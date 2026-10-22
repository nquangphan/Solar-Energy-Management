// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_stock_check_line_dto.dart';

part 'order_stock_check_dto.g.dart';

@JsonSerializable()
class OrderStockCheckDto {
  const OrderStockCheckDto({
    required this.lines,
  });
  
  factory OrderStockCheckDto.fromJson(Map<String, Object?> json) => _$OrderStockCheckDtoFromJson(json);
  
  /// One entry per stock-tracked product of the current version (same-product lines merged), ordered by name then productId. Free-text lines and products that do not track stock are absent. Empty once the stock of the current version has been issued.
  final List<OrderStockCheckLineDto> lines;

  Map<String, Object?> toJson() => _$OrderStockCheckDtoToJson(this);
}
