// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_product_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateProductRequestDto _$UpdateProductRequestDtoFromJson(
  Map<String, dynamic> json,
) => UpdateProductRequestDto(
  name: json['name'] as String?,
  sku: json['sku'] as String?,
  unit: json['unit'] as String?,
  price: json['price'] as num?,
  costPrice: json['costPrice'] as num?,
  tracksStock: json['tracksStock'] as bool?,
  priceEditable: json['priceEditable'] as bool?,
  warrantyMonths: json['warrantyMonths'] as num?,
);

Map<String, dynamic> _$UpdateProductRequestDtoToJson(
  UpdateProductRequestDto instance,
) => <String, dynamic>{
  'name': instance.name,
  'sku': instance.sku,
  'unit': instance.unit,
  'price': instance.price,
  'costPrice': instance.costPrice,
  'tracksStock': instance.tracksStock,
  'priceEditable': instance.priceEditable,
  'warrantyMonths': instance.warrantyMonths,
};
