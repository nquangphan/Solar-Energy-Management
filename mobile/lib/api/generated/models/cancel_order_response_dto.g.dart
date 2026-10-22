// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cancel_order_response_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CancelOrderResponseDto _$CancelOrderResponseDtoFromJson(
  Map<String, dynamic> json,
) => CancelOrderResponseDto(
  status: CancelOrderResponseDtoStatus.fromJson(json['status'] as String),
  occurredAt: json['occurredAt'] as String,
);

Map<String, dynamic> _$CancelOrderResponseDtoToJson(
  CancelOrderResponseDto instance,
) => <String, dynamic>{
  'status': _$CancelOrderResponseDtoStatusEnumMap[instance.status]!,
  'occurredAt': instance.occurredAt,
};

const _$CancelOrderResponseDtoStatusEnumMap = {
  CancelOrderResponseDtoStatus.baogia: 'baogia',
  CancelOrderResponseDtoStatus.choduyet: 'choduyet',
  CancelOrderResponseDtoStatus.dachot: 'dachot',
  CancelOrderResponseDtoStatus.dacoc: 'dacoc',
  CancelOrderResponseDtoStatus.thicong: 'thicong',
  CancelOrderResponseDtoStatus.nghiemthu: 'nghiemthu',
  CancelOrderResponseDtoStatus.danggiao: 'danggiao',
  CancelOrderResponseDtoStatus.dagiao: 'dagiao',
  CancelOrderResponseDtoStatus.hoanthanh: 'hoanthanh',
  CancelOrderResponseDtoStatus.huy: 'huy',
  CancelOrderResponseDtoStatus.$unknown: r'$unknown',
};
