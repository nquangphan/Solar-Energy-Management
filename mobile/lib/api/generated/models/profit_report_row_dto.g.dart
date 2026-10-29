// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profit_report_row_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProfitReportRowDto _$ProfitReportRowDtoFromJson(Map<String, dynamic> json) =>
    ProfitReportRowDto(
      revenue: (json['revenue'] as num).toInt(),
      cost: (json['cost'] as num).toInt(),
      grossProfit: (json['grossProfit'] as num).toInt(),
      marginPct: (json['marginPct'] as num?)?.toInt(),
      orderCount: (json['orderCount'] as num).toInt(),
      key: json['key'] as String?,
      label: json['label'] as String,
      customerName: json['customerName'] as String?,
      assigneeDisplayName: json['assigneeDisplayName'] as String?,
      sourceName: json['sourceName'] as String?,
      issuedAt: json['issuedAt'] == null
          ? null
          : DateTime.parse(json['issuedAt'] as String),
    );

Map<String, dynamic> _$ProfitReportRowDtoToJson(ProfitReportRowDto instance) =>
    <String, dynamic>{
      'revenue': instance.revenue,
      'cost': instance.cost,
      'grossProfit': instance.grossProfit,
      'marginPct': instance.marginPct,
      'orderCount': instance.orderCount,
      'key': instance.key,
      'label': instance.label,
      'customerName': instance.customerName,
      'assigneeDisplayName': instance.assigneeDisplayName,
      'sourceName': instance.sourceName,
      'issuedAt': instance.issuedAt?.toIso8601String(),
    };
