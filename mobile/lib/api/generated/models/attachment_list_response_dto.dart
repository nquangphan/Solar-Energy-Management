// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'attachment_item_dto.dart';

part 'attachment_list_response_dto.g.dart';

@JsonSerializable()
class AttachmentListResponseDto {
  const AttachmentListResponseDto({
    required this.items,
  });
  
  factory AttachmentListResponseDto.fromJson(Map<String, Object?> json) => _$AttachmentListResponseDtoFromJson(json);
  
  final List<AttachmentItemDto> items;

  Map<String, Object?> toJson() => _$AttachmentListResponseDtoToJson(this);
}
