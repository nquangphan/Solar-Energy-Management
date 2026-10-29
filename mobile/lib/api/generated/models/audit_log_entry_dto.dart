// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'audit_change_dto.dart';
import 'audit_target_type.dart';

part 'audit_log_entry_dto.g.dart';

@JsonSerializable()
class AuditLogEntryDto {
  const AuditLogEntryDto({
    required this.id,
    required this.eventType,
    required this.eventLabel,
    required this.actorAccountId,
    required this.actorDisplayName,
    required this.targetType,
    required this.targetId,
    required this.occurredAt,
    required this.changes,
  });
  
  factory AuditLogEntryDto.fromJson(Map<String, Object?> json) => _$AuditLogEntryDtoFromJson(json);
  
  final String id;

  /// Loại sự kiện (mã).
  final String eventType;

  /// Tên hành động tiếng Việt.
  final String eventLabel;

  /// Account thực hiện; null = hệ thống tự chạy.
  final String? actorAccountId;

  /// Tên hiển thị của account thực hiện; null khi hệ thống tự chạy hoặc account không còn.
  final String? actorDisplayName;

  /// Loại đối tượng bị tác động; null khi sự kiện không gắn đối tượng.
  final AuditTargetType? targetType;

  /// Mã đối tượng (UUID, hoặc SĐT E.164 với khách hàng).
  final String? targetId;

  /// Thời điểm nghiệp vụ, ISO-8601 UTC.
  final DateTime occurredAt;
  final List<AuditChangeDto> changes;

  Map<String, Object?> toJson() => _$AuditLogEntryDtoToJson(this);
}
