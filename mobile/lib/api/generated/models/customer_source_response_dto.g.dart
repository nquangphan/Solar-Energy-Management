// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'customer_source_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CustomerSourceResponseDto _$CustomerSourceResponseDtoFromJson(
  Map<String, dynamic> json,
) => CustomerSourceResponseDto(
  id: json['id'] as String,
  name: json['name'] as String,
  active: json['active'] as bool,
  sortOrder: json['sortOrder'] as num,
  isOther: json['isOther'] as bool,
  description: json['description'] as String?,
);

Map<String, dynamic> _$CustomerSourceResponseDtoToJson(
  CustomerSourceResponseDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'active': instance.active,
  'sortOrder': instance.sortOrder,
  'isOther': instance.isOther,
};
