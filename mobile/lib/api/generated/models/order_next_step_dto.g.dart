// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_next_step_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderNextStepDto _$OrderNextStepDtoFromJson(Map<String, dynamic> json) =>
    OrderNextStepDto(
      event: json['event'] as String,
      to: OrderNextStepDtoTo.fromJson(json['to'] as String),
      requires: json['requires'] as String,
    );

Map<String, dynamic> _$OrderNextStepDtoToJson(OrderNextStepDto instance) =>
    <String, dynamic>{
      'event': instance.event,
      'to': _$OrderNextStepDtoToEnumMap[instance.to]!,
      'requires': instance.requires,
    };

const _$OrderNextStepDtoToEnumMap = {
  OrderNextStepDtoTo.baogia: 'baogia',
  OrderNextStepDtoTo.choduyet: 'choduyet',
  OrderNextStepDtoTo.dachot: 'dachot',
  OrderNextStepDtoTo.dacoc: 'dacoc',
  OrderNextStepDtoTo.thicong: 'thicong',
  OrderNextStepDtoTo.nghiemthu: 'nghiemthu',
  OrderNextStepDtoTo.danggiao: 'danggiao',
  OrderNextStepDtoTo.dagiao: 'dagiao',
  OrderNextStepDtoTo.hoanthanh: 'hoanthanh',
  OrderNextStepDtoTo.huy: 'huy',
  OrderNextStepDtoTo.$unknown: r'$unknown',
};
