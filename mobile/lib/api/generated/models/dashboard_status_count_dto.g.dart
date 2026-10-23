// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_status_count_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DashboardStatusCountDto _$DashboardStatusCountDtoFromJson(
  Map<String, dynamic> json,
) => DashboardStatusCountDto(
  status: DashboardStatusCountDtoStatus.fromJson(json['status'] as String),
  count: (json['count'] as num).toInt(),
);

Map<String, dynamic> _$DashboardStatusCountDtoToJson(
  DashboardStatusCountDto instance,
) => <String, dynamic>{
  'status': _$DashboardStatusCountDtoStatusEnumMap[instance.status]!,
  'count': instance.count,
};

const _$DashboardStatusCountDtoStatusEnumMap = {
  DashboardStatusCountDtoStatus.baogia: 'baogia',
  DashboardStatusCountDtoStatus.choduyet: 'choduyet',
  DashboardStatusCountDtoStatus.dachot: 'dachot',
  DashboardStatusCountDtoStatus.dacoc: 'dacoc',
  DashboardStatusCountDtoStatus.thicong: 'thicong',
  DashboardStatusCountDtoStatus.nghiemthu: 'nghiemthu',
  DashboardStatusCountDtoStatus.danggiao: 'danggiao',
  DashboardStatusCountDtoStatus.dagiao: 'dagiao',
  DashboardStatusCountDtoStatus.hoanthanh: 'hoanthanh',
  DashboardStatusCountDtoStatus.huy: 'huy',
  DashboardStatusCountDtoStatus.$unknown: r'$unknown',
};
