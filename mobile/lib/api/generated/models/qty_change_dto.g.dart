// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'qty_change_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QtyChangeDto _$QtyChangeDtoFromJson(Map<String, dynamic> json) => QtyChangeDto(
  name: json['name'] as String,
  from: json['from'] as num,
  to: json['to'] as num,
);

Map<String, dynamic> _$QtyChangeDtoToJson(QtyChangeDto instance) =>
    <String, dynamic>{
      'name': instance.name,
      'from': instance.from,
      'to': instance.to,
    };
