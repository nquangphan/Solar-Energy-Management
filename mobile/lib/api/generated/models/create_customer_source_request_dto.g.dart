// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_customer_source_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateCustomerSourceRequestDto _$CreateCustomerSourceRequestDtoFromJson(
  Map<String, dynamic> json,
) => CreateCustomerSourceRequestDto(
  name: json['name'] as String,
  description: json['description'] as String?,
  sortOrder: json['sortOrder'] as num?,
);

Map<String, dynamic> _$CreateCustomerSourceRequestDtoToJson(
  CreateCustomerSourceRequestDto instance,
) => <String, dynamic>{
  'name': instance.name,
  'description': instance.description,
  'sortOrder': instance.sortOrder,
};
