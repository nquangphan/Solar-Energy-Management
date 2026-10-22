// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'product_group_response_dto.g.dart';

@JsonSerializable()
class ProductGroupResponseDto {
  const ProductGroupResponseDto({
    required this.id,
    required this.name,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    this.description,
  });
  
  factory ProductGroupResponseDto.fromJson(Map<String, Object?> json) => _$ProductGroupResponseDtoFromJson(json);
  
  final String id;
  final String name;
  final String? description;

  /// false = gói đã rút khỏi picker (soft-delete).
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, Object?> toJson() => _$ProductGroupResponseDtoToJson(this);
}
