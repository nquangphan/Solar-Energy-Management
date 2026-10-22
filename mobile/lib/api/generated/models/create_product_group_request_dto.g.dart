// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_product_group_request_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateProductGroupRequestDto _$CreateProductGroupRequestDtoFromJson(
  Map<String, dynamic> json,
) => CreateProductGroupRequestDto(
  name: json['name'] as String,
  description: json['description'] as String?,
);

Map<String, dynamic> _$CreateProductGroupRequestDtoToJson(
  CreateProductGroupRequestDto instance,
) => <String, dynamic>{
  'name': instance.name,
  'description': instance.description,
};
