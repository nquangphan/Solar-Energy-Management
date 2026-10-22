// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'product_price_response_dto.g.dart';

@JsonSerializable()
class ProductPriceResponseDto {
  const ProductPriceResponseDto({
    required this.id,
    required this.minQty,
    required this.price,
  });
  
  factory ProductPriceResponseDto.fromJson(Map<String, Object?> json) => _$ProductPriceResponseDtoFromJson(json);
  
  final String id;

  /// Mua TỪ số lượng này trở lên thì ăn mức giá này.
  final num minQty;

  /// Đơn giá ở mức này — số nguyên ĐỒNG.
  final num price;

  Map<String, Object?> toJson() => _$ProductPriceResponseDtoToJson(this);
}
