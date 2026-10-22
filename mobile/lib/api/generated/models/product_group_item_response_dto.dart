// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'product_group_item_response_dto.g.dart';

@JsonSerializable()
class ProductGroupItemResponseDto {
  const ProductGroupItemResponseDto({
    required this.productId,
    required this.name,
    required this.sku,
    required this.unit,
    required this.price,
    required this.isActive,
    required this.displayOrder,
  });
  
  factory ProductGroupItemResponseDto.fromJson(Map<String, Object?> json) => _$ProductGroupItemResponseDtoFromJson(json);
  
  final String productId;
  final String name;
  final String sku;
  final String unit;

  /// Giá bán — số nguyên ĐỒNG.
  final num price;

  /// false = sản phẩm đã ẩn khỏi danh mục. Món vẫn nằm trong gói (nó bị tắt SAU khi được thêm) — picker phải làm mờ / bỏ tick.
  final bool isActive;

  /// Thứ tự hiện trên checklist (server gán).
  final num displayOrder;

  Map<String, Object?> toJson() => _$ProductGroupItemResponseDtoToJson(this);
}
