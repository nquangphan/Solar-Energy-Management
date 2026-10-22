// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'attachment_upload_response_dto.g.dart';

@JsonSerializable()
class AttachmentUploadResponseDto {
  const AttachmentUploadResponseDto({
    required this.savedAttachmentCount,
    required this.attachmentIds,
  });
  
  factory AttachmentUploadResponseDto.fromJson(Map<String, Object?> json) => _$AttachmentUploadResponseDtoFromJson(json);
  
  /// Số ảnh đã lưu trong lượt này.
  final num savedAttachmentCount;
  final List<String> attachmentIds;

  Map<String, Object?> toJson() => _$AttachmentUploadResponseDtoToJson(this);
}
