// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_line_item_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateLineItemRequestDto _$UpdateLineItemRequestDtoFromJson(
  Map<String, dynamic> json,
) => UpdateLineItemRequestDto(
  qty: json['qty'] as num?,
  unitPrice: json['unitPrice'] as num?,
  note: json['note'] as String?,
  isFlexible: json['isFlexible'] as bool?,
  warrantyMonths: json['warrantyMonths'] as num?,
);

Map<String, dynamic> _$UpdateLineItemRequestDtoToJson(
  UpdateLineItemRequestDto instance,
) => <String, dynamic>{
  'qty': instance.qty,
  'unitPrice': instance.unitPrice,
  'note': instance.note,
  'isFlexible': instance.isFlexible,
  'warrantyMonths': instance.warrantyMonths,
};
