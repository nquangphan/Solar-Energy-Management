// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'auto_transition_result_dto_event.dart';
import 'auto_transition_result_dto_outcome.dart';

part 'auto_transition_result_dto.g.dart';

@JsonSerializable()
class AutoTransitionResultDto {
  const AutoTransitionResultDto({
    required this.event,
    required this.outcome,
    required this.message,
  });
  
  factory AutoTransitionResultDto.fromJson(Map<String, Object?> json) => _$AutoTransitionResultDtoFromJson(json);
  
  final AutoTransitionResultDtoEvent event;

  /// applied = đơn đã chuyển; already = đơn đã ở đích; skipped = chuyển bị từ chối (tiền VẪN được ghi).
  final AutoTransitionResultDtoOutcome outcome;

  /// Lý do bị bỏ qua (khi skipped); null trong trường hợp khác.
  final String? message;

  Map<String, Object?> toJson() => _$AutoTransitionResultDtoToJson(this);
}
