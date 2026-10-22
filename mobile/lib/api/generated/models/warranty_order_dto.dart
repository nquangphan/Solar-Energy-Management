// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'warranty_line_item_dto.dart';

part 'warranty_order_dto.g.dart';

@JsonSerializable()
class WarrantyOrderDto {
  const WarrantyOrderDto({
    required this.id,
    required this.status,
    required this.lineItems,
    this.confirmedAt,
  });
  
  factory WarrantyOrderDto.fromJson(Map<String, Object?> json) => _$WarrantyOrderDtoFromJson(json);
  
  final String id;

  /// Trạng thái đơn — bộ khoá chip design-system.
  final String status;

  /// Ngày chốt của bản hiệu lực (ISO-8601 UTC); `null` nếu bản đó chưa chốt.
  final DateTime? confirmedAt;
  final List<WarrantyLineItemDto> lineItems;

  Map<String, Object?> toJson() => _$WarrantyOrderDtoToJson(this);
}
