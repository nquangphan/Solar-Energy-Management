// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audit_log_list_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuditLogListResponseDto _$AuditLogListResponseDtoFromJson(
  Map<String, dynamic> json,
) => AuditLogListResponseDto(
  items: (json['items'] as List<dynamic>)
      .map((e) => AuditLogEntryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  total: json['total'] as num,
  page: json['page'] as num,
  pageSize: json['pageSize'] as num,
);

Map<String, dynamic> _$AuditLogListResponseDtoToJson(
  AuditLogListResponseDto instance,
) => <String, dynamic>{
  'items': instance.items,
  'total': instance.total,
  'page': instance.page,
  'pageSize': instance.pageSize,
};
