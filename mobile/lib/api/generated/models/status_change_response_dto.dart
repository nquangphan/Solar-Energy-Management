// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'status_change_response_dto_status.dart';

part 'status_change_response_dto.g.dart';

@JsonSerializable()
class StatusChangeResponseDto {
  const StatusChangeResponseDto({
    required this.status,
    required this.occurredAt,
    required this.savedAttachmentCount,
  });
  
  factory StatusChangeResponseDto.fromJson(Map<String, Object?> json) => _$StatusChangeResponseDtoFromJson(json);
  
  /// Trạng thái đơn SAU khi chuyển — đích đến do bảng transition quyết.
  final StatusChangeResponseDtoStatus status;

  /// Thời điểm của bước (ISO-8601 UTC). CÙNG một giá trị với `occurredAt` của hàng audit và của mọi ảnh trong lượt — đây là khoá nối ảnh vào bước (FR-23).
  final String occurredAt;

  /// Số ảnh bằng chứng đã ghi cho bước này (0 là hợp lệ — upload luôn optional).
  final num savedAttachmentCount;

  Map<String, Object?> toJson() => _$StatusChangeResponseDtoToJson(this);
}
