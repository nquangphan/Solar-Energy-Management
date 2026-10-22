// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'product_group_item_response_dto.dart';

part 'product_group_detail_response_dto.g.dart';

@JsonSerializable()
class ProductGroupDetailResponseDto {
  const ProductGroupDetailResponseDto({
    required this.id,
    required this.name,
    required this.isActive,
    required this.items,
    required this.createdAt,
    required this.updatedAt,
    this.description,
  });
  
  factory ProductGroupDetailResponseDto.fromJson(Map<String, Object?> json) => _$ProductGroupDetailResponseDtoFromJson(json);
  
  final String id;
  final String name;
  final String? description;

  /// false = gói đã rút khỏi picker (soft-delete).
  final bool isActive;

  /// Các món trong gói, sắp theo displayOrder tăng dần. Rỗng = gói chưa có món nào (hợp lệ).
  final List<ProductGroupItemResponseDto> items;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, Object?> toJson() => _$ProductGroupDetailResponseDtoToJson(this);
}
