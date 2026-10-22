// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'toggle_feature_flag_request_dto.g.dart';

@JsonSerializable()
class ToggleFeatureFlagRequestDto {
  const ToggleFeatureFlagRequestDto({
    required this.enabled,
  });
  
  factory ToggleFeatureFlagRequestDto.fromJson(Map<String, Object?> json) => _$ToggleFeatureFlagRequestDtoFromJson(json);
  
  /// true = bật cờ, false = tắt cờ.
  final bool enabled;

  Map<String, Object?> toJson() => _$ToggleFeatureFlagRequestDtoToJson(this);
}
