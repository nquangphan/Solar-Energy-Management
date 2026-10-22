// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'version_changes_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VersionChangesDto _$VersionChangesDtoFromJson(Map<String, dynamic> json) =>
    VersionChangesDto(
      added: (json['added'] as List<dynamic>).map((e) => e as String).toList(),
      removed: (json['removed'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      qtyChanged: (json['qtyChanged'] as List<dynamic>)
          .map((e) => QtyChangeDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$VersionChangesDtoToJson(VersionChangesDto instance) =>
    <String, dynamic>{
      'added': instance.added,
      'removed': instance.removed,
      'qtyChanged': instance.qtyChanged,
    };
