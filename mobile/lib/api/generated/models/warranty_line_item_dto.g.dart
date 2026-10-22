// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'warranty_line_item_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WarrantyLineItemDto _$WarrantyLineItemDtoFromJson(Map<String, dynamic> json) =>
    WarrantyLineItemDto(
      id: json['id'] as String,
      name: json['name'] as String,
      qty: json['qty'] as num,
      unit: json['unit'] as String,
      warrantyMonths: json['warrantyMonths'] as num,
      warrantyStartAt: DateTime.parse(json['warrantyStartAt'] as String),
      warrantyEndAt: DateTime.parse(json['warrantyEndAt'] as String),
      remainingDays: json['remainingDays'] as num,
      remainingMonths: json['remainingMonths'] as num,
      warrantyStatus: WarrantyLineItemDtoWarrantyStatus.fromJson(
        json['warrantyStatus'] as String,
      ),
    );

Map<String, dynamic> _$WarrantyLineItemDtoToJson(
  WarrantyLineItemDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'qty': instance.qty,
  'unit': instance.unit,
  'warrantyMonths': instance.warrantyMonths,
  'warrantyStartAt': instance.warrantyStartAt.toIso8601String(),
  'warrantyEndAt': instance.warrantyEndAt.toIso8601String(),
  'remainingDays': instance.remainingDays,
  'remainingMonths': instance.remainingMonths,
  'warrantyStatus':
      _$WarrantyLineItemDtoWarrantyStatusEnumMap[instance.warrantyStatus]!,
};

const _$WarrantyLineItemDtoWarrantyStatusEnumMap = {
  WarrantyLineItemDtoWarrantyStatus.conHan: 'con_han',
  WarrantyLineItemDtoWarrantyStatus.sapHet: 'sap_het',
  WarrantyLineItemDtoWarrantyStatus.hetHan: 'het_han',
  WarrantyLineItemDtoWarrantyStatus.$unknown: r'$unknown',
};
