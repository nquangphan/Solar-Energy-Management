// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_price_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductPriceResponseDto _$ProductPriceResponseDtoFromJson(
  Map<String, dynamic> json,
) => ProductPriceResponseDto(
  id: json['id'] as String,
  minQty: json['minQty'] as num,
  price: json['price'] as num,
);

Map<String, dynamic> _$ProductPriceResponseDtoToJson(
  ProductPriceResponseDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'minQty': instance.minQty,
  'price': instance.price,
};
