// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'attachment_item_dto.g.dart';

@JsonSerializable()
class AttachmentItemDto {
  const AttachmentItemDto({
    required this.id,
    required this.fileName,
    required this.contentType,
    required this.size,
    required this.createdAt,
    required this.uploadedBy,
    required this.canDelete,
    this.statusFrom,
    this.statusTo,
  });
  
  factory AttachmentItemDto.fromJson(Map<String, Object?> json) => _$AttachmentItemDtoFromJson(json);
  
  final String id;

  /// Tên file đã dọn ký tự nguy hiểm lúc ghi, giữ tiếng Việt có dấu.
  final String fileName;
  final String contentType;

  /// Kích thước byte.
  final num size;

  /// ISO-8601 UTC.
  final DateTime createdAt;

  /// Tên hiển thị người tải ảnh lên.
  final String uploadedBy;

  /// Trạng thái TRƯỚC bước ảnh này thuộc về; null với ảnh bổ sung.
  final String? statusFrom;

  /// Trạng thái SAU bước ảnh này thuộc về; null với ảnh bổ sung.
  final String? statusTo;

  /// Người gọi có xoá được ảnh này không — tính Ở BACKEND (người tải lên HOẶC có quyền chỉnh sửa đơn). Client CHỈ hiển thị, không dựng lại luật.
  final bool canDelete;

  Map<String, Object?> toJson() => _$AttachmentItemDtoToJson(this);
}
