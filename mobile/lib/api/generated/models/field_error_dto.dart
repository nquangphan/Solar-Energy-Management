// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'field_error_dto.g.dart';

@JsonSerializable()
class FieldErrorDto {
  const FieldErrorDto({
    required this.field,
    required this.code,
    required this.message,
  });
  
  factory FieldErrorDto.fromJson(Map<String, Object?> json) => _$FieldErrorDtoFromJson(json);
  
  /// Tên field bị lỗi (khớp property của DTO).
  final String field;

  /// Mã lỗi field (constraint key của class-validator, vd "isEmail"), string ổn định để FE map.
  final String code;

  /// Mô tả người đọc được, có thể đổi/đa ngôn ngữ.
  final String message;

  Map<String, Object?> toJson() => _$FieldErrorDtoToJson(this);
}
