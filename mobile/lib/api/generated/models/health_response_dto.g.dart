// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HealthResponseDto _$HealthResponseDtoFromJson(Map<String, dynamic> json) =>
    HealthResponseDto(
      status: HealthResponseDtoStatus.fromJson(json['status'] as String),
      database: HealthResponseDtoDatabase.fromJson(json['database'] as String),
      timestamp: DateTime.parse(json['timestamp'] as String),
    );

Map<String, dynamic> _$HealthResponseDtoToJson(HealthResponseDto instance) =>
    <String, dynamic>{
      'status': _$HealthResponseDtoStatusEnumMap[instance.status]!,
      'database': _$HealthResponseDtoDatabaseEnumMap[instance.database]!,
      'timestamp': instance.timestamp.toIso8601String(),
    };

const _$HealthResponseDtoStatusEnumMap = {
  HealthResponseDtoStatus.ok: 'ok',
  HealthResponseDtoStatus.$unknown: r'$unknown',
};

const _$HealthResponseDtoDatabaseEnumMap = {
  HealthResponseDtoDatabase.up: 'up',
  HealthResponseDtoDatabase.$unknown: r'$unknown',
};
