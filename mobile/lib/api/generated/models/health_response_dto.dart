// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'health_response_dto_database.dart';
import 'health_response_dto_status.dart';

part 'health_response_dto.g.dart';

@JsonSerializable()
class HealthResponseDto {
  const HealthResponseDto({
    required this.status,
    required this.database,
    required this.timestamp,
  });
  
  factory HealthResponseDto.fromJson(Map<String, Object?> json) => _$HealthResponseDtoFromJson(json);
  
  /// Trạng thái tổng thể của backend.
  final HealthResponseDtoStatus status;

  /// Kết quả ping DB qua PrismaService (chứng minh wiring AD-1).
  final HealthResponseDtoDatabase database;

  /// Thời điểm phản hồi, ISO-8601 UTC (client hiển thị UTC+7).
  final DateTime timestamp;

  Map<String, Object?> toJson() => _$HealthResponseDtoToJson(this);
}
