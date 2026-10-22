// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'feature_flag_response_dto.g.dart';

@JsonSerializable()
class FeatureFlagResponseDto {
  const FeatureFlagResponseDto({
    required this.key,
    required this.label,
    required this.enabled,
  });
  
  factory FeatureFlagResponseDto.fromJson(Map<String, Object?> json) => _$FeatureFlagResponseDtoFromJson(json);
  
  /// Tên cờ chính tắc (khoá chính). Chỉ những cờ trong registry mới tồn tại.
  final String key;

  /// Nhãn tiếng Việt để hiển thị.
  final String label;

  /// Cờ chưa từng được bấm ⇒ false (mặc định TẮT, fail-closed).
  final bool enabled;

  Map<String, Object?> toJson() => _$FeatureFlagResponseDtoToJson(this);
}
