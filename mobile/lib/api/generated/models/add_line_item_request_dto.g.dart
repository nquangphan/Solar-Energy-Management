// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_line_item_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AddLineItemRequestDto _$AddLineItemRequestDtoFromJson(
  Map<String, dynamic> json,
) => AddLineItemRequestDto(
  qty: json['qty'] as num,
  isFlexible: json['isFlexible'] as bool? ?? false,
  productId: json['productId'] as String?,
  unitPrice: json['unitPrice'] as num?,
  name: json['name'] as String?,
  unit: json['unit'] as String?,
  note: json['note'] as String?,
);

Map<String, dynamic> _$AddLineItemRequestDtoToJson(
  AddLineItemRequestDto instance,
) => <String, dynamic>{
  'productId': instance.productId,
  'qty': instance.qty,
  'unitPrice': instance.unitPrice,
  'name': instance.name,
  'unit': instance.unit,
  'note': instance.note,
  'isFlexible': instance.isFlexible,
};
