// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'product_price_dto.dart';

part 'replace_product_prices_request_dto.g.dart';

@JsonSerializable()
class ReplaceProductPricesRequestDto {
  const ReplaceProductPricesRequestDto({
    required this.prices,
  });
  
  factory ReplaceProductPricesRequestDto.fromJson(Map<String, Object?> json) => _$ReplaceProductPricesRequestDtoFromJson(json);
  
  /// Bậc thang MỚI, thay thế toàn bộ bậc thang cũ. Mảng rỗng = xoá hết, quay về một giá.
  final List<ProductPriceDto> prices;

  Map<String, Object?> toJson() => _$ReplaceProductPricesRequestDtoToJson(this);
}
