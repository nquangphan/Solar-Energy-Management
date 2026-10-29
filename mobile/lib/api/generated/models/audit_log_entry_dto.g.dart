// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audit_log_entry_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuditLogEntryDto _$AuditLogEntryDtoFromJson(Map<String, dynamic> json) =>
    AuditLogEntryDto(
      id: json['id'] as String,
      eventType: json['eventType'] as String,
      eventLabel: json['eventLabel'] as String,
      actorAccountId: json['actorAccountId'] as String?,
      actorDisplayName: json['actorDisplayName'] as String?,
      targetType: json['targetType'] == null
          ? null
          : AuditTargetType.fromJson(json['targetType'] as String),
      targetId: json['targetId'] as String?,
      occurredAt: DateTime.parse(json['occurredAt'] as String),
      changes: (json['changes'] as List<dynamic>)
          .map((e) => AuditChangeDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$AuditLogEntryDtoToJson(AuditLogEntryDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'eventType': instance.eventType,
      'eventLabel': instance.eventLabel,
      'actorAccountId': instance.actorAccountId,
      'actorDisplayName': instance.actorDisplayName,
      'targetType': _$AuditTargetTypeEnumMap[instance.targetType],
      'targetId': instance.targetId,
      'occurredAt': instance.occurredAt.toIso8601String(),
      'changes': instance.changes,
    };

const _$AuditTargetTypeEnumMap = {
  AuditTargetType.order: 'Order',
  AuditTargetType.account: 'Account',
  AuditTargetType.product: 'Product',
  AuditTargetType.productGroup: 'ProductGroup',
  AuditTargetType.customer: 'Customer',
  AuditTargetType.customerSource: 'CustomerSource',
  AuditTargetType.stockVoucher: 'StockVoucher',
  AuditTargetType.featureFlag: 'FeatureFlag',
  AuditTargetType.systemSetting: 'SystemSetting',
  AuditTargetType.$unknown: r'$unknown',
};
