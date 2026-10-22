// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'create_product_group_request_dto.g.dart';

@JsonSerializable()
class CreateProductGroupRequestDto {
  const CreateProductGroupRequestDto({
    required this.name,
    this.description,
  });
  
  factory CreateProductGroupRequestDto.fromJson(Map<String, Object?> json) => _$CreateProductGroupRequestDtoFromJson(json);
  
  /// Tên gói — duy nhất trong danh mục (trùng ⇒ 409).
  final String name;

  /// Mô tả cho người dựng báo giá.
  final String? description;

  Map<String, Object?> toJson() => _$CreateProductGroupRequestDtoToJson(this);
}
