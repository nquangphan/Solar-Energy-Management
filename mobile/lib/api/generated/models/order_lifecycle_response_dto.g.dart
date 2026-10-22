// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_lifecycle_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderLifecycleResponseDto _$OrderLifecycleResponseDtoFromJson(
  Map<String, dynamic> json,
) => OrderLifecycleResponseDto(
  steps: (json['steps'] as List<dynamic>)
      .map((e) => OrderLifecycleStepDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  nextSteps: (json['nextSteps'] as List<dynamic>)
      .map((e) => OrderNextStepDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  canCancel: json['canCancel'] as bool,
);

Map<String, dynamic> _$OrderLifecycleResponseDtoToJson(
  OrderLifecycleResponseDto instance,
) => <String, dynamic>{
  'steps': instance.steps,
  'nextSteps': instance.nextSteps,
  'canCancel': instance.canCancel,
};
