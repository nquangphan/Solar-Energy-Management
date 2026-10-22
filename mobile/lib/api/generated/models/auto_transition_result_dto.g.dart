// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auto_transition_result_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AutoTransitionResultDto _$AutoTransitionResultDtoFromJson(
  Map<String, dynamic> json,
) => AutoTransitionResultDto(
  event: AutoTransitionResultDtoEvent.fromJson(json['event'] as String),
  outcome: AutoTransitionResultDtoOutcome.fromJson(json['outcome'] as String),
  message: json['message'] as String?,
);

Map<String, dynamic> _$AutoTransitionResultDtoToJson(
  AutoTransitionResultDto instance,
) => <String, dynamic>{
  'event': _$AutoTransitionResultDtoEventEnumMap[instance.event]!,
  'outcome': _$AutoTransitionResultDtoOutcomeEnumMap[instance.outcome]!,
  'message': instance.message,
};

const _$AutoTransitionResultDtoEventEnumMap = {
  AutoTransitionResultDtoEvent.duCoc: 'du_coc',
  AutoTransitionResultDtoEvent.hoanThanh: 'hoan_thanh',
  AutoTransitionResultDtoEvent.$unknown: r'$unknown',
};

const _$AutoTransitionResultDtoOutcomeEnumMap = {
  AutoTransitionResultDtoOutcome.applied: 'applied',
  AutoTransitionResultDtoOutcome.already: 'already',
  AutoTransitionResultDtoOutcome.skipped: 'skipped',
  AutoTransitionResultDtoOutcome.$unknown: r'$unknown',
};
