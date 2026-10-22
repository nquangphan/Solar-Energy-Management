// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_product_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateProductRequestDto _$CreateProductRequestDtoFromJson(
  Map<String, dynamic> json,
) => CreateProductRequestDto(
  name: json['name'] as String,
  sku: json['sku'] as String,
  unit: json['unit'] as String,
  price: json['price'] as num,
  tracksStock: json['tracksStock'] as bool? ?? true,
  priceEditable: json['priceEditable'] as bool? ?? false,
  costPrice: json['costPrice'] as num?,
  warrantyMonths: json['warrantyMonths'] as num?,
);

Map<String, dynamic> _$CreateProductRequestDtoToJson(
  CreateProductRequestDto instance,
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
