// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductResponseDto _$ProductResponseDtoFromJson(Map<String, dynamic> json) =>
    ProductResponseDto(
      id: json['id'] as String,
      name: json['name'] as String,
      sku: json['sku'] as String,
      unit: json['unit'] as String,
      price: json['price'] as num,
      tracksStock: json['tracksStock'] as bool,
      priceEditable: json['priceEditable'] as bool,
      isActive: json['isActive'] as bool,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      costPrice: json['costPrice'] as num?,
      warrantyMonths: json['warrantyMonths'] as num?,
      prices: (json['prices'] as List<dynamic>?)
          ?.map(
            (e) => ProductPriceResponseDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );

Map<String, dynamic> _$ProductResponseDtoToJson(ProductResponseDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'sku': instance.sku,
      'unit': instance.unit,
      'price': instance.price,
      'costPrice': instance.costPrice,
      'tracksStock': instance.tracksStock,
      'priceEditable': instance.priceEditable,
      'warrantyMonths': instance.warrantyMonths,
      'isActive': instance.isActive,
      'prices': instance.prices,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };
