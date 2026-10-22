// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_group_item_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductGroupItemResponseDto _$ProductGroupItemResponseDtoFromJson(
  Map<String, dynamic> json,
) => ProductGroupItemResponseDto(
  productId: json['productId'] as String,
  name: json['name'] as String,
  sku: json['sku'] as String,
  unit: json['unit'] as String,
  price: json['price'] as num,
  isActive: json['isActive'] as bool,
  displayOrder: json['displayOrder'] as num,
);

Map<String, dynamic> _$ProductGroupItemResponseDtoToJson(
  ProductGroupItemResponseDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'name': instance.name,
  'sku': instance.sku,
  'unit': instance.unit,
  'price': instance.price,
  'isActive': instance.isActive,
  'displayOrder': instance.displayOrder,
};
