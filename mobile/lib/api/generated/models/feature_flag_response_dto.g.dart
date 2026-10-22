// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'feature_flag_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FeatureFlagResponseDto _$FeatureFlagResponseDtoFromJson(
  Map<String, dynamic> json,
) => FeatureFlagResponseDto(
  key: json['key'] as String,
  label: json['label'] as String,
  enabled: json['enabled'] as bool,
);

Map<String, dynamic> _$FeatureFlagResponseDtoToJson(
  FeatureFlagResponseDto instance,
) => <String, dynamic>{
  'key': instance.key,
  'label': instance.label,
  'enabled': instance.enabled,
};
