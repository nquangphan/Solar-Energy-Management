// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_group_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductGroupResponseDto _$ProductGroupResponseDtoFromJson(
  Map<String, dynamic> json,
) => ProductGroupResponseDto(
  id: json['id'] as String,
  name: json['name'] as String,
  isActive: json['isActive'] as bool,
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
  description: json['description'] as String?,
);

Map<String, dynamic> _$ProductGroupResponseDtoToJson(
  ProductGroupResponseDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'isActive': instance.isActive,
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
};
