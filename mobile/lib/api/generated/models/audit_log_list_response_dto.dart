// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'audit_log_entry_dto.dart';

part 'audit_log_list_response_dto.g.dart';

@JsonSerializable()
class AuditLogListResponseDto {
  const AuditLogListResponseDto({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });
  
  factory AuditLogListResponseDto.fromJson(Map<String, Object?> json) => _$AuditLogListResponseDtoFromJson(json);
  
  final List<AuditLogEntryDto> items;

  /// Tổng số bản ghi khớp bộ lọc (KHÔNG phải số dòng của trang này).
  final num total;

  /// Trang hiện tại (bắt đầu từ 1).
  final num page;

  /// Số bản ghi mỗi trang.
  final num pageSize;

  Map<String, Object?> toJson() => _$AuditLogListResponseDtoToJson(this);
}
