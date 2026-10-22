// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'product_price_dto.g.dart';

@JsonSerializable()
class ProductPriceDto {
  const ProductPriceDto({
    required this.minQty,
    required this.price,
  });
  
  factory ProductPriceDto.fromJson(Map<String, Object?> json) => _$ProductPriceDtoFromJson(json);
  
  /// Mua TỪ số lượng này trở lên thì ăn mức giá này. Tối thiểu 2 — mức 1 chính là giá gốc của sản phẩm.
  final num minQty;

  /// Đơn giá ở mức này — số nguyên ĐỒNG.
  final num price;

  Map<String, Object?> toJson() => _$ProductPriceDtoToJson(this);
}
