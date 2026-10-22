// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_customer_source_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateCustomerSourceRequestDto _$UpdateCustomerSourceRequestDtoFromJson(
  Map<String, dynamic> json,
) => UpdateCustomerSourceRequestDto(
  name: json['name'] as String?,
  description: json['description'] as String?,
  sortOrder: json['sortOrder'] as num?,
);

Map<String, dynamic> _$UpdateCustomerSourceRequestDtoToJson(
  UpdateCustomerSourceRequestDto instance,
) => <String, dynamic>{
  'name': instance.name,
  'description': instance.description,
  'sortOrder': instance.sortOrder,
};
