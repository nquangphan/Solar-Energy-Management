// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'dashboard_status_count_dto_status.dart';

part 'dashboard_status_count_dto.g.dart';

@JsonSerializable()
class DashboardStatusCountDto {
  const DashboardStatusCountDto({
    required this.status,
    required this.count,
  });
  
  factory DashboardStatusCountDto.fromJson(Map<String, Object?> json) => _$DashboardStatusCountDtoFromJson(json);
  
  final DashboardStatusCountDtoStatus status;

  /// Số đơn đang ở trạng thái này.
  final int count;

  Map<String, Object?> toJson() => _$DashboardStatusCountDtoToJson(this);
}
