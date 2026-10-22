// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_lifecycle_step_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderLifecycleStepDto _$OrderLifecycleStepDtoFromJson(
  Map<String, dynamic> json,
) => OrderLifecycleStepDto(
  status: OrderLifecycleStepDtoStatus.fromJson(json['status'] as String),
  progress: OrderLifecycleStepDtoProgress.fromJson(json['progress'] as String),
);

Map<String, dynamic> _$OrderLifecycleStepDtoToJson(
  OrderLifecycleStepDto instance,
) => <String, dynamic>{
  'status': _$OrderLifecycleStepDtoStatusEnumMap[instance.status]!,
  'progress': _$OrderLifecycleStepDtoProgressEnumMap[instance.progress]!,
};

const _$OrderLifecycleStepDtoStatusEnumMap = {
  OrderLifecycleStepDtoStatus.baogia: 'baogia',
  OrderLifecycleStepDtoStatus.choduyet: 'choduyet',
  OrderLifecycleStepDtoStatus.dachot: 'dachot',
  OrderLifecycleStepDtoStatus.dacoc: 'dacoc',
  OrderLifecycleStepDtoStatus.thicong: 'thicong',
  OrderLifecycleStepDtoStatus.nghiemthu: 'nghiemthu',
  OrderLifecycleStepDtoStatus.danggiao: 'danggiao',
  OrderLifecycleStepDtoStatus.dagiao: 'dagiao',
  OrderLifecycleStepDtoStatus.hoanthanh: 'hoanthanh',
  OrderLifecycleStepDtoStatus.huy: 'huy',
  OrderLifecycleStepDtoStatus.$unknown: r'$unknown',
};

const _$OrderLifecycleStepDtoProgressEnumMap = {
  OrderLifecycleStepDtoProgress.done: 'done',
  OrderLifecycleStepDtoProgress.current: 'current',
  OrderLifecycleStepDtoProgress.upcoming: 'upcoming',
  OrderLifecycleStepDtoProgress.$unknown: r'$unknown',
};
