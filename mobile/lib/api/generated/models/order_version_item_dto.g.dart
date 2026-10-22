// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_version_item_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderVersionItemDto _$OrderVersionItemDtoFromJson(Map<String, dynamic> json) =>
    OrderVersionItemDto(
      id: json['id'] as String,
      versionNo: json['versionNo'] as num,
      isCurrent: json['isCurrent'] as bool,
      createdAt: DateTime.parse(json['createdAt'] as String),
      lineCount: json['lineCount'] as num,
      changes: VersionChangesDto.fromJson(
        json['changes'] as Map<String, dynamic>,
      ),
      confirmedAt: json['confirmedAt'] == null
          ? null
          : DateTime.parse(json['confirmedAt'] as String),
      createdByAccountId: json['createdByAccountId'] as String?,
      createdByDisplayName: json['createdByDisplayName'] as String?,
    );

Map<String, dynamic> _$OrderVersionItemDtoToJson(
  OrderVersionItemDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'versionNo': instance.versionNo,
  'isCurrent': instance.isCurrent,
  'createdAt': instance.createdAt.toIso8601String(),
  'confirmedAt': instance.confirmedAt?.toIso8601String(),
  'createdByAccountId': instance.createdByAccountId,
  'createdByDisplayName': instance.createdByDisplayName,
  'lineCount': instance.lineCount,
  'changes': instance.changes,
};
