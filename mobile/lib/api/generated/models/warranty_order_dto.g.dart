// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'warranty_order_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WarrantyOrderDto _$WarrantyOrderDtoFromJson(Map<String, dynamic> json) =>
    WarrantyOrderDto(
      id: json['id'] as String,
      status: json['status'] as String,
      lineItems: (json['lineItems'] as List<dynamic>)
          .map((e) => WarrantyLineItemDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      confirmedAt: json['confirmedAt'] == null
          ? null
          : DateTime.parse(json['confirmedAt'] as String),
    );

Map<String, dynamic> _$WarrantyOrderDtoToJson(WarrantyOrderDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'confirmedAt': instance.confirmedAt?.toIso8601String(),
      'lineItems': instance.lineItems,
    };
