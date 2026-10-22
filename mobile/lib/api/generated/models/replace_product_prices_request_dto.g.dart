// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'replace_product_prices_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReplaceProductPricesRequestDto _$ReplaceProductPricesRequestDtoFromJson(
  Map<String, dynamic> json,
) => ReplaceProductPricesRequestDto(
  prices: (json['prices'] as List<dynamic>)
      .map((e) => ProductPriceDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ReplaceProductPricesRequestDtoToJson(
  ReplaceProductPricesRequestDto instance,
) => <String, dynamic>{'prices': instance.prices};
