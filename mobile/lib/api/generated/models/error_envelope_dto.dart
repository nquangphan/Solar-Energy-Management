// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'field_error_dto.dart';

part 'error_envelope_dto.g.dart';

@JsonSerializable()
class ErrorEnvelopeDto {
  const ErrorEnvelopeDto({
    required this.code,
    required this.message,
    required this.traceId,
    this.fieldErrors,
  });
  
  factory ErrorEnvelopeDto.fromJson(Map<String, Object?> json) => _$ErrorEnvelopeDtoFromJson(json);
  
  /// Mã lỗi string từ enum có tài liệu (ErrorCode). FE map lỗi theo mã này, KHÔNG theo message.
  final String code;

  /// Mô tả lỗi người đọc được (có thể đổi/đa ngôn ngữ).
  final String message;

  /// Danh sách lỗi cấp field (chỉ có ở lỗi validation). Vắng mặt với lỗi không phải validation.
  final List<FieldErrorDto>? fieldErrors;

  /// ID lần lỗi (UUID v4 hoặc x-request-id) — dùng để tra log server-side cùng sự cố.
  final String traceId;

  Map<String, Object?> toJson() => _$ErrorEnvelopeDtoToJson(this);
}
