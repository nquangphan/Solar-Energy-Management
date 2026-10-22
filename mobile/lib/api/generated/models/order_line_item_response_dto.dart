// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'order_line_item_response_dto.g.dart';

@JsonSerializable()
class OrderLineItemResponseDto {
  const OrderLineItemResponseDto({
    required this.id,
    required this.name,
    required this.unit,
    required this.qty,
    required this.unitPrice,
    required this.priceEditable,
    required this.isFlexible,
    required this.displayOrder,
    required this.amount,
    this.productId,
    this.note,
    this.warrantyMonths,
  });
  
  factory OrderLineItemResponseDto.fromJson(Map<String, Object?> json) => _$OrderLineItemResponseDtoFromJson(json);
  
  final String id;

  /// `null` = dòng tự do; có giá trị = dòng trỏ Product danh mục.
  final String? productId;

  /// Tên dòng — nhiều dòng được.
  final String name;
  final String unit;
  final num qty;

  /// Đơn giá HIỆU LỰC — số nguyên ĐỒNG (giá sống với dòng catalog không sửa giá).
  final num unitPrice;

  /// true = giá sửa được tại chỗ (dòng tự do, hoặc Product.priceEditable).
  final bool priceEditable;

  /// Cờ "linh động/dự kiến" — chỉ hiển thị.
  final bool isFlexible;
  final String? note;

  /// Bảo hành (tháng), copy default từ Product — hành vi thuộc Story 4.9.
  final num? warrantyMonths;

  /// Thứ tự hiển thị trong giỏ (server gán).
  final num displayOrder;

  /// Thành tiền = unitPrice hiệu lực × qty — SERVER tính (AD-16).
  final num amount;

  Map<String, Object?> toJson() => _$OrderLineItemResponseDtoToJson(this);
}
