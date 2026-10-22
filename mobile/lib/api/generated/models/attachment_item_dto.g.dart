// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attachment_item_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AttachmentItemDto _$AttachmentItemDtoFromJson(Map<String, dynamic> json) =>
    AttachmentItemDto(
      id: json['id'] as String,
      fileName: json['fileName'] as String,
      contentType: json['contentType'] as String,
      size: json['size'] as num,
      createdAt: DateTime.parse(json['createdAt'] as String),
      uploadedBy: json['uploadedBy'] as String,
      canDelete: json['canDelete'] as bool,
      statusFrom: json['statusFrom'] as String?,
      statusTo: json['statusTo'] as String?,
    );

Map<String, dynamic> _$AttachmentItemDtoToJson(AttachmentItemDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'fileName': instance.fileName,
      'contentType': instance.contentType,
      'size': instance.size,
      'createdAt': instance.createdAt.toIso8601String(),
      'uploadedBy': instance.uploadedBy,
      'statusFrom': instance.statusFrom,
      'statusTo': instance.statusTo,
      'canDelete': instance.canDelete,
    };
