// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'status_change_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StatusChangeResponseDto _$StatusChangeResponseDtoFromJson(
  Map<String, dynamic> json,
) => StatusChangeResponseDto(
  status: StatusChangeResponseDtoStatus.fromJson(json['status'] as String),
  occurredAt: json['occurredAt'] as String,
  savedAttachmentCount: json['savedAttachmentCount'] as num,
);

Map<String, dynamic> _$StatusChangeResponseDtoToJson(
  StatusChangeResponseDto instance,
) => <String, dynamic>{
  'status': _$StatusChangeResponseDtoStatusEnumMap[instance.status]!,
  'occurredAt': instance.occurredAt,
  'savedAttachmentCount': instance.savedAttachmentCount,
};

const _$StatusChangeResponseDtoStatusEnumMap = {
  StatusChangeResponseDtoStatus.baogia: 'baogia',
  StatusChangeResponseDtoStatus.choduyet: 'choduyet',
  StatusChangeResponseDtoStatus.dachot: 'dachot',
  StatusChangeResponseDtoStatus.dacoc: 'dacoc',
  StatusChangeResponseDtoStatus.thicong: 'thicong',
  StatusChangeResponseDtoStatus.nghiemthu: 'nghiemthu',
  StatusChangeResponseDtoStatus.danggiao: 'danggiao',
  StatusChangeResponseDtoStatus.dagiao: 'dagiao',
  StatusChangeResponseDtoStatus.hoanthanh: 'hoanthanh',
  StatusChangeResponseDtoStatus.huy: 'huy',
  StatusChangeResponseDtoStatus.$unknown: r'$unknown',
};
