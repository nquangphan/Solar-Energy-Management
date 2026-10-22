// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'warranty_customer_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WarrantyCustomerDto _$WarrantyCustomerDtoFromJson(Map<String, dynamic> json) =>
    WarrantyCustomerDto(
      phone: json['phone'] as String,
      name: json['name'] as String,
      custType: json['custType'] as String,
    );

Map<String, dynamic> _$WarrantyCustomerDtoToJson(
  WarrantyCustomerDto instance,
) => <String, dynamic>{
  'phone': instance.phone,
  'name': instance.name,
  'custType': instance.custType,
};
