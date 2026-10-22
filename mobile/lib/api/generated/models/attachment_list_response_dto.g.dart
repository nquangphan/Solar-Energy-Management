// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attachment_list_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AttachmentListResponseDto _$AttachmentListResponseDtoFromJson(
  Map<String, dynamic> json,
) => AttachmentListResponseDto(
  items: (json['items'] as List<dynamic>)
      .map((e) => AttachmentItemDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$AttachmentListResponseDtoToJson(
  AttachmentListResponseDto instance,
) => <String, dynamic>{'items': instance.items};
