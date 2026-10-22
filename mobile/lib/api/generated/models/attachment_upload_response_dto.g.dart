// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attachment_upload_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AttachmentUploadResponseDto _$AttachmentUploadResponseDtoFromJson(
  Map<String, dynamic> json,
) => AttachmentUploadResponseDto(
  savedAttachmentCount: json['savedAttachmentCount'] as num,
  attachmentIds: (json['attachmentIds'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$AttachmentUploadResponseDtoToJson(
  AttachmentUploadResponseDto instance,
) => <String, dynamic>{
  'savedAttachmentCount': instance.savedAttachmentCount,
  'attachmentIds': instance.attachmentIds,
};
