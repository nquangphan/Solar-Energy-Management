// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_group_detail_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductGroupDetailResponseDto _$ProductGroupDetailResponseDtoFromJson(
  Map<String, dynamic> json,
) => ProductGroupDetailResponseDto(
  id: json['id'] as String,
  name: json['name'] as String,
  isActive: json['isActive'] as bool,
  items: (json['items'] as List<dynamic>)
      .map(
        (e) => ProductGroupItemResponseDto.fromJson(e as Map<String, dynamic>),
      )
      .toList(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  updatedAt: DateTime.parse(json['updatedAt'] as String),
  description: json['description'] as String?,
);

Map<String, dynamic> _$ProductGroupDetailResponseDtoToJson(
  ProductGroupDetailResponseDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'description': instance.description,
  'isActive': instance.isActive,
  'items': instance.items,
  'createdAt': instance.createdAt.toIso8601String(),
  'updatedAt': instance.updatedAt.toIso8601String(),
};
