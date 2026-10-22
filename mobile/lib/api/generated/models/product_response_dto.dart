// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'product_price_response_dto.dart';

part 'product_response_dto.g.dart';

@JsonSerializable()
class ProductResponseDto {
  const ProductResponseDto({
    required this.id,
    required this.name,
    required this.sku,
    required this.unit,
    required this.price,
    required this.tracksStock,
    required this.priceEditable,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    this.costPrice,
    this.warrantyMonths,
    this.prices,
  });
  
  factory ProductResponseDto.fromJson(Map<String, Object?> json) => _$ProductResponseDtoFromJson(json);
  
  final String id;
  final String name;
  final String sku;
  final String unit;

  /// Giá bán — số nguyên ĐỒNG.
  final num price;

  /// Giá vốn — số nguyên ĐỒNG. CHỈ có mặt khi caller mang quyền costs.view; thiếu quyền ⇒ field bị loại khỏi payload (không phải 0, không phải null).
  final num? costPrice;
  final bool tracksStock;
  final bool priceEditable;

  /// Bảo hành mặc định (tháng). `null` = không bảo hành (hợp lệ).
  final num? warrantyMonths;

  /// false = đã ẩn khỏi danh mục (soft-delete).
  final bool isActive;

  /// Bậc thang giá theo số lượng, sắp xếp minQty tăng dần. CHỈ có mặt khi cờ catalog.tiered_pricing BẬT; cờ TẮT ⇒ field bị loại khỏi payload (không phải mảng rỗng). Rỗng = cờ bật nhưng sản phẩm chưa cấu hình mức nào.
  final List<ProductPriceResponseDto>? prices;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, Object?> toJson() => _$ProductResponseDtoToJson(this);
}
