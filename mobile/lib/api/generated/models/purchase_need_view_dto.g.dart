// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'purchase_need_view_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PurchaseNeedViewDto _$PurchaseNeedViewDtoFromJson(Map<String, dynamic> json) =>
    PurchaseNeedViewDto(
      productId: json['productId'] as String,
      name: json['name'] as String,
      unit: json['unit'] as String,
      toPurchase: json['toPurchase'] as num,
    );

Map<String, dynamic> _$PurchaseNeedViewDtoToJson(
  PurchaseNeedViewDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'name': instance.name,
  'unit': instance.unit,
  'toPurchase': instance.toPurchase,
};
