// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_product_group_request_dto.g.dart';

@JsonSerializable()
class UpdateProductGroupRequestDto {
  const UpdateProductGroupRequestDto({
    this.name,
    this.description,
  });
  
  factory UpdateProductGroupRequestDto.fromJson(Map<String, Object?> json) => _$UpdateProductGroupRequestDtoFromJson(json);
  
  /// Tên gói mới — vẫn phải DUY NHẤT (trùng gói khác ⇒ 409).
  final String? name;

  /// Mô tả gói. Gửi `null` để XOÁ mô tả (cột nullable).
  final String? description;

  Map<String, Object?> toJson() => _$UpdateProductGroupRequestDtoToJson(this);
}
