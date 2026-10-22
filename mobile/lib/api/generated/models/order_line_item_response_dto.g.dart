// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_line_item_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderLineItemResponseDto _$OrderLineItemResponseDtoFromJson(
  Map<String, dynamic> json,
) => OrderLineItemResponseDto(
  id: json['id'] as String,
  name: json['name'] as String,
  unit: json['unit'] as String,
  qty: json['qty'] as num,
  unitPrice: json['unitPrice'] as num,
  priceEditable: json['priceEditable'] as bool,
  isFlexible: json['isFlexible'] as bool,
  displayOrder: json['displayOrder'] as num,
  amount: json['amount'] as num,
  productId: json['productId'] as String?,
  note: json['note'] as String?,
  warrantyMonths: json['warrantyMonths'] as num?,
);

Map<String, dynamic> _$OrderLineItemResponseDtoToJson(
  OrderLineItemResponseDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'productId': instance.productId,
  'name': instance.name,
  'unit': instance.unit,
  'qty': instance.qty,
  'unitPrice': instance.unitPrice,
  'priceEditable': instance.priceEditable,
  'isFlexible': instance.isFlexible,
  'note': instance.note,
  'warrantyMonths': instance.warrantyMonths,
  'displayOrder': instance.displayOrder,
  'amount': instance.amount,
};
