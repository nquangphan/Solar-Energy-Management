// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'order_lifecycle_step_dto_progress.dart';
import 'order_lifecycle_step_dto_status.dart';

part 'order_lifecycle_step_dto.g.dart';

@JsonSerializable()
class OrderLifecycleStepDto {
  const OrderLifecycleStepDto({
    required this.status,
    required this.progress,
  });
  
  factory OrderLifecycleStepDto.fromJson(Map<String, Object?> json) => _$OrderLifecycleStepDtoFromJson(json);
  
  final OrderLifecycleStepDtoStatus status;

  /// Đơn đã qua bước này / đang đứng ở đây / sắp tới.
  final OrderLifecycleStepDtoProgress progress;

  Map<String, Object?> toJson() => _$OrderLifecycleStepDtoToJson(this);
}
